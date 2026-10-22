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
  query, orderBy, serverTimestamp, setDoc, updateDoc, getDoc, getDocs, writeBatch,
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
import { suggestTechniques, COPING_TECHNIQUES } from './copingToolkit';
import CopingToolkitModal from './components/CopingToolkitModal';
import { DAYPARTS, suggestDaypart, aggregateThermometer, waterLevelY } from './thermometer';
import { CHALLENGES, relevantTagIds, sortBehaviorsByChallenges } from './challenges';
import { buildInsights, triggerCounts } from './insights';

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
function formatDate(ts, locale) {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(ts));
}
function formatMoney(n, locale, currency = 'CAD') {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(n || 0);
}
function groupByDay(entries) {
  const map = {};
  entries.forEach(e => {
    const day = new Date(e.timestamp).toISOString().split('T')[0];
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
function SwimScene({ value }) {
  const W = 300, H = 180, sandY = 160;
  const waterY = waterLevelY(value);
  const bumps = 5, amp = 3, step = W / bumps;
  let wave = `M0,${waterY}`;
  for (let i = 0; i < bumps; i++) {
    const cy = i % 2 === 0 ? waterY - amp : waterY + amp;
    wave += ` Q${step * i + step / 2},${cy} ${step * (i + 1)},${waterY}`;
  }
  const waterPath = `${wave} L${W},${sandY} L0,${sandY} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 150, display: 'block' }} preserveAspectRatio="xMidYMid meet">
      <rect x="0" y={sandY} width={W} height={H - sandY} fill="var(--gold-flat-bg)"/>
      <ellipse cx="150" cy="88" rx="30" ry="17" fill="var(--text-muted)"/>
      <circle cx="150" cy="58" r="14" fill="var(--text-muted)"/>
      <path d={waterPath} fill="var(--water)" opacity="0.6"/>
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
      <div className="auth-orb"/>
      <div className="auth-wordmark"><span className="limit">Limit</span><span className="less">less</span></div>
      <div className="auth-tagline">{t.heroTagline}</div>

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
        {mode === 'login' ? <>{t.noAccount}&nbsp;<span onClick={() => { setMode('signup'); setError(''); }}>{t.createOne}</span></> : <>{t.haveAccount}&nbsp;<span onClick={() => { setMode('login'); setError(''); }}>{t.signInLink}</span></>}
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
  const [thermoDaypart, setThermoDaypart] = useState(() => suggestDaypart());
  const [thermoLevel, setThermoLevel] = useState(null);
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
    return () => { unsubB(); unsubE(); unsubT(); unsubU(); unsubM(); };
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
  useEffect(() => { document.body.style.background = dark ? '#0A1615' : '#F6FBFA'; }, [dark]);

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
    const hasRatings = thermoLevel != null && activeEmotionIds.length > 0;
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
        const ratings = Object.fromEntries(activeEmotionIds.map(id => [id, thermoLevel]));
        writes.push(addDoc(collection(db, 'users', user.uid, 'moodChecks'), {
          timestamp: Date.now(), daypart: thermoDaypart, ratings, createdAt: serverTimestamp(),
        }));
      }
      await Promise.all(writes);
      setCheckinTags([]); setCheckinBehavior(''); setThermoLevel(null);
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
      await setDoc(doc(db, 'users', user.uid), { onboarded: false, favoriteReplacements: [], tagsSeeded: false, challenges: [], diagnosisNote: '' }, { merge: true });
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
  const renderToday = () => (
    <>
      {tags.length > 0 && (
        <div className="card checkin-card">
          <div className="card-title">{t.checkinTitle}</div>
          <div className="tags" style={{ marginBottom: 12 }}>
            {tags.map(tg => (
              <span key={tg.id} className={`tag ${checkinTags.includes(tg.id) ? '' : 'off'}`}
                style={{ background: tg.color + '22', borderColor: tg.color + (checkinTags.includes(tg.id) ? '99' : '44'), color: tg.color }}
                onClick={() => toggleCheckinTag(tg.id)}>{tg.emoji} {tg.label}</span>
            ))}
          </div>
          {checkinTags.some(id => EMOTION_TAGS.includes(id) && TAG_MAP[id]) && (
            <>
              <div className="filter-bar" style={{ marginBottom: 10 }}>
                {DAYPARTS.map(dp => (
                  <div key={dp} className={`chip ${thermoDaypart === dp ? 'on' : ''}`} onClick={() => setThermoDaypart(dp)}>{t.dayparts[dp]}</div>
                ))}
              </div>
              <div className="swim-caption">
                {t.swimApplyTo}
                <div className="tags" style={{ marginTop: 6 }}>
                  {checkinTags.filter(id => EMOTION_TAGS.includes(id) && TAG_MAP[id]).map(id => {
                    const tg = TAG_MAP[id];
                    return (
                      <span key={id} className="tag readonly" style={{ background: tg.color + '22', borderColor: tg.color + '44', color: tg.color }}>
                        {tg.emoji} {tg.label}
                      </span>
                    );
                  })}
                </div>
              </div>
              <SwimScene value={thermoLevel}/>
              <div className="thermo-row">
                <div className="thermo-row-head">
                  <span style={{ color: 'var(--water)', fontWeight: 700 }}>{t.swimLevel}</span>
                  <span className="thermo-value" style={{ color: 'var(--water)' }}>{thermoLevel ?? '—'}</span>
                </div>
                <input type="range" min="0" max="10" value={thermoLevel ?? 0} style={{ accentColor: 'var(--water)' }}
                  onChange={e => setThermoLevel(Number(e.target.value))}/>
              </div>
            </>
          )}
          {behaviors.length > 0 && checkinTags.length > 0 && (
            <div className="field" style={{ marginBottom: 12 }}>
              <select value={checkinBehavior} onChange={e => setCheckinBehavior(e.target.value)}>
                <option value="">{t.checkinNoBehavior}</option>
                {behaviors.map(b => <option key={b.id} value={b.id}>{b.label}</option>)}
              </select>
            </div>
          )}
          {suggestTechniques(checkinTags).length > 0 && (
            <div className="tags" style={{ marginBottom: 12 }}>
              {suggestTechniques(checkinTags).map(tc => (
                <span key={tc.id} className="tag readonly" style={{ background: 'var(--accent-light)', borderColor: 'var(--accent)', color: 'var(--accent-deep)' }}>
                  💡 {t.copingTechniques[tc.id].title}
                </span>
              ))}
            </div>
          )}
          <button className="btn btn-ghost btn-full" style={{ marginBottom: 8 }} onClick={openQuickDetails}>🎙️ {t.addDetails}</button>
          <button className="btn btn-primary btn-full" onClick={saveQuickCheck} disabled={checkinTags.length === 0 && thermoLevel === null}>
            {checkinSaved ? t.checkinSaved : t.checkinLog}
          </button>
        </div>
      )}
    </>
  );

  const renderJournal = () => {
    const grouped = groupByDay(filtered);
    const days = Object.keys(grouped).sort((a, b) => new Date(b) - new Date(a));
    return (
      <>
        <div className="filter-bar">
          <div className={`chip ${fBehavior === 'all' ? 'on' : ''}`} onClick={() => setFBehavior('all')}>{t.all}</div>
          {behaviors.map(b => <div key={b.id} className={`chip ${fBehavior === b.id ? 'on' : ''}`} onClick={() => setFBehavior(b.id)}>{b.label}</div>)}
        </div>
        <div className="filter-bar">
          <div className={`chip ${fTag === 'all' ? 'on' : ''}`} onClick={() => setFTag('all')}>{t.allTags}</div>
          {tags.map(tg => <div key={tg.id} className={`chip ${fTag === tg.id ? 'on' : ''}`} onClick={() => setFTag(tg.id)}>{tg.emoji} {tg.label}</div>)}
        </div>
        {days.length === 0 ? (
          <div className="empty"><div className="empty-icon">🎙️</div><p>{t.noEntries}<br/>{t.tapToRecord}</p></div>
        ) : days.map(day => (
          <div key={day}>
            <div className="day-label">{formatDay(day, locale)}</div>
            {grouped[day].map(entry => {
              const b = behaviors.find(b => b.id === entry.behaviorId);
              return (
                <div key={entry.id} className="entry">
                  {b && <div className="entry-behavior">{b.label}</div>}
                  <div className="entry-transcript">"{entry.transcript}"</div>
                  {entry.replacement && <div className="entry-replacement">✦ {entry.replacement}</div>}
                  <div className="tags" style={{ marginBottom: 10 }}>
                    {entry.tags?.map(tid => { const tg = TAG_MAP[tid]; return tg ? <span key={tid} className="tag readonly" style={{ background: tg.color + '20', borderColor: tg.color + '55', color: tg.color }}>{tg.emoji} {tg.label}</span> : null; })}
                  </div>
                  <div className="entry-footer">
                    <span className="entry-date">{formatDate(entry.timestamp, locale)}</span>
                    <div style={{ display: 'flex' }}>
                      <button className="entry-delete" onClick={() => openEditEntry(entry)}><PencilIcon/></button>
                      <button className="entry-delete" onClick={() => requestConfirmation('entry', entry.id)} aria-label={t.deleteLabel}><TrashIcon/></button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
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
          {s.savedCost > 0 && <div className="stat"><div className="stat-val success">{formatMoney(s.savedCost, locale, currency)}</div><div className="stat-label">{t.savedLabel}</div></div>}
          {userProfile?.streakEnabled && s.missedLast14 < 5 && <div className="stat"><div className="stat-val">{s.streak}</div><div className="stat-label">{t.currentStreak}</div></div>}
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

      <div className="settings-section-title">{t.resourcesSection}</div>
      <div className="card">
        <button className="btn btn-ghost btn-full" onClick={() => setShowCopingToolkit(true)}>🧰 {t.copingToolkit}</button>
      </div>

      <div className="settings-section-title">{t.accountSection}</div>
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
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: dark ? '#0A1615' : '#F6FBFA', fontFamily: 'Manrope,sans-serif', color: dark ? '#8CA9A5' : '#5C7572', fontSize: '0.9rem', fontWeight: 600 }}>
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
              <div className="greeting-sub">{t.tagline}</div>
            </div>
          ) : (
            <div className="logo">
              <div className="logo-name"><span className="limit">Limit</span><span className="less">less</span></div>
              <div className="logo-sub">{t.tagline}</div>
            </div>
          )}
          <div className="header-actions">
            <button className="icon-btn" onClick={() => { const i = UI_LANGS.findIndex(l => l.code === uiLang); setUiLang(UI_LANGS[(i + 1) % UI_LANGS.length].code); }} title={t.language} style={{ fontSize: '0.7rem', fontWeight: 800 }}>{uiLang.toUpperCase()}</button>
            <button className="icon-btn" onClick={() => setThemeMode(dark ? 'light' : 'dark')} title={t.toggleTheme}>{dark ? <SunIcon/> : <MoonIcon/>}</button>
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
              <button className={`tab ${view === 'dashboard' ? 'on' : ''}`} onClick={() => setView('dashboard')}><ChartIcon/>{t.stats}</button>
              <button className={`tab ${view === 'settings' ? 'on' : ''}`} onClick={() => setView('settings')}><GearIcon/>{t.manage}</button>
            </nav>
          </>
        )}

        {/* Entry modal */}
        {showEntry && (
          <div className="overlay">
            <div ref={entryModalRef} className="modal" role="dialog" aria-modal="true" aria-labelledby="entry-modal-title">
              <div className="modal-handle"/>
              <div id="entry-modal-title" className="modal-title">{editingEntryId ? t.editEntryTitle : t.newEntry}</div>
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 7 }}>{t.voiceLangLabel}</div>
                <div className="lang-bar">{LANGS.map(l => <div key={l.code} className={`lang-chip ${recLang === l.code ? 'on' : ''}`} onClick={() => { setRecLang(l.code); if (recording) stopRec(); }}>{l.flag} {l.code.split('-')[0].toUpperCase()}</div>)}</div>
              </div>
              {recErr && <div className="error-msg">{recErr}</div>}
              {recording && <div className="rec-indicator"><div className="rec-dot"/> {t.listening}</div>}
              <textarea className="transcript-box" placeholder={recording ? t.transcribing : t.typePh} value={transcript} onChange={e => setTranscript(e.target.value)}/>
              {recording ? (
                <button className="btn btn-ghost btn-full" style={{ marginBottom: 14, borderColor: '#D07060', color: '#D07060' }} onClick={stopRec}><StopIcon/> {t.stopRecording}</button>
              ) : (
                <button className="btn btn-ghost btn-full" style={{ marginBottom: 14 }} onClick={startRec}><MicIcon/> {recErr ? t.tryAgain : t.recordBtn}</button>
              )}
              <div className="field">
                <label>{t.behavior} * {behaviorAutoFilled && '✨'}</label>
                <select value={entryForm.behaviorId} onChange={e => { setEntryForm(p => ({ ...p, behaviorId: e.target.value })); setBehaviorAutoFilled(false); }}>
                  <option value="">{t.select}</option>
                  {behaviors.map(b => <option key={b.id} value={b.id}>{b.label}</option>)}
                </select>
                {behaviors.length === 0 && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 6, fontWeight: 600 }}>{t.addFirst}</div>}
              </div>
              <div className="field">
                <label>{t.contextTriggers}</label>
                <div className="tags" style={{ marginTop: 4 }}>
                  {tags.map(tg => <span key={tg.id} className={`tag ${entryForm.tags.includes(tg.id) ? '' : 'off'} ${autoTagIds.includes(tg.id) ? 'auto' : ''}`} style={{ background: tg.color + '22', borderColor: tg.color + (entryForm.tags.includes(tg.id) ? '99' : '44'), color: tg.color }} onClick={() => toggleTag(tg.id)}>{tg.emoji} {tg.label}</span>)}
                  {tags.length === 0 && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 6, fontWeight: 600 }}>{t.addFirstTag}</div>}
                </div>
                {autoTagIds.length > 0 && <div className="auto-hint">{t.autoDetectedHint}</div>}
              </div>
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
                  <div className="onb-emoji">🌱</div>
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
                      <span key={s.id} className={`tag ${onbBehaviors.includes(s.id) ? '' : 'off'}`}
                        style={{ background: 'var(--accent-light)', borderColor: 'var(--accent)', color: 'var(--accent-deep)' }}
                        onClick={() => toggleOnbBehavior(s.id)}>{t.onboarding.behaviors[s.id]}</span>
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
