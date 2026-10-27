// TAPNOVA 3.3 visual layer. Original game actions stay in app.js.
(() => {
  if (window.__tapnovaUI) return;
  const instances = new WeakMap();
  // Installed before Unity's document/window capture handlers. The original
  // trusted event retains native editing (paste, selection, IME, Tab). A local
  // non-composed copy reaches control handlers without reaching the game.
  const inputRoots = new Set();
  for (const type of ['keydown', 'keypress', 'keyup']) {
    window.addEventListener(type, event => {
      // mount() may run before the panel is appended to its closed shadow root.
      const mountedRoot = window.__xbPanel?.getRootNode();
      if (mountedRoot instanceof ShadowRoot) inputRoots.add(mountedRoot);
      const root = [...inputRoots].find(root => root.host?.isConnected && root.activeElement);
      const target = root?.activeElement;
      if (!target || !target.matches('input,textarea,select,[contenteditable="true"],button,[tabindex]')) return;
      const local = new KeyboardEvent(event.type, {
        key:event.key, code:event.code, location:event.location, repeat:event.repeat,
        ctrlKey:event.ctrlKey, metaKey:event.metaKey, altKey:event.altKey, shiftKey:event.shiftKey,
        keyCode:event.keyCode, charCode:event.charCode, which:event.which,
        isComposing:event.isComposing, bubbles:true, cancelable:true, composed:false
      });
      target.dispatchEvent(local);
      if (local.defaultPrevented) event.preventDefault();
      event.stopImmediatePropagation();
    }, true);
  }
  const style = `
    .tn-panel { container-type:inline-size; color:#eeeef4; height:min(744px,calc(100vh - 32px)); border:1px solid #383640!important; border-radius:16px!important; box-shadow:0 24px 80px #0009!important; --tn-accent:#b8a4ff; --tn-surface:#15151b; font-family:'Segoe UI',sans-serif!important; }
    .tn-panel::before,.tn-decoration { display:none!important; }
    .tn-panel,.tn-panel * { box-sizing:border-box; }
    .tn-panel button { -webkit-tap-highlight-color:transparent; }
    .tn-panel button:focus-visible,.tn-panel input:focus-visible,.tn-panel select:focus-visible { outline:2px solid var(--tn-accent)!important; outline-offset:2px!important; }
    .tn-panel button:disabled { cursor:not-allowed!important; }
    .tn-header { height:76px!important; padding:0 24px!important; background:#17171d!important; border-bottom:1px solid #ffffff0e!important; }
    .tn-brand-row { gap:10px!important; }
    .tn-brand-mark { width:34px!important; height:34px!important; margin-right:2px!important; }
    .tn-wordmark { color:#f3f1eb!important; font-size:20px!important; font-weight:800!important; letter-spacing:-.055em!important; }
    .tn-version { font-size:9px!important; padding:3px 6px!important; border:1px solid #ffffff18!important; border-radius:4px!important; color:#a6a1b1!important; background:transparent!important; }
    .tn-subtitle { color:#97939f!important; font-size:9px!important; letter-spacing:.15em!important; margin:3px 0 0 46px!important; text-transform:uppercase; }
    .tn-header button { width:28px!important; height:28px!important; border-radius:5px!important; color:#a8a3b4!important; }
    .tn-header button:hover { background:#ffffff0b!important; color:white!important; }
    .tn-header button.tn-close:hover { color:#ffad9b!important; background:#ff9e821a!important; }
    .tn-panel[data-tn-auth="false"] [data-header-account] { display:none!important; }
    .tn-panel [data-header-account] { background:#19191f!important; border-color:#ffffff0b!important; padding:12px 24px!important; }
    .tn-layout { flex:1; min-height:0; flex-direction:column!important; }
    .tn-nav { width:100%!important; display:grid!important; grid-template-columns:repeat(5,minmax(0,1fr)); padding:12px 18px!important; gap:5px!important; background:#17171d!important; border:0!important; border-bottom:1px solid #ffffff0e!important; overflow:visible!important; }
    .tn-nav-caption { display:none; }
    .tn-nav button { position:relative; flex-direction:row!important; justify-content:center!important; gap:6px!important; width:100%!important; min-width:0!important; min-height:35px!important; padding:8px 4px!important; margin:0!important; border:1px solid transparent!important; border-radius:6px!important; background:transparent!important; color:#aaa5b5!important; box-shadow:none!important; transform:none!important; filter:none!important; font-size:10px!important; font-weight:500!important; letter-spacing:0!important; text-transform:none!important; transition:background .16s,color .16s!important; }
    .tn-nav button svg { width:14px!important; height:14px!important; flex-shrink:0; opacity:.85; }
    .tn-nav button span { white-space:nowrap; text-align:start!important; overflow:hidden!important; text-overflow:ellipsis; }
    .tn-nav button:hover { background:#ffffff08!important; color:#f3f1eb!important; }
    .tn-nav button[aria-current="page"] { color:#14121b!important; background:var(--tn-accent)!important; border-color:var(--tn-accent)!important; font-weight:700!important; }
    .tn-nav button[aria-current="page"] svg { opacity:1; }
    .tn-content { padding:24px!important; min-width:0; scrollbar-width:thin!important; scrollbar-color:#46404f transparent!important; background:transparent!important; }
    .tn-content input,.tn-content textarea,.tn-content select { border-radius:6px!important; box-shadow:none!important; }
    .tn-content button:not(.tn-shortcut) { box-shadow:none!important; border-radius:6px!important; letter-spacing:0!important; }
    .tn-content [data-panel-chrome="fav-bar"] { background:#1e1c26!important; border-color:#ffffff0c!important; box-shadow:none!important; padding:10px!important; gap:7px!important; }
    .tn-content [data-panel-chrome="fav-bar"] button { background:#ffffff04!important; color:#d4cced!important; border-color:#ffffff0b!important; font-weight:500!important; }
    .tn-welcome { gap:0!important; }
    .tn-breadcrumb { display:flex; align-items:center; justify-content:space-between; color:#98939f; font-size:10px; margin-bottom:17px; }
    .tn-breadcrumb strong { font-weight:500; color:#d8d3de; }
    .tn-edition { color:#9b93a9; font-size:8px; letter-spacing:.15em; }
    .tn-hero { position:relative; isolation:isolate; overflow:hidden; border:0; border-radius:9px; padding:23px 24px 27px; background:#c5b5f4; color:#211b32; min-height:214px; }
    .tn-hero-top { position:relative; z-index:2; display:flex; justify-content:space-between; align-items:center; margin-bottom:24px; }
    .tn-eyebrow { color:#453859; font-size:8px; letter-spacing:.17em; font-weight:700; }
    .tn-spark { color:#453859; font-size:11px; font-family:Consolas,monospace; }
    .tn-hero-art { position:absolute; z-index:-1; width:210px; height:210px; right:-42px; bottom:-36px; transform:rotate(-18deg); opacity:.17; }
    .tn-hero-art svg { width:100%; height:100%; }
    .tn-hero h1 { position:relative; margin:0; color:#211b32; font-size:39px; line-height:1.02; letter-spacing:-1.8px; font-weight:800; max-width:360px; }
    .tn-hero h1 em { display:block; font-style:normal; color:#514168; }
    .tn-hero p { position:relative; margin:15px 0 0; color:#4d405e; font-size:11px; line-height:1.65; max-width:300px; }
    .tn-section-label { display:flex; justify-content:space-between; margin:23px 0 9px; align-items:center; color:#e3dfe8; font-size:11px; font-weight:600; }
    .tn-section-label small { color:#9b93a9; font-weight:400; font-size:8px; letter-spacing:.08em; }
    .tn-shortcuts { display:flex; flex-direction:column; }
    .tn-shortcut { display:grid; grid-template-columns:32px 1fr 18px; align-items:center; gap:13px; padding:13px 2px!important; width:100%; min-width:0; text-align:left; cursor:pointer; color:#e8e3ed; background:transparent; border:0; border-bottom:1px solid #ffffff10; border-radius:0; transition:background .16s; }
    .tn-shortcut:hover { background:#ffffff05; }
    .tn-shortcut-icon { color:#bda8ee; display:grid; place-items:center; width:32px; height:34px; background:#272230; border-radius:6px; }
    .tn-shortcut-icon svg { width:17px; height:17px; }
    .tn-shortcut-arrow { color:#c8bdde; font-size:19px; }
    .tn-shortcut strong { display:block; font-weight:600; font-size:12px; }
    .tn-shortcut small { display:block; margin-top:4px; color:#a59cad; font-size:10px; line-height:1.5; }
    .tn-login { display:flex; align-items:flex-start; gap:10px; background:#202027; border:1px solid #ffffff09; border-left:2px solid #e9ad96; border-radius:4px; margin-top:20px; padding:12px; color:#a9a1b1; font-size:10px; line-height:1.65; }
    .tn-login svg { color:#e9ad96; flex-shrink:0; width:14px; height:14px; margin-top:2px; }
    .tn-login strong { display:block; color:#e0d8e5; font-weight:500; }
    .tn-footer { display:flex; align-items:center; justify-content:space-between; padding:13px 24px; gap:12px; background:#17171d; border-top:1px solid #ffffff0e; flex-shrink:0; font-size:9px; color:#aaa0b8; position:relative; z-index:2; }
    .tn-session { display:flex; align-items:center; gap:7px; }
    .tn-session::before { content:""; width:5px; height:5px; border-radius:50%; background:#e9ad96; }
    .tn-panel[data-tn-auth="true"] .tn-session::before { background:#8ce6cf; }
    .tn-signature { color:#9e95ab; font-size:9px; }
    .tn-signature b { color:#e5ddf7; font-weight:600; }
    .tn-panel[data-tn-minimized="true"] { height:auto!important; }
    .tn-panel[data-tn-minimized="true"] .tn-footer,.tn-panel[data-tn-minimized="true"] .tn-layout { display:none!important; }
    @container (max-width:480px) {
      .tn-header { padding:0 16px!important; }
      .tn-nav { padding:10px!important; gap:3px!important; }
      .tn-nav button { flex-direction:column!important; gap:5px!important; font-size:9px!important; padding:8px 2px!important; }
      .tn-content { padding:18px!important; }
      .tn-hero { padding:20px!important; }
      .tn-hero h1 { font-size:34px; }
      .tn-hero-art { right:-80px; opacity:.12; }
      .tn-footer { padding:12px 16px; }
    }
    @container (max-width:350px) {
      .tn-content { padding:12px!important; }
      .tn-header { padding:0 12px!important; }
      .tn-wordmark { font-size:18px!important; }
      .tn-subtitle { font-size:8px!important; }
      .tn-version { display:none!important; }
      .tn-hero h1 { font-size:30px; }
      .tn-footer { padding:12px; gap:6px; font-size:8px; }
      .tn-signature { font-size:8px; }
    }
    @media (prefers-reduced-motion:reduce) {
      .tn-panel,.tn-panel * { animation:none!important; transition:none!important; scroll-behavior:auto!important; }
    }
  `;
  const lock = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 018 0v3"/><path d="M12 14v3"/></svg>';
  const home = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="m3 10 9-7 9 7v10H3Z"/><path d="M9 20v-7h6v7"/></svg>';
  const person = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="7" r="4"/><path d="M4 21v-2a8 8 0 0116 0v2"/></svg>';
  const node = (tag, className, text) => {
    const element = document.createElement(tag);
    element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  };
  const copy = {
    pl: {
      subtitle:'studio / 1TapGod', menu:'PRZESTRZEŃ', edition:'EDYCJA MSP2', eyebrow:'TAPNOVA / TWOJA PRZESTRZEŃ',
      heading:['Graj po','swojemu.'], description:'Twój profil, Twoje miejsca, Twoje zasady. Ułóż swój świat z TAPNOVA.',
      sections:{ homes:['Zbuduj swoją','przestrzeń.','Odkrywaj domy i zarządzaj swoją przestrzenią w MSP2.'], auto:['Mniej klikania.','Więcej gry.','Zadania i codzienne aktywności, uporządkowane w jednym miejscu.'], bots:['Twój pomocnik','w grze.','Wybierz narzędzie, skonfiguruj je i kontroluj jego działanie.'], misc:['Małe detale.','Twój charakter.','Poznaj dodatkowe narzędzia dla swojej postaci i świata.'], emoji:['Wyraź się','po swojemu.','Odkrywaj emotki i dodaj swoim rozmowom więcej charakteru.'], chatroom:['Bądź bliżej','swojego świata.','Narzędzia pokoju i rozmów w jednym panelu.'], spam:['Więcej spokoju.','Mniej spamu.','Ustawienia ochrony i kontroli wiadomości.'], settings:['Tak, jak','lubisz.','Dopasuj kolory, wygląd i zachowanie panelu.'], radar:['TAPNOVA','rozwija się.','Sprawdź informacje o zmianach i nowych wydaniach.' ] },
      quick:'Od czego zaczynamy?', quickHint:'SZYBKI DOSTĘP', profile:'Profil i styl', profileHint:'Twoja postać, Twój charakter', homes:'Dom i przestrzeń', homesHint:'Nadaj światu własny styl',
      login:'Zaloguj się do MSP2', loginHint:'Narzędzia pojawią się po zalogowaniu w oknie gry.', waiting:'Oczekiwanie na logowanie', ready:'Połączono z grą', settings:'Ustawienia', news:'Co nowego', protect:'Ochrona'
    },
    en: {
      subtitle:'studio / 1TapGod', menu:'YOUR SPACE', edition:'MSP2 EDITION', eyebrow:'MADE FOR YOUR UNIVERSE', heading:['Play it','your way.'], description:'Everything that makes your game yours. Together in one personal space.', sections:{},
      quick:'Explore TAPNOVA', quickHint:'CHOOSE A SECTION', profile:'Profile & style', profileHint:'Your avatar, your personality', homes:'Home & space', homesHint:'Make your world your own', login:'Sign in to MSP2', loginHint:'Your tools appear after you sign in to the game.', waiting:'Waiting for sign-in', ready:'Connected to game', settings:'Settings', news:'What’s new', protect:'Protection'
    }
  };

  const studioStyle = `
    [data-ag-search] { min-height:44px!important; padding:11px 13px!important; font-size:13px!important; border-radius:8px!important; background:#17171f!important; color:#f1edf7!important; caret-color:#bfadf5; }
    [data-ag-search]:focus { outline:2px solid #bfadf5!important; outline-offset:2px!important; }
    .tn-panel { width:740px; --tn-surface:#191a21; background:#101116!important; border-color:#35313e!important; border-radius:14px!important; }
    .tn-header { background:#15161c!important; height:72px!important; padding:0 22px!important; }
    .tn-subtitle { font-size:9px!important; letter-spacing:.1em!important; }
    /* Navigation spans both rows; the toolbar must never become a third column. */
    .tn-layout { display:grid!important; grid-template-columns:160px minmax(0,1fr); grid-template-rows:auto minmax(0,1fr); }
    .tn-nav { display:flex!important; flex-direction:column!important; width:160px!important; flex:0 0 160px!important; padding:22px 12px!important; gap:5px!important; border-right:1px solid #ffffff0d!important; background:#15161c!important; overflow-y:auto!important; }
    .tn-nav-caption { display:block; font-size:8px; letter-spacing:.14em; color:#8e879c; margin:0 9px 12px; }
    .tn-nav button { justify-content:flex-start!important; gap:10px!important; padding:11px 10px!important; min-height:39px!important; font-size:11px!important; border-radius:7px!important; }
    .tn-nav button svg { width:16px!important; height:16px!important; }
    .tn-nav button[aria-current="page"] { background:color-mix(in srgb,var(--tn-accent) 16%,#15161c)!important; color:var(--tn-accent)!important; border-color:transparent!important; }
    .tn-nav { grid-column:1; grid-row:1 / -1; min-height:0; }
    .tnc-bar { grid-column:2; grid-row:1; min-width:0; }
    .tn-content { grid-column:2; grid-row:2; padding:20px!important; width:auto!important; min-height:0; }
    .tn-content input:not([type=checkbox]):not([type=range]):not([type=color]),.tn-content select,.tn-content textarea { min-height:40px!important; font-size:13px!important; border:1px solid #46404f!important; background:#17171f!important; color:#f1edf7!important; padding:10px 12px!important; border-radius:8px!important; caret-color:var(--tn-accent); }
    .tn-content input::placeholder,.tn-content textarea::placeholder { color:#9c92ac!important; opacity:1; }
    .tn-content input:focus,.tn-content textarea:focus,.tn-content select:focus { border-color:var(--tn-accent)!important; outline:2px solid color-mix(in srgb,var(--tn-accent) 24%,transparent)!important; outline-offset:2px!important; }
    .tn-content button:not(.tn-shortcut) { min-height:32px; border-radius:7px!important; }
    .tn-hero { background:#c6b7ee!important; border-radius:11px!important; }
    .tn-hero h1 { font-size:42px; }
    .tn-shortcut { padding:15px 2px!important; }
    .tn-shortcut strong { font-size:13px!important; }
    .tn-footer { background:#15161c!important; padding:13px 22px!important; }
    @container (max-width:600px) {
      .tn-layout { grid-template-columns:minmax(0,1fr); grid-template-rows:auto auto minmax(0,1fr); }
      .tn-nav { grid-column:1; grid-row:1; }
      .tnc-bar { grid-column:1; grid-row:2; }
      .tn-content { grid-column:1; grid-row:3; }
      .tn-nav { display:grid!important; grid-template-columns:repeat(5,minmax(0,1fr)); width:100%!important; flex:0 0 auto!important; padding:10px!important; gap:3px!important; border-right:0!important; border-bottom:1px solid #ffffff0d!important; overflow:visible!important; }
      .tn-nav-caption { display:none; }
      .tn-nav button { flex-direction:column!important; justify-content:center!important; gap:6px!important; padding:8px 2px!important; font-size:9px!important; }
      .tn-content { width:auto!important; padding:18px!important; }
      .tn-hero h1 { font-size:36px; }
    }
    @media(prefers-reduced-motion:reduce) { .tn-panel,.tn-panel * { animation:none!important; transition:none!important; } }
  `;

  const motionStyle = `
    .tn-panel { box-shadow:0 24px 80px #0009,0 0 42px #a78bfa14!important; }
    .tn-header { position:relative; background:linear-gradient(110deg,#1e192b,#15161c 65%)!important; }
    .tn-header::after { content:""; position:absolute; bottom:0; left:0; right:0; height:1px; background:linear-gradient(90deg,transparent,var(--tn-accent),#8ce6cf,transparent); opacity:.6; pointer-events:none; }
    .tn-brand-mark { filter:drop-shadow(0 0 10px #b8a4ff45); }
    .tn-nav button { transition:background .2s,color .2s,border-color .2s!important; }
    .tn-nav button[aria-current="page"]::before { content:""; position:absolute; left:0; top:10px; bottom:10px; width:3px; border-radius:3px; background:var(--tn-accent); box-shadow:0 0 12px var(--tn-accent); }
    .tn-nav button svg { transition:transform .25s ease; }
    .tn-nav button:hover svg { transform:translateY(-2px); }
    .tn-nav .tn-nav-secondary { min-height:44px!important; margin-top:12px!important; background:color-mix(in srgb,var(--tn-accent) 10%,#15161c)!important; border:1px solid color-mix(in srgb,var(--tn-accent) 28%,transparent)!important; color:#e0d4ff!important; }
    .tn-nav .tn-nav-secondary svg { width:20px!important; height:20px!important; }
    .tn-nav .tn-nav-secondary:hover svg { transform:rotate(40deg); }
    .tn-section-head { position:relative; isolation:isolate; overflow:hidden; flex-shrink:0; border:1px solid #b8a4ff30; border-radius:12px; padding:18px 20px; margin-bottom:16px; background:linear-gradient(115deg,#30243f,#1d202e); }
    .tn-section-head::before { content:""; position:absolute; z-index:-1; width:230px; height:230px; right:-40px; top:-100px; border-radius:50%; background:radial-gradient(circle,#b8a4ff38,transparent 68%); animation:tn-aurora 7s ease-in-out infinite alternate; pointer-events:none; }
    .tn-section-head::after { content:""; position:absolute; width:100px; height:100px; right:20px; top:-18px; border:1px solid #c8b4ff18; border-radius:28px; transform:rotate(35deg); pointer-events:none; }
    .tn-section-head[hidden] { display:none; }
    .tn-section-kicker { color:var(--tn-accent); font-size:9px; font-weight:700; letter-spacing:.14em; text-transform:uppercase; }
    .tn-section-title { color:#f5f0ff; font-size:24px; line-height:1.15; letter-spacing:-.7px; margin:8px 0; }
    .tn-section-description { color:#bdb4cd; font-size:11px; line-height:1.6; margin:0; max-width:390px; }
    .tn-tool-pane { min-width:0; animation:tn-pane-in .32s ease-out both; }
    .tn-tool-card { position:relative; min-width:0; border-color:#b8a4ff25!important; border-radius:12px!important; background:linear-gradient(135deg,#ffffff06,transparent),#191920!important; transition:border-color .2s,box-shadow .2s!important; }
    .tn-tool-card:hover { border-color:#b8a4ff60!important; box-shadow:0 4px 18px #0002!important; }
    .tn-content button:not(:disabled),.tnc-button:not(:disabled) { transition:background .18s,border-color .18s,filter .18s,transform .18s!important; }
    .tn-content button:not(:disabled):hover { filter:brightness(1.15); }
    .tn-content button:not(:disabled):active,.tnc-button:not(:disabled):active { transform:translateY(1px); }
    .tn-content [data-panel-chrome="fav-bar"] { display:grid!important; grid-template-columns:repeat(3,minmax(0,1fr))!important; border-radius:12px!important; margin-bottom:16px!important; }
    .tn-content [data-panel-chrome="fav-bar"] button { min-width:0!important; min-height:40px!important; white-space:normal!important; line-height:1.35!important; font-size:11px!important; padding:9px 8px!important; }
    .tn-hero-art { animation:tn-float 8s ease-in-out infinite alternate; }
    .tn-panel[data-tn-auth="true"] .tn-session::before { box-shadow:0 0 8px #8ce6cf80; }
    @keyframes tn-aurora { from { transform:translate3d(-35px,12px,0) scale(.85); opacity:.55; } to { transform:translate3d(15px,24px,0) scale(1.15); opacity:1; } }
    @keyframes tn-float { from { transform:translateY(0) rotate(-18deg); } to { transform:translateY(-12px) rotate(-10deg); } }
    @keyframes tn-pane-in { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
    @container (max-width:600px) { .tn-nav .tn-nav-secondary { min-height:39px!important; margin-top:0!important; } .tn-nav .tn-nav-secondary svg { width:16px!important; height:16px!important; } }
    @container (max-width:400px) { .tn-section-head { padding:15px; } .tn-section-title { font-size:22px; } .tn-content [data-panel-chrome="fav-bar"] { grid-template-columns:repeat(2,minmax(0,1fr))!important; } }
    @media(prefers-reduced-motion:reduce) { .tn-panel,.tn-panel *,.tn-panel *::before,.tn-panel *::after { animation:none!important; transition:none!important; } }
  `;

  function welcome(key, context, labels) {
    const wrap = node('div', 'tn-welcome');
    const breadcrumb = node('div', 'tn-breadcrumb');
    breadcrumb.append(node('strong', '', labels[key] || labels.profile), node('span', 'tn-edition', context.text.edition));
    const hero = node('section', 'tn-hero');
    const top = node('div', 'tn-hero-top');
    top.append(node('span', 'tn-eyebrow', context.text.eyebrow), node('span', 'tn-spark', '01 — TN'));
    const art = node('div', 'tn-hero-art'); art.setAttribute('aria-hidden', 'true');
    art.innerHTML = context.logo();
    const section = context.text.sections[key];
    const heading = node('h1', '', section?.[0] || context.text.heading[0]);
    heading.append(node('em', '', section?.[1] || context.text.heading[1]));
    hero.append(top, art, heading, node('p', '', section?.[2] || context.text.description));
    const label = node('div', 'tn-section-label', context.text.quick);
    label.append(node('small', '', context.text.quickHint));
    const shortcuts = node('div', 'tn-shortcuts');
    for (const [id, title, hint, icon] of [['profile',context.text.profile,context.text.profileHint,person],['homes',context.text.homes,context.text.homesHint,home]]) {
      const button = node('button', 'tn-shortcut'); button.type = 'button'; button.dataset.tnShortcut = id;
      const mark = node('span', 'tn-shortcut-icon'); mark.innerHTML = icon;
      const details = node('span', 'tn-shortcut-copy');
      details.append(node('strong', '', title), node('small', '', hint));
      button.append(mark, details, node('span', 'tn-shortcut-arrow', '↗'));
      button.addEventListener('click', () => context.select(id));
      shortcuts.append(button);
    }
    const login = node('div', 'tn-login');
    const icon = node('span', ''); icon.innerHTML = lock;
    const details = node('div', ''); details.append(node('strong', '', context.text.login), document.createTextNode(context.text.loginHint));
    login.append(icon, details);
    wrap.append(breadcrumb, hero, label, shortcuts, login);
    return wrap;
  }

  function mount(panel, context) {
    if (instances.has(panel)) return;
    const inputRoot = panel.getRootNode();
    if (inputRoot instanceof ShadowRoot) inputRoots.add(inputRoot);
    const refs = context.refs;
    context.text = copy[context.lang() === 'pl' ? 'pl' : 'en'];
    panel.classList.add('tn-panel');
    // Start wide enough for the sidebar; retain explicit compact/maximized modes.
    if (panel.style.width === '560px') panel.style.width = '740px';
    const sheet = node('style', ''); sheet.textContent = style + studioStyle + motionStyle; panel.append(sheet);
    const title = refs.panelTitleEl;
    const brandRow = title.parentElement;
    const header = brandRow.parentElement.parentElement;
    header.classList.add('tn-header');
    brandRow.classList.add('tn-brand-row');
    brandRow.firstElementChild.classList.add('tn-brand-mark');
    title.classList.add('tn-wordmark');
    brandRow.lastElementChild.classList.add('tn-version');
    brandRow.lastElementChild.textContent = '4.0';
    const subtitle = brandRow.nextElementSibling;
    subtitle.classList.add('tn-subtitle'); subtitle.textContent = context.text.subtitle;
    for (const child of panel.children) {
      if (child === header) break;
      child.classList.add('tn-decoration');
    }
    refs.closeBtn.classList.add('tn-close');
    refs.minBtn.dataset.tnAction = 'minimize'; refs.maxBtn.dataset.tnAction = 'maximize'; refs.closeBtn.dataset.tnAction = 'close';
    const nav = refs.tabBar;
    nav.classList.add('tn-nav'); nav.parentElement.classList.add('tn-layout');
    refs.tabAccent?.classList.add('tn-decoration');
    nav.prepend(node('div', 'tn-nav-caption', context.text.menu));
    refs.body.classList.add('tn-content');
    const tabs = { ...refs.tabBtns, settings:refs.settingsRailBtn, radar:refs.radarRailBtn };
    const labels = {};
    for (const [id, button] of Object.entries(tabs)) {
      if (!button) continue;
      button.dataset.tabId = id;
      button.setAttribute('aria-label', button.title);
      const label = button.querySelector('span');
      if (label && id === 'homes' && context.lang() === 'pl') label.textContent = 'Dom';
      if (label && ['settings','radar','spam'].includes(id)) label.textContent = id === 'settings' ? context.text.settings : id === 'radar' ? context.text.news : context.text.protect;
      labels[id] = label?.textContent || button.title;
    }
    refs.settingsRailBtn?.classList.add('tn-nav-secondary');
    const sectionHead = node('section', 'tn-section-head');
    const sectionKicker = node('div', 'tn-section-kicker');
    const sectionTitle = node('h2', 'tn-section-title');
    const sectionDescription = node('p', 'tn-section-description');
    sectionHead.append(sectionKicker, sectionTitle, sectionDescription);
    refs.body.prepend(sectionHead);
    for (const pane of Object.values(refs.panes || {})) {
      pane.classList.add('tn-tool-pane');
      for (const card of pane.children) {
        if (card.style.border) card.classList.add('tn-tool-card');
      }
    }
    for (const [id, pane] of Object.entries(refs.skelPanes || {})) pane.replaceChildren(welcome(id, context, labels));
    const footer = node('footer', 'tn-footer');
    const session = node('span', 'tn-session', context.text.waiting);
    const signature = node('span', 'tn-signature', 'created by '); signature.append(node('b', '', '1TapGod'));
    footer.append(session, signature); panel.append(footer);
    instances.set(panel, { context, tabs, session, labels, sectionHead, sectionKicker, sectionTitle, sectionDescription });
    window.__tapnovaCenter?.mount(panel, context);
    sync(panel);
  }
  function sync(panel) {
    const entry = instances.get(panel);
    if (!entry) return;
    const { context, tabs, session, labels, sectionHead, sectionKicker, sectionTitle, sectionDescription } = entry;
    const authenticated = context.isLoggedIn();
    panel.dataset.tnAuth = String(authenticated);
    panel.style.setProperty('--tn-accent', context.accent());
    sectionHead.hidden = !authenticated;
    const active = context.active();
    if (entry.active !== active) {
      entry.active = active;
      const section = context.text.sections[active];
      sectionKicker.textContent = 'TAPNOVA / ' + (labels[active] || context.text.profile);
      sectionTitle.textContent = section ? section[0] + ' ' + section[1] : (labels[active] || context.text.profile);
      sectionDescription.textContent = section?.[2] || context.text.description;
    }
    for (const [id, button] of Object.entries(tabs)) {
      if (!button) continue;
      if (context.active() === id) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    }
    session.textContent = authenticated ? context.text.ready : context.text.waiting;
    window.__tapnovaCenter?.sync();
  }
  window.__tapnovaUI = { mount, sync };
})();
