import { describe, expect, it } from 'vitest';
import webpush from 'web-push';
import { b64urlToBytes, generateVapid } from './push';

const b64url = (b: Uint8Array) => Buffer.from(b).toString('base64url');

describe('notification keys', () => {
  it('keys made on the phone are accepted by the server push library', async () => {
    const vapid = await generateVapid();
    expect(b64urlToBytes(vapid.publicKey).length).toBe(65);
    expect(b64urlToBytes(vapid.privateKey).length).toBe(32);

    // A pretend phone subscription (real ones come from the browser).
    const device = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
    const p256dh = b64url(new Uint8Array(await crypto.subtle.exportKey('raw', device.publicKey)));
    const auth = b64url(crypto.getRandomValues(new Uint8Array(16)));
    const req = webpush.generateRequestDetails(
      { endpoint: 'https://web.push.apple.com/abc', keys: { p256dh, auth } },
      JSON.stringify({ title: 'hi', body: 'there' }),
      { vapidDetails: { subject: 'https://improvr.karum.co.uk', publicKey: vapid.publicKey, privateKey: vapid.privateKey } },
    );
    expect(req.headers.Authorization).toMatch(/^vapid t=.+, k=/);
    expect(req.body).toBeInstanceOf(Buffer);
  });
});
