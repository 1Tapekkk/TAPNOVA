'use strict';
(async()=>{
 const value=process.env.TAPNOVA_LICENSE_URL||require('../desktop/license-server.json').serverUrl||'';
 const url=new URL(value);
 if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.pathname!=='/'||['localhost','127.0.0.1'].includes(url.hostname))throw Error('Set repository variable TAPNOVA_LICENSE_URL to the public HTTPS origin before releasing.');
 const r=await fetch(new URL('/health',url),{signal:AbortSignal.timeout(15000),redirect:'error'});
 if(!r.ok||(await r.json()).ok!==true)throw Error('License service is unavailable. Release cancelled.');
 console.log('PASS: public license service is reachable.');
})().catch(e=>{console.error(e.message);process.exitCode=1});
