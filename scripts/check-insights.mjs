// Standalone verification for src/insights.js — run with: node scripts/check-insights.mjs
import assert from 'node:assert/strict';
import { buildInsights, triggerCounts } from '../src/insights.js';

let passed = 0;
function check(name, fn) {
  fn();
  passed++;
  console.log(`✓ ${name}`);
}

const NOW = new Date('2026-10-22T12:00:00').getTime();
const DAY = 86400000;
const ago = d => NOW - d * DAY;
const ids = list => list.map(i => i.id);

check('no data yields no insights', () => {
  assert.deepEqual(buildInsights({}, { now: NOW }), []);
});

check('wins counts replaced entries this week and flags improvement over last week', () => {
  const entries = [
    { timestamp: ago(1), tags: ['replaced'] }, { timestamp: ago(2), tags: ['replaced', 'stress'] },
    { timestamp: ago(9), tags: ['replaced'] }, { timestamp: ago(3), tags: ['stress'] },
  ];
  const [wins] = buildInsights({ entries }, { now: NOW });
  assert.deepEqual(wins, { id: 'wins', count: 2, more: true });
});

check('wins is not "more" when there was nothing last week to compare to', () => {
  const [wins] = buildInsights({ entries: [{ timestamp: ago(1), tags: ['replaced'] }] }, { now: NOW });
  assert.equal(wins.more, false);
});

check('calmer appears only when the average water level dropped by at least 1', () => {
  const mk = (d, v) => ({ timestamp: ago(d), daypart: 'noon', ratings: { anxiety: v } });
  assert.ok(ids(buildInsights({ moodChecks: [mk(1, 3), mk(2, 4), mk(8, 6), mk(9, 5)] }, { now: NOW })).includes('calmer'));
  assert.ok(!ids(buildInsights({ moodChecks: [mk(1, 6), mk(8, 6.5)] }, { now: NOW })).includes('calmer'));
  assert.ok(!ids(buildInsights({ moodChecks: [mk(1, 2)] }, { now: NOW })).includes('calmer')); // nothing to compare
});

check('hardestDaypart picks the highest average daypart once there is enough signal', () => {
  const moodChecks = [
    { timestamp: ago(1), daypart: 'evening', ratings: { anxiety: 8, sadness: 6 } },
    { timestamp: ago(2), daypart: 'evening', ratings: { anxiety: 7 } },
    { timestamp: ago(3), daypart: 'wake', ratings: { anxiety: 2 } },
  ];
  const hit = buildInsights({ moodChecks }, { now: NOW }).find(i => i.id === 'hardestDaypart');
  assert.deepEqual(hit, { id: 'hardestDaypart', daypart: 'evening' });
  // Too few readings, or only one daypart, stays silent.
  assert.ok(!ids(buildInsights({ moodChecks: moodChecks.slice(0, 2) }, { now: NOW })).includes('hardestDaypart'));
});

check('hardestDaypart stays silent when every daypart is calm', () => {
  const moodChecks = [1, 2, 3].map(d => ({ timestamp: ago(d), daypart: d === 1 ? 'wake' : 'noon', ratings: { anxiety: 2 } }));
  assert.ok(!ids(buildInsights({ moodChecks }, { now: NOW })).includes('hardestDaypart'));
});

check('hardestDaypart ignores one-off readings that have no time of day', () => {
  const moodChecks = [
    { timestamp: ago(1), daypart: 'adhoc', ratings: { anxiety: 10 } }, { timestamp: ago(2), daypart: 'adhoc', ratings: { anxiety: 10 } },
    { timestamp: ago(3), daypart: 'night', ratings: { anxiety: 6 } }, { timestamp: ago(4), daypart: 'wake', ratings: { anxiety: 5 } },
    { timestamp: ago(5), daypart: 'night', ratings: { anxiety: 6 } },
  ];
  assert.equal(buildInsights({ moodChecks }, { now: NOW }).find(i => i.id === 'hardestDaypart').daypart, 'night');
});

check('triggers exclude "replaced" and time-of-day tags', () => {
  const entries = [1, 2, 3, 4].map(d => ({ timestamp: ago(d), tags: ['replaced', 'night', 'stress'] }));
  assert.deepEqual(triggerCounts(entries, { now: NOW }), [['stress', 4]]);
  const hit = buildInsights({ entries }, { now: NOW }).find(i => i.id === 'topTrigger');
  assert.deepEqual(hit, { id: 'topTrigger', tagId: 'stress', count: 4 });
});

check('bestTechnique resolves replacement texts through techniqueOf', () => {
  const entries = [
    { timestamp: ago(1), replacement: 'TIPP', tags: [] }, { timestamp: ago(2), replacement: 'TIPP', tags: [] },
    { timestamp: ago(3), replacement: 'a walk', tags: [] },
  ];
  const techniqueOf = text => (text === 'TIPP' ? 'tipp' : null);
  const hit = buildInsights({ entries, techniqueOf }, { now: NOW }).find(i => i.id === 'bestTechnique');
  assert.deepEqual(hit, { id: 'bestTechnique', techniqueId: 'tipp', count: 2 });
});

check('encouraging insights come first and the list is capped', () => {
  const entries = [1, 2, 3].map(d => ({ timestamp: ago(d), tags: ['replaced', 'stress'], replacement: 'TIPP' }));
  const moodChecks = [
    { timestamp: ago(1), daypart: 'evening', ratings: { anxiety: 5 } }, { timestamp: ago(2), daypart: 'noon', ratings: { anxiety: 4 } },
    { timestamp: ago(3), daypart: 'evening', ratings: { anxiety: 5 } }, { timestamp: ago(8), daypart: 'noon', ratings: { anxiety: 9 } },
  ];
  const list = buildInsights({ entries, moodChecks, techniqueOf: () => 'tipp' }, { now: NOW });
  assert.deepEqual(ids(list), ['wins', 'calmer', 'hardestDaypart', 'topTrigger']);
  assert.equal(buildInsights({ entries, moodChecks, techniqueOf: () => 'tipp' }, { now: NOW, max: 2 }).length, 2);
});

console.log(`\n${passed} checks passed.`);
