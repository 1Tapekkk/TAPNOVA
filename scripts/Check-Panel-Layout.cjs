// Authenticated layout regression. Synthetic account; all game traffic blocked.
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const files = ['locales-pl.js', 'control-core.js', 'control-center.js', 'workspace-tools.js', 'status-comments.js', 'panel-ui.js', 'app.js'];

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width:1060, height:860 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.origin !== 'https://tapnova-preview.invalid') return route.abort();
      if (url.pathname === '/') return route.fulfill({ contentType:'text/html', body:
        '<!doctype html><meta charset="utf-8"><body style="background:#0c0d14">' + files.map(file => `<script src="/${file}"></script>`).join('') });
      const file = url.pathname.slice(1);
      if (!files.includes(file)) return route.abort();
      let source = fs.readFileSync(path.join(root, 'Resources/Extension', file), 'utf8');
      if (file === 'app.js') source = source.replace('function tnText(value)',
        'window.__layoutTest={get state(){return ce},rebuild:Bd,select:sd};function tnText(value)');
      return route.fulfill({ contentType:'text/javascript', body:source });
    });
    await page.goto('https://tapnova-preview.invalid/');
    await page.waitForFunction(() => window.__layoutTest && window.__xbMountPanel);
    await page.evaluate(() => {
      window.__xbPlayAt = Date.now(); window.__xbMountPanel();
      Object.assign(window.__layoutTest.state, {
        accessToken:'offline-test', profileId:'00000000000000000000000000000000', profileName:'Gracz testowy'
      });
      window.__layoutTest.rebuild(); window.__layoutTest.select('auto');
    });
    await page.waitForFunction(() => window.__xbPanel?.isConnected);
    await page.emulateMedia({ reducedMotion:'reduce' });
    const dimensions = () => page.evaluate(() => {
      const panel = window.__xbPanel;
      const rect = selector => panel.querySelector(selector).getBoundingClientRect().toJSON();
      const content = panel.querySelector('.tn-content');
      return { panel:panel.getBoundingClientRect().toJSON(), nav:rect('.tn-nav'), bar:rect('.tnc-bar'), content:rect('.tn-content'),
        overflow:content.scrollWidth-content.clientWidth,
        settings:rect('[data-tab-id="settings"]'),
        favorites:[...panel.querySelectorAll('[data-panel-chrome="fav-bar"] button')].map(el => el.getBoundingClientRect().width) };
    });
    fs.mkdirSync(path.join(root, 'test-results'), { recursive:true });
    for (const width of [1060, 620, 390]) {
      await page.setViewportSize({ width, height:860 });
      await page.evaluate(() => { const panel=window.__xbPanel; panel.style.left='auto'; panel.style.right='12px'; panel.style.top='12px'; });
      for (const tab of ['auto', 'profile', 'bots', 'homes', 'misc', 'emoji', 'chatroom', 'spam', 'settings', 'radar']) {
        await page.evaluate(tab => { window.__layoutTest.select(tab); window.__xbPanel.querySelector('.tn-content').scrollTop=0; }, tab);
        const d = await dimensions();
        assert.ok(d.overflow <= 1, `${tab} at ${width}px: no horizontal overflow (${d.overflow})`);
        assert.ok(Math.abs(d.bar.x-d.content.x) < 1, 'Toolbar aligns over content, never beside it');
        assert.ok(Math.abs(d.bar.width-d.content.width) < 1, 'Toolbar and tools share the full column');
        assert.ok(d.content.y >= d.bar.bottom-1, 'Tools begin below toolbar');
        assert.ok(d.content.height > 150, 'Tools retain a usable scroll area');
        assert.ok(d.panel.left >= 0 && d.panel.right <= width && d.panel.bottom <= 860, 'Panel stays in viewport');
        if (width === 1060) {
          assert.ok(d.content.width >= 570, 'Desktop tools use remaining width beside sidebar');
          assert.ok(d.settings.width > 120 && d.settings.height >= 44, 'Settings has a labelled, generous target');
          assert.ok(d.favorites.every(value => value >= 140), 'Quick actions are readable');
        } else assert.ok(d.content.width >= d.panel.width-3, 'Compact tools fill panel width');
        if (tab === 'auto' || (tab === 'settings' && width === 1060)) {
          await page.screenshot({ path:path.join(root, `test-results/panel-${tab}-${width}.png`), animations:'disabled' });
        }
      }
    }
    await page.evaluate(() => window.__layoutTest.select('auto'));
    assert.equal(await page.evaluate(() => getComputedStyle(window.__xbPanel.querySelector('.tn-section-head'),'::before').animationName), 'none');
    await page.emulateMedia({ reducedMotion:'no-preference' });
    assert.equal(await page.evaluate(() => getComputedStyle(window.__xbPanel.querySelector('.tn-section-head'),'::before').animationName), 'tn-aurora');
    // Confirm the settings target works with a real pointer, including after reflow.
    const settings = (await page.evaluateHandle(() => window.__xbPanel.querySelector('[data-tab-id="settings"]'))).asElement();
    await settings.click();
    assert.equal(await settings.getAttribute('aria-current'), 'page');
    assert.deepEqual(errors, [], 'No uncaught JavaScript errors');
    console.log('PASS: authenticated layout, 10 tabs at 3 widths, full-width tools below toolbar, settings click target, VFX and reduced motion.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode=1; });
