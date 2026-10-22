// ── Browser side of the daily reminder ───────────────────────────────────────
// Web Push: the service worker (public/push-sw.js) receives what /api/send-reminders sends.

/** What this device can do: 'ok' | 'install' (iPhone/iPad outside the home-screen app) | 'blocked' | 'unsupported'. */
export function reminderSupport() {
  if (typeof window === 'undefined') return 'unsupported';
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;
  // iOS only offers Web Push to apps added to the home screen (iOS 16.4+).
  if (ios && !standalone) return 'install';
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'denied') return 'blocked';
  return 'ok';
}

export const currentTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

function keyBytes(base64url) {
  const padded = (base64url + '='.repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(padded), c => c.charCodeAt(0));
}

async function readyRegistration() {
  // `ready` never settles when no service worker is installed (e.g. the dev server).
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise((_, reject) => setTimeout(() => reject(new Error('Service worker not ready')), 10000)),
  ]);
}

/** Asks for permission if needed and returns this device's push subscription, or { error: 'blocked' }. */
export async function subscribeToPush(publicKey) {
  const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
  if (permission !== 'granted') return { error: 'blocked' };
  const registration = await readyRegistration();
  const existing = await registration.pushManager.getSubscription();
  const subscription = existing || await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) });
  return { subscription: subscription.toJSON() };
}

export async function unsubscribeFromPush() {
  try {
    const registration = await readyRegistration();
    await (await registration.pushManager.getSubscription())?.unsubscribe();
  } catch { /* nothing to undo on this device */ }
}

/** "8 h", "8 PM", "8"… in the app's language. */
export function formatHour(hour, locale) {
  // Intl gives "08 h" in fr-CA; Québec usage is "8 h".
  if (locale.startsWith('fr')) return `${hour} h`;
  return new Intl.DateTimeFormat(locale, { hour: 'numeric' }).format(new Date(2000, 0, 1, hour));
}
