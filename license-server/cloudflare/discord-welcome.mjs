import {inspectDiscordChannel} from './discord-composer.mjs';
import {avatarUrl,renderWelcome,WELCOME_ORIGIN,WELCOME_ASSET} from './welcome-card.mjs';
const API='https://discord.com/api/v10';
const id=value=>typeof value==='string'&&/^\d{17,20}$/.test(value);
const q=(env,sql,...args)=>env.DB.prepare(sql).bind(...args);
const error=(message,status=400)=>Object.assign(Error(message),{status});
async function api(env,path,init={}){
 const r=await fetch(API+path,{...init,headers:{authorization:`Bot ${env.DISCORD_BOT_TOKEN}`,'user-agent':'DiscordBot (https://github.com/1Tapekkk/TAPNOVA, 1.0)',...init.headers},signal:AbortSignal.timeout(8000)});
 if(!r.ok){let data;try{data=await r.json()}catch{};throw Object.assign(error(r.status===403?'Włącz Server Members Intent w ustawieniach bota i sprawdź uprawnienia.':'Discord HTTP '+r.status,502),{discordStatus:r.status,retryAfter:Math.max(60,Math.min(3600,Number(data?.retry_after)||60))})}
 return r.json();
}
export async function welcomeStatus(env,inspect=false){
 const config=await q(env,'SELECT * FROM discord_welcome_config WHERE guild_id=?',env.DISCORD_GUILD_ID).first();
 const counts=(await q(env,'SELECT state,COUNT(*) AS n FROM discord_welcome_events WHERE guild_id=? GROUP BY state',env.DISCORD_GUILD_ID).all()).results;
 const result={config,counts};
 if(inspect){
  result.channels=(await api(env,`/guilds/${env.DISCORD_GUILD_ID}/channels`)).filter(c=>[0,5].includes(c.type)).map(c=>({id:c.id,name:c.name}));
  try{await api(env,`/guilds/${env.DISCORD_GUILD_ID}/members?limit=1`);result.membersAccess=true}catch(e){result.membersAccess=false;result.membersError=e.discordStatus||'network'}
 }
 return result;
}
export async function configureWelcome(env,data){
 if(typeof data.enabled!=='boolean')throw error('Podaj enabled: true albo false.');
 if(!data.enabled){
  await q(env,'UPDATE discord_welcome_config SET enabled=0 WHERE guild_id=?',env.DISCORD_GUILD_ID).run();
  await q(env,"UPDATE discord_welcome_events SET state='skipped' WHERE guild_id=? AND state='pending'",env.DISCORD_GUILD_ID).run();
  return {enabled:false};
 }
 if(!id(data.channelId))throw error('Wybierz kanał powitań.');
 const permissions=await inspectDiscordChannel(env,data.channelId);
 if(!Object.values(permissions.permissions).every(Boolean))throw error('Bot potrzebuje dostępu do kanału, wysyłania, osadzania linków, załączników i historii.');
 await api(env,`/guilds/${env.DISCORD_GUILD_ID}/members?limit=1`);
 const old=await q(env,'SELECT * FROM discord_welcome_config WHERE guild_id=?',env.DISCORD_GUILD_ID).first();
 if(old?.lease_until>Date.now())throw error('Trwa sprawdzanie nowych osób. Spróbuj za minutę.',409);
 const start=old?.enabled?old.enabled_at:Date.now();
 await q(env,`INSERT INTO discord_welcome_config(guild_id,channel_id,enabled,enabled_at) VALUES(?,?,1,?)
 ON CONFLICT(guild_id) DO UPDATE SET channel_id=excluded.channel_id,enabled=1,enabled_at=excluded.enabled_at,last_error='',next_attempt=0`,env.DISCORD_GUILD_ID,data.channelId,start).run();
 return {enabled:true,channelId:data.channelId,enabledAt:start,pollSeconds:60};
}
export async function previewWelcome(env){
 const member=await api(env,`/guilds/${env.DISCORD_GUILD_ID}/members/${env.DISCORD_OWNER_ID}`);
 const guild=await api(env,`/guilds/${env.DISCORD_GUILD_ID}?with_counts=true`);
 return renderWelcome(env,member,guild.approximate_member_count||1);
}
export async function welcomeCommand(env,i,options){
 if(i.member?.user?.id!==env.DISCORD_OWNER_ID)return 'Powitania konfiguruje tylko właściciel.';
 try{
  if(options.akcja==='wlacz'){
   const saved=await configureWelcome(env,{enabled:true,channelId:options.kanal||i.channel_id});
   return `Powitania włączone na <#${saved.channelId}>. Sprawdzam nowe osoby co minutę; przy kolejce wiadomości mogą pojawić się później. Obecni członkowie nie otrzymają powitania. Działam na Cloudflare bez włączonego komputera.`;
  }
  if(options.akcja==='wylacz'){await configureWelcome(env,{enabled:false});return 'Automatyczne powitania wyłączone.'}
  const {config,counts}=await welcomeStatus(env);
  return `**Powitania TAPNOVA**\n${config?.enabled?`Włączone na <#${config.channel_id}>`:'Wyłączone'}\nSprawdzanie co minutę, jedna wiadomość na cykl.\n${counts.map(c=>c.state+': '+c.n).join(' · ')||'Brak wysłanych powitań.'}\n${config?.last_error?'Ostatni błąd: '+config.last_error:'Brak zapisanych błędów.'}\nUżyj /powitania z akcją Włącz lub Wyłącz, aby zmienić ustawienie.`;
 }catch(e){return e.status?e.message:'Nie udało się zapisać powitań. Spróbuj ponownie.'}
}
export function welcomePayload(env,member,count,nonce,withImage){
 const userId=member.user.id;
 return {content:`Witaj <@${userId}> na **TAPNOVA**! 👋`,nonce,enforce_nonce:true,allowed_mentions:{parse:[],users:[userId]},
  embeds:[{title:'Miło Cię widzieć w naszej ekipie!',description:'Zajrzyj do regulaminu i cennika. Masz już kod dostępu? Użyj **/polacz**, aby odebrać rolę Klient.',color:0xb39af4,
   image:{url:withImage?'attachment://tapnova-welcome.png':WELCOME_ORIGIN+WELCOME_ASSET},
   ...(!withImage?{thumbnail:{url:avatarUrl(member)}}:{}),footer:{text:`TAPNOVA • Jest nas już ${count}!`}}],
  components:[{type:1,components:[{type:2,style:1,label:'Aktywuj kod',custom_id:'tapnova-activate'},{type:2,style:2,label:'Pomoc',custom_id:'tapnova-help'}]}],
  ...(withImage?{attachments:[{id:0,filename:'tapnova-welcome.png'}]}:{})};
}
export async function syncWelcomes(env){
 if(!env.DISCORD_BOT_TOKEN||!id(env.DISCORD_GUILD_ID))return;
 const now=Date.now(),config=await q(env,`UPDATE discord_welcome_config SET lease_until=? WHERE guild_id=? AND enabled=1 AND lease_until<? AND next_attempt<=? RETURNING *`,now+120000,env.DISCORD_GUILD_ID,now,now).first();
 if(!config)return;
 let diagnostic='',backoff=0;
 try{
  // Never resend an uncertain write after a runtime interruption.
  await q(env,"UPDATE discord_welcome_events SET state='uncertain',last_error='interrupted-send' WHERE guild_id=? AND state='sending' AND attempted_at<?",env.DISCORD_GUILD_ID,now-180000).run();
  const members=[];let after='0',complete=false;
  for(let page=0;page<5;page++){
   const rows=await api(env,`/guilds/${env.DISCORD_GUILD_ID}/members?limit=1000&after=${after}`);
   if(!Array.isArray(rows))throw error('Nieprawidłowa lista członków.',502);
   members.push(...rows);if(rows.length<1000){complete=true;break}after=rows.at(-1).user.id;
  }
  if(!complete)throw error('Serwer przekracza limit skanowania 5000 osób. Powitania wymagają rozszerzenia konfiguracji.',503);
  const seen=new Set((await q(env,'SELECT user_id,joined_at FROM discord_welcome_events WHERE guild_id=?',env.DISCORD_GUILD_ID).all()).results.map(r=>r.user_id+'|'+r.joined_at));
  const additions=members.filter(m=>id(m.user?.id)&&!m.user.bot&&!m.pending&&Date.parse(m.joined_at)>=config.enabled_at&&!seen.has(m.user.id+'|'+m.joined_at));
  // Bounded writes; remaining joins are discovered in the following cycle.
  if(additions.length)await env.DB.batch(additions.slice(0,40).map(m=>q(env,'INSERT OR IGNORE INTO discord_welcome_events(guild_id,user_id,joined_at,nonce,created) VALUES(?,?,?,?,?)',env.DISCORD_GUILD_ID,m.user.id,m.joined_at,crypto.randomUUID().replaceAll('-','').slice(0,24),now)));
  await q(env,'UPDATE discord_welcome_config SET member_count=? WHERE guild_id=?',members.length,env.DISCORD_GUILD_ID).run();
  const next=await q(env,"SELECT * FROM discord_welcome_events WHERE guild_id=? AND state='pending' ORDER BY created,user_id LIMIT 1",env.DISCORD_GUILD_ID).first();
  if(!next)return;
  const member=members.find(m=>m.user.id===next.user_id&&m.joined_at===next.joined_at);
  if(!member||member.user.bot){await q(env,"UPDATE discord_welcome_events SET state='skipped' WHERE guild_id=? AND user_id=? AND joined_at=?",env.DISCORD_GUILD_ID,next.user_id,next.joined_at).run();return}
  if(member.pending)return;
  let image;try{image=await renderWelcome(env,member,members.length)}catch{diagnostic='Grafika niedostępna lub limit Browser Run — użyto tła z awatarem w wiadomości.'}
  // Recheck the switch after rendering; disabling cancels pending messages.
  const still=await q(env,'SELECT enabled,channel_id FROM discord_welcome_config WHERE guild_id=?',env.DISCORD_GUILD_ID).first();
  if(!still?.enabled||still.channel_id!==config.channel_id)return;
  const claimed=await q(env,"UPDATE discord_welcome_events SET state='sending',attempted_at=? WHERE guild_id=? AND user_id=? AND joined_at=? AND state='pending' RETURNING nonce",Date.now(),env.DISCORD_GUILD_ID,next.user_id,next.joined_at).first();
  if(!claimed)return;
  const payload=welcomePayload(env,member,members.length,next.nonce,!!image);let init;
  if(image){const form=new FormData();form.append('payload_json',JSON.stringify(payload));form.append('files[0]',new Blob([image],{type:'image/png'}),'tapnova-welcome.png');init={method:'POST',body:form}}
  else init={method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)};
  let sent;
  try{
   sent=await api(env,`/channels/${config.channel_id}/messages`,init);
   if(!id(sent.id))throw Error('invalid-message');
   await q(env,"UPDATE discord_welcome_events SET state='sent',message_id=? WHERE guild_id=? AND user_id=? AND joined_at=?",sent.id,env.DISCORD_GUILD_ID,next.user_id,next.joined_at).run();
  }catch(e){
   const state=sent?.id?'uncertain':e.discordStatus===429?'pending':[400,401,403,404].includes(e.discordStatus)?'failed':'uncertain';
   await q(env,'UPDATE discord_welcome_events SET state=?,last_error=? WHERE guild_id=? AND user_id=? AND joined_at=?',state,'send-'+(e.discordStatus||'unconfirmed'),env.DISCORD_GUILD_ID,next.user_id,next.joined_at).run();
   throw e;
  }
 }catch(e){diagnostic=e.status?e.message:'Nie udało się potwierdzić cyklu powitań. Sprawdź kanał i status przed ponowieniem.';backoff=e.discordStatus===429?e.retryAfter*1000:60000}
 finally{await q(env,'UPDATE discord_welcome_config SET lease_until=0,checked_at=?,last_error=?,next_attempt=? WHERE guild_id=?',Date.now(),diagnostic,Date.now()+backoff,env.DISCORD_GUILD_ID).run()}
}
