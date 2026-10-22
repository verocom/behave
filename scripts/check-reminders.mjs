// Standalone verification for the daily reminder — run with: node scripts/check-reminders.mjs
import assert from 'node:assert/strict';
import {
  nextReminderAt, zonedParts, sameLocalDay, isAllowedPushEndpoint, parseReminderInput,
  reminderMessage, REMINDER_MESSAGES, MAX_LATE_MS,
} from '../api/_lib/reminders.js';
import { sendDueReminders } from '../api/_lib/reminderJob.js';

let passed = 0;
async function check(name, fn) {
  await fn();
  passed++;
  console.log(`✓ ${name}`);
}

const MTL = 'America/Montreal';
const at = iso => new Date(iso).getTime();
const localHour = (ms, tz) => { const p = zonedParts(tz, ms); return `${p.year}-${p.month}-${p.day} ${p.hour}:${String(p.minute).padStart(2, '0')}`; };

await check('next reminder is later today when the hour has not passed yet', () => {
  const next = nextReminderAt(20, MTL, at('2026-10-22T12:00:00Z')); // 8:00 in Montréal
  assert.equal(next, at('2026-10-23T00:00:00Z')); // 20:00 EDT
});

await check('next reminder rolls to tomorrow once the hour has passed', () => {
  const next = nextReminderAt(8, MTL, at('2026-10-22T13:00:00Z')); // 9:00 in Montréal
  assert.equal(localHour(next, MTL), '2026-10-23 8:00');
});

await check('the hour stays put across the daylight-saving change', () => {
  // DST ends in Montréal on 2026-11-01: 8:00 is 12:00Z before and 13:00Z after.
  assert.equal(nextReminderAt(8, MTL, at('2026-10-31T13:00:00Z')), at('2026-11-01T13:00:00Z'));
  assert.equal(localHour(nextReminderAt(8, MTL, at('2026-11-01T14:00:00Z')), MTL), '2026-11-2 8:00');
  // Spring forward in Paris (2027-03-28): 21:00 is still 21:00 local.
  assert.equal(localHour(nextReminderAt(21, 'Europe/Paris', at('2027-03-28T05:00:00Z')), 'Europe/Paris'), '2027-3-28 21:00');
});

await check('time zones far from UTC land on the right local day', () => {
  assert.equal(localHour(nextReminderAt(7, 'Asia/Tokyo', at('2026-10-22T23:00:00Z')), 'Asia/Tokyo'), '2026-10-24 7:00');
  assert.equal(localHour(nextReminderAt(0, 'Pacific/Auckland', at('2026-10-22T10:30:00Z')), 'Pacific/Auckland'), '2026-10-23 0:00'); // 23:30 local → midnight 30 min later
});

await check('same local day is judged in the person’s time zone', () => {
  // 23:30 and 00:30 in Montréal are different local days, though both fall on 23 Oct in UTC.
  assert.equal(sameLocalDay(at('2026-10-23T03:30:00Z'), at('2026-10-23T04:30:00Z'), MTL), false);
  assert.equal(sameLocalDay(at('2026-10-22T13:00:00Z'), at('2026-10-23T02:00:00Z'), MTL), true);
});

await check('only real browser push services are accepted', () => {
  for (const ok of ['https://fcm.googleapis.com/fcm/send/abc', 'https://updates.push.services.mozilla.com/wpush/v2/x', 'https://web.push.apple.com/Q', 'https://wns2-bl2p.notify.windows.com/w/?token=1']) {
    assert.ok(isAllowedPushEndpoint(ok), ok);
  }
  for (const bad of ['http://fcm.googleapis.com/x', 'https://169.254.169.254/latest', 'https://evil.com/fcm.googleapis.com', 'https://fcm.googleapis.com.evil.com/x', 'nope']) {
    assert.equal(isAllowedPushEndpoint(bad), false, bad);
  }
});

const sub = { endpoint: 'https://fcm.googleapis.com/fcm/send/abc', keys: { p256dh: 'p', auth: 'a' } };
await check('reminder settings are validated and normalized', () => {
  assert.deepEqual(parseReminderInput({ subscription: { ...sub, extra: 1 }, hour: 20, timeZone: MTL, lang: 'fr' }), { subscription: sub, hour: 20, timeZone: MTL, lang: 'fr' });
  assert.equal(parseReminderInput({ subscription: sub, hour: 20, timeZone: MTL, lang: 'xx' }).lang, 'en');
  assert.equal(parseReminderInput({ subscription: sub, hour: 24, timeZone: MTL }).error, 'hour');
  assert.equal(parseReminderInput({ subscription: sub, hour: '8', timeZone: MTL }).error, 'hour');
  assert.equal(parseReminderInput({ subscription: sub, hour: 8, timeZone: 'Mars/Olympus' }).error, 'timeZone');
  assert.equal(parseReminderInput({ subscription: { ...sub, endpoint: 'https://evil.com' }, hour: 8, timeZone: MTL }).error, 'subscription');
  assert.equal(parseReminderInput(null).error, 'subscription');
});

