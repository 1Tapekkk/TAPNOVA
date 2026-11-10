'use strict';
const assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),path=require('node:path');
const runtime=require('node:module').createRequire(require.resolve('wrangler')),{Miniflare,convertV4MiniflareOptions}=runtime('miniflare'),{buildSync}=runtime('esbuild');
(async()=>{
 const proof=crypto.randomBytes(32).toString('hex'),secret=crypto.randomBytes(32).toString('hex');
 const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:buildSync({entryPoints:['license-server/cloudflare/worker.mjs'],bundle:true,write:false,format:'esm',platform:'browser'}).outputFiles[0].text,compatibilityDate:'2026-10-23',bindings:{LICENSE_SECRET:secret,ADMIN_SALT:'a'.repeat(64),ADMIN_VERIFIER:crypto.createHash('sha256').update(proof).digest('hex')},d1Databases:{DB:'test-admin'},ratelimits:{LOGIN_LIMIT:{namespace_id:'431001',simple:{limit:100,period:60}},ACTIVATION_LIMIT:{namespace_id:'431002',simple:{limit:100,period:60}},CLIENT_LIMIT:{namespace_id:'431003',simple:{limit:100,period:60}}}}));
 try{
  const db=await mf.getD1Database('DB'),dir='license-server/cloudflare/migrations';await db.exec(fs.readdirSync(dir).sort().filter(f=>f.endsWith('.sql')).map(f=>fs.readFileSync(path.join(dir,f),'utf8')).join('\n').replace(/^--.*$/gm,'').replace(/\s+/g,' '));const origin=(await mf.ready).origin;let cookie='';
  const post=async(route,data,session=cookie)=>{const r=await fetch(origin+'/api/admin/'+route,{method:'POST',headers:{origin,'content-type':'application/json','x-tapnova-admin':'1',cookie:session},body:JSON.stringify(data)});return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]}};
  let r=await post('login',{proof});assert.equal(r.status,200);cookie=r.cookie;const oldCookie=cookie;
  const data={requestId:crypto.randomUUID(),label:'D1 batch',count:20,durationDays:30,maxDevices:2};const batch=await post('batch',data);assert.equal(batch.status,201);assert.equal(batch.data.items.length,20);assert.deepEqual((await post('batch',data)).data,batch.data);assert.equal((await db.prepare('SELECT count(*) n FROM licenses').first()).n,20);
  const id=batch.data.items[0].id;assert.equal((await post('licenses/'+id,{action:'edit',label:'New recipient',notes:'private note'})).status,200);const active=await fetch(origin+'/api/activate',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({key:batch.data.items[0].key,deviceId:'test-device',label:'Windows',platform:'win32'})});assert.equal(active.status,200);assert.ok(!JSON.stringify(await active.json()).includes('private note'));
  const history=await fetch(origin+'/api/admin/history?q=New%20recipient',{headers:{cookie}});assert.ok((await history.json()).events.length>=2);
  const begin=await post('security/begin',{proof});assert.equal(begin.status,200);assert.match(begin.data.secret,/^[A-Z2-7]{32}$/);
  const {totp}=await import('../license-server/admin-security.mjs'),otp=await totp(begin.data.secret,Math.floor(Date.now()/30000));assert.equal((await post('security/enable',{proof,otp:'invalid'})).status,400);
  r=await post('security/enable',{proof,otp});assert.equal(r.status,200);const recovery=r.data.recovery;assert.equal(recovery.length,8);
  // The enrolling browser keeps its session; other sessions become invalid.
  const security=await fetch(origin+'/api/admin/security',{headers:{cookie}});assert.equal((await security.json()).enabled,true);
  assert.equal((await post('login',{proof})).status,403);assert.equal((await post('login',{proof,otp})).status,403);
  r=await post('login',{proof,otp:recovery[0]});assert.equal(r.status,200);cookie=r.cookie;assert.equal((await post('login',{proof,otp:recovery[0]})).status,403);
  assert.equal((await post('security/disable',{proof,otp:recovery[1]})).status,200);assert.equal((await fetch(origin+'/api/admin/security',{headers:{cookie:oldCookie}})).status,401);
  assert.equal((await post('login',{proof})).status,200);
  console.log('PASS: D1 batch of 20, idempotence, notes privacy, searchable history, 2FA setup, replay protection, recovery and session invalidation.');
 }finally{await mf.dispose()}
 const {createFixture}=require('./License-Admin-Fixture.cjs'),fixture=await createFixture(),{sqliteAdapter}=await import('../license-server/admin-service.mjs'),{configureReminders,syncReminders}=await import('../license-server/cloudflare/reminders.mjs');const realFetch=global.fetch,sent=[];
 try{const env={DB:sqliteAdapter(fixture.store.db),DISCORD_BOT_TOKEN:'fixture',DISCORD_GUILD_ID:'111111111111111111'};global.fetch=async(url,opts)=>{if(opts.method==='GET')return Response.json({guild_id:env.DISCORD_GUILD_ID,type:0});sent.push(JSON.parse(opts.body));return Response.json({id:'123456789012345678'})};
  await assert.rejects(()=>configureReminders(env,{channel:'bad',enabled:true}),/invalid-input/);await configureReminders(env,{channel:'222222222222222222',enabled:true});await syncReminders(env);assert.equal(sent.length,1);assert.deepEqual(sent[0].allowed_mentions,{parse:[]});assert.doesNotMatch(sent[0].content,/TN-|Łukasz|Julia/);await syncReminders(env);assert.equal(sent.length,1,'Do not resend same expiry stage');const row=fixture.store.list().find(l=>l.expires&&!l.revoked);fixture.store.db.prepare('UPDATE licenses SET expires=? WHERE id=?').run(Date.now()+3600000,row.id);await syncReminders(env);assert.equal(sent.length,2,'New expiry has its own alert');await configureReminders(env,{channel:'222222222222222222',enabled:false});await syncReminders(env);assert.equal(sent.length,2);console.log('PASS: Discord channel validation, stage deduplication, changed expiry, opt-out and no recipient/key leakage.');
 }finally{global.fetch=realFetch;await fixture.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
