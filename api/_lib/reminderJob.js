// ── The daily reminder run ───────────────────────────────────────────────────
// Called on a schedule by /api/send-reminders. Firestore, Auth and the push sender are
// injected (Admin SDK + web-push in production, fakes in scripts/check-reminders.mjs).

import { MAX_LATE_MS, nextReminderAt, reminderMessage, sameLocalDay } from './reminders.js';

const CONCURRENCY = 10;

async function userExists(auth, uid) {
  try { await auth.getUser(uid); return true; } catch (err) { return err?.code !== 'auth/user-not-found'; }
}

/** True when the person already logged a check-in or an entry today, in their time zone. */
async function loggedToday(db, uid, timeZone, now) {
  for (const col of ['moodChecks', 'entries']) {
    const snap = await db.collection(`users/${uid}/${col}`).orderBy('timestamp', 'desc').limit(1).get();
    const ts = snap.docs[0]?.data().timestamp;
    if (typeof ts === 'number' && sameLocalDay(ts, now, timeZone)) return true;
  }
  return false;
}

async function runOne(doc, { db, auth, sendNotification, now }) {
  const r = doc.data();
  const uid = doc.id;
  // An account deleted from the app leaves this doc behind (the client can't delete it).
  if (!(await userExists(auth, uid))) { await doc.ref.delete(); return 'removed'; }

  let outcome;
  if (now - r.nextSendAt > MAX_LATE_MS) outcome = 'late';
  else if (await loggedToday(db, uid, r.timeZone, now)) outcome = 'alreadyLogged';
  else {
    try {
      await sendNotification(r.subscription, JSON.stringify(reminderMessage(r.lang, now, r.timeZone)));
      outcome = 'sent';
    } catch (err) {
      // 404/410: the browser dropped the subscription (notifications turned off, app removed).
      if (err?.statusCode === 404 || err?.statusCode === 410) { await doc.ref.delete(); return 'removed'; }
      outcome = 'failed';
    }
  }
  await doc.ref.set({ nextSendAt: nextReminderAt(r.hour, r.timeZone, now), lastOutcome: outcome, lastRunAt: now }, { merge: true });
  return outcome;
}

/** Sends every reminder that is due. Returns a count per outcome. */
export async function sendDueReminders({ db, auth, sendNotification, now = Date.now(), limit = 500 }) {
  const snap = await db.collection('reminders').where('nextSendAt', '<=', now).limit(limit).get();
  const counts = { sent: 0, alreadyLogged: 0, late: 0, failed: 0, removed: 0, errors: 0 };
  for (let i = 0; i < snap.docs.length; i += CONCURRENCY) {
    await Promise.all(snap.docs.slice(i, i + CONCURRENCY).map(async doc => {
      try { counts[await runOne(doc, { db, auth, sendNotification, now })]++; } catch (err) {
        console.error(`Reminder for ${doc.id} failed:`, err?.message);
        counts.errors++;
      }
    }));
  }
  return counts;
}
