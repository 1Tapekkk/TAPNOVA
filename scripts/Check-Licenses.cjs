'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {createStore}=require('../license-server/store.cjs'),{createServer}=require('../license-server/server.cjs'),{createLicense}=require('../desktop/license.cjs');
const {chromium}=require('playwright');
async function main(){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'tapnova-license-test-'));let server,browser;
 try{
  let now=1000000;let store=createStore(path.join(dir,'unit.sqlite'),'unit-secret',()=>now);
  const first=store.create({label:'Anna',durationDays:7,maxDevices:1});assert.equal(first.expires,null);
  const activation=store.activate({key:first.key,deviceId:'one',label:'Laptop',platform:'win32'});
  assert.equal(activation.license.expires,now+7*86400000);assert.throws(()=>store.activate({key:first.key,deviceId:'two',label:'Mac',platform:'darwin'}),/device-limit/);
  assert.throws(()=>store.heartbeat(activation.token,'two'),/activation-required/);
  assert.ok(store.list()[0].devices[0].online);now+=46000;assert.equal(store.list()[0].devices[0].online,false);
  store.change(first.id,{action:'reset'});assert.throws(()=>store.heartbeat(activation.token,'one'),/activation-required/);
  now+=8*86400000;assert.throws(()=>store.activate({key:first.key,deviceId:'one',label:'Laptop',platform:'win32'}),/expired/);
  store.change(first.id,{action:'extend',durationDays:30});const renewed=store.activate({key:first.key,deviceId:'one',label:'Laptop',platform:'win32'});
  store.change(first.id,{action:'revoke'});assert.throws(()=>store.heartbeat(renewed.token,'one'));assert.throws(()=>store.activate({key:first.key,deviceId:'one',label:'Laptop',platform:'win32'}),/revoked/);
  store.change(first.id,{action:'enable'});store.change(first.id,{action:'rotate'});assert.throws(()=>store.activate({key:first.key,deviceId:'one',label:'Laptop',platform:'win32'}),/invalid-key/);
  assert.ok(!JSON.stringify(store.list()).includes(first.key));assert.ok(!JSON.stringify(store.db.prepare('SELECT * FROM licenses').all()).includes(first.key));store.close();
  const password='test-only-'+crypto.randomBytes(12).toString('hex'),salt=crypto.randomBytes(16).toString('hex');
  const config={secret:crypto.randomBytes(32).toString('hex'),salt,passwordHash:crypto.scryptSync(password,salt,64).toString('hex')};
  const reserve=require('net').createServer();await new Promise(r=>reserve.listen(0,'127.0.0.1',r));const port=reserve.address().port;await new Promise(r=>reserve.close(r));const origin='http://127.0.0.1:'+port;
  const service=createServer({config,dataDir:dir,origin,secure:false});server=service.server;await new Promise(r=>server.listen(port,'127.0.0.1',r));
  const post=(route,data,headers={})=>fetch(origin+route,{method:'POST',headers:{'content-type':'application/json',...headers},body:JSON.stringify(data)});
  assert.equal((await fetch(origin+'/api/admin/licenses')).status,401);
  assert.equal((await post('/api/admin/login',{password})).status,403);
  const adminHeaders={origin,'x-tapnova-admin':'1'};
  const login=await post('/api/admin/login',{password},adminHeaders);assert.equal(login.status,200);assert.match(login.headers.get('set-cookie'),/HttpOnly; SameSite=Strict/);
  adminHeaders.cookie=login.headers.get('set-cookie').split(';')[0];
  const key=await (await post('/api/admin/licenses',{label:'Test integracji',durationDays:30,maxDevices:1},adminHeaders)).json();
  const payload={key:key.key,label:'Laptop',platform:'win32'};
  const parallel=await Promise.all([post('/api/activate',{...payload,deviceId:'race-1'}),post('/api/activate',{...payload,deviceId:'race-2'})]);assert.deepEqual(parallel.map(r=>r.status).sort(),[200,400]);
  await post('/api/admin/licenses/'+key.id,{action:'reset'},adminHeaders);
  let saved=null;let fail=false,clock=Date.now();const states=[];
  const client=createLicense({serverUrl:origin,platform:'win32',now:()=>clock,fetch:(...args)=>{if(fail)throw Error('offline');return fetch(...args)},storage:{read:async()=>saved,write:async v=>{saved=v},clear:async()=>{saved=null}},notify:s=>states.push(s)});
  await client.start();assert.equal(client.isActive(),false);await client.activate(key.key,'Laptop testowy');assert.equal(client.isActive(),true);assert.ok(saved.token);assert.ok(!JSON.stringify(saved).includes(key.key));
  fail=true;await client.heartbeat();assert.equal(client.isActive(),false);fail=false;await client.heartbeat();assert.equal(client.isActive(),true);clock+=25000;assert.equal(client.isActive(),false);clock=Date.now();await client.heartbeat();
  await post('/api/admin/licenses/'+key.id,{action:'revoke'},adminHeaders);await client.heartbeat();assert.equal(client.isActive(),false);client.stop();
  assert.equal((await post('/api/admin/licenses',{label:'csrf',durationDays:7,maxDevices:1},{...adminHeaders,origin:'https://evil.invalid'})).status,403);
  // Real UI against the real SQLite service. The proxy only supplies the configured test Origin.
  browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1200,height:850}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin);await page.locator('#password').fill(password);await page.locator('#login button').click();await page.locator('#workspace').waitFor({state:'visible',timeout:7000}).catch(async e=>{console.log(await page.locator('#notice').textContent(),errors);throw e});
  await page.locator('[name=label]').fill('Koleżanka — Windows');await page.locator('#create button').click();await page.locator('#new-key').waitFor({state:'visible'});assert.match(await page.locator('#key').inputValue(),/^TN-/);
  await page.locator('#key').evaluate(e=>{e.value='TN-••••••••-••••••••'});await page.screenshot({path:path.resolve(__dirname,'../test-results/license-admin.png')});
  await page.locator('#logout').click();await page.locator('#login').waitFor({state:'visible'});assert.equal(await page.locator('#key').inputValue(),'');assert.deepEqual(errors,[]);
  const shell=await browser.newPage();await shell.addInitScript(()=>{window.tapnova={platform:'win32',onStatus(){},onUpdate(){},onLicense(fn){window.licenseChange=fn},command:async(name)=>name==='license-status'?{phase:'locked',active:false}:name==='license-activate'?{phase:'active',active:true,label:'Test',expires:null}:{ok:true}}});
  await shell.goto(require('node:url').pathToFileURL(path.resolve(__dirname,'../desktop/index.html')).href);await shell.locator('#license-gate').waitFor({state:'visible'});await shell.keyboard.press('Escape');assert.ok(await shell.locator('#license-gate').isVisible());
  await shell.locator('#license-key').fill('TN-TEST');await shell.locator('#license-device').fill('Laptop');await shell.locator('#license-submit').click();await shell.locator('#license-gate').waitFor({state:'hidden'});assert.equal(await shell.locator('#license-key').inputValue(),'');
  await shell.evaluate(()=>window.licenseChange({phase:'expired',active:false}));await shell.locator('#license-gate').waitFor({state:'visible'});await shell.screenshot({path:path.resolve(__dirname,'../test-results/license-activation.png')});
  console.log('PASS: SQLite expiry/revocation/reset/rotation, atomic device limits, bearer binding, online/offline lease, admin auth/CSRF, real owner UI and activation gate.');
 }finally{await browser?.close();if(server)await new Promise(r=>server.close(r));assert.equal(path.dirname(dir),os.tmpdir());assert.ok(path.basename(dir).startsWith('tapnova-license-test-'));fs.rmSync(dir,{recursive:true,force:true})}
}
main().catch(e=>{console.error(e);process.exitCode=1});
