const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const scope = { window:{}, DOMException, AbortController, setTimeout, clearTimeout };
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../Resources/Extension/control-core.js'),'utf8'),scope);
const core=scope.window.__tapnovaControl;
const storage={ data:new Map(), getItem(key){return this.data.get(key)||null}, setItem(key,value){this.data.set(key,value)} };
const store=core.createStore(storage);
const json = presets => JSON.stringify({format:'tapnova-settings',version:1,presets});
const before = () => storage.getItem('_tn_presets_v1');

(async()=>{
  store.save('Wieczór',{th:'nova',uis:'0',dsb:'100',sc:'slow'});
  assert.equal(store.read().length,1);
  assert.throws(()=>store.save('WIECZÓR',{th:'nova'}),/duplicate/);
  const valid=before();
  for(const settings of [{tbk:'secret'},{lg:'tr'},{th:'invalid'},{dsb:'-1'},{dsw:'Infinity'},{dsw:'1.1'},{pop:{}},JSON.parse('{"__proto__":{"evil":true}}'),{}]){
    assert.throws(()=>store.import(json([{name:'Bad',settings}])));
    assert.equal(before(),valid);
  }
  for(const raw of ['not json',JSON.stringify({format:'tapnova-settings',version:2,presets:[]}),json([]),'x'.repeat(65537)])assert.throws(()=>store.previewImport(raw));
  assert.equal(store.previewImport(json([{name:'Nowy',settings:{th:'blue'}}])).length,1);
  assert.equal(before(),valid,'Import preview never writes');
  store.import(json([{name:'Nowy',settings:{th:'blue'}}]));
  store.rename('Nowy','Niebieski');assert.equal(store.read()[1].name,'Niebieski');
  store.remove('Niebieski');assert.equal(store.read().length,1);
  storage.setItem=()=>{throw Error('quota')};
  assert.throws(()=>store.save('Nie zapisze się',{th:'blue'}),/quota/);
  assert.equal(before(),valid,'Quota failure preserves saved sets');

  let calls=0,aborts=0;
  const gate=core.createGate((url,{signal})=>new Promise((resolve,reject)=>{
    calls++;if(signal.aborted)return reject(new DOMException('aborted','AbortError'));
    signal.addEventListener('abort',()=>{aborts++;reject(new DOMException('aborted','AbortError'))},{once:true});
  }));
  const epoch=gate.epoch,request=gate.request('/pending').catch(error=>error.name);
  let released=false;
  const waiting=gate.sleep(60000).then(()=>released=true);
  let release;
  const job=gate.run('drain',()=>new Promise(resolve=>release=resolve));
  gate.stop();
  assert.equal(gate.resume(),false,'Cannot unlock while old tasks drain');
  assert.equal(await request,'AbortError');await waiting;
  assert.equal(aborts,1);assert.equal(released,true);
  await assert.rejects(gate.request('/blocked'),{name:'AbortError'});assert.equal(calls,1);
  release();await job;assert.equal(gate.pending,0);assert.equal(gate.resume(),true);
  assert.equal(gate.valid(epoch),false,'Stale scheduled work remains invalid after unlock');
  assert.equal(gate.valid(gate.epoch),true);
  const alreadyAborted=new AbortController();alreadyAborted.abort();
  await assert.rejects(gate.request('/external-cancel',{signal:alreadyAborted.signal}),{name:'AbortError'});
  assert.equal(gate.pending,0);
  const paused=core.createGate(()=>{throw Error('must not run')},true);
  await assert.rejects(paused.run('saved pause',()=>{}),{name:'AbortError'});
  const bodyGate=core.createGate(async(url,{signal})=>new Response(new ReadableStream({start(controller){signal.addEventListener('abort',()=>controller.error(new DOMException('aborted','AbortError')),{once:true})}})));
  const response=await bodyGate.request('/streaming');
  const body=response.text();
  assert.equal(bodyGate.pending,1,'Response body remains cancellable after headers');
  bodyGate.stop();await assert.rejects(body,{name:'AbortError'});
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(bodyGate.pending,0);
  console.log('PASS: validated presets, duplicates, import preview, rejected hostile/invalid data, storage failures, request cancellation, draining, stale epochs, existing abort signals, persisted pause.');
})().catch(error=>{console.error(error);process.exitCode=1});
