import { useState, useEffect, useRef, useCallback } from 'react';
import { auth, db } from './firebase';
import {
  onAuthStateChanged, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, signInWithPopup,
  GoogleAuthProvider, signOut, updateProfile,
} from 'firebase/auth';
import {
  collection, addDoc, deleteDoc, doc, onSnapshot,
  query, orderBy, serverTimestamp, setDoc,
} from 'firebase/firestore';
import { UI_LANGS, LOCALE, DEFAULT_VOICE, STRINGS, detectUILang } from './i18n';

// ── Constants ──────────────────────────────────────────────────────────────────
const ALL_TAGS = [
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
const TAG_MAP = Object.fromEntries(ALL_TAGS.map(t => [t.id, t]));

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
function formatMoney(n, locale) {
  return new Intl.NumberFormat(locale, { style: 'currency', currency: 'CAD' }).format(n || 0);
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
const ChartIcon = () => <Ico><line x1="18" y1="20" x2="18" y2="10" stroke="currentColor"/><line x1="12" y1="20" x2="12" y2="4" stroke="currentColor"/><line x1="6" y1="20" x2="6" y2="14" stroke="currentColor"/><line x1="2" y1="20" x2="22" y2="20" stroke="currentColor"/></Ico>;
const GearIcon  = () => <Ico d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" d2="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>;
const PlusIcon  = () => <Ico><line x1="12" y1="5" x2="12" y2="19" stroke="currentColor"/><line x1="5" y1="12" x2="19" y2="12" stroke="currentColor"/></Ico>;
const TrashIcon = () => <Ico size={17}><polyline points="3 6 5 6 21 6" stroke="currentColor"/><path d="M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2" stroke="currentColor"/></Ico>;
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

// ── CSS ────────────────────────────────────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@200;300;400;500;600;700;800;900&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { height: 100%; font-family: 'Nunito', sans-serif; }

  .app {
    --accent: #6B9E8A; --accent-deep: #4A7A68;
    --accent-light: rgba(107,158,138,0.13); --accent-ring: rgba(107,158,138,0.22);
    --warm: #E8956A; --warm-light: rgba(232,149,106,0.13);
    --success: #4D9E68; --danger: #C86050;
    --bg: #F4F2ED; --surface: #FFFFFF; --surface2: #EDEBE5; --surface3: #E4E0D8;
    --border: #DCD7CD; --text: #26201A; --text-muted: #8C8078; --text-dim: #C0B4A8;
    --shadow-sm: 0 2px 8px rgba(40,32,26,0.06);
    --shadow:    0 4px 20px rgba(40,32,26,0.09);
    --shadow-lg: 0 8px 40px rgba(40,32,26,0.14);
    --radius: 20px; --radius-sm: 12px;
    max-width: 480px; margin: 0 auto; min-height: 100vh;
    display: flex; flex-direction: column;
    background: var(--bg); color: var(--text);
    transition: background 0.3s, color 0.3s;
  }
  .app.dark {
    --accent: #7BBFAA; --accent-deep: #9ACFBC;
    --accent-light: rgba(123,191,170,0.13); --accent-ring: rgba(123,191,170,0.22);
    --warm: #E8A07A; --warm-light: rgba(232,160,122,0.13);
    --success: #6ABB88; --danger: #D07060;
    --bg: #121A18; --surface: #1A2420; --surface2: #212E29; --surface3: #293933;
    --border: #32453E; --text: #EAE8E2; --text-muted: #8CA89E; --text-dim: #4A6058;
    --shadow-sm: 0 2px 8px rgba(0,0,0,0.2);
    --shadow:    0 4px 20px rgba(0,0,0,0.3);
    --shadow-lg: 0 8px 40px rgba(0,0,0,0.5);
  }

  /* Header */
  .header { padding: calc(16px + env(safe-area-inset-top)) 16px 0; display: flex; align-items: center; justify-content: space-between; position: relative; }
  .header::before { content: ''; position: absolute; inset: 0; background: radial-gradient(ellipse at 20% 0%, var(--accent-ring) 0%, transparent 55%), radial-gradient(ellipse at 85% 30%, var(--warm-light) 0%, transparent 45%); pointer-events: none; }
  .logo { position: relative; z-index: 1; line-height: 1; cursor: default; }
  .logo-name { font-size: 1.5rem; line-height: 1; letter-spacing: -1px; }
  .logo-name .be { font-weight: 200; color: var(--text-muted); }
  .logo-name .have { font-weight: 900; color: var(--accent); }
  .logo-sub { font-size: 0.7rem; color: var(--text-dim); font-weight: 600; margin-top: 1px; letter-spacing: 0.5px; text-transform: uppercase; }
  .header-actions { display: flex; align-items: center; gap: 8px; position: relative; z-index: 1; }
  .icon-btn { width: 42px; height: 42px; border-radius: 50%; border: 1.5px solid var(--border); background: var(--surface); color: var(--text-muted); cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: var(--shadow-sm); transition: all 0.2s; }
  .icon-btn:hover { color: var(--accent); border-color: var(--accent); }
  .icon-btn.danger:hover { color: var(--danger); border-color: var(--danger); }
  .user-pill { display: flex; align-items: center; gap: 7px; background: var(--surface); border: 1.5px solid var(--border); border-radius: 20px; padding: 6px 14px 6px 8px; cursor: default; box-shadow: var(--shadow-sm); }
  .user-pill-av { width: 22px; height: 22px; border-radius: 50%; background: linear-gradient(135deg, var(--accent), var(--accent-deep)); color: white; font-size: 0.7rem; font-weight: 800; display: flex; align-items: center; justify-content: center; }
  .user-pill-name { font-size: 0.8rem; font-weight: 700; color: var(--text); }

  /* Content */
  .content { flex: 1; padding: 14px 16px calc(110px + env(safe-area-inset-bottom)); overflow-y: auto; -webkit-overflow-scrolling: touch; }

  /* ── Bottom Tab Bar (native pattern) ── */
  .tabbar {
    position: fixed; bottom: 0; left: 50%; transform: translateX(-50%);
    width: 100%; max-width: 480px;
    background: var(--surface);
    border-top: 1.5px solid var(--border);
    display: flex; align-items: stretch;
    padding: 6px 8px calc(6px + env(safe-area-inset-bottom));
    z-index: 100;
    box-shadow: 0 -4px 24px rgba(0,0,0,0.08);
  }
  .app.dark .tabbar { box-shadow: 0 -4px 24px rgba(0,0,0,0.35); }
  .tab {
    flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 3px; padding: 6px 4px; min-height: 52px;
    border: none; background: transparent; border-radius: 14px;
    color: var(--text-muted); cursor: pointer;
    font-family: 'Nunito', sans-serif; font-size: 0.62rem; font-weight: 800;
    letter-spacing: 0.3px;
    transition: color 0.15s, transform 0.1s;
    -webkit-tap-highlight-color: transparent;
  }
  .tab:active { transform: scale(0.92); }
  .tab.on { color: var(--accent); }
  .tab svg { width: 23px; height: 23px; }

  /* Center FAB in tab bar */
  .tab-fab-slot { flex: 1.2; display: flex; align-items: center; justify-content: center; position: relative; }
  .record-btn {
    width: 60px; height: 60px; border-radius: 50%; border: none;
    cursor: pointer; display: flex; align-items: center; justify-content: center;
    position: relative; margin-top: -26px;
    transition: transform 0.15s;
    -webkit-tap-highlight-color: transparent;
  }
  .record-btn:active { transform: scale(0.92); }
  .record-btn.idle { background: linear-gradient(145deg, var(--accent), var(--accent-deep)); color: white; box-shadow: 0 6px 24px var(--accent-ring), 0 2px 8px rgba(0,0,0,0.15); }
  .record-btn.active { background: linear-gradient(145deg, #E07060, #C05040); color: white; box-shadow: 0 6px 24px rgba(192,80,64,0.35); }
  .record-btn.idle::before, .record-btn.idle::after { content: ''; position: absolute; inset: -7px; border-radius: 50%; border: 2px solid var(--accent); opacity: 0; animation: breathe 3s ease-in-out infinite; }
  .record-btn.idle::after { animation-delay: 1.5s; }
  .record-btn.active::before, .record-btn.active::after { content: ''; position: absolute; inset: -7px; border-radius: 50%; border: 2px solid #E07060; opacity: 0; animation: breathe 1.4s ease-in-out infinite; }
  .record-btn.active::after { animation-delay: 0.7s; }
  @keyframes breathe { 0%{transform:scale(0.9);opacity:0.5} 50%{transform:scale(1.2);opacity:0} 100%{transform:scale(1.4);opacity:0} }

  /* Cards */
  .card { background: var(--surface); border: 1.5px solid var(--border); border-radius: var(--radius); padding: 18px; margin-bottom: 12px; box-shadow: var(--shadow-sm); }
  .card-title { font-size: 0.7rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 14px; }

  /* Stats */
  .stat-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px; }
  .stat { background: var(--surface); border: 1.5px solid var(--border); border-radius: var(--radius); padding: 16px 14px; box-shadow: var(--shadow-sm); }
  .stat-val { font-size: 2rem; font-weight: 900; color: var(--accent); line-height: 1; letter-spacing: -1px; }
  .stat-val.success { color: var(--success); } .stat-val.danger { color: var(--danger); } .stat-val.warm { color: var(--warm); }
  .stat-label { font-size: 0.72rem; font-weight: 600; color: var(--text-muted); margin-top: 4px; }

  /* Tags */
  .tags { display: flex; flex-wrap: wrap; gap: 6px; }
  .tag { display: inline-flex; align-items: center; gap: 4px; padding: 8px 13px; min-height: 36px; border-radius: 100px; font-size: 0.76rem; font-weight: 700; border: 1.5px solid transparent; cursor: pointer; transition: all 0.15s; user-select: none; -webkit-tap-highlight-color: transparent; }
  .tag:active { transform: scale(0.94); }
  .tag.off { opacity: 0.38; } .tag.readonly { cursor: default; opacity: 1; }

  /* Journal */
  .entry { background: var(--surface); border: 1.5px solid var(--border); border-radius: var(--radius); padding: 16px; margin-bottom: 10px; box-shadow: var(--shadow-sm); transition: box-shadow 0.2s; }
  .entry:hover { box-shadow: var(--shadow); }
  .entry-behavior { display: inline-flex; background: var(--accent-light); color: var(--accent-deep); font-size: 0.7rem; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase; padding: 3px 10px; border-radius: 100px; margin-bottom: 8px; }
  .app.dark .entry-behavior { color: var(--accent); }
  .entry-transcript { font-size: 0.9rem; color: var(--text); line-height: 1.55; margin-bottom: 10px; font-style: italic; font-weight: 500; }
  .entry-replacement { font-size: 0.78rem; color: var(--success); font-weight: 700; margin-bottom: 8px; }
  .entry-footer { display: flex; align-items: center; justify-content: space-between; }
  .entry-date { font-size: 0.7rem; color: var(--text-dim); font-weight: 600; }
  .entry-delete { background: none; border: none; color: var(--text-dim); cursor: pointer; padding: 10px; margin: -6px; border-radius: 8px; transition: color 0.15s; display: flex; }
  .entry-delete:hover { color: var(--danger); }
  .day-label { font-size: 0.7rem; font-weight: 800; color: var(--text-dim); text-transform: uppercase; letter-spacing: 1px; padding: 12px 0 6px; }

  /* Savings */
  .savings-card { background: linear-gradient(135deg, var(--accent-light), var(--warm-light)); border: 1.5px solid var(--border); border-radius: var(--radius); padding: 20px; text-align: center; margin-bottom: 12px; box-shadow: var(--shadow-sm); }
  .savings-amount { font-size: 2.8rem; font-weight: 900; color: var(--success); letter-spacing: -1.5px; line-height: 1; }
  .savings-label { font-size: 0.8rem; font-weight: 600; color: var(--text-muted); margin-top: 6px; }

  /* Bars */
  .bar-row { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
  .bar-label { font-size: 0.78rem; font-weight: 600; color: var(--text-muted); width: 100px; flex-shrink: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .bar-track { flex: 1; height: 8px; background: var(--surface2); border-radius: 100px; overflow: hidden; }
  .bar-fill { height: 100%; border-radius: 100px; background: var(--accent); transition: width 0.5s cubic-bezier(.4,0,.2,1); }
  .bar-count { font-size: 0.72rem; font-weight: 700; color: var(--text-dim); width: 24px; text-align: right; }

  /* Filters */
  .filter-bar { display: flex; gap: 6px; margin-bottom: 12px; overflow-x: auto; padding-bottom: 2px; scrollbar-width: none; }
  .filter-bar::-webkit-scrollbar { display: none; }
  .chip { white-space: nowrap; padding: 9px 16px; min-height: 38px; display: inline-flex; align-items: center; border-radius: 100px; border: 1.5px solid var(--border); background: var(--surface); color: var(--text-muted); font-family: 'Nunito', sans-serif; font-size: 0.78rem; font-weight: 700; cursor: pointer; transition: all 0.15s; box-shadow: var(--shadow-sm); -webkit-tap-highlight-color: transparent; }
  .chip:active { transform: scale(0.95); }
  .chip.on { background: var(--accent-light); border-color: var(--accent); color: var(--accent-deep); }
  .app.dark .chip.on { color: var(--accent); }

  /* Behaviors */
  .behavior-item { display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; background: var(--surface2); border-radius: var(--radius-sm); margin-bottom: 8px; border: 1.5px solid var(--border); }
  .behavior-name { font-size: 0.88rem; font-weight: 700; }
  .behavior-cost { font-size: 0.75rem; font-weight: 600; color: var(--warm); margin-top: 2px; }

  /* Modals */
  .overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.45); display: flex; align-items: flex-end; z-index: 200; backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); }
  .modal { background: var(--surface); border: 1.5px solid var(--border); border-radius: 24px 24px 0 0; padding: 6px 18px calc(28px + env(safe-area-inset-bottom)); width: 100%; max-width: 480px; margin: 0 auto; max-height: 90dvh; overflow-y: auto; -webkit-overflow-scrolling: touch; box-shadow: var(--shadow-lg); animation: sheet-up 0.28s cubic-bezier(.32,.72,.27,1); }
  @keyframes sheet-up { from { transform: translateY(40px); opacity: 0.6; } to { transform: translateY(0); opacity: 1; } }
  .modal-handle { width: 36px; height: 4px; border-radius: 2px; background: var(--border); margin: 12px auto 20px; }
  .modal-title { font-size: 1.2rem; font-weight: 900; color: var(--text); margin-bottom: 18px; }
  .modal-actions { display: flex; gap: 10px; margin-top: 20px; }

  /* Form */
  .field { margin-bottom: 14px; }
  .field label { display: block; font-size: 0.72rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 7px; }
  .field input, .field select, .field textarea { width: 100%; background: var(--surface2); border: 1.5px solid var(--border); border-radius: var(--radius-sm); padding: 13px 14px; color: var(--text); font-family: 'Nunito', sans-serif; font-size: 16px; font-weight: 600; outline: none; transition: border-color 0.2s, box-shadow 0.2s; min-height: 48px; }
  .field input:focus, .field select:focus, .field textarea:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-light); }
  .field textarea { resize: vertical; min-height: 80px; }
  select option { background: var(--surface2); }

  /* Buttons */
  .btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 13px 20px; min-height: 48px; border-radius: var(--radius-sm); border: none; cursor: pointer; font-family: 'Nunito', sans-serif; font-size: 0.92rem; font-weight: 800; transition: all 0.15s; -webkit-tap-highlight-color: transparent; }
  .btn:active { transform: scale(0.97); }
  .btn-primary { background: var(--accent); color: white; box-shadow: 0 4px 16px var(--accent-ring); }
  .btn-primary:hover { background: var(--accent-deep); }
  .btn-primary:disabled { opacity: 0.4; cursor: not-allowed; box-shadow: none; }
  .btn-ghost { background: var(--surface2); color: var(--text-muted); border: 1.5px solid var(--border); }
  .btn-ghost:hover { border-color: var(--text-muted); color: var(--text); }
  .btn-google { background: white; color: #444; border: 1.5px solid #DDD; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
  .btn-google:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.12); }
  .app.dark .btn-google { background: var(--surface2); color: var(--text); border-color: var(--border); }
  .btn-full { width: 100%; } .btn-sm { padding: 7px 14px; font-size: 0.8rem; }

  /* Transcript */
  .transcript-box { display: block; width: 100%; background: var(--surface2); border: 1.5px solid var(--accent); border-radius: var(--radius-sm); padding: 14px; font-size: 16px; font-weight: 600; font-family: 'Nunito', sans-serif; line-height: 1.6; min-height: 88px; color: var(--text); font-style: italic; margin-bottom: 14px; box-shadow: 0 0 0 3px var(--accent-light); resize: vertical; outline: none; }
  .transcript-box::placeholder { color: var(--text-dim); font-style: italic; }
  .rec-indicator { display: flex; align-items: center; gap: 8px; font-size: 0.8rem; font-weight: 700; color: #D07060; margin-bottom: 12px; }
  .rec-dot { width: 8px; height: 8px; border-radius: 50%; background: #D07060; animation: blink 1s infinite; }
  @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.25} }

  /* Lang */
  .lang-bar { display: flex; gap: 6px; overflow-x: auto; padding-bottom: 4px; scrollbar-width: none; margin-bottom: 14px; }
  .lang-bar::-webkit-scrollbar { display: none; }
  .lang-chip { display: inline-flex; align-items: center; gap: 4px; white-space: nowrap; padding: 9px 14px; min-height: 38px; border-radius: 100px; border: 1.5px solid var(--border); background: var(--surface2); color: var(--text-muted); font-family: 'Nunito', sans-serif; font-size: 0.73rem; font-weight: 700; cursor: pointer; transition: all 0.15s; }
  .lang-chip.on { background: var(--accent-light); border-color: var(--accent); color: var(--accent-deep); }
  .app.dark .lang-chip.on { color: var(--accent); }

  /* Error / Success */
  .error-msg { background: rgba(200,80,64,0.1); border: 1.5px solid rgba(200,80,64,0.3); border-radius: var(--radius-sm); padding: 10px 14px; font-size: 0.82rem; font-weight: 600; color: var(--danger); margin-bottom: 12px; }
  .divider { display: flex; align-items: center; gap: 12px; margin: 16px 0; color: var(--text-dim); font-size: 0.75rem; font-weight: 700; }
  .divider::before, .divider::after { content: ''; flex: 1; height: 1px; background: var(--border); }

  /* Empty */
  .empty { text-align: center; padding: 56px 20px; color: var(--text-dim); }
  .empty-icon { font-size: 3rem; margin-bottom: 12px; }
  .empty p { font-size: 0.88rem; font-weight: 600; line-height: 1.7; }

  /* Auth screen */
  .auth-screen { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px 24px 60px; position: relative; overflow: hidden; }
  .auth-screen::before { content: ''; position: absolute; inset: 0; z-index: 0; background-image: radial-gradient(circle, var(--border) 1.5px, transparent 1.5px); background-size: 28px 28px; opacity: 0.7; pointer-events: none; }
  .auth-screen > * { position: relative; z-index: 1; width: 100%; }
  .auth-orb { width: 72px; height: 72px; border-radius: 50%; background: radial-gradient(circle at 38% 32%, rgba(255,255,255,0.5) 0%, var(--accent) 30%, var(--accent-deep) 65%, rgba(0,0,0,0.15) 100%); box-shadow: 0 16px 48px var(--accent-ring), inset -4px -8px 16px rgba(0,0,0,0.18), inset 6px 5px 16px rgba(255,255,255,0.22); margin: 0 auto 20px; animation: orb-float 5s ease-in-out infinite; }
  .auth-wordmark { font-size: 3rem; line-height: 1; letter-spacing: -2px; margin-bottom: 4px; text-align: center; }
  .auth-wordmark .be { font-weight: 200; color: var(--text-muted); }
  .auth-wordmark .have { font-weight: 900; color: var(--accent); }
  .auth-tagline { font-size: 0.85rem; color: var(--text-muted); font-weight: 600; text-align: center; margin-bottom: 28px; }
  .auth-card { background: var(--surface); border: 1.5px solid var(--border); border-radius: var(--radius); padding: 24px 20px; box-shadow: var(--shadow); }
  .auth-toggle { display: flex; justify-content: center; gap: 6px; font-size: 0.82rem; font-weight: 600; color: var(--text-muted); margin-top: 16px; text-align: center; }
  .auth-toggle span { color: var(--accent); cursor: pointer; font-weight: 800; }
  .auth-toggle span:hover { text-decoration: underline; }
  @keyframes orb-float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }

  /* Welcome */
  .welcome { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 40px 28px 60px; position: relative; overflow: hidden; }
  .welcome::before { content: ''; position: absolute; inset: 0; z-index: 0; background-image: radial-gradient(circle, var(--border) 1.5px, transparent 1.5px); background-size: 28px 28px; opacity: 0.7; pointer-events: none; }
  .welcome > * { position: relative; z-index: 1; }
  .hero-orb { width: 96px; height: 96px; border-radius: 50%; background: radial-gradient(circle at 38% 32%, rgba(255,255,255,0.5) 0%, var(--accent) 30%, var(--accent-deep) 65%, rgba(0,0,0,0.15) 100%); box-shadow: 0 20px 60px var(--accent-ring), inset -4px -8px 16px rgba(0,0,0,0.18), inset 8px 6px 20px rgba(255,255,255,0.22); margin-bottom: 28px; animation: orb-float 5s ease-in-out infinite; }
  .hero-wordmark { font-size: 4.2rem; line-height: 1; letter-spacing: -3px; margin-bottom: 10px; }
  .hero-wordmark .be { font-weight: 200; color: var(--text-muted); }
  .hero-wordmark .have { font-weight: 900; color: var(--accent); }
  .hero-tagline { font-size: 1.05rem; font-weight: 700; color: var(--text); margin-bottom: 8px; letter-spacing: -0.3px; }
  .hero-sub { font-size: 0.88rem; font-weight: 500; color: var(--text-muted); line-height: 1.65; max-width: 280px; margin: 0 auto 24px; }
  .hero-features { display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; margin-bottom: 28px; }
  .hero-feat { padding: 7px 14px; border-radius: 100px; background: var(--surface); border: 1.5px solid var(--border); font-size: 0.78rem; font-weight: 700; color: var(--text-muted); box-shadow: var(--shadow-sm); }
