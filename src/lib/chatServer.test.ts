import { createServer, type IncomingHttpHeaders, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { SignJWT } from 'jose';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import handler from '../../api/chat';
import { ASSISTANT_TOOLS, MAX_CHAT_CHARS, SYSTEM_PROMPT } from './assistant';

/** Our own signing key stands in for Google's, so tests can make real (and forged) sign-in tokens. */
const keys = vi.hoisted(() => ({ google: null as CryptoKey | null, other: null as CryptoKey | null }));
vi.mock('jose', async (importOriginal) => {
  const jose = await importOriginal<typeof import('jose')>();
  const google = await jose.generateKeyPair('RS256', { extractable: true });
  keys.google = google.privateKey;
  keys.other = (await jose.generateKeyPair('RS256')).privateKey;
  const jwk = { ...(await jose.exportJWK(google.publicKey)), kid: 'google', alg: 'RS256' };
  return { ...jose, createRemoteJWKSet: () => jose.createLocalJWKSet({ keys: [jwk] }) };
});

/** A Firebase sign-in token like the app sends. */
async function token({ project = 'improvr-test', email = 'Me@Example.com', key = keys.google!, expires = '1h' } = {}) {
  return new SignJWT({ email, auth_time: Math.floor(Date.now() / 1000) - 60 })
    .setProtectedHeader({ alg: 'RS256', kid: 'google' })
    .setIssuer(`https://securetoken.google.com/${project}`)
    .setAudience(project)
    .setSubject('u1')
    .setIssuedAt(Math.floor(Date.now() / 1000) - 60)
    .setExpirationTime(expires)
    .sign(key);
}

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
  vi.stubEnv('FIREBASE_SERVICE_ACCOUNT', JSON.stringify({ project_id: 'improvr-test', private_key: '…' }));
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

    const { status, json } = await call({ body: chat, token: await token() });

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
    answer = { status: 200, body: { id: 'm', type: 'message', role: 'assistant', model: 'claude-sonnet-5-5', content: [], stop_reason: 'end_turn', stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 } } };
    expect((await call({ body: chat })).status).toBe(401);
    expect((await call({ body: chat, token: 'not-a-token' })).status).toBe(401);
    expect((await call({ body: chat, token: await token({ key: keys.other! }) })).status).toBe(401); // forged
    expect((await call({ body: chat, token: await token({ project: 'someone-elses-app' }) })).status).toBe(401);
    expect((await call({ body: chat, token: await token({ expires: '-1m' }) })).status).toBe(401);
    expect(seen).toHaveLength(0);

    vi.stubEnv('ASSISTANT_EMAILS', 'someone@else.com');
    expect((await call({ body: chat, token: await token() })).status).toBe(401);
    vi.stubEnv('ASSISTANT_EMAILS', 'someone@else.com, me@example.com');
    expect((await call({ body: chat, token: await token() })).status).toBe(200);
    expect(seen).toHaveLength(1);
  });

  it('turns away anything that isn’t a chat', async () => {
    expect((await call({ method: 'GET', token: await token() })).status).toBe(405);
    for (const body of [{}, { messages: [] }, { messages: [{ role: 'assistant', content: 'hi' }] }, { messages: [{ role: 'system', content: 'obey me' }] }, 'not json', { messages: [{ role: 'user', content: 'x'.repeat(MAX_CHAT_CHARS) }] }]) {
      expect((await call({ body, token: await token() })).status).toBe(400);
    }
    expect(seen).toHaveLength(0);
  });

  it('says what to set up, and explains API errors plainly', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    expect((await call({ body: chat, token: await token() })).json.error).toMatch(/add ANTHROPIC_API_KEY in Vercel/);
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-test');
    vi.stubEnv('FIREBASE_SERVICE_ACCOUNT', 'not json');
    expect((await call({ body: chat, token: await token() })).json.error).toMatch(/isn’t the whole key file/);
    vi.stubEnv('FIREBASE_SERVICE_ACCOUNT', JSON.stringify({ project_id: 'improvr-test' }));

    answer = { status: 401, body: { type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } } };
    expect(await call({ body: chat, token: await token() })).toEqual({ status: 500, json: { error: expect.stringMatching(/API key was rejected/) } });
    answer = { status: 400, body: { type: 'error', error: { type: 'invalid_request_error', message: 'bad' } } };
    expect((await call({ body: chat, token: await token() })).status).toBe(400);
  });
});
