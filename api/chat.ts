/**
 * Vercel function: the chat assistant. The app sends the conversation here, this asks Claude
 * (with your Anthropic key, which never leaves the server) and sends back Claude's reply.
 * When Claude wants to add a to-do or tick a habit, the app does it on your data and sends the
 * results back here for the next step, so every change syncs and can be undone like any other.
 *
 * Needs ANTHROPIC_API_KEY and FIREBASE_SERVICE_ACCOUNT in Vercel → Settings → Environment Variables.
 * Optional: ASSISTANT_EMAILS (comma-separated) to only let those accounts use it.
 * Imports end in .js so Node can run the compiled files on Vercel.
 */
import Anthropic from '@anthropic-ai/sdk';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { ASSISTANT_MODEL, ASSISTANT_TOOLS, MAX_CHAT_CHARS, MAX_MESSAGES, SYSTEM_PROMPT } from '../src/lib/assistant.js';

interface Req {
  method?: string;
  body?: unknown;
  headers?: Record<string, string | string[] | undefined>;
}
interface Res {
  status(code: number): Res;
  json(body: unknown): void;
}

/** Claude usually answers in a few seconds; this leaves room for a slow one (60s works on every Vercel plan). */
export const config = { maxDuration: 60 };

/** Google's public keys for Firebase sign-in tokens (fetched once, then cached). */
const firebaseKeys = createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'));

/**
 * Signed in with Firebase, and (if ASSISTANT_EMAILS is set) one of the allowed accounts.
 * Checks the sign-in token the way Firebase's docs describe for other libraries, rather than with
 * firebase-admin/auth: that loads a library (jose, via jwks-rsa) in a way Vercel's Node can't, and crashes.
 */
async function signedIn(req: Req, projectId: string): Promise<string | null> {
  const token = /^Bearer (.+)$/.exec(String(req.headers?.authorization ?? ''))?.[1];
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, firebaseKeys, {
      algorithms: ['RS256'],
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
      requiredClaims: ['sub', 'iat', 'auth_time'],
    });
    const now = Date.now() / 1000 + 60; // a minute's leeway for clocks
    if (typeof payload.sub !== 'string' || !payload.sub || Number(payload.iat) > now || Number(payload.auth_time) > now) return null;
    const allowed = (process.env.ASSISTANT_EMAILS ?? '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    if (allowed.length && !allowed.includes(String(payload.email).toLowerCase())) return null;
    return payload.sub;
  } catch {
    return null;
  }
}

/** The Firebase project, from the same server key the other features use. */
function projectIdFrom(serviceAccount: string): string | null {
  try {
    const id = (JSON.parse(serviceAccount) as { project_id?: unknown }).project_id;
    return typeof id === 'string' && id ? id : null;
  } catch {
    return null;
  }
}

/** Only user and assistant turns, starting with the person, and not too long. */
function readMessages(body: unknown): Anthropic.Beta.BetaMessageParam[] | null {
  let parsed = body;
  if (typeof parsed === 'string') {
    if (parsed.length > MAX_CHAT_CHARS) return null;
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return null;
    }
  } else if (JSON.stringify(parsed ?? null).length > MAX_CHAT_CHARS) return null;
  const messages = (parsed as { messages?: unknown } | null)?.messages;
  if (!Array.isArray(messages) || !messages.length || messages.length > MAX_MESSAGES) return null;
  const ok = messages.every(
    (m: { role?: unknown; content?: unknown }) => (m?.role === 'user' || m?.role === 'assistant') && (typeof m.content === 'string' || Array.isArray(m.content)),
  );
  return ok && messages[0].role === 'user' ? (messages as Anthropic.Beta.BetaMessageParam[]) : null;
}

export default async function handler(req: Req, res: Res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Send a POST from the app.' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!apiKey || !serviceAccount) {
    return res.status(500).json({ error: `Assistant not set up: add ${!apiKey ? 'ANTHROPIC_API_KEY' : 'FIREBASE_SERVICE_ACCOUNT'} in Vercel, then redeploy.` });
  }
  const projectId = projectIdFrom(serviceAccount);
  if (!projectId) return res.status(500).json({ error: 'FIREBASE_SERVICE_ACCOUNT in Vercel isn’t the whole key file — paste in everything from the .json.' });

  if (!(await signedIn(req, projectId))) return res.status(401).json({ error: 'Sign in to use the assistant.' });

  const messages = readMessages(req.body);
  if (!messages) return res.status(400).json({ error: 'That chat is too long or broken — start a new one.' });

  const client = new Anthropic({ apiKey });
  try {
    const reply = await client.beta.messages.create({
      model: ASSISTANT_MODEL,
      max_tokens: 16000,
      // Quick everyday requests: low effort keeps replies fast (it still thinks when something needs it).
      output_config: { effort: 'low' },
      system: SYSTEM_PROMPT,
      tools: ASSISTANT_TOOLS,
      messages,
      // Caches the chat so far, so each tool round only pays full price for what's new.
      cache_control: { type: 'ephemeral' },
      // If a safety check wrongly declines a request, retry it on Anthropic's recommended model.
      fallbacks: 'default',
      betas: ['server-side-fallback-2026-07-01'],
    });
    return res.status(200).json({ content: reply.content, stop_reason: reply.stop_reason });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) return res.status(500).json({ error: 'The Anthropic API key was rejected — check ANTHROPIC_API_KEY in Vercel.' });
    if (err instanceof Anthropic.RateLimitError) return res.status(429).json({ error: 'Too many messages at once — try again in a minute.' });
    if (err instanceof Anthropic.BadRequestError) {
      console.error('chat: bad request', err.message);
      return res.status(400).json({ error: 'Claude couldn’t read that chat — start a new one.' });
    }
    if (err instanceof Anthropic.APIError) {
      console.error(`chat: API error ${err.status}`, err.message);
      return res.status(502).json({ error: 'Claude is busy or down right now — try again in a moment.' });
    }
    console.error('chat failed', err);
    return res.status(500).json({ error: 'Something went wrong on the server.' });
  }
}
