/**
 * The chat with the assistant: the conversation so far, and the loop that sends it to the server,
 * runs whatever Claude asks to do on your data, and sends the results back until Claude is done.
 *
 * The conversation only ever grows (Claude's thinking is tied to what came before), so nothing
 * already sent is edited — each new message carries a fresh <app_context> instead.
 */
import type Anthropic from '@anthropic-ai/sdk';
import { create } from 'zustand';
import { MAX_CHAT_CHARS, MAX_MESSAGES, MAX_ROUNDS } from './assistant';
import { currentContext, runTool, type Change } from './assistantTools';
import { useApp } from './store';

type Message = Anthropic.Beta.BetaMessageParam;
type Block = Anthropic.Beta.BetaContentBlock;

interface ChatState {
  messages: Message[];
  /** What each of Claude's tool calls changed (by tool call id), with Undo. */
  changes: Record<string, Change & { undone?: boolean }>;
  busy: boolean;
  error: string | null;
}

export const useChat = create<ChatState>()(() => ({ messages: [], changes: {}, busy: false, error: null }));

const CONTEXT_TAG = '<app_context>';

/** No room left for one more message and its tool rounds. */
export const chatFull = (messages: Message[]) => messages.length + 2 * MAX_ROUNDS + 1 > MAX_MESSAGES || JSON.stringify(messages).length > MAX_CHAT_CHARS * 0.8;

const push = (m: Message) => useChat.setState((s) => ({ messages: [...s.messages, m] }));

async function ask(messages: Message[]): Promise<{ content: Block[]; stop_reason: string | null }> {
  if (useApp.getState().mode !== 'cloud') throw new Error('The assistant needs sync turned on (Settings → Sync & backup).');
  const { idToken } = await import('./cloud');
  let res: Response;
  try {
    res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${await idToken()}` },
      body: JSON.stringify({ messages }),
    });
  } catch {
    throw new Error('No connection — check your signal and try again.');
  }
  const body = (await res.json().catch(() => null)) as { content?: Block[]; stop_reason?: string | null; error?: string } | null;
  if (!res.ok || !Array.isArray(body?.content)) {
    throw new Error(body?.error ?? (res.status === 404 ? 'The assistant only runs on the live site (it lives on Vercel).' : `The assistant isn't answering (${res.status}).`));
  }
  return { content: body.content, stop_reason: body.stop_reason ?? null };
}

/** Keep going until Claude has finished: ask, do what it says, send back what happened. */
async function run() {
  useChat.setState({ busy: true, error: null });
  try {
    for (let round = 0; round < MAX_ROUNDS; round++) {
      const reply = await ask(useChat.getState().messages);
      push({ role: 'assistant', content: reply.content });

      // Every tool call needs an answer before the chat can go on, even one that wasn't run.
      const calls = reply.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === 'tool_use');
      if (calls.length) {
        const changes: ChatState['changes'] = {};
        const results = calls.map((call): Anthropic.Beta.BetaToolResultBlockParam => {
          if (reply.stop_reason !== 'tool_use') return { type: 'tool_result', tool_use_id: call.id, content: 'Not done: the reply was cut off.', is_error: true };
          const out = runTool(call.name, call.input);
          if (out.change) changes[call.id] = out.change;
          return { type: 'tool_result', tool_use_id: call.id, content: out.result, ...(out.isError && { is_error: true }) };
        });
        useChat.setState((s) => ({ changes: { ...s.changes, ...changes } }));
        push({ role: 'user', content: results });
      }

      if (reply.stop_reason === 'tool_use') continue;
      if (reply.stop_reason === 'refusal') useChat.setState({ error: 'Claude couldn’t help with that one — try saying it another way.' });
      if (reply.stop_reason === 'max_tokens') useChat.setState({ error: 'That reply got cut off — try asking for less at once.' });
      return;
    }
    useChat.setState({ error: 'That took too many steps — try saying it another way.' });
  } catch (err) {
    useChat.setState({ error: err instanceof Error ? err.message : String(err) });
  } finally {
    useChat.setState({ busy: false });
  }
}

export async function sendMessage(text: string) {
  const { busy, messages } = useChat.getState();
  if (busy || !text.trim() || chatFull(messages)) return;
  push({
    role: 'user',
    content: [
      { type: 'text', text: `${CONTEXT_TAG}\n${currentContext()}\n</app_context>` },
      { type: 'text', text: text.trim() },
    ],
  });
  await run();
}

/** Try the last step again (after a dropped connection or a server error). */
export function retry() {
  const { busy, messages } = useChat.getState();
  if (!busy && messages.at(-1)?.role === 'user') void run();
}

export function undoChange(id: string) {
  const change = useChat.getState().changes[id];
  if (!change || change.undone) return;
  change.undo();
  useChat.setState((s) => ({ changes: { ...s.changes, [id]: { ...change, undone: true } } }));
}

export function newChat() {
  if (!useChat.getState().busy) useChat.setState({ messages: [], changes: {}, error: null });
}

// ---------------------------------------------------------------------------
// What the chat shows
// ---------------------------------------------------------------------------

export type ChatItem =
  | { kind: 'you' | 'claude'; key: string; text: string }
  | { kind: 'change'; key: string; id: string; label: string; undone: boolean };

/** Your messages, Claude's replies and the changes it made, in order (the app context and tool results stay hidden). */
export function chatItems(messages: Message[], changes: ChatState['changes']): ChatItem[] {
  const out: ChatItem[] = [];
  messages.forEach((m, i) => {
    const blocks = typeof m.content === 'string' ? [{ type: 'text' as const, text: m.content }] : m.content;
    blocks.forEach((b, j) => {
      const key = `${i}.${j}`;
      if (b.type === 'text' && b.text.trim() && !b.text.startsWith(CONTEXT_TAG)) out.push({ kind: m.role === 'user' ? 'you' : 'claude', key, text: b.text.trim() });
      if (b.type === 'tool_use' && changes[b.id]) out.push({ kind: 'change', key, id: b.id, label: changes[b.id].label, undone: !!changes[b.id].undone });
    });
  });
  return out;
}
