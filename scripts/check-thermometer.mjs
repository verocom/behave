// Standalone verification for src/thermometer.js — run with: node scripts/check-thermometer.mjs
import assert from 'node:assert/strict';
import { suggestDaypart, aggregateThermometer, DAYPARTS } from '../src/thermometer.js';

let passed = 0;
function check(name, fn) {
  fn();
  passed++;
  console.log(`✓ ${name}`);
}

check('suggestDaypart maps hours to the right bucket', () => {
  assert.equal(suggestDaypart(new Date('2026-01-01T07:00:00')), 'wake');
  assert.equal(suggestDaypart(new Date('2026-01-01T12:00:00')), 'noon');
  assert.equal(suggestDaypart(new Date('2026-01-01T18:00:00')), 'dinner');
  assert.equal(suggestDaypart(new Date('2026-01-01T21:00:00')), 'evening');
  assert.equal(suggestDaypart(new Date('2026-01-01T02:00:00')), 'night');
  assert.equal(suggestDaypart(new Date('2026-01-01T23:30:00')), 'night');
});

check('aggregateThermometer averages correctly per trait x daypart', () => {
  const now = Date.now();
  const moodChecks = [
    { timestamp: now, daypart: 'wake', ratings: { anxiety: 4, sadness: 2 } },
    { timestamp: now, daypart: 'wake', ratings: { anxiety: 8 } },
    { timestamp: now, daypart: 'night', ratings: { anxiety: 2 } },
  ];
  const result = aggregateThermometer(moodChecks, ['anxiety', 'sadness', 'anger']);
  assert.equal(result.anxiety.wake, 6); // (4+8)/2
  assert.equal(result.anxiety.night, 2);
  assert.equal(result.sadness.wake, 2);
  assert.equal(result.sadness.night, null);
  assert.equal(result.anger.wake, null); // never rated at all
  DAYPARTS.forEach(dp => assert.ok(dp in result.anxiety, `missing daypart ${dp} in result`));
});

check('aggregateThermometer respects the days window', () => {
  const old = Date.now() - 20 * 86400000; // older than the default 14-day window
  const moodChecks = [{ timestamp: old, daypart: 'noon', ratings: { stress: 9 } }];
  const result = aggregateThermometer(moodChecks, ['stress']);
  assert.equal(result.stress.noon, null);
});

check('aggregateThermometer handles an empty list', () => {
  const result = aggregateThermometer([], ['anxiety']);
  assert.equal(result.anxiety.wake, null);
});

console.log(`\n${passed} checks passed.`);
