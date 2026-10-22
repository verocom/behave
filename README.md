# Limitless — Behavior Journal

Track, understand and change your patterns.

## Stack
- React 18 + Vite
- Firebase Auth (Email + Google) & Firestore
- Web Speech API (voice journaling, 10 languages)
- i18n: English, Français, Español
- PWA installable

## Deploy
Pushed to `main` → Vercel auto-deploys.

## Firebase setup (already done)
- Authentication: Email/Password + Google enabled
- Firestore rules: see `firestore.rules`
- Authorized domains: add your Vercel URL in Firebase Console → Authentication → Settings

## Limitless+ setup (payments and clinic codes)
The journal, check-ins, the 7-day basics program and crisis resources stay free. Limitless+ is
sold through Stripe, and clinics can hand free access codes to people who finished DBT. Until
the variables below are set on Vercel, the Limitless+ screen simply shows "Available soon".

Server code lives in `/api` (Vercel functions). Entitlements are written only there, with the
Firebase Admin SDK; the app can read its own `entitlements/{uid}` but never write it.

1. **Firestore rules** — deploy `firestore.rules` (Firebase Console → Firestore → Rules, or
   `firebase deploy --only firestore:rules`).
2. **Firebase service account** — Firebase Console → Project settings → Service accounts →
   Generate new private key. Paste the whole JSON as `FIREBASE_SERVICE_ACCOUNT` on Vercel.
   This alone turns on clinic codes.
3. **Stripe products** — create a "Limitless+" product with two recurring prices
   (e.g. 6.99 $/month and 49 $/year).
4. **Stripe webhook** — Developers → Webhooks → Add endpoint
   `https://<your-domain>/api/stripe-webhook` with the events `checkout.session.completed`,
   `customer.subscription.created`, `customer.subscription.updated` and
   `customer.subscription.deleted`.
5. **Customer portal** — Settings → Billing → Customer portal: activate it and allow
   cancelling subscriptions (and switching between the two prices, if you like).
6. **Vercel environment variables** (Production), then redeploy:

   | Variable | Value |
   | --- | --- |
   | `FIREBASE_SERVICE_ACCOUNT` | service account JSON (step 2) |
   | `STRIPE_SECRET_KEY` | `sk_live_…` (or `sk_test_…` to try it first) |
   | `STRIPE_WEBHOOK_SECRET` | `whsec_…` from step 4 |
   | `STRIPE_PRICE_MONTHLY` | `price_…` monthly price id |
   | `STRIPE_PRICE_YEARLY` | `price_…` yearly price id |
   | `APP_URL` | optional, e.g. `https://limitless.app` (defaults to the request host) |

### Clinic access codes
Run locally with the service account (never commit it):

```sh
FIREBASE_SERVICE_ACCOUNT="$(cat service-account.json)" \
  node scripts/create-access-codes.mjs --clinic "Clinique Exemple" --count 20 --months 12
```

Options: `--uses 15` for one code shared by a whole group, `--valid-days 90` to limit how long a
code can still be activated, `--dry-run` to preview. It prints a CSV of codes
(`LMT-XXXX-XXXX-XX`) to send to the clinic. People enter them in Limitless+ → "Finished DBT?".

### Checks
`npm run verify:billing` covers the entitlement rules, code redemption and webhook signatures.