`;

// ── Auth Screen ────────────────────────────────────────────────────────────────
function AuthScreen({ t }) {
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
  const authErr = (err) => t[AUTH_ERR_KEYS[err.code]] || err.message;

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
        await setDoc(doc(db, 'users', cred.user.uid), { name: displayName, createdAt: serverTimestamp() });
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
      await setDoc(doc(db, 'users', cred.user.uid), { name: cred.user.displayName || 'User', createdAt: serverTimestamp() }, { merge: true });
    } catch (err) {
      setError(authErr(err));
    } finally { setLoading(false); }
  }

  return (
    <div className="auth-screen">
      <div className="auth-orb"/>
      <div className="auth-wordmark"><span className="be">Be</span><span className="have">have</span></div>
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
            <input type="password" placeholder={mode === 'signup' ? t.passwordPhSignup : '••••••••'} value={password} onChange={e => setPassword(e.target.value)} required autoComplete={mode === 'login' ? 'current-password' : 'new-password'}/>
          </div>
          <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
            {loading ? '…' : mode === 'login' ? t.signIn : t.createAccount}
          </button>
        </form>
      </div>

      <div className="auth-toggle">
        {mode === 'login' ? <>{t.noAccount}&nbsp;<span onClick={() => { setMode('signup'); setError(''); }}>{t.createOne}</span></> : <>{t.haveAccount}&nbsp;<span onClick={() => { setMode('login'); setError(''); }}>{t.signInLink}</span></>}
      </div>
    </div>
  );
}

// ── Main App ───────────────────────────────────────────────────────────────────
export default function App() {
  const [dark,      setDark]      = useState(() => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false);
  const [uiLang,    setUiLang]    = useState(() => localStorage.getItem('behave_uilang') || detectUILang());
  const [user,      setUser]      = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [behaviors, setBehaviors] = useState([]);
  const [entries,   setEntries]   = useState([]);
  const [recLang,   setRecLang]   = useState(() => localStorage.getItem('behave_voicelang') || DEFAULT_VOICE[localStorage.getItem('behave_uilang') || detectUILang()]);
  const [view,      setView]      = useState('journal');
  const [recording, setRecording] = useState(false);
  const [transcript,setTranscript]= useState('');
  const [recErr,    setRecErr]    = useState('');
  const [showEntry, setShowEntry] = useState(false);
  const [showNewB,  setShowNewB]  = useState(false);
  const [entryForm, setEntryForm] = useState({ behaviorId: '', tags: [], replacement: '', note: '' });
  const [newBForm,  setNewBForm]  = useState({ label: '', cost: '' });
  const [fBehavior, setFBehavior] = useState('all');
  const [fTag,      setFTag]      = useState('all');
  const recRef = useRef(null);

  // ── Auth listener ────────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => { setUser(u); setAuthReady(true); });
    return unsub;
  }, []);

  // ── Firestore listeners ──────────────────────────────────────────────────
  useEffect(() => {
    if (!user) { setBehaviors([]); setEntries([]); return; }
    const bRef = collection(db, 'users', user.uid, 'behaviors');
    const eRef = query(collection(db, 'users', user.uid, 'entries'), orderBy('timestamp', 'desc'));
    const unsubB = onSnapshot(bRef, snap => setBehaviors(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubE = onSnapshot(eRef, snap => setEntries(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => { unsubB(); unsubE(); };
  }, [user?.uid]);

  // ── Dark mode ────────────────────────────────────────────────────────────
  useEffect(() => { document.body.style.background = dark ? '#121A18' : '#F4F2ED'; }, [dark]);

  // ── i18n ──────────────────────────────────────────────────────────────────
  const t = STRINGS[uiLang];
  const locale = LOCALE[uiLang];
  useEffect(() => { localStorage.setItem('behave_uilang', uiLang); document.documentElement.lang = uiLang; }, [uiLang]);
  useEffect(() => { localStorage.setItem('behave_voicelang', recLang); }, [recLang]);
  const tagLabel = (id) => t.tags[id] || id;

  // ── Behaviors ─────────────────────────────────────────────────────────────
  async function addBehavior() {
    if (!newBForm.label.trim() || !user) return;
    await addDoc(collection(db, 'users', user.uid, 'behaviors'), { label: newBForm.label.trim(), cost: parseFloat(newBForm.cost) || 0, createdAt: serverTimestamp() });
    setNewBForm({ label: '', cost: '' }); setShowNewB(false);
  }
  async function delBehavior(id) {
    if (!user) return;
    await deleteDoc(doc(db, 'users', user.uid, 'behaviors', id));
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
  async function saveEntry() {
    if (!entryForm.behaviorId || !transcript.trim() || !user) return;
    await addDoc(collection(db, 'users', user.uid, 'entries'), {
      behaviorId: entryForm.behaviorId, timestamp: Date.now(),
      transcript: transcript.trim(), tags: entryForm.tags,
      replacement: entryForm.replacement, note: entryForm.note,
      createdAt: serverTimestamp(),
    });
    setShowEntry(false); setTranscript(''); setEntryForm({ behaviorId: '', tags: [], replacement: '', note: '' });
  }
  async function delEntry(id) {
    if (!user) return;
    await deleteDoc(doc(db, 'users', user.uid, 'entries', id));
  }
  const toggleTag = id => setEntryForm(p => ({ ...p, tags: p.tags.includes(id) ? p.tags.filter(t => t !== id) : [...p.tags, id] }));
  const closeEntry = () => { setShowEntry(false); stopRec(); setTranscript(''); setEntryForm({ behaviorId: '', tags: [], replacement: '', note: '' }); };

  // ── Stats ─────────────────────────────────────────────────────────────────
  const stats = (() => {
    const es = entries;
    const total = es.length;
    const totalCost = es.reduce((s, e) => s + (behaviors.find(b => b.id === e.behaviorId)?.cost || 0), 0);
    const replaced  = es.filter(e => e.tags?.includes('replaced')).length;
    const savedCost = es.filter(e => e.tags?.includes('replaced')).reduce((s, e) => s + (behaviors.find(b => b.id === e.behaviorId)?.cost || 0), 0);
    const now = Date.now();
    const last7 = es.filter(e => e.timestamp > now - 7 * 86400000).length;
    const prev7 = es.filter(e => e.timestamp > now - 14 * 86400000 && e.timestamp <= now - 7 * 86400000).length;
    const tagCounts = {};
    es.forEach(e => e.tags?.forEach(t => { tagCounts[t] = (tagCounts[t] || 0) + 1; }));
    const topTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const byBehavior = behaviors.map(b => ({ ...b, count: es.filter(e => e.behaviorId === b.id).length }));
    return { total, totalCost, replaced, savedCost, last7, prev7, trend: last7 - prev7, topTags, byBehavior };
  })();

  const filtered = entries.filter(e => {
    if (fBehavior !== 'all' && e.behaviorId !== fBehavior) return false;
    if (fTag !== 'all' && !e.tags?.includes(fTag)) return false;
    return true;
  });

  // ── Render views ──────────────────────────────────────────────────────────
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
          {ALL_TAGS.map(tg => <div key={tg.id} className={`chip ${fTag === tg.id ? 'on' : ''}`} onClick={() => setFTag(tg.id)}>{tg.emoji} {tagLabel(tg.id)}</div>)}
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
                    {entry.tags?.map(tid => { const tg = TAG_MAP[tid]; return tg ? <span key={tid} className="tag readonly" style={{ background: tg.color + '20', borderColor: tg.color + '55', color: tg.color }}>{tg.emoji} {tagLabel(tid)}</span> : null; })}
                  </div>
                  <div className="entry-footer">
                    <span className="entry-date">{formatDate(entry.timestamp, locale)}</span>
                    <button className="entry-delete" onClick={() => delEntry(entry.id)}><TrashIcon/></button>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </>
    );
  };

  const renderDashboard = () => {
    const s = stats;
    const bMax = Math.max(...s.byBehavior.map(x => x.count), 1);
    return (
      <>
        <div className="card">
          <div className="card-title">{t.activity14}</div>
          <WaveSparkline entries={entries}/>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
            <span style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-dim)' }}>{t.d14ago}</span>
            <span style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-dim)' }}>{t.today}</span>
          </div>
        </div>
        <div className="stat-grid">
          <div className="stat"><div className="stat-val">{s.total}</div><div className="stat-label">{t.totalEntries}</div></div>
          <div className="stat"><div className={`stat-val ${s.trend < 0 ? 'success' : s.trend > 0 ? 'danger' : ''}`}>{s.last7}{s.trend < 0 ? ' ↓' : s.trend > 0 ? ' ↑' : ''}</div><div className="stat-label">{t.thisWeek}</div></div>
          <div className="stat"><div className="stat-val success">{s.total ? Math.round((s.replaced / s.total) * 100) : 0}%</div><div className="stat-label">{t.replaced}</div></div>
          <div className="stat"><div className="stat-val warm">{formatMoney(s.totalCost, locale)}</div><div className="stat-label">{t.estCost}</div></div>
        </div>
        {s.savedCost > 0 && (
          <div className="savings-card">
            <div style={{ fontSize: '2rem', marginBottom: 8 }}>🌱</div>
            <div className="savings-amount">{formatMoney(s.savedCost, locale)}</div>
            <div className="savings-label">{t.savedBy(s.replaced)}</div>
          </div>
        )}
        {s.byBehavior.length > 0 && (
          <div className="card">
            <div className="card-title">{t.byBehavior}</div>
            {s.byBehavior.map(b => <div key={b.id} className="bar-row"><div className="bar-label" title={b.label}>{b.label}</div><div className="bar-track"><div className="bar-fill" style={{ width: `${(b.count / bMax) * 100}%` }}/></div><div className="bar-count">{b.count}</div></div>)}
          </div>
        )}
        {s.topTags.length > 0 && (
          <div className="card">
            <div className="card-title">{t.topTriggers}</div>
            {s.topTags.map(([tid, cnt]) => { const tg = TAG_MAP[tid]; if (!tg) return null; return <div key={tid} className="bar-row"><div className="bar-label">{tg.emoji} {tagLabel(tid)}</div><div className="bar-track"><div className="bar-fill" style={{ width: `${(cnt / s.topTags[0][1]) * 100}%`, background: tg.color }}/></div><div className="bar-count">{cnt}</div></div>; })}
          </div>
        )}
        {s.total === 0 && <div className="empty"><div className="empty-icon">📊</div><p>{t.statsEmpty}</p></div>}
      </>
    );
  };

  const renderSettings = () => (
    <>
      <div className="card">
        <div className="card-title">{t.myBehaviors}</div>
        {behaviors.length === 0 && <p style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 14 }}>{t.noBehaviors}</p>}
        {behaviors.map(b => (
          <div key={b.id} className="behavior-item">
            <div><div className="behavior-name">{b.label}</div><div className="behavior-cost">{b.cost > 0 ? `${formatMoney(b.cost, locale)} ${t.perOccurrence}` : t.noCost}</div></div>
            <button className="entry-delete" onClick={() => delBehavior(b.id)}><TrashIcon/></button>
          </div>
        ))}
        <button className="btn btn-ghost btn-sm btn-full" style={{ marginTop: 6 }} onClick={() => setShowNewB(true)}><PlusIcon/> {t.addBehavior}</button>
      </div>
      <div className="card">
        <div className="card-title">{t.uiLanguage}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {UI_LANGS.map(l => <div key={l.code} className={`lang-chip ${uiLang === l.code ? 'on' : ''}`} onClick={() => setUiLang(l.code)}>{l.flag} {l.label}</div>)}
        </div>
      </div>
      <div className="card">
        <div className="card-title">{t.voiceLanguage}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {LANGS.map(l => <div key={l.code} className={`lang-chip ${recLang === l.code ? 'on' : ''}`} onClick={() => setRecLang(l.code)}>{l.flag} {l.label}</div>)}
        </div>
      </div>
    </>
  );

  // ── Loading ───────────────────────────────────────────────────────────────
  if (!authReady) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: dark ? '#121A18' : '#F4F2ED', fontFamily: 'Nunito,sans-serif', color: '#4A6058', fontSize: '0.9rem', fontWeight: 600 }}>
      {STRINGS[uiLang].loading}
    </div>
  );

  return (
    <>
      <style>{CSS}</style>
      <div className={`app${dark ? ' dark' : ''}`}>

        {/* Header */}
        <div className="header">
          <div className="logo">
            <div className="logo-name"><span className="be">Be</span><span className="have">have</span></div>
            <div className="logo-sub">{t.tagline}</div>
          </div>
          <div className="header-actions">
            <button className="icon-btn" onClick={() => { const i = UI_LANGS.findIndex(l => l.code === uiLang); setUiLang(UI_LANGS[(i + 1) % UI_LANGS.length].code); }} title="Language" style={{ fontSize: '0.7rem', fontWeight: 800 }}>{uiLang.toUpperCase()}</button>
            <button className="icon-btn" onClick={() => setDark(d => !d)} title="Toggle theme">{dark ? <SunIcon/> : <MoonIcon/>}</button>
            {user && (
              <>
                <div className="user-pill">
                  <div className="user-pill-av">{(user.displayName || user.email || '?')[0].toUpperCase()}</div>
                  <div className="user-pill-name">{user.displayName || user.email?.split('@')[0]}</div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Not authenticated → auth screen */}
        {!user && <AuthScreen t={t}/>}

        {/* Authenticated → app */}
        {user && (
          <>
            <div className="content">
              {view === 'journal'   && renderJournal()}
              {view === 'dashboard' && renderDashboard()}
              {view === 'settings'  && renderSettings()}
            </div>
            <nav className="tabbar">
              <button className={`tab ${view === 'journal' ? 'on' : ''}`} onClick={() => setView('journal')}><BookIcon/>{t.journal}</button>
              <button className={`tab ${view === 'dashboard' ? 'on' : ''}`} onClick={() => setView('dashboard')}><ChartIcon/>{t.stats}</button>
              <div className="tab-fab-slot">
                <button className={`record-btn ${recording ? 'active' : 'idle'}`} onClick={recording ? stopRec : startRec} aria-label={recording ? t.stop : t.record}>
                  {recording ? <StopIcon/> : <MicIcon/>}
                </button>
              </div>
              <button className={`tab ${view === 'settings' ? 'on' : ''}`} onClick={() => setView('settings')}><GearIcon/>{t.manage}</button>
              <button className="tab" onClick={() => signOut(auth)}><LogoutIcon/>{t.signOut.split(' ')[0]}</button>
            </nav>
          </>
        )}

        {/* Entry modal */}
        {showEntry && (
          <div className="overlay">
            <div className="modal">
              <div className="modal-handle"/>
              <div className="modal-title">{t.newEntry}</div>
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
                <label>{t.behavior} *</label>
                <select value={entryForm.behaviorId} onChange={e => setEntryForm(p => ({ ...p, behaviorId: e.target.value }))}>
                  <option value="">{t.select}</option>
                  {behaviors.map(b => <option key={b.id} value={b.id}>{b.label}</option>)}
                </select>
                {behaviors.length === 0 && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 6, fontWeight: 600 }}>{t.addFirst}</div>}
              </div>
              <div className="field">
                <label>{t.contextTriggers}</label>
                <div className="tags" style={{ marginTop: 4 }}>
                  {ALL_TAGS.map(tg => <span key={tg.id} className={`tag ${entryForm.tags.includes(tg.id) ? '' : 'off'}`} style={{ background: tg.color + '22', borderColor: tg.color + (entryForm.tags.includes(tg.id) ? '99' : '44'), color: tg.color }} onClick={() => toggleTag(tg.id)}>{tg.emoji} {tagLabel(tg.id)}</span>)}
                </div>
              </div>
              <div className="field">
                <label>{t.replacementLabel}</label>
                <input type="text" placeholder={t.replacementPh} value={entryForm.replacement} onChange={e => setEntryForm(p => ({ ...p, replacement: e.target.value }))}/>
              </div>
              <div className="field">
                <label>{t.noteLabel}</label>
                <textarea placeholder={t.notePh} value={entryForm.note} onChange={e => setEntryForm(p => ({ ...p, note: e.target.value }))}/>
              </div>
              <div className="modal-actions">
                <button className="btn btn-ghost" style={{ flex: 1 }} onClick={closeEntry}>{t.cancel}</button>
                <button className="btn btn-primary" style={{ flex: 2 }} onClick={saveEntry} disabled={!entryForm.behaviorId || !transcript.trim()}>{t.saveEntry}</button>
              </div>
            </div>
          </div>
        )}

        {/* New behavior modal */}
        {showNewB && (
          <div className="overlay" onClick={() => setShowNewB(false)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="modal-handle"/>
              <div className="modal-title">{t.newBehavior}</div>
              <div className="field"><label>{t.bNameLabel} *</label><input type="text" placeholder={t.bNamePh} value={newBForm.label} onChange={e => setNewBForm(p => ({ ...p, label: e.target.value }))}/></div>
              <div className="field"><label>{t.bCostLabel}</label><input type="number" min="0" step="0.01" placeholder={t.bCostPh} value={newBForm.cost} onChange={e => setNewBForm(p => ({ ...p, cost: e.target.value }))}/></div>
              <div className="modal-actions">
                <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setShowNewB(false)}>{t.cancel}</button>
                <button className="btn btn-primary" style={{ flex: 2 }} onClick={addBehavior} disabled={!newBForm.label.trim()}>{t.addBehaviorBtn}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
