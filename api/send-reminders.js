// /api/send-reminders — run hourly by a scheduler (see README) with "Authorization: Bearer <CRON_SECRET>".
import { remindersConfigured, getAdmin, getWebPush, isCronRequest, send } from './_lib/server.js';
import { sendDueReminders } from './_lib/reminderJob.js';

export default async function handler(req, res) {
  if (!isCronRequest(req)) return send(res, 401, { error: 'unauthorized' });
  if (!remindersConfigured()) return send(res, 503, { error: 'notConfigured' });
  try {
    const { auth, db } = getAdmin();
    const webpush = getWebPush();
    const counts = await sendDueReminders({
      db, auth,
      // Expires after 12 h: a reminder delivered the next morning would just be noise.
      sendNotification: (subscription, payload) => webpush.sendNotification(subscription, payload, { TTL: 12 * 3600, urgency: 'normal' }),
    });
    send(res, 200, counts);
  } catch (err) {
    console.error('Reminder run failed:', err.message);
    send(res, 500, { error: 'server' });
  }
}
