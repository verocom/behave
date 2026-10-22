// ── Challenges (onboarding personalization) ──────────────────────────────────
// Non-clinical "what do you struggle with" areas, picked directly or via a short
// lived-experience quiz. Never a diagnosis. Each maps onto vocabulary the app already
// has: emotion tag ids (EMOTION_TAGS / COPING_TECHNIQUES[].tagIds) and onboarding
// behavior ids (SUGGESTED_BEHAVIORS). Labels/quiz copy live in src/i18n.js under
// STRINGS[lang].challenges. No React here so it stays Node-testable
// (see scripts/check-challenges.mjs).

export const CHALLENGES = [
  { id: 'impulsivity', tagIds: ['strongcraving', 'boredom'], behaviorIds: ['impulseBuying', 'smoking', 'junkFood', 'alcohol', 'socialMedia', 'videoGames', 'procrastination'] },
  { id: 'emotionalIntensity', tagIds: ['anger', 'sadness', 'anxiety', 'stress'], behaviorIds: ['junkFood', 'alcohol', 'smoking'] },
  { id: 'anxiousThoughts', tagIds: ['anxiety', 'stress', 'boredom'], behaviorIds: ['socialMedia', 'procrastination', 'nailBiting'] },
  { id: 'lowMood', tagIds: ['sadness', 'loneliness', 'boredom'], behaviorIds: ['junkFood', 'videoGames', 'procrastination'] },
  { id: 'relationshipSensitivity', tagIds: ['loneliness', 'sadness', 'anger'], behaviorIds: ['socialMedia'] },
  { id: 'selfHarmUrges', tagIds: ['anger', 'sadness', 'anxiety', 'strongcraving'], behaviorIds: [] },
];

/** Deduplicated union of emotion tag ids for the given challenges, in first-seen order. */
export function relevantTagIds(challengeIds) {
  if (!challengeIds?.length) return [];
  const out = [];
  challengeIds.forEach(id => {
    CHALLENGES.find(c => c.id === id)?.tagIds.forEach(tagId => { if (!out.includes(tagId)) out.push(tagId); });
  });
  return out;
}

function stableSortByScore(items, score) {
  return items
    .map((item, i) => ({ item, i, s: score(item) }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map(x => x.item);
}

/** Behaviors listed by more of the selected challenges come first; ties keep original order. */
export function sortBehaviorsByChallenges(behaviors, challengeIds) {
  if (!challengeIds?.length) return behaviors;
  const selected = CHALLENGES.filter(c => challengeIds.includes(c.id));
  return stableSortByScore(behaviors, b => selected.filter(c => c.behaviorIds.includes(b.id)).length);
}

/** Coping techniques sharing more tag ids with `priorityTagIds` come first; ties keep original order. */
export function prioritizeTechniques(techniques, priorityTagIds) {
  if (!priorityTagIds?.length) return techniques;
  return stableSortByScore(techniques, tc => tc.tagIds.filter(id => priorityTagIds.includes(id)).length);
}
