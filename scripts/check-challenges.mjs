// Standalone verification for src/challenges.js — run with: node scripts/check-challenges.mjs
import assert from 'node:assert/strict';
import { CHALLENGES, relevantTagIds, sortBehaviorsByChallenges, prioritizeTechniques } from '../src/challenges.js';

let passed = 0;
function check(name, fn) {
  fn();
  passed++;
  console.log(`✓ ${name}`);
}

const EMOTION_TAGS = ['anxiety', 'stress', 'sadness', 'anger', 'loneliness', 'boredom', 'strongcraving'];
const BEHAVIOR_IDS = ['smoking', 'impulseBuying', 'junkFood', 'alcohol', 'socialMedia', 'videoGames', 'nailBiting', 'procrastination'];

check('every challenge references only known emotion tags and behaviors', () => {
  CHALLENGES.forEach(c => {
    c.tagIds.forEach(id => assert.ok(EMOTION_TAGS.includes(id), `${c.id}: unknown tag ${id}`));
    c.behaviorIds.forEach(id => assert.ok(BEHAVIOR_IDS.includes(id), `${c.id}: unknown behavior ${id}`));
  });
});

check('every emotion tag and behavior is reachable from at least one challenge', () => {
  EMOTION_TAGS.forEach(id => assert.ok(CHALLENGES.some(c => c.tagIds.includes(id)), `unreachable tag ${id}`));
  BEHAVIOR_IDS.forEach(id => assert.ok(CHALLENGES.some(c => c.behaviorIds.includes(id)), `unreachable behavior ${id}`));
});

check('relevantTagIds returns a deduplicated union in first-seen order', () => {
  assert.deepEqual(relevantTagIds(['impulsivity', 'lowMood']), ['strongcraving', 'boredom', 'sadness', 'loneliness']);
  assert.deepEqual(relevantTagIds([]), []);
  assert.deepEqual(relevantTagIds(undefined), []);
  assert.deepEqual(relevantTagIds(['unknownId']), []);
});

check('sortBehaviorsByChallenges ranks by overlap and keeps ties stable', () => {
  const behaviors = BEHAVIOR_IDS.map(id => ({ id }));
  const sorted = sortBehaviorsByChallenges(behaviors, ['anxiousThoughts', 'lowMood']).map(b => b.id);
  assert.equal(sorted[0], 'procrastination'); // listed by both challenges
  assert.deepEqual(sorted.slice(1, 5), ['junkFood', 'socialMedia', 'videoGames', 'nailBiting']); // score 1, original order
  assert.deepEqual(sorted.slice(5), ['smoking', 'impulseBuying', 'alcohol']); // score 0, original order
});

check('sortBehaviorsByChallenges with no challenges returns the input order', () => {
  const behaviors = BEHAVIOR_IDS.map(id => ({ id }));
  assert.deepEqual(sortBehaviorsByChallenges(behaviors, []), behaviors);
});

check('prioritizeTechniques ranks by tag overlap and keeps ties stable', () => {
  const techniques = [
    { id: 'a', tagIds: ['anger'] },
    { id: 'b', tagIds: ['sadness', 'loneliness'] },
    { id: 'c', tagIds: ['stress'] },
    { id: 'd', tagIds: ['loneliness'] },
  ];
  assert.deepEqual(prioritizeTechniques(techniques, ['sadness', 'loneliness']).map(t => t.id), ['b', 'd', 'a', 'c']);
  assert.deepEqual(prioritizeTechniques(techniques, []).map(t => t.id), ['a', 'b', 'c', 'd']);
});

console.log(`\n${passed} checks passed.`);
