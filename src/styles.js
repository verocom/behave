export const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..900;1,9..144,300..900&family=Manrope:wght@400;500;600;700;800&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { height: 100%; font-family: 'Manrope', sans-serif; -webkit-font-smoothing: antialiased; }

  .app {
    --font-display: 'Fraunces', serif;
    --accent: #35755D; --accent-deep: #24503F;
    --accent-light: rgba(53,117,93,0.12); --accent-ring: rgba(53,117,93,0.24);
    --warm: #D97D46; --warm-light: rgba(217,125,70,0.14);
    --success: #3F8F5C; --danger: #C1503C;
    --bg: #F6F1E7; --surface: #FFFFFF; --surface2: #EFE8DA; --surface3: #E5DBC7;
    --surface-glass: rgba(255,255,255,0.78);
    --border: #E1D6C0; --text: #211B14; --text-muted: #82755F; --text-dim: #B9AB92;
    --shadow-sm: 0 2px 10px rgba(38,28,14,0.05);
    --shadow:    0 8px 28px rgba(38,28,14,0.08);
    --shadow-lg: 0 16px 48px rgba(38,28,14,0.16);
    --shadow-accent: 0 10px 28px -6px var(--accent-ring);
    --radius: 22px; --radius-sm: 13px;
    max-width: 480px; margin: 0 auto; min-height: 100vh;
    display: flex; flex-direction: column;
    background: var(--bg); color: var(--text);
    position: relative; isolation: isolate;
    transition: background-color 0.3s, color 0.3s;
  }
  .app.dark {
    --accent: #6FC79E; --accent-deep: #93D9B9;
    --accent-light: rgba(111,199,158,0.14); --accent-ring: rgba(111,199,158,0.26);
    --warm: #E8A56E; --warm-light: rgba(232,165,110,0.14);
    --success: #6FC79E; --danger: #D9836A;
    --bg: #0F1512; --surface: #171F1A; --surface2: #1E2721; --surface3: #263329;
    --surface-glass: rgba(23,31,26,0.78);
    --border: #2B3A32; --text: #ECE7DB; --text-muted: #92A398; --text-dim: #4B5A50;
    --shadow-sm: 0 2px 10px rgba(0,0,0,0.25);
    --shadow:    0 8px 28px rgba(0,0,0,0.35);
    --shadow-lg: 0 16px 48px rgba(0,0,0,0.55);
    --shadow-accent: 0 10px 28px -6px rgba(111,199,158,0.35);
  }
  .app::after {
    content: ''; position: fixed; inset: 0; pointer-events: none; z-index: 999;
    opacity: 0.035; mix-blend-mode: overlay;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  }
  @keyframes fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

  /* Header */
  .header { padding: calc(18px + env(safe-area-inset-top)) 18px 4px; display: flex; align-items: center; justify-content: space-between; position: relative; }
  .header::before { content: ''; position: absolute; inset: -20px 0 0; background: radial-gradient(ellipse 70% 60% at 15% 0%, var(--accent-ring) 0%, transparent 60%), radial-gradient(ellipse 60% 50% at 90% 20%, var(--warm-light) 0%, transparent 55%); pointer-events: none; }
  .logo { position: relative; z-index: 1; line-height: 1; cursor: default; animation: fadeUp 0.5s cubic-bezier(.2,.8,.2,1) both; }
  .logo-name { font-family: var(--font-display); font-size: 1.7rem; line-height: 1; letter-spacing: -0.5px; }
  .logo-name .be { font-weight: 340; font-style: italic; color: var(--text-muted); }
  .logo-name .have { font-weight: 680; color: var(--accent); }
  .logo-sub { font-size: 0.66rem; color: var(--text-dim); font-weight: 700; margin-top: 3px; letter-spacing: 1.4px; text-transform: uppercase; }
  .header-actions { display: flex; align-items: center; gap: 8px; position: relative; z-index: 1; animation: fadeUp 0.5s 0.05s cubic-bezier(.2,.8,.2,1) both; }
  .icon-btn { width: 40px; height: 40px; border-radius: 50%; border: 1.5px solid var(--border); background: var(--surface); color: var(--text-muted); cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: var(--shadow-sm); transition: transform 0.15s, color 0.2s, border-color 0.2s, box-shadow 0.2s; }
  .icon-btn:hover { color: var(--accent); border-color: var(--accent); box-shadow: var(--shadow-accent); }
  .icon-btn:active { transform: scale(0.9); }
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
    background: var(--surface-glass);
    backdrop-filter: blur(20px) saturate(180%); -webkit-backdrop-filter: blur(20px) saturate(180%);
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
    font-family: 'Manrope', sans-serif; font-size: 0.62rem; font-weight: 800;
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
  .record-btn.idle { background: linear-gradient(145deg, var(--accent), var(--accent-deep)); color: white; box-shadow: 0 8px 28px var(--accent-ring), 0 2px 8px rgba(0,0,0,0.18), inset 0 1px 1px rgba(255,255,255,0.25); }
  .record-btn.active { background: linear-gradient(145deg, #E07060, #C05040); color: white; box-shadow: 0 6px 24px rgba(192,80,64,0.35); }
  .record-btn.idle::before, .record-btn.idle::after { content: ''; position: absolute; inset: -7px; border-radius: 50%; border: 2px solid var(--accent); opacity: 0; animation: breathe 3s ease-in-out infinite; }
  .record-btn.idle::after { animation-delay: 1.5s; }
  .record-btn.active::before, .record-btn.active::after { content: ''; position: absolute; inset: -7px; border-radius: 50%; border: 2px solid #E07060; opacity: 0; animation: breathe 1.4s ease-in-out infinite; }
  .record-btn.active::after { animation-delay: 0.7s; }
  @keyframes breathe { 0%{transform:scale(0.9);opacity:0.5} 50%{transform:scale(1.2);opacity:0} 100%{transform:scale(1.4);opacity:0} }

  /* Cards */
  .card { background: var(--surface); border: 1.5px solid var(--border); border-radius: var(--radius); padding: 18px; margin-bottom: 12px; box-shadow: var(--shadow-sm); animation: fadeUp 0.45s cubic-bezier(.2,.8,.2,1) both; }
  .content > .card:nth-of-type(1) { animation-delay: 0.03s; } .content > .card:nth-of-type(2) { animation-delay: 0.08s; } .content > .card:nth-of-type(3) { animation-delay: 0.13s; } .content > .card:nth-of-type(4) { animation-delay: 0.18s; }
  .card-title { font-size: 0.68rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 14px; }
  .checkin-card { background: linear-gradient(135deg, var(--accent-light), var(--warm-light)); border-color: var(--accent); }

  /* Stats */
  .stat-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px; }
  .stat { background: var(--surface); border: 1.5px solid var(--border); border-radius: var(--radius); padding: 16px 14px; box-shadow: var(--shadow-sm); animation: fadeUp 0.45s cubic-bezier(.2,.8,.2,1) both; }
  .stat:nth-child(1) { animation-delay: 0.02s; } .stat:nth-child(2) { animation-delay: 0.06s; } .stat:nth-child(3) { animation-delay: 0.1s; } .stat:nth-child(4) { animation-delay: 0.14s; }
  .stat-val { font-family: var(--font-display); font-size: 2.15rem; font-weight: 640; color: var(--accent); line-height: 1; letter-spacing: -1px; font-variant-numeric: tabular-nums; }
  .stat-val.success { color: var(--success); } .stat-val.danger { color: var(--danger); } .stat-val.warm { color: var(--warm); }
  .stat-label { font-size: 0.72rem; font-weight: 600; color: var(--text-muted); margin-top: 4px; }

  /* Tags */
  .tags { display: flex; flex-wrap: wrap; gap: 6px; }
  .tag { display: inline-flex; align-items: center; gap: 4px; padding: 8px 13px; min-height: 36px; border-radius: 100px; font-size: 0.76rem; font-weight: 700; border: 1.5px solid transparent; cursor: pointer; transition: all 0.15s; user-select: none; -webkit-tap-highlight-color: transparent; }
  .tag:active { transform: scale(0.94); }
  .tag.off { opacity: 0.38; } .tag.readonly { cursor: default; opacity: 1; }
  .tag-inline-btn { background: none; border: none; color: inherit; opacity: 0.6; cursor: pointer; display: inline-flex; padding: 2px; margin-left: 1px; border-radius: 4px; transition: opacity 0.15s; }
  .tag-inline-btn:hover { opacity: 1; }
  .tag-inline-btn svg { width: 13px; height: 13px; }

  /* Journal */
  .entry { background: var(--surface); border: 1.5px solid var(--border); border-radius: var(--radius); padding: 16px; margin-bottom: 10px; box-shadow: var(--shadow-sm); transition: box-shadow 0.2s, transform 0.2s; animation: fadeUp 0.4s cubic-bezier(.2,.8,.2,1) both; }
  .entry:hover { box-shadow: var(--shadow); transform: translateY(-1px); }
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
  .savings-card { background: linear-gradient(135deg, var(--accent-light), var(--warm-light)); border: 1.5px solid var(--border); border-radius: var(--radius); padding: 22px 20px; text-align: center; margin-bottom: 12px; box-shadow: var(--shadow-sm); animation: fadeUp 0.45s 0.1s cubic-bezier(.2,.8,.2,1) both; }
  .savings-amount { font-family: var(--font-display); font-size: 3rem; font-weight: 620; color: var(--success); letter-spacing: -1.5px; line-height: 1; }
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
  .chip { white-space: nowrap; padding: 9px 16px; min-height: 38px; display: inline-flex; align-items: center; border-radius: 100px; border: 1.5px solid var(--border); background: var(--surface); color: var(--text-muted); font-family: 'Manrope', sans-serif; font-size: 0.78rem; font-weight: 700; cursor: pointer; transition: all 0.15s; box-shadow: var(--shadow-sm); -webkit-tap-highlight-color: transparent; }
  .chip:active { transform: scale(0.95); }
  .chip.on { background: var(--accent-light); border-color: var(--accent); color: var(--accent-deep); box-shadow: var(--shadow-accent); }
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
  .modal-title { font-family: var(--font-display); font-size: 1.5rem; font-weight: 620; color: var(--text); margin-bottom: 18px; letter-spacing: -0.3px; }
  .modal-actions { display: flex; gap: 10px; margin-top: 20px; }
  .onb-dots { display: flex; justify-content: center; gap: 6px; margin-bottom: 18px; }
  .onb-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--border); transition: background 0.2s, transform 0.2s; }
  .onb-dot.on { background: var(--accent); transform: scale(1.3); }
  .onb-emoji { font-size: 3rem; text-align: center; margin-bottom: 14px; }
  .onb-body { font-size: 0.88rem; color: var(--text-muted); font-weight: 500; line-height: 1.6; margin-bottom: 18px; }

  /* Form */
  .field { margin-bottom: 14px; }
  .field label { display: block; font-size: 0.72rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 7px; }
  .field input, .field select, .field textarea { width: 100%; background: var(--surface2); border: 1.5px solid var(--border); border-radius: var(--radius-sm); padding: 13px 14px; color: var(--text); font-family: 'Manrope', sans-serif; font-size: 16px; font-weight: 600; outline: none; transition: border-color 0.2s, box-shadow 0.2s; min-height: 48px; }
  .field input:focus, .field select:focus, .field textarea:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-light); }
  .field textarea { resize: vertical; min-height: 80px; }
  select option { background: var(--surface2); }

  /* Buttons */
  .btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 13px 20px; min-height: 48px; border-radius: var(--radius-sm); border: none; cursor: pointer; font-family: 'Manrope', sans-serif; font-size: 0.92rem; font-weight: 800; transition: all 0.15s; -webkit-tap-highlight-color: transparent; }
  .btn:active { transform: scale(0.97); }
  .btn-primary { background: var(--accent); color: white; box-shadow: var(--shadow-accent); }
  .btn-primary:hover { background: var(--accent-deep); }
  .btn-primary:disabled { opacity: 0.4; cursor: not-allowed; box-shadow: none; }
  .btn-ghost { background: var(--surface2); color: var(--text-muted); border: 1.5px solid var(--border); }
  .btn-ghost:hover { border-color: var(--text-muted); color: var(--text); }
  .btn-google { background: white; color: #444; border: 1.5px solid #DDD; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
  .btn-google:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.12); }
  .app.dark .btn-google { background: var(--surface2); color: var(--text); border-color: var(--border); }
  .btn-full { width: 100%; } .btn-sm { padding: 7px 14px; font-size: 0.8rem; }

  /* Transcript */
  .transcript-box { display: block; width: 100%; background: var(--surface2); border: 1.5px solid var(--accent); border-radius: var(--radius-sm); padding: 14px; font-size: 16px; font-weight: 600; font-family: 'Manrope', sans-serif; line-height: 1.6; min-height: 88px; color: var(--text); font-style: italic; margin-bottom: 14px; box-shadow: 0 0 0 3px var(--accent-light); resize: vertical; outline: none; }
  .transcript-box::placeholder { color: var(--text-dim); font-style: italic; }
  .rec-indicator { display: flex; align-items: center; gap: 8px; font-size: 0.8rem; font-weight: 700; color: #D07060; margin-bottom: 12px; }
  .rec-dot { width: 8px; height: 8px; border-radius: 50%; background: #D07060; animation: blink 1s infinite; }
  @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.25} }

  /* Lang */
  .lang-bar { display: flex; gap: 6px; overflow-x: auto; padding-bottom: 4px; scrollbar-width: none; margin-bottom: 14px; }
  .lang-bar::-webkit-scrollbar { display: none; }
  .lang-chip { display: inline-flex; align-items: center; gap: 4px; white-space: nowrap; padding: 9px 14px; min-height: 38px; border-radius: 100px; border: 1.5px solid var(--border); background: var(--surface2); color: var(--text-muted); font-family: 'Manrope', sans-serif; font-size: 0.73rem; font-weight: 700; cursor: pointer; transition: all 0.15s; }
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
  .auth-screen::before { content: ''; position: absolute; inset: 0; z-index: 0; background-image: radial-gradient(circle, var(--border) 1.5px, transparent 1.5px); background-size: 26px 26px; -webkit-mask-image: radial-gradient(ellipse 70% 60% at 50% 30%, black 0%, transparent 75%); mask-image: radial-gradient(ellipse 70% 60% at 50% 30%, black 0%, transparent 75%); opacity: 0.9; pointer-events: none; }
  .auth-screen > * { position: relative; z-index: 1; width: 100%; }
  .auth-orb { width: 72px; height: 72px; border-radius: 50%; background: radial-gradient(circle at 38% 32%, rgba(255,255,255,0.5) 0%, var(--accent) 30%, var(--accent-deep) 65%, rgba(0,0,0,0.15) 100%); box-shadow: 0 16px 48px var(--accent-ring), inset -4px -8px 16px rgba(0,0,0,0.18), inset 6px 5px 16px rgba(255,255,255,0.22); margin: 0 auto 20px; animation: orb-float 5s ease-in-out infinite; }
  .auth-wordmark { font-family: var(--font-display); font-size: 3.1rem; line-height: 1; letter-spacing: -1.5px; margin-bottom: 6px; text-align: center; animation: fadeUp 0.5s cubic-bezier(.2,.8,.2,1) both; }
  .auth-wordmark .be { font-weight: 340; font-style: italic; color: var(--text-muted); }
  .auth-wordmark .have { font-weight: 680; color: var(--accent); }
  .auth-tagline { font-size: 0.85rem; color: var(--text-muted); font-weight: 600; text-align: center; margin-bottom: 28px; animation: fadeUp 0.5s 0.05s cubic-bezier(.2,.8,.2,1) both; }
  .auth-card { background: var(--surface); border: 1.5px solid var(--border); border-radius: var(--radius); padding: 24px 20px; box-shadow: var(--shadow-lg); animation: fadeUp 0.5s 0.1s cubic-bezier(.2,.8,.2,1) both; }
  .auth-toggle { display: flex; justify-content: center; gap: 6px; font-size: 0.82rem; font-weight: 600; color: var(--text-muted); margin-top: 16px; text-align: center; }
  .auth-toggle span { color: var(--accent); cursor: pointer; font-weight: 800; }
  .auth-toggle span:hover { text-decoration: underline; }
  @keyframes orb-float { 0%,100%{transform:translateY(0) rotate(0deg)} 50%{transform:translateY(-8px) rotate(4deg)} }

  /* Welcome */
  .welcome { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 40px 28px 60px; position: relative; overflow: hidden; }
  .welcome::before { content: ''; position: absolute; inset: 0; z-index: 0; background-image: radial-gradient(circle, var(--border) 1.5px, transparent 1.5px); background-size: 26px 26px; -webkit-mask-image: radial-gradient(ellipse 70% 60% at 50% 25%, black 0%, transparent 75%); mask-image: radial-gradient(ellipse 70% 60% at 50% 25%, black 0%, transparent 75%); opacity: 0.9; pointer-events: none; }
  .welcome > * { position: relative; z-index: 1; }
  .hero-orb { width: 96px; height: 96px; border-radius: 50%; background: radial-gradient(circle at 38% 32%, rgba(255,255,255,0.5) 0%, var(--accent) 30%, var(--accent-deep) 65%, rgba(0,0,0,0.15) 100%); box-shadow: 0 20px 60px var(--accent-ring), inset -4px -8px 16px rgba(0,0,0,0.18), inset 8px 6px 20px rgba(255,255,255,0.22); margin-bottom: 28px; animation: orb-float 5s ease-in-out infinite; }
  .hero-wordmark { font-family: var(--font-display); font-size: 4.4rem; line-height: 1; letter-spacing: -2.5px; margin-bottom: 12px; animation: fadeUp 0.55s cubic-bezier(.2,.8,.2,1) both; }
  .hero-wordmark .be { font-weight: 340; font-style: italic; color: var(--text-muted); }
  .hero-wordmark .have { font-weight: 680; color: var(--accent); }
  .hero-tagline { font-size: 1.05rem; font-weight: 700; color: var(--text); margin-bottom: 8px; letter-spacing: -0.3px; }
  .hero-sub { font-size: 0.88rem; font-weight: 500; color: var(--text-muted); line-height: 1.65; max-width: 280px; margin: 0 auto 24px; }
  .hero-features { display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; margin-bottom: 28px; }
  .hero-feat { padding: 7px 14px; border-radius: 100px; background: var(--surface); border: 1.5px solid var(--border); font-size: 0.78rem; font-weight: 700; color: var(--text-muted); box-shadow: var(--shadow-sm); }

  .btn-danger { background: var(--danger); color: white; box-shadow: 0 10px 28px -6px rgba(193,80,60,0.28); }
  .btn-danger:hover { filter: brightness(0.92); }
  .toast-stack { position: fixed; top: calc(12px + env(safe-area-inset-top)); left: 50%; transform: translateX(-50%); z-index: 500; display: flex; flex-direction: column; align-items: center; gap: 8px; width: min(92vw, 420px); pointer-events: none; }
  .toast { pointer-events: auto; width: 100%; border: 1.5px solid var(--border); border-radius: 14px; padding: 12px 16px; background: var(--surface); color: var(--text); box-shadow: var(--shadow-lg); font: 700 0.82rem 'Manrope', sans-serif; cursor: pointer; animation: fadeUp 0.2s ease both; }
  .toast-success { border-color: var(--success); color: var(--success); }
  .toast-error { border-color: var(--danger); color: var(--danger); }
  .toast-info { border-color: var(--accent); }
  .danger-card { border-color: rgba(193,80,60,0.45); }
  .legal-modal { max-height: 88dvh; }
  .legal-section { margin-bottom: 18px; }
  .legal-section h3 { font-size: 0.9rem; margin-bottom: 6px; color: var(--text); }
  .legal-section p { color: var(--text-muted); font-size: 0.8rem; line-height: 1.65; font-weight: 500; }
  .legal-links { color: var(--text-muted); font-size: 0.7rem; font-weight: 600; line-height: 1.5; text-align: center; margin-top: 14px; }
  .legal-links button { border: 0; background: none; color: var(--accent); font: inherit; cursor: pointer; text-decoration: underline; }
  .error-boundary { min-height: 100vh; background: #F6F1E7; color: #211B14; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; padding: 32px; text-align: center; font-family: 'Manrope', sans-serif; }
  .error-boundary h1 { font-family: 'Fraunces', serif; font-size: 2rem; }
  .error-boundary p { color: #82755F; font-weight: 600; }
  @media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; } }
`;
