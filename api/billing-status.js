// GET /api/billing-status — which Limitless+ features are live, and the real Stripe prices.
import { billingConfig, getStripe, env, send } from './_lib/server.js';

export default async function handler(req, res) {
  const cfg = billingConfig();
  const body = { checkout: cfg.checkout, codes: cfg.codes };
  if (cfg.checkout) {
    try {
      const stripe = getStripe();
      const [monthly, yearly] = await Promise.all([
        stripe.prices.retrieve(env('STRIPE_PRICE_MONTHLY')),
        stripe.prices.retrieve(env('STRIPE_PRICE_YEARLY')),
      ]);
      const price = p => ({ amount: p.unit_amount / 100, currency: p.currency.toUpperCase() });
      body.prices = { monthly: price(monthly), yearly: price(yearly) };
    } catch (err) {
      console.error('Price lookup failed:', err.message);
      body.checkout = false;
    }
  }
  send(res, 200, body);
}
