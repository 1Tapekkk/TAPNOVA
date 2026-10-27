const { _electron:electron } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { isGameURL } = require('../desktop/policy.cjs');
const root = path.resolve(__dirname,'..');
(async()=>{
  assert.ok(isGameURL('https://moviestarplanet2.com/'));
  assert.ok(isGameURL('https://www.moviestarplanet2.com/play'));
  for(const url of ['http://moviestarplanet2.com','https://moviestarplanet2.com.evil.test','file:///etc/passwd','javascript:alert(1)'])assert.equal(isGameURL(url),false);
  const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
  const executablePath=process.env.TAPNOVA_TEST_EXE;
  const application=await electron.launch({...(executablePath?{executablePath}:{}),args:executablePath?['--smoke-test']:[root,'--smoke-test'],env});
  let profile;
  try {
    // The game WebContentsView is created before the shell page. firstWindow()
    // can therefore return the blank game renderer, not the application shell.
    let page;
    for(let attempt=0;attempt<100&&!page;attempt++) {
      page=application.windows().find(candidate=>candidate.url().endsWith('/desktop/index.html'));
      if(!page)await new Promise(resolve=>setTimeout(resolve,100));
    }
    assert.ok(page,'Desktop shell loaded');
    // A packaged hidden window can suspend its compositor on Windows; render
    // without stealing keyboard focus before requesting visual evidence.
    if(executablePath)await application.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].showInactive());
    await page.waitForSelector('#welcome-title');await page.evaluate(()=>document.fonts.ready);
    profile=await application.evaluate(({app})=>app.getPath('userData'));
    assert.match(await page.title(),/TAPNOVA/);
    assert.equal(await page.evaluate(()=>typeof require),'undefined');
    assert.equal(await page.evaluate(()=>typeof window.tapnova.command),'function');
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    fs.mkdirSync(path.join(root,'test-results'),{recursive:true});
    await page.screenshot({path:path.join(root,'test-results/desktop-home.png')});
    await page.locator('.nav-item[data-page="help"]').click();await page.waitForSelector('#page-help:not([hidden])');
    assert.match(await page.locator('#page-help').innerText(),/Ctrl\+V/);
    await page.locator('.nav-item[data-page="settings"]').click();assert.ok(await page.locator('#clear-data').isVisible());
    await page.locator('.nav-item[data-page="home"]').click();
    await page.locator('.hero [data-game]').click();
    assert.match(await page.locator('#status-text').innerText(),/offline/);
    await application.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(960,700));
    assert.ok(await page.evaluate(()=>document.querySelector('#main').scrollWidth<=document.querySelector('#main').clientWidth),'No horizontal overflow at minimum window size');
    await page.screenshot({path:path.join(root,'test-results/desktop-compact.png')});
    // Intercept HTTPS at the Chromium protocol layer: every request is fulfilled
    // locally, including the real game's origin. No account/session is used.
    const integration=await application.evaluate(async({webContents,BrowserWindow})=>{
      const shell=BrowserWindow.getAllWindows()[0].webContents;
      const wc=webContents.getAllWebContents().find(w=>w.id!==shell.id&&w.getType()==='window');
      if(!wc)throw Error('Game WebContents missing');
      wc.session.webRequest.onBeforeRequest((_details,callback)=>callback({cancel:false}));
      await wc.session.protocol.handle('https',request=>{
        const url=new URL(request.url);
        if(url.hostname==='moviestarplanet2.com')return new Response('<!doctype html><meta charset="utf-8"><body><canvas tabindex="0"></canvas><h1>Offline game fixture</h1>'+(url.pathname==='/'?'<iframe src="/fixture-frame"></iframe>':''),{headers:{'content-type':'text/html'}});
        return new Response('',{status:404});
      });
      await wc.loadURL('https://moviestarplanet2.com/');
      const result=await wc.executeJavaScript(`new Promise(resolve=>{let tries=0;const check=()=>{if(window.__xbMountPanel&&window.__tapnovaUI){window.__xbPlayAt=Date.now();window.__xbMountPanel();resolve({panel:!!window.__xbPanel,require:typeof require,bridge:typeof window.tapnova,game:location.hostname})}else if(++tries<100)setTimeout(check,50);else resolve({error:'document-start injection did not mount'})};check()})`);
      const packs=await wc.executeJavaScript(`new Promise(resolve=>{const id='desktop-test';let timer=setTimeout(()=>resolve({error:'pack bridge timeout'}),10000);window.addEventListener('message',function handler(e){if(e.data?.__xbPack===1&&e.data.dir==='res'&&e.data.reqId===id){clearTimeout(timer);window.removeEventListener('message',handler);resolve({ok:e.data.ok,hasPack:!!e.data.emojis})}});window.postMessage({__xbPack:1,dir:'req',reqId:id},location.origin)})`);
      const child=wc.mainFrame.frames.find(frame=>frame.url.endsWith('/fixture-frame'));
      const childInjected=child?await child.executeJavaScript('typeof window.__tapnovaUI'):null;
      await wc.loadURL('https://moviestarplanet2.com/reload');
      const reloaded=await wc.executeJavaScript('typeof window.__tapnovaUI');
      return {result,packs,reloaded,childInjected,preferences:wc.getLastWebPreferences()};
    });
    assert.equal(integration.result.panel,true,JSON.stringify(integration));
    assert.equal(integration.result.require,'undefined');assert.equal(integration.result.bridge,'undefined');
    assert.deepEqual(integration.packs,{ok:true,hasPack:true});
    assert.equal(integration.reloaded,'object');
    assert.equal(integration.childInjected,'object','Child game frames receive document-start injection');
    assert.equal(integration.preferences.sandbox,true);assert.equal(integration.preferences.nodeIntegration,false);assert.equal(integration.preferences.contextIsolation,true);
    assert.deepEqual(errors,[]);
    console.log('PASS: real Electron shell, navigation, minimum size, sandbox, IPC boundaries, offline game document-start injection, data-pack bridge and reinjection after navigation.');
  } finally {
    await application.close();
    // Only remove this run's explicitly verified temporary smoke-test profile.
    const temp=path.resolve(require('node:os').tmpdir());
    if(profile&&path.dirname(path.resolve(profile))===temp&&/^tapnova-test-\d+$/.test(path.basename(profile)))fs.rmSync(profile,{recursive:true,force:true,maxRetries:5,retryDelay:300});
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
