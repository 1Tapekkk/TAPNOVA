'use strict';
const assert=require('node:assert/strict');
module.exports=async function checkEmbeds({env,DB,send,command,options,calls}){
 const savedFetch=global.fetch,channel='777777777777777777',outsider='888888888888888888',attachmentId='999999999999999999';
 const messages=new Map(),publicWrites=[],uploads=[];let serial=900000000000000000n,failure=null,foreign=false;
 global.fetch=async(url,init={})=>{
  const href=String(url);
  if(href.startsWith('https://cdn.discordapp.com/ephemeral-attachments/')){uploads.push(href);return new Response(new Uint8Array([137,80,78,71,13,10,26,10]));}
  if(href.includes('/channels/')){
   const messageId=href.match(/\/messages\/(\d+)$/)?.[1];
   if(!href.includes('/messages'))return Response.json({id:channel,guild_id:foreign?outsider:env.DISCORD_GUILD_ID,type:0});
   if((init.method||'GET')==='GET')return Response.json(messages.get(messageId));
   publicWrites.push({url:href,method:init.method,body:init.body});
   if(failure==='network')throw Error('lost response');if(failure)return new Response('{}',{status:failure});
   const form=init.body instanceof FormData,payload=JSON.parse(form?init.body.get('payload_json'):init.body);
   assert.deepEqual(payload.allowed_mentions,{parse:[]});
   if(form)assert.ok(init.body.get('files[0]') instanceof Blob);
   const id=messageId||String(++serial),saved={...payload,id,author:{id:env.DISCORD_APPLICATION_ID}};
   saved.attachments=saved.attachments.map((a,index)=>({...a,id:typeof a.id==='string'?a.id:String(++serial),url:'https://cdn.discordapp.com/attachments/'+channel+'/'+id+'/'+a.filename}));
   for(const field of ['image','thumbnail'])if(saved.embeds[0][field]?.url.startsWith('attachment://')){const file=saved.embeds[0][field].url.slice(13);saved.embeds[0][field].url=saved.attachments.find(a=>a.filename===file).url;}
   messages.set(id,saved);return Response.json(saved);
  }
  return savedFetch(url,init);
 };
 const last=()=>JSON.parse(calls.filter(c=>c.url.includes('/webhooks/')&&c.method==='PATCH').at(-1).body);
 const owner=(name,values={})=>({...command(name,env.DISCORD_OWNER_ID,options(values)),channel_id:channel});
 const component=(custom_id,who=env.DISCORD_OWNER_ID)=>({...command('ignored',who),channel_id:channel,type:3,data:{custom_id}});
 const button=(preview,action)=>preview.components[0].components.find(c=>c.custom_id.startsWith('tnc:'+action+':')).custom_id;
 const save=(custom_id,values)=>({...component(custom_id),type:5,data:{custom_id,components:Object.entries(values).map(([key,value])=>({type:18,component:{type:4,custom_id:key,value}}))}});
 try{
  assert.match((await send(command('embed',outsider))).body.data.content,/wyłącznie/);
  const create=owner('embed',{szablon:'cennik'});const initial=await send(create);
  assert.equal(initial.body.type,5);assert.equal(initial.body.data.flags,64);assert.equal(publicWrites.length,0);
  let preview=last();assert.match(preview.embeds[0].description,/7 dni/);assert.match(preview.content,/Prywatny podgląd/);
  const oldPublish=button(preview,'publish');
  assert.match((await send(component(button(preview,'text'),outsider))).body.data.content,/wyłącznie/);
  const modal=(await send(component(button(preview,'text')))).body;assert.equal(modal.type,9);
  await send(save(modal.data.custom_id,{title:'Test @everyone',description:'Opis testowy',color:'#123456',footer:'Stopka'}));preview=last();
  assert.equal(preview.embeds[0].color,0x123456);assert.equal(publicWrites.length,0);
  await send(component(oldPublish));assert.match(last().content,/starszy podgląd/);assert.equal(publicWrites.length,0);
  const links=(await send(component(button(preview,'links')))).body;
  await send(save(links.data.custom_id,{download:'https://example.com/download',buy:'auto',help:'auto',activate:'tak'}));preview=last();
  const upload=(await send(component(button(preview,'media')))).body;
  assert.equal(upload.data.components[0].component.type,19);
  const data={id:attachmentId,size:8,content_type:'image/png',url:'https://cdn.discordapp.com/ephemeral-attachments/'+channel+'/'+attachmentId+'/image.png?ex=test'};
  const media={...component(upload.data.custom_id),type:5,data:{custom_id:upload.data.custom_id,components:[{type:18,component:{type:19,custom_id:'image',values:[attachmentId]}}],resolved:{attachments:{[attachmentId]:data}}}};
  await send(media);preview=last();assert.equal(uploads.length,0,'Upload is fetched only upon publication');
  const publish=component(button(preview,'publish'));await send(publish);
  assert.equal(publicWrites.length,1);assert.equal(uploads.length,1);assert.match(last().content,/Opublikowano wiadomość/);
  const first=[...messages.values()][0];assert.equal(first.embeds[0].image.url,first.attachments[0].url);
  assert.ok(first.components[0].components.some(c=>c.custom_id==='tapnova-activate'));
  await send(publish);assert.equal(publicWrites.length,1,'Replayed interaction does not publish twice');
  await send(component(button(preview,'publish')));assert.equal(publicWrites.length,1,'Repeated click does not publish twice');
  const activate=(await send(component('tapnova-activate',outsider))).body;assert.equal(activate.type,9);assert.equal(activate.data.custom_id,'tapnova-link');
  assert.equal((await send(component('tapnova-help',outsider))).body.data.flags,64);
  assert.equal((await send(component('tapnova-buy',outsider))).body.data.flags,64);
  await send(owner('edytuj-embed',{wiadomosc:`https://discord.com/channels/${env.DISCORD_GUILD_ID}/${channel}/${first.id}`}));preview=last();
  await send(component(button(preview,'publish')));assert.equal(publicWrites.at(-1).method,'PATCH');assert.equal(messages.size,1);assert.equal(messages.get(first.id).attachments[0].id,first.attachments[0].id);
  for(const template of ['ogloszenie','aktywacja','instrukcja','aktualizacja','konkurs']){await send(owner('embed',{szablon:template}));assert.ok(last().embeds[0].title);await send(component(button(last(),'cancel')));assert.match(last().content,/Anulowano/);}
  await send(owner('aktualizacja',{wersja:'4.2.3',zmiany:'Naprawiona kolejka'}));assert.match(last().embeds[0].title,/4\.2\.3/);assert.equal(last().embeds[0].description,'Naprawiona kolejka');
  await send(component(button(last(),'cancel')));
  const bad=owner('embed',{zdjecie:attachmentId});bad.data.resolved={attachments:{[attachmentId]:{...data,url:'https://localhost/secrets'}}};await send(bad);assert.match(last().content,/załącznik Discorda/);
  foreign=true;await send(owner('embed'));assert.match(last().content,/serwerze TAPNOVA/);foreign=false;
  await send(owner('panel-aktywacji'));preview=last();const retry=button(preview,'publish');failure=403;await send(component(retry));assert.match(last().content,/Nie opublikowano/);
  failure=null;await send(component(retry));assert.match(last().content,/Opublikowano/);
  await send(owner('embed'));preview=last();const ambiguous=button(preview,'publish');failure='network';await send(component(ambiguous));assert.match(last().content,/Nie mogę potwierdzić/);
  const count=publicWrites.length;failure=null;await send(component(ambiguous));assert.equal(publicWrites.length,count);assert.match(last().content,/Nie wysyłam go ponownie/);
  assert.equal((await DB.prepare("SELECT COUNT(*) AS n FROM discord_drafts WHERE state='uncertain'").first()).n,1);
  console.log('Discord embeds: owner-only private drafts/modals, all templates, photos, persistent multipart attachments, links, publish/edit/cancel, activation, stale revisions, replay protection and ambiguous API outcomes passed.');
 }finally{global.fetch=savedFetch}
};
