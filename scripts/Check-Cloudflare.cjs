'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const runtime=require('node:module').createRequire(require.resolve('wrangler'));
const {Miniflare,convertV4MiniflareOptions}=runtime('miniflare'),{buildSync}=runtime('esbuild');
const {chromium}=require('playwright');
const {createLicense}=require('../desktop/license.cjs');
async function main(){
 const root=path.resolve(__dirname,'..'),password=crypto.randomBytes(24).toString('hex'),salt=crypto.randomBytes(32).toString('hex');
 const proof=crypto.pbkdf2Sync(password,salt,600000,32,'sha256').toString('hex');
 const bindings={LICENSE_SECRET:crypto.randomBytes(32).toString('hex'),ADMIN_SALT:salt,ADMIN_VERIFIER:crypto.createHash('sha256').update(proof).digest('hex')};
 const script=buildSync({entryPoints:[path.join(root,'license-server/cloudflare/worker.mjs')],bundle:true,write:false,format:'esm',platform:'browser'}).outputFiles[0].text;
 const options={modules:true,script,compatibilityDate:'2026-10-23',bindings,d1Databases:{DB:'test'},
  ratelimits:{LOGIN_LIMIT:{namespace_id:'421001',simple:{limit:5,period:60}},ACTIVATION_LIMIT:{namespace_id:'421002',simple:{limit:20,period:60}},CLIENT_LIMIT:{namespace_id:'421003',simple:{limit:600,period:60}}},
  serviceBindings:{ASSETS:async req=>{const pathname=new URL(req.url).pathname,file=pathname==='/'?'index.html':pathname.slice(1);return new Response(fs.readFileSync(path.join(root,'license-server/public',file)),{headers:{'content-type':file.endsWith('.html')?'text/html':file.endsWith('.js')?'text/javascript':'text/css'}})}}};
 const mf=new Miniflare(convertV4MiniflareOptions(options));let browser,client;
 try{
  const db=await mf.getD1Database('DB');
  // D1 exec accepts complete trigger definitions when each statement occupies one line.
  const migrations=path.join(root,'license-server/cloudflare/migrations');
  const sql=fs.readdirSync(migrations).filter(f=>f.endsWith('.sql')).sort().map(f=>fs.readFileSync(path.join(migrations,f),'utf8')).join('\n');
  await db.exec(sql.replace(/^--.*$/gm,'').replace(/\s+/g,' '));
  const origin=(await mf.ready).origin;
  const post=(route,data,headers={})=>fetch(origin+route,{method:'POST',headers:{'content-type':'application/json',...headers},body:JSON.stringify(data)});
  assert.equal((await fetch(origin+'/health')).status,200);
  assert.equal((await fetch(origin+'/api/admin/licenses')).status,401);
  for(const route of ['channel','draft','welcome','welcome-preview','welcome-check'])assert.equal((await fetch(origin+'/api/admin/discord/'+route+'?id=test')).status,401);
  for(const route of ['welcome','welcome-preview','welcome-check'])assert.equal((await post('/api/admin/discord/'+route,{})).status,403);
  assert.equal((await post('/api/admin/login',{proof})).status,403);
  const headers={origin,'x-tapnova-admin':'1'};
  assert.equal((await post('/api/admin/discord/commands',{})).status,403);
  assert.equal((await post('/api/admin/discord/commands',{},headers)).status,401);
  assert.equal((await post('/api/admin/login',{proof:'0'.repeat(64)},headers)).status,401);
  const login=await post('/api/admin/login',{proof},headers);assert.equal(login.status,200,await login.text());
  assert.match(login.headers.get('set-cookie'),/HttpOnly; SameSite=Strict/);headers.cookie=login.headers.get('set-cookie').split(';')[0];
  const admin=async(route,data)=>{const r=await post(route,data,headers);const v=await r.json();assert.ok(r.ok,JSON.stringify(v));return v};
  const key=await admin('/api/admin/licenses',{label:'D1 test',durationDays:7,maxDevices:1});
  const payload={key:key.key,label:'Windows',platform:'win32'};
  const race=await Promise.all([1,2,3,4].map(n=>post('/api/activate',{...payload,deviceId:'race'+n})));
  assert.equal(race.filter(r=>r.status===200).length,1);
  for(const r of race.filter(r=>r.status!==200))assert.equal((await r.json()).error,'device-limit');
  let list=await (await fetch(origin+'/api/admin/licenses',{headers})).json();assert.equal(list.licenses[0].devices.length,1);assert.ok(list.licenses[0].devices[0].online);assert.ok(!JSON.stringify(list).includes(key.key));
  const change=data=>admin('/api/admin/licenses/'+key.id,data);
  await change({action:'devices',maxDevices:2});
  await post('/api/activate',{...payload,deviceId:'second'});
  assert.equal((await (await post('/api/admin/licenses/'+key.id,{action:'devices',maxDevices:1},headers)).json()).error,'remove-devices-first');
  await change({action:'reset'});
  for(const platform of ['win32','darwin']){
   let saved=null;client=createLicense({serverUrl:origin,fetch,platform,storage:{read:async()=>saved,write:async v=>{saved=v},clear:async()=>{saved=null}}});
   await client.start();await client.activate(key.key,platform);assert.ok(client.isActive());
   await client.heartbeat();assert.ok(client.isActive());
   await change({action:'revoke'});await client.heartbeat();assert.equal(client.isActive(),false);
   await change({action:'enable'});await client.activate(key.key,platform);assert.ok(client.isActive());
   await client.deactivate();assert.equal(client.isActive(),false);client.stop();
  }
  await db.prepare('UPDATE licenses SET expires=? WHERE id=?').bind(Date.now()-1,key.id).run();
  assert.equal((await (await post('/api/activate',{...payload,deviceId:'expired'})).json()).error,'expired');
  await change({action:'extend',durationDays:0});
  const rotated=await change({action:'rotate'});
  assert.equal((await (await post('/api/activate',{...payload,deviceId:'old'})).json()).error,'invalid-key');
  assert.equal((await post('/api/activate',{...payload,key:rotated.key,deviceId:'new'})).status,200);
  assert.equal((await post('/api/admin/licenses',{label:'csrf'}, {...headers,origin:'https://evil.invalid'})).status,403);
  assert.equal((await post('/api/activate',{key:'a'.repeat(17000)})).status,413);
  assert.equal((await fetch(origin+'/.data/config.json')).status,404);
  assert.equal((await post('/api/admin/logout',{},headers)).status,200);
  assert.equal((await fetch(origin+'/api/admin/licenses',{headers})).status,401);
  // Real browser proves the slow password derivation matches the stored verifier.
  browser=await chromium.launch({headless:true});const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin);await page.locator('#password').fill(password);await page.locator('#login button').click();
  await page.locator('#workspace').waitFor({state:'visible',timeout:20000});
  await page.locator('[name=label]').fill('Cloudflare — test');await page.locator('#create button').click();await page.locator('#new-key').waitFor({state:'visible'});
  assert.match(await page.locator('#key').inputValue(),/^TN-/);
  await page.locator('#logout').click();await page.locator('#login').waitFor({state:'visible'});assert.deepEqual(errors,[]);
  for(let i=0;i<6;i++)await post('/api/admin/login',{proof:'0'.repeat(64)},headers);
  assert.equal((await post('/api/admin/login',{proof},headers)).status,429);
  console.log('Cloudflare: real Workers/D1, concurrent device cap, Windows/macOS client protocol, expiry, rotation, revocation, CSRF, logout, rate limit and browser owner panel passed.');
 }finally{client?.stop();await browser?.close();await mf.dispose()}
}
main().catch(e=>{console.error(e);process.exitCode=1});
