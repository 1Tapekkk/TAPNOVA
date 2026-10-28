// Offline localization regression: synthetic session, all external requests blocked.
// NODE_PATH must include Playwright. No real login or game actions are used.
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1000, height: 900 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.origin !== 'https://tapnova-preview.invalid') return route.abort();
      if (url.pathname === '/') return route.fulfill({ contentType: 'text/html', body:
        '<!doctype html><meta charset="utf-8"><script src="/locales-pl.js"></script><script src="/control-core.js"></script><script src="/control-center.js"></script><script src="/workspace-tools.js"></script><script src="/status-comments.js"></script><script src="/panel-ui.js"></script><script src="/app.js"></script>' });
      if (!['/locales-pl.js', '/control-core.js', '/control-center.js', '/workspace-tools.js', '/status-comments.js', '/panel-ui.js', '/app.js'].includes(url.pathname)) return route.abort();
      let body = fs.readFileSync(path.join(root, 'Resources/Extension', url.pathname.slice(1)), 'utf8');
      if (url.pathname === '/app.js') {
        // Instrument only this in-memory copy, never the distributed extension.
        const anchor = 'function tnText(value)';
        assert.ok(body.includes(anchor));
        body = body.replace(anchor, 'window.__tnTest={translate:re,text:tnText,lang:le,select:sd,rebuild:Bd,get state(){return ce}};' + anchor);
      }
      return route.fulfill({ contentType: 'text/javascript', body });
    });
    await page.goto('https://tapnova-preview.invalid/');
    await page.waitForFunction(() => window.__tnTest && window.__xbMountPanel);
    await page.evaluate(() => {
      window.__xbPlayAt = Date.now(); window.__xbMountPanel();
      const state = window.__tnTest.state;
      state.accessToken = 'offline-test'; state.profileId = '00000000000000000000000000000000';
      state.profileName = 'Gracz testowy'; window.__tnTest.rebuild();
    });
    await page.waitForFunction(() => window.__xbPanel?.isConnected);
    const report = {};
    for (const tab of ['profile', 'auto', 'bots', 'homes', 'misc', 'emoji', 'chatroom', 'spam', 'settings', 'radar']) {
      report[tab] = await page.evaluate(tab => {
        window.__tnTest.select(tab);
        const panel = window.__xbPanel;
        return { text: panel.innerText, hints: [...panel.querySelectorAll('[title],[placeholder],[aria-label]')]
          .map(el => [el.title, el.getAttribute('placeholder'), el.getAttribute('aria-label')].filter(Boolean).join(' | ')) };
      }, tab);
    }
    assert.match(report.bots.text, /Automatyczne autografy: wyłączone/);
    assert.match(report.auto.text, /Zbieranie duchów/i);
    assert.match(report.spam.text, /RÓWNOLEGŁE ZADANIA/);
    assert.doesNotMatch(report.spam.text, /\bsn\b|10sn|worker|Tryb: max/);
    assert.ok(report.settings.hints.includes('Żółty'));
    assert.ok(!report.settings.hints.includes('Sari'));
    for (const [tab, buttonText, expected] of [
      ['profile', 'Otwórz bibliotekę', /Wszystkie/],
      ['profile', 'Wybierz animację', /Wszystkie/],
      ['bots', 'Otwórz panel autografu', /Zwykły autograf/]
    ]) {
      const modal = await page.evaluate(({ tab, buttonText }) => {
        window.__tnTest.rebuild(); window.__tnTest.select(tab);
        const button = [...window.__xbPanel.querySelectorAll('button')].find(el => el.textContent.trim() === buttonText);
        if (!button) throw Error('Missing dialog button: ' + buttonText);
        button.click();
        return [...window.__xbPanel.getRootNode().children].filter(el => el.getBoundingClientRect().width > 0)
          .map(el => el.innerText || '').join('\n');
      }, { tab, buttonText });
      report[buttonText] = { text: modal };
      assert.match(modal, expected);
    }
    const dictionaryCheck = await page.evaluate(() => {
      const api = window.__tnTest;
      return Object.entries(window.__tapnovaPL.text).every(([original, polish]) => api.text(original) === polish)
        && api.translate('spam_status_cooldown', { n: 12 }) === 'Przerwa: 12 s'
        && api.translate('ag_selected', { emoji: '★', label: 'Styl', price: '0' }) === 'Wybrano: ★ Styl - 0'
        && api.text('Nick użytkownika') === 'Nick użytkownika';
    });
    assert.ok(dictionaryCheck, 'Translations preserve placeholders and unknown/player content');
    for (const lang of ['en', 'tr', 'pl']) {
      const result = await page.evaluate(lang => {
        window.__tnTest.lang(lang, { silent: true });
        window.__tnTest.select('settings');
        return { text: window.__tnTest.text('Sonuç yok'), label: window.__tnTest.translate('settings'),
          theme: [...window.__xbPanel.querySelectorAll('[title]')].map(el => el.title),
          preference: JSON.parse(localStorage.getItem('_xb_prefs_v1')).lg };
      }, lang);
      assert.equal(result.preference, lang);
      assert.equal(result.text, lang === 'pl' ? 'Brak wyników' : 'Sonuç yok');
      assert.equal(result.label, lang === 'pl' ? 'Ustawienia' : lang === 'en' ? 'Settings' : 'Ayarlar');
      assert.ok(result.theme.includes(lang === 'pl' ? 'Żółty' : 'Sari'));
    }
    assert.deepEqual(errors, [], 'No uncaught JavaScript errors');
    await page.setViewportSize({ width: 390, height: 800 });
    const overflow = await page.evaluate(() => {
      window.__tnTest.rebuild(); window.__tnTest.select('spam');
      const panel = window.__xbPanel;
      panel.style.left = 'auto'; panel.style.right = '12px'; panel.style.top = '12px';
      const content = panel.querySelector('.tn-content');
      content.scrollTop = 0;
      return content.scrollWidth - content.clientWidth;
    });
    assert.ok(overflow <= 1, 'Polish controls fit a narrow panel');
    if (process.env.TAPNOVA_LOCALE_SCREENSHOT) await page.screenshot({ path: process.env.TAPNOVA_LOCALE_SCREENSHOT, animations: 'disabled' });
    if (process.env.TAPNOVA_LOCALE_REPORT) fs.writeFileSync(process.env.TAPNOVA_LOCALE_REPORT, JSON.stringify(report, null, 2));
    console.log('PASS: 10 tabs, 3 dialogs, Polish labels/tooltips/messages, placeholders, player text, PL→EN→TR→PL, saved preferences, narrow layout, no script errors. All game traffic blocked.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
