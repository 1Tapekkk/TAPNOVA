'use strict';
// Uses the existing owner's Cloudflare access. The bot token stays in Worker secrets.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'license-server/.data');
const config=path.join(root,'license-server/cloudflare/wrangler.local.json');
const wrangler=path.join(path.dirname(require.resolve('wrangler/package.json')),'bin/wrangler.js');
async function main(){
 const secrets=JSON.parse(fs.readFileSync(path.join(dir,'cloudflare-secrets.json'),'utf8'));
 if(![secrets.LICENSE_SECRET,secrets.ADMIN_VERIFIER].every(s=>/^[a-f0-9]{64}$/.test(s)))throw Error('Invalid owner configuration');
 const token=crypto.randomBytes(32).toString('hex'),hash=crypto.createHmac('sha256',secrets.LICENSE_SECRET).update(token).digest('hex');
 const transfer=path.join(dir,'discord-register-'+crypto.randomUUID()+'.sql');
 function sql(text){
  fs.writeFileSync(transfer,text,{mode:0o600});
  try{const r=spawnSync(process.execPath,[wrangler,'d1','execute','DB','--remote','--file',transfer,'--config',config],{windowsHide:true,stdio:'pipe'});if(r.status!==0)throw Error('Cloudflare owner session operation failed. Check Wrangler login.')}finally{fs.rmSync(transfer,{force:true})}
 }
 try{
  sql(`INSERT INTO admin_sessions(token_hash,expires,auth_version) VALUES('${hash}',${Date.now()+180000},'${secrets.ADMIN_VERIFIER}');`);
  const origin='https://tapnova-licenses.tapnova-1tapekkk.workers.dev';
  const r=await fetch(origin+'/api/admin/discord/commands',{method:'POST',headers:{origin,'x-tapnova-admin':'1',cookie:'tn_admin='+token,'content-type':'application/json'},body:'{}',redirect:'error',signal:AbortSignal.timeout(90000)});
  const data=await r.json();if(!r.ok)throw Error('Command registration failed: '+r.status+' '+data.error);
  console.log('Registered Discord commands: '+data.commands.join(', '));
 }finally{sql(`DELETE FROM admin_sessions WHERE token_hash='${hash}';`)}
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
