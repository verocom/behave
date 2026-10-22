// ── Limitless+ billing rules (pure, no SDKs) ─────────────────────────────────
// Shared by the serverless functions in /api and covered by scripts/check-billing.mjs.
// Files under api/_lib are not exposed as endpoints (Vercel ignores "_" paths).

import { randomInt } from 'node:crypto';

export const PLANS = ['monthly', 'yearly'];

// A failed renewal shouldn't lock someone out instantly; Stripe retries for a few days.
const GRACE_MS = 3 * 86400000;
const ACTIVE_STATUSES = ['active', 'trialing', 'past_due'];

/** Maps a Stripe subscription to the entitlement document the app reads. */
export function entitlementFromSubscription(sub) {
  // Newer Stripe API versions moved the billing period onto the subscription items.
  const periodEnd = sub.current_period_end ?? sub.items?.data?.[0]?.current_period_end ?? null;
  const premium = ACTIVE_STATUSES.includes(sub.status);
  return {
    premium,
    source: 'stripe',
    status: sub.status,
    expiresAt: premium && periodEnd ? periodEnd * 1000 + GRACE_MS : Date.now(),
    periodEnd: periodEnd ? periodEnd * 1000 : null,
    stripeCustomerId: typeof sub.customer === 'string' ? sub.customer : sub.customer?.id ?? null,
    stripeSubscriptionId: sub.id,
    cancelAtPeriodEnd: !!sub.cancel_at_period_end,
  };
}

export function isEntitlementActive(ent, now = Date.now()) {
  return !!ent?.premium && (!ent.expiresAt || ent.expiresAt > now);
}

// ── Clinic access codes ────────────────────────────────────────────────────────
// No 0/O, 1/I/L: codes get read aloud and copied off paper.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 10;

/** "lmt-ab3d ef7h-k9" → "AB3DEF7HK9": case, spaces, dashes and the optional LMT prefix don't matter. */
export function normalizeCode(input) {
  const cleaned = String(input || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return cleaned.startsWith('LMT') && cleaned.length === CODE_LENGTH + 3 ? cleaned.slice(3) : cleaned;
}

export function formatCode(code) {
  return `LMT-${code.slice(0, 4)}-${code.slice(4, 8)}-${code.slice(8)}`;
}

export function generateCode() {
  let out = '';
  for (let i = 0; i < CODE_LENGTH; i++) out += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return out;
}

export function isWellFormedCode(code) {
  return code.length === CODE_LENGTH && [...code].every(ch => CODE_ALPHABET.includes(ch));
}

/**
 * Why a code can't be redeemed right now, or null if it can.
 * codeDoc: { maxUses, uses, validUntil?, months } as stored in accessCodes/{code}.
 */
export function codeProblem({ codeDoc, alreadyRedeemedByUser, currentEntitlement }, now = Date.now()) {
  if (!codeDoc) return 'invalid';
  if (alreadyRedeemedByUser) return 'alreadyUsed';
  if (codeDoc.validUntil && codeDoc.validUntil < now) return 'expired';
  if ((codeDoc.uses || 0) >= (codeDoc.maxUses || 1)) return 'used';
  if (isEntitlementActive(currentEntitlement, now)) return 'alreadyPremium';
  return null;
}

export function addMonths(ms, months) {
  const d = new Date(ms);
  d.setMonth(d.getMonth() + months);
  return d.getTime();
}

export function entitlementFromCode(code, codeDoc, now = Date.now()) {
  return {
    premium: true,
    source: 'clinic',
    status: 'active',
    clinicId: codeDoc.clinicId || null,
    code,
    expiresAt: addMonths(now, codeDoc.months || 12),
  };
}
