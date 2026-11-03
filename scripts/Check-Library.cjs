'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));await page.route(/^https?:/,r=>r.abort());
  await page.addInitScript(()=>{window.calls=[];window.tapnova={platform:'win32',onStatus:()=>{},onUpdate:()=>{},onAccount:f=>window.accountChanged=f,command:async(name,value)=>{window.calls.push({name,value});if(name==='account-login')return {ok:true,active:true,phase:'active',username:value.username,region:value.region};if(name==='account-status'||name==='account-logout')return {phase:'signed-out',active:false};return {ok:true}}}});
  await page.goto(require('node:url').pathToFileURL(path.resolve(__dirname,'../desktop/index.html')).href);
  assert.equal(await page.locator('.tool-card:visible').count(),10);
  await page.locator('[data-tool-filter=social]').click();assert.equal(await page.locator('.tool-card:visible').count(),3);
  await page.locator('#tool-search').fill('nieistniejace');assert.equal(await page.locator('#tool-empty').isVisible(),true);
  await page.locator('#tool-reset').click();await page.locator('#tool-search').fill('spolecznosc');assert.equal(await page.locator('.tool-card:visible').count(),3);
  await page.locator('#tool-search').fill('Halloween');await page.locator('[data-tool=bots]').click();
  assert.equal(await page.locator('#tool-dialog').isVisible(),true);await page.keyboard.press('Escape');assert.equal(await page.locator('#tool-dialog').isVisible(),false);
  await page.locator('[data-tool=bots]').click();await page.locator('#tool-open').click();assert.ok(await page.evaluate(()=>window.calls.some(c=>c.name==='tab'&&c.value==='bots')));
  await page.locator('#tool-search').fill('');await page.locator('#account-open').click();
  await page.locator('#account-username').fill('Gracz testowy');await page.locator('#account-password').fill('fixture-password');await page.locator('#account-submit').click();
  assert.equal(await page.locator('#account-dialog').isVisible(),false);assert.equal(await page.locator('#account-password').inputValue(),'');assert.match(await page.locator('#account-open').innerText(),/Gracz testowy/);
  await page.locator('#account-open').click();await page.locator('#account-logout').click();assert.equal(await page.locator('#account-fields').isVisible(),true);await page.locator('#account-close').click();
  await page.locator('.nav-item[data-page=home]').click();
  await page.evaluate(()=>{displayStatus({kind:'idle',text:'Gotowe do pracy'});displayUpdate({phase:'current',installed:'4.3.0',automatic:true})});
  fs.mkdirSync(path.resolve(__dirname,'../test-results'),{recursive:true});
  for(const width of [1440,960]){await page.setViewportSize({width,height:1000});assert.ok(await page.evaluate(()=>document.querySelector('#main').scrollWidth<=document.querySelector('#main').clientWidth));await page.screenshot({path:path.resolve(__dirname,`../test-results/library-${width}.png`)})}
  assert.deepEqual(errors,[]);console.log('PASS: library search, categories, empty state, modal/Escape, real tab dispatch, login form/secret clearing, logout and responsive layout.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
