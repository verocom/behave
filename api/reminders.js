// /api/reminders — the signed-in user's daily reminder.
//   GET              → { enabled, publicKey } (no sign-in needed: the app asks before offering it)
//   POST { subscription, hour, timeZone, lang } → saves it and schedules the next one
//   DELETE           → turns it off
import { remindersConfigured, getAdmin, requireUser, readJson, env, send } from './_lib/server.js';
import { parseReminderInput, nextReminderAt } from './_lib/reminders.js';

export default async function handler(req, res) {
  const enabled = remindersConfigured();
  if (req.method === 'GET') return send(res, 200, enabled ? { enabled, publicKey: env('VAPID_PUBLIC_KEY') } : { enabled });
  if (!['POST', 'DELETE'].includes(req.method)) return send(res, 405, { error: 'method' });
  if (!enabled) return send(res, 503, { error: 'notConfigured' });
  try {
    const { auth, db } = getAdmin();
    const user = await requireUser(req, auth);
    if (!user) return send(res, 401, { error: 'unauthenticated' });
    const ref = db.doc(`reminders/${user.uid}`);
    if (req.method === 'DELETE') {
      await ref.delete();
      return send(res, 200, { ok: true });
    }
    const input = parseReminderInput(await readJson(req));
    if (input.error) return send(res, 400, { error: input.error });
    const nextSendAt = nextReminderAt(input.hour, input.timeZone);
    await ref.set({ ...input, nextSendAt, updatedAt: Date.now() });
    send(res, 200, { ok: true, nextSendAt });
  } catch (err) {
    console.error('Reminder update failed:', err.message);
    send(res, 500, { error: 'server' });
  }
}