await check('messages rotate daily and exist in every language', () => {
  const days = [0, 1, 2, 3, 4].map(d => reminderMessage('fr', at('2026-10-22T16:00:00Z') + d * 86400000, MTL).title);
  assert.equal(new Set(days).size, REMINDER_MESSAGES.fr.length);
  for (const lang of ['en', 'fr', 'es']) assert.equal(REMINDER_MESSAGES[lang].length, REMINDER_MESSAGES.en.length);
  assert.equal(reminderMessage('de', 0, MTL).title, reminderMessage('en', 0, MTL).title);
});

// ── The scheduled run ───────────────────────────────────────────────────────
function fakeDb(initial) {
  const store = new Map(Object.entries(initial));
  const ref = path => ({
    delete: async () => { store.delete(path); },
    set: async (data, opts) => { store.set(path, opts?.merge ? { ...store.get(path), ...data } : data); },
  });
  const docsIn = prefix => [...store.keys()].filter(k => k.startsWith(`${prefix}/`) && !k.slice(prefix.length + 1).includes('/'));
  return {
    store,
    collection: name => {
      let filter = () => true, sort = null, max = Infinity;
      const q = {
        where: (field, op, value) => { filter = d => d[field] <= value; return q; },
        orderBy: (field, dir) => { sort = (a, b) => (dir === 'desc' ? b[field] - a[field] : a[field] - b[field]); return q; },
        limit: n => { max = n; return q; },
        get: async () => {
          let docs = docsIn(name).map(p => ({ id: p.split('/').pop(), ref: ref(p), data: () => store.get(p) })).filter(d => filter(d.data()));
          if (sort) docs.sort((a, b) => sort(a.data(), b.data()));
          return { docs: docs.slice(0, max) };
        },
      };
      return q;
    },
  };
}
const NOW = at('2026-10-23T00:05:00Z'); // 20:05 in Montréal
const due = (over = {}) => ({ subscription: sub, hour: 20, timeZone: MTL, lang: 'fr', nextSendAt: at('2026-10-23T00:00:00Z'), ...over });
const auth = (deleted = []) => ({ getUser: async uid => { if (deleted.includes(uid)) throw Object.assign(new Error('gone'), { code: 'auth/user-not-found' }); return { uid }; } });

await check('a due reminder is sent once and scheduled for tomorrow', async () => {
  const db = fakeDb({ 'reminders/u1': due(), 'reminders/u2': due({ nextSendAt: NOW + 3600000 }) });
  const sent = [];
  const counts = await sendDueReminders({ db, auth: auth(), sendNotification: async (s, p) => sent.push(JSON.parse(p)), now: NOW });
  assert.equal(counts.sent, 1);
  assert.equal(sent.length, 1);
  assert.ok(REMINDER_MESSAGES.fr.some(m => m.title === sent[0].title));
  assert.equal(localHour(db.store.get('reminders/u1').nextSendAt, MTL), '2026-10-23 20:00');
  assert.equal(db.store.get('reminders/u2').lastOutcome, undefined); // not due yet
});

await check('no reminder on a day something was already logged', async () => {
  const db = fakeDb({
    'reminders/u1': due(),
    'users/u1/moodChecks/m1': { timestamp: at('2026-10-22T12:00:00Z') }, // 8:00 the same local day
  });
  let calls = 0;
  const counts = await sendDueReminders({ db, auth: auth(), sendNotification: async () => { calls++; }, now: NOW });
  assert.deepEqual([counts.alreadyLogged, calls], [1, 0]);
  assert.ok(db.store.get('reminders/u1').nextSendAt > NOW);
});

await check('yesterday’s entries don’t count as today', async () => {
  const db = fakeDb({ 'reminders/u1': due(), 'users/u1/entries/e1': { timestamp: at('2026-10-22T03:00:00Z') } }); // 23:00 the day before
  assert.equal((await sendDueReminders({ db, auth: auth(), sendNotification: async () => {}, now: NOW })).sent, 1);
});

await check('a run hours late skips instead of pinging at the wrong time', async () => {
  const db = fakeDb({ 'reminders/u1': due({ nextSendAt: NOW - MAX_LATE_MS - 1 }) });
  let calls = 0;
  assert.equal((await sendDueReminders({ db, auth: auth(), sendNotification: async () => { calls++; }, now: NOW })).late, 1);
  assert.equal(calls, 0);
});

await check('expired subscriptions and deleted accounts are cleaned up', async () => {
  const db = fakeDb({ 'reminders/u1': due(), 'reminders/gone': due() });
  const counts = await sendDueReminders({
    db, auth: auth(['gone']), now: NOW,
    sendNotification: async () => { throw Object.assign(new Error('Gone'), { statusCode: 410 }); },
  });
  assert.equal(counts.removed, 2);
  assert.equal(db.store.size, 0);
});

await check('a temporary push failure keeps the reminder for tomorrow', async () => {
  const db = fakeDb({ 'reminders/u1': due() });
  const counts = await sendDueReminders({ db, auth: auth(), now: NOW, sendNotification: async () => { throw Object.assign(new Error('busy'), { statusCode: 503 }); } });
  assert.equal(counts.failed, 1);
  assert.equal(db.store.get('reminders/u1').lastOutcome, 'failed');
  assert.ok(db.store.get('reminders/u1').nextSendAt > NOW);
});

console.log(`\n${passed} checks passed.`);
