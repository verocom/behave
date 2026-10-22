// Creates free Limitless+ access codes for a partner clinic. Run locally by the app owner:
//
//   FIREBASE_SERVICE_ACCOUNT="$(cat service-account.json)" \
//     node scripts/create-access-codes.mjs --clinic "Clinique Exemple" --count 20 --months 12
//
// Options: --count (default 10)   number of codes
//          --months (default 12)  access length once a code is redeemed
//          --uses (default 1)     people per code (e.g. 15 for one group cohort)
//          --valid-days           how long a code can still be redeemed (default: no limit)
//          --dry-run              print codes without writing anything
// Prints a CSV (code, months, uses) to hand to the clinic.

import { generateCode, formatCode } from '../api/_lib/billing.js';

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : args[i + 1];
};
const clinicName = opt('clinic');
const count = Number(opt('count', 10));
const months = Number(opt('months', 12));
const maxUses = Number(opt('uses', 1));
const validDays = opt('valid-days') ? Number(opt('valid-days')) : null;
const dryRun = args.includes('--dry-run');

if (!clinicName || ![count, months, maxUses].every(n => Number.isInteger(n) && n > 0) || (validDays !== null && !(validDays > 0))) {
  console.error('Usage: node scripts/create-access-codes.mjs --clinic "Name" [--count 10] [--months 12] [--uses 1] [--valid-days N] [--dry-run]');
  process.exit(1);
}

const clinicId = clinicName.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const now = Date.now();
const codes = Array.from({ length: count }, () => generateCode());
const doc = { clinicId, clinicName, maxUses, uses: 0, months, validUntil: validDays ? now + validDays * 86400000 : null, createdAt: now };

if (!dryRun) {
  const { getAdmin } = await import('../api/_lib/server.js');
  const { db } = getAdmin();
  const batch = db.batch();
  // create() fails instead of overwriting if a code somehow already exists.
  codes.forEach(code => batch.create(db.doc(`accessCodes/${code}`), doc));
  await batch.commit();
}

console.log('code,months,uses');
codes.forEach(code => console.log(`${formatCode(code)},${months},${maxUses}`));
console.error(`${dryRun ? '[dry run] ' : ''}${count} code(s) for "${clinicName}" (${clinicId}).`);
