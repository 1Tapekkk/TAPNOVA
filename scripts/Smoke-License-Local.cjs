'use strict';
// Local owner test only. No game traffic; creates a removable test license in the local database.
const { _electron:electron }=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const root=path.resolve(__dirname,'..'),origin='http://127.0.0.1:8787';
(async()=>{
 const password=process.env.TAPNOVA_OWNER_PASSWORD;if(!password)throw Error('Set TAPNOVA_OWNER_PASSWORD for this optional local owner test; the owner password is never read from a file');
 let cookie='';const post=async(route,data)=>{const r=await fetch(origin+route,{method:'POST',headers:{origin,'x-tapnova-admin':'1','content-type':'application/json',cookie},body:JSON.stringify(data)});if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];const result=await r.json();if(!r.ok)throw Error(result.error);return result};
 await post('/api/admin/login',{password});const license=await post('/api/admin/licenses',{label:'TEST LOKALNY — właściciel',durationDays:30,maxDevices:2});
 fs.writeFileSync(path.join(root,'license-server/.data/TEST-LICENSE.txt'),'Kod lokalny TAPNOVA (tylko serwer na tym komputerze):\n'+license.key+'\n',{mode:0o600});
 const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
 const executablePath=process.env.TAPNOVA_TEST_EXE;
 const application=await electron.launch({...(executablePath?{executablePath}:{}),args:executablePath?['--smoke-test','--test-activation']:[root,'--smoke-test','--test-activation'],env});let profile;
 try{
  let page;for(let i=0;i<100&&!page;i++){page=application.windows().find(p=>p.url().endsWith('/desktop/index.html'));if(!page)await new Promise(r=>setTimeout(r,100))}assert.ok(page);
  profile=await application.evaluate(({app,BrowserWindow})=>{BrowserWindow.getAllWindows()[0].showInactive();return app.getPath('userData')});
  await page.locator('#license-gate').waitFor({state:'visible'});
  await page.locator('#license-key').fill(license.key);await page.locator('#license-device').fill('Test automatyczny Windows');await page.locator('#license-submit').click();
  await page.locator('#license-gate').waitFor({state:'hidden',timeout:15000});
  assert.equal((await page.evaluate(()=>window.tapnova.command('license-status'))).active,true);
  assert.ok(!fs.readFileSync(path.join(profile,'license.bin')).includes(Buffer.from(license.key)));
  await post('/api/admin/licenses/'+license.id,{action:'revoke'});
  await page.evaluate(()=>window.tapnova.command('license-refresh'));await page.locator('#license-gate').waitFor({state:'visible'});
  assert.equal((await page.evaluate(()=>window.tapnova.command('license-status'))).active,false);
  await post('/api/admin/licenses/'+license.id,{action:'enable'});
  console.log('PASS: real Electron activation over loopback, OS-encrypted credentials and server revocation lock. Test code saved privately in license-server/.data/TEST-LICENSE.txt.');
 }finally{await application.close();if(profile){assert.equal(path.dirname(profile),os.tmpdir());assert.ok(path.basename(profile).startsWith('tapnova-test-'));fs.rmSync(profile,{recursive:true,force:true})}await post('/api/admin/logout',{})}
})().catch(e=>{console.error(e);process.exitCode=1});
