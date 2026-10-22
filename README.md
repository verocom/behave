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

## Daily gentle reminder (push notifications)
One notification a day at the hour each person picks (Settings → Gentle reminder, or the
invitation shown on Today after a check-in), in their own time zone, and none on a day they
already logged something. Until the variables below are set, the option shows "Available soon".

1. **Keys** — run `npx web-push generate-vapid-keys` once and add on Vercel:
   `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, optionally `VAPID_SUBJECT` (`mailto:you@example.com`).
   `FIREBASE_SERVICE_ACCOUNT` (see above) is also required.
2. **Scheduler secret** — pick a long random string (`openssl rand -hex 32`) and set it as
   `CRON_SECRET` on Vercel. Redeploy.
3. **Hourly run** — `/api/send-reminders` must be called every hour with
   `Authorization: Bearer <CRON_SECRET>`. The included GitHub Action
   (`.github/workflows/daily-reminders.yml`) does it: add the repository secrets `APP_URL`
   (e.g. `https://behave-oxeon.vercel.app`) and `CRON_SECRET` (same value as on Vercel).
   On a Vercel Pro plan you can use Vercel Cron instead (`"crons": [{ "path": "/api/send-reminders", "schedule": "7 * * * *" }]` in `vercel.json`);
   Hobby plans only allow daily crons, which is not enough.
4. **Firestore rules** — deploy `firestore.rules` again (adds the read-only `reminders` rule).

On iPhone/iPad, notifications only work once Limitless is added to the home screen
(iOS 16.4+); the app explains this. `npm run verify:reminders` covers time zones,
daylight saving, the skip-if-already-logged rule and cleanup.
