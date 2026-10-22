// POST /api/redeem-code { code } — activates a clinic access code for the signed-in user.
import { billingConfig, getAdmin, requireUser, readJson, send } from './_lib/server.js';
import { redeemAccessCode } from './_lib/core.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'method' });
  if (!billingConfig().codes) return send(res, 503, { error: 'notConfigured' });
  try {
    const { auth, db } = getAdmin();
    const user = await requireUser(req, auth);
    if (!user) return send(res, 401, { error: 'unauthenticated' });
    const { code } = await readJson(req);
    const result = await redeemAccessCode({ uid: user.uid, rawCode: code, db });
    send(res, result.ok ? 200 : 400, result);
  } catch (err) {
    console.error('Code redemption failed:', err.message);
    send(res, 500, { error: 'server' });
  }
}
