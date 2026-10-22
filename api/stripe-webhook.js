// POST /api/stripe-webhook — Stripe's signed subscription events. The only place a paid
// entitlement is granted or revoked. Point a Stripe webhook endpoint here for:
// checkout.session.completed, customer.subscription.created/updated/deleted.
import { billingConfig, getAdmin, getStripe, readRaw, env, send } from './_lib/server.js';
import { applyStripeEvent } from './_lib/core.js';

// The signature is computed over the exact bytes Stripe sent, so the body must stay raw.
export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'method' });
  if (!billingConfig().webhook) return send(res, 503, { error: 'notConfigured' });
  let event;
  try {
    event = getStripe().webhooks.constructEvent(await readRaw(req), req.headers['stripe-signature'], env('STRIPE_WEBHOOK_SECRET'));
  } catch (err) {
    console.error('Webhook signature rejected:', err.message);
    return send(res, 400, { error: 'signature' });
  }
  try {
    const { db } = getAdmin();
    await applyStripeEvent(event, { db, retrieveSubscription: id => getStripe().subscriptions.retrieve(id) });
    send(res, 200, { received: true });
  } catch (err) {
    // A 5xx makes Stripe retry the event later.
    console.error(`Webhook ${event.type} failed:`, err.message);
    send(res, 500, { error: 'processing' });
  }
}
