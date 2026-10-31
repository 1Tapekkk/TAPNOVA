// This file is bundled with boot.js by Prepare-Desktop.cjs. No Node APIs or
// arbitrary IPC primitives are exposed to the remote game document.
'use strict';
const { ipcRenderer } = require('electron');
if (location.protocol === 'https:' && (location.hostname === 'moviestarplanet2.com' || location.hostname.endsWith('.moviestarplanet2.com'))) {
  let diagnosticsAt=0,diagnosticsCount=0;
  window.addEventListener('message',event=>{
    if(event.source!==window||event.data?.type!=='tapnova:diagnostic')return;
    if(Date.now()-diagnosticsAt>60000){diagnosticsAt=Date.now();diagnosticsCount=0;}
    if(diagnosticsCount++>=20)return;
    const {kind,name,line,column,active,queued}=event.data;
    if(!['game-error','game-rejection','request-error','job-error'].includes(kind))return;
    ipcRenderer.invoke('tapnova:extension',{type:'tapnova:diagnostic',kind,name:typeof name==='string'?name.slice(0,30):'',line,column,active,queued}).catch(()=>{});
  });
  const chrome = { runtime: {
    lastError: undefined,
    sendMessage(message, callback = () => {}) {
      ipcRenderer.invoke('tapnova:extension', message)
        .then(reply => callback(reply), () => callback({ ok:false, error:'Desktop bridge unavailable' }));
    },
    onMessage: { addListener(listener) {
      ipcRenderer.on('tapnova:extension-event', (_event, message) => listener(message, {}, () => {}));
    } }
  } };
  /* BOOT_SOURCE */
}
