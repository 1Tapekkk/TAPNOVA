'use strict';
const crypto=require('node:crypto');
function createLicense({serverUrl,fetch,storage,platform,notify=()=>{},now=()=>Date.now(),test=false}) {
  let saved=null,active=false,expires=0,busy=false,timer,stopped=false;
  let state={phase:test?'active':serverUrl?'locked':'unconfigured',label:'',expires:null};
  if(test)active=true;
  const publish=s=>{state={...state,...s};notify(snapshot());return snapshot()};
  const snapshot=()=>({...state,active:active&&(test||now()<expires)});
  const request=async(route,data,token)=>{
    const response=await fetch(serverUrl+route,{method:'POST',headers:{'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{})},credentials:'omit',signal:AbortSignal.timeout(8000),body:JSON.stringify(data)});
    const result=await response.json();if(!response.ok)throw Error(result.error||'connection');
    if(route!=='/api/deactivate'&&(!result.license?.id||result.license.revoked||result.license.expired))throw Error('invalid-response');
    return result;
  };
  const accept=result=>{active=true;expires=now()+24000;publish({phase:'active',label:result.license.label,expires:result.license.expires})};
  async function heartbeat(){
    if(stopped||test||busy||!saved?.token)return snapshot();busy=true;
    try {const result=await request('/api/heartbeat',{deviceId:saved.deviceId},saved.token);if(!stopped)accept(result)}
    catch(error){active=false;publish({phase:error.message==='revoked'?'revoked':error.message==='expired'?'expired':error.message==='activation-required'?'locked':'offline'})}
    finally{busy=false}
    return snapshot();
  }
  return {
    snapshot,isActive:()=>snapshot().active,
    async start(){
      if(test||!serverUrl)return snapshot();
      try{saved=await storage.read()}catch{saved=null}
      if(saved?.token)await heartbeat();
      timer=setInterval(()=>{if(active&&now()>=expires){active=false;publish({phase:'offline'})}void heartbeat()},15000);timer.unref?.();return snapshot();
    },
    async activate(key,deviceLabel){
      if(test||busy||!serverUrl||stopped)return snapshot();busy=true;active=false;publish({phase:'checking'});
      try {
        if(typeof key!=='string'||key.length>100||typeof deviceLabel!=='string'||!deviceLabel.trim()||deviceLabel.length>80)throw Error('invalid-input');
        const deviceId=saved?.deviceId||crypto.randomUUID();
        saved={deviceId,token:saved?.token||''};await storage.write(saved);
        const result=await request('/api/activate',{key:key.trim(),deviceId,label:deviceLabel.trim(),platform});
        saved={deviceId,token:result.token};await storage.write(saved);if(!stopped)accept(result);
      }catch(error){active=false;publish({phase:['device-limit','invalid-key','revoked','expired'].includes(error.message)?error.message:'error'})}
      finally{busy=false}
      return snapshot();
    },
    heartbeat,
    async deactivate(){if(busy)return snapshot();busy=true;active=false;try{if(saved?.token)await request('/api/deactivate',{deviceId:saved.deviceId},saved.token);await storage.clear();saved=null;publish({phase:'locked',label:'',expires:null})}catch{publish({phase:'error'})}finally{busy=false}return snapshot()},
    stop(){stopped=true;clearInterval(timer)}
  };
}
function encryptedStorage({safeStorage,file}) {
  const fs=require('node:fs/promises');
  return {
    async read(){if(!safeStorage.isEncryptionAvailable())throw Error('storage');const value=JSON.parse(safeStorage.decryptString(await fs.readFile(file)));if(typeof value.token!=='string'||typeof value.deviceId!=='string')throw Error('storage');return value},
    async write(value){if(!safeStorage.isEncryptionAvailable())throw Error('storage');await fs.writeFile(file,safeStorage.encryptString(JSON.stringify(value)),{mode:0o600})},
    async clear(){await fs.rm(file,{force:true})}
  };
}
module.exports={createLicense,encryptedStorage};
