// Standalone verification for src/autoTag.js — run with: node scripts/check-autotag.mjs
// No bundler needed since autoTag.js has no JSX / React imports.
import assert from 'node:assert/strict';
import { matchTags, matchBehavior, getTimeOfDayTag } from '../src/autoTag.js';

let passed = 0;
function check(name, fn) {
  fn();
  passed++;
  console.log(`✓ ${name}`);
}

// English: anxiety + work context, behavior = cigarette
check('en: anxiety + work detected, behavior matched', () => {
  const transcript = 'I felt really anxious at work this morning and almost smoked a cigarette';
  const tags = matchTags(transcript, 'en');
  assert.ok(tags.includes('anxiety'), `expected anxiety in ${JSON.stringify(tags)}`);
  assert.ok(tags.includes('work'), `expected work in ${JSON.stringify(tags)}`);
  const behaviors = [{ id: 'b1', label: 'Cigarette' }, { id: 'b2', label: 'Impulse buying' }];
  const labels = { en: { smoking: 'Cigarette' }, fr: { smoking: 'Cigarette' }, es: { smoking: 'Cigarrillo' } };
  assert.equal(matchBehavior(transcript, behaviors, 'en', labels), 'b1');
});

// French: stress + work, accent-insensitive matching
check('fr: stress + travail detected (accent-insensitive)', () => {
  const transcript = "J'étais tellement stressée après le travail que j'ai failli fumer";
  const tags = matchTags(transcript, 'fr');
  assert.ok(tags.includes('stress'), `expected stress in ${JSON.stringify(tags)}`);
  assert.ok(tags.includes('work'), `expected work in ${JSON.stringify(tags)}`);
});

// Spanish: anxiety + strongcraving
check('es: ansiedad + antojo detected', () => {
  const transcript = 'Sentí mucha ansiedad y ganas fuertes de comprar algo';
  const tags = matchTags(transcript, 'es');
  assert.ok(tags.includes('anxiety'), `expected anxiety in ${JSON.stringify(tags)}`);
  assert.ok(tags.includes('strongcraving'), `expected strongcraving in ${JSON.stringify(tags)}`);
});

// Negative case: neutral transcript, no false positives
check('neutral transcript yields no tags and no behavior guess', () => {
  const transcript = 'The weather was nice and I went for a walk in the park.';
  const tags = matchTags(transcript, 'en');
  assert.deepEqual(tags, []);
  const behaviors = [{ id: 'b1', label: 'Cigarette' }];
  const labels = { en: { smoking: 'Cigarette' }, fr: {}, es: {} };
  assert.equal(matchBehavior(transcript, behaviors, 'en', labels), null);
});

// Word-boundary guard: "mad" must not match inside "madame"
check('word-boundary guard prevents substring false positive', () => {
  const transcript = "Bonjour madame, tout va bien aujourd'hui.";
  const tags = matchTags(transcript, 'en'); // en lexicon has "mad" under anger
  assert.ok(!tags.includes('anger'), `did not expect anger in ${JSON.stringify(tags)}`);
});

// Ambiguous tie: two behaviors score equally → no guess
check('tied behavior scores return null rather than guessing', () => {
  const transcript = 'I had some soda and chips';
  const behaviors = [{ id: 'b1', label: 'Soda' }, { id: 'b2', label: 'Chips' }];
  const labels = { en: {}, fr: {}, es: {} };
  assert.equal(matchBehavior(transcript, behaviors, 'en', labels), null);
});

// Time-of-day is derived from the clock, not text
check('getTimeOfDayTag maps hours to the right bucket', () => {
  assert.equal(getTimeOfDayTag(new Date('2026-01-01T08:00:00')), 'morning');
  assert.equal(getTimeOfDayTag(new Date('2026-01-01T14:00:00')), 'afternoon');
  assert.equal(getTimeOfDayTag(new Date('2026-01-01T19:00:00')), 'evening');
  assert.equal(getTimeOfDayTag(new Date('2026-01-01T23:00:00')), 'night');
  assert.equal(getTimeOfDayTag(new Date('2026-01-01T02:00:00')), 'night');
});

console.log(`\n${passed} checks passed.`);
