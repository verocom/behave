// Standalone verification for src/copingToolkit.js — run with: node scripts/check-coping.mjs
import assert from 'node:assert/strict';
import { techniqueForMoment, suggestTechniques } from '../src/copingToolkit.js';

let passed = 0;
function check(name, fn) {
  fn();
  passed++;
  console.log(`✓ ${name}`);
}

check('very high water always offers TIPP, whatever the emotions', () => {
  assert.equal(techniqueForMoment(8, ['sadness']), 'tipp');
  assert.equal(techniqueForMoment(10, []), 'tipp');
});

check('below 8, the best match for the picked emotions wins', () => {
  assert.equal(techniqueForMoment(6, ['stress', 'sadness']), 'please'); // the only technique tagged with both
});

check('ties are broken toward the user challenges', () => {
  const tied = suggestTechniques(['anxiety'], 20).map(tc => tc.id);
  assert.ok(tied.length > 1);
  assert.equal(techniqueForMoment(4, ['anxiety']), tied[0]);
  assert.equal(techniqueForMoment(4, ['anxiety'], ['loneliness']), 'selfSoothe5'); // anxiety + loneliness
});

check('no emotions: STOP from the neck up, nothing when calm or unset', () => {
  assert.equal(techniqueForMoment(5, []), 'stop');
  assert.equal(techniqueForMoment(3, []), null);
  assert.equal(techniqueForMoment(null, []), null);
});

console.log(`\n${passed} checks passed.`);
