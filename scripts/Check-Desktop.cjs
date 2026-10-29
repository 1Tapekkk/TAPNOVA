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
    const encrypted=await application.evaluate(async({app,safeStorage})=>{
      const req=process.getBuiltinModule('module').createRequire(app.getAppPath()+'/package.json');
      const fs=process.getBuiltinModule('fs/promises');
      const file=app.getPath('userData')+'/test-license.bin';
      const storage=req('./desktop/license.cjs').encryptedStorage({safeStorage,file});
      const value={deviceId:'fixture-installation',token:'fixture-token-not-a-real-license'};
      await storage.write(value);const bytes=await fs.readFile(file),read=await storage.read();await storage.clear();
      return {roundtrip:read.token===value.token&&!bytes.includes(Buffer.from(value.token)),available:safeStorage.isEncryptionAvailable()};
    });
    assert.equal(encrypted.available,true);assert.equal(encrypted.roundtrip,true,'Native encrypted license storage roundtrip');
    assert.match(await page.title(),/TAPNOVA/);
    assert.equal(await page.evaluate(()=>typeof require),'undefined');
    assert.equal(await page.evaluate(()=>typeof window.tapnova.command),'function');
    assert.equal(await page.evaluate(()=>typeof window.tapnova.onUpdate),'function');
    const updateState=await page.evaluate(()=>window.tapnova.command('update-status'));
    assert.equal(updateState.phase,'disabled','Smoke tests cannot contact update servers');
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
    const integration=await application.evaluate(async({webContents,BrowserWindow,app})=>{
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
      const result=await wc.executeJavaScript(`new Promise(resolve=>{let tries=0;const check=()=>{if(window.__xbMountPanel&&window.__tapnovaUI){window.__xbPlayAt=Date.now();window.__xbMountPanel();resolve({panel:!!window.__xbPanel,comments:typeof window.__tapnovaComments,require:typeof require,bridge:typeof window.tapnova,game:location.hostname})}else if(++tries<100)setTimeout(check,50);else resolve({error:'document-start injection did not mount'})};check()})`);
      const packs=await wc.executeJavaScript(`new Promise(resolve=>{const id='desktop-test';let timer=setTimeout(()=>resolve({error:'pack bridge timeout'}),10000);window.addEventListener('message',function handler(e){if(e.data?.__xbPack===1&&e.data.dir==='res'&&e.data.reqId===id){clearTimeout(timer);window.removeEventListener('message',handler);resolve({ok:e.data.ok,hasPack:!!e.data.emojis})}});window.postMessage({__xbPack:1,dir:'req',reqId:id},location.origin)})`);
      const child=wc.mainFrame.frames.find(frame=>frame.url.endsWith('/fixture-frame'));
      const childInjected=child?await child.executeJavaScript('typeof window.__tapnovaUI'):null;
      await wc.loadURL('https://moviestarplanet2.com/reload');
      const reloaded=await wc.executeJavaScript('typeof window.__tapnovaUI');
      const photoModule=process.getBuiltinModule('module').createRequire(app.getAppPath()+'/package.json')('./desktop/photo.cjs');
      const main=BrowserWindow.getAllWindows()[0];
      main.showInactive();
      await main.webContents.executeJavaScript('window.__xbPanel=document.createElement("div");window.__xbPanel.textContent="Photo fixture panel";document.body.append(window.__xbPanel)');
      let capturedBytes=0;
      const photo=await photoModule.createPhotographer({wait:async()=>{}})({webContents:main.webContents,
        chooseFile:async()=>({filePath:'offline.png'}),writeFile:async(_file,bytes)=>{capturedBytes=bytes.length}});
      const restored=await main.webContents.executeJavaScript('getComputedStyle(window.__xbPanel).visibility');
      return {result,packs,reloaded,childInjected,photo,capturedBytes,restored,preferences:wc.getLastWebPreferences()};
    });
    assert.equal(integration.result.panel,true,JSON.stringify(integration));
    assert.equal(integration.photo.ok,true);assert.ok(integration.capturedBytes>100);assert.equal(integration.restored,'visible');
    assert.equal(integration.result.comments,'object','Status comments module is injected');
    assert.equal(integration.result.require,'undefined');assert.equal(integration.result.bridge,'undefined');
    assert.deepEqual(integration.packs,{ok:true,hasPack:true});
    assert.equal(integration.reloaded,'object');
    assert.equal(integration.childInjected,'object','Child game frames receive document-start injection');
    assert.equal(integration.preferences.sandbox,true);assert.equal(integration.preferences.nodeIntegration,false);assert.equal(integration.preferences.contextIsolation,true);
    // Exercise the actual electron-updater transport against a loopback fixture.
    // Fake installers are checksum-tested, never executed; the real user profile is not used.
    const transport=await application.evaluate(async({app})=>{
      const req=process.getBuiltinModule('module').createRequire(app.getAppPath()+'/package.json');
      const {NsisUpdater}=req('electron-updater');
      const fs=process.getBuiltinModule('fs/promises'),path=process.getBuiltinModule('path'),crypto=process.getBuiltinModule('crypto'),http=process.getBuiltinModule('http');
      const data=Buffer.alloc(1024*1024,42),sha=crypto.createHash('sha512').update(data).digest('base64');
      const [major,minor,patch]=app.getVersion().split('.').map(Number);
      let corrupt=false;
      const server=http.createServer((request,response)=>{
        if(request.url.includes('.yml')){const expected=corrupt?crypto.createHash('sha512').update(Buffer.alloc(data.length,43)).digest('base64'):sha;const v=`${major}.${minor}.${patch+(corrupt?2:1)}`;response.end(`version: ${v}\nfiles:\n  - url: fixture-${v}.exe\n    sha512: ${expected}\n    size: ${data.length}\npath: fixture-${v}.exe\nsha512: ${expected}\n`)}
        else {response.setHeader('Content-Length',data.length);response.end(corrupt?Buffer.alloc(data.length,0):data)}
      });
      await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
      try {
        const config=path.join(app.getPath('userData'),'test-update.yml');
        // An absolute cache path keeps even update downloads inside the smoke profile.
        await fs.writeFile(config,'updaterCacheDirName: '+JSON.stringify('tapnova-update-test-'+process.pid)+'\n');
        const updater=new NsisUpdater({provider:'generic',url:`http://127.0.0.1:${server.address().port}`});
        updater.logger=null;updater.app.baseCachePath=app.getPath('userData');updater.updateConfigPath=config;updater.setFeedURL({provider:'generic',url:`http://127.0.0.1:${server.address().port}`});updater.forceDevUpdateConfig=true;updater.autoDownload=false;updater.autoInstallOnAppQuit=false;updater.disableDifferentialDownload=true;updater.on('error',()=>{});
        await updater.checkForUpdates();const files=await updater.downloadUpdate();
        const good=files.length===1&&(await fs.stat(files[0])).size===data.length;
        corrupt=true;await updater.checkForUpdates();let rejected=false;
        try{await updater.downloadUpdate()}catch{rejected=true}
        return {good,rejected};
      }finally{await new Promise(resolve=>server.close(resolve))}
    });
    assert.equal(transport.good,true,'Real updater downloads verified installer fixture');
    assert.equal(transport.rejected,true,'Real updater rejects corrupted installer fixture');
    assert.deepEqual(errors,[]);
    console.log('PASS: real Electron shell, navigation, minimum size, sandbox, IPC boundaries, offline game document-start injection, data-pack bridge and reinjection after navigation.');
  } finally {
    await application.close();
    // Only remove this run's explicitly verified temporary smoke-test profile.
    const temp=path.resolve(require('node:os').tmpdir());
    if(profile&&path.dirname(path.resolve(profile))===temp&&/^tapnova-test-\d+$/.test(path.basename(profile)))fs.rmSync(profile,{recursive:true,force:true,maxRetries:5,retryDelay:300});
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
