// ── Shared plumbing for the /api functions ───────────────────────────────────
// Configuration comes only from environment variables set in Vercel (never committed):
//   FIREBASE_SERVICE_ACCOUNT  JSON of a Firebase service account key (Admin SDK)
//   STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_MONTHLY, STRIPE_PRICE_YEARLY
//   APP_URL (optional) e.g. https://behave-oxeon.vercel.app — where Stripe sends people back
// Each feature switches on only once everything it needs is present; until then endpoints
// answer 503 and the app keeps showing "available soon".

import Stripe from 'stripe';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

export const env = name => process.env[name] || '';

export function billingConfig() {
  const admin = !!env('FIREBASE_SERVICE_ACCOUNT');
  const stripe = !!env('STRIPE_SECRET_KEY');
  return {
    codes: admin,
    checkout: admin && stripe && !!env('STRIPE_PRICE_MONTHLY') && !!env('STRIPE_PRICE_YEARLY'),
    webhook: admin && stripe && !!env('STRIPE_WEBHOOK_SECRET'),
  };
}

let stripeClient;
export function getStripe() {
  stripeClient ||= new Stripe(env('STRIPE_SECRET_KEY'));
  return stripeClient;
}

export function getAdmin() {
  if (!getApps().length) initializeApp({ credential: cert(JSON.parse(env('FIREBASE_SERVICE_ACCOUNT'))) });
  return { auth: getAuth(), db: getFirestore() };
}

export function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

export async function readRaw(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  return Buffer.concat(chunks);
}

export async function readJson(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
  try { return JSON.parse((await readRaw(req)).toString() || '{}'); } catch { return {}; }
}

/** The signed-in Firebase user making the request (from "Authorization: Bearer <ID token>"), or null. */
export async function requireUser(req, auth) {
  const match = /^Bearer (.+)$/.exec(req.headers.authorization || '');
  if (!match) return null;
  try { return await auth.verifyIdToken(match[1]); } catch { return null; }
}

export function appUrl(req) {
  return env('APP_URL') || `https://${req.headers['x-forwarded-host'] || req.headers.host}`;
}
