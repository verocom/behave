// POST /api/create-checkout-session { plan: 'monthly' | 'yearly' } → { url } of a Stripe Checkout page.
import { billingConfig, getAdmin, getStripe, requireUser, readJson, appUrl, env, send } from './_lib/server.js';
import { PLANS, isEntitlementActive } from './_lib/billing.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'method' });
  if (!billingConfig().checkout) return send(res, 503, { error: 'notConfigured' });
  try {
    const { auth, db } = getAdmin();
    const user = await requireUser(req, auth);
    if (!user) return send(res, 401, { error: 'unauthenticated' });
    const { plan } = await readJson(req);
    if (!PLANS.includes(plan)) return send(res, 400, { error: 'plan' });

    const snap = await db.doc(`entitlements/${user.uid}`).get();
    const current = snap.exists ? snap.data() : null;
    if (isEntitlementActive(current)) return send(res, 409, { error: 'alreadyPremium' });

    const base = appUrl(req);
    const session = await getStripe().checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: env(plan === 'yearly' ? 'STRIPE_PRICE_YEARLY' : 'STRIPE_PRICE_MONTHLY'), quantity: 1 }],
      client_reference_id: user.uid,
      // The webhook finds the user from this on every later subscription event.
      subscription_data: { metadata: { uid: user.uid } },
      ...(current?.stripeCustomerId ? { customer: current.stripeCustomerId } : user.email ? { customer_email: user.email } : {}),
      allow_promotion_codes: true,
      success_url: `${base}/?premium=success`,
      cancel_url: `${base}/?premium=cancel`,
    });
    send(res, 200, { url: session.url });
  } catch (err) {
    console.error('Checkout session failed:', err.message);
    send(res, 500, { error: 'server' });
  }
}
