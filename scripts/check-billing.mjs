// Standalone verification for api/_lib — run with: node scripts/check-billing.mjs
import assert from 'node:assert/strict';
import Stripe from 'stripe';
import {
  entitlementFromSubscription, isEntitlementActive, normalizeCode, formatCode, generateCode,
  isWellFormedCode, codeProblem, entitlementFromCode, addMonths,
} from '../api/_lib/billing.js';
import { applyStripeEvent, redeemAccessCode } from '../api/_lib/core.js';

let passed = 0;
async function check(name, fn) {
  await fn();
  passed++;
  console.log(`✓ ${name}`);
}

// Minimal in-memory stand-in for the Firestore Admin SDK surface core.js uses.
function fakeDb(initial = {}) {
  const store = new Map(Object.entries(initial));
  const snap = path => ({ exists: store.has(path), data: () => structuredClone(store.get(path)) });
  const db = {
    store,
    doc: path => ({
      path,
      get: async () => snap(path),
      set: async (data, opts) => { store.set(path, opts?.merge ? { ...(store.get(path) || {}), ...data } : data); },
    }),
    async runTransaction(fn) {
      const writes = [];
      const tx = {
        get: async ref => snap(ref.path),
        set: (ref, data) => writes.push(() => store.set(ref.path, data)),
        update: (ref, data) => writes.push(() => store.set(ref.path, { ...store.get(ref.path), ...data })),
      };
      const result = await fn(tx);
      writes.forEach(w => w());
      return result;
    },
  };
  return db;
}

const NOW = new Date('2026-10-22T12:00:00Z').getTime();
const sub = (over = {}) => ({ id: 'sub_1', status: 'active', customer: 'cus_1', current_period_end: NOW / 1000 + 30 * 86400, metadata: { uid: 'u1' }, ...over });

await check('active subscription grants premium until period end plus grace', () => {
  const e = entitlementFromSubscription(sub());
  assert.equal(e.premium, true);
  assert.equal(e.source, 'stripe');
  assert.equal(e.stripeCustomerId, 'cus_1');
  assert.equal(e.expiresAt, (NOW / 1000 + 30 * 86400) * 1000 + 3 * 86400000);
  assert.equal(e.periodEnd, (NOW / 1000 + 30 * 86400) * 1000); // shown as the renewal date, without the grace
});

await check('period end is read from items on newer Stripe API versions', () => {
  const e = entitlementFromSubscription(sub({ current_period_end: undefined, items: { data: [{ current_period_end: NOW / 1000 + 10 }] } }));
  assert.equal(e.expiresAt, (NOW / 1000 + 10) * 1000 + 3 * 86400000);
});

await check('canceled or unpaid subscriptions are not premium', () => {
  for (const status of ['canceled', 'unpaid', 'incomplete_expired', 'incomplete']) {
    assert.equal(entitlementFromSubscription(sub({ status })).premium, false, status);
  }
  assert.equal(entitlementFromSubscription(sub({ status: 'past_due' })).premium, true); // Stripe is still retrying
});

await check('isEntitlementActive respects expiry', () => {
  assert.equal(isEntitlementActive({ premium: true, expiresAt: NOW + 1 }, NOW), true);
  assert.equal(isEntitlementActive({ premium: true, expiresAt: NOW - 1 }, NOW), false);
  assert.equal(isEntitlementActive(null, NOW), false);
});

await check('codes normalize regardless of case, spacing, dashes and prefix', () => {
  const code = generateCode();
  assert.ok(isWellFormedCode(code), code);
  assert.equal(normalizeCode(formatCode(code).toLowerCase()), code);
  assert.equal(normalizeCode(` ${code.slice(0, 5)} ${code.slice(5)} `), code);
  assert.equal(isWellFormedCode(normalizeCode('LMT-0000-OOOO-11')), false); // ambiguous characters are never issued
});

await check('codeProblem explains why a code cannot be used', () => {
  const ok = { maxUses: 1, uses: 0, months: 12 };
  assert.equal(codeProblem({ codeDoc: ok }, NOW), null);
  assert.equal(codeProblem({ codeDoc: null }, NOW), 'invalid');
  assert.equal(codeProblem({ codeDoc: { ...ok, uses: 1 } }, NOW), 'used');
  assert.equal(codeProblem({ codeDoc: { ...ok, validUntil: NOW - 1 } }, NOW), 'expired');
  assert.equal(codeProblem({ codeDoc: ok, alreadyRedeemedByUser: true }, NOW), 'alreadyUsed');
  assert.equal(codeProblem({ codeDoc: ok, currentEntitlement: { premium: true, expiresAt: NOW + 1 } }, NOW), 'alreadyPremium');
});

await check('a clinic code grants access for its number of months', () => {
  const e = entitlementFromCode('ABCDEFGHJK', { clinicId: 'c1', months: 6 }, NOW);
  assert.deepEqual([e.premium, e.source, e.clinicId, e.expiresAt], [true, 'clinic', 'c1', addMonths(NOW, 6)]);
});

