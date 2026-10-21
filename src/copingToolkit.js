// ── Coping toolkit (DBT-informed) ────────────────────────────────────────────
// Structural catalog only — no translated copy. Titles/how-tos live in
// src/i18n.js under STRINGS[lang].copingTechniques, keyed by the ids below.
// Psychoeducational content, not a diagnosis or a substitute for therapy.

export const COPING_CATEGORIES = ['distressTolerance', 'emotionRegulation', 'mindfulness'];

export const COPING_TECHNIQUES = [
  { id: 'tipp', category: 'distressTolerance', tagIds: ['strongcraving', 'anger', 'anxiety'] },
  { id: 'accepts', category: 'distressTolerance', tagIds: ['strongcraving', 'boredom', 'sadness'] },
  { id: 'selfSoothe5', category: 'distressTolerance', tagIds: ['sadness', 'loneliness', 'anxiety'] },
  { id: 'improve', category: 'distressTolerance', tagIds: ['stress', 'strongcraving'] },
  { id: 'stop', category: 'distressTolerance', tagIds: ['anger', 'strongcraving'] },
  { id: 'radicalAcceptance', category: 'distressTolerance', tagIds: ['sadness', 'anger'] },
  { id: 'please', category: 'emotionRegulation', tagIds: ['stress', 'sadness'] },
  { id: 'checkFacts', category: 'emotionRegulation', tagIds: ['anxiety', 'anger'] },
  { id: 'oppositeAction', category: 'emotionRegulation', tagIds: ['sadness', 'anger', 'anxiety'] },
  { id: 'abc', category: 'emotionRegulation', tagIds: ['boredom', 'sadness'] },
  { id: 'wiseMind', category: 'mindfulness', tagIds: ['anxiety', 'anger', 'stress'] },
  { id: 'observeDescribe', category: 'mindfulness', tagIds: ['anxiety', 'stress'] },
  { id: 'nonjudgmental', category: 'mindfulness', tagIds: ['anger', 'sadness'] },
];

/** Returns up to `max` techniques most relevant to the given active tag ids, scored by overlap. */
export function suggestTechniques(activeTagIds, max = 3) {
  if (!activeTagIds?.length) return [];
  return COPING_TECHNIQUES
    .map(tc => ({ tc, score: tc.tagIds.filter(id => activeTagIds.includes(id)).length }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, max)
    .map(x => x.tc);
}
