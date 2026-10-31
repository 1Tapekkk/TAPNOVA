'use strict';
const crypto=require('node:crypto');
function createLicense({serverUrl,fetch,storage,platform,notify=()=>{},now=()=>Date.now(),test=false}) {
  let saved=null,active=false,expires=0,busy=false,timer,stopped=false,storageReady=false,needsWrite=false,startPromise;
  let state={phase:test?'active':serverUrl?'storage-loading':'unconfigured',label:'',expires:null};
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
    if(stopped||test||busy||!storageReady||needsWrite||!saved?.token)return snapshot();busy=true;
    try {const result=await request('/api/heartbeat',{deviceId:saved.deviceId},saved.token);if(!stopped)accept(result)}
    catch(error){active=false;publish({phase:error.message==='revoked'?'revoked':error.message==='expired'?'expired':error.message==='activation-required'?'locked':'offline'})}
    finally{busy=false}
    return snapshot();
  }
  async function restore(){
    if(stopped||test||busy||!serverUrl)return snapshot();busy=true;active=false;publish({phase:'storage-loading'});
    try {
      if(needsWrite){await storage.write(saved);needsWrite=false}
      else {try{saved=await storage.read()}catch(e){if(e.code==='ENOENT')saved=null;else throw e}}
      storageReady=true;publish({phase:'locked'});
    }catch{storageReady=false;publish({phase:'storage-error'})}
    finally{busy=false}
    if(storageReady&&saved?.token)await heartbeat();
    return snapshot();
  }
  return {
    snapshot,isActive:()=>snapshot().active,
    start(){
      if(startPromise)return startPromise;
      startPromise=(async()=>{
        if(test||!serverUrl||stopped)return snapshot();
        try {
          // Check only the file's existence before showing the macOS explanation.
          // Keychain access happens after the user explicitly requests a restore.
          if(platform==='darwin'&&storage.hasData&&await storage.hasData())publish({phase:'storage-locked'});
          else await restore();
        }catch{publish({phase:'storage-error'})}
        if(!stopped){timer=setInterval(()=>{if(active&&now()>=expires){active=false;publish({phase:'offline'})}void heartbeat()},15000);timer.unref?.()}
        return snapshot();
      })();return startPromise;
    },
    async activate(key,deviceLabel){
      if(test||busy||!serverUrl||stopped||!storageReady||needsWrite)return snapshot();busy=true;active=false;publish({phase:'checking'});
      try {
        if(typeof key!=='string'||key.length>100||typeof deviceLabel!=='string'||!deviceLabel.trim()||deviceLabel.length>80)throw Error('invalid-input');
        const deviceId=saved?.deviceId||crypto.randomUUID();
        saved={deviceId,token:saved?.token||''};needsWrite=true;await storage.write(saved);needsWrite=false;
        const result=await request('/api/activate',{key:key.trim(),deviceId,label:deviceLabel.trim(),platform});
        saved={deviceId,token:result.token};needsWrite=true;await storage.write(saved);needsWrite=false;if(!stopped)accept(result);
      }catch(error){active=false;publish({phase:needsWrite?'storage-error':['device-limit','invalid-key','revoked','expired'].includes(error.message)?error.message:'error'})}
      finally{busy=false}
      return snapshot();
    },
    heartbeat,
    refresh:()=>!storageReady||needsWrite?restore():heartbeat(),
    async deactivate(){if(busy||!storageReady||needsWrite)return snapshot();busy=true;active=false;try{if(saved?.token)await request('/api/deactivate',{deviceId:saved.deviceId},saved.token);await storage.clear();saved=null;publish({phase:'locked',label:'',expires:null})}catch{publish({phase:'error'})}finally{busy=false}return snapshot()},
    stop(){stopped=true;clearInterval(timer)}
  };
}
function encryptedStorage({safeStorage,file}) {
  const fs=require('node:fs/promises'),path=require('node:path');
  const available=async()=>{if(!await safeStorage.isAsyncEncryptionAvailable())throw Error('storage')};
  return {
    async hasData(){try{return (await fs.stat(file)).isFile()}catch(e){if(e.code==='ENOENT')return false;throw e}},
    async read(){const encrypted=await fs.readFile(file);await available();const decoded=await safeStorage.decryptStringAsync(encrypted);const value=JSON.parse(decoded.result);if(typeof value.token!=='string'||typeof value.deviceId!=='string'||!value.deviceId)throw Error('storage');if(decoded.shouldReEncrypt)await this.write(value);return value},
    async write(value){
      await available();const encrypted=await safeStorage.encryptStringAsync(JSON.stringify(value));
      await fs.mkdir(path.dirname(file),{recursive:true});const temporary=file+'.'+crypto.randomUUID()+'.tmp';
      try{await fs.writeFile(temporary,encrypted,{mode:0o600,flag:'wx'});await fs.rename(temporary,file)}finally{await fs.rm(temporary,{force:true})}
    },
    async clear(){await fs.rm(file,{force:true})}
  };
}
module.exports={createLicense,encryptedStorage};