await check('redeeming consumes a single-use code and blocks a second person', async () => {
  const db = fakeDb({ 'accessCodes/ABCDEFGHJK': { clinicId: 'c1', maxUses: 1, uses: 0, months: 12 } });
  assert.deepEqual(await redeemAccessCode({ uid: 'u1', rawCode: 'lmt-abcd-efgh-jk', db, now: NOW }), { ok: true, expiresAt: addMonths(NOW, 12) });
  assert.equal(db.store.get('accessCodes/ABCDEFGHJK').uses, 1);
  assert.equal(db.store.get('entitlements/u1').source, 'clinic');
  assert.ok(db.store.has('accessCodes/ABCDEFGHJK/redemptions/u1'));
  assert.deepEqual(await redeemAccessCode({ uid: 'u2', rawCode: 'ABCDEFGHJK', db, now: NOW }), { ok: false, reason: 'used' });
  assert.equal(db.store.has('entitlements/u2'), false);
});

await check('a multi-use code cannot be redeemed twice by the same person', async () => {
  const db = fakeDb({ 'accessCodes/ABCDEFGHJK': { maxUses: 20, uses: 0, months: 12 } });
  await redeemAccessCode({ uid: 'u1', rawCode: 'ABCDEFGHJK', db, now: NOW });
  db.store.delete('entitlements/u1'); // even if the grant was removed, the redemption record remains
  assert.deepEqual(await redeemAccessCode({ uid: 'u1', rawCode: 'ABCDEFGHJK', db, now: NOW }), { ok: false, reason: 'alreadyUsed' });
  assert.equal(db.store.get('accessCodes/ABCDEFGHJK').uses, 1);
});

await check('malformed and unknown codes are rejected without writes', async () => {
  const db = fakeDb();
  assert.deepEqual(await redeemAccessCode({ uid: 'u1', rawCode: 'hello', db, now: NOW }), { ok: false, reason: 'invalid' });
  assert.deepEqual(await redeemAccessCode({ uid: 'u1', rawCode: 'ABCDEFGHJK', db, now: NOW }), { ok: false, reason: 'invalid' });
  assert.equal(db.store.size, 0);
});

await check('checkout completion grants premium via the subscription metadata uid', async () => {
  const db = fakeDb();
  const event = { type: 'checkout.session.completed', data: { object: { mode: 'subscription', subscription: 'sub_1', client_reference_id: 'u1' } } };
  const res = await applyStripeEvent(event, { db, retrieveSubscription: async () => sub() });
  assert.equal(res.uid, 'u1');
  assert.equal(db.store.get('entitlements/u1').premium, true);
});

await check('subscription deleted revokes premium', async () => {
  const db = fakeDb({ 'entitlements/u1': entitlementFromSubscription(sub()) });
  await applyStripeEvent({ type: 'customer.subscription.deleted', data: { object: sub({ status: 'canceled' }) } }, { db });
  assert.equal(db.store.get('entitlements/u1').premium, false);
});

await check('ending an old subscription does not revoke a newer one or a clinic grant', async () => {
  const newer = fakeDb({ 'entitlements/u1': { ...entitlementFromSubscription(sub({ id: 'sub_2' })) } });
  assert.deepEqual(await applyStripeEvent({ type: 'customer.subscription.deleted', data: { object: sub({ status: 'canceled' }) } }, { db: newer }), { uid: 'u1', skipped: true });
  assert.equal(newer.store.get('entitlements/u1').premium, true);
  const clinic = fakeDb({ 'entitlements/u1': { premium: true, source: 'clinic', expiresAt: Date.now() + 86400000 } });
  assert.equal((await applyStripeEvent({ type: 'customer.subscription.deleted', data: { object: sub({ status: 'canceled' }) } }, { db: clinic })).skipped, true);
});

await check('irrelevant events and events without a uid are ignored', async () => {
  const db = fakeDb();
  assert.equal(await applyStripeEvent({ type: 'invoice.paid', data: { object: {} } }, { db }), null);
  assert.equal(await applyStripeEvent({ type: 'customer.subscription.updated', data: { object: sub({ metadata: {} }) } }, { db }), null);
  assert.equal(db.store.size, 0);
});

await check('webhook signatures are verified with the real Stripe library', () => {
  const stripe = new Stripe('sk_test_dummy');
  const secret = 'whsec_test_secret';
  const payload = JSON.stringify({ id: 'evt_1', type: 'customer.subscription.updated', data: { object: sub() } });
  const header = stripe.webhooks.generateTestHeaderString({ payload, secret });
  assert.equal(stripe.webhooks.constructEvent(payload, header, secret).id, 'evt_1');
  assert.throws(() => stripe.webhooks.constructEvent(payload.replace('active', 'trialing'), header, secret)); // tampered body
  assert.throws(() => stripe.webhooks.constructEvent(payload, header, 'whsec_wrong'));
});

console.log(`\n${passed} checks passed.`);
