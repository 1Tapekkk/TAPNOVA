'use strict';
// HTTPS interception belongs to the local account panel only. Unity must use
// Chromium's native network stack (cookies, streaming, redirects and cache).
function createWorkspaceNetwork({session,url,readHTML}) {
  let installed=false;
  return {
    async enable(){
      if(installed)return;
      await session.protocol.handle('https',async request=>{
        if(request.url===url)return new Response(await readHTML(),{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store'}});
        return session.fetch(request,{bypassCustomProtocolHandlers:true});
      });
      installed=true;
    },
    async disable(){if(installed){await session.protocol.unhandle('https');installed=false}},
    get installed(){return installed}
  };
}
module.exports={createWorkspaceNetwork};
