// Offline visual smoke check. Requires Playwright and its Chromium runtime.
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 620, height: 800 } });
    page.on('pageerror', error => console.error('PAGE ERROR', error));
    page.on('console', msg => { if (msg.text().includes('TAPNOVA visual layer:')) console.error(msg.text()); });
    await page.route('**/*', route => {
      const url = route.request().url();
      if (url === 'https://tapnova-preview.invalid/') return route.fulfill({
        contentType: 'text/html',
        body: '<!doctype html><html lang="pl"><meta charset="utf-8"><body style="background:#090c15"><script src="/locales-pl.js"></script><script src="/control-core.js"></script><script src="/control-center.js"></script><script src="/workspace-tools.js"></script><script src="/status-comments.js"></script><script src="/panel-ui.js"></script><script src="/app.js"></script></body></html>'
      });
      if (url === 'https://tapnova-preview.invalid/locales-pl.js') return route.fulfill({
        contentType: 'text/javascript', body: fs.readFileSync(path.join(root, 'Resources/Extension/locales-pl.js'), 'utf8')
      });
      if (['/control-core.js','/control-center.js','/workspace-tools.js','/status-comments.js'].includes(new URL(url).pathname)) return route.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(root,'Resources/Extension',new URL(url).pathname.slice(1)),'utf8')});
      if (url === 'https://tapnova-preview.invalid/app.js') return route.fulfill({
        contentType: 'text/javascript', body: fs.readFileSync(path.join(root, 'Resources/Extension/app.js'), 'utf8')
      });
      if (url === 'https://tapnova-preview.invalid/panel-ui.js') return route.fulfill({
        contentType: 'text/javascript', body: fs.readFileSync(path.join(root, 'Resources/Extension/panel-ui.js'), 'utf8')
      });
      return route.abort(); // No game APIs, fonts or external services in this check.
    });
    await page.addInitScript(() => {
      if (!localStorage.getItem('_xb_prefs_v1')) localStorage.setItem('_xb_prefs_v1', JSON.stringify({ th: 'yellow', lg: 'tr', ptt: '6X0K SPACE' }));
    });
    await page.goto('https://tapnova-preview.invalid/');
    await page.waitForFunction(() => typeof window.__xbMountPanel === 'function');
    await page.evaluate(() => { window.__xbPlayAt = Date.now(); window.__xbMountPanel(); });
    await page.waitForFunction(() => window.__xbPanel?.isConnected);
    assert.equal(await page.evaluate(() => window.__xbPanel.classList.contains('tn-panel')), true, 'New visual layer must mount');
    const result = await page.evaluate(() => {
      const panel = window.__xbPanel;
      return { text: panel.innerText, html: panel.innerHTML, prefs: JSON.parse(localStorage.getItem('_xb_prefs_v1')) };
    });
    assert.match(result.text, /TAPNOVA/);
    assert.match(result.text, /created by 1TapGod/);
    assert.match(result.text, /Zaloguj się do MSP2/);
    assert.doesNotMatch(result.text, /6X0K|6x0k|github\.com|girişi/);
    assert.doesNotMatch(result.html, /radialGradient|M50 15 A 17\.5/);
    assert.equal(result.prefs.th, 'nova');
    assert.equal(result.prefs.lg, 'pl');
    await page.waitForFunction(() => {
      const panel = window.__xbPanel;
      const rect = panel.getBoundingClientRect();
      return rect.width > 300 && rect.height > 200 && getComputedStyle(panel).opacity === '1';
    });
    await page.screenshot({ path: path.join(root, 'Resources/Brand/panel-preview.png'), animations: 'disabled' });
    const clickPanel = async selector => {
      const rect = await page.evaluate(selector => {
        const element = [...window.__xbPanel.querySelectorAll(selector)].find(el => el.getBoundingClientRect().width > 0);
        if (!element) throw Error('Missing visible control: ' + selector);
        element.scrollIntoView({ block: 'nearest' });
        const r = element.getBoundingClientRect();
        return { x:r.x + r.width / 2, y:r.y + r.height / 2 };
      }, selector);
      await page.mouse.click(rect.x, rect.y);
    };
    await clickPanel('[data-tn-shortcut="homes"]');
    assert.equal(await page.evaluate(() => window.__xbPanel.querySelector('[data-tab-id="homes"]').getAttribute('aria-current')), 'page');
    assert.match(await page.evaluate(() => window.__xbPanel.innerText), /Zbuduj swoją/);
    await clickPanel('[data-tab-id="settings"]');
    assert.equal(await page.evaluate(() => window.__xbPanel.querySelector('[data-tab-id="settings"]').getAttribute('aria-current')), 'page');
    await clickPanel('[data-tab-id="profile"]');
    await clickPanel('[data-tn-action="minimize"]');
    assert.ok(await page.evaluate(() => window.__xbPanel.getBoundingClientRect().height < 100), 'Minimize must collapse panel');
    await clickPanel('[data-tn-action="minimize"]');
    assert.ok(await page.evaluate(() => window.__xbPanel.getBoundingClientRect().height > 500), 'Restore must show body');
    await clickPanel('[data-tn-action="maximize"]');
    assert.ok(await page.evaluate(() => window.__xbPanel.getBoundingClientRect().width > 580), 'Maximize must expand panel');
    await clickPanel('[data-tn-action="maximize"]');
    await page.setViewportSize({ width:390, height:700 });
    await page.evaluate(() => { const p=window.__xbPanel; p.style.left='auto'; p.style.right='12px'; p.style.top='12px'; p.querySelector('.tn-content').scrollTop=0; });
    const narrow = await page.evaluate(() => {
      const p=window.__xbPanel, r=p.getBoundingClientRect(), content=p.querySelector('.tn-content');
      return { left:r.left, right:r.right, bottom:r.bottom, width:innerWidth, height:innerHeight, overflow:content.scrollWidth-content.clientWidth };
    });
    assert.ok(narrow.left >= 0 && narrow.right <= narrow.width && narrow.bottom <= narrow.height, 'Panel stays in narrow viewport');
    assert.ok(narrow.overflow <= 1, 'Content has no horizontal overflow');
    await page.mouse.move(0,0);
    await page.screenshot({ path:path.join(root,'Resources/Brand/panel-preview-compact.png'), animations:'disabled' });
    await clickPanel('[data-tn-action="close"]');
    assert.equal(await page.evaluate(() => getComputedStyle(window.__xbPanel).display), 'none');
    await page.locator('[data-xb-restore-fab]').click();
    assert.equal(await page.evaluate(() => getComputedStyle(window.__xbPanel).display), 'flex');
    await page.evaluate(() => {
      const p = JSON.parse(localStorage.getItem('_xb_prefs_v1'));
      p.th = 'blue'; p.lg = 'en'; localStorage.setItem('_xb_prefs_v1', JSON.stringify(p));
    });
    await page.reload();
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('_xb_prefs_v1')));
    assert.equal(saved.th, 'blue');
    assert.equal(saved.lg, 'en');
    console.log('PASS: offline panel, identity, migration, shortcuts, navigation, minimize/maximize, close/restore, narrow layout, later preferences preserved.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
