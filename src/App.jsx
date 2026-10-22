import { useState, useEffect, useRef, useCallback, Fragment } from 'react';
import { auth, db } from './firebase';
import {
  onAuthStateChanged, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, signInWithPopup,
  GoogleAuthProvider, EmailAuthProvider, signOut, updateProfile, reauthenticateWithPopup,
  reauthenticateWithCredential, deleteUser,
} from 'firebase/auth';
import {
  collection, addDoc, deleteDoc, doc, onSnapshot,
  query, orderBy, serverTimestamp, setDoc, updateDoc, getDoc, getDocs, writeBatch, deleteField,
} from 'firebase/firestore';
import { UI_LANGS, LOCALE, DEFAULT_VOICE, STRINGS, detectUILang } from './i18n';
import { CSS } from './styles';
import { useToast } from './components/Toast';
import ConfirmSheet from './components/ConfirmSheet';
import LegalSheet from './components/LegalSheet';
import { PRIVACY, TERMS } from './legal';
import { useModalA11y } from './hooks/useModalA11y';
import { registerSW } from 'virtual:pwa-register';
import { matchTags, matchBehavior, getTimeOfDayTag } from './autoTag';
import { suggestTechniques, techniqueForMoment, COPING_TECHNIQUES } from './copingToolkit';
import CopingToolkitModal from './components/CopingToolkitModal';
import { DAYPARTS, suggestDaypart, aggregateThermometer, waterLevelY, levelFromY, levelBand } from './thermometer';
import { CHALLENGES, relevantTagIds, sortBehaviorsByChallenges } from './challenges';
import { buildInsights, triggerCounts } from './insights';
import { PROGRAMS, dayStates, programSummary } from './programs';
import { PROGRAM_CONTENT } from './programContent';

// ── Constants ──────────────────────────────────────────────────────────────────
// Seeded into a new user's own `tags` collection on first load, using these exact
// ids so pre-existing entries (which reference tags by id) keep resolving.
const DEFAULT_TAGS = [
  { id: 'anxiety',       emoji: '😰', color: '#E8956A' },
  { id: 'boredom',       emoji: '😑', color: '#C4A055' },
  { id: 'stress',        emoji: '😤', color: '#D4785A' },
  { id: 'sadness',       emoji: '💙', color: '#6A90C4' },
  { id: 'anger',         emoji: '🔴', color: '#C46858' },
  { id: 'loneliness',    emoji: '🌧', color: '#8A9EC4' },
  { id: 'social',        emoji: '👥', color: '#6BA88A' },
  { id: 'alone',         emoji: '🚶', color: '#9A8AC4' },
  { id: 'work',          emoji: '💼', color: '#5A98A8' },
  { id: 'home',          emoji: '🏠', color: '#7AA870' },
  { id: 'morning',       emoji: '🌅', color: '#C8A040' },
  { id: 'afternoon',     emoji: '☀️', color: '#C48040' },
  { id: 'evening',       emoji: '🌆', color: '#8A7AC4' },
  { id: 'night',         emoji: '🌙', color: '#5060A0' },
  { id: 'replaced',      emoji: '✅', color: '#4A9E68' },
  { id: 'strongcraving', emoji: '🔥', color: '#C45040' },
];
// Context/time tags always seeded; emotion tags are narrowed to the user's onboarding challenges.
const STRUCTURAL_TAG_IDS = ['social', 'alone', 'work', 'home', 'morning', 'afternoon', 'evening', 'night', 'replaced'];
// When, not what — the quick check records the time of day separately (daypart), so these aren't offered there.
const TIME_TAG_IDS = ['morning', 'afternoon', 'evening', 'night'];

// Offered as one-tap picks in the first-login onboarding flow (src/i18n.js → onboarding.behaviors/replacements)
const SUGGESTED_BEHAVIORS = [
  { id: 'smoking', cost: 0.75 }, { id: 'impulseBuying', cost: 20 },
  { id: 'junkFood', cost: 8 }, { id: 'alcohol', cost: 8 },
  { id: 'socialMedia', cost: 0 }, { id: 'videoGames', cost: 0 },
  { id: 'nailBiting', cost: 0 }, { id: 'procrastination', cost: 0 },
];
// Translated onboarding behavior labels in every supported language, used by matchBehavior()
// to recognize a behavior regardless of which language it was originally seeded in.
const ONBOARDING_BEHAVIOR_LABELS = { en: STRINGS.en.onboarding.behaviors, fr: STRINGS.fr.onboarding.behaviors, es: STRINGS.es.onboarding.behaviors };

const LANGS = [
  { code: 'en-US', flag: '🇺🇸', label: 'English (US)' },
  { code: 'en-CA', flag: '🇨🇦', label: 'English (CA)' },
  { code: 'fr-CA', flag: '🇶🇨', label: 'Français (CA)' },
  { code: 'fr-FR', flag: '🇫🇷', label: 'Français (FR)' },
  { code: 'es-ES', flag: '🇪🇸', label: 'Español' },
  { code: 'pt-BR', flag: '🇧🇷', label: 'Português' },
  { code: 'de-DE', flag: '🇩🇪', label: 'Deutsch' },
  { code: 'it-IT', flag: '🇮🇹', label: 'Italiano' },
  { code: 'ja-JP', flag: '🇯🇵', label: '日本語' },
  { code: 'zh-CN', flag: '🇨🇳', label: '中文' },
];

