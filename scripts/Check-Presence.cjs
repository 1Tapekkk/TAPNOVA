'use strict';
const assert=require('node:assert/strict'),net=require('node:net'),os=require('node:os'),path=require('node:path');
const {createPresence,ipcPaths,frame,activity,CLIENT_ID,IMAGE_URL,readPreference}=require('../desktop/discord-presence.cjs');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(check,label){const end=Date.now()+4000;while(!check()){if(Date.now()>end)throw Error('Timeout: '+label);await pause(10)}}
(async()=>{
  const fs=require('node:fs/promises'),dir=await fs.mkdtemp(path.join(os.tmpdir(),'tn-pref-')),file=path.join(dir,'presence.json');
  try{
    assert.equal(await readPreference(file),true,'Auto-enable on first launch');
    await fs.writeFile(file,JSON.stringify({enabled:false}));assert.equal(await readPreference(file),false,'Respect explicit opt-out');
    await fs.writeFile(file,JSON.stringify({enabled:true}));assert.equal(await readPreference(file),true);
    await fs.writeFile(file,'invalid');assert.equal(await readPreference(file),false,'Invalid preference fails closed');
  }finally{await fs.rm(file,{force:true});await fs.rmdir(dir)}
  assert.equal(activity('game',123).assets.large_image,IMAGE_URL);
  assert.match(IMAGE_URL,/^https:\/\/cdn\.discordapp\.com\/app-icons\/.+\.png\?size=512$/);
  assert.equal(ipcPaths('win32',{}).length,10);
  assert.equal(ipcPaths('win32',{})[0],'\\\\?\\pipe\\discord-ipc-0');
  assert.deepEqual(ipcPaths('darwin',{TMPDIR:'/private/tmp/test',TMP:'/tmp',TEMP:'relative'}).filter(p=>p.endsWith('-0')),['/private/tmp/test/discord-ipc-0','/tmp/discord-ipc-0']);
  assert.equal(activity('unknown',123).state,'Przegląd aplikacji');
  assert.deepEqual(activity('game',123).timestamps,{start:123});
  let calls=0;const isolated=createPresence({disabled:true,connect:()=>{calls++;throw Error('Forbidden')}});
  assert.equal(isolated.start(true).phase,'unavailable');isolated.stop();assert.equal(calls,0);
  const address=process.platform==='win32'?`\\\\?\\pipe\\tapnova-test-${process.pid}`:path.join(os.tmpdir(),`tn-rpc-${process.pid}.sock`);
  const sockets=new Set(),received=[],states=[];let strategy='normal',connections=0;
  const server=net.createServer(socket=>{
    connections++;sockets.add(socket);socket.on('close',()=>sockets.delete(socket));socket.on('error',()=>{});
    let buffer=Buffer.alloc(0);
    socket.on('data',chunk=>{
      buffer=Buffer.concat([buffer,chunk]);
      while(buffer.length>=8){
        const op=buffer.readUInt32LE(0),size=buffer.readUInt32LE(4);if(buffer.length<8+size)return;
        const bytes=buffer.subarray(8,8+size);buffer=buffer.subarray(8+size);
        const value=JSON.parse(bytes.toString());received.push({op,value,time:Date.now()});
        if(op===0){
          assert.deepEqual(value,{v:1,client_id:CLIENT_ID});
          const ready=frame(1,{cmd:'DISPATCH',evt:'READY',data:{}});
          // Split a header across writes, then coalesce its tail with a ping.
          socket.write(ready.subarray(0,3));setTimeout(()=>{if(!socket.destroyed)socket.write(Buffer.concat([ready.subarray(3),frame(3,{ping:1})]))},5);
        }else if(op===1&&value.args.activity){
          if(strategy==='normal')socket.write(frame(1,{cmd:'SET_ACTIVITY',nonce:value.nonce,data:{}}));
          else if(strategy==='error')socket.write(frame(1,{cmd:'SET_ACTIVITY',evt:'ERROR',nonce:value.nonce,data:{code:4000}}));
          else if(strategy==='null')socket.write(frame(1,null));
          else if(strategy==='oversize'){const header=Buffer.alloc(8);header.writeUInt32LE(1,0);header.writeUInt32LE(1024*1024+1,4);socket.write(header)}
          // 'silent' deliberately never acknowledges the activity.
        }
      }
    });
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(address,resolve)});
  const presence=createPresence({paths:[address+'-missing',address],notify:s=>states.push(s),retryMs:60,timeoutMs:200,intervalMs:70});
  const activities=()=>received.filter(r=>r.op===1&&r.value.args.activity);
  try{
    assert.deepEqual(presence.snapshot(),{enabled:false,phase:'off',mode:'home'});await pause(30);assert.equal(connections,0);
    presence.start(true);await until(()=>presence.snapshot().phase==='connected','activity acknowledgment');
    await until(()=>received.some(r=>r.op===4&&r.value.ping===1),'pong');
    assert.equal(activities()[0].value.args.pid,process.pid);
    assert.equal(activities()[0].value.args.activity.state,'Przegląd aplikacji');
    presence.setMode('game');presence.setMode('home');presence.setMode('game');
    await until(()=>activities().length===2,'coalesced game status');await pause(100);
    assert.equal(activities().length,2);assert.ok(activities()[1].time-activities()[0].time>=60);
    assert.equal(activities()[1].value.args.activity.state,'MovieStarPlanet 2');
    assert.equal(activities()[1].value.args.activity.timestamps.start,activities()[0].value.args.activity.timestamps.start);
    for(const socket of sockets)socket.destroy();
    await until(()=>connections>=2&&presence.snapshot().phase==='connected','reconnect');
    assert.equal(activities().at(-1).value.args.activity.state,'MovieStarPlanet 2');
    presence.start(false);await until(()=>received.some(r=>r.op===1&&r.value.args.activity===null),'clear on disable');
    const stopped=connections;await pause(160);assert.equal(connections,stopped);assert.equal(presence.snapshot().phase,'off');
    for(const bad of ['error','null','oversize','silent']){
      strategy=bad;const before=connections,offset=states.length;presence.start(true);
      await until(()=>connections>=before+2,'retry after '+bad);
      assert.ok(!states.slice(offset).some(s=>s.phase==='connected'),'Do not claim success for '+bad);
      if(bad==='error')assert.ok(states.slice(offset).some(s=>s.phase==='error'));
      presence.stop();await pause(30);
    }
    strategy='normal';presence.start(true);await until(()=>presence.snapshot().phase==='connected','final connection');
    const cleared=received.filter(r=>r.op===1&&r.value.args.activity===null).length;
    presence.stop();await until(()=>received.filter(r=>r.op===1&&r.value.args.activity===null).length>cleared,'clear on exit');
    const ended=connections;await pause(160);assert.equal(connections,ended);
    console.log('Discord Presence: native IPC, handshake, framing, ping, coalescing, reconnect, errors, timeout, privacy and shutdown OK');
  }finally{presence.stop();for(const socket of sockets)socket.destroy();await new Promise(resolve=>server.close(resolve))}
})().catch(error=>{console.error(error);process.exitCode=1});
