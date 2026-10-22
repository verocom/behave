// ── Daily gentle reminder rules (pure, no SDKs) ──────────────────────────────
// One push notification a day at the hour the person picked, in their own time zone,
// and none on days they already logged a moment. Covered by scripts/check-reminders.mjs.

export const REMINDER_HOURS = Array.from({ length: 24 }, (_, h) => h);
export const REMINDER_LANGS = ['en', 'fr', 'es'];

// A run that comes this late (scheduler outage) skips the reminder instead of pinging
// someone hours after the moment they chose.
export const MAX_LATE_MS = 3 * 3600000;

const PARTS = new Map();
function partsFormatter(timeZone) {
  if (!PARTS.has(timeZone)) {
    PARTS.set(timeZone, new Intl.DateTimeFormat('en-US', {
      timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
    }));
  }
  return PARTS.get(timeZone);
}

export function isValidTimeZone(timeZone) {
  if (typeof timeZone !== 'string' || !timeZone) return false;
  try { partsFormatter(timeZone); return true; } catch { return false; }
}

/** Wall-clock date and time in a time zone for a UTC instant. */
export function zonedParts(timeZone, utcMs) {
  const out = {};
  for (const p of partsFormatter(timeZone).formatToParts(new Date(utcMs))) {
    if (p.type !== 'literal') out[p.type] = Number(p.value);
  }
  return out;
}

function offsetMs(timeZone, utcMs) {
  const p = zonedParts(timeZone, utcMs);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(utcMs / 1000) * 1000;
}

/** UTC instant of a local wall-clock time; the second pass settles daylight-saving edges. */
export function zonedTimeToUtc(year, month, day, hour, timeZone) {
  const guess = Date.UTC(year, month - 1, day, hour);
  const first = guess - offsetMs(timeZone, guess);
  return guess - offsetMs(timeZone, first);
}

/** Next time it will be `hour`:00 in `timeZone`, strictly after `from`. */
export function nextReminderAt(hour, timeZone, from = Date.now()) {
  const { year, month, day } = zonedParts(timeZone, from);
  for (let i = 0; i < 3; i++) {
    const at = zonedTimeToUtc(year, month, day + i, hour, timeZone);
    if (at > from) return at;
  }
  return null;
}

export function sameLocalDay(a, b, timeZone) {
  const x = zonedParts(timeZone, a), y = zonedParts(timeZone, b);
  return x.year === y.year && x.month === y.month && x.day === y.day;
}

// Only real browser push services: the server POSTs to this URL, so it must never be
// pointed at an arbitrary host.
const PUSH_HOSTS = ['fcm.googleapis.com', 'push.services.mozilla.com', 'push.apple.com', 'notify.windows.com'];
export function isAllowedPushEndpoint(endpoint) {
  try {
    const url = new URL(endpoint);
    return url.protocol === 'https:' && PUSH_HOSTS.some(h => url.hostname === h || url.hostname.endsWith(`.${h}`));
  } catch { return false; }
}

/** Normalized reminder settings from a request body, or { error }. */
export function parseReminderInput(body) {
  const { subscription, hour, timeZone, lang } = body || {};
  if (!subscription || !isAllowedPushEndpoint(subscription.endpoint)
    || typeof subscription.keys?.p256dh !== 'string' || typeof subscription.keys?.auth !== 'string') {
    return { error: 'subscription' };
  }
  if (!REMINDER_HOURS.includes(hour)) return { error: 'hour' };
  if (!isValidTimeZone(timeZone)) return { error: 'timeZone' };
  return {
    subscription: { endpoint: subscription.endpoint, keys: { p256dh: subscription.keys.p256dh, auth: subscription.keys.auth } },
    hour,
    timeZone,
    lang: REMINDER_LANGS.includes(lang) ? lang : 'en',
  };
}

// Invitations, never reproaches: no streaks, no "you missed", nothing to catch up on.
export const REMINDER_MESSAGES = {
  en: [
    { title: 'How is the water today? 🌊', body: 'Ten seconds to check in, whenever suits you.' },
    { title: 'A small pause for you', body: 'How are you, right now? It doesn’t have to be perfect.' },
    { title: 'Take a breath 💙', body: 'Then, if you like, note how you feel.' },
    { title: 'A quick check-in?', body: 'Just the water level is enough.' },
    { title: 'Your journal is here, no pressure', body: 'One moment noted, even a small one, counts.' },
  ],
  fr: [
    { title: 'Comment est l’eau aujourd’hui ? 🌊', body: 'Dix secondes pour faire le point, quand ça te va.' },
    { title: 'Une petite pause pour toi', body: 'Comment ça va, là, maintenant ? Pas besoin que ce soit parfait.' },
    { title: 'Prends une respiration 💙', body: 'Puis, si tu veux, note comment tu te sens.' },
    { title: 'Un petit check-in ?', body: 'Juste le niveau de l’eau, ça suffit.' },
    { title: 'Ton journal est là, sans pression', body: 'Un moment noté, même petit, ça compte.' },
  ],
  es: [
    { title: '¿Cómo está el agua hoy? 🌊', body: 'Diez segundos para hacer una pausa, cuando te venga bien.' },
    { title: 'Una pequeña pausa para ti', body: '¿Cómo estás ahora mismo? No tiene que ser perfecto.' },
    { title: 'Respira hondo 💙', body: 'Y luego, si quieres, anota cómo te sientes.' },
    { title: '¿Un check-in rápido?', body: 'Con el nivel del agua basta.' },
    { title: 'Tu diario está aquí, sin presión', body: 'Un momento anotado, aunque sea pequeño, cuenta.' },
  ],
};

/** The day's message: rotates daily so it never feels like the same nag. */
export function reminderMessage(lang, at, timeZone) {
  const list = REMINDER_MESSAGES[lang] || REMINDER_MESSAGES.en;
  const { year, month, day } = zonedParts(timeZone, at);
  const dayNumber = Math.floor(Date.UTC(year, month - 1, day) / 86400000);
  return { ...list[dayNumber % list.length], url: '/' };
}