// ── Utils ─────────────────────────────────────────────────────────────────────
function formatTime(ts, locale) {
  return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(new Date(ts));
}
// Local calendar day (YYYY-MM-DD) — toISOString() would file late-evening entries under tomorrow.
function localDayKey(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function formatMoney(n, locale, currency = 'CAD') {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(n || 0);
}
function formatLongDate(ts, locale) {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(new Date(ts));
}
// Calls a Limitless+ serverless function as the signed-in user (see /api).
async function apiPost(path, body = {}) {
  const token = await auth.currentUser.getIdToken();
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}
function groupByDay(entries) {
  const map = {};
  entries.forEach(e => {
    const day = localDayKey(e.timestamp);
    if (!map[day]) map[day] = [];
    map[day].push(e);
  });
  return map;
}
function formatDay(iso, locale) {
  return new Intl.DateTimeFormat(locale, { weekday: 'long', month: 'long', day: 'numeric' })
    .format(new Date(iso + 'T12:00:00'));
}

// ── Icons ─────────────────────────────────────────────────────────────────────
const Ico = ({ d, d2, cx, cy, r, children, size = 22 }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
    strokeLinecap="round" strokeLinejoin="round" width={size} height={size}>
    {d && <path d={d}/>}{d2 && <path d={d2}/>}
    {cx !== undefined && <circle cx={cx} cy={cy} r={r}/>}
    {children}
  </svg>
);
const MicIcon   = () => <Ico d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" d2="M19 10v2a7 7 0 0 1-14 0v-2"><line x1="12" y1="19" x2="12" y2="22" stroke="currentColor"/></Ico>;
const StopIcon  = () => <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22"><rect x="5" y="5" width="14" height="14" rx="3.5"/></svg>;
const BookIcon  = () => <Ico d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" d2="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>;
const HomeIcon  = () => <Ico d="M3 10.5 12 3l9 7.5" d2="M5 9.5V21h14V9.5"><line x1="10" y1="21" x2="10" y2="14" stroke="currentColor"/><line x1="14" y1="21" x2="14" y2="14" stroke="currentColor"/></Ico>;
const ChartIcon = () => <Ico><line x1="18" y1="20" x2="18" y2="10" stroke="currentColor"/><line x1="12" y1="20" x2="12" y2="4" stroke="currentColor"/><line x1="6" y1="20" x2="6" y2="14" stroke="currentColor"/><line x1="2" y1="20" x2="22" y2="20" stroke="currentColor"/></Ico>;
const GearIcon  = () => <Ico d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" d2="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>;
const PlusIcon  = () => <Ico><line x1="12" y1="5" x2="12" y2="19" stroke="currentColor"/><line x1="5" y1="12" x2="19" y2="12" stroke="currentColor"/></Ico>;
const TrashIcon = () => <Ico size={17}><polyline points="3 6 5 6 21 6" stroke="currentColor"/><path d="M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2" stroke="currentColor"/></Ico>;
const PencilIcon = () => <Ico size={16} d="M12 20h9" d2="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>;
const SunIcon   = () => <Ico cx={12} cy={12} r="5"><line x1="12" y1="1" x2="12" y2="3" stroke="currentColor"/><line x1="12" y1="21" x2="12" y2="23" stroke="currentColor"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" stroke="currentColor"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" stroke="currentColor"/><line x1="1" y1="12" x2="3" y2="12" stroke="currentColor"/><line x1="21" y1="12" x2="23" y2="12" stroke="currentColor"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" stroke="currentColor"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" stroke="currentColor"/></Ico>;
const MoonIcon  = () => <Ico d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>;
const CompassIcon = () => <Ico cx={12} cy={12} r="9"><path d="m15.5 8.5-2.2 4.8-4.8 2.2 2.2-4.8z" stroke="currentColor"/></Ico>;
const LogoutIcon= () => <Ico d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" d2="M16 17l5-5-5-5"><line x1="21" y1="12" x2="9" y2="12" stroke="currentColor"/></Ico>;
const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

// ── Wave Sparkline ─────────────────────────────────────────────────────────────
function WaveSparkline({ entries, days = 14 }) {
  const now = Date.now();
  const buckets = Array.from({ length: days }, (_, i) => {
    const s = now - (days - 1 - i) * 86400000;
    return entries.filter(e => e.timestamp >= s && e.timestamp < s + 86400000).length;
  });
  const max = Math.max(...buckets, 1);
  const W = 320, H = 72, pad = 6;
  const step = (W - pad * 2) / (days - 1);
  const pts = buckets.map((v, i) => [pad + i * step, H - pad - 8 - (v / max) * (H - pad * 2 - 16)]);
  const curve = pts.map((p, i) => {
    if (i === 0) return `M${p[0]},${p[1]}`;
    const prev = pts[i - 1], mx = (prev[0] + p[0]) / 2;
    return `C${mx},${prev[1]} ${mx},${p[1]} ${p[0]},${p[1]}`;
  }).join(' ');
  const fill = `${curve} L${pts[pts.length - 1][0]},${H} L${pts[0][0]},${H} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 72, display: 'block' }} preserveAspectRatio="none">
      <defs>
        <linearGradient id="wg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" style={{ stopColor: 'var(--accent)', stopOpacity: 0.3 }}/>
          <stop offset="100%" style={{ stopColor: 'var(--accent)', stopOpacity: 0 }}/>
        </linearGradient>
      </defs>
      <path d={fill} fill="url(#wg)"/>
      <path d={curve} fill="none" style={{ stroke: 'var(--accent)' }} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      {pts.map((p, i) => buckets[i] > 0 && <circle key={i} cx={p[0]} cy={p[1]} r="4" style={{ fill: 'var(--accent)' }} opacity="0.9"/>)}
    </svg>
  );
}

// Soft, abstract water-level metaphor for emotional intensity: a swimmer silhouette at
// the shore, water rising above or sitting below the head as `value` (0-10) increases.
// No face, no distress posture at any value — only the water line communicates intensity.
// With `onChange`, tapping or dragging in the scene sets the level; it's aria-hidden because
// a native range input next to it stays the accessible control.
// One tileable wave, centered on y=0, repeated so the group can slide left forever.
function wavePath(amp, period, width, depth) {
  let d = `M0,0`;
  for (let x = 0; x < width; x += period) {
    d += ` q${period / 4},${-amp} ${period / 2},0 t${period / 2},0`;
  }
  return `${d} L${width},${depth} L0,${depth} Z`;
}

// The signature illustration: the sky darkens, clouds and rain roll in and the
// water rises over the swimmer as the level goes up. Dragging anywhere sets the level.
function SwimScene({ value, onChange, height = 150 }) {
  const svgRef = useRef(null);
  const dragging = useRef(false);
  const W = 300, H = 180;
  const level = value ?? 0;
  const storm = level / 10;
  const waterY = waterLevelY(value);
  const amp = 2.5 + level * 0.55;
  const levelAt = e => {
    const svg = svgRef.current;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    return levelFromY(pt.matrixTransform(svg.getScreenCTM().inverse()).y);
  };
  const handlers = onChange ? {
    onPointerDown: e => { dragging.current = true; e.currentTarget.setPointerCapture?.(e.pointerId); onChange(levelAt(e)); },
    onPointerMove: e => { if (dragging.current) onChange(levelAt(e)); },
    onPointerUp: () => { dragging.current = false; },
    onPointerCancel: () => { dragging.current = false; },
  } : {};
  // The free arm drifts on calm water and reaches up once the head goes under.
  const reach = level >= 7;
  return (
    <svg ref={svgRef} className={`swim-scene${value == null ? ' unset' : ''}`} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true" {...handlers}
      style={{ width: '100%', height, touchAction: onChange ? 'none' : undefined, cursor: onChange ? 'ns-resize' : undefined }}>
      <defs>
        <clipPath id="swim-clip"><rect width={W} height={H} rx="22"/></clipPath>
        <linearGradient id="sky-calm" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--sky-top)"/><stop offset="1" stopColor="var(--sky-bottom)"/></linearGradient>
        <linearGradient id="sky-storm" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--storm-top)"/><stop offset="1" stopColor="var(--storm-bottom)"/></linearGradient>
        <linearGradient id="sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--sea-top)"/><stop offset="1" stopColor="var(--sea-deep)"/></linearGradient>
        <radialGradient id="sun-glow"><stop offset="0.45" stopColor="var(--gold)" stopOpacity="0.55"/><stop offset="1" stopColor="var(--gold)" stopOpacity="0"/></radialGradient>
      </defs>
      <g clipPath="url(#swim-clip)">
        <rect width={W} height={H} fill="url(#sky-calm)"/>
        <rect width={W} height={H} fill="url(#sky-storm)" style={{ opacity: storm, transition: 'opacity 0.5s' }}/>
        <g style={{ opacity: 1 - storm * 0.9, transform: `translateY(${storm * 22}px)`, transition: 'opacity 0.5s, transform 0.5s' }}>
          <circle cx="242" cy="40" r="34" fill="url(#sun-glow)"/>
          <circle cx="242" cy="40" r="15" fill="var(--gold)"/>
        </g>
        <g className="swim-clouds" style={{ opacity: Math.min(1, 0.25 + storm), transition: 'opacity 0.5s' }}>
          <g fill="var(--cloud)" style={{ transform: `translateX(${-30 + storm * 40}px)`, transition: 'transform 0.6s' }}>
            <ellipse cx="70" cy="34" rx="30" ry="11"/><ellipse cx="88" cy="27" rx="18" ry="12"/>
            {level >= 4 && <><ellipse cx="196" cy="24" rx="34" ry="12"/><ellipse cx="214" cy="17" rx="20" ry="12"/></>}
          </g>
        </g>
        {level >= 8 && (
          <g className="swim-rain" stroke="var(--rain)" strokeWidth="1.6" strokeLinecap="round">
            {Array.from({ length: 14 }, (_, i) => <line key={i} x1={12 + i * 21} y1={(i * 37) % 60} x2={8 + i * 21} y2={(i * 37) % 60 + 9} style={{ animationDelay: `${(i % 5) * -0.17}s` }}/>)}
          </g>
        )}
        {/* back swell */}
        <g style={{ transform: `translateY(${waterY - 6}px)`, transition: 'transform 0.45s cubic-bezier(.3,1.3,.5,1)' }}>
          <path className="swim-wave slow" d={wavePath(amp * 0.7, 75, W * 2, 220)} fill="var(--sea-far)"/>
        </g>
        {/* swimmer */}
        <g className="swimmer">
          <path d={reach ? 'M162,82 Q178,58 186,26' : 'M162,84 Q186,80 206,92'} stroke="var(--swimmer)" strokeWidth="9" strokeLinecap="round" fill="none"/>
          <path d="M138,84 Q116,82 96,93" stroke="var(--swimmer)" strokeWidth="9" strokeLinecap="round" fill="none"/>
          <ellipse cx="150" cy="104" rx="21" ry="30" fill="var(--swimmer)"/>
          <path d="M129,98 Q150,90 171,98 L170,118 Q150,126 130,118 Z" fill="var(--swimmer-suit)"/>
          <circle cx="150" cy="60" r="15" fill="var(--swimmer)"/>
          <path d="M135,58 a15,15 0 0 1 30,0 Z" fill="var(--swimmer-cap)"/>
          {level < 7 && <path d={level >= 5 ? 'M145,66 q5,-2 10,0' : 'M144,64 q6,5 12,0'} stroke="var(--swimmer-ink)" strokeWidth="1.8" strokeLinecap="round" fill="none"/>}
        </g>
        {/* front water */}
        <g style={{ transform: `translateY(${waterY}px)`, transition: 'transform 0.45s cubic-bezier(.3,1.3,.5,1)' }}>
          <path className="swim-wave" d={wavePath(amp, 60, W * 2, 220)} fill="url(#sea)" opacity="0.88"/>
          <path className="swim-wave fast" d={wavePath(amp * 0.4, 40, W * 2, 3)} fill="var(--foam)" opacity="0.7"/>
        </g>
        {level >= 7 && (
          <g className="swim-bubbles" fill="var(--foam)">
            <circle cx="140" cy="70" r="2.5"/><circle cx="156" cy="62" r="3.5" style={{ animationDelay: '-0.6s' }}/><circle cx="148" cy="54" r="2" style={{ animationDelay: '-1.1s' }}/>
          </g>
        )}
        <path d={`M0,${H} L0,${H - 12} Q75,${H - 22} 150,${H - 14} T${W},${H - 16} L${W},${H} Z`} fill="var(--sand)"/>
        {onChange && (
          <g className="swim-handle" style={{ transform: `translate(${W - 26}px, ${waterY}px)`, transition: 'transform 0.45s cubic-bezier(.3,1.3,.5,1)' }}>
            <circle r="13" fill="var(--surface)" stroke="var(--water)" strokeWidth="2.5"/>
            <path d="M-4,-3 L0,-7 L4,-3 M-4,3 L0,7 L4,3" stroke="var(--water)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
          </g>
        )}
      </g>
    </svg>
  );
}

// ── Emotion tags (also the thermometer's traits) ──────────────────────────────
const EMOTION_TAGS = ['anxiety', 'stress', 'sadness', 'anger', 'loneliness', 'boredom', 'strongcraving'];

// ── Thermometer Grid (average intensity per trait × daypart, 14 days) ─────────
function ThermometerGrid({ moodChecks, traitIds, tagMap, dayparts, t }) {
  const data = aggregateThermometer(moodChecks, traitIds);
  const activeTraits = traitIds.filter(id => tagMap[id] && dayparts.some(dp => data[id][dp] != null));
  if (activeTraits.length === 0) return null;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `76px repeat(${dayparts.length}, 1fr)`, rowGap: 7, columnGap: 4, alignItems: 'center' }}>
      <div/>
      {dayparts.map(dp => <div key={dp} className="thermo-grid-head">{t.dayparts[dp]}</div>)}
      {activeTraits.map(tid => {
        const tg = tagMap[tid];
        return (
          <Fragment key={tid}>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 6 }}>
              {tg.emoji} {tg.label}
            </div>
            {dayparts.map(dp => {
              const v = data[tid][dp];
              return (
                <div key={dp} className="thermo-cell" title={v != null ? `${v.toFixed(1)}/10` : ''} style={{
                  background: v != null ? tg.color : 'var(--surface2)',
                  opacity: v != null ? 0.3 + 0.7 * (v / 10) : 1,
                  border: v != null ? 'none' : '1px solid var(--border)',
                }}/>
              );
            })}
          </Fragment>
        );
      })}
    </div>
  );
}

// ── CSS ────────────────────────────────────────────────────────────────────────

// ── Auth Screen ────────────────────────────────────────────────────────────────
function AuthScreen({ t, uiLang, onLegal }) {
  const [mode, setMode]         = useState('login');
  const [name, setName]         = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  // The water gently rises and settles behind the wordmark: the whole idea of the app in one loop.
  const [demoLevel, setDemoLevel] = useState(3);
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;
    const steps = [3, 5, 7, 5, 3, 2];
    let i = 0;
    const id = setInterval(() => { i = (i + 1) % steps.length; setDemoLevel(steps[i]); }, 1800);
    return () => clearInterval(id);
  }, []);

  const AUTH_ERR_KEYS = {
    'auth/wrong-password': 'authWrongPw', 'auth/invalid-credential': 'authInvalidCred',
    'auth/user-not-found': 'authNotFound', 'auth/email-already-in-use': 'authEmailInUse',
    'auth/weak-password': 'authWeakPw', 'auth/invalid-email': 'authInvalidEmail',
    'auth/popup-closed-by-user': 'authPopupClosed', 'auth/popup-blocked': 'authPopupBlocked',
  };
  const authErr = (err) => t[AUTH_ERR_KEYS[err.code]] || t.toastError;

  async function handleEmail(e) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      if (mode === 'login') {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        const displayName = name.trim() || email.split('@')[0];
        await updateProfile(cred.user, { displayName });
        await setDoc(doc(db, 'users', cred.user.uid), { name: displayName, currency: uiLang === 'es' ? 'EUR' : 'CAD', createdAt: serverTimestamp() });
      }
    } catch (err) {
      setError(authErr(err));
    } finally { setLoading(false); }
  }

  async function handleGoogle() {
    setError(''); setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const cred = await signInWithPopup(auth, provider);
      await setDoc(doc(db, 'users', cred.user.uid), { name: cred.user.displayName || 'User', currency: uiLang === 'es' ? 'EUR' : 'CAD', createdAt: serverTimestamp() }, { merge: true });
    } catch (err) {
      setError(authErr(err));
    } finally { setLoading(false); }
  }

  return (
    <div className="auth-screen">
      <div className="auth-scene"><SwimScene value={demoLevel} height={190}/></div>
      <div className="auth-wordmark"><span className="limit">Limit</span><span className="less">less</span></div>
      <div className="auth-tagline">{t.authPitch}</div>
      <ul className="auth-points">
        {t.authPoints.map(([icon, text]) => <li key={text}><span aria-hidden="true">{icon}</span>{text}</li>)}
      </ul>

      <div className="auth-card">
        <button className="btn btn-google btn-full" onClick={handleGoogle} disabled={loading} style={{ marginBottom: 4 }}>
          <GoogleIcon/> {t.continueGoogle}
        </button>
        <div className="divider">{t.or}</div>

        {error && <div className="error-msg">{error}</div>}

        <form onSubmit={handleEmail}>
          {mode === 'signup' && (
            <div className="field">
              <label>{t.name}</label>
              <input type="text" placeholder={t.namePh} value={name} onChange={e => setName(e.target.value)} autoComplete="name"/>
            </div>
          )}
          <div className="field">
            <label>{t.email}</label>
            <input type="email" placeholder={t.emailPh} value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email"/>
          </div>
          <div className="field" style={{ marginBottom: 20 }}>
            <label>{t.password}</label>
            <input type="password" placeholder={mode === 'signup' ? t.passwordPhSignup : t.passwordPlaceholder} value={password} onChange={e => setPassword(e.target.value)} required autoComplete={mode === 'login' ? 'current-password' : 'new-password'}/>
          </div>
          <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
            {loading ? '…' : mode === 'login' ? t.signIn : t.createAccount}
          </button>
        </form>
      </div>

      <div className="auth-toggle">
        {mode === 'login' ? <>{t.noAccount}<button type="button" onClick={() => { setMode('signup'); setError(''); }}>{t.createOne}</button></> : <>{t.haveAccount}<button type="button" onClick={() => { setMode('login'); setError(''); }}>{t.signInLink}</button></>}
      </div>
      <div className="legal-links">
        {t.legalAgreement}. <button onClick={() => onLegal('terms')}>{t.terms}</button> · <button onClick={() => onLegal('privacy')}>{t.privacy}</button>
      </div>
    </div>
  );
}

// ── Main App ───────────────────────────────────────────────────────────────────
export default function App() {
  const [themeMode, setThemeMode] = useState(() => localStorage.getItem('behave_theme') || 'system');
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem('behave_theme');
    return saved === 'dark' || (saved !== 'light' && window.matchMedia?.('(prefers-color-scheme: dark)').matches);
  });
  const [uiLang,    setUiLang]    = useState(() => localStorage.getItem('behave_uilang') || detectUILang());
  const [user,      setUser]      = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [behaviors, setBehaviors] = useState([]);
  const [entries,   setEntries]   = useState([]);
  const [tags,      setTags]      = useState([]);
  const [tagsLoaded,setTagsLoaded]= useState(false);
  const [userProfile,  setUserProfile]  = useState(null);
  const [profileLoaded,setProfileLoaded]= useState(false);
  const [recLang,   setRecLang]   = useState(() => localStorage.getItem('behave_voicelang') || DEFAULT_VOICE[localStorage.getItem('behave_uilang') || detectUILang()]);
  const [view,      setView]      = useState('today');
  const [recording, setRecording] = useState(false);
  const [transcript,setTranscript]= useState('');
  const [recErr,    setRecErr]    = useState('');
  const [showEntry, setShowEntry] = useState(false);
  const [showNewB,  setShowNewB]  = useState(false);
  const [entryForm, setEntryForm] = useState({ behaviorId: '', tags: [], replacement: '', note: '' });
  const [newBForm,  setNewBForm]  = useState({ label: '', cost: '' });
  const [editingEntryId,    setEditingEntryId]    = useState(null);
  const [editingBehaviorId, setEditingBehaviorId]  = useState(null);
  const [showNewTag,   setShowNewTag]   = useState(false);
  const [newTagForm,   setNewTagForm]   = useState({ label: '', emoji: '🏷️', color: '#6B9E8A' });
  const [editingTagId, setEditingTagId] = useState(null);
  const [checkinTags,     setCheckinTags]     = useState([]);
  const [checkinBehavior, setCheckinBehavior] = useState('');
  const [checkinSaved,    setCheckinSaved]    = useState(false);
  const [onbStep,         setOnbStep]         = useState(1);
  const [onbBehaviors,    setOnbBehaviors]    = useState([]);
  const [onbCustomBehavior,   setOnbCustomBehavior]   = useState('');
  const [onbSaving,       setOnbSaving]       = useState(false);
  const [onbChallengeStage, setOnbChallengeStage] = useState('list');
  const [onbQuizIndex,    setOnbQuizIndex]    = useState(0);
  const [onbChallenges,   setOnbChallenges]   = useState([]);
  const [onbDiagnosisNote, setOnbDiagnosisNote] = useState('');
  const [showOnbDiagnosis, setShowOnbDiagnosis] = useState(false);
  const [showSettingsDiagnosis, setShowSettingsDiagnosis] = useState(false);
  const [diagnosisDraft,  setDiagnosisDraft]  = useState('');
  const [autoTagIds,        setAutoTagIds]        = useState([]);
  const [dismissedAutoTags, setDismissedAutoTags] = useState([]);
  const [behaviorAutoFilled,setBehaviorAutoFilled] = useState(false);
  const [expandedTechnique, setExpandedTechnique]  = useState(null);
  const [showCopingToolkit, setShowCopingToolkit]  = useState(false);
  const [moodChecks,    setMoodChecks]    = useState([]);
  const [entitlement,   setEntitlement]   = useState(null);
  const [billing,       setBilling]       = useState(null);
  const [plan,          setPlan]          = useState('yearly');
  const [billingBusy,   setBillingBusy]   = useState(null);
  const [accessCode,    setAccessCode]    = useState('');
  const [codeError,     setCodeError]     = useState('');
  const [openDay,       setOpenDay]       = useState(null);
  const [dayReflection, setDayReflection] = useState('');
  const [savingDay,     setSavingDay]     = useState(false);
  const [thermoDaypart, setThermoDaypart] = useState(() => suggestDaypart());
  const [thermoLevel, setThermoLevel] = useState(null);
  const [showContext, setShowContext] = useState(false);
  const [showDayparts, setShowDayparts] = useState(false);
  const [showVoiceLangs, setShowVoiceLangs] = useState(false);
  const [showEntryContext, setShowEntryContext] = useState(false);
  const [fBehavior, setFBehavior] = useState('all');
  const [fTag,      setFTag]      = useState('all');
  const [confirmAction, setConfirmAction] = useState(null);
  const [showLegal, setShowLegal] = useState(null);
  const [deleteWord, setDeleteWord] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteNeedsReauth, setDeleteNeedsReauth] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [resettingApp, setResettingApp] = useState(false);
  const { toast } = useToast();
  const recRef = useRef(null);
  const latestRef = useRef({ toast, t: null });

  // ── Auth listener ────────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => { setUser(u); setAuthReady(true); }, err => {
      console.error('Auth listener failed:', err);
      setAuthReady(true);
      toast(STRINGS[uiLang].toastError, 'error');
    });
    return unsub;
  }, [toast, uiLang]);

  // ── Firestore listeners ──────────────────────────────────────────────────
  useEffect(() => {
    if (!user) { setBehaviors([]); setEntries([]); setTags([]); setTagsLoaded(false); setUserProfile(null); setProfileLoaded(false); setMoodChecks([]); return; }
    const bRef = collection(db, 'users', user.uid, 'behaviors');
    const eRef = query(collection(db, 'users', user.uid, 'entries'), orderBy('timestamp', 'desc'));
    const tRef = collection(db, 'users', user.uid, 'tags');
    const uRef = doc(db, 'users', user.uid);
    const mRef = collection(db, 'users', user.uid, 'moodChecks');
    const onListenerError = (name, err) => {
      console.error(`${name} listener failed:`, err);
      toast(STRINGS[uiLang].toastError, 'error');
    };
    const unsubB = onSnapshot(bRef, snap => setBehaviors(snap.docs.map(d => ({ id: d.id, ...d.data() }))), err => onListenerError('Behavior', err));
    const unsubE = onSnapshot(eRef, snap => setEntries(snap.docs.map(d => ({ id: d.id, ...d.data() }))), err => onListenerError('Entry', err));
    const unsubT = onSnapshot(tRef, snap => { setTags(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setTagsLoaded(true); }, err => onListenerError('Tag', err));
    const unsubU = onSnapshot(uRef, snap => { setUserProfile(snap.exists() ? snap.data() : {}); setProfileLoaded(true); }, err => onListenerError('Profile', err));
    const unsubM = onSnapshot(mRef, snap => setMoodChecks(snap.docs.map(d => ({ id: d.id, ...d.data() }))), err => onListenerError('Mood check', err));
    // Written only by trusted server code (see firestore.rules); a missing doc or a
    // permission error just means "not premium", never an error to surface.
    const unsubP = onSnapshot(doc(db, 'entitlements', user.uid), snap => setEntitlement(snap.exists() ? snap.data() : null), () => setEntitlement(null));
    return () => { unsubB(); unsubE(); unsubT(); unsubU(); unsubM(); unsubP(); };
  }, [toast, uiLang, user?.uid]);

  // ── Seed default tags once, for accounts that skip onboarding without picking any ──
  useEffect(() => {
    if (!user || !tagsLoaded || tags.length > 0 || !profileLoaded || !userProfile?.onboarded) return;
    (async () => {
      const uRef = doc(db, 'users', user.uid);
      try {
        const uSnap = await getDoc(uRef);
        if (uSnap.exists() && uSnap.data().tagsSeeded) return;
        const challengeTags = relevantTagIds(userProfile?.challenges);
        const seedIds = new Set([...STRUCTURAL_TAG_IDS, ...(challengeTags.length ? challengeTags : EMOTION_TAGS)]);
        await Promise.all(DEFAULT_TAGS.filter(tg => seedIds.has(tg.id)).map(tg => setDoc(doc(db, 'users', user.uid, 'tags', tg.id), {
          label: STRINGS[uiLang].tags[tg.id] || tg.id, emoji: tg.emoji, color: tg.color, createdAt: serverTimestamp(),
        })));
        await setDoc(uRef, { tagsSeeded: true }, { merge: true });
      } catch (err) {
        console.error('Tag seeding failed:', err);
        toast(t.toastError, 'error');
      }
    })();
  }, [toast, uiLang, user, tagsLoaded, tags.length, profileLoaded, userProfile?.onboarded, userProfile?.challenges]);

  // ── Dark mode ────────────────────────────────────────────────────────────
  useEffect(() => {
    localStorage.setItem('behave_theme', themeMode);
    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    const apply = () => setDark(themeMode === 'dark' || (themeMode === 'system' && !!media?.matches));
    apply();
    if (themeMode !== 'system' || !media) return undefined;
    media.addEventListener?.('change', apply);
    return () => media.removeEventListener?.('change', apply);
  }, [themeMode]);
  useEffect(() => { document.body.style.background = dark ? '#071C2E' : '#D6EEF7'; }, [dark]);

  // ── i18n ──────────────────────────────────────────────────────────────────
  const t = STRINGS[uiLang];
  const locale = LOCALE[uiLang];
  const currency = userProfile?.currency || (uiLang === 'es' ? 'EUR' : 'CAD');
  const currencies = ['CAD', 'USD', 'EUR', 'GBP', 'CHF', 'AUD', 'MXN', 'BRL'];
  latestRef.current = { toast, t };
  useEffect(() => {
    registerSW({
      immediate: true,
      onNeedRefresh: () => {
        const { toast: showToast, t: latestStrings } = latestRef.current;
        showToast(`${latestStrings.updateAvailable} — ${latestStrings.reloadToUpdate}`, 'info');
      },
    });
  }, []);
  useEffect(() => { localStorage.setItem('behave_uilang', uiLang); document.documentElement.lang = uiLang; }, [uiLang]);
  useEffect(() => { localStorage.setItem('behave_voicelang', recLang); }, [recLang]);
  const TAG_MAP = Object.fromEntries(tags.map(tg => [tg.id, tg]));
  const isPremium = entitlement?.premium === true && (!entitlement.expiresAt || entitlement.expiresAt > Date.now());
  const programProgress = userProfile?.programProgress || {};

  // ── Limitless+ (Stripe + clinic codes) ────────────────────────────────────
  // Until the server is configured, /api/billing-status says so (or doesn't exist) and the
  // screen keeps showing "Available soon".
  useEffect(() => {
    if (view !== 'premium' || billing) return;
    fetch('/api/billing-status')
      .then(r => (r.ok ? r.json() : null))
      .then(data => setBilling(data && typeof data === 'object' ? data : { checkout: false, codes: false }))
      .catch(() => setBilling({ checkout: false, codes: false }));
  }, [view, billing]);

  // Returning from Stripe Checkout or the billing portal.
  useEffect(() => {
    if (!user) return;
    const params = new URLSearchParams(window.location.search);
    const result = params.get('premium');
    if (!result) return;
    params.delete('premium');
    window.history.replaceState(null, '', `${window.location.pathname}${params.size ? `?${params}` : ''}${window.location.hash}`);
    if (result === 'success') { setView('premium'); toast(t.checkoutSuccess, 'success'); }
    else if (result === 'cancel') toast(t.checkoutCancel, 'info');
    else if (result === 'portal') setView('premium');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  const startCheckout = async () => {
    setBillingBusy('checkout');
    try {
      const { ok, data } = await apiPost('/api/create-checkout-session', { plan });
      if (ok && data.url) { window.location.assign(data.url); return; }
      toast(data.error === 'alreadyPremium' ? t.codeErrors.alreadyPremium : t.toastError, 'error');
    } catch (err) {
      console.error('Checkout failed:', err);
      toast(t.toastError, 'error');
    }
    setBillingBusy(null);
  };

  const openBillingPortal = async () => {
    setBillingBusy('portal');
    try {
      const { ok, data } = await apiPost('/api/create-portal-session');
      if (ok && data.url) { window.location.assign(data.url); return; }
      toast(t.toastError, 'error');
    } catch (err) {
      console.error('Billing portal failed:', err);
      toast(t.toastError, 'error');
    }
    setBillingBusy(null);
  };

  const redeemCode = async e => {
    e.preventDefault();
    if (!accessCode.trim()) return;
    setBillingBusy('code');
    setCodeError('');
    try {
      const { ok, data } = await apiPost('/api/redeem-code', { code: accessCode });
      if (ok) { setAccessCode(''); toast(t.codeRedeemed, 'success'); }
      else if (t.codeErrors[data.reason]) setCodeError(t.codeErrors[data.reason]);
      else toast(t.toastError, 'error');
    } catch (err) {
      console.error('Code redemption failed:', err);
      toast(t.toastError, 'error');
    }
    setBillingBusy(null);
  };
  const programCopy = PROGRAM_CONTENT[uiLang];

  // ── Onboarding (first login: suggest behaviors & replacement tags) ─────────
  const showOnboarding = !!user && profileLoaded && !userProfile?.onboarded && behaviors.length === 0 && entries.length === 0;
  const existingBehaviorLabels = new Set(behaviors.map(b => b.label));
  const onbSuggestedBehaviors = sortBehaviorsByChallenges(
    SUGGESTED_BEHAVIORS.filter(s => !existingBehaviorLabels.has(t.onboarding.behaviors[s.id])),
    onbChallenges,
  );
  const toggleOnbBehavior = id => setOnbBehaviors(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  const toggleOnbChallenge = id => setOnbChallenges(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  function answerQuiz(yes) {
    const id = CHALLENGES[onbQuizIndex].id;
    setOnbChallenges(p => yes ? (p.includes(id) ? p : [...p, id]) : p.filter(x => x !== id));
    // After the last question, land back on the (now pre-filled) list to review — never auto-finalize.
    if (onbQuizIndex === CHALLENGES.length - 1) setOnbChallengeStage('list');
    else setOnbQuizIndex(i => i + 1);
  }
  function quizBack() {
    if (onbQuizIndex > 0) setOnbQuizIndex(i => i - 1);
    else setOnbChallengeStage('list');
  }
  function resetOnboardingForm() {
    setOnbStep(1);
    setOnbBehaviors([]); setOnbCustomBehavior('');
    setOnbChallengeStage('list'); setOnbQuizIndex(0); setOnbChallenges([]);
    setOnbDiagnosisNote(''); setShowOnbDiagnosis(false);
  }
  async function skipOnboarding() {
    if (!user) return;
    resetOnboardingForm();
    try { await setDoc(doc(db, 'users', user.uid), { onboarded: true }, { merge: true }); }
    catch (err) { console.error('Onboarding skip failed:', err); toast(t.toastError, 'error'); }
  }
  async function finishOnboarding() {
    if (!user) return;
    setOnbSaving(true);
    try {
      const writes = onbBehaviors.map(id => {
        const sugg = SUGGESTED_BEHAVIORS.find(s => s.id === id);
        return addDoc(collection(db, 'users', user.uid, 'behaviors'), {
          label: t.onboarding.behaviors[id] || id, cost: sugg?.cost || 0, createdAt: serverTimestamp(),
        });
      });
      if (onbCustomBehavior.trim()) {
        writes.push(addDoc(collection(db, 'users', user.uid, 'behaviors'), {
          label: onbCustomBehavior.trim(), cost: 0, createdAt: serverTimestamp(),
        }));
      }
      await Promise.all(writes);
      // Default tags are seeded by the fallback effect once onboarded=true, narrowed to these
      // challenges' emotion tags; favoriteReplacements fills in later from the Coping Toolkit.
      const note = onbDiagnosisNote.trim();
      await setDoc(doc(db, 'users', user.uid), {
        onboarded: true, challenges: onbChallenges, ...(note ? { diagnosisNote: note } : {}),
      }, { merge: true });
      const hadSelfHarm = onbChallenges.includes('selfHarmUrges');
      resetOnboardingForm();
      if (hadSelfHarm) toast(t.onboarding.selfHarmNote, 'info');
    } catch (err) {
      console.error('Onboarding save failed:', err);
      toast(t.toastError, 'error');
    } finally {
      setOnbSaving(false);
    }
  }

  // ── Behaviors ─────────────────────────────────────────────────────────────
  function openNewBehavior() { setEditingBehaviorId(null); setNewBForm({ label: '', cost: '' }); setShowNewB(true); }
  function openEditBehavior(b) { setEditingBehaviorId(b.id); setNewBForm({ label: b.label, cost: b.cost ? String(b.cost) : '' }); setShowNewB(true); }
  function closeNewBehavior() { setShowNewB(false); setEditingBehaviorId(null); setNewBForm({ label: '', cost: '' }); }
  async function saveBehavior() {
    if (!newBForm.label.trim() || !user) return;
    const data = { label: newBForm.label.trim(), cost: parseFloat(newBForm.cost) || 0 };
    try {
      if (editingBehaviorId) {
        await updateDoc(doc(db, 'users', user.uid, 'behaviors', editingBehaviorId), data);
      } else {
        await addDoc(collection(db, 'users', user.uid, 'behaviors'), { ...data, createdAt: serverTimestamp() });
      }
      closeNewBehavior();
      toast(t.saved, 'success');
    } catch (err) {
      console.error('Behavior save failed:', err);
      toast(t.toastError, 'error');
    }
  }
  async function delBehavior(id) {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'behaviors', id));
      toast(t.deleted, 'success');
    } catch (err) {
      console.error('Behavior delete failed:', err);
      toast(t.toastError, 'error');
    }
  }

  // ── Tags ──────────────────────────────────────────────────────────────────
  function openNewTag() { setEditingTagId(null); setNewTagForm({ label: '', emoji: '🏷️', color: '#6B9E8A' }); setShowNewTag(true); }
  function openEditTag(tg) { setEditingTagId(tg.id); setNewTagForm({ label: tg.label, emoji: tg.emoji, color: tg.color }); setShowNewTag(true); }
  function closeNewTag() { setShowNewTag(false); setEditingTagId(null); setNewTagForm({ label: '', emoji: '🏷️', color: '#6B9E8A' }); }
  async function saveTag() {
    if (!newTagForm.label.trim() || !user) return;
    const data = { label: newTagForm.label.trim(), emoji: newTagForm.emoji.trim() || '🏷️', color: newTagForm.color };
    try {
      if (editingTagId) {
        await updateDoc(doc(db, 'users', user.uid, 'tags', editingTagId), data);
      } else {
        await addDoc(collection(db, 'users', user.uid, 'tags'), { ...data, createdAt: serverTimestamp() });
      }
      closeNewTag();
      toast(t.saved, 'success');
    } catch (err) {
      console.error('Tag save failed:', err);
      toast(t.toastError, 'error');
    }
  }
  async function delTag(id) {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'tags', id));
      toast(t.deleted, 'success');
    } catch (err) {
      console.error('Tag delete failed:', err);
      toast(t.toastError, 'error');
    }
  }

  // ── Recording ─────────────────────────────────────────────────────────────
  const startRec = useCallback(() => {
    setRecErr(''); setShowEntry(true);
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setRecErr(t.micBrowser); return; }
    const rec = new SR();
    rec.lang = recLang; rec.continuous = true; rec.interimResults = true;
    rec.onresult = e => setTranscript(Array.from(e.results).map(r => r[0].transcript).join(' '));
    const MIC_ERR_KEYS = { 'not-allowed': 'micDenied', 'no-speech': 'micNoSpeech', 'network': 'micNetwork', 'audio-capture': 'micNotFound', 'service-not-allowed': 'micUnavailable' };
    rec.onerror  = e => { if (e.error === 'aborted') { setRecording(false); return; } const msg = t[MIC_ERR_KEYS[e.error]] || `Error: ${e.error}`; setRecErr(msg); setRecording(false); };
    rec.onend    = () => setRecording(false);
    try { rec.start(); recRef.current = rec; setRecording(true); }
    catch (err) { setRecErr(t.micStartFail(err.message)); }
  }, [recLang, uiLang]);

  const stopRec = useCallback(() => { recRef.current?.stop(); setRecording(false); }, []);

  // ── Save entry ────────────────────────────────────────────────────────────
  function openEditEntry(entry) {
    setEditingEntryId(entry.id);
    setTranscript(entry.transcript || '');
    setEntryForm({ behaviorId: entry.behaviorId || '', tags: entry.tags || [], replacement: entry.replacement || '', note: entry.note || '' });
    setRecErr(''); setShowEntry(true);
  }
  // "+ Add details" from the quick-check card: hand off its tags/behavior into a full
  // entry draft (voice/text + note) instead of duplicating the recording UI inline.
  function openQuickDetails() {
    setEditingEntryId(null);
    setTranscript('');
    setEntryForm({ behaviorId: checkinBehavior, tags: checkinTags, replacement: '', note: '' });
    setCheckinTags([]); setCheckinBehavior(''); setThermoLevel(null);
    setRecErr(''); setShowEntry(true);
  }
  async function saveEntry() {
    if (!entryForm.behaviorId || !transcript.trim() || !user) return;
    const data = {
      behaviorId: entryForm.behaviorId, transcript: transcript.trim(),
      tags: entryForm.tags, replacement: entryForm.replacement, note: entryForm.note,
    };
    try {
      if (editingEntryId) {
        await updateDoc(doc(db, 'users', user.uid, 'entries', editingEntryId), data);
      } else {
        await addDoc(collection(db, 'users', user.uid, 'entries'), { ...data, timestamp: Date.now(), createdAt: serverTimestamp() });
      }
      closeEntry();
      toast(t.saved, 'success');
    } catch (err) {
      console.error('Entry save failed:', err);
      toast(t.toastError, 'error');
    }
  }
  async function delEntry(id) {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'entries', id));
      toast(t.deleted, 'success');
    } catch (err) {
      console.error('Entry delete failed:', err);
      toast(t.toastError, 'error');
    }
  }
  // Unified quick-check save: tags → a lightweight `entries` doc (same shape the old
  // check-in card wrote), a touched water level → a `moodChecks` doc. Either, both,
  // or neither can fire from one Save tap — the journal and Insights read the same
  // collections as before, so nothing downstream needs to change. The swim scene shows
  // one combined water level, but it's broadcast to every active emotion tag's rating
  // on save so the Stats grid keeps its per-emotion detail exactly as before.
  async function saveQuickCheck() {
    const hasTags = checkinTags.length > 0;
    const activeEmotionIds = checkinTags.filter(id => EMOTION_TAGS.includes(id) && TAG_MAP[id]);
    const hasRatings = thermoLevel != null;
    if ((!hasTags && !hasRatings) || !user) return;
    try {
      const writes = [];
      if (hasTags) {
        writes.push(addDoc(collection(db, 'users', user.uid, 'entries'), {
          behaviorId: checkinBehavior || null, timestamp: Date.now(),
          transcript: '', tags: checkinTags, replacement: '', note: '',
          type: 'checkin', createdAt: serverTimestamp(),
        }));
      }
      if (hasRatings) {
        // No emotion picked: keep the reading as "overall" so the level still counts in Insights.
        const ratings = activeEmotionIds.length ? Object.fromEntries(activeEmotionIds.map(id => [id, thermoLevel])) : { overall: thermoLevel };
        writes.push(addDoc(collection(db, 'users', user.uid, 'moodChecks'), {
          timestamp: Date.now(), daypart: thermoDaypart, ratings, createdAt: serverTimestamp(),
        }));
      }
      await Promise.all(writes);
      setCheckinTags([]); setCheckinBehavior(''); setThermoLevel(null); setShowDayparts(false);
      setCheckinSaved(true);
      setTimeout(() => setCheckinSaved(false), 2000);
      toast(t.saved, 'success');
    } catch (err) {
      console.error('Quick check save failed:', err);
      toast(t.toastError, 'error');
    }
  }
  const requestConfirmation = (kind, id) => setConfirmAction({ kind, id });
  async function resetAppData() {
    if (!user) return;
    setResettingApp(true);
    try {
      for (const name of ['behaviors', 'tags', 'entries', 'moodChecks']) {
        const snap = await getDocs(collection(db, 'users', user.uid, name));
        for (let i = 0; i < snap.docs.length; i += 400) {
          const batch = writeBatch(db);
          snap.docs.slice(i, i + 400).forEach(item => batch.delete(item.ref));
          await batch.commit();
        }
      }
      await setDoc(doc(db, 'users', user.uid), { onboarded: false, favoriteReplacements: [], tagsSeeded: false, challenges: [], diagnosisNote: '', programProgress: deleteField() }, { merge: true });
      setConfirmAction(null);
      setView('today');
      toast(t.appReset, 'success');
    } catch (err) {
      console.error('App reset failed:', err);
      toast(t.toastError, 'error');
    } finally {
      setResettingApp(false);
    }
  }
  async function deleteAccountData(allowReauth = true) {
    if (!user) return;
    setDeletingAccount(true);
    try {
      for (const name of ['behaviors', 'tags', 'entries', 'moodChecks']) {
        const snap = await getDocs(collection(db, 'users', user.uid, name));
        for (let i = 0; i < snap.docs.length; i += 400) {
          const batch = writeBatch(db);
          snap.docs.slice(i, i + 400).forEach(item => batch.delete(item.ref));
          await batch.commit();
        }
      }
      await deleteDoc(doc(db, 'users', user.uid));
      await deleteUser(auth.currentUser);
      resetDeleteAccount();
      toast(t.accountDeleted, 'success');
    } catch (err) {
      if (err.code === 'auth/requires-recent-login') {
        if (!allowReauth) {
          console.error('Account deletion still requires recent login after reauthentication:', err);
          toast(t.toastError, 'error');
          return;
        }
        const providerIds = auth.currentUser?.providerData?.map(provider => provider.providerId) || [];
        if (providerIds.includes('google.com')) {
          try {
            await reauthenticateWithPopup(auth.currentUser, new GoogleAuthProvider());
            await deleteAccountData(false);
          } catch (reauthError) {
            console.error('Google reauthentication failed:', reauthError);
            toast(t.toastError, 'error');
          }
        } else {
          setDeleteNeedsReauth(true);
          toast(t.reauthPassword, 'info');
        }
      } else {
        console.error('Account deletion failed:', err);
        toast(t.toastError, 'error');
      }
    } finally {
      setDeletingAccount(false);
    }
  }
  async function confirmAccountDeletion() {
    if (deleteWord !== t.deleteConfirmWord || !user) return;
    setDeletingAccount(true);
    try {
      const providerIds = auth.currentUser?.providerData?.map(provider => provider.providerId) || [];
      if (providerIds.includes('google.com')) {
        await reauthenticateWithPopup(auth.currentUser, new GoogleAuthProvider());
      } else if (providerIds.includes('password')) {
        await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, deletePassword));
        setDeleteNeedsReauth(false);
      }
      await deleteAccountData(false);
    } catch (err) {
      console.error('Account reauthentication failed:', err);
      toast(t.toastError, 'error');
    } finally {
      setDeletingAccount(false);
    }
  }
  function resetDeleteAccount() {
    setConfirmAction(null);
    setDeleteWord('');
    setDeletePassword('');
    setDeleteNeedsReauth(false);
  }
  function downloadFile(content, type, filename) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const link = document.createElement('a');
    link.href = url; link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast(t.exported, 'success');
  }
  function exportJson() {
    const payload = {
      exportedAt: new Date().toISOString(), version: 1,
      profile: userProfile || {}, behaviors, tags, entries, moodChecks,
    };
    downloadFile(JSON.stringify(payload, null, 2), 'application/json', `limitless-export-${new Date().toISOString().slice(0, 10)}.json`);
  }
  function csvField(value) {
    const text = value == null ? '' : String(value);
    return /[,"\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }
  function exportCsv() {
    const rows = [['timestamp ISO', 'behavior label', 'transcript', 'replacement', 'note', 'tags joined by ;', 'type']];
    entries.forEach(entry => rows.push([
      new Date(entry.timestamp).toISOString(),
      behaviors.find(item => item.id === entry.behaviorId)?.label || '',
      entry.transcript || '', entry.replacement || '', entry.note || '',
      (entry.tags || []).map(id => TAG_MAP[id]?.label || id).join(';'), entry.type || '',
    ]));
    downloadFile(rows.map(row => row.map(csvField).join(',')).join('\n'), 'text/csv;charset=utf-8', `limitless-export-${new Date().toISOString().slice(0, 10)}.csv`);
  }
  async function signOutUser() {
    try {
      await signOut(auth);
    } catch (err) {
      console.error('Sign out failed:', err);
      toast(t.toastError, 'error');
    }
  }
  async function saveCurrency(nextCurrency) {
    if (!user) return;
    try {
      await setDoc(doc(db, 'users', user.uid), { currency: nextCurrency }, { merge: true });
      toast(t.saved, 'success');
    } catch (err) {
      console.error('Currency save failed:', err);
      toast(t.toastError, 'error');
    }
  }
  async function toggleStreakEnabled() {
    if (!user) return;
    try {
      await setDoc(doc(db, 'users', user.uid), { streakEnabled: !userProfile?.streakEnabled }, { merge: true });
    } catch (err) {
      console.error('Streak toggle failed:', err);
      toast(t.toastError, 'error');
    }
  }
  // Editing challenges later only re-orders the Coping Toolkit — tags are user-owned once
  // seeded, so this never adds or removes any.
  async function toggleProfileChallenge(id) {
    if (!user) return;
    const current = userProfile?.challenges || [];
    const next = current.includes(id) ? current.filter(c => c !== id) : [...current, id];
    try {
      await setDoc(doc(db, 'users', user.uid), { challenges: next }, { merge: true });
    } catch (err) {
      console.error('Challenge toggle failed:', err);
      toast(t.toastError, 'error');
    }
  }
  async function saveDiagnosisNote() {
    if (!user) return;
    try {
      await setDoc(doc(db, 'users', user.uid), { diagnosisNote: diagnosisDraft.trim() }, { merge: true });
      toast(t.saved, 'success');
    } catch (err) {
      console.error('Diagnosis note save failed:', err);
      toast(t.toastError, 'error');
    }
  }
  // ── Programs ────────────────────────────────────────────────────────────────
  function openProgramDay(programId, index) { setDayReflection(''); setOpenDay({ programId, index }); }
  async function completeProgramDay() {
    if (!user || !openDay) return;
    const { programId, index } = openDay;
    const reflection = dayReflection.trim();
    setSavingDay(true);
    try {
      const writes = [setDoc(doc(db, 'users', user.uid), { programProgress: { [programId]: { completed: { [index]: Date.now() } } } }, { merge: true })];
      if (reflection) {
        writes.push(addDoc(collection(db, 'users', user.uid, 'entries'), {
          type: 'reflection', programId, programDay: index + 1, behaviorId: null, transcript: reflection,
          tags: [], replacement: '', note: '', timestamp: Date.now(), createdAt: serverTimestamp(),
        }));
      }
      await Promise.all(writes);
      setOpenDay(null); setDayReflection('');
      toast(t.dayFinished, 'success');
    } catch (err) {
      console.error('Program day save failed:', err);
      toast(t.toastError, 'error');
    } finally {
      setSavingDay(false);
    }
  }
  async function toggleFavoriteReplacement(label) {
    if (!user) return;
    const current = userProfile?.favoriteReplacements || [];
    const next = current.includes(label) ? current.filter(r => r !== label) : [...current, label];
    try {
      await setDoc(doc(db, 'users', user.uid), { favoriteReplacements: next }, { merge: true });
    } catch (err) {
      console.error('Favorite replacement toggle failed:', err);
      toast(t.toastError, 'error');
    }
  }
  function openDeleteAccount() {
    const providerIds = auth.currentUser?.providerData?.map(provider => provider.providerId) || [];
    setDeleteWord('');
    setDeletePassword('');
    setDeleteNeedsReauth(!providerIds.includes('google.com') && providerIds.includes('password'));
    setConfirmAction({ kind: 'account' });
  }
  const toggleCheckinTag = id => setCheckinTags(p => p.includes(id) ? p.filter(t => t !== id) : [...p, id]);
  const toggleTag = id => {
    setEntryForm(p => ({ ...p, tags: p.tags.includes(id) ? p.tags.filter(t => t !== id) : [...p.tags, id] }));
    if (autoTagIds.includes(id)) setDismissedAutoTags(p => [...p, id]);
  };
  const closeEntry = () => {
    setShowEntry(false); stopRec(); setTranscript(''); setEntryForm({ behaviorId: '', tags: [], replacement: '', note: '' }); setEditingEntryId(null);
    setAutoTagIds([]); setDismissedAutoTags([]); setBehaviorAutoFilled(false); setExpandedTechnique(null);
    setShowVoiceLangs(false); setShowEntryContext(false);
  };
  const entryModalRef = useModalA11y(showEntry, closeEntry);

  // ── Auto-tag & auto-behavior detection from the transcript (new entries only) ──
  useEffect(() => {
    if (!showEntry || editingEntryId) return;
    const h = setTimeout(() => {
      const textTags = matchTags(transcript, uiLang);
      const timeTag = getTimeOfDayTag();
      const proposed = [...new Set([...textTags, timeTag])].filter(id => TAG_MAP[id] && !dismissedAutoTags.includes(id));
      if (proposed.length) {
        setAutoTagIds(proposed);
        setEntryForm(p => ({ ...p, tags: [...new Set([...p.tags, ...proposed])] }));
      }
      if (behaviors.length && (entryForm.behaviorId === '' || behaviorAutoFilled)) {
        const guess = matchBehavior(transcript, behaviors, uiLang, ONBOARDING_BEHAVIOR_LABELS);
        if (guess) { setEntryForm(p => ({ ...p, behaviorId: guess })); setBehaviorAutoFilled(true); }
      }
    }, 500);
    return () => clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transcript, showEntry, editingEntryId, uiLang]);

  // The "replaced" tag is derived deterministically from the replacement field, not guessed from text.
  useEffect(() => {
    if (!showEntry || editingEntryId) return;
    const hasReplacement = entryForm.replacement.trim().length > 0;
    const hasTag = entryForm.tags.includes('replaced');
    if (hasReplacement && !hasTag && TAG_MAP.replaced && !dismissedAutoTags.includes('replaced')) {
      setAutoTagIds(p => [...new Set([...p, 'replaced'])]);
      setEntryForm(p => ({ ...p, tags: [...p.tags, 'replaced'] }));
    } else if (!hasReplacement && hasTag && autoTagIds.includes('replaced')) {
      setEntryForm(p => ({ ...p, tags: p.tags.filter(id => id !== 'replaced') }));
      setAutoTagIds(p => p.filter(id => id !== 'replaced'));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entryForm.replacement, showEntry, editingEntryId]);
  const behaviorModalRef = useModalA11y(showNewB, () => setShowNewB(false));
  const tagModalRef = useModalA11y(showNewTag, () => setShowNewTag(false));
  const onboardingModalRef = useModalA11y(showOnboarding, () => {});
  const dayModalRef = useModalA11y(!!openDay, () => setOpenDay(null));

  // ── Stats ─────────────────────────────────────────────────────────────────
  // Replacement texts are saved in whatever language was active, so match titles across all of them.
  const techniqueOf = text => COPING_TECHNIQUES.find(tc => Object.values(STRINGS).some(s => s.copingTechniques[tc.id]?.title === text))?.id || null;
  const stats = (() => {
    const es = entries;
    const total = es.length;
    const replaced  = es.filter(e => e.tags?.includes('replaced')).length;
    const savedCost = es.filter(e => e.tags?.includes('replaced')).reduce((s, e) => s + (behaviors.find(b => b.id === e.behaviorId)?.cost || 0), 0);
    const byBehavior = behaviors.map(b => ({ ...b, count: es.filter(e => e.behaviorId === b.id).length }));
    const triggers = triggerCounts(es, { days: Infinity }).filter(([id]) => TAG_MAP[id]).slice(0, 5);
    const techCounts = {};
    es.forEach(e => {
      const id = e.replacement && techniqueOf(e.replacement);
      if (id) techCounts[id] = (techCounts[id] || 0) + 1;
    });
    const topTechniques = Object.entries(techCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
    // Day streak (opt-in, see .streak stat tile): auto-hidden below when too many recent days were missed.
    const entryDays = new Set(es.map(e => new Date(e.timestamp).toISOString().slice(0, 10)));
    let streak = 0;
    const cursor = new Date();
    while (entryDays.has(cursor.toISOString().slice(0, 10))) { streak++; cursor.setDate(cursor.getDate() - 1); }
    let missedLast14 = 0;
    for (let i = 0; i < 14; i++) {
      const day = new Date(); day.setDate(day.getDate() - i);
      if (!entryDays.has(day.toISOString().slice(0, 10))) missedLast14++;
    }
    return { total, replaced, savedCost, byBehavior, triggers, topTechniques, streak, missedLast14 };
  })();

  const filtered = entries.filter(e => {
    if (fBehavior !== 'all' && e.behaviorId !== fBehavior) return false;
    if (fTag !== 'all' && !e.tags?.includes(fTag)) return false;
    return true;
  });

  // ── Render views ──────────────────────────────────────────────────────────
  const renderToday = () => {
    const band = levelBand(thermoLevel);
    const momentTech = techniqueForMoment(thermoLevel, checkinTags, relevantTagIds(userProfile?.challenges));
    const today = new Date().toDateString();
    const todayChecks = moodChecks.filter(m => new Date(m.timestamp).toDateString() === today).sort((a, b) => a.timestamp - b.timestamp);
    const emotionTags = EMOTION_TAGS.map(id => TAG_MAP[id]).filter(Boolean);
    const contextTags = tags.filter(tg => !EMOTION_TAGS.includes(tg.id) && !TIME_TAG_IDS.includes(tg.id));
    const basics = PROGRAMS.find(p => p.id === 'basics');
    const prog = programSummary(basics, programProgress.basics);
    const pick = tg => {
      const on = checkinTags.includes(tg.id);
      return (
        <button key={tg.id} className={`chip ${on ? 'on' : ''}`} style={on ? { background: tg.color, borderColor: tg.color, color: 'white' } : undefined}
          onClick={() => toggleCheckinTag(tg.id)}>{tg.emoji} {tg.label}</button>
      );
    };
    return (
      <>
        <div className="card today-hero">
          <div className="today-question">{t.waterQuestion}</div>
          <SwimScene value={thermoLevel} onChange={setThermoLevel} height={190}/>
          <div className={`level-phrase ${band}`}>
            {thermoLevel != null && <span className="level-num">{thermoLevel}</span>}
            <span>{t.levelPhrases[band]}</span>
          </div>
          <input className="level-range" type="range" min="0" max="10" value={thermoLevel ?? 0} aria-label={t.waterQuestion}
            onChange={e => setThermoLevel(Number(e.target.value))}/>
        </div>

        {(emotionTags.length > 0 || contextTags.length > 0 || behaviors.length > 0) && (
          <div className="card">
            <div className="card-title">{t.whatsHere}</div>
            <div className="tags">{emotionTags.map(pick)}</div>
            <div className="daypart-line">
              {showDayparts
                ? DAYPARTS.map(dp => <button key={dp} className={`chip chip-sm ${thermoDaypart === dp ? 'on' : ''}`} onClick={() => { setThermoDaypart(dp); setShowDayparts(false); }}>{t.dayparts[dp]}</button>)
                : <button className="chip chip-sm" onClick={() => setShowDayparts(true)}>🕐 {t.dayparts[thermoDaypart]} <PencilIcon/></button>}
            </div>
            {showContext ? (
              <>
                {contextTags.length > 0 && <div className="tags" style={{ marginTop: 14 }}>{contextTags.map(pick)}</div>}
                {behaviors.length > 0 && (
                  <div className="field" style={{ marginTop: 14, marginBottom: 0 }}>
                    <label>{t.linkedBehavior}</label>
                    <select value={checkinBehavior} onChange={e => setCheckinBehavior(e.target.value)}>
                      <option value="">{t.checkinNoBehavior}</option>
                      {behaviors.map(b => <option key={b.id} value={b.id}>{b.label}</option>)}
                    </select>
                  </div>
                )}
              </>
            ) : (
              <button className="onb-link onb-link-muted" style={{ marginTop: 6 }} onClick={() => setShowContext(true)}>{t.addContext}</button>
            )}
          </div>
        )}

        {momentTech && (
          <div className="card technique-now">
            <div className="card-title">💡 {t.techniqueNow}</div>
            <div className="technique-now-title">{t.copingTechniques[momentTech].title}</div>
            <p className="technique-howto">{t.copingTechniques[momentTech].how}</p>
            {band === 'deep' && <p className="crisis-line">{t.copingCrisisNote}</p>}
          </div>
        )}

        <button className="btn btn-primary btn-full" onClick={saveQuickCheck} disabled={checkinTags.length === 0 && thermoLevel === null}>
          {checkinSaved ? t.checkinSaved : t.logMoment}
        </button>
        <button className="onb-link today-details" onClick={openQuickDetails}>🎙️ {t.addDetails}</button>

        {todayChecks.length > 0 && (
          <div className="card">
            <div className="card-title">{t.todaySummary(todayChecks.length)}</div>
            <div className="today-dots">
              {todayChecks.map(m => {
                const values = Object.values(m.ratings || {});
                const level = Math.round(values.reduce((a, v) => a + v, 0) / (values.length || 1));
                return (
                  <div key={m.id} className="today-dot">
                    <span style={{ '--lvl': level }}>{level}</span>
                    <small>{new Date(m.timestamp).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}</small>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <button className="card today-program" onClick={() => (prog.nextState === 'current' ? openProgramDay('basics', prog.nextIndex) : setView('programs'))}>
          <span className="program-emoji-sm">{basics.emoji}</span>
          <span className="program-locked-text">
            <span className="card-title" style={{ margin: 0 }}>{t.yourProgram}</span>
            <span className="program-locked-title">{prog.finished ? t.programDone : programCopy.basics.days[prog.nextIndex].title}</span>
            {!prog.finished && <span className="program-locked-desc">{prog.nextState === 'current' ? t.dayOf(prog.nextIndex + 1, prog.total) : t.nextDayTomorrow}</span>}
          </span>
          {prog.nextState === 'current' && <span className="day-go" aria-hidden="true">→</span>}
        </button>

        {userProfile?.streakEnabled && stats.streak > 1 && <p className="streak-line">{t.streakDays(stats.streak)}</p>}
      </>
    );
  };

  const renderJournal = () => {
    const grouped = groupByDay(filtered);
    const days = Object.keys(grouped).sort((a, b) => new Date(b) - new Date(a));
    const unfiltered = fBehavior === 'all' && fTag === 'all';
    const levelsByDay = groupByDay(moodChecks);
    const tagChip = tid => {
      const tg = TAG_MAP[tid];
      return tg ? <span key={tid} className="tag readonly" style={{ background: tg.color + '20', borderColor: tg.color + '55', color: tg.color }}>{tg.emoji} {tg.label}</span> : null;
    };
    const actions = entry => (
      <div className="entry-actions">
        <button className="entry-delete" onClick={() => openEditEntry(entry)} aria-label={t.edit}><PencilIcon/></button>
        <button className="entry-delete" onClick={() => requestConfirmation('entry', entry.id)} aria-label={t.deleteLabel}><TrashIcon/></button>
      </div>
    );
    return (
      <>
        <div className="filter-bar">
          <button className={`chip ${fBehavior === 'all' ? 'on' : ''}`} onClick={() => setFBehavior('all')}>{t.all}</button>
          {behaviors.map(b => <button key={b.id} className={`chip ${fBehavior === b.id ? 'on' : ''}`} onClick={() => setFBehavior(b.id)}>{b.label}</button>)}
        </div>
        <div className="filter-bar">
          <button className={`chip ${fTag === 'all' ? 'on' : ''}`} onClick={() => setFTag('all')}>{t.allTags}</button>
          {tags.map(tg => <button key={tg.id} className={`chip ${fTag === tg.id ? 'on' : ''}`} onClick={() => setFTag(tg.id)}>{tg.emoji} {tg.label}</button>)}
        </div>
        {days.length === 0 ? (
          <div className="empty"><div className="empty-icon">🎙️</div><p>{t.noEntries}<br/>{t.tapToRecord}</p></div>
        ) : days.map(day => {
          const levels = unfiltered ? (levelsByDay[day] || []).map(m => {
            const v = Object.values(m.ratings || {});
            return { id: m.id, ts: m.timestamp, level: Math.round(v.reduce((a, x) => a + x, 0) / (v.length || 1)) };
          }).sort((a, b) => a.ts - b.ts) : [];
          return (
            <section key={day} className="journal-day">
              <div className="day-head">
                <div className="day-label">{(d => d.charAt(0).toUpperCase() + d.slice(1))(formatDay(day, locale))}</div>
                {levels.length > 0 && (
                  <div className="day-levels" aria-label={t.dayLevels(levels.map(l => l.level).join(', '))}>
                    <span className="day-levels-icon" aria-hidden="true">🌊</span>
                    {levels.map(l => <span key={l.id} className="day-level" style={{ '--lvl': l.level }} title={`${formatTime(l.ts, locale)} · ${l.level}/10`}>{l.level}</span>)}
                  </div>
                )}
              </div>
              {grouped[day].map(entry => {
                const b = behaviors.find(x => x.id === entry.behaviorId);
                if (!entry.transcript?.trim()) {
                  return (
                    <div key={entry.id} className="entry entry-compact">
                      <span className="entry-time">{formatTime(entry.timestamp, locale)}</span>
                      <div className="entry-compact-body">
                        <span className="entry-kind">{t.quickCheckinLabel}{b ? ` · ${b.label}` : ''}</span>
                        <div className="tags">{entry.tags?.map(tagChip)}</div>
                      </div>
                      {actions(entry)}
                    </div>
                  );
                }
                return (
                  <div key={entry.id} className={`entry${entry.type === 'reflection' ? ' entry-is-reflection' : ''}`}>
                    <div className="entry-head">
                      {b && <span className="entry-behavior">{b.label}</span>}
                      {entry.type === 'reflection' && <span className="entry-behavior entry-reflection">{t.programDayBadge(entry.programDay)}</span>}
                      <span className="entry-time">{formatTime(entry.timestamp, locale)}</span>
                      {actions(entry)}
                    </div>
                    <p className="entry-transcript">{entry.transcript}</p>
                    {entry.replacement && <div className="entry-replacement">✦ {entry.replacement}</div>}
                    {entry.tags?.length > 0 && <div className="tags entry-tags">{entry.tags.map(tagChip)}</div>}
                  </div>
                );
              })}
            </section>
          );
        })}
      </>
    );
  };

  const INSIGHT_ICONS = { wins: '🏄', calmer: '🌤️', hardestDaypart: '🕰️', topTrigger: '🔎', bestTechnique: '💡' };
  const insightText = i => {
    if (i.id === 'wins') return t.insight.wins(i.count, i.more);
    if (i.id === 'calmer') return t.insight.calmer;
    if (i.id === 'hardestDaypart') return t.insight.hardestDaypart[i.daypart];
    if (i.id === 'topTrigger') return TAG_MAP[i.tagId] && t.insight.topTrigger(TAG_MAP[i.tagId].label, i.count);
    if (i.id === 'bestTechnique') return t.copingTechniques[i.techniqueId] && t.insight.bestTechnique(t.copingTechniques[i.techniqueId].title, i.count);
    return null;
  };

  const renderDashboard = () => {
    const s = stats;
    if (s.total === 0 && moodChecks.length === 0) return <div className="empty"><div className="empty-icon">🌊</div><p>{t.statsEmpty}</p></div>;
    const insights = buildInsights({ entries, moodChecks, techniqueOf }).map(i => ({ ...i, text: insightText(i) })).filter(i => i.text);
    const bMax = Math.max(...s.byBehavior.map(x => x.count), 1);
    const bar = (key, label, count, max, color) => (
      <div key={key} className="bar-row">
        <div className="bar-label" title={label}>{label}</div>
        <div className="bar-track"><div className="bar-fill" style={{ width: `${(count / max) * 100}%`, background: color }}/></div>
        <div className="bar-count">{count}</div>
      </div>
    );
    return (
      <>
        <div className="card insight-card">
          <div className="card-title">{t.insightsTitle}</div>
          {insights.length === 0
            ? <p className="onb-body" style={{ margin: 0 }}>{t.insightsEmpty}</p>
            : insights.map(i => <div key={i.id} className="insight-row"><span className="insight-icon">{INSIGHT_ICONS[i.id]}</span><span>{i.text}</span></div>)}
        </div>
        <div className="stat-grid">
          <div className="stat"><div className="stat-val success">{s.replaced}</div><div className="stat-label">{t.winsLabel}</div></div>
          <div className="stat"><div className="stat-val">{s.total}</div><div className="stat-label">{t.momentsLogged}</div></div>
          {userProfile?.streakEnabled && s.missedLast14 < 5 && <div className="stat stat-wide"><div className="stat-val">{s.streak}</div><div className="stat-label">{t.currentStreak}</div></div>}
          {s.savedCost > 0 && <div className="stat stat-wide stat-win"><div className="stat-val success">{formatMoney(s.savedCost, locale, currency)}</div><div className="stat-label">{t.savedLabel}</div></div>}
        </div>
        {moodChecks.length > 0 && (
          <div className="card">
            <div className="card-title">{t.thermometerChartTitle}</div>
            <ThermometerGrid moodChecks={moodChecks} traitIds={EMOTION_TAGS} tagMap={TAG_MAP} dayparts={DAYPARTS} t={t}/>
          </div>
        )}
        {s.total > 0 && (
          <div className="card">
            <div className="card-title">{t.activity14}</div>
            <WaveSparkline entries={entries}/>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
              <span style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-dim)' }}>{t.d14ago}</span>
              <span style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-dim)' }}>{t.today}</span>
            </div>
          </div>
        )}
        {s.topTechniques.length > 0 && (
          <div className="card">
            <div className="card-title">{t.techniquesUsed}</div>
            {s.topTechniques.map(([id, cnt]) => bar(id, t.copingTechniques[id]?.title, cnt, s.topTechniques[0][1], 'var(--success)'))}
          </div>
        )}
        {s.triggers.length > 0 && (
          <div className="card">
            <div className="card-title">{t.topTriggers}</div>
            {s.triggers.map(([id, cnt]) => bar(id, `${TAG_MAP[id].emoji} ${TAG_MAP[id].label}`, cnt, s.triggers[0][1], TAG_MAP[id].color))}
          </div>
        )}
        {s.byBehavior.some(b => b.count > 0) && (
          <div className="card">
            <div className="card-title">{t.byBehavior}</div>
            {s.byBehavior.map(b => bar(b.id, b.label, b.count, bMax))}
          </div>
        )}
        {!isPremium && <button className="card premium-teaser" onClick={() => setView('premium')}>✨ {t.insightsPremiumTeaser}</button>}
      </>
    );
  };

  const renderPrograms = () => {
    const basics = PROGRAMS.find(p => p.id === 'basics');
    const states = dayStates(basics, programProgress.basics);
    const sum = programSummary(basics, programProgress.basics);
    const copy = programCopy.basics;
    return (
      <>
        <div className="card program-hero">
          <div className="program-emoji">{basics.emoji}</div>
          <div className="program-title">{copy.title}</div>
          <p className="onb-body">{copy.description}</p>
          <div className="program-progress"><div className="program-progress-fill" style={{ width: `${(sum.done / sum.total) * 100}%` }}/></div>
          {sum.finished ? <p className="program-status">{t.programDone}</p> : (
            <>
              <div className="program-progress-label">{t.dayOf(sum.nextIndex + 1, sum.total)}</div>
              {sum.nextState === 'current'
                ? <button className="btn btn-primary btn-full" onClick={() => openProgramDay('basics', sum.nextIndex)}>{t.startDay(sum.nextIndex + 1)}</button>
                : <p className="program-status">{t.nextDayTomorrow}</p>}
            </>
          )}
        </div>
        <div className="card day-list">
          {basics.days.map((_, i) => (
            <button key={i} className={`day-row ${states[i]}`} disabled={states[i] === 'locked' || states[i] === 'tomorrow'} onClick={() => openProgramDay('basics', i)}>
              <span className="day-num">{states[i] === 'done' ? '✓' : i + 1}</span>
              <span className="day-title">{copy.days[i].title}</span>
              {states[i] === 'current' && <span className="day-go" aria-hidden="true">→</span>}
            </button>
          ))}
        </div>
        <div className="settings-section-title">{t.moreProgramsTitle}</div>
        {PROGRAMS.filter(p => p.premium).map(p => (
          <button key={p.id} className="card program-locked" onClick={() => setView('premium')}>
            <span className="program-emoji-sm">{p.emoji}</span>
            <span className="program-locked-text">
              <span className="program-meta">
                <span className="program-length">{t.programLength(p.length)}</span>
                <span className="premium-pill">{t.comingSoon}</span>
              </span>
              <span className="program-locked-title">{programCopy[p.id].title}</span>
              <span className="program-locked-desc">{programCopy[p.id].description}</span>
              {programCopy[p.id].gift && <span className="program-gift">🎁 {programCopy[p.id].gift}</span>}
            </span>
          </button>
        ))}
        <div className="card">
          <button className="btn btn-ghost btn-full" onClick={() => setShowCopingToolkit(true)}>🧰 {t.allSkills}</button>
          <p className="legal-links" style={{ marginTop: 12 }}>{t.copingCrisisNote}</p>
        </div>
      </>
    );
  };

  const renderPremium = () => {
    const live = billing?.checkout && billing.prices;
    const priceLabel = p => formatMoney(billing.prices[p].amount, locale, billing.prices[p].currency);
    let status = null;
    if (isPremium && entitlement.source === 'clinic') status = t.clinicAccessUntil(formatLongDate(entitlement.expiresAt, locale));
    else if (isPremium && entitlement.source === 'stripe' && entitlement.periodEnd) {
      status = (entitlement.cancelAtPeriodEnd ? t.accessUntil : t.renewsOn)(formatLongDate(entitlement.periodEnd, locale));
    }
    return (
      <>
        <div className="premium-hero">
          <div className="premium-wordmark">Limitless<span>+</span></div>
          <p className="premium-tagline">{t.premiumTagline}</p>
        </div>
        {isPremium && (
          <div className="card mission-card">
            <div className="insight-row" style={{ padding: 0 }}>{t.premiumActive}</div>
            {status && <p className="premium-status">{status}</p>}
            {entitlement.source === 'stripe' && entitlement.stripeCustomerId && (
              <button className="btn btn-ghost btn-full" style={{ marginTop: 12 }} onClick={openBillingPortal} disabled={!!billingBusy}>
                {billingBusy === 'portal' ? t.redirecting : t.manageSubscription}
              </button>
            )}
          </div>
        )}
        <div className="card">
          <div className="card-title">{t.premiumIncludesTitle}</div>
          {t.premiumIncludes.map(x => <div key={x} className="check-row"><span className="check-mark">✦</span>{x}</div>)}
          {!isPremium && (live ? (
            <>
              <div className="price-row" role="radiogroup" aria-label={t.premiumIncludesTitle}>
                {['monthly', 'yearly'].map(p => (
                  <button key={p} type="button" role="radio" aria-checked={plan === p} className={`price-opt price-choice${plan === p ? ' selected' : ''}`} onClick={() => setPlan(p)}>
                    {p === 'yearly' && <span className="price-badge">{t.bestValue}</span>}
                    {(p === 'yearly' ? t.pricePerYear : t.pricePerMonth)(priceLabel(p))}
                  </button>
                ))}
              </div>
              <button className="btn btn-primary btn-full" onClick={startCheckout} disabled={!!billingBusy}>
                {billingBusy === 'checkout' ? t.redirecting : (plan === 'yearly' ? t.subscribeYearly : t.subscribeMonthly)(priceLabel(plan))}
              </button>
            </>
          ) : (
            <>
              <div className="price-row">
                <div className="price-opt">{t.pricePerMonth(formatMoney(6.99, locale, currency))}</div>
                <div className="price-opt best">{t.pricePerYear(formatMoney(49, locale, currency))}</div>
              </div>
              <div className="btn btn-full btn-soon" aria-disabled="true">{t.premiumCta}</div>
            </>
          ))}
        </div>
        <div className="card mission-card">
          <div className="card-title">💙 {t.payItForwardTitle}</div>
          <p className="onb-body" style={{ margin: 0 }}>{t.payItForward}</p>
        </div>
        {!isPremium && (
          <div className="card">
            <div className="card-title">{t.clinicCodeTitle}</div>
            {billing?.codes ? (
              <form onSubmit={redeemCode}>
                <p className="onb-body" style={{ margin: '0 0 12px' }}>{t.clinicCodeBodyLive}</p>
                <div className="field code-field">
                  <input
                    type="text" value={accessCode} placeholder="LMT-XXXX-XXXX-XX" aria-label={t.clinicCodeTitle}
                    autoCapitalize="characters" autoComplete="off" spellCheck={false} maxLength={24}
                    aria-invalid={!!codeError} aria-describedby={codeError ? 'code-error' : undefined}
                    onChange={e => { setAccessCode(e.target.value); setCodeError(''); }}
                  />
                  <button type="submit" className="btn btn-primary" disabled={!accessCode.trim() || !!billingBusy}>
                    {billingBusy === 'code' ? '…' : t.redeemCode}
                  </button>
                </div>
                {codeError && <p id="code-error" className="code-error" role="alert">{codeError}</p>}
              </form>
            ) : (
              <p className="onb-body" style={{ margin: 0 }}>{t.clinicCodeBody}</p>
            )}
          </div>
        )}
        <div className="card">
          <div className="card-title">{t.freeForeverTitle}</div>
          {t.freeForever.map(x => <div key={x} className="check-row"><span className="check-mark">✓</span>{x}</div>)}
        </div>
      </>
    );
  };

  const renderSettings = () => (
    <>
      <div className="settings-section-title">{t.dataSection}</div>
      <div className="card">
        <div className="card-title">{t.myBehaviors}</div>
        {behaviors.length === 0 && <p style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 14 }}>{t.noBehaviors}</p>}
        {behaviors.map(b => (
          <div key={b.id} className="behavior-item">
            <div><div className="behavior-name">{b.label}</div><div className="behavior-cost">{b.cost > 0 ? `${formatMoney(b.cost, locale, currency)} ${t.perOccurrence}` : t.noCost}</div></div>
            <div style={{ display: 'flex' }}>
              <button className="entry-delete" onClick={() => openEditBehavior(b)}><PencilIcon/></button>
              <button className="entry-delete" onClick={() => requestConfirmation('behavior', b.id)} aria-label={t.deleteLabel}><TrashIcon/></button>
            </div>
          </div>
        ))}
        <button className="btn btn-ghost btn-sm btn-full" style={{ marginTop: 6 }} onClick={openNewBehavior}><PlusIcon/> {t.addBehavior}</button>
      </div>
      <div className="card">
        <div className="card-title">{t.myTags}</div>
        {tags.length === 0 && <p style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 14 }}>{t.noTags}</p>}
        <div className="tags" style={{ marginBottom: tags.length ? 12 : 0 }}>
          {tags.map(tg => (
            <span key={tg.id} className="tag readonly" style={{ background: tg.color + '20', borderColor: tg.color + '55', color: tg.color }}>
              {tg.emoji} {tg.label}
              <button className="tag-inline-btn" onClick={() => openEditTag(tg)}><PencilIcon/></button>
              <button className="tag-inline-btn" onClick={() => requestConfirmation('tag', tg.id)} aria-label={t.deleteLabel}><TrashIcon/></button>
            </span>
          ))}
        </div>
        <button className="btn btn-ghost btn-sm btn-full" onClick={openNewTag}><PlusIcon/> {t.addTag}</button>
      </div>
      <div className="card">
        <div className="card-title">{t.manageChallengesTitle}</div>
        <p className="onb-body" style={{ marginBottom: 12 }}>{t.manageChallengesHint}</p>
        <div className="tags challenge-chips" style={{ marginBottom: 12 }}>
          {CHALLENGES.map(c => (
            <button key={c.id} className={`chip ${userProfile?.challenges?.includes(c.id) ? 'on' : ''}`} onClick={() => toggleProfileChallenge(c.id)}>
              {t.challenges[c.id].label}
            </button>
          ))}
        </div>
        {!showSettingsDiagnosis ? (
          <button className="btn btn-ghost btn-sm btn-full" onClick={() => { setDiagnosisDraft(userProfile?.diagnosisNote || ''); setShowSettingsDiagnosis(true); }}>
            {userProfile?.diagnosisNote ? <><PencilIcon/> {userProfile.diagnosisNote}</> : `+ ${t.diagnosisToggle}`}
          </button>
        ) : (
          <div className="field" style={{ marginBottom: 0 }}>
            <label>{t.diagnosisLabel}</label>
            <input type="text" placeholder={t.diagnosisPh} value={diagnosisDraft} onChange={e => setDiagnosisDraft(e.target.value)}/>
            <div className="modal-actions" style={{ marginTop: 10 }}>
              <button className="btn btn-ghost btn-sm" style={{ flex: 1 }} onClick={() => setShowSettingsDiagnosis(false)}>{t.cancel}</button>
              <button className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={async () => { await saveDiagnosisNote(); setShowSettingsDiagnosis(false); }}>{t.diagnosisSave}</button>
            </div>
          </div>
        )}
      </div>

      <div className="settings-section-title">{t.preferencesSection}</div>
      <div className="card">
        <div className="card-title">{t.theme}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {['system', 'light', 'dark'].map(m => <button key={m} className={`lang-chip ${themeMode === m ? 'on' : ''}`} onClick={() => setThemeMode(m)}>{t.themeOptions[m]}</button>)}
        </div>
      </div>
      <div className="card">
        <div className="card-title">{t.uiLanguage}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {UI_LANGS.map(l => <div key={l.code} className={`lang-chip ${uiLang === l.code ? 'on' : ''}`} onClick={() => setUiLang(l.code)}>{l.flag} {l.label}</div>)}
        </div>
      </div>
      <div className="card">
        <div className="card-title">{t.voiceLanguage}</div>
        <p style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 10 }}>{t.voiceLanguageHint}</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {LANGS.map(l => <div key={l.code} className={`lang-chip ${recLang === l.code ? 'on' : ''}`} onClick={() => setRecLang(l.code)}>{l.flag} {l.label}</div>)}
        </div>
      </div>
      <div className="card">
        <div className="card-title">{t.currency}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {currencies.map(code => <button key={code} className={`lang-chip ${currency === code ? 'on' : ''}`} onClick={() => saveCurrency(code)}>{code}</button>)}
        </div>
      </div>
      <div className="card">
        <div className="behavior-item" style={{ marginBottom: 0 }}>
          <div className="behavior-name">{t.showStreakToggle}</div>
          <button className={`lang-chip ${userProfile?.streakEnabled ? 'on' : ''}`} onClick={toggleStreakEnabled}>{userProfile?.streakEnabled ? `✓ ${t.streakOn}` : t.streakOff}</button>
        </div>
      </div>

      <div className="settings-section-title">{t.accountSection}</div>
      <button className="card premium-teaser" onClick={() => setView('premium')}>✨ {isPremium ? t.premiumActive : t.discoverPremium}</button>
      <div className="card">
        <div className="card-title">{t.data}</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" style={{ flex: 1 }} onClick={exportJson}>{t.exportJson}</button>
          <button className="btn btn-ghost btn-sm" style={{ flex: 1 }} onClick={exportCsv}>{t.exportCsv}</button>
        </div>
      </div>
      <div className="card">
        <div className="card-title">{t.legal}</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" style={{ flex: 1 }} onClick={() => setShowLegal('terms')}>{t.terms}</button>
          <button className="btn btn-ghost btn-sm" style={{ flex: 1 }} onClick={() => setShowLegal('privacy')}>{t.privacy}</button>
        </div>
      </div>
      <div className="card">
        <button className="btn btn-ghost btn-full" onClick={() => setConfirmAction({ kind: 'resetApp' })}>🌱 {t.resetAppButton}</button>
      </div>
      <div className="card">
        <button className="btn btn-ghost btn-full" onClick={signOutUser}><LogoutIcon/> {t.signOut}</button>
      </div>
      <div className="card danger-card">
        <div className="card-title">{t.dangerZone}</div>
        <button className="btn btn-danger btn-full" onClick={openDeleteAccount}>{t.deleteAccount}</button>
      </div>
    </>
  );

  // ── Loading ───────────────────────────────────────────────────────────────
  if (!authReady) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: dark ? '#071C2E' : '#D6EEF7', fontFamily: 'Manrope,sans-serif', color: dark ? '#8DA7BC' : '#587083', fontSize: '0.9rem', fontWeight: 600 }}>
      {STRINGS[uiLang].loading}
    </div>
  );

  return (
    <>
      <style>{CSS}</style>
      <div className={`app${dark ? ' dark' : ''}`}>

        {/* Header */}
        <div className="header">
          {user ? (
            <div className="greeting">
              <div className="greeting-text">
                {t.greeting} <span className="greeting-name">{(user.displayName || user.email?.split('@')[0] || '').split(' ')[0]}</span> <span className="greeting-wave">👋</span>
              </div>
              <div className="greeting-sub">{new Date().toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })}</div>
            </div>
          ) : (
            <div/>
          )}
          <div className="header-actions">
            {user ? (
              <button className={`icon-btn ${view === 'settings' || view === 'premium' ? 'on' : ''}`} onClick={() => setView('settings')} aria-label={t.manage} title={t.manage}><GearIcon/></button>
            ) : (
              <>
                <button className="icon-btn" onClick={() => { const i = UI_LANGS.findIndex(l => l.code === uiLang); setUiLang(UI_LANGS[(i + 1) % UI_LANGS.length].code); }} title={t.language} style={{ fontSize: '0.7rem', fontWeight: 800 }}>{uiLang.toUpperCase()}</button>
                <button className="icon-btn" onClick={() => setThemeMode(dark ? 'light' : 'dark')} title={t.toggleTheme}>{dark ? <SunIcon/> : <MoonIcon/>}</button>
              </>
            )}
          </div>
        </div>

        {/* Not authenticated → auth screen */}
        {!user && <AuthScreen t={t} uiLang={uiLang} onLegal={setShowLegal}/>}

        {/* Authenticated → app */}
        {user && (
          <>
            <div className="content">
              {view === 'today'     && renderToday()}
              {view === 'journal'   && renderJournal()}
              {view === 'dashboard' && renderDashboard()}
              {view === 'programs'  && renderPrograms()}
              {view === 'premium'   && renderPremium()}
              {view === 'settings'  && renderSettings()}
            </div>
            <nav className="tabbar">
              <button className={`tab ${view === 'today' ? 'on' : ''}`} onClick={() => setView('today')}><HomeIcon/>{t.today}</button>
              <button className={`tab ${view === 'journal' ? 'on' : ''}`} onClick={() => setView('journal')}><BookIcon/>{t.journal}</button>
              <div className="tab-fab-slot">
                <button className={`record-btn ${recording ? 'active' : 'idle'}`} onClick={recording ? stopRec : startRec} aria-label={recording ? t.stop : t.record}>
                  {recording ? <StopIcon/> : <MicIcon/>}
                </button>
              </div>
              <button className={`tab ${view === 'programs' ? 'on' : ''}`} onClick={() => setView('programs')}><CompassIcon/>{t.programs}</button>
              <button className={`tab ${view === 'dashboard' ? 'on' : ''}`} onClick={() => setView('dashboard')}><ChartIcon/>{t.stats}</button>
            </nav>
          </>
        )}

        {/* Program day */}
        {openDay && (() => {
          const program = PROGRAMS.find(p => p.id === openDay.programId);
          const day = programCopy[program.id].days[openDay.index];
          const techId = program.days[openDay.index];
          const done = programProgress[program.id]?.completed?.[openDay.index] != null;
          return (
            <div className="overlay" onClick={() => setOpenDay(null)}>
              <div ref={dayModalRef} className="modal" role="dialog" aria-modal="true" aria-labelledby="day-title" onClick={e => e.stopPropagation()}>
                <div className="modal-handle"/>
                <div className="onb-quiz-progress">{t.dayOf(openDay.index + 1, program.days.length)}</div>
                <div id="day-title" className="modal-title">{day.title}</div>
                <p className="onb-body">{day.intro}</p>
                <div className="day-skill">
                  <div className="card-title">{t.theSkill} · {t.copingTechniques[techId].title}</div>
                  <p>{t.copingTechniques[techId].how}</p>
                </div>
                <div className="card-title">{t.practiceToday}</div>
                <p className="onb-body">{day.practice}</p>
                <div className="card-title">{t.reflection}</div>
                <p className="day-reflect-q">{day.reflect}</p>
                {done ? (
                  <button className="btn btn-ghost btn-full" onClick={() => setOpenDay(null)}>{t.close}</button>
                ) : (
                  <>
                    <textarea className="transcript-box" value={dayReflection} onChange={e => setDayReflection(e.target.value)} placeholder={t.reflectionPh}/>
                    <button className="btn btn-primary btn-full" onClick={completeProgramDay} disabled={savingDay}>{t.finishDay(openDay.index + 1)}</button>
                  </>
                )}
              </div>
            </div>
          );
        })()}

        {/* Entry modal */}
        {showEntry && (
          <div className="overlay">
            <div ref={entryModalRef} className="modal" role="dialog" aria-modal="true" aria-labelledby="entry-modal-title">
              <div className="modal-handle"/>
              <div id="entry-modal-title" className="modal-title">{editingEntryId ? t.editEntryTitle : t.newEntry}</div>
              {recErr && <div className="error-msg">{recErr}</div>}
              {recording && <div className="rec-indicator"><div className="rec-dot"/> {t.listening}</div>}
              <textarea className="transcript-box" placeholder={recording ? t.transcribing : t.typePh} value={transcript} onChange={e => setTranscript(e.target.value)}/>
              <div className="rec-row">
                {recording ? (
                  <button className="btn btn-ghost rec-stop" style={{ flex: 1 }} onClick={stopRec}><StopIcon/> {t.stopRecording}</button>
                ) : (
                  <button className="btn btn-ghost" style={{ flex: 1 }} onClick={startRec}><MicIcon/> {recErr ? t.tryAgain : t.recordBtn}</button>
                )}
                <button className={`chip ${showVoiceLangs ? 'on' : ''}`} onClick={() => setShowVoiceLangs(p => !p)} aria-label={t.voiceLangLabel} title={t.voiceLangLabel}>
                  🌐 {recLang.split('-')[0].toUpperCase()}
                </button>
              </div>
              {showVoiceLangs && (
                <div className="lang-bar">
                  {LANGS.map(l => <button key={l.code} className={`lang-chip ${recLang === l.code ? 'on' : ''}`} onClick={() => { setRecLang(l.code); if (recording) stopRec(); setShowVoiceLangs(false); }}>{l.flag} {l.code.split('-')[0].toUpperCase()}</button>)}
                </div>
              )}
              <div className="field">
                <label>{t.behavior} * {behaviorAutoFilled && '✨'}</label>
                <select value={entryForm.behaviorId} onChange={e => { setEntryForm(p => ({ ...p, behaviorId: e.target.value })); setBehaviorAutoFilled(false); }}>
                  <option value="">{t.select}</option>
                  {behaviors.map(b => <option key={b.id} value={b.id}>{b.label}</option>)}
                </select>
                {behaviors.length === 0 && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 6, fontWeight: 600 }}>{t.addFirst}</div>}
              </div>
              {(() => {
                const chip = tg => {
                  const on = entryForm.tags.includes(tg.id);
                  return (
                    <button key={tg.id} className={`chip ${on ? 'on' : ''}`} style={on ? { background: tg.color, borderColor: tg.color, color: 'white' } : undefined} onClick={() => toggleTag(tg.id)}>
                      {on && autoTagIds.includes(tg.id) && '✨ '}{tg.emoji} {tg.label}
                    </button>
                  );
                };
                const emotionTags = tags.filter(tg => EMOTION_TAGS.includes(tg.id));
                const contextTags = tags.filter(tg => !EMOTION_TAGS.includes(tg.id));
                // Time-of-day is always auto-tagged, so only a place/people tag opens the context by itself.
                const contextOpen = showEntryContext || contextTags.some(tg => !TIME_TAG_IDS.includes(tg.id) && entryForm.tags.includes(tg.id));
                return (
                  <div className="field">
                    <label>{t.whatsHere}</label>
                    {tags.length === 0 && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 6, fontWeight: 600 }}>{t.addFirstTag}</div>}
                    <div className="tags">{emotionTags.map(chip)}</div>
                    {contextTags.length > 0 && (contextOpen
                      ? <div className="tags" style={{ marginTop: 10 }}>{contextTags.map(chip)}</div>
                      : <button className="onb-link onb-link-muted" onClick={() => setShowEntryContext(true)}>{t.addContextShort}</button>)}
                    {autoTagIds.length > 0 && <div className="auto-hint">{t.autoDetectedHint}</div>}
                  </div>
                );
              })()}
              <div className="field">
                <label>{t.replacementLabel}</label>
                <input type="text" placeholder={t.replacementPh} value={entryForm.replacement} onChange={e => setEntryForm(p => ({ ...p, replacement: e.target.value }))}/>
                {userProfile?.favoriteReplacements?.length > 0 && (
                  <div className="tags" style={{ marginTop: 8 }}>
                    {userProfile.favoriteReplacements.map((r, i) => (
                      <span key={i} className="tag" style={{ background: 'var(--warm-light)', borderColor: 'var(--warm)', color: 'var(--warm)' }}
                        onClick={() => setEntryForm(p => ({ ...p, replacement: r }))}>{r}</span>
                    ))}
                  </div>
                )}
                {suggestTechniques(entryForm.tags).length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <div className="tags">
                      {suggestTechniques(entryForm.tags).map(tc => (
                        <span key={tc.id} className="tag" style={{ background: 'var(--accent-light)', borderColor: 'var(--accent)', color: 'var(--accent-deep)' }}
                          onClick={() => setExpandedTechnique(p => p === tc.id ? null : tc.id)}>💡 {t.copingTechniques[tc.id].title}</span>
                      ))}
                    </div>
                    {expandedTechnique && t.copingTechniques[expandedTechnique] && (
                      <div className="technique-howto">
                        {t.copingTechniques[expandedTechnique].how}
                        <div style={{ marginTop: 8 }}>
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setEntryForm(p => ({ ...p, replacement: t.copingTechniques[expandedTechnique].title })); setExpandedTechnique(null); }}>{t.useThisTechnique}</button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="field">
                <label>{t.noteLabel}</label>
                <textarea placeholder={t.notePh} value={entryForm.note} onChange={e => setEntryForm(p => ({ ...p, note: e.target.value }))}/>
              </div>
              <div className="modal-actions">
                <button className="btn btn-ghost" style={{ flex: 1 }} onClick={closeEntry}>{t.cancel}</button>
                <button className="btn btn-primary" style={{ flex: 2 }} onClick={saveEntry} disabled={!entryForm.behaviorId || !transcript.trim()}>{editingEntryId ? t.updateEntry : t.saveEntry}</button>
              </div>
            </div>
          </div>
        )}

        {/* New/edit behavior modal */}
        {showNewB && (
          <div className="overlay" onClick={closeNewBehavior}>
            <div ref={behaviorModalRef} className="modal" role="dialog" aria-modal="true" aria-labelledby="behavior-modal-title" onClick={e => e.stopPropagation()}>
              <div className="modal-handle"/>
              <div id="behavior-modal-title" className="modal-title">{editingBehaviorId ? t.editBehavior : t.newBehavior}</div>
              <div className="field"><label>{t.bNameLabel} *</label><input type="text" placeholder={t.bNamePh} value={newBForm.label} onChange={e => setNewBForm(p => ({ ...p, label: e.target.value }))}/></div>
              <div className="field"><label>{t.bCostLabel(currency)}</label><input type="number" min="0" step="0.01" placeholder={t.bCostPh} value={newBForm.cost} onChange={e => setNewBForm(p => ({ ...p, cost: e.target.value }))}/></div>
              <div className="modal-actions">
                <button className="btn btn-ghost" style={{ flex: 1 }} onClick={closeNewBehavior}>{t.cancel}</button>
                <button className="btn btn-primary" style={{ flex: 2 }} onClick={saveBehavior} disabled={!newBForm.label.trim()}>{editingBehaviorId ? t.updateBehaviorBtn : t.addBehaviorBtn}</button>
              </div>
            </div>
          </div>
        )}

        {/* New/edit tag modal */}
        {showNewTag && (
          <div className="overlay" onClick={closeNewTag}>
            <div ref={tagModalRef} className="modal" role="dialog" aria-modal="true" aria-labelledby="tag-modal-title" onClick={e => e.stopPropagation()}>
              <div className="modal-handle"/>
              <div id="tag-modal-title" className="modal-title">{editingTagId ? t.editTag : t.newTag}</div>
              <div className="field"><label>{t.tagNameLabel} *</label><input type="text" placeholder={t.tagNamePh} value={newTagForm.label} onChange={e => setNewTagForm(p => ({ ...p, label: e.target.value }))}/></div>
              <div style={{ display: 'flex', gap: 10 }}>
                <div className="field" style={{ flex: 1 }}><label>{t.tagEmojiLabel}</label><input type="text" maxLength={4} value={newTagForm.emoji} onChange={e => setNewTagForm(p => ({ ...p, emoji: e.target.value }))}/></div>
                <div className="field" style={{ flex: 1 }}><label>{t.tagColorLabel}</label><input type="color" value={newTagForm.color} onChange={e => setNewTagForm(p => ({ ...p, color: e.target.value }))} style={{ padding: 4, height: 48 }}/></div>
              </div>
              <div className="modal-actions">
                <button className="btn btn-ghost" style={{ flex: 1 }} onClick={closeNewTag}>{t.cancel}</button>
                <button className="btn btn-primary" style={{ flex: 2 }} onClick={saveTag} disabled={!newTagForm.label.trim()}>{editingTagId ? t.updateTagBtn : t.addTagBtn}</button>
              </div>
            </div>
          </div>
        )}

        {/* First-login onboarding: welcome → challenges (direct pick or quiz) → behaviors */}
        {showOnboarding && (
          <div ref={onboardingModalRef} className="onb-screen" role="dialog" aria-modal="true" aria-label={t.onboarding[`step${onbStep}Title`]}
            style={{ background: ['var(--bg)', 'var(--gold-flat-bg)', 'var(--warm-flat-bg)'][onbStep - 1] }}>
            <div className="onb-dots">
              {[1, 2, 3].map(n => <div key={n} className={`onb-dot ${onbStep === n ? 'on' : ''}`}/>)}
            </div>
            <div className="onb-screen-body" key={`${onbStep}-${onbChallengeStage}-${onbQuizIndex}`}>
              {onbStep === 1 && (
                <>
                  <div className="onb-scene"><SwimScene value={2} height={180}/></div>
                  <div id="onboarding-modal-title" className="modal-title" style={{ textAlign: 'center' }}>{t.onboarding.step1Title}</div>
                  <p className="onb-body" style={{ textAlign: 'center' }}>{t.onboarding.step1Body}</p>
                  <div className="modal-actions">
                    <button className="btn btn-ghost" style={{ flex: 1 }} onClick={skipOnboarding}>{t.onboarding.skip}</button>
                    <button className="btn btn-primary" style={{ flex: 2 }} onClick={() => setOnbStep(2)}>{t.onboarding.next}</button>
                  </div>
                </>
              )}
              {onbStep === 2 && onbChallengeStage === 'list' && (
                <>
                  <div className="modal-title">{t.onboarding.step2Title}</div>
                  <p className="onb-body">{t.onboarding.step2Body}</p>
                  <div className="tags challenge-chips" style={{ marginBottom: 14 }}>
                    {CHALLENGES.map(c => (
                      <button key={c.id} className={`chip ${onbChallenges.includes(c.id) ? 'on' : ''}`} onClick={() => toggleOnbChallenge(c.id)}>
                        {t.challenges[c.id].label}
                      </button>
                    ))}
                  </div>
                  <button className="onb-link" onClick={() => { setOnbQuizIndex(0); setOnbChallengeStage('quiz'); }}>{t.onboarding.helpMeButton}</button>
                  {showOnbDiagnosis ? (
                    <div className="field" style={{ marginTop: 14 }}>
                      <label>{t.diagnosisLabel}</label>
                      <input type="text" placeholder={t.diagnosisPh} value={onbDiagnosisNote} onChange={e => setOnbDiagnosisNote(e.target.value)}/>
                    </div>
                  ) : (
                    <button className="onb-link onb-link-muted" onClick={() => setShowOnbDiagnosis(true)}>+ {t.diagnosisToggle}</button>
                  )}
                  <div className="modal-actions">
                    <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setOnbStep(1)}>{t.onboarding.back}</button>
                    <button className="btn btn-primary" style={{ flex: 2 }} onClick={() => setOnbStep(3)}>{t.onboarding.next}</button>
                  </div>
                </>
              )}
              {onbStep === 2 && onbChallengeStage === 'quiz' && (
                <>
                  <div className="onb-quiz-progress">
                    {t.onboarding.quizProgress.replace('{n}', onbQuizIndex + 1).replace('{total}', CHALLENGES.length)}
                  </div>
                  <div className="modal-title onb-quiz-question">{t.challenges[CHALLENGES[onbQuizIndex].id].quizQuestion}</div>
                  <div className="onb-quiz-answers">
                    <button className="btn btn-primary btn-full" onClick={() => answerQuiz(true)}>{t.onboarding.quizYes}</button>
                    <button className="btn btn-ghost btn-full" onClick={() => answerQuiz(false)}>{t.onboarding.quizNo}</button>
                  </div>
                  <button className="onb-link onb-link-muted" onClick={quizBack}>← {t.onboarding.back}</button>
                </>
              )}
              {onbStep === 3 && (
                <>
                  <div className="modal-title">{t.onboarding.step3Title}</div>
                  <p className="onb-body">{t.onboarding.step3Body}</p>
                  <div className="tags" style={{ marginBottom: 14 }}>
                    {onbSuggestedBehaviors.length === 0 && <p className="onb-body" style={{ margin: 0 }}>{t.onboarding.allAdded}</p>}
                    {onbSuggestedBehaviors.map(s => (
                      <button key={s.id} className={`chip ${onbBehaviors.includes(s.id) ? 'on' : ''}`}
                        onClick={() => toggleOnbBehavior(s.id)}>{t.onboarding.behaviors[s.id]}</button>
                    ))}
                  </div>
                  <div className="field">
                    <label>{t.onboarding.addCustom}</label>
                    <input type="text" placeholder={t.onboarding.customBehaviorPh} value={onbCustomBehavior} onChange={e => setOnbCustomBehavior(e.target.value)}/>
                  </div>
                  <div className="modal-actions">
                    <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setOnbStep(2)}>{t.onboarding.back}</button>
                    <button className="btn btn-primary" style={{ flex: 2 }} onClick={finishOnboarding} disabled={onbSaving}>{onbSaving ? '…' : t.onboarding.finish}</button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
        <ConfirmSheet
          open={confirmAction?.kind === 'entry' || confirmAction?.kind === 'behavior' || confirmAction?.kind === 'tag'}
          title={confirmAction?.kind === 'entry' ? t.deleteEntryTitle : confirmAction?.kind === 'behavior' ? t.deleteBehaviorTitle : t.deleteTagTitle}
          body={confirmAction?.kind === 'entry' ? t.deleteEntryBody : confirmAction?.kind === 'behavior' ? t.deleteBehaviorBody : t.deleteTagBody}
          confirmLabel={t.deleteLabel}
          cancelLabel={t.cancel}
          danger
          onCancel={() => setConfirmAction(null)}
          onConfirm={async () => {
            const action = confirmAction;
            setConfirmAction(null);
            if (action?.kind === 'entry') await delEntry(action.id);
            if (action?.kind === 'behavior') await delBehavior(action.id);
            if (action?.kind === 'tag') await delTag(action.id);
          }}
        />
        <ConfirmSheet
          open={confirmAction?.kind === 'resetApp'}
          title={t.resetAppTitle}
          body={t.resetAppBody}
          confirmLabel={resettingApp ? t.resettingApp : t.resetAppButton}
          cancelLabel={t.cancel}
          danger
          disabled={resettingApp}
          onCancel={() => setConfirmAction(null)}
          onConfirm={resetAppData}
        />
        <ConfirmSheet
          open={confirmAction?.kind === 'account'}
          title={t.deleteAccountTitle}
          body={t.deleteAccountBody.replace('DELETE', t.deleteConfirmWord)}
          confirmLabel={deletingAccount ? t.deleting : t.deleteLabel}
          cancelLabel={t.cancel}
          danger
          disabled={deletingAccount || deleteWord !== t.deleteConfirmWord || (deleteNeedsReauth && !deletePassword)}
          onCancel={resetDeleteAccount}
          onConfirm={confirmAccountDeletion}
        >
          {isPremium && entitlement.source === 'stripe' && !entitlement.cancelAtPeriodEnd && (
            <div className="sub-warning" role="note">
              <p>{t.deleteCancelSubFirst}</p>
              <button type="button" className="btn btn-ghost btn-full" onClick={openBillingPortal} disabled={!!billingBusy}>
                {billingBusy === 'portal' ? t.redirecting : t.manageSubscription}
              </button>
            </div>
          )}
          <div className="field">
            <label>{t.typeToConfirm.replace('DELETE', t.deleteConfirmWord)}</label>
            <input type="text" value={deleteWord} onChange={event => setDeleteWord(event.target.value)} autoComplete="off"/>
          </div>
          {deleteNeedsReauth && (
            <div className="field">
              <label>{t.password}</label>
              <input type="password" value={deletePassword} onChange={event => setDeletePassword(event.target.value)} placeholder={t.reauthPassword} autoComplete="current-password"/>
            </div>
          )}
        </ConfirmSheet>
        <LegalSheet open={!!showLegal} title={showLegal === 'terms' ? t.terms : t.privacy} sections={showLegal === 'terms' ? TERMS[uiLang] : PRIVACY[uiLang]} closeLabel={t.close} onCancel={() => setShowLegal(null)}/>
        <CopingToolkitModal open={showCopingToolkit} t={t} favorites={userProfile?.favoriteReplacements} onToggleFavorite={toggleFavoriteReplacement} onCancel={() => setShowCopingToolkit(false)} priorityTagIds={relevantTagIds(userProfile?.challenges)}/>
      </div>
    </>
  );
}
