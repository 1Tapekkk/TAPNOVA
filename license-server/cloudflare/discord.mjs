import {createStore} from './store.mjs';
import {hasher,random} from './crypto.mjs';
import {commands,ownerCommands} from './discord-commands.mjs';
import {isComposer,composerModal,runComposer} from './discord-composer.mjs';
const API='https://discord.com/api/v10';
const USER_AGENT='DiscordBot (https://github.com/1Tapekkk/TAPNOVA, 1.0)';
const RELEASES='https://github.com/1Tapekkk/TAPNOVA/releases/latest';
const snowflake=value=>typeof value==='string'&&/^\d{17,20}$/.test(value);
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const reply=content=>({type:4,data:{content,flags:64,allowed_mentions:{parse:[]}}});
const response=(value,status=200)=>Response.json(value,{status,headers:{'cache-control':'no-store'}});
const actor=i=>i.member?.user?.id;
const q=(env,sql,...args)=>env.DB.prepare(sql).bind(...args);
const active=row=>row&&!row.revoked&&(row.expires==null||row.expires>Date.now());
export const configured=env=>/^[a-f0-9]{64}$/i.test(env.DISCORD_PUBLIC_KEY||'')&&
 [env.DISCORD_APPLICATION_ID,env.DISCORD_GUILD_ID,env.DISCORD_OWNER_ID,env.DISCORD_CLIENT_ROLE_ID].every(snowflake)&&!!env.DISCORD_BOT_TOKEN;
