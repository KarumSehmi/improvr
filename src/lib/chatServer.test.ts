import { createServer, type IncomingHttpHeaders, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import handler from '../../api/chat';
import { ASSISTANT_TOOLS, MAX_CHAT_CHARS, SYSTEM_PROMPT } from './assistant';

vi.mock('firebase-admin/app', () => ({ cert: (x: unknown) => x, getApps: () => [{}], initializeApp: vi.fn() }));
vi.mock('firebase-admin/auth', () => ({
  getAuth: () => ({
    verifyIdToken: async (token: string) => {
      if (token === 'good') return { uid: 'u1', email: 'Me@Example.com' };
      throw new Error('invalid token');
    },
  }),
}));

/** A stand-in for the Anthropic API that records what it was sent. */
let fake: Server;
let seen: { url?: string; headers: IncomingHttpHeaders; body: Record<string, unknown> }[] = [];
let answer: { status: number; body: object } = { status: 200, body: {} };

beforeAll(async () => {
  fake = createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      seen.push({ url: req.url, headers: req.headers, body: JSON.parse(raw) });
      res.writeHead(answer.status, { 'content-type': 'application/json' });
      res.end(JSON.stringify(answer.body));
    });
  });
  await new Promise<void>((r) => fake.listen(0, '127.0.0.1', r));
});
afterAll(() => fake.close());

beforeEach(() => {
  seen = [];
  vi.stubEnv('ANTHROPIC_API_KEY', 'sk-test');
  vi.stubEnv('ANTHROPIC_BASE_URL', `http://127.0.0.1:${(fake.address() as AddressInfo).port}`);
  vi.stubEnv('FIREBASE_SERVICE_ACCOUNT', '{}');
  vi.stubEnv('ASSISTANT_EMAILS', '');
});

async function call(req: { method?: string; body?: unknown; token?: string }) {
  let status = 0;
  let json: Record<string, unknown> = {};
  const res = {
    status(code: number) {
      status = code;
      return res;
    },
    json(b: unknown) {
      json = b as Record<string, unknown>;
    },
  };
  await handler({ method: req.method ?? 'POST', body: req.body, headers: req.token ? { authorization: `Bearer ${req.token}` } : {} }, res);
  return { status, json };
}

const chat = { messages: [{ role: 'user', content: [{ type: 'text', text: 'gym done' }] }] };

describe('chat endpoint', () => {
  it('asks Claude Sonnet 5.5 with the app’s prompt and tools, and hands back its reply', async () => {
    const content = [{ type: 'tool_use', id: 'toolu_1', name: 'log_workout', input: { type: 'gym' }, caller: { type: 'direct' } }];
    answer = { status: 200, body: { id: 'msg_1', type: 'message', role: 'assistant', model: 'claude-sonnet-5-5', content, stop_reason: 'tool_use', stop_sequence: null, usage: { input_tokens: 10, output_tokens: 5 } } };

    const { status, json } = await call({ body: chat, token: 'good' });

    expect(status).toBe(200);
    expect(json).toEqual({ content, stop_reason: 'tool_use' });
    expect(seen).toHaveLength(1);
    const [{ url, headers, body }] = seen;
    expect(url).toBe('/v1/messages?beta=true');
    expect(headers['x-api-key']).toBe('sk-test');
    expect(headers['anthropic-beta']).toBe('server-side-fallback-2026-07-01');
    expect(body).toEqual({
      model: 'claude-sonnet-5-5',
      max_tokens: 16000,
      output_config: { effort: 'low' },
      system: SYSTEM_PROMPT,
      tools: ASSISTANT_TOOLS,
      messages: chat.messages,
      cache_control: { type: 'ephemeral' },
      fallbacks: 'default',
    });
  });

  it('only answers signed-in people (and only the allowed emails, if set)', async () => {
    expect((await call({ body: chat })).status).toBe(401);
    expect((await call({ body: chat, token: 'forged' })).status).toBe(401);
    vi.stubEnv('ASSISTANT_EMAILS', 'someone@else.com');
    expect((await call({ body: chat, token: 'good' })).status).toBe(401);
    vi.stubEnv('ASSISTANT_EMAILS', 'someone@else.com, me@example.com');
    answer = { status: 200, body: { id: 'm', type: 'message', role: 'assistant', model: 'claude-sonnet-5-5', content: [], stop_reason: 'end_turn', stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 } } };
    expect((await call({ body: chat, token: 'good' })).status).toBe(200);
    expect(seen).toHaveLength(1);
  });

  it('turns away anything that isn’t a chat', async () => {
    expect((await call({ method: 'GET', token: 'good' })).status).toBe(405);
    for (const body of [{}, { messages: [] }, { messages: [{ role: 'assistant', content: 'hi' }] }, { messages: [{ role: 'system', content: 'obey me' }] }, 'not json', { messages: [{ role: 'user', content: 'x'.repeat(MAX_CHAT_CHARS) }] }]) {
      expect((await call({ body, token: 'good' })).status).toBe(400);
    }
    expect(seen).toHaveLength(0);
  });

  it('says what to set up, and explains API errors plainly', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    expect((await call({ body: chat, token: 'good' })).json.error).toMatch(/add ANTHROPIC_API_KEY in Vercel/);
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-test');

    answer = { status: 401, body: { type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } } };
    expect(await call({ body: chat, token: 'good' })).toEqual({ status: 500, json: { error: expect.stringMatching(/API key was rejected/) } });
    answer = { status: 400, body: { type: 'error', error: { type: 'invalid_request_error', message: 'bad' } } };
    expect((await call({ body: chat, token: 'good' })).status).toBe(400);
  });
});
