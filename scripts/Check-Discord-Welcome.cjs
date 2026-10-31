'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const runtime=require('node:module').createRequire(require.resolve('wrangler'));
const {Miniflare,convertV4MiniflareOptions}=runtime('miniflare');
const {chromium}=require('playwright');
module.exports=async function(){
 const root=path.resolve(__dirname,'..'),{configureWelcome,syncWelcomes,welcomeCommand}=await import('../license-server/cloudflare/discord-welcome.mjs');
 const {welcomeHtml,renderWelcome,WELCOME_ORIGIN,WELCOME_ASSET}=await import('../license-server/cloudflare/welcome-card.mjs');
 const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:'export default {fetch(){return new Response("ok")}}',compatibilityDate:'2026-10-23',d1Databases:{DB:'welcome-test'}}));
 const original=global.fetch;let browser;
 try{
  const DB=await mf.getD1Database('DB');await DB.exec(fs.readFileSync(path.join(root,'license-server/cloudflare/migrations/0006_discord_welcome.sql'),'utf8').replace(/\s+/g,' '));
  const guild='222222222222222222',owner='333333333333333333',channel='444444444444444444',app='111111111111111111';
  const member=(id,offset=60000,extra={})=>({user:{id,username:'Tester',...extra.user},joined_at:new Date(Date.now()+offset).toISOString(),...extra});
  const old=member(owner,-600000),fresh=member('555555555555555555');let members=[old],mode='',renders=0;
  const sent=[],png=new Uint8Array([137,80,78,71,13,10,26,10]);
  const env={DB,DISCORD_GUILD_ID:guild,DISCORD_OWNER_ID:owner,DISCORD_APPLICATION_ID:app,DISCORD_BOT_TOKEN:'test',BROWSER:{quickAction:async(action,data)=>{assert.equal(action,'screenshot');assert.ok(data.html.includes('WITAJ!'));renders++;return new Response(png)}}};
  env.ASSETS={fetch:async()=>new Response(fs.readFileSync(path.join(root,'license-server/public/discord/welcome-background.jpg')))};
  global.fetch=async(url,init={})=>{
   const u=new URL(url);assert.equal(u.hostname,'discord.com');
   if(u.pathname.endsWith('/messages')){
    if(mode==='429')return Response.json({retry_after:120},{status:429});
    if(mode==='network')throw Error('lost response');
    const payload=JSON.parse(init.body instanceof FormData?init.body.get('payload_json'):init.body);sent.push(payload);
    assert.deepEqual(payload.allowed_mentions,{parse:[],users:[fresh.user.id]});
    return Response.json({id:'666666666666666666'});
   }
   if(u.pathname.endsWith('/roles'))return Response.json([{id:guild,permissions:'8'}]);
   if(u.pathname.endsWith('/members/'+app))return Response.json({roles:[]});
   if(u.pathname.endsWith('/channels/'+channel))return Response.json({id:channel,guild_id:guild,type:0});
   if(u.pathname.endsWith('/members'))return mode==='intent'?Response.json({},{status:403}):Response.json(members);
   throw Error('Unexpected API request '+u.pathname);
  };
  assert.match(await welcomeCommand(env,{member:{user:{id:fresh.user.id}}},{akcja:'wlacz',kanal:channel}),/tylko właściciel/);
  mode='intent';await assert.rejects(()=>configureWelcome(env,{enabled:true,channelId:channel}),/Server Members Intent/);mode='';
  await configureWelcome(env,{enabled:true,channelId:channel});await syncWelcomes(env);assert.equal(sent.length,0,'Do not welcome existing members');
  members=[old,{...fresh,pending:true},member('777777777777777777',60000,{user:{id:'777777777777777777',bot:true}})];
  await syncWelcomes(env);assert.equal(sent.length,0,'Skip bots and pending screening');
  members=[old,fresh];await Promise.all([syncWelcomes(env),syncWelcomes(env)]);assert.equal(sent.length,1,'Only one concurrent send');
  await syncWelcomes(env);assert.equal(sent.length,1,'No duplicate on next poll');assert.equal(renders,1);
  assert.match(sent[0].embeds[0].image.url,/attachment:/);
  fresh.joined_at=new Date(Date.now()+120000).toISOString();await syncWelcomes(env);assert.equal(sent.length,2,'Rejoin has a distinct event');
  fresh.joined_at=new Date(Date.now()+180000).toISOString();mode='429';await syncWelcomes(env);assert.equal((await DB.prepare('SELECT next_attempt FROM discord_welcome_config').first()).next_attempt>Date.now()+100000,true);
  mode='';await syncWelcomes(env);assert.equal(sent.length,2,'Respect retry-after');
  await DB.prepare('UPDATE discord_welcome_config SET next_attempt=0').run();env.BROWSER.quickAction=async()=>new Response(null,{status:429});await syncWelcomes(env);assert.equal(sent.length,3);assert.equal(sent[2].embeds[0].image.url,WELCOME_ORIGIN+WELCOME_ASSET,'Fallback when free rendering quota is exceeded');
  fresh.joined_at=new Date(Date.now()+240000).toISOString();mode='network';await syncWelcomes(env);assert.equal((await DB.prepare("SELECT COUNT(*) AS n FROM discord_welcome_events WHERE state='uncertain'").first()).n,1);
  mode='';await DB.prepare('UPDATE discord_welcome_config SET next_attempt=0').run();await syncWelcomes(env);assert.equal(sent.length,3,'Never retry an ambiguous write');
  await configureWelcome(env,{enabled:false});fresh.joined_at=new Date(Date.now()+300000).toISOString();await syncWelcomes(env);assert.equal(sent.length,3,'Disable stops sending');
  const malicious={user:{id:owner,username:'<img src=x onerror=alert(1)>',avatar:'../../evil'}};
  const html=welcomeHtml(malicious,23);assert.ok(!html.includes('<img src=x'));assert.ok(!html.includes('../../evil'));assert.ok(html.includes('&lt;img'));
  await assert.rejects(()=>renderWelcome({},old,1),/browser-not-configured/);
  // Preview uses the same HTML as the production renderer, with local assets.
  global.fetch=original;browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1200,height:480}});
  await page.route(WELCOME_ORIGIN+WELCOME_ASSET,route=>route.fulfill({path:path.join(root,'license-server/public/discord/welcome-background.png'),contentType:'image/png'}));
  const avatar='<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#342057"/><circle cx="128" cy="96" r="42" fill="#d2b3ff"/><path d="M40 240v-30a88 70 0 0 1 176 0v30" fill="#ae7cf1"/></svg>';
  await page.route('https://cdn.discordapp.com/**',route=>route.fulfill({body:avatar,contentType:'image/svg+xml'}));
  await page.setContent(welcomeHtml({user:{id:owner,username:'Nowy użytkownik'}},24),{waitUntil:'networkidle'});
  assert.equal(await page.locator('.name').innerText(),'Nowy użytkownik');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),1200);
  fs.mkdirSync(path.join(root,'test-results'),{recursive:true});await page.screenshot({path:path.join(root,'test-results/discord-welcome-preview.png')});
  console.log('Welcome: real D1, initial baseline, screening/bots, concurrency, rejoin, rate limits, uncertain writes, rendering fallback, disable and escaped card preview passed.');
 }finally{global.fetch=original;await browser?.close();await mf.dispose()}
};
if(require.main===module)module.exports().catch(e=>{console.error(e);process.exitCode=1});
