// Standalone verification for src/thermometer.js — run with: node scripts/check-thermometer.mjs
import assert from 'node:assert/strict';
import { suggestDaypart, aggregateThermometer, waterLevelY, DAYPARTS } from '../src/thermometer.js';

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

check('waterLevelY spans bottomY at 0 to topY at 10, with 5 at the midpoint', () => {
  assert.equal(waterLevelY(0), 130);
  assert.equal(waterLevelY(10), 20);
  assert.equal(waterLevelY(5), 75);
});

check('waterLevelY clamps out-of-range values', () => {
  assert.equal(waterLevelY(-3), 130);
  assert.equal(waterLevelY(15), 20);
});

check('waterLevelY treats a missing value as 0', () => {
  assert.equal(waterLevelY(null), 130);
  assert.equal(waterLevelY(undefined), 130);
});

check('waterLevelY respects custom bounds', () => {
  assert.equal(waterLevelY(5, { bottomY: 100, topY: 0 }), 50);
  assert.equal(waterLevelY(0, { bottomY: 100, topY: 0 }), 100);
  assert.equal(waterLevelY(10, { bottomY: 100, topY: 0 }), 0);
});

console.log(`\n${passed} checks passed.`);
