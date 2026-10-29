'use strict';
const RELEASES='https://github.com/1Tapekkk/TAPNOVA/releases';
const stable=value=>typeof value==='string'&&/^\d+\.\d+\.\d+$/.test(value);
function newer(next,current) {
  if(!stable(next)||!stable(current))return false;
  const a=next.split('.').map(Number),b=current.split('.').map(Number);
  for(let i=0;i<3;i++){if(a[i]!==b[i])return a[i]>b[i]}
  return false;
}
function createUpdates({engine,currentVersion,automatic,notify=()=>{},confirm=async()=>true}) {
  let state={phase:engine?'idle':'disabled',installed:currentVersion,version:'',progress:0,automatic},busy=false,stopped=false;
  const publish=change=>{state={...state,...change};notify({...state});return {...state}};
  const snapshot=()=>({...state});
  const fail=()=>publish({phase:'error',progress:0});
  engine?.onProgress(percent=>{if(!stopped&&state.phase==='downloading')publish({progress:Math.max(0,Math.min(100,Number(percent)||0))})});
  engine?.onError(()=>{if(!stopped)fail()});
  async function install(){
    if(stopped)return;
    publish({phase:'installing'});
    await engine.install();
    if(!automatic)publish({phase:'opened'});
  }
  return {
    snapshot,
    stop(){stopped=true},
    async check(){
      if(!engine||busy||stopped||['ready','installing','opened'].includes(state.phase))return snapshot();
      busy=true;publish({phase:'checking'});
      try {const result=await engine.check();if(!stopped)publish({phase:result&&newer(result.version,currentVersion)?'available':'current',version:result?.version||'',progress:0})}
      catch {if(!stopped)fail()}finally{busy=false}
      return snapshot();
    },
    async apply(){
      if(!engine||busy||stopped||!['available','ready','opened'].includes(state.phase))return snapshot();
      busy=true;
      try {
        // Restart consent is obtained before download, so no surprise restart in a game.
        if(automatic&&!(await confirm()))return snapshot();
        if(stopped)return snapshot();
        if(state.phase==='available') {
          publish({phase:'downloading',progress:0});await engine.download();
          if(stopped)return snapshot();publish({phase:'ready',progress:100});
        }
        await install();
      }catch{if(!stopped)fail()}finally{busy=false}
      return snapshot();
    }
  };
}
function windowsEngine(updater) {
  updater.autoDownload=false;updater.autoInstallOnAppQuit=false;
  updater.allowDowngrade=false;updater.allowPrerelease=false;
  updater.disableDifferentialDownload=true;
  return {
    onProgress:callback=>updater.on('download-progress',info=>callback(info.percent)),
    onError:callback=>updater.on('error',callback),
    check:async()=>{const result=await updater.checkForUpdates();return result?.updateInfo},
    download:()=>updater.downloadUpdate(),
    install:()=>updater.quitAndInstall(true,true)
  };
}
module.exports={RELEASES,stable,newer,createUpdates,windowsEngine};
