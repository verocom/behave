// ── Server-side grants ───────────────────────────────────────────────────────
// The only two ways entitlements/{uid} gets written. Firestore is injected (`db` is the
// Admin SDK instance in production, an in-memory fake in scripts/check-billing.mjs).

import {
  entitlementFromSubscription, isEntitlementActive, normalizeCode, isWellFormedCode,
  codeProblem, entitlementFromCode,
} from './billing.js';

const SUBSCRIPTION_EVENTS = ['customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted'];

/**
 * Applies a verified Stripe event. Returns { uid, entitlement } when something was written,
 * { uid, skipped: true } when an event would wrongly downgrade a different active grant,
 * or null when the event isn't relevant.
 */
export async function applyStripeEvent(event, { db, retrieveSubscription }) {
  let sub;
  let uid;
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    if (session.mode !== 'subscription' || !session.subscription) return null;
    sub = await retrieveSubscription(typeof session.subscription === 'string' ? session.subscription : session.subscription.id);
    uid = sub.metadata?.uid || session.client_reference_id;
  } else if (SUBSCRIPTION_EVENTS.includes(event.type)) {
    sub = event.data.object;
    uid = sub.metadata?.uid;
  } else {
    return null;
  }
  if (!uid) return null;

  const entitlement = { ...entitlementFromSubscription(sub), updatedAt: Date.now() };
  const ref = db.doc(`entitlements/${uid}`);
  const snap = await ref.get();
  const current = snap.exists ? snap.data() : null;
  if (!entitlement.premium && isEntitlementActive(current)) {
    // Ending an old subscription mustn't revoke a newer one or a clinic grant.
    const otherGrant = current.source !== 'stripe' || (current.stripeSubscriptionId && current.stripeSubscriptionId !== sub.id);
    if (otherGrant) return { uid, skipped: true };
  }
  await ref.set(entitlement, { merge: true });
  return { uid, entitlement };
}

/** Redeems a clinic code for `uid` atomically. Returns { ok: true, expiresAt } or { ok: false, reason }. */
export async function redeemAccessCode({ uid, rawCode, db, now = Date.now() }) {
  const code = normalizeCode(rawCode);
  if (!isWellFormedCode(code)) return { ok: false, reason: 'invalid' };
  return db.runTransaction(async tx => {
    const codeRef = db.doc(`accessCodes/${code}`);
    const redemptionRef = db.doc(`accessCodes/${code}/redemptions/${uid}`);
    const entRef = db.doc(`entitlements/${uid}`);
    const [codeSnap, redemptionSnap, entSnap] = await Promise.all([tx.get(codeRef), tx.get(redemptionRef), tx.get(entRef)]);
    const codeDoc = codeSnap.exists ? codeSnap.data() : null;
    const problem = codeProblem({
      codeDoc,
      alreadyRedeemedByUser: redemptionSnap.exists,
      currentEntitlement: entSnap.exists ? entSnap.data() : null,
    }, now);
    if (problem) return { ok: false, reason: problem };
    const entitlement = { ...entitlementFromCode(code, codeDoc, now), updatedAt: now };
    tx.update(codeRef, { uses: (codeDoc.uses || 0) + 1 });
    tx.set(redemptionRef, { uid, at: now });
    tx.set(entRef, entitlement);
    return { ok: true, expiresAt: entitlement.expiresAt };
  });
}
