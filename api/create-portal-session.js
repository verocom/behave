// POST /api/create-portal-session → { url } of the Stripe customer portal (change plan, cancel, invoices).
import { billingConfig, getAdmin, getStripe, requireUser, appUrl, send } from './_lib/server.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'method' });
  if (!billingConfig().checkout) return send(res, 503, { error: 'notConfigured' });
  try {
    const { auth, db } = getAdmin();
    const user = await requireUser(req, auth);
    if (!user) return send(res, 401, { error: 'unauthenticated' });
    const snap = await db.doc(`entitlements/${user.uid}`).get();
    const customer = snap.exists ? snap.data().stripeCustomerId : null;
    if (!customer) return send(res, 404, { error: 'noSubscription' });
    const session = await getStripe().billingPortal.sessions.create({ customer, return_url: `${appUrl(req)}/?premium=portal` });
    send(res, 200, { url: session.url });
  } catch (err) {
    console.error('Portal session failed:', err.message);
    send(res, 500, { error: 'server' });
  }
}
