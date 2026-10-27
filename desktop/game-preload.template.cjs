// This file is bundled with boot.js by Prepare-Desktop.cjs. No Node APIs or
// arbitrary IPC primitives are exposed to the remote game document.
'use strict';
const { ipcRenderer } = require('electron');
if (location.protocol === 'https:' && (location.hostname === 'moviestarplanet2.com' || location.hostname.endsWith('.moviestarplanet2.com'))) {
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
