'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {createLicense,encryptedStorage}=require('../desktop/license.cjs');
module.exports=async function(){
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'tapnova-secure-test-')),clients=[];
 try{
  let cryptoCalls=0,deny=false,rotate=false;
  const safeStorage={
   isEncryptionAvailable(){throw Error('Synchronous keychain access is forbidden')},
   async isAsyncEncryptionAvailable(){cryptoCalls++;return !deny},
   async encryptStringAsync(s){cryptoCalls++;return Buffer.from('encrypted:'+Buffer.from(s).toString('base64'))},
   async decryptStringAsync(b){cryptoCalls++;return {result:Buffer.from(b.toString().slice(10),'base64').toString(),shouldReEncrypt:rotate}}
  };
  const file=path.join(dir,'license.bin'),storage=encryptedStorage({safeStorage,file}),saved={deviceId:'same-device',token:'private-session'};
  assert.equal(await storage.hasData(),false);await assert.rejects(()=>storage.read(),{code:'ENOENT'});assert.equal(cryptoCalls,0,'Missing file must not open Keychain');
  await storage.write(saved);assert.equal(await storage.hasData(),true);assert.deepEqual(await storage.read(),saved);
  const before=await fs.readFile(file);assert.ok(!before.includes(saved.token));deny=true;
  await assert.rejects(()=>storage.write({deviceId:'other',token:'other'}));assert.deepEqual(await fs.readFile(file),before,'Failed encryption preserves existing file');
  deny=false;rotate=true;assert.deepEqual(await storage.read(),saved);rotate=false;assert.deepEqual(await fs.readdir(dir),['license.bin'],'No temporary copies left behind');
  let reads=0,requests=[],writeFailure=false,writes=0;
  const memory={hasData:async()=>true,read:async()=>{reads++;if(deny)throw Error('Keychain denied');return {...saved}},write:async()=>{writes++;if(writeFailure)throw Error('Keychain denied')},clear:async()=>{}};
  const fetch=async(url,init)=>{requests.push({url,body:JSON.parse(init.body)});return Response.json({token:'new-session',license:{id:'license',label:'Test',expires:null}})};
  const client=createLicense({serverUrl:'https://test.invalid',platform:'darwin',storage:memory,fetch});clients.push(client);
  await Promise.all([client.start(),client.start()]);assert.equal(reads,0,'Mac startup waits for user consent');assert.equal(client.snapshot().phase,'storage-locked');
  await client.activate('key','Mac');assert.equal(requests.length,0,'Unread storage cannot consume a new device slot');
  deny=true;await client.refresh();assert.equal(client.snapshot().phase,'storage-error');assert.equal(client.isActive(),false);
  assert.equal((await client.deactivate()).phase,'storage-error','Unread activation cannot be silently cleared');
  await client.heartbeat();assert.equal(reads,1,'Background heartbeat never opens Keychain');
  deny=false;await client.refresh();assert.equal(client.isActive(),true);assert.equal(requests[0].body.deviceId,'same-device');assert.ok(requests[0].url.endsWith('/api/heartbeat'));
  const fresh=createLicense({serverUrl:'https://test.invalid',platform:'win32',fetch,storage:{read:async()=>null,clear:async()=>{},write:async()=>{writes++;if(writeFailure)throw Error('write denied')}}});clients.push(fresh);await fresh.start();
  writeFailure=true;await fresh.activate('new-key','Windows');assert.equal(fresh.snapshot().phase,'storage-error');assert.equal(requests.length,1,'Do not activate on server before secure persistence');
  writeFailure=false;await fresh.refresh();assert.equal(fresh.snapshot().phase,'locked');
  // A server activation followed by a failed token save must be recoverable
  // without another activation request or a newly generated device identifier.
  let call=0,attempts=[];
  const partial=createLicense({serverUrl:'https://test.invalid',platform:'darwin',fetch:async(url,init)=>{attempts.push({url,body:JSON.parse(init.body)});return fetch(url,init)},storage:{read:async()=>null,clear:async()=>{},write:async()=>{if(++call===2)throw Error('permission lost')}}});clients.push(partial);
  await partial.start();await partial.activate('key','Mac');assert.equal(partial.snapshot().phase,'storage-error');assert.equal(partial.isActive(),false);await partial.heartbeat();assert.equal(attempts.length,1);
  await partial.refresh();assert.equal(partial.isActive(),true);assert.equal(attempts.length,2);assert.ok(attempts[1].url.endsWith('/api/heartbeat'));assert.equal(attempts[0].body.deviceId,attempts[1].body.deviceId);
  console.log('PASS: asynchronous secure storage, no Keychain on missing file/startup, denial retry, no duplicate device slots, atomic writes, rotation and interrupted activation recovery.');
 }finally{for(const c of clients)c.stop();const resolved=path.resolve(dir);assert.equal(path.dirname(resolved),path.resolve(os.tmpdir()));assert.ok(path.basename(resolved).startsWith('tapnova-secure-test-'));await fs.rm(resolved,{recursive:true,force:true})}
};
if(require.main===module)module.exports().catch(e=>{console.error(e);process.exitCode=1});
