export const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Baloo+2:wght@500;600;700;800&family=Manrope:wght@400;500;600;700;800&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { height: 100%; font-family: 'Manrope', sans-serif; -webkit-font-smoothing: antialiased; }

  .app {
    --font-display: 'Baloo 2', sans-serif;
    --accent: #1C86D9; --accent-deep: #0B5A8A;
    --accent-light: rgba(28,134,217,0.12); --accent-ring: rgba(28,134,217,0.28);
    --warm: #FF7A5C; --warm-deep: #E05A3E; --warm-light: rgba(255,122,92,0.14);
    --gold: #FFC24B; --gold-deep: #E0A020; --gold-light: rgba(255,194,75,0.18);
    --success: #14A974; --danger: #FF5A52;
    --water: #0E6FA8;
    --bg: #D6EEF7; --surface: #FFFFFF; --surface2: #EEF6F5; --surface3: #E1EEEC;
    --surface-glass: rgba(255,255,255,0.86);
    --warm-flat-bg: #FFDAD3; --gold-flat-bg: #FFECC2;
    --border: #E0EDEB; --text: #0E2322; --text-muted: #5C7572; --text-dim: #9EB4B1;
    --shadow-sm: 0 2px 12px rgba(14,35,34,0.06);
    --shadow:    0 10px 30px rgba(14,35,34,0.10);
    --shadow-lg: 0 20px 54px rgba(14,35,34,0.18);
    --radius: 26px; --radius-sm: 16px;
    max-width: 480px; margin: 0 auto; min-height: 100vh;
    display: flex; flex-direction: column;
    background: var(--bg); color: var(--text);
    position: relative; isolation: isolate;
    transition: background-color 0.3s, color 0.3s;
  }
  .app.dark {
    --accent: #4FB4F0; --accent-deep: #8CD2FF;
    --accent-light: rgba(79,180,240,0.14); --accent-ring: rgba(79,180,240,0.3);
    --warm: #FF9387; --warm-deep: #FFB3A8; --warm-light: rgba(255,147,135,0.14);
    --gold: #FFCB5C; --gold-deep: #FFDD8C; --gold-light: rgba(255,203,92,0.16);
    --success: #4FE2A8; --danger: #FF7A72;
    --water: #1E88C9;
    --bg: #071C2E; --surface: #112220; --surface2: #172A28; --surface3: #1F3532;
    --surface-glass: rgba(17,34,32,0.86);
    --warm-flat-bg: #4A2622; --gold-flat-bg: #4A3514;
    --border: #203531; --text: #EAF7F4; --text-muted: #8CA9A5; --text-dim: #4C615E;
    --shadow-sm: 0 2px 12px rgba(0,0,0,0.3);
    --shadow:    0 10px 30px rgba(0,0,0,0.4);
    --shadow-lg: 0 20px 54px rgba(0,0,0,0.55);
  }
  @keyframes fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

  /* Header */
  .header { padding: calc(18px + env(safe-area-inset-top)) 18px 4px; display: flex; align-items: center; justify-content: space-between; position: relative; gap: 10px; }
  .logo { position: relative; z-index: 1; line-height: 1; cursor: default; animation: fadeUp 0.5s cubic-bezier(.2,.8,.2,1) both; }
  .logo-name { font-family: var(--font-display); font-size: 1.7rem; line-height: 1; letter-spacing: -0.3px; font-weight: 700; }
  .logo-name .limit { font-weight: 500; color: var(--text-muted); }
  .logo-name .less { font-weight: 800; color: var(--accent); }
  .logo-sub { font-size: 0.66rem; color: var(--text-dim); font-weight: 700; margin-top: 3px; letter-spacing: 1.4px; text-transform: uppercase; }
  .greeting { position: relative; z-index: 1; line-height: 1; animation: fadeUp 0.5s cubic-bezier(.2,.8,.2,1) both; min-width: 0; }
  .greeting-text { font-family: var(--font-display); font-size: 1.55rem; line-height: 1.2; font-weight: 700; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .greeting-name { color: var(--accent); font-weight: 800; }
  .greeting-wave { display: inline-block; transform-origin: 70% 70%; animation: wave 2.6s ease-in-out infinite; }
  @keyframes wave { 0%,100%{transform:rotate(0deg)} 10%{transform:rotate(14deg)} 20%{transform:rotate(-8deg)} 30%{transform:rotate(14deg)} 40%{transform:rotate(-4deg)} 50%{transform:rotate(10deg)} 60%{transform:rotate(0deg)} }
  .greeting-sub { font-size: 0.66rem; color: var(--text-dim); font-weight: 700; margin-top: 3px; letter-spacing: 1.4px; text-transform: uppercase; }
  .header-actions { display: flex; align-items: center; gap: 8px; position: relative; z-index: 1; flex-shrink: 0; animation: fadeUp 0.5s 0.05s cubic-bezier(.2,.8,.2,1) both; }
  .icon-btn { width: 40px; height: 40px; border-radius: 50%; border: 1.5px solid var(--border); background: var(--surface); color: var(--text-muted); cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: var(--shadow-sm); transition: transform 0.15s, color 0.2s, border-color 0.2s, box-shadow 0.2s; }
  .icon-btn:hover { color: var(--accent); border-color: var(--accent); }
  .icon-btn:active { transform: scale(0.9); }
  .icon-btn.danger:hover { color: var(--danger); border-color: var(--danger); }

  /* Content */
  .content { flex: 1; padding: 14px 16px calc(110px + env(safe-area-inset-bottom)); overflow-y: auto; -webkit-overflow-scrolling: touch; }

  /* ── Bottom Tab Bar (native pattern) ── */
  .tabbar {
    position: fixed; bottom: 0; left: 50%; transform: translateX(-50%);
    width: 100%; max-width: 480px;
    background: var(--surface-glass);
    backdrop-filter: blur(20px) saturate(180%); -webkit-backdrop-filter: blur(20px) saturate(180%);
    border-top: 1.5px solid var(--border);
    display: flex; align-items: stretch;
    padding: 6px 8px calc(6px + env(safe-area-inset-bottom));
    z-index: 100;
    box-shadow: 0 -4px 24px rgba(14,35,34,0.08);
  }
  .app.dark .tabbar { box-shadow: 0 -4px 24px rgba(0,0,0,0.35); }
  .tab {
    flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 3px; padding: 6px 4px; min-height: 52px;
    border: none; background: transparent; border-radius: 16px;
    color: var(--text-muted); cursor: pointer;
    font-family: 'Manrope', sans-serif; font-size: 0.62rem; font-weight: 800;
    letter-spacing: 0.3px;
    transition: color 0.15s, transform 0.1s;
    -webkit-tap-highlight-color: transparent;
  }
  .tab:active { transform: scale(0.92); }
  .tab.on { color: var(--accent); background: var(--accent-light); }
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
  .record-btn.idle { background: var(--accent); color: white; box-shadow: var(--shadow); }
  .record-btn.active { background: var(--warm); color: white; box-shadow: var(--shadow); }
  .record-btn.idle::before, .record-btn.idle::after { content: ''; position: absolute; inset: -7px; border-radius: 50%; border: 2px solid var(--accent); opacity: 0; animation: breathe 3s ease-in-out infinite; }
  .record-btn.idle::after { animation-delay: 1.5s; }
  .record-btn.active::before, .record-btn.active::after { content: ''; position: absolute; inset: -7px; border-radius: 50%; border: 2px solid var(--warm); opacity: 0; animation: breathe 1.4s ease-in-out infinite; }
  .record-btn.active::after { animation-delay: 0.7s; }
  @keyframes breathe { 0%{transform:scale(0.9);opacity:0.5} 50%{transform:scale(1.2);opacity:0} 100%{transform:scale(1.4);opacity:0} }

  /* Cards */
  .card { background: var(--surface); border-radius: var(--radius); padding: 20px; margin-bottom: 12px; box-shadow: var(--shadow-sm); animation: fadeUp 0.45s cubic-bezier(.2,.8,.2,1) both; }
  .app.dark .card { border: 1px solid var(--border); }
  .content > .card:nth-of-type(1) { animation-delay: 0.03s; } .content > .card:nth-of-type(2) { animation-delay: 0.08s; } .content > .card:nth-of-type(3) { animation-delay: 0.13s; } .content > .card:nth-of-type(4) { animation-delay: 0.18s; }
  .card-title { font-size: 0.68rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 14px; }
  .settings-section-title { font-size: 0.72rem; font-weight: 800; color: var(--text-dim); text-transform: uppercase; letter-spacing: 1.2px; margin: 20px 2px 8px; }
  .settings-section-title:first-child { margin-top: 2px; }
  .checkin-card { background: var(--accent-light); }

  /* Stats */
  .stat-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px; }
  .stat { background: var(--surface); border-radius: var(--radius); padding: 16px 14px; box-shadow: var(--shadow-sm); animation: fadeUp 0.45s cubic-bezier(.2,.8,.2,1) both; }
  .app.dark .stat { border: 1px solid var(--border); }
  .stat:nth-child(1) { animation-delay: 0.02s; } .stat:nth-child(2) { animation-delay: 0.06s; } .stat:nth-child(3) { animation-delay: 0.1s; } .stat:nth-child(4) { animation-delay: 0.14s; }
  .stat-val { font-family: var(--font-display); font-size: 2.15rem; font-weight: 700; color: var(--accent); line-height: 1; letter-spacing: -0.5px; font-variant-numeric: tabular-nums; }
  .stat-val.success { color: var(--success); } .stat-val.danger { color: var(--danger); } .stat-val.warm { color: var(--warm); }
  .stat-label { font-size: 0.72rem; font-weight: 600; color: var(--text-muted); margin-top: 4px; }

  /* Tags */
  .tags { display: flex; flex-wrap: wrap; gap: 6px; }
  .tag { display: inline-flex; align-items: center; gap: 4px; padding: 8px 13px; min-height: 36px; border-radius: 100px; font-size: 0.76rem; font-weight: 700; border: 1.5px solid transparent; cursor: pointer; transition: all 0.15s; user-select: none; -webkit-tap-highlight-color: transparent; }
  .tag:active { transform: scale(0.94); }
  .tag.off { opacity: 0.38; } .tag.readonly { cursor: default; opacity: 1; }
  .tag.auto { border-style: dashed; }
  .technique-howto { font-size: 0.82rem; color: var(--text-muted); font-weight: 500; line-height: 1.55; margin-top: 10px; }
  .auto-hint { font-size: 0.74rem; color: var(--text-dim); font-weight: 600; margin-top: 6px; }

  /* Thermometer */
  .swim-caption { font-size: 0.78rem; color: var(--text-muted); font-weight: 600; margin-bottom: 10px; }
  .thermo-row { margin-bottom: 14px; }
  .thermo-row-head { display: flex; align-items: center; justify-content: space-between; font-size: 0.82rem; margin-bottom: 4px; }
  .thermo-value { font-weight: 800; font-variant-numeric: tabular-nums; }
  .thermo-row input[type="range"] { width: 100%; height: 22px; cursor: pointer; background: transparent; }
  .thermo-grid-head { font-size: 0.62rem; font-weight: 800; color: var(--text-dim); text-align: center; text-transform: uppercase; letter-spacing: 0.3px; }
  .thermo-cell { aspect-ratio: 1; border-radius: 4px; }
  .tag-inline-btn { background: none; border: none; color: inherit; opacity: 0.6; cursor: pointer; display: inline-flex; padding: 2px; margin-left: 1px; border-radius: 4px; transition: opacity 0.15s; }
  .tag-inline-btn:hover { opacity: 1; }
  .tag-inline-btn svg { width: 13px; height: 13px; }

  /* Journal */
  .entry { background: var(--surface); border-radius: var(--radius); padding: 16px; margin-bottom: 10px; box-shadow: var(--shadow-sm); transition: box-shadow 0.2s, transform 0.2s; animation: fadeUp 0.4s cubic-bezier(.2,.8,.2,1) both; }
  .app.dark .entry { border: 1px solid var(--border); }
  .entry:hover { box-shadow: var(--shadow); transform: translateY(-1px); }
  .entry-behavior { display: inline-flex; background: var(--accent-light); color: var(--accent-deep); font-size: 0.7rem; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase; padding: 3px 10px; border-radius: 100px; margin-bottom: 8px; }
  .app.dark .entry-behavior { color: var(--accent); }
  .entry-transcript { font-size: 0.9rem; color: var(--text); line-height: 1.55; margin-bottom: 10px; font-weight: 500; }
  .entry-replacement { font-size: 0.78rem; color: var(--success); font-weight: 700; margin-bottom: 8px; }
  .entry-footer { display: flex; align-items: center; justify-content: space-between; }
  .entry-date { font-size: 0.7rem; color: var(--text-dim); font-weight: 600; }
  .entry-delete { background: none; border: none; color: var(--text-dim); cursor: pointer; padding: 10px; margin: -6px; border-radius: 8px; transition: color 0.15s; display: flex; }
  .entry-delete:hover { color: var(--danger); }
  .day-label { font-size: 0.7rem; font-weight: 800; color: var(--text-dim); text-transform: uppercase; letter-spacing: 1px; padding: 12px 0 6px; }

  /* Savings */
  .savings-amount { font-family: var(--font-display); font-size: 3rem; font-weight: 700; color: var(--success); letter-spacing: -1px; line-height: 1; position: relative; }
  .savings-label { font-size: 0.8rem; font-weight: 600; color: var(--text-muted); margin-top: 6px; position: relative; }

  /* Bars */
  .bar-row { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
  .bar-label { font-size: 0.78rem; font-weight: 600; color: var(--text-muted); width: 100px; flex-shrink: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .bar-track { flex: 1; height: 8px; background: var(--surface2); border-radius: 100px; overflow: hidden; }
  .bar-fill { height: 100%; border-radius: 100px; background: var(--accent); transition: width 0.5s cubic-bezier(.4,0,.2,1); }
  .bar-count { font-size: 0.72rem; font-weight: 700; color: var(--text-dim); width: 24px; text-align: right; }

  /* Filters */
  .filter-bar { display: flex; gap: 6px; margin-bottom: 12px; overflow-x: auto; padding-bottom: 2px; scrollbar-width: none; }
  .filter-bar::-webkit-scrollbar { display: none; }
  .chip { white-space: nowrap; padding: 9px 16px; min-height: 38px; display: inline-flex; align-items: center; border-radius: 100px; border: 1.5px solid var(--border); background: var(--surface); color: var(--text-muted); font-family: 'Manrope', sans-serif; font-size: 0.78rem; font-weight: 700; cursor: pointer; transition: all 0.15s; box-shadow: var(--shadow-sm); -webkit-tap-highlight-color: transparent; }
  .chip:active { transform: scale(0.95); }
  .chip.on { background: var(--accent); border-color: var(--accent); color: white; }
  .app.dark .chip.on { color: #0A1615; }

  /* Behaviors */
  .behavior-item { display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; background: var(--surface2); border-radius: var(--radius-sm); margin-bottom: 8px; }
  .behavior-name { font-size: 0.88rem; font-weight: 700; }
  .behavior-cost { font-size: 0.75rem; font-weight: 600; color: var(--warm); margin-top: 2px; }

  /* Modals */
  .overlay { position: fixed; inset: 0; background: rgba(8,22,21,0.5); display: flex; align-items: flex-end; z-index: 200; backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); }
  .modal { background: var(--surface); border-radius: 28px 28px 0 0; padding: 6px 18px calc(28px + env(safe-area-inset-bottom)); width: 100%; max-width: 480px; margin: 0 auto; max-height: 90dvh; overflow-y: auto; -webkit-overflow-scrolling: touch; box-shadow: var(--shadow-lg); animation: sheet-up 0.28s cubic-bezier(.32,.72,.27,1); }
  @keyframes sheet-up { from { transform: translateY(40px); opacity: 0.6; } to { transform: translateY(0); opacity: 1; } }
  .modal-handle { width: 36px; height: 4px; border-radius: 2px; background: var(--border); margin: 12px auto 20px; }
  .modal-title { font-family: var(--font-display); font-size: 1.5rem; font-weight: 700; color: var(--text); margin-bottom: 18px; letter-spacing: -0.2px; }
  .modal-actions { display: flex; gap: 10px; margin-top: 20px; }
  .onb-dots { display: flex; justify-content: center; gap: 6px; margin-bottom: 18px; }
  .onb-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--border); transition: background 0.2s, transform 0.2s; }
  .onb-dot.on { background: var(--accent); transform: scale(1.3); }
  .onb-emoji { font-size: 3rem; text-align: center; margin-bottom: 14px; }
  .onb-body { font-size: 0.88rem; color: var(--text-muted); font-weight: 500; line-height: 1.6; margin-bottom: 18px; }
  .onb-screen { position: fixed; inset: 0; z-index: 200; display: flex; flex-direction: column; padding: calc(20px + env(safe-area-inset-top)) 20px calc(20px + env(safe-area-inset-bottom)); overflow-y: auto; -webkit-overflow-scrolling: touch; transition: background-color 0.3s; }
  .onb-screen-body { flex: 1; display: flex; flex-direction: column; justify-content: center; width: 100%; max-width: 440px; margin: 0 auto; animation: fadeUp 0.35s cubic-bezier(.2,.8,.2,1) both; }

  /* Form */
  .field { margin-bottom: 14px; }
  .field label { display: block; font-size: 0.72rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 7px; }
  .field input, .field select, .field textarea { width: 100%; background: var(--surface2); border: 1.5px solid var(--border); border-radius: var(--radius-sm); padding: 13px 14px; color: var(--text); font-family: 'Manrope', sans-serif; font-size: 16px; font-weight: 600; outline: none; transition: border-color 0.2s, box-shadow 0.2s; min-height: 48px; }
  .field input:focus, .field select:focus, .field textarea:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-light); }
  .field textarea { resize: vertical; min-height: 80px; }
  select option { background: var(--surface2); }

  /* Buttons */
  .btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 13px 22px; min-height: 48px; border-radius: 100px; border: none; cursor: pointer; font-family: 'Manrope', sans-serif; font-size: 0.92rem; font-weight: 800; transition: all 0.15s; -webkit-tap-highlight-color: transparent; }
  .btn:active { transform: scale(0.97); }
  .btn:disabled { opacity: 0.55; cursor: not-allowed; pointer-events: none; animation: btn-busy 1.1s ease-in-out infinite; }
  @keyframes btn-busy { 0%,100% { opacity: 0.55; } 50% { opacity: 0.85; } }
  .btn-primary { background: var(--accent); color: white; box-shadow: var(--shadow-sm); }
  .btn-primary:hover { background: var(--accent-deep); transform: translateY(-1px); }
  .btn-primary:disabled { box-shadow: none; transform: none; }
  .btn-ghost { background: var(--surface2); color: var(--text-muted); border: 1.5px solid var(--border); }
  .btn-ghost:hover { border-color: var(--text-muted); color: var(--text); }
  .btn-google { background: white; color: #444; border: 1.5px solid #DDD; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
  .btn-google:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.12); }
  .app.dark .btn-google { background: var(--surface2); color: var(--text); border-color: var(--border); }
  .btn-full { width: 100%; } .btn-sm { padding: 7px 16px; font-size: 0.8rem; }

  /* Transcript */
  .transcript-box { display: block; width: 100%; background: var(--surface2); border: 1.5px solid var(--accent); border-radius: var(--radius-sm); padding: 14px; font-size: 16px; font-weight: 600; font-family: 'Manrope', sans-serif; line-height: 1.6; min-height: 88px; color: var(--text); margin-bottom: 14px; box-shadow: 0 0 0 3px var(--accent-light); resize: vertical; outline: none; }
  .transcript-box::placeholder { color: var(--text-dim); }
  .rec-indicator { display: flex; align-items: center; gap: 8px; font-size: 0.8rem; font-weight: 700; color: var(--warm-deep); margin-bottom: 12px; }
  .rec-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--warm-deep); animation: blink 1s infinite; }
  @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.25} }

  /* Lang */
  .lang-bar { display: flex; gap: 6px; overflow-x: auto; padding-bottom: 4px; scrollbar-width: none; margin-bottom: 14px; }
  .lang-bar::-webkit-scrollbar { display: none; }
  .lang-chip { display: inline-flex; align-items: center; gap: 4px; white-space: nowrap; padding: 9px 14px; min-height: 38px; border-radius: 100px; border: 1.5px solid var(--border); background: var(--surface2); color: var(--text-muted); font-family: 'Manrope', sans-serif; font-size: 0.73rem; font-weight: 700; cursor: pointer; transition: all 0.15s; }
  .lang-chip.on { background: var(--accent-light); border-color: var(--accent); color: var(--accent-deep); }
  .app.dark .lang-chip.on { color: var(--accent); }

  /* Error / Success */
  .error-msg { background: rgba(255,90,82,0.1); border: 1.5px solid rgba(255,90,82,0.3); border-radius: var(--radius-sm); padding: 10px 14px; font-size: 0.82rem; font-weight: 600; color: var(--danger); margin-bottom: 12px; }
  .divider { display: flex; align-items: center; gap: 12px; margin: 16px 0; color: var(--text-dim); font-size: 0.75rem; font-weight: 700; }
  .divider::before, .divider::after { content: ''; flex: 1; height: 1px; background: var(--border); }

  /* Empty */
  .empty { text-align: center; padding: 56px 20px; color: var(--text-dim); }
  .empty-icon { font-size: 3rem; margin-bottom: 12px; }
  .empty p { font-size: 0.88rem; font-weight: 600; line-height: 1.7; }

  /* Auth screen */
  .auth-screen { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px 24px 60px; position: relative; overflow: hidden; }
  .auth-screen::before { content: ''; position: absolute; inset: 0; z-index: 0; background-image: radial-gradient(circle, var(--border) 1.5px, transparent 1.5px); background-size: 26px 26px; -webkit-mask-image: radial-gradient(ellipse 70% 60% at 50% 30%, black 0%, transparent 75%); mask-image: radial-gradient(ellipse 70% 60% at 50% 30%, black 0%, transparent 75%); opacity: 0.9; pointer-events: none; }
  .auth-screen > * { position: relative; z-index: 1; width: 100%; }
  .auth-orb { width: 84px; height: 84px; border-radius: 50%; position: relative; background: var(--accent); margin: 0 auto 24px; animation: orb-float 5s ease-in-out infinite; }
  .auth-orb::before { content: ''; position: absolute; width: 26px; height: 26px; border-radius: 50%; background: var(--gold); top: -8px; right: -10px; }
  .auth-orb::after { content: ''; position: absolute; width: 18px; height: 18px; border-radius: 50%; background: var(--warm); bottom: -2px; left: -10px; }
  .auth-wordmark { font-family: var(--font-display); font-size: 2.9rem; line-height: 1; letter-spacing: -1px; margin-bottom: 8px; text-align: center; animation: fadeUp 0.5s cubic-bezier(.2,.8,.2,1) both; }
  .auth-wordmark .limit { font-weight: 500; color: var(--text-muted); }
  .auth-wordmark .less { font-weight: 800; color: var(--accent); }
  .auth-tagline { font-size: 0.85rem; color: var(--text-muted); font-weight: 600; text-align: center; margin-bottom: 28px; animation: fadeUp 0.5s 0.05s cubic-bezier(.2,.8,.2,1) both; }
  .auth-card { background: var(--surface); border-radius: var(--radius); padding: 24px 20px; box-shadow: var(--shadow-lg); animation: fadeUp 0.5s 0.1s cubic-bezier(.2,.8,.2,1) both; }
  .app.dark .auth-card { border: 1px solid var(--border); }
  .auth-toggle { display: flex; justify-content: center; gap: 6px; font-size: 0.82rem; font-weight: 600; color: var(--text-muted); margin-top: 16px; text-align: center; }
  .auth-toggle span { color: var(--accent); cursor: pointer; font-weight: 800; }
  .auth-toggle span:hover { text-decoration: underline; }
  @keyframes orb-float { 0%,100%{transform:translateY(0) rotate(0deg)} 50%{transform:translateY(-8px) rotate(4deg)} }

  .btn-danger { background: var(--danger); color: white; box-shadow: 0 12px 28px -6px rgba(255,90,82,0.3); }
  .btn-danger:hover { filter: brightness(0.94); }
  .toast-stack { position: fixed; top: calc(12px + env(safe-area-inset-top)); left: 50%; transform: translateX(-50%); z-index: 500; display: flex; flex-direction: column; align-items: center; gap: 8px; width: min(92vw, 420px); pointer-events: none; }
  .toast { pointer-events: auto; width: 100%; border-radius: 16px; padding: 12px 16px; background: var(--surface); color: var(--text); box-shadow: var(--shadow-lg); font: 700 0.82rem 'Manrope', sans-serif; cursor: pointer; animation: fadeUp 0.2s ease both; }
  .app.dark .toast { border: 1px solid var(--border); }
  .toast-success { color: var(--success); }
  .toast-error { color: var(--danger); }
  .toast-info { color: var(--accent); }
  .danger-card { background: rgba(255,90,82,0.06); }
  .app.dark .danger-card { border-color: rgba(255,90,82,0.4); }
  .legal-modal { max-height: 88dvh; }
  .legal-section { margin-bottom: 18px; }
  .legal-section h3 { font-size: 0.9rem; margin-bottom: 6px; color: var(--text); }
  .legal-section p { color: var(--text-muted); font-size: 0.8rem; line-height: 1.65; font-weight: 500; }
  .legal-links { color: var(--text-muted); font-size: 0.7rem; font-weight: 600; line-height: 1.5; text-align: center; margin-top: 14px; }
  .legal-links button { border: 0; background: none; color: var(--accent); font: inherit; cursor: pointer; text-decoration: underline; }
  .error-boundary { min-height: 100vh; background: var(--bg); color: var(--text); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; padding: 32px; text-align: center; font-family: 'Manrope', sans-serif; }
  .error-boundary h1 { font-family: var(--font-display); font-size: 2rem; font-weight: 700; }
  .error-boundary p { color: var(--text-muted); font-weight: 600; }
  @media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; } }
`;
