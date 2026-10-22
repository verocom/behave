// Standalone verification for src/programs.js + src/programContent.js — run with: node scripts/check-programs.mjs
import assert from 'node:assert/strict';
import { PROGRAMS, dayStates, programSummary } from '../src/programs.js';
import { PROGRAM_CONTENT } from '../src/programContent.js';
import { COPING_TECHNIQUES } from '../src/copingToolkit.js';

let passed = 0;
function check(name, fn) {
  fn();
  passed++;
  console.log(`✓ ${name}`);
}

const basics = PROGRAMS.find(p => p.id === 'basics');
const NOW = new Date('2026-10-22T12:00:00').getTime();
const YESTERDAY = NOW - 86400000;

check('a fresh program opens day 1 only', () => {
  assert.deepEqual(dayStates(basics, undefined, NOW), ['current', 'locked', 'locked', 'locked', 'locked', 'locked', 'locked']);
});

check('finishing a day today opens the next one tomorrow', () => {
  assert.deepEqual(dayStates(basics, { completed: { 0: NOW } }, NOW).slice(0, 3), ['done', 'tomorrow', 'locked']);
});

check('a day finished yesterday opens the next one today', () => {
  assert.deepEqual(dayStates(basics, { completed: { 0: YESTERDAY } }, NOW).slice(0, 3), ['done', 'current', 'locked']);
});

check('programSummary reports progress, the next day and completion', () => {
  assert.deepEqual(programSummary(basics, { completed: { 0: YESTERDAY - 86400000, 1: YESTERDAY } }, NOW),
    { done: 2, total: 7, nextIndex: 2, nextState: 'current', finished: false });
  const all = Object.fromEntries(basics.days.map((_, i) => [i, YESTERDAY]));
  assert.deepEqual(programSummary(basics, { completed: all }, NOW), { done: 7, total: 7, nextIndex: null, nextState: null, finished: true });
});

check('written program days reference real coping techniques', () => {
  PROGRAMS.filter(p => p.days).forEach(p => p.days.forEach(id => assert.ok(COPING_TECHNIQUES.some(tc => tc.id === id), `${p.id}: unknown technique ${id}`)));
});

check('every language has the full copy for every program and day', () => {
  ['en', 'fr', 'es'].forEach(lang => {
    const c = PROGRAM_CONTENT[lang];
    PROGRAMS.forEach(p => {
      assert.ok(c[p.id]?.title && c[p.id]?.description, `${lang}.${p.id} missing title/description`);
      if (!p.days) return;
      assert.equal(c[p.id].days.length, p.days.length, `${lang}.${p.id} day count`);
      c[p.id].days.forEach((d, i) => ['title', 'intro', 'practice', 'reflect'].forEach(k => assert.ok(d[k], `${lang}.${p.id}.days[${i}].${k}`)));
    });
  });
});

console.log(`\n${passed} checks passed.`);
