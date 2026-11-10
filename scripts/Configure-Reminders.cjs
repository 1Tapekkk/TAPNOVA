'use strict';
// Provision notifications with the owner's existing Wrangler access; secrets stay off stdout.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
(async()=>{
 const channel=process.argv[2];if(!/^\d{17,20}$/.test(channel||''))throw Error('Podaj ID kanału Discord.');
 const root=path.resolve(__dirname,'..'),dir=path.join(root,'license-server/.data'),config=path.join(root,'license-server/cloudflare/wrangler.local.json'),wrangler=path.join(path.dirname(require.resolve('wrangler/package.json')),'bin/wrangler.js');
 const secrets=JSON.parse(fs.readFileSync(path.join(dir,'cloudflare-secrets.json'),'utf8'));if(![secrets.LICENSE_SECRET,secrets.ADMIN_VERIFIER].every(s=>/^[a-f0-9]{64}$/.test(s)))throw Error('Nieprawidłowa konfiguracja właściciela.');
 const token=crypto.randomBytes(32).toString('hex'),hash=crypto.createHmac('sha256',secrets.LICENSE_SECRET).update(token).digest('hex'),transfer=path.join(dir,'reminders-'+crypto.randomUUID()+'.sql');
 function sql(statement){fs.writeFileSync(transfer,statement,{mode:0o600});try{const r=spawnSync(process.execPath,[wrangler,'d1','execute','DB','--remote','--file',transfer,'--config',config],{windowsHide:true,stdio:'pipe'});if(r.status!==0)throw Error('Operacja sesji właściciela D1 nie powiodła się.')}finally{fs.rmSync(transfer,{force:true})}}
 const origin='https://tapnova-licenses.tapnova-1tapekkk.workers.dev',headers={origin,'x-tapnova-admin':'1',cookie:'tn_admin='+token,'content-type':'application/json'};
 try{sql(`INSERT INTO admin_sessions(token_hash,expires,auth_version) VALUES('${hash}',${Date.now()+180000},'${secrets.ADMIN_VERIFIER}:'||(SELECT version FROM admin_security WHERE id=1));`);
  const r=await fetch(origin+'/api/admin/reminders',{method:'POST',headers,body:JSON.stringify({channel,enabled:true}),signal:AbortSignal.timeout(20000)}),result=await r.json();if(!r.ok)throw Error('Konfiguracja przypomnień: '+r.status+' '+result.error);console.log(JSON.stringify({channel:result.channel,enabled:result.enabled,supported:result.supported}));
  for(const route of ['licenses','history','security']){const response=await fetch(origin+'/api/admin/'+route,{headers,signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error('Kontrola '+route+': '+response.status);const value=await response.json();console.log(route==='licenses'?'Licenses API OK ('+value.licenses.length+' records)':route==='history'?'Paginated history API OK':'2FA available; enabled: '+value.enabled)}
 }finally{sql(`DELETE FROM admin_sessions WHERE token_hash='${hash}';`)}
})().catch(e=>{console.error(e.message);process.exitCode=1});
