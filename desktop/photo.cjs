'use strict';
// Capture only the game view. This module is called by trusted desktop controls.
const HIDE=`(()=>{const p=window.__xbPanel;if(!p)return;const nodes=[p.getRootNode().host||p,...document.querySelectorAll('[data-xb-restore-fab]')];const saved=nodes.map(e=>[e,e.style.getPropertyValue('visibility'),e.style.getPropertyPriority('visibility')]);window.__tnPhotoRestore=()=>{for(const [e,value,priority] of saved){if(value)e.style.setProperty('visibility',value,priority);else e.style.removeProperty('visibility')}delete window.__tnPhotoRestore};for(const e of nodes)e.style.setProperty('visibility','hidden','important')})()`;
const RESTORE='window.__tnPhotoRestore?.()';
function createPhotographer({wait=ms=>new Promise(resolve=>setTimeout(resolve,ms))}={}){
  let busy=false;
  return async function take({webContents,chooseFile,writeFile,countdown=()=>{},valid=()=>true}){
    if(busy)return {ok:false,busy:true};
    busy=true;let hidden=false;
    const url=webContents.getURL();
    const check=()=>{if(webContents.isDestroyed()||!valid()||webContents.getURL()!==url)throw Error('photo-interrupted')};
    try{
      for(let i=3;i>0;i--){check();countdown(i);await wait(1000)}
      check();hidden=true;await webContents.executeJavaScript(HIDE);
      // Two compositor turns allow the overlay to disappear before capture.
      await webContents.executeJavaScript('new Promise(resolve=>{const timer=setTimeout(resolve,250);requestAnimationFrame(()=>requestAnimationFrame(()=>{clearTimeout(timer);resolve()}))})');
      check();const image=await webContents.capturePage();
      await webContents.executeJavaScript(RESTORE);hidden=false;
      if(image.isEmpty())throw Error('photo-empty');
      const result=await chooseFile();if(result.canceled||!result.filePath)return {ok:false,cancelled:true};
      await writeFile(result.filePath,image.toPNG());return {ok:true};
    }finally{
      if(hidden&&!webContents.isDestroyed())try{await webContents.executeJavaScript(RESTORE)}catch{}
      busy=false;
    }
  };
}
module.exports={createPhotographer};