export async function verifyDiscord(request,publicKey,raw,now=Date.now()) {
 const sig=request.headers.get('x-signature-ed25519'),time=request.headers.get('x-signature-timestamp');
 if(!/^[a-f0-9]{128}$/i.test(sig||'')||!/^\d{10,12}$/.test(time||'')||Math.abs(now-Number(time)*1000)>300000)return false;
 try{
  const bytes=hex=>Uint8Array.from(hex.match(/../g),v=>parseInt(v,16));
  const key=await crypto.subtle.importKey('raw',bytes(publicKey),{name:'Ed25519'},false,['verify']);
  return await crypto.subtle.verify('Ed25519',key,bytes(sig),new TextEncoder().encode(time+raw));
 }catch{return false}
}
async function readBody(request) {
 const reader=request.body?.getReader();if(!reader)throw Error('body');
 let size=0;const chunks=[];
 try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>65536){await reader.cancel();throw Error('size')}chunks.push(value)}}finally{reader.releaseLock()}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}
 return new TextDecoder('utf-8',{fatal:true}).decode(bytes);
}
async function api(env,path,method='GET',data) {
 const r=await fetch(API+path,{method,headers:{authorization:`Bot ${env.DISCORD_BOT_TOKEN}`,'content-type':'application/json','user-agent':USER_AGENT},
  ...(data?{body:JSON.stringify(data)}:{}),signal:AbortSignal.timeout(8000)});
 if(!r.ok){
  let retryAfter=0;if(r.status===429){try{retryAfter=Number((await r.json()).retry_after)}catch{retryAfter=Number(r.headers.get('retry-after'))}}
  throw Object.assign(Error('discord-api'),{discordStatus:r.status,retryAfter});
 }
 return r.status===204?null:r.json();
}
export async function registerDiscordCommands(env){
 if(!configured(env))throw Error('discord-not-configured');
 const path=`/applications/${env.DISCORD_APPLICATION_ID}/guilds/${env.DISCORD_GUILD_ID}/commands`;
 const deadline=Date.now()+65000;
 for(const command of commands){
  for(let attempt=0;attempt<3;attempt++){
   try{await api(env,path,'POST',command);break}catch(e){
    const wait=Math.ceil(e.retryAfter*1000)+250;
    if(e.discordStatus!==429||attempt===2||!Number.isFinite(wait)||wait<250||wait>15000||Date.now()+wait>deadline)throw e;
    await new Promise(resolve=>setTimeout(resolve,wait));
   }
  }
 }
 const saved=await api(env,path);
 if(!commands.every(c=>saved.some(s=>s.name===c.name)))throw Error('discord-registration-incomplete');
 return {ok:true,commands:commands.map(c=>c.name)};
}
async function finish(env,i,content) {
 // Interaction tokens are scoped by Discord and never stored in D1 or logs.
 const result=await fetch(`${API}/webhooks/${env.DISCORD_APPLICATION_ID}/${encodeURIComponent(i.token)}/messages/@original`,{
  method:'PATCH',headers:{'content-type':'application/json','user-agent':USER_AGENT},body:JSON.stringify({...(typeof content==='string'?{content}:content),allowed_mentions:{parse:[]}}),signal:AbortSignal.timeout(8000)});
 if(!result.ok)throw Error('discord-reply');
}
async function touchMember(env,user) {
 await q(env,'INSERT INTO discord_members(guild_id,user_id,checked_at) VALUES(?,?,0) ON CONFLICT(guild_id,user_id) DO UPDATE SET checked_at=0',env.DISCORD_GUILD_ID,user).run();
}
export async function syncMember(env,user) {
 if(!configured(env)||!snowflake(user))return false;
 const row=await q(env,`SELECT l.id FROM licenses l JOIN discord_links d ON d.license_id=l.id WHERE d.guild_id=? AND d.user_id=? AND l.revoked=0 AND (l.expires IS NULL OR l.expires>?) LIMIT 1`,env.DISCORD_GUILD_ID,user,Date.now()).first();
 let error='';
 try{await api(env,`/guilds/${env.DISCORD_GUILD_ID}/members/${user}/roles/${env.DISCORD_CLIENT_ROLE_ID}`,row?'PUT':'DELETE')}
 catch(e){error=String(e.discordStatus||'network')}
 await q(env,'UPDATE discord_members SET checked_at=?,last_error=? WHERE guild_id=? AND user_id=?',Date.now(),error,env.DISCORD_GUILD_ID,user).run();
 return !error;
}
export async function syncDiscord(env) {
 if(!configured(env))return;
 const users=await q(env,'SELECT user_id FROM discord_members WHERE guild_id=? AND checked_at<? ORDER BY checked_at,user_id LIMIT 20',env.DISCORD_GUILD_ID,Date.now()-240000).all();
 for(let offset=0;offset<users.results.length;offset+=5){
  await Promise.allSettled(users.results.slice(offset,offset+5).map(row=>syncMember(env,row.user_id)));
 }
 await q(env,'DELETE FROM discord_requests WHERE created<?',Date.now()-86400000).run();
}
function details(row) {
 const status=row.revoked?'zablokowana':!active(row)?'wygasła':!row.activated?'oczekuje na pierwszą aktywację':'aktywna';
 const term=row.expires?new Date(row.expires).toISOString().slice(0,16).replace('T',' ')+' UTC':row.duration?`${row.duration} dni od pierwszej aktywacji`:'bezterminowo';
 return `**${status}** · ${term}\nKod: ${row.hint} · Urządzenia: ${row.max_devices}\nID: \`${row.id}\``;
}
async function grant(env,i,options) {
 const user=options.uzytkownik,days=options.dni,devices=options.urzadzenia;
 if(!snowflake(user)||![0,7,30,90].includes(days)||!Number.isInteger(devices)||devices<1||devices>20)throw Error('invalid-options');
 // Verify membership before making an irreversible grant. No DM is sent.
 const member=await api(env,`/guilds/${env.DISCORD_GUILD_ID}/members/${user}`);
 if(member?.user?.bot||member?.user?.id!==user)throw Error('invalid-member');
 const key=`TN-${random(20).toUpperCase().match(/.{1,8}/g).join('-')}`,id=crypto.randomUUID(),now=Date.now();
 const hash=await hasher(env.LICENSE_SECRET),hint=key.slice(0,11)+'…'+key.slice(-4);
 // License, Discord assignment and audit entry commit together.
 await env.DB.batch([
  q(env,'INSERT INTO licenses(id,key_hash,hint,label,duration,max_devices,created) VALUES(?,?,?,?,?,?,?)',id,await hash(key),hint,`Discord ${user}`,days,devices,now),
  q(env,'INSERT INTO discord_links(license_id,guild_id,user_id,created) VALUES(?,?,?,?)',id,env.DISCORD_GUILD_ID,user,now),
  q(env,'INSERT INTO discord_members(guild_id,user_id,checked_at) VALUES(?,?,0) ON CONFLICT(guild_id,user_id) DO UPDATE SET checked_at=0',env.DISCORD_GUILD_ID,user),
  q(env,'INSERT INTO audit(at,action,license_id,detail) VALUES(?,?,?,?)',now,'discord-created',id,actor(i))
 ]);
 return `Utworzono dostęp dla <@${user}>.\n**Kod — przekaż klientowi prywatnie:**\n\`${key}\`\nID: \`${id}\`\nOkres: ${days?days+' dni od aktywacji':'bezterminowo'} · urządzenia: ${devices}.\nRola Klient zostanie zsynchronizowana. Pełny kod nie jest zapisywany w bazie; zapisz go teraz.`;
}
async function connect(env,i) {
 const values=(i.data.components||[]).flatMap(row=>row.components||[]);
 const key=String(values.find(x=>x.custom_id==='license-key')?.value||'').trim().toUpperCase();
 if(!/^TN-(?:[A-F0-9]{8}-){4}[A-F0-9]{8}$/.test(key))return 'Nieprawidłowy format kodu licencji.';
 const hash=await hasher(env.LICENSE_SECRET),row=await q(env,'SELECT * FROM licenses WHERE key_hash=?',await hash(key)).first();
 if(!active(row))return 'Kod jest nieprawidłowy, wygasł lub został zablokowany.';
 // Unique license_id prevents one code being bound to multiple Discord users.
 await q(env,'INSERT OR IGNORE INTO discord_links(license_id,guild_id,user_id,created) SELECT id,?,?,? FROM licenses WHERE id=? AND revoked=0 AND (expires IS NULL OR expires>?)',env.DISCORD_GUILD_ID,actor(i),Date.now(),row.id,Date.now()).run();
 const link=await q(env,'SELECT guild_id,user_id FROM discord_links WHERE license_id=?',row.id).first();
 if(link?.user_id!==actor(i)||link?.guild_id!==env.DISCORD_GUILD_ID)return 'Ten kod jest już przypisany do innego konta Discord. Skontaktuj się z właścicielem.';
 await touchMember(env,actor(i));
 const synced=await syncMember(env,actor(i));
 return 'Połączono licencję z Twoim kontem Discord. W aplikacji nadal wpisz ten sam kod.\n'+details(row)+(synced?'':'\nRola oczekuje na synchronizację; właściciel powinien sprawdzić uprawnienia bota.');
}
async function execute(env,i) {
 if(isComposer(i))return runComposer(env,i);
 if(i.type===5)return connect(env,i);
 const name=i.data.name,options=Object.fromEntries((i.data.options||[]).map(o=>[o.name,o.value]));
 if(name==='wydaj')return grant(env,i,options);
 if(['licencje','zablokuj','odblokuj','odlacz','usun'].includes(name))return managePerson(env,i,name,options);
 if(name==='licencja'){
  const rows=await q(env,'SELECT l.* FROM licenses l JOIN discord_links d ON d.license_id=l.id WHERE d.guild_id=? AND d.user_id=? ORDER BY l.created DESC LIMIT 5',env.DISCORD_GUILD_ID,actor(i)).all();
  if(!rows.results.length)return 'Nie masz jeszcze przypisanej licencji. Jeśli masz kod, użyj /polacz. W sprawie zakupu skontaktuj się z obsługą serwera.';
  await touchMember(env,actor(i));const synced=await syncMember(env,actor(i));
  return rows.results.map(details).join('\n\n')+(synced?'':'\nRola oczekuje na synchronizację.');
 }
 if(name==='status-bota'){
  const counts=await q(env,'SELECT COUNT(*) AS users,SUM(CASE WHEN last_error<>\'\' THEN 1 ELSE 0 END) AS errors FROM discord_members WHERE guild_id=?',env.DISCORD_GUILD_ID).first();
  return `Bot działa na Cloudflare.\nPowiązani użytkownicy: ${counts.users}. Błędy synchronizacji ról: ${counts.errors||0}.\nJeśli rola się nie nadaje, ustaw rolę bota powyżej roli Klient i nadaj mu Zarządzanie rolami.\nKomendy działają bez włączonego komputera i bez statusu obecności Gateway.`;
 }
 if(['przedluz','resetuj'].includes(name)){
  if(!uuid(options.id))return 'Podaj pełny identyfikator licencji z panelu właściciela.';
  const row=await q(env,'SELECT user_id FROM discord_links WHERE license_id=? AND guild_id=?',options.id,env.DISCORD_GUILD_ID).first();
  if(!row)return 'Ta licencja nie jest powiązana z tym serwerem Discord. Użyj panelu właściciela.';
  const store=await createStore(env.DB,env.LICENSE_SECRET);
  await store.change(options.id,{action:{przedluz:'extend',zablokuj:'revoke',resetuj:'reset'}[name],durationDays:options.dni});
  await touchMember(env,row.user_id);await syncMember(env,row.user_id);
  return `Zapisano zmianę licencji \`${options.id}\`.\n${name==='przedluz'?'Przedłużenie nie odblokowuje zablokowanej licencji — odblokuj ją w panelu właściciela.':''}`;
 }
 return 'Nieznana komenda. Użyj /pomoc.';
}
async function managePerson(env,i,name,options){
 const user=options.uzytkownik,id=options.id;
 if((user!==undefined&&!snowflake(user))||(id!==undefined&&!uuid(id)))return 'Nieprawidłowy użytkownik lub identyfikator licencji.';
 if(!user&&!id)return 'Wybierz osobę w polu uzytkownik lub podaj ID licencji. Listę sprawdzisz przez /licencje.';
 const clauses=['d.guild_id=?'],args=[env.DISCORD_GUILD_ID];
 if(user){clauses.push('d.user_id=?');args.push(user)}
 if(id){clauses.push('l.id=?');args.push(id)}
 const rows=(await q(env,`SELECT l.*,d.user_id FROM licenses l JOIN discord_links d ON d.license_id=l.id WHERE ${clauses.join(' AND ')} ORDER BY l.created DESC,l.id LIMIT 6`,...args).all()).results;
 if(!rows.length)return 'Nie znaleziono pasującej licencji połączonej z tym kontem na tym serwerze. Osoba z kodem otrzymanym prywatnie może użyć /polacz. Odłączone licencje znajdziesz w panelu właściciela.';
 if(name==='licencje'||rows.length>1){
  return (name==='licencje'?'Licencje tej osoby:':'Ta osoba ma kilka licencji. Niczego nie zmieniono. Powtórz komendę z polem id wybranej licencji:')+'\n\n'+rows.slice(0,5).map(details).join('\n\n')+(rows.length>5?'\n\nWięcej licencji znajdziesz w panelu właściciela.':'');
 }
 const row=rows[0];
 if(name==='usun'&&options.potwierdz!==true)return 'Nie usunięto licencji. Aby trwale usunąć kod i aktywacje, ustaw potwierdz: Tak. Możesz też użyć /zablokuj, aby zachować możliwość odblokowania.';
 await touchMember(env,row.user_id);
 if(name==='odlacz'){
  await env.DB.batch([
   q(env,'DELETE FROM discord_links WHERE license_id=? AND guild_id=? AND user_id=?',row.id,env.DISCORD_GUILD_ID,row.user_id),
   q(env,'INSERT INTO audit(at,action,license_id,detail) VALUES(?,?,?,?)',Date.now(),'discord-unlinked',row.id,`owner:${actor(i)} user:${row.user_id}`)
  ]);
 }else{
  const store=await createStore(env.DB,env.LICENSE_SECRET);
  await store.change(row.id,{action:{zablokuj:'revoke',odblokuj:'enable',usun:'delete'}[name]});
  await q(env,'INSERT INTO audit(at,action,license_id,detail) VALUES(?,?,?,?)',Date.now(),'discord-'+name,row.id,`owner:${actor(i)} user:${row.user_id}`).run();
 }
 const synced=await syncMember(env,row.user_id);
 const messages={zablokuj:'Zablokowano licencję i unieważniono aktywacje aplikacji.',odblokuj:'Odblokowano licencję. Jeżeli upłynął jej termin, przedłuż ją przez /przedluz.',usun:'Trwale usunięto licencję i jej aktywacje. Stary kod już nie działa.',odlacz:'Odłączono licencję od konta Discord. Kod i dostęp do aplikacji pozostają ważne. Posiadacz kodu może ponownie użyć /polacz. Aby odebrać dostęp, użyj blokady zamiast odłączania.'};
 return `${messages[name]}\nOsoba: <@${row.user_id}> · ID: \`${row.id}\`\n`+(synced?'Rola Klient została zsynchronizowana. Pozostaje, jeśli osoba ma inną ważną licencję.':'Zmiana licencji jest zapisana; rola oczekuje na synchronizację Discorda. Sprawdź /status-bota.');
}
async function processInteraction(env,i) {
 let claimed=false;
 try{
  const claim=await q(env,'INSERT OR IGNORE INTO discord_requests(id,created) VALUES(?,?) RETURNING id',i.id,Date.now()).all();
  if(!claim.results.length)return; // Discord retries never repeat a grant or extension.
  claimed=true;
  const content=await execute(env,i);
  await finish(env,i,content);
  await q(env,"UPDATE discord_requests SET state='done' WHERE id=?",i.id).run();
 }catch{
  if(claimed)try{await q(env,"UPDATE discord_requests SET state='failed' WHERE id=?",i.id).run()}catch{}
  try{await finish(env,i,'Nie udało się potwierdzić wykonania. Przy wydawaniu lub przedłużaniu sprawdź panel właściciela przed ponowieniem — zmiana mogła zostać zapisana.')}catch{}
 }
}
export async function discordFetch(request,env,ctx) {
 const path=new URL(request.url).pathname;
 if(path==='/discord/health'&&request.method==='GET')return response({service:'tapnova-discord',configured:configured(env),transport:'http-interactions'});
 if(request.method!=='POST')return response({error:'method'},405);
 if(!/^[a-f0-9]{64}$/i.test(env.DISCORD_PUBLIC_KEY||'')||!snowflake(env.DISCORD_APPLICATION_ID))return response({error:'discord-not-configured'},503);
 let raw;try{raw=await readBody(request)}catch{return response({error:'body'},413)}
 if(!await verifyDiscord(request,env.DISCORD_PUBLIC_KEY,raw))return response({error:'signature'},401);
 let i;try{i=JSON.parse(raw)}catch{return response({error:'json'},400)}
 if(i.application_id!==env.DISCORD_APPLICATION_ID)return response({error:'application'},403);
 if(i.type===1)return response({type:1});
 if(!configured(env))return response(reply('Bot czeka na dokończenie konfiguracji przez właściciela.'));
 if(i.guild_id!==env.DISCORD_GUILD_ID||!snowflake(actor(i)))return response(reply('Ten bot działa tylko na serwerze TAPNOVA.'));
 if(!snowflake(i.id)||typeof i.token!=='string'||i.token.length>512)return response({error:'interaction'},400);
 const name=i.data?.name;
 if((ownerCommands.has(name)||isComposer(i))&&actor(i)!==env.DISCORD_OWNER_ID)return response(reply('Ta komenda jest dostępna wyłącznie dla właściciela TAPNOVA.'));
 if(i.type===3&&i.data?.custom_id==='tapnova-buy')return response(reply(`Aby kupić dostęp, skontaktuj się z właścicielem serwera <@${env.DISCORD_OWNER_ID}>. Kod otrzymasz prywatnie po potwierdzeniu zakupu. Jeśli masz już kod, użyj /polacz.`));
 if(i.type===3&&i.data?.custom_id==='tapnova-help')return response(reply('**Pomoc TAPNOVA**\n/pobierz — aplikacja Windows/macOS\n/polacz — prywatny formularz kodu i rola Klient\n/licencja — sprawdzenie dostępu\nW aplikacji wpisz ten sam kod. Nie udostępniaj kodu ani hasła na kanale. W razie problemów skontaktuj się z obsługą serwera.'));
 if(i.type===2&&name==='pomoc')return response(reply('**TAPNOVA — pomoc**\n/pobierz — oficjalna aplikacja\n/polacz — wpisz otrzymany prywatnie kod w formularzu i odbierz rolę Klient\n/licencja — ważność dostępu i rola Klient\n\nNie wklejaj kodu na publiczny kanał. W aplikacji aktywuj dostęp tym samym kodem. Nigdy nie podawaj hasła do konta gry.'+(actor(i)===env.DISCORD_OWNER_ID?'\n\n**Właściciel**\n/licencje uzytkownik — sprawdź dostęp osoby\n/zablokuj, /odblokuj, /odlacz, /usun — wybierz osobę lub ID licencji\n/wydaj, /przedluz, /resetuj — zarządzanie kodami i urządzeniami':'')));
 if(i.type===2&&name==='pobierz')return response(reply(`Pobierz TAPNOVA wyłącznie z oficjalnego wydania:\n${RELEASES}\nWindows: EXE. Mac: DMG arm64 dla Apple Silicon lub x64 dla Intel. Do aktywacji potrzebny jest ważny kod.`));
 if((i.type===2&&name==='polacz')||(i.type===3&&i.data?.custom_id==='tapnova-activate'))return response({type:9,data:{custom_id:'tapnova-link',title:'Połącz licencję TAPNOVA',components:[{type:1,components:[{type:4,custom_id:'license-key',label:'Twój kod aktywacyjny',style:1,required:true,min_length:47,max_length:100}]}]}});
 if(!isComposer(i)&&!(i.type===2&&['licencja',...ownerCommands].includes(name))&&!(i.type===5&&i.data?.custom_id==='tapnova-link'))return response(reply('Nieznana komenda. Użyj /pomoc.'));
 if(!env.DISCORD_LIMIT||!(await env.DISCORD_LIMIT.limit({key:actor(i)})).success)return response(reply('Za dużo prób. Spróbuj ponownie za minutę.'));
 if(isComposer(i)){const modal=await composerModal(env,i);if(modal)return response(modal)}
 ctx.waitUntil(processInteraction(env,i));
 return response({type:5,data:{flags:64,allowed_mentions:{parse:[]}}});
}
