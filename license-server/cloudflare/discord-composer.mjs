const API='https://discord.com/api/v10';
const UA='DiscordBot (https://github.com/1Tapekkk/TAPNOVA, 1.0)';
const DOWNLOAD='https://github.com/1Tapekkk/TAPNOVA/releases/latest';
const id=value=>typeof value==='string'&&/^\d{17,20}$/.test(value);
const q=(env,sql,...args)=>env.DB.prepare(sql).bind(...args);
const button=(label,custom_id,style=2)=>({type:2,label,custom_id,style});
const link=(label,url)=>({type:2,style:5,label,url});
const row=components=>({type:1,components});
const note=content=>({content,embeds:[],components:[],allowed_mentions:{parse:[]}});
const fail=message=>{throw Object.assign(Error(message),{composer:true})};
export const composerCommands=new Set(['embed','aktualizacja','panel-aktywacji','edytuj-embed']);
export const isComposer=i=>composerCommands.has(i.data?.name)||/^tnc:/.test(i.data?.custom_id||'');
const presets={
 ogloszenie:['📣 TAPNOVA • Ogłoszenie','**Co nowego w TAPNOVA?**\n\nWpisz treść ogłoszenia. Możesz używać **pogrubienia**, list i linków.'],
 cennik:['💎 TAPNOVA • Dostęp do aplikacji','**Wybierz swój dostęp**\n\n▫️ **7 dni** — wpisz cenę\n▫️ **30 dni** — wpisz cenę\n▫️ **90 dni** — wpisz cenę\n\nPo potwierdzeniu zakupu otrzymasz prywatny kod. Uzupełnij ceny i warunki przed publikacją.'],
 aktywacja:['🔑 TAPNOVA • Aktywuj swój dostęp','**Masz już kod? Jesteś o krok od dostępu.**\n\n**1.** Kliknij **Aktywuj kod** poniżej.\n**2.** Wpisz kod w prywatnym formularzu.\n**3.** Otrzymasz rolę **Klient**, jeśli licencja jest ważna.\n\nNastępnie aktywuj aplikację tym samym kodem. **Nie publikuj kodu na kanale.**'],
 instrukcja:['✨ TAPNOVA • Pierwsze kroki','**Zacznij w kilku krokach**\n\n**01** Pobierz wersję dla Windows lub macOS.\n**02** W aplikacji wpisz swój kod licencji.\n**03** Kliknij **Aktywuj kod**, aby połączyć Discorda.\n\nPotrzebujesz pomocy? Skorzystaj z przycisku poniżej.'],
 aktualizacja:['🚀 TAPNOVA • Nowa aktualizacja','**Nowości**\n• Wpisz nowe funkcje\n\n**Poprawki**\n• Wpisz poprawione błędy\n\n**Pobierz aktualną wersję** przyciskiem poniżej.'],
 konkurs:['🎉 TAPNOVA • Konkurs','**Nagroda**\nOpisz nagrodę.\n\n**Jak wziąć udział**\nWpisz zasady udziału.\n\n**Termin i ogłoszenie wyników**\nWpisz datę oraz sposób wyboru zwycięzcy.']
};
function defaults(template='ogloszenie'){
 if(!presets[template])fail('Wybierz dostępny szablon.');
 const [title,description]=presets[template];
 return {title,description,color:0xb39af4,footer:'TAPNOVA • Twoja przestrzeń',image:null,thumbnail:null,download:DOWNLOAD,buy:template==='cennik'?'auto':'',help:'auto',activate:['aktywacja','instrukcja','cennik'].includes(template)};
}
function url(value){
 if(typeof value!=='string'||value.length>512)fail('Link może mieć do 512 znaków.');
 let parsed;try{parsed=new URL(value)}catch{fail('Podaj pełny link zaczynający się od https://.')}
 if(parsed.protocol!=='https:'||parsed.username||parsed.password||parsed.port)fail('Link musi używać HTTPS, bez hasła i dodatkowego portu.');
 return parsed.href;
}
function attachment(a){
 if(!a||!id(a.id)||!['image/png','image/jpeg','image/gif','image/webp'].includes(a.content_type)||!Number.isInteger(a.size)||a.size<=0||a.size>5*1024*1024)fail('Zdjęcie musi być plikiem PNG, JPG, GIF lub WebP do 5 MB.');
 let parsed;try{parsed=new URL(a.url)}catch{fail('Nieprawidłowy adres załącznika.')}
 if(parsed.protocol!=='https:'||!['cdn.discordapp.com','media.discordapp.net'].includes(parsed.hostname)||parsed.port||parsed.username||parsed.password||!/^\/(ephemeral-attachments|attachments)\//.test(parsed.pathname))fail('Wgraj zdjęcie jako załącznik Discorda.');
 return {kind:'upload',url:a.url,mime:a.content_type,size:a.size};
}
function publicComponents(data){
 const buttons=[];
 if(data.activate)buttons.push(button('Aktywuj kod','tapnova-activate',1));
 if(data.download)buttons.push(link('Pobierz aplikację',data.download));
 if(data.buy)buttons.push(data.buy==='auto'?button('Kup dostęp','tapnova-buy'):link('Kup dostęp',data.buy));
 if(data.help)buttons.push(data.help==='auto'?button('Pomoc','tapnova-help'):link('Pomoc',data.help));
 return buttons.length?[row(buttons)]:[];
}
function embed(data){
 return {title:data.title,description:data.description,color:data.color,...(data.footer?{footer:{text:data.footer}}:{}),
  ...(data.image?{image:{url:data.image.url}}:{}),...(data.thumbnail?{thumbnail:{url:data.thumbnail.url}}:{})};
}
function preview(draft){
 const data=JSON.parse(draft.data),key=`${draft.id}:${draft.revision}`;
 const cta=publicComponents(data).flatMap(r=>r.components.map(c=>c.label)).join(' · ');
 return {content:`**Prywatny podgląd — ${draft.message_id?'edycja wiadomości':'jeszcze nie opublikowano'}**\nKanał: <#${draft.channel_id}> · projekt ważny godzinę\nPrzyciski po publikacji: ${cta||'brak'}`,
  embeds:[embed(data)],components:[row([button(draft.message_id?'Zapisz zmiany':'Opublikuj',`tnc:publish:${key}`,3),button('Popraw tekst',`tnc:text:${key}`),button('Zdjęcia',`tnc:media:${key}`),button('Przyciski',`tnc:links:${key}`),button('Anuluj',`tnc:cancel:${key}`,4)])],allowed_mentions:{parse:[]}};
}
const input=(label,custom_id,value,max_length,style=1,required=true)=>({type:18,label,component:{type:4,custom_id,style,required,max_length,...(value?{value:String(value)}:{})}});
function editor(draft,part){
 const d=JSON.parse(draft.data),key=`${draft.id}:${draft.revision}`;let components;
 if(part==='text')components=[input('Tytuł','title',d.title,256),input('Treść (Markdown)','description',d.description,4000,2),input('Kolor HEX, np. #B39AF4','color','#'+d.color.toString(16).padStart(6,'0'),7),input('Stopka (opcjonalnie)','footer',d.footer,200,1,false)];
 else if(part==='links')components=[input('Pobierz — link HTTPS lub puste','download',d.download,512,1,false),input('Kup — link HTTPS, auto lub puste','buy',d.buy,512,1,false),input('Pomoc — link HTTPS, auto lub puste','help',d.help,512,1,false),input('Przycisk aktywacji: tak lub nie','activate',d.activate?'tak':'nie',3)];
 else components=[...['image','thumbnail'].map((name,n)=>({type:18,label:n?'Miniaturka (opcjonalnie)':'Duże zdjęcie (opcjonalnie)',component:{type:19,custom_id:name,min_values:0,max_values:1,required:false,file_types:['.png','.jpg','.jpeg','.gif','.webp']}})),input('Usuń: zdjecie, miniaturka lub oba','remove','',30,1,false)];
 return {type:9,data:{custom_id:`tnc:save-${part}:${key}`,title:part==='text'?'Treść wiadomości':part==='links'?'Przyciski pod wiadomością':'Zdjęcia • maks. 5 MB każde',components}};
}
async function draftFor(env,i,allowStale=false){
 const match=(i.data?.custom_id||'').match(/^tnc:([a-z-]+):([a-f0-9-]{36}):(\d+)$/);if(!match)fail('Nieprawidłowy przycisk.');
 const d=await q(env,'SELECT * FROM discord_drafts WHERE id=? AND guild_id=? AND owner_id=?',match[2],i.guild_id,i.member.user.id).first();
 if(!d||d.expires<Date.now())fail('Ten podgląd wygasł. Uruchom komendę ponownie.');
 if(d.state!=='draft')fail(d.result_id?'Ta wiadomość została już zapisana. Edytuj ją przez /edytuj-embed.':'Ten projekt jest anulowany, publikowany lub wymaga sprawdzenia kanału. Nie wysyłam go ponownie.');
 if(!allowStale&&d.revision!==Number(match[3]))fail('To starszy podgląd. Użyj przycisków pod najnowszą wersją.');
 return {draft:d,action:match[1]};
}
export async function composerModal(env,i){
 if(i.type!==3||!/^tnc:(text|media|links):/.test(i.data?.custom_id||''))return null;
 try{const {draft,action}=await draftFor(env,i);return editor(draft,action)}catch(e){return {type:4,data:{...note(e.composer?e.message:'Nie udało się wczytać edytora.'),flags:64}}}
}
async function api(env,path,method='GET',payload,form){
 const r=await fetch(API+path,{method,headers:{authorization:`Bot ${env.DISCORD_BOT_TOKEN}`,'user-agent':UA,...(!form?{'content-type':'application/json'}:{})},...(form?{body:form}:payload?{body:JSON.stringify(payload)}:{}),signal:AbortSignal.timeout(7000)});
 if(!r.ok){
  let data;try{data=await r.json()}catch{}
  const fields=[];
  const walk=(node,path='',depth=0)=>{
   if(!node||typeof node!=='object'||depth>8||fields.length>=8)return;
   if(Array.isArray(node._errors))for(const error of node._errors.slice(0,3))if(/^[A-Z0-9_]{1,60}$/.test(error.code||''))fields.push((path||'request')+':'+error.code);
   for(const key of Object.keys(node))if(key!=='_errors'&&/^[a-z_0-9]{1,40}$/.test(key))walk(node[key],path?path+'.'+key:key,depth+1);
  };walk(data?.errors);
  throw Object.assign(Error('discord'),{discordStatus:r.status,discordCode:Number.isSafeInteger(data?.code)?data.code:null,discordFields:fields});
 }
 return r.status===204?null:r.json();
}
export async function inspectDiscordChannel(env,channelId){
 await channel(env,channelId);
 const [c,roles,member]=await Promise.all([api(env,`/channels/${channelId}`),api(env,`/guilds/${env.DISCORD_GUILD_ID}/roles`),api(env,`/guilds/${env.DISCORD_GUILD_ID}/members/${env.DISCORD_APPLICATION_ID}`)]);
 const selected=new Set([env.DISCORD_GUILD_ID,...member.roles]);
 let permissions=roles.filter(r=>selected.has(r.id)).reduce((p,r)=>p|BigInt(r.permissions),0n);
 const administrator=!!(permissions&8n);
 const apply=overrides=>{let allow=0n,deny=0n;for(const o of overrides){allow|=BigInt(o.allow);deny|=BigInt(o.deny)}permissions=(permissions&~deny)|allow};
 if(!administrator){
  apply((c.permission_overwrites||[]).filter(o=>o.id===env.DISCORD_GUILD_ID));
  apply((c.permission_overwrites||[]).filter(o=>o.type===0&&o.id!==env.DISCORD_GUILD_ID&&selected.has(o.id)));
  apply((c.permission_overwrites||[]).filter(o=>o.type===1&&o.id===env.DISCORD_APPLICATION_ID));
 }
 const bits={viewChannel:1024n,sendMessages:2048n,embedLinks:16384n,attachFiles:32768n,readHistory:65536n};
 const checks=Object.fromEntries(Object.entries(bits).map(([key,bit])=>[key,administrator||!!(permissions&bit)]));
 const timedOut=Date.parse(member.communication_disabled_until||'')>Date.now();
 if(!checks.viewChannel||timedOut)checks.sendMessages=checks.embedLinks=checks.attachFiles=false;
 if(!checks.sendMessages)checks.embedLinks=checks.attachFiles=false;
 return {channelId,channelName:c.name,administrator,timedOut,permissions:checks};
}
async function channel(env,channelId){
 if(!id(channelId))fail('Wybierz kanał tekstowy na serwerze.');
 const c=await api(env,`/channels/${channelId}`);
 if(c.guild_id!==env.DISCORD_GUILD_ID||![0,5].includes(c.type))fail('Wybierz kanał tekstowy lub ogłoszeniowy na serwerze TAPNOVA.');
}
function importMessage(message){
 if(message.embeds?.length!==1)fail('Edytor obsługuje wiadomości bota zawierające jeden embed.');
 const e=message.embeds[0];
 // Preserve richer legacy messages by refusing a lossy conversion.
 if(message.content||e.fields?.length||e.author||e.url||e.timestamp)fail('Ta wiadomość ma dodatkowe elementy. Edytuj wiadomość utworzoną przez /embed.');
 const d={...defaults(),title:e.title||'',description:e.description||'',color:e.color??0xb39af4,footer:e.footer?.text||'',download:'',buy:'',help:'',activate:false};
 for(const key of ['image','thumbnail']){
  if(!e[key]?.url){d[key]=null;continue}
  const match=message.attachments?.find(a=>a.url===e[key].url||new URL(a.url).pathname===new URL(e[key].url).pathname);
  d[key]={kind:'existing',url:e[key].url,...(match?{id:match.id,filename:match.filename}:{})};
 }
 for(const c of (message.components||[]).flatMap(r=>r.components||[])){
  if(c.custom_id==='tapnova-activate')d.activate=true;
  else if(c.custom_id==='tapnova-buy')d.buy='auto';else if(c.custom_id==='tapnova-help')d.help='auto';
  else if(c.style===5&&['Pobierz aplikację','Kup dostęp','Pomoc'].includes(c.label))d[{'Pobierz aplikację':'download','Kup dostęp':'buy','Pomoc':'help'}[c.label]]=url(c.url);
  else fail('Ta wiadomość ma przyciski z innej funkcji i nie może być edytowana tutaj.');
 }
 if(d.title.length>256||d.description.length>4000||d.footer.length>200)fail('Treść tej wiadomości przekracza limity edytora.');
 return d;
}
async function createDraft(env,i){
 const o=Object.fromEntries((i.data.options||[]).map(x=>[x.name,x.value]));
 let channelId=o.kanal||i.channel_id,messageId=null,data;
 await q(env,"UPDATE discord_drafts SET state='expired' WHERE expires<? AND state='draft'",Date.now()).run();
 if(i.data.name==='edytuj-embed'){
  const m=String(o.wiadomosc||'').match(/^https:\/\/(?:www\.)?(?:discord\.com|discordapp\.com)\/channels\/(\d{17,20})\/(\d{17,20})\/(\d{17,20})\/?$/);
  if(!m||m[1]!==env.DISCORD_GUILD_ID)fail('Wklej link do wiadomości bota z tego serwera (Kopiuj link do wiadomości).');
  channelId=m[2];messageId=m[3];
  const existing=await q(env,"SELECT * FROM discord_drafts WHERE guild_id=? AND channel_id=? AND message_id=? AND state IN ('draft','publishing')",env.DISCORD_GUILD_ID,channelId,messageId).first();
  if(existing){if(existing.owner_id!==i.member.user.id||existing.state!=='draft')fail('Ta wiadomość jest właśnie zapisywana. Sprawdź ją za chwilę.');return preview(existing)}
  await channel(env,channelId);
  const message=await api(env,`/channels/${channelId}/messages/${messageId}`);
  if(message.author?.id!==env.DISCORD_APPLICATION_ID||message.webhook_id)fail('Możesz edytować wyłącznie wiadomości wysłane przez tego bota.');
  data=importMessage(message);
 }else{
  await channel(env,channelId);
  data=defaults(i.data.name==='panel-aktywacji'?'aktywacja':i.data.name==='aktualizacja'?'aktualizacja':o.szablon||'ogloszenie');
  if(i.data.name==='aktualizacja'){
   if(typeof o.wersja!=='string'||!o.wersja.trim()||o.wersja.length>40)fail('Podaj numer wersji (do 40 znaków).');
   data.title=`🚀 TAPNOVA • Aktualizacja ${o.wersja.trim()}`;if(o.zmiany)data.description=String(o.zmiany).slice(0,4000);
  }
 }
 for(const [option,key]of [['zdjecie','image'],['miniaturka','thumbnail']])if(o[option])data[key]=attachment(i.data.resolved?.attachments?.[o[option]]);
 const now=Date.now(),draft={id:crypto.randomUUID(),guild_id:env.DISCORD_GUILD_ID,owner_id:i.member.user.id,channel_id:channelId,message_id:messageId,data:JSON.stringify(data),revision:1,state:'draft',created:now,expires:now+3600000};
 await q(env,'INSERT INTO discord_drafts(id,guild_id,owner_id,channel_id,message_id,data,created,expires) VALUES(?,?,?,?,?,?,?,?)',draft.id,draft.guild_id,draft.owner_id,channelId,messageId,draft.data,now,draft.expires).run();
 return preview(draft);
}
async function saveDraft(env,i,draft,action){
 const d=JSON.parse(draft.data),values=Object.fromEntries((i.data.components||[]).flatMap(r=>r.component?[r.component]:r.components||[]).map(c=>[c.custom_id,c.value??c.values]));
 if(action==='save-text'){
  if(typeof values.title!=='string'||!values.title.trim()||values.title.length>256||typeof values.description!=='string'||!values.description.trim()||values.description.length>4000||String(values.footer||'').length>200)fail('Tytuł: 1–256 znaków, treść: 1–4000, stopka: do 200.');
  if(!/^#?[0-9a-f]{6}$/i.test(values.color||''))fail('Kolor wpisz w formacie #B39AF4.');
  Object.assign(d,{title:values.title.trim(),description:values.description.trim(),footer:String(values.footer||'').trim(),color:parseInt(values.color.replace('#',''),16)});
 }else if(action==='save-links'){
  for(const k of ['download','buy','help']){const value=String(values[k]||'').trim();d[k]=value?(value==='auto'&&k!=='download'?'auto':url(value)):''}
  const activation=String(values.activate||'').trim().toLowerCase();if(!['tak','nie'].includes(activation))fail('Dla przycisku aktywacji wpisz tak lub nie.');d.activate=activation==='tak';
 }else if(action==='save-media'){
  const remove=String(values.remove||'').trim().toLowerCase();if(!['','zdjecie','zdjęcie','miniaturka','oba'].includes(remove))fail('Aby usunąć obraz, wpisz zdjecie, miniaturka lub oba.');
  if(['zdjecie','zdjęcie','oba'].includes(remove))d.image=null;if(['miniaturka','oba'].includes(remove))d.thumbnail=null;
  for(const key of ['image','thumbnail'])if(values[key]?.length)d[key]=attachment(i.data.resolved?.attachments?.[values[key][0]]);
 }else fail('Nieznana zmiana projektu.');
 const saved=await q(env,"UPDATE discord_drafts SET data=?,revision=revision+1 WHERE id=? AND state='draft' AND revision=? RETURNING *",JSON.stringify(d),draft.id,draft.revision).first();
 if(!saved)fail('Projekt został już zmieniony. Użyj najnowszego podglądu.');return preview(saved);
}
async function imageBytes(item){
 // Workers supports manual/follow only. Never follow a CDN redirect to an
 // unvalidated host, but use manual instead of unsupported redirect:error.
 const r=await fetch(item.url,{redirect:'manual',signal:AbortSignal.timeout(5000)});if(!r.ok)fail('Nie udało się pobrać zdjęcia. Wgraj je ponownie przez przycisk Zdjęcia.');
 const reader=r.body?.getReader();if(!reader)fail('Pusty plik zdjęcia.');let length=0;const chunks=[];
 try{while(true){const {value,done}=await reader.read();if(done)break;length+=value.length;if(length>5*1024*1024){await reader.cancel();fail('Zdjęcie przekracza 5 MB.')}chunks.push(value)}}finally{reader.releaseLock()}
 const bytes=new Uint8Array(length);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length}
 const signatures={ 'image/png':()=>bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71,'image/jpeg':()=>bytes[0]===255&&bytes[1]===216&&bytes[2]===255,'image/gif':()=>new TextDecoder().decode(bytes.slice(0,6)).match(/^GIF8[79]a$/),'image/webp':()=>new TextDecoder().decode(bytes.slice(0,4))==='RIFF'&&new TextDecoder().decode(bytes.slice(8,12))==='WEBP'};
 if(!signatures[item.mime]?.())fail('Plik nie jest poprawnym obrazem PNG, JPG, GIF lub WebP.');return bytes;
}
export async function inspectDiscordDraft(env,draftId){
 if(!/^[a-f0-9-]{36}$/.test(draftId||''))fail('Nieprawidłowy projekt.');
 const draft=await q(env,'SELECT data FROM discord_drafts WHERE id=? AND guild_id=? AND owner_id=?',draftId,env.DISCORD_GUILD_ID,env.DISCORD_OWNER_ID).first();
 if(!draft)fail('Nie znaleziono projektu.');
 const data=JSON.parse(draft.data);
 const images=await Promise.all(['image','thumbnail'].map(async key=>{
  const item=data[key],start=Date.now();if(item?.kind!=='upload')return {key,skipped:true};
  try{const bytes=await imageBytes(item);return {key,bytes:bytes.length,ms:Date.now()-start,ok:true}}
  catch(e){return {key,ok:false,ms:Date.now()-start,name:e.name,detail:String(e.message).replace(/https?:\/\/\S+/g,'[url]').slice(0,200)}}
 }));
 return {images};
}
async function publish(env,draft){
 const locked=await q(env,"UPDATE discord_drafts SET state='publishing' WHERE id=? AND state='draft' AND revision=? RETURNING id",draft.id,draft.revision).first();if(!locked)fail('Ten projekt jest już publikowany lub został zmieniony.');
 let attempted=false,message;
 try{
  await channel(env,draft.channel_id);
  const data=JSON.parse(draft.data),payload={content:'',embeds:[embed(data)],components:publicComponents(data),allowed_mentions:{parse:[]},attachments:[]};
  let form=null,index=0;const parts=await Promise.all(['image','thumbnail'].map(async key=>({key,item:data[key],bytes:data[key]?.kind==='upload'?await imageBytes(data[key]):null})));
  for(const {key,item,bytes}of parts){
   if(bytes){
    if(!form)form=new FormData();const ext={'image/png':'png','image/jpeg':'jpg','image/gif':'gif','image/webp':'webp'}[item.mime],filename=`tapnova-${key}.${ext}`;
    form.append(`files[${index}]`,new Blob([bytes],{type:item.mime}),filename);payload.attachments.push({id:index,filename});payload.embeds[0][key]={url:'attachment://'+filename};index++;
   }else if(item?.id&&!payload.attachments.some(a=>a.id===item.id))payload.attachments.push({id:item.id,filename:item.filename});
  }
  if(!draft.message_id){payload.nonce=draft.id.replaceAll('-','').slice(0,24);payload.enforce_nonce=true}
  if(form)form.append('payload_json',JSON.stringify(payload));
  attempted=true;message=await api(env,`/channels/${draft.channel_id}/messages${draft.message_id?'/'+draft.message_id:''}`,draft.message_id?'PATCH':'POST',payload,form);
  if(!id(message?.id))throw Error('invalid-message');
  await q(env,"UPDATE discord_drafts SET state='published',result_id=? WHERE id=?",message.id,draft.id).run();
  return note(`${draft.message_id?'Zapisano zmiany':'Opublikowano wiadomość'}: https://discord.com/channels/${env.DISCORD_GUILD_ID}/${draft.channel_id}/${message.id}\nEdytuj później przez /edytuj-embed i wklej ten link.`);
 }catch(e){
  const safe=!attempted||[400,401,403,404,429].includes(e.discordStatus);
  // A delivered Discord message must never be described as unpublished because
  // the subsequent database write failed. Keep the claim locked on DB failure.
  const diagnostic={http:e.discordStatus||null,code:e.discordCode||null,fields:e.discordFields||[],name:e.name,stage:attempted?'send':'prepare',...(e.composer?{detail:e.message}:{})};
  try{await q(env,'UPDATE discord_drafts SET state=?,last_error=? WHERE id=?',safe?'draft':draft.message_id?'cancelled':'uncertain',JSON.stringify(diagnostic),draft.id).run()}catch{}
  if(e.composer)throw e;
  if(safe){
   const reference=` [HTTP ${e.discordStatus||'?'}${e.discordCode?' / '+e.discordCode:''}]`;
   if(e.discordStatus===400)fail('Discord odrzucił format wiadomości lub załącznika.'+reference+(e.discordFields?.length?' Pole: '+e.discordFields.join(', '):'')+' Podgląd zachowany; popraw dane i spróbuj ponownie.');
   if(e.discordStatus===401)fail('Discord odrzucił token bota. Właściciel musi odnowić połączenie.'+reference);
   if(e.discordStatus===403)fail('Discord odmówił dostępu na tym kanale. Sprawdź uprawnienia kanału i kategorii dla bota: wysyłanie wiadomości, osadzanie linków i załączniki.'+reference);
   if(e.discordStatus===404)fail('Nie znaleziono kanału lub edytowanej wiadomości. Wybierz aktualny kanał albo link.'+reference);
   if(e.discordStatus===429)fail('Discord ograniczył liczbę zapytań. Odczekaj chwilę i użyj ponownie przycisku publikacji.'+reference);
   fail('Nie rozpoczęto publikacji. Nie udało się przygotować wiadomości. Podgląd zachowany.');
  }
  fail('Nie mogę potwierdzić zapisu. Sprawdź kanał przed kolejną publikacją, aby nie utworzyć duplikatu.'+(message?.id?` Link: https://discord.com/channels/${env.DISCORD_GUILD_ID}/${draft.channel_id}/${message.id}`:''));
 }
}
export async function runComposer(env,i){
 try{
  if(i.member?.user?.id!==env.DISCORD_OWNER_ID)return note('Edytor jest dostępny tylko dla właściciela.');
  if(i.type===2)return await createDraft(env,i);
  const {draft,action}=await draftFor(env,i);
  if(i.type===5)return await saveDraft(env,i,draft,action);
  if(action==='publish')return await publish(env,draft);
  if(action==='cancel'){
   const changed=await q(env,"UPDATE discord_drafts SET state='cancelled' WHERE id=? AND state='draft' AND revision=? RETURNING id",draft.id,draft.revision).first();
   return note(changed?'Anulowano projekt. Wiadomość na kanale nie została zmieniona.':'Projekt jest już zmieniany.');
  }
  return note('Użyj przycisków pod podglądem.');
 }catch(e){return note(e.composer?e.message:'Nie udało się potwierdzić operacji edytora. Sprawdź kanał przed ponowną publikacją.')}
}
