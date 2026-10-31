'use strict';
// Token enters through a loopback-only form, then travels to Discord over HTTPS
// and to Wrangler over stdin. Never persist or print it.
const http=require('node:http'),crypto=require('node:crypto'),path=require('node:path'),fs=require('node:fs'),{spawn}=require('node:child_process'),{pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..'),config=path.join(root,'license-server/cloudflare/wrangler.local.json');
const endpoint='https://tapnova-licenses.tapnova-1tapekkk.workers.dev/discord/interactions';
const nonce=crypto.randomBytes(24).toString('hex');
const dataDir=path.join(root,'license-server/.data'),statusFile=path.join(dataDir,'discord-setup-status.json');
const validId=value=>typeof value==='string'&&/^\d{17,20}$/.test(value);
function status(state,extra={}){fs.mkdirSync(dataDir,{recursive:true});fs.writeFileSync(statusFile,JSON.stringify({state,at:new Date().toISOString(),...extra},null,2))}
function upload(secrets){return new Promise((resolve,reject)=>{
 const wrangler=path.join(path.dirname(require.resolve('wrangler/package.json')),'bin/wrangler.js');
 const child=spawn(process.execPath,[wrangler,'secret','bulk','--config',config],{cwd:root,windowsHide:true,stdio:['pipe','ignore','ignore'],env:{...process.env,WRANGLER_SEND_METRICS:'false'}});
 const timer=setTimeout(()=>{child.kill();reject(Error('Cloudflare nie odpowiedział. Sprawdź logowanie Wrangler i spróbuj ponownie.'))},120000);
 child.on('error',()=>{clearTimeout(timer);reject(Error('Nie udało się uruchomić Wrangler.'))});
 child.on('exit',code=>{clearTimeout(timer);code===0?resolve():reject(Error('Zapis sekretów Cloudflare nie powiódł się. Uruchom pnpm cloudflare:login i spróbuj ponownie.'))});
 child.stdin.on('error',()=>{});child.stdin.end(JSON.stringify(secrets));
})}
async function configure(input){
 const {token,guild,owner,role}=input;
 if(![guild,owner,role].every(validId)||typeof token!=='string'||token.length<30||token.length>250||/\s/.test(token))throw Error('Sprawdź token i identyfikatory: ID powinny zawierać 17–20 cyfr.');
 const api=async(route,method='GET',body)=>{
  for(let attempt=0;attempt<3;attempt++){
  const r=await fetch('https://discord.com/api/v10'+route,{method,headers:{authorization:'Bot '+token,'content-type':'application/json','user-agent':'DiscordBot (https://github.com/1Tapekkk/TAPNOVA, 1.0)'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(15000)});
  if(r.status===429){
   let limit;try{limit=await r.json()}catch{}
   const retry=Number(limit?.retry_after||r.headers.get('retry-after')||5);
   if(attempt<2&&Number.isFinite(retry)&&retry>0&&retry<=30){await new Promise(resolve=>setTimeout(resolve,Math.ceil(retry*1000)+500));continue}
   throw Error('Discord ogranicza liczbę zapytań. Spróbuj ponownie za '+(Number.isFinite(retry)?Math.ceil(retry):60)+' sekund.');
  }
  if(!r.ok)throw Error('Discord: '+r.status+'. Sprawdź token, obecność bota na serwerze i jego uprawnienia.');
  return r.status===204?null:r.json();
  }
 };
 const app=await api('/applications/@me');
 if(!validId(app.id)||!/^[a-f0-9]{64}$/i.test(app.verify_key||''))throw Error('Discord nie zwrócił prawidłowej konfiguracji aplikacji.');
 const guildInfo=await api('/guilds/'+guild),roles=await api('/guilds/'+guild+'/roles');
 const me=await api('/users/@me'),member=await api('/guilds/'+guild+'/members/'+me.id),ownerMember=await api('/guilds/'+guild+'/members/'+owner);
 const permissions=m=>roles.filter(r=>r.id===guild||m.roles.includes(r.id)).reduce((bits,r)=>bits|BigInt(r.permissions),0n);
 if(guildInfo.owner_id!==owner&&!(permissions(ownerMember)&8n))throw Error('Podane konto właściciela musi być właścicielem serwera lub administratorem.');
 const client=roles.find(r=>r.id===role),highest=Math.max(0,...roles.filter(r=>member.roles.includes(r.id)).map(r=>r.position));
 if(!client||client.managed||client.id===guild)throw Error('Wybierz zwykłą rolę Klient utworzoną na tym serwerze.');
 if(BigInt(client.permissions)&(2n|4n|8n|16n|32n|268435456n|536870912n))throw Error('Rola Klient ma uprawnienia administracyjne. Wybierz rolę służącą tylko do dostępu do kanałów klientów.');
 if(highest<=client.position)throw Error('W ustawieniach serwera przesuń rolę bota powyżej roli Klient.');
 if(!(permissions(member)&(8n|268435456n)))throw Error('Nadaj botowi uprawnienie Zarządzanie rolami. Administrator nie jest wymagany.');
 const health=await fetch(endpoint.replace('/interactions','/health'),{signal:AbortSignal.timeout(15000)});
 if(!health.ok)throw Error('Najpierw opublikuj serwer: pnpm cloudflare:deploy.');
 if(app.interactions_endpoint_url&&app.interactions_endpoint_url!==endpoint)throw Error('Ta aplikacja ma już inny adres Interactions Endpoint URL. Użyj osobnej aplikacji TAPNOVA lub usuń poprzedni adres w Developer Portal, jeśli świadomie ją zastępujesz.');
 status('configuring');
 await upload({DISCORD_BOT_TOKEN:token,DISCORD_APPLICATION_ID:app.id,DISCORD_PUBLIC_KEY:app.verify_key,DISCORD_GUILD_ID:guild,DISCORD_OWNER_ID:owner,DISCORD_CLIENT_ROLE_ID:role});
 // Discord validates our live signature endpoint before accepting this URL.
 await api('/applications/@me','PATCH',{interactions_endpoint_url:endpoint});
 const {commands}=await import(pathToFileURL(path.join(root,'license-server/cloudflare/discord-commands.mjs')));
 // Upsert our named commands without deleting any unrelated commands.
 for(const command of commands)await api(`/applications/${app.id}/guilds/${guild}/commands`,'POST',command);
 const registered=await api(`/applications/${app.id}/guilds/${guild}/commands`);
 if(!commands.every(c=>registered.some(r=>r.name===c.name)))throw Error('Nie wszystkie komendy zostały zapisane. Spróbuj ponownie.');
 const verified=await api('/applications/@me');
 if(verified.interactions_endpoint_url!==endpoint)throw Error('Nie udało się potwierdzić adresu interakcji.');
 status('ready',{applicationId:app.id,guildId:guild,commands:commands.map(c=>c.name),endpoint});
 return {ok:true,message:'Połączono z Cloudflare i zarejestrowano '+commands.length+' komend. W Discordzie wpisz /pomoc, a potem /status-bota. Możesz wyłączyć komputer. Token nie został zapisany w plikach projektu.'};
}
const page=`<!doctype html><html lang="pl"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>TAPNOVA — podłącz bota</title>
<style>body{background:#0c0b12;color:#f4f0ff;font:16px system-ui;margin:0;padding:32px}main{max-width:640px;margin:auto;border:1px solid #363047;border-radius:24px;padding:30px;background:#16131f}h1{font-size:28px}p,li{line-height:1.6;color:#c5bed4}label{display:block;margin:18px 0 6px}input{box-sizing:border-box;width:100%;background:#0c0b12;color:white;border:1px solid #544867;border-radius:10px;padding:13px;font:inherit}button{margin-top:24px;border:0;border-radius:12px;padding:15px 24px;background:#b7a0fa;font:600 16px system-ui;cursor:pointer}button:disabled{opacity:.5}a{color:#cbb8ff}#result{white-space:pre-wrap;padding-top:20px}small{color:#aea5bd}</style>
<main><small>TAPNOVA · KONFIGURACJA WŁAŚCICIELA</small><h1>Twój bot. Bez włączonego PC.</h1>
<p>Ten formularz działa tylko na Twoim komputerze. Token trafi do sekretów Cloudflare; nie zapisujemy go w plikach ani na GitHubie.</p>
<ol><li>W <a href="https://discord.com/developers/applications" target="_blank" rel="noreferrer">Discord Developer Portal</a> otwórz aplikację → Bot → skopiuj token. Jeżeli go nie masz, Reset Token unieważni poprzedni token.</li><li>Dodaj bota do serwera przez Installation / OAuth2: zakresy <b>bot</b> i <b>applications.commands</b>, uprawnienie <b>Zarządzanie rolami</b>.</li><li>Utwórz rolę <b>Klient</b> i przesuń rolę bota wyżej. W Discordzie włącz Ustawienia → Zaawansowane → Tryb dewelopera, aby kopiować ID prawym przyciskiem.</li></ol>
<form id="setup" autocomplete="off"><label for="token">Token bota — tylko tutaj, nie na czacie</label><input id="token" name="token" type="password" required autocomplete="new-password" maxlength="250">
<label for="guild">ID serwera Discord</label><input id="guild" name="guild" inputmode="numeric" pattern="[0-9]{17,20}" required>
<label for="owner">ID Twojego konta Discord (właściciel)</label><input id="owner" name="owner" inputmode="numeric" pattern="[0-9]{17,20}" required>
<label for="role">ID roli Klient</label><input id="role" name="role" inputmode="numeric" pattern="[0-9]{17,20}" required>
<button id="submit">Połącz i uruchom bota</button></form><p id="result" role="status"></p>
<small>Konfiguracja dodaje komendy TAPNOVA i ustawia adres interakcji tej aplikacji. Nie wymaga dostępu do treści wiadomości.</small></main>
<script src="/setup.js"></script></html>`;
const js=`document.querySelector('#setup').addEventListener('submit',async e=>{e.preventDefault();const button=document.querySelector('#submit'),result=document.querySelector('#result');button.disabled=true;result.textContent='Sprawdzam Discord i konfiguruję Cloudflare. Może to potrwać około minuty…';const data=Object.fromEntries(new FormData(e.target));try{const r=await fetch('/configure',{method:'POST',headers:{'content-type':'application/json','x-setup-token':'${nonce}'},body:JSON.stringify(data)});const answer=await r.json();result.textContent=answer.message;if(answer.ok){e.target.reset();e.target.hidden=true}}catch{result.textContent='Nie udało się połączyć z lokalnym formularzem. Uruchom go ponownie.'}finally{data.token='';button.disabled=false}});`;
let origin,busy=false,done=false;
const server=http.createServer(async(req,res)=>{
 const headers={'cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer','content-security-policy':"default-src 'self'; style-src 'unsafe-inline'; script-src 'self'; frame-ancestors 'none'; form-action 'self'"};
 const send=(code,value,type='application/json')=>{res.writeHead(code,{...headers,'content-type':type+'; charset=utf-8'});res.end(type==='application/json'?JSON.stringify(value):value)};
 if(req.headers.host!==new URL(origin).host)return send(403,{message:'Host'});
 if(req.method==='GET'&&req.url==='/?session='+nonce){
  let guild='';
  try{const defaults=JSON.parse(fs.readFileSync(path.join(dataDir,'discord-setup-defaults.json'),'utf8'));if(validId(defaults.guild))guild=defaults.guild}catch{}
  return send(200,page.replace('name="guild"','name="guild" value="'+guild+'"'),'text/html');
 }
 if(req.method==='GET'&&req.url==='/setup.js')return send(200,js,'text/javascript');
 if(req.method!=='POST'||req.url!=='/configure')return send(404,{message:'Nie znaleziono'});
 if(req.headers.origin!==origin||req.headers['x-setup-token']!==nonce||req.headers['content-type']!=='application/json')return send(403,{message:'Odśwież formularz z oryginalnego linku.'});
 if(busy||done)return send(409,{message:done?'Bot jest już skonfigurowany.':'Konfiguracja już trwa.'});
 busy=true;
 try{
  let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>8192)throw Error('Za duży formularz.')}
  let input;try{input=JSON.parse(raw)}catch{throw Error('Nieprawidłowy formularz.')}
  raw='';let result;try{result=await configure(input)}finally{input.token=''}
  done=true;send(200,result);setTimeout(()=>server.close(),2000);
 }catch(e){const message=e.message.startsWith('Unexpected')?'Nieprawidłowa odpowiedź usługi. Spróbuj ponownie.':e.message;status('needs-input');send(400,{message})}finally{busy=false}
});
if(require.main===module){
server.listen(0,'127.0.0.1',()=>{
 origin='http://127.0.0.1:'+server.address().port;const url=origin+'/?session='+nonce;
 status('waiting',{url});console.log('Otwórz formularz: '+url);
});
server.on('error',()=>{console.error('Nie udało się uruchomić lokalnego formularza.');process.exitCode=1});
setTimeout(()=>{if(!busy){server.close();process.exitCode=0}},60*60*1000).unref();
}
module.exports={configure};
