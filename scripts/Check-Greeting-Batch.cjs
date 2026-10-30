'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../Resources/Extension/app.js'), 'utf8');
const start = source.indexOf('function tnGreetingProgress(');
const end = source.indexOf('let Rs=null;', start);
assert.ok(start > 0 && end > start);
function fixture(responses = []) {
  const calls = [], waits = [], notices = [], approvals = [];
  const a = {running:false, greetingAllRunning:false, instantMode:true};
  const context = {ce:{profileId:'self',autographer:a},ie:'pl',n:'SummerGreeting',
    Fo:()=>true,Es:type=>type,re:key=>key,Ns:()=>{},As:seconds=>`${seconds}s`,
    cd:(message,kind)=>notices.push({message,kind}),Pc:{agGreetProgress:{}},
    tnConfirmGreeting:(type,count)=>{approvals.push({type,count});return true},
    __xbResolveAutoWait:async()=>120,
    tnGate:{paused:false,run:async(_name,action)=>action(),sleep:async()=>{}},
    Ls:async(type,id)=>{calls.push({type,id});const next=responses.shift();if(next instanceof Error)throw next;return next || {ok:true,wait:0}},
    Date, chrome:{runtime:{sendMessage:()=>{}}}};
  vm.createContext(context);vm.runInContext(source.slice(start,end),context);
  context.tnGreetingBatchWait=async(_state,seconds)=>{waits.push(seconds);return !a.greetingAllAbort};
  return {context,a,calls,waits,notices,approvals,run:(type,rows)=>context._s(type,rows)};
}
(async()=>{
  let f=fixture();
  await f.run('Autograph',[null,'', 'self','alice',{id:'alice'}, {id:'bob',name:'Bob'}]);
  assert.deepEqual(f.calls,[{type:'Autograph',id:'alice'},{type:'Autograph',id:'bob'}]);
  assert.deepEqual(f.waits,[0.25]);assert.equal(f.a.greetingAllProgress,2);
  assert.equal(f.notices.at(-1).kind,'success');assert.match(f.a.greetingAllSummary,/2\/2/);
  f=fixture([{ok:false,reason:'FailedCooldown',wait:12},{ok:true,wait:120},{ok:true,wait:120}]);
  await f.run('Autograph',['alice','bob']);
  assert.deepEqual(f.calls.map(x=>x.id),['alice','alice','bob'],'Cooldown must not skip the current recipient');
  assert.deepEqual(f.waits,[12,120],'Server waits are honored; no delay after final send');
  f=fixture([{ok:false,reason:'FailedCooldown',wait:5},{ok:true,wait:3},{ok:true,wait:0}]);
  await f.run('HalloweenGreeting',['alice','bob']);
  assert.ok(f.calls.every(x=>x.type==='HalloweenGreeting'));
  assert.deepEqual(f.calls.map(x=>x.id),['alice','alice','bob']);
  assert.deepEqual(f.approvals,[{type:'HalloweenGreeting',count:2}]);
  assert.deepEqual(f.waits,[5,3]);assert.equal(f.a.greetingAllProgress,2);
  f=fixture([new Error('ambiguous network outcome')]);
  await f.run('HalloweenGreeting',['alice','bob']);
  assert.equal(f.calls.length,1,'Do not retry or continue an ambiguous paid operation');
  assert.equal(f.notices.at(-1).kind,'error');assert.equal(f.a.greetingAllRunning,false);
  f=fixture([{ok:false,reason:'FailedDefinitionNotFound'}]);
  await f.run('HalloweenGreeting',['alice','bob']);assert.equal(f.calls.length,1);
  assert.match(f.a.greetingAllSummary,/FailedDefinitionNotFound/);assert.equal(f.notices.at(-1).kind,'error');
  f=fixture(Array.from({length:4},()=>({ok:false,reason:'FailedCooldown',wait:2})));
  await f.run('HalloweenGreeting',['alice','bob']);assert.equal(f.calls.length,4);assert.equal(f.waits.length,3);
  assert.ok(f.calls.every(x=>x.id==='alice'));assert.equal(f.notices.at(-1).kind,'error');
  f=fixture();f.context.tnGreetingBatchWait=async()=>{f.a.greetingAllAbort=true;return false};
  await f.run('Autograph',['alice','bob']);assert.equal(f.calls.length,1);assert.equal(f.notices.at(-1).kind,'info');
  assert.equal(f.a.greetingAllRunning,false);assert.equal(f.a.nextInSec,0);
  f=fixture();f.a.running=true;await f.run('Autograph',['alice']);assert.equal(f.calls.length,0);
  f=fixture();f.context.tnConfirmGreeting=()=>false;await f.run('HalloweenGreeting',['alice']);assert.equal(f.calls.length,0);
  f=fixture();let release;f.context.Ls=()=>new Promise(resolve=>{release=resolve});
  const first=f.run('Autograph',['alice']);await f.run('HalloweenGreeting',['bob']);
  assert.equal(f.approvals.length,1,'Mutually exclusive queues');release({ok:true,wait:0});await first;
  f=fixture();vm.runInContext(source.slice(start,end),f.context);
  f.context.tnGate.sleep=async()=>{f.context.tnGate.paused=true};
  assert.equal(await f.context.tnGreetingBatchWait(f.a,120),false,'Stop-all interrupts the wait');
  assert.equal(f.a.nextInSec,0);
  console.log('PASS: whole recipient queue, deduplication, cooldown retry for same recipient, paid consent, no ambiguous purchase retry, cancellation, mutual exclusion and no final cooldown.');
})().catch(error=>{console.error(error);process.exitCode=1});
