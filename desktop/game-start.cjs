'use strict';
// Nebula registers visibilitychange before its asynchronous translations finish.
// Attach the view while it is still blank, so loading never starts hidden.
async function loadVisibleGame({webContents,url,show}) {
  show(true);
  try { await webContents.loadURL(url); }
  catch(error) { show(false); throw error; }
}
module.exports={loadVisibleGame};
