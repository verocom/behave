// ── Guided programs ──────────────────────────────────────────────────────────
// Structure only; titles and day-by-day copy live in src/programContent.js. Each day of a
// written program pairs one coping technique (src/copingToolkit.js) with an intro, a
// practice and a reflection question. Premium programs without `days` are announced but
// not written yet — they render as "coming soon", never as placeholder content.
// No React here (see scripts/check-programs.mjs).

export const PROGRAMS = [
  { id: 'basics', emoji: '🌊', premium: false, days: ['stop', 'tipp', 'accepts', 'selfSoothe5', 'wiseMind', 'checkFacts', 'oppositeAction'] },
  { id: 'storms', emoji: '⛈️', premium: true, length: 14 },
  { id: 'relationships', emoji: '🤝', premium: true, length: 10 },
  { id: 'afterTherapy', emoji: '🧭', premium: true, length: 30 },
];

const sameDay = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();

/**
 * State of each day given `progress.completed` ({ [dayIndex]: completedAtMs }):
 * 'done' | 'current' (open now) | 'tomorrow' (previous day finished today) | 'locked'.
 * One new day opens per calendar day, so the program is a daily habit rather than a binge.
 */
export function dayStates(program, progress, now = Date.now()) {
  const completed = progress?.completed || {};
  let reachedOpen = false;
  return (program.days || []).map((_, i) => {
    if (completed[i] != null) return 'done';
    if (reachedOpen) return 'locked';
    reachedOpen = true;
    if (i === 0) return 'current';
    const prev = completed[i - 1];
    if (prev == null) return 'locked';
    return sameDay(prev, now) ? 'tomorrow' : 'current';
  });
}

export function programSummary(program, progress, now = Date.now()) {
  const states = dayStates(program, progress, now);
  const done = states.filter(s => s === 'done').length;
  const nextIndex = states.findIndex(s => s !== 'done');
  return {
    done,
    total: states.length,
    nextIndex: nextIndex === -1 ? null : nextIndex,
    nextState: nextIndex === -1 ? null : states[nextIndex],
    finished: states.length > 0 && done === states.length,
  };
}
