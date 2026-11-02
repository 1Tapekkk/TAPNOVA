'use strict';
const net=require('node:net'),path=require('node:path'),{randomUUID}=require('node:crypto');
const CLIENT_ID='1565799484066103397';
const MAX_FRAME=1024*1024;
const IMAGE_URL=`https://cdn.discordapp.com/app-icons/${CLIENT_ID}/805159c007f5e7ac9533d2a2aec65778.png?size=512`;
async function readPreference(file){
  try{return JSON.parse(await require('node:fs/promises').readFile(file,'utf8')).enabled===true}
  catch(error){return error.code==='ENOENT'}
}
function ipcPaths(platform=process.platform,env=process.env){
  if(platform==='win32')return Array.from({length:10},(_,n)=>`\\\\?\\pipe\\discord-ipc-${n}`);
  const roots=[...new Set([env.XDG_RUNTIME_DIR,env.TMPDIR,env.TMP,env.TEMP,'/tmp'].filter(p=>p&&path.posix.isAbsolute(p)))];
  return roots.flatMap(root=>Array.from({length:10},(_,n)=>path.posix.join(root,`discord-ipc-${n}`)));
}
function frame(op,value){
  const body=Buffer.isBuffer(value)?value:Buffer.from(JSON.stringify(value));
  const header=Buffer.alloc(8);header.writeUInt32LE(op,0);header.writeUInt32LE(body.length,4);
  return Buffer.concat([header,body]);
}
function activity(mode,started){
  return {type:0,details:'TAPNOVA • Twoja przestrzeń',state:mode==='game'?'MovieStarPlanet 2':'Przegląd aplikacji',
    timestamps:{start:started},assets:{large_image:IMAGE_URL,large_text:'TAPNOVA — Twoja przestrzeń'},
    buttons:[{label:'Pobierz TAPNOVA',url:'https://github.com/1Tapekkk/TAPNOVA/releases/latest'}]};
}
function createPresence({notify=()=>{},paths=ipcPaths(),disabled=false,connect=p=>net.createConnection(p),retryMs=30000,timeoutMs=5000,intervalMs=15000}={}){
  let enabled=false,running=false,phase='off',mode='home',started=0,socket=null,ready=false;
  let retry,timeout,update,buffer=Buffer.alloc(0),index=0,lastSent=0,sentMode=null,pending=null;
  const snapshot=()=>({enabled,phase,mode});
  function publish(next){phase=next;notify(snapshot())}
  function clean(){clearTimeout(timeout);clearTimeout(update);timeout=update=null;ready=false;pending=null;buffer=Buffer.alloc(0);const old=socket;socket=null;old?.destroy()}
  function active(){return running&&enabled&&!disabled}
  function later(){if(!active())return;clearTimeout(retry);retry=setTimeout(()=>{index=0;attempt()},retryMs);retry.unref?.()}
  function lost(){clean();if(active()){publish('waiting');later()}}
  function send(){
    if(!active()||!ready||pending||!socket||sentMode===mode)return;
    const delay=Math.max(0,lastSent+intervalMs-Date.now());
    if(delay){if(!update){update=setTimeout(()=>{update=null;send()},delay);update.unref?.()}return}
    pending={nonce:randomUUID(),mode};lastSent=Date.now();
    socket.write(frame(1,{cmd:'SET_ACTIVITY',args:{pid:process.pid,activity:activity(mode,started)},nonce:pending.nonce}));
    clearTimeout(timeout);timeout=setTimeout(lost,timeoutMs);timeout.unref?.();
  }
  function receive(chunk){
    if(buffer.length+chunk.length>MAX_FRAME+8)return lost();
    buffer=Buffer.concat([buffer,chunk]);
    while(buffer.length>=8){
      const op=buffer.readUInt32LE(0),size=buffer.readUInt32LE(4);
      if(size>MAX_FRAME)return lost();
      if(buffer.length<8+size)return;
      const bytes=buffer.subarray(8,8+size);buffer=buffer.subarray(8+size);
      if(op===3){socket?.write(frame(4,bytes));continue}
      if(op===4)continue;
      if(op!==1)return lost();
      let message;try{message=JSON.parse(bytes.toString('utf8'))}catch{return lost()}
      if(!message||typeof message!=='object')return lost();
      if(!ready&&message.evt==='READY'){
        ready=true;clearTimeout(timeout);sentMode=null;lastSent=0;send();
      }else if(pending&&message.nonce===pending.nonce){
        if(message.evt==='ERROR'){publish('error');clean();later();return}
        if(message.cmd==='SET_ACTIVITY'){clearTimeout(timeout);sentMode=pending.mode;pending=null;publish('connected');send()}
      }
    }
  }
  function attempt(){
    if(!active())return;
    if(index>=paths.length){publish('waiting');later();return}
    let candidate;
    try{candidate=connect(paths[index++]);socket=candidate}catch{return attempt()}
    const failed=()=>{if(socket!==candidate)return;const wasReady=ready;clean();if(active()){if(wasReady){publish('waiting');later()}else attempt()}};
    candidate.on('error',failed);candidate.on('close',failed);
    candidate.on('data',chunk=>{if(socket===candidate)receive(chunk)});
    timeout=setTimeout(failed,timeoutMs);timeout.unref?.();candidate.unref?.();
    candidate.once('connect',()=>{
      if(socket!==candidate||!active())return;
      candidate.write(frame(0,{v:1,client_id:CLIENT_ID}));
    });
  }
  function disconnect(){
    clearTimeout(retry);clearTimeout(timeout);clearTimeout(update);retry=timeout=update=null;
    const old=socket,wasReady=ready;socket=null;ready=false;pending=null;buffer=Buffer.alloc(0);
    if(old){
      if(wasReady){old.end(frame(1,{cmd:'SET_ACTIVITY',args:{pid:process.pid,activity:null},nonce:randomUUID()}));const timer=setTimeout(()=>old.destroy(),500);timer.unref?.()}
      else old.destroy();
    }
  }
  return {
    snapshot,
    start(value){disconnect();enabled=value===true;running=true;started=Math.floor(Date.now()/1000);index=0;publish(enabled?(disabled?'unavailable':'waiting'):'off');if(active())attempt();return snapshot()},
    setMode(value){mode=value==='game'?'game':'home';send()},
    stop(){running=false;disconnect();publish(enabled?'waiting':'off')}
  };
}
module.exports={createPresence,ipcPaths,frame,activity,CLIENT_ID,IMAGE_URL,readPreference};
