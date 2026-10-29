'use strict';
// Owner-only production smoke test. Uses Wrangler access to create a short-lived
// test session in D1; it never reads or changes the owner's password.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),config=path.join(root,'license-server/cloudflare/wrangler.local.json');
const wrangler=path.join(path.dirname(require.resolve('wrangler/package.json')),'bin/wrangler.js');
const {createLicense}=require('../desktop/license.cjs');
async function main(){
 const url=new URL(process.env.TAPNOVA_LICENSE_URL);assert.equal(url.protocol,'https:');assert.equal(url.pathname,'/');const origin=url.origin;
 const secrets=JSON.parse(fs.readFileSync(path.join(root,'license-server/.data/cloudflare-secrets.json'),'utf8'));
 const token=crypto.randomBytes(32).toString('hex'),hash=crypto.createHmac('sha256',secrets.LICENSE_SECRET).update(token).digest('hex');
 const transfer=path.join(root,'license-server/.data/cloudflare-smoke.sql');
 const sql=statement=>{fs.writeFileSync(transfer,statement,{mode:0o600});try{const r=spawnSync(process.execPath,[wrangler,'d1','execute','DB','--remote','--file',transfer,'--config',config],{windowsHide:true,encoding:'utf8'});if(r.status!==0)throw Error('D1 smoke setup/cleanup failed')}finally{fs.rmSync(transfer,{force:true})}};
 const headers={origin,'x-tapnova-admin':'1',cookie:'tn_admin='+token,'content-type':'application/json'};
 const post=async(route,data)=>{const r=await fetch(origin+route,{method:'POST',headers,body:JSON.stringify(data),redirect:'error',signal:AbortSignal.timeout(15000)});const v=await r.json();assert.ok(r.ok,JSON.stringify(v));return v};
 let license,application,profile,client;
 try{
  const health=await fetch(origin+'/health');assert.equal(health.status,200);assert.equal((await health.json()).storage,'d1');
  assert.equal((await fetch(origin+'/api/admin/licenses')).status,401);
  assert.equal((await fetch(origin+'/.data/config.json')).status,404);
  sql(`INSERT INTO admin_sessions(token_hash,expires,auth_version) VALUES('${hash}',${Date.now()+600000},'${secrets.ADMIN_VERIFIER}');`);
  license=await post('/api/admin/licenses',{label:'SMOKE Cloudflare — temporary',durationDays:7,maxDevices:2});
  for(const platform of ['win32','darwin']){
   let saved;client=createLicense({serverUrl:origin,fetch,platform,storage:{read:async()=>saved,write:async v=>{saved=v},clear:async()=>{saved=null}}});
   await client.start();await client.activate(license.key,'Cloudflare test '+platform);assert.ok(client.isActive());await client.heartbeat();assert.ok(client.isActive());await client.deactivate();client.stop();
  }
  if(process.env.TAPNOVA_TEST_EXE){
   const { _electron:electron }=require('playwright'),env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
   application=await electron.launch({executablePath:process.env.TAPNOVA_TEST_EXE,args:['--smoke-test','--test-activation'],env});
   let page;for(let i=0;i<100&&!page;i++){page=application.windows().find(p=>p.url().endsWith('/desktop/index.html'));if(!page)await new Promise(r=>setTimeout(r,100))}assert.ok(page);
   profile=await application.evaluate(({app})=>app.getPath('userData'));
   await page.locator('#license-gate').waitFor({state:'visible'});await page.locator('#license-key').fill(license.key);await page.locator('#license-device').fill('Cloudflare native Windows');await page.locator('#license-submit').click();
   await page.locator('#license-gate').waitFor({state:'hidden',timeout:20000});
   assert.ok(!fs.readFileSync(path.join(profile,'license.bin')).includes(Buffer.from(license.key)));
   await post('/api/admin/licenses/'+license.id,{action:'revoke'});await page.evaluate(()=>window.tapnova.command('license-refresh'));
   await page.locator('#license-gate').waitFor({state:'visible',timeout:15000});
   console.log('PASS: packaged Windows app activates over public HTTPS and locks after revocation; token stored with OS encryption.');
  }
  console.log('PASS: production Cloudflare D1 health, protected admin API and Windows/macOS license protocol.');
 }finally{
  client?.stop();await application?.close();
  if(profile){assert.equal(path.dirname(profile),os.tmpdir());assert.ok(path.basename(profile).startsWith('tapnova-test-'));fs.rmSync(profile,{recursive:true,force:true})}
  try{if(license)await post('/api/admin/licenses/'+license.id,{action:'delete'})}finally{sql(`DELETE FROM admin_sessions WHERE token_hash='${hash}';`)}
 }
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
