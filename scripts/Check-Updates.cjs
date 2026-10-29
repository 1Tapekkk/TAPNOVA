'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const {EventEmitter}=require('node:events');
const {createUpdates,newer,windowsEngine}=require('../desktop/updates.cjs');
const {macEngine,validateManifest}=require('../desktop/mac-updates.cjs');
const {chromium}=require('playwright');
function fixture({automatic=true,consent=true,fail=false}={}) {
  const calls=[],states=[];let onProgress=()=>{},onError=()=>{};
  const engine={onProgress:f=>{onProgress=f},onError:f=>{onError=f},check:async()=>({version:'4.3.0'}),download:async()=>{calls.push('download');onProgress(42);if(fail)throw Error('checksum')},install:async()=>{calls.push('install')}};
  const service=createUpdates({engine,currentVersion:'4.2.0',automatic,notify:s=>states.push(s),confirm:async()=>consent});
  return {service,calls,states,engine,error:()=>onError(Error('failed'))};
}
async function main(){
  assert.ok(newer('4.10.0','4.2.0'));assert.ok(!newer('4.1.0','4.2.0'));assert.ok(!newer('4.3.0-beta','4.2.0'));
  let f=fixture();await f.service.apply();assert.equal(f.calls.length,0);await f.service.check();await f.service.apply();assert.deepEqual(f.calls,['download','install']);assert.ok(f.states.some(s=>s.phase==='downloading'&&s.progress===42));
  f=fixture({consent:false});await f.service.check();await f.service.apply();assert.equal(f.calls.length,0);
  f=fixture({fail:true});await f.service.check();await f.service.apply();assert.equal(f.service.snapshot().phase,'error');assert.deepEqual(f.calls,['download']);
  f=fixture();let release;f.engine.download=()=>new Promise(resolve=>{release=resolve});await f.service.check();const pending=f.service.apply();await new Promise(resolve=>setImmediate(resolve));await f.service.apply();f.service.stop();release();await pending;assert.equal(f.calls.length,0,'Shutdown during download cannot trigger installation');
  f=fixture();f.engine.check=async()=>({version:'4.1.0'});await f.service.check();assert.equal(f.service.snapshot().phase,'current');await f.service.apply();assert.equal(f.calls.length,0);
  f=fixture({automatic:false,consent:false});await f.service.check();await f.service.apply();assert.equal(f.service.snapshot().phase,'opened');await f.service.apply();assert.deepEqual(f.calls,['download','install','install']);
  const updater=new EventEmitter();let installArgs;
  updater.checkForUpdates=async()=>({updateInfo:{version:'4.3.0'}});updater.downloadUpdate=async()=>['verified.exe'];updater.quitAndInstall=(...args)=>{installArgs=args};
  const adapter=windowsEngine(updater);assert.equal(updater.autoDownload,false);assert.equal(updater.autoInstallOnAppQuit,false);assert.equal(updater.allowDowngrade,false);assert.equal(updater.allowPrerelease,false);await adapter.install();assert.deepEqual(installArgs,[true,true]);
  console.log('PASS: updater consent, download/install order, progress, failure, shutdown, duplicate clicks, downgrade protection and Windows restart flags.');
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'tapnova-update-test-'));
  try {
    const bytes=Buffer.alloc(2048,42),hash=crypto.createHash('sha256').update(bytes).digest('hex');
    const file={name:'TAPNOVA-4.3.0-mac-arm64.dmg',sha256:hash,size:bytes.length},doc={version:'4.3.0',files:[file]};
    assert.throws(()=>validateManifest(doc,'x64'));assert.throws(()=>validateManifest({...doc,files:[{...file,size:-1}]},'arm64'));
    let corrupt=false,opened=0;const urls=[];
    const engine=macEngine({arch:'arm64',directory:dir,openPath:async()=>{opened++;return ''},fetch:async(url,options)=>{urls.push(url);assert.equal(options.credentials,'omit');return url.endsWith('update.json')?new Response(JSON.stringify(doc)):new Response(corrupt?Buffer.alloc(2048,0):bytes)}});
    engine.onProgress(()=>{});await engine.check();await engine.download();await engine.install();assert.equal(opened,1);
    assert.ok(urls.every(url=>url.startsWith('https://github.com/1Tapekkk/TAPNOVA/releases/')));
    await fs.writeFile(path.join(dir,file.name),'tampered');await assert.rejects(()=>engine.install(),/checksum/);assert.equal(opened,1);
    corrupt=true;await engine.check();await assert.rejects(()=>engine.download(),/checksum/);await assert.rejects(()=>engine.install());assert.equal(opened,1);assert.ok(!(await fs.readdir(dir)).some(file=>file.endsWith('.part')));
  }finally{assert.equal(path.dirname(dir),os.tmpdir());assert.ok(path.basename(dir).startsWith('tapnova-update-test-'));await fs.rm(dir,{recursive:true,force:true})}
  console.log('PASS: Mac architecture selection, restricted release origin, checksum verification, tamper rejection and incomplete download cleanup.');
  const browser=await chromium.launch({headless:true});
  try {
    const page=await browser.newPage({viewport:{width:960,height:700}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.route(/^https?:/,route=>route.abort());
    await page.addInitScript(()=>{window.testCalls=[];window.tapnova={platform:'win32',onStatus:()=>{},onUpdate:f=>{window.testUpdate=f},command:async name=>{window.testCalls.push(name);if(name==='update-status')return {phase:'idle',installed:'4.2.0',automatic:true};if(name==='update-check')return {phase:'available',installed:'4.2.0',version:'4.3.0',automatic:true};return {ok:true}}}});
    await page.goto(require('node:url').pathToFileURL(path.resolve(__dirname,'../desktop/index.html')).href);
    await page.locator('[data-page=settings]').first().click();await page.locator('#update-action').click();await page.locator('#update-badge').waitFor({state:'visible'});
    assert.match(await page.locator('#update-action').innerText(),/Pobierz i zainstaluj/);
    await page.evaluate(()=>window.testUpdate({phase:'downloading',installed:'4.2.0',version:'4.3.0',progress:47,automatic:true}));assert.equal(await page.locator('#update-action').isDisabled(),true);assert.equal(await page.locator('#update-progress').evaluate(e=>e.value),47);
    await page.evaluate(()=>window.testUpdate({phase:'opened',installed:'4.2.0',version:'4.3.0',automatic:false}));assert.match(await page.locator('#update-action').innerText(),/Otwórz instalator/);assert.match(await page.locator('#update-note').innerText(),/ręcznego/);
    assert.ok(await page.evaluate(()=>document.querySelector('#main').scrollWidth<=document.querySelector('#main').clientWidth));
    await page.screenshot({path:path.resolve(__dirname,'../test-results/updates-settings.png')});assert.deepEqual(errors,[]);
  }finally{await browser.close()}
  console.log('PASS: update badge, settings, progress, disabled controls, Mac instructions and narrow layout.');
}
main().catch(error=>{console.error(error);process.exitCode=1});
