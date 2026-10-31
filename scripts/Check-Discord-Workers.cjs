'use strict';
// Exercise real Workers fetch/FormData semantics, not Node's fetch mock.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const runtime=require('node:module').createRequire(require.resolve('wrangler'));
const {Miniflare,convertV4MiniflareOptions}=runtime('miniflare'),{buildSync}=runtime('esbuild');
module.exports=async function(){
 const root=path.resolve(__dirname,'..'),guild='222222222222222222',owner='333333333333333333',channel='444444444444444444';
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLttAAAAABJRU5ErkJggg==','base64');
 const script=buildSync({stdin:{contents:`import {runComposer} from './license-server/cloudflare/discord-composer.mjs'; export default {async fetch(request,env){return Response.json(await runComposer(env,await request.json()))}}`,resolveDir:root},bundle:true,write:false,format:'esm',platform:'browser'}).outputFiles[0].text;
 let redirect=false;const downloads=[],messages=[];
 const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script,compatibilityDate:'2026-10-23',d1Databases:{DB:'composer-native'},bindings:{DISCORD_GUILD_ID:guild,DISCORD_OWNER_ID:owner,DISCORD_BOT_TOKEN:'test'},outboundService:async request=>{
  const u=new URL(request.url);
  if(u.hostname==='cdn.discordapp.com'){
   downloads.push(u.href);
   return redirect?new Response(null,{status:302,headers:{location:'https://untrusted.invalid/image.png'}}):new Response(png,{headers:{'content-type':'image/png'}});
  }
  assert.equal(u.hostname,'discord.com','Never follow an attachment redirect');
  if(request.method==='GET')return Response.json({id:channel,guild_id:guild,type:0});
  assert.equal(request.method,'POST');
  const form=await request.formData(),payload=JSON.parse(form.get('payload_json'));
  assert.equal(payload.attachments.length,2);
  for(const [index,key]of ['image','thumbnail'].entries()){
   const file=form.get(`files[${index}]`);
   assert.equal(file.name,`tapnova-${key}.png`);
   assert.deepEqual(Buffer.from(await file.arrayBuffer()),png);
   assert.equal(payload.embeds[0][key].url,'attachment://'+file.name);
  }
  assert.deepEqual(payload.allowed_mentions,{parse:[]});messages.push(payload);
  return Response.json({id:'555555555555555555'});
 }}));
 try{
  const DB=await mf.getD1Database('DB');
  for(const name of ['0004_discord_composer.sql','0005_discord_errors.sql'])await DB.exec(fs.readFileSync(path.join(root,'license-server/cloudflare/migrations',name),'utf8').replace(/\s+/g,' '));
  async function publish(){
   const id=crypto.randomUUID(),image={kind:'upload',url:'https://cdn.discordapp.com/attachments/test/image.png',mime:'image/png',size:png.length};
   await DB.prepare('INSERT INTO discord_drafts(id,guild_id,owner_id,channel_id,data,created,expires) VALUES(?,?,?,?,?,?,?)').bind(id,guild,owner,channel,JSON.stringify({title:'Test',description:'Test',color:1,image,thumbnail:image}),Date.now(),Date.now()+60000).run();
   const response=await mf.dispatchFetch('https://test.invalid/',{method:'POST',body:JSON.stringify({type:3,guild_id:guild,member:{user:{id:owner}},data:{custom_id:`tnc:publish:${id}:1`}})});
   return {result:await response.json(),draft:await DB.prepare('SELECT state,last_error FROM discord_drafts WHERE id=?').bind(id).first()};
  }
  const success=await publish();assert.match(success.result.content,/Opublikowano wiadomość/);assert.equal(success.draft.state,'published');assert.equal(messages.length,1);assert.equal(downloads.length,2);
  redirect=true;
  const rejected=await publish();assert.match(rejected.result.content,/Nie udało się pobrać zdjęcia/);assert.equal(rejected.draft.state,'draft');assert.equal(JSON.parse(rejected.draft.last_error).stage,'prepare');assert.equal(messages.length,1);assert.equal(downloads.length,4);
  console.log('Workers runtime: two-image multipart publication and safe redirect rejection passed.');
 }finally{await mf.dispose()}
};
if(require.main===module)module.exports().catch(e=>{console.error(e);process.exitCode=1});
