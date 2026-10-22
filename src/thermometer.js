// ── Mood thermometer ─────────────────────────────────────────────────────────
// Pure data/logic for the multi-daypart intensity check-ins. No React/JSX here
// so it stays directly Node-testable (see scripts/check-thermometer.mjs).

export const DAYPARTS = ['wake', 'noon', 'dinner', 'evening', 'night', 'adhoc'];

/** Best-guess daypart from the current hour, to pre-select the chip — user can always override. */
export function suggestDaypart(date = new Date()) {
  const h = date.getHours();
  if (h >= 5 && h < 10) return 'wake';
  if (h >= 10 && h < 14) return 'noon';
  if (h >= 17 && h < 20) return 'dinner';
  if (h >= 20 && h < 23) return 'evening';
  return 'night';
}

/**
 * Averages ratings per trait × daypart across the given mood checks, within the last `days`
 * (default 14). Returns { [traitId]: { [daypart]: avgOrNull } } — a daypart with no reading
 * for a trait stays null so the UI can render an empty cell instead of a misleading 0.
 */
export function aggregateThermometer(moodChecks, traitIds, days = 14) {
  const cutoff = Date.now() - days * 86400000;
  const sums = {};
  const counts = {};
  traitIds.forEach(id => { sums[id] = {}; counts[id] = {}; });
  (moodChecks || []).filter(m => m.timestamp > cutoff).forEach(m => {
    Object.entries(m.ratings || {}).forEach(([traitId, value]) => {
      if (!sums[traitId]) return;
      sums[traitId][m.daypart] = (sums[traitId][m.daypart] || 0) + value;
      counts[traitId][m.daypart] = (counts[traitId][m.daypart] || 0) + 1;
    });
  });
  const result = {};
  traitIds.forEach(id => {
    result[id] = {};
    DAYPARTS.forEach(dp => {
      const c = counts[id][dp] || 0;
      result[id][dp] = c > 0 ? sums[id][dp] / c : null;
    });
  });
  return result;
}

/**
 * Maps a 0-10 intensity value to the water surface's y-coordinate in the swim-scene
 * illustration (src/App.jsx's SwimScene). `bottomY` is where the water sits at value 0
 * (low, calm — below the swimmer), `topY` is where it sits at value 10 (high — above the
 * swimmer's head); SVG y grows downward so bottomY > topY. The defaults are calibrated
 * against SwimScene's own geometry so that ~5 lands the water right at the swimmer's neck.
 * Values outside 0-10 are clamped; a missing/null value is treated as 0.
 */
export function waterLevelY(value, { bottomY = 130, topY = 20 } = {}) {
  const clamped = Math.max(0, Math.min(10, value ?? 0));
  return bottomY - (clamped / 10) * (bottomY - topY);
}
