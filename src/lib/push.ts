/** Browser side of push notifications (no Firebase in here). */

export type PushEnv = 'ok' | 'needs-install' | 'unsupported';

export function pushEnvironment(): PushEnv {
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
  const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
  // iPhone only allows notifications for web apps added to the Home Screen.
  if (ios && !standalone) return 'needs-install';
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'unsupported';
  return 'ok';
}

const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export function b64urlToBytes(s: string): Uint8Array<ArrayBuffer> {
  const pad = '='.repeat((4 - (s.length % 4)) % 4);
  const raw = atob((s + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** A fresh VAPID key pair (the standard "who is allowed to push to me" keys), made on this device. */
export async function generateVapid(): Promise<{ publicKey: string; privateKey: string }> {
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
  const jwk = await crypto.subtle.exportKey('jwk', pair.privateKey);
  return { publicKey: b64url(raw), privateKey: jwk.d as string };
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  if (pushEnvironment() !== 'ok') return null;
  const reg = await navigator.serviceWorker.getRegistration();
  return (await reg?.pushManager.getSubscription()) ?? null;
}

/** Subscribe this device (ask for notification permission first, straight from the tap). */
export async function subscribe(vapidPublic: string): Promise<PushSubscription> {
  const reg = await navigator.serviceWorker.ready;
  const options = { userVisibleOnly: true, applicationServerKey: b64urlToBytes(vapidPublic) };
  try {
    return await reg.pushManager.subscribe(options);
  } catch {
    // An old subscription made with different keys — replace it.
    await (await reg.pushManager.getSubscription())?.unsubscribe();
    return reg.pushManager.subscribe(options);
  }
}
