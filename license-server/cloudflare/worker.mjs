import {createStore,fail} from './store.mjs';
import {random,sha,hasher,equal} from './crypto.mjs';
import {discordFetch,syncDiscord,registerDiscordCommands} from './discord.mjs';
import {inspectDiscordChannel,inspectDiscordDraft} from './discord-composer.mjs';
import {welcomeStatus,configureWelcome,previewWelcome,syncWelcomes} from './discord-welcome.mjs';
const security={
  'cache-control':'no-store', 'x-content-type-options':'nosniff', 'referrer-policy':'no-referrer',
  'content-security-policy':"default-src 'self'; script-src 'self'; style-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
  'strict-transport-security':'max-age=31536000'
};
const json=(data,status=200,headers={})=>Response.json(data,{status,headers:{...security,...headers}});
async function body(request){
  if(!request.headers.get('content-type')?.startsWith('application/json'))fail('json-required',415);
  const reader=request.body?.getReader();if(!reader)fail('invalid-request');let size=0;const parts=[];
  try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>16384){await reader.cancel();fail('body-too-large',413)}parts.push(value)}}finally{reader.releaseLock()}
  const bytes=new Uint8Array(size);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length}
  let data;try{data=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes))}catch{fail('invalid-request')}
  if(!data||typeof data!=='object'||Array.isArray(data))fail('invalid-request');return data;
}
const cookie=(token,secure)=>`tn_admin=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${token?43200:0}${secure?'; Secure':''}`;
async function rate(binding,key){if(!binding)fail('not-configured',503);if(!(await binding.limit({key})).success)fail('rate-limit',429)}
export default {
  async fetch(request,env,ctx){
    try {
      const url=new URL(request.url),path=url.pathname,post=request.method==='POST';
      if(request.method==='GET'&&['/','/admin.js','/admin.css','/discord/welcome-background.png'].includes(path)){
        const asset=await env.ASSETS.fetch(request);const response=new Response(asset.body,asset);for(const[k,v]of Object.entries(security))response.headers.set(k,v);return response;
      }
      if(!/^[a-f0-9]{64}$/.test(env.LICENSE_SECRET||'')||!/^[a-f0-9]{64}$/.test(env.ADMIN_VERIFIER||'')||!/^[a-f0-9]{64}$/.test(env.ADMIN_SALT||''))fail('not-configured',503);
      if(['/discord/interactions','/discord/health'].includes(path))return await discordFetch(request,env,ctx);
      if(path==='/health'&&request.method==='GET'){await env.DB.prepare('SELECT id FROM licenses LIMIT 1').all();return json({ok:true,service:'tapnova-licenses',storage:'d1'})}
      if(!path.startsWith('/api/'))return json({error:'not-found'},404);
      const ip=request.headers.get('CF-Connecting-IP')||'local';
      const hash=await hasher(env.LICENSE_SECRET);
      if(path.startsWith('/api/admin/')){
        const origin=request.headers.get('origin');
        if(origin&&origin!==url.origin)fail('origin',403);
        if(post&&(origin!==url.origin||request.headers.get('x-tapnova-admin')!=='1'))fail('csrf',403);
        if(path==='/api/admin/auth-config'&&request.method==='GET')return json({algorithm:'PBKDF2-SHA256',iterations:600000,salt:env.ADMIN_SALT});
        if(path==='/api/admin/login'&&post){
          await rate(env.LOGIN_LIMIT,ip);
          const data=await body(request);
          if(typeof data.proof!=='string'||!/^[a-f0-9]{64}$/.test(data.proof)||!equal(await sha(data.proof),env.ADMIN_VERIFIER))fail('login',401);
          const token=random();await env.DB.prepare('INSERT INTO admin_sessions(token_hash,expires,auth_version) VALUES(?,?,?)').bind(await hash(token),Date.now()+43200000,env.ADMIN_VERIFIER).run();
          return json({ok:true},200,{'set-cookie':cookie(token,url.protocol==='https:')});
        }
        const token=request.headers.get('cookie')?.match(/(?:^|;\s*)tn_admin=([a-f0-9]{64})(?:;|$)/)?.[1];
        const th=token?await hash(token):'';
        const session=token&&await env.DB.prepare('SELECT expires FROM admin_sessions WHERE token_hash=? AND expires>? AND auth_version=?').bind(th,Date.now(),env.ADMIN_VERIFIER).first();
        if(!session)fail('login',401);
        if(path==='/api/admin/discord/welcome'&&request.method==='GET'){await rate(env.DISCORD_LIMIT,'welcome-status');return json(await welcomeStatus(env,true))}
        if(path==='/api/admin/discord/welcome'&&post){await rate(env.DISCORD_LIMIT,'welcome-config');return json(await configureWelcome(env,await body(request)))}
        if(path==='/api/admin/discord/welcome-check'&&post){await rate(env.DISCORD_LIMIT,'welcome-check');await body(request);await syncWelcomes(env);return json(await welcomeStatus(env))}
        if(path==='/api/admin/discord/welcome-preview'&&post){await rate(env.DISCORD_LIMIT,'welcome-preview');await body(request);return new Response(await previewWelcome(env),{headers:{...security,'content-type':'image/png'}})}
        if(path==='/api/admin/discord/commands'&&post){await body(request);return json(await registerDiscordCommands(env))}
        if(path==='/api/admin/discord/channel'&&request.method==='GET'){await rate(env.DISCORD_LIMIT,'admin-channel-inspection');return json(await inspectDiscordChannel(env,url.searchParams.get('id')))}
        if(path==='/api/admin/discord/draft'&&request.method==='GET'){await rate(env.DISCORD_LIMIT,'admin-draft-inspection');return json(await inspectDiscordDraft(env,url.searchParams.get('id')))}
        if(path==='/api/admin/logout'&&post){await body(request);await env.DB.prepare('DELETE FROM admin_sessions WHERE token_hash=?').bind(th).run();return json({ok:true},200,{'set-cookie':cookie('',url.protocol==='https:')})}
        const store=await createStore(env.DB,env.LICENSE_SECRET);
        if(path==='/api/admin/licenses'&&request.method==='GET')return json(await store.list());
        if(path==='/api/admin/licenses'&&post)return json(await store.create(await body(request)),201);
        const match=path.match(/^\/api\/admin\/licenses\/([0-9a-f-]{36})$/);
        if(match&&post)return json(await store.change(match[1],await body(request)));
      } else if(post&&['/api/activate','/api/heartbeat','/api/deactivate'].includes(path)) {
        await rate(env.CLIENT_LIMIT,ip);
        if(path==='/api/activate')await rate(env.ACTIVATION_LIMIT,ip);
        const data=await body(request),store=await createStore(env.DB,env.LICENSE_SECRET);
        if(path==='/api/activate')return json(await store.activate(data));
        const token=(request.headers.get('authorization')||'').replace(/^Bearer /,'');
        if(path==='/api/heartbeat')return json(await store.heartbeat(token,data.deviceId));
        return json(await store.deactivate(token,data.deviceId));
      }
      return json({error:'not-found'},404);
    }catch(e){return json({error:e.status?e.message:'service-unavailable'},e.status||503)}
  },
  async scheduled(event,env){
    if(event.cron==='* * * * *'){await syncWelcomes(env);return}
    if(event.cron==='*/5 * * * *'){await syncDiscord(env);return}
    await env.DB.batch([
      env.DB.prepare('DELETE FROM admin_sessions WHERE expires<?').bind(Date.now()),
      env.DB.prepare('DELETE FROM discord_drafts WHERE expires<?').bind(Date.now()-86400000),
      env.DB.prepare('DELETE FROM audit WHERE at<?').bind(Date.now()-90*86400000)
    ]);
  }
};
