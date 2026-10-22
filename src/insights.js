// ── Insights ─────────────────────────────────────────────────────────────────
// Turns raw entries / mood checks into a few plain-language observations for the
// Insights tab. Returns data ({ id, ...params }); wording lives in src/i18n.js under
// STRINGS[lang].insight. Framed kindly on purpose: wins and calmer weeks are surfaced,
// a rougher week is never called out. No React here (see scripts/check-insights.mjs).

const DAY = 86400000;

// "Replaced" marks a win, and time-of-day tags describe when, not why — neither is a trigger.
export const NON_TRIGGER_TAG_IDS = ['replaced', 'morning', 'afternoon', 'evening', 'night'];

export function triggerCounts(entries, { now = Date.now(), days = 14 } = {}) {
  const counts = {};
  entries.filter(e => e.timestamp > now - days * DAY).forEach(e => {
    e.tags?.forEach(id => { if (!NON_TRIGGER_TAG_IDS.includes(id)) counts[id] = (counts[id] || 0) + 1; });
  });
  return Object.entries(counts).sort((a, b) => b[1] - a[1]);
}

function averageLevel(checks) {
  const values = checks.flatMap(m => Object.values(m.ratings || {}));
  return values.length ? values.reduce((s, v) => s + v, 0) / values.length : null;
}

/**
 * @param {object} data
 * @param {Array} data.entries      journal entries ({ timestamp, tags, replacement })
 * @param {Array} data.moodChecks   water-level readings ({ timestamp, daypart, ratings })
 * @param {(text: string) => string|null} [data.techniqueOf] maps a replacement text to a technique id
 * @returns {Array<object>} up to `max` insights, most encouraging first
 */
export function buildInsights({ entries = [], moodChecks = [], techniqueOf = () => null }, { now = Date.now(), max = 4 } = {}) {
  const out = [];
  const inWindow = (ts, from, to) => ts > now - from * DAY && ts <= now - to * DAY;

  const wins = entries.filter(e => inWindow(e.timestamp, 7, 0) && e.tags?.includes('replaced')).length;
  const winsPrev = entries.filter(e => inWindow(e.timestamp, 14, 7) && e.tags?.includes('replaced')).length;
  if (wins > 0) out.push({ id: 'wins', count: wins, more: wins > winsPrev && winsPrev > 0 });

  const levelNow = averageLevel(moodChecks.filter(m => inWindow(m.timestamp, 7, 0)));
  const levelPrev = averageLevel(moodChecks.filter(m => inWindow(m.timestamp, 14, 7)));
  if (levelNow != null && levelPrev != null && levelPrev - levelNow >= 1) out.push({ id: 'calmer' });

  // "adhoc" readings aren't tied to a time of day, so they can't be the hardest one.
  const recentChecks = moodChecks.filter(m => inWindow(m.timestamp, 14, 0) && m.daypart !== 'adhoc');
  const byDaypart = {};
  recentChecks.forEach(m => { (byDaypart[m.daypart] ||= []).push(m); });
  const dayparts = Object.entries(byDaypart).map(([dp, list]) => [dp, averageLevel(list)]).filter(([, avg]) => avg != null);
  if (recentChecks.length >= 3 && dayparts.length >= 2) {
    const [daypart, avg] = dayparts.sort((a, b) => b[1] - a[1])[0];
    if (avg >= 4) out.push({ id: 'hardestDaypart', daypart });
  }

  const [top] = triggerCounts(entries, { now });
  if (top && top[1] >= 3) out.push({ id: 'topTrigger', tagId: top[0], count: top[1] });

  const techCounts = {};
  entries.filter(e => inWindow(e.timestamp, 30, 0) && e.replacement).forEach(e => {
    const id = techniqueOf(e.replacement);
    if (id) techCounts[id] = (techCounts[id] || 0) + 1;
  });
  const [bestTech] = Object.entries(techCounts).sort((a, b) => b[1] - a[1]);
  if (bestTech && bestTech[1] >= 2) out.push({ id: 'bestTechnique', techniqueId: bestTech[0], count: bestTech[1] });

  return out.slice(0, max);
}
