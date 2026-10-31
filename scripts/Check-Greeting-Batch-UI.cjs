'use strict';
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const files=['locales-pl.js','control-core.js','control-center.js','workspace-tools.js','status-comments.js','panel-ui.js','app.js'];
(async()=>{
 const browser=await chromium.launch({headless:true});
 try {
  const page=await browser.newPage({viewport:{width:1100,height:950}}),calls=[],errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>{
   const request=route.request(),url=new URL(request.url());
   if(url.pathname==='/federationgateway/graphql'){
    const body=request.postDataJSON();calls.push(body.variables);
    return route.fulfill({contentType:'application/json',body:JSON.stringify({data:{greetings:{sendGreeting:{success:true,data:{nextGreetingSecondsRemaining:0}}}}})});
   }
   if(url.origin!=='https://tapnova-preview.invalid')return route.abort();
   if(url.pathname==='/')return route.fulfill({contentType:'text/html',body:'<!doctype html><meta charset="utf-8"><body>'+files.map(f=>`<script src="/${f}"></script>`).join('')});
   const file=url.pathname.slice(1);if(!files.includes(file))return route.abort();
   let source=fs.readFileSync(path.join(root,'Resources/Extension',file),'utf8');
   if(file==='app.js')source=source.replace('function tnText(value)','window.__batchTest={open:()=>{Us();Rs.style.display="flex"},render:Ns,get state(){return ce},body:()=>Pc.agFloatBody,buttons:()=>[...Pc.agFloatBody.querySelectorAll("button")]};function tnText(value)');
   return route.fulfill({contentType:'text/javascript',body:source});
  });
  await page.goto('https://tapnova-preview.invalid/');
  await page.waitForFunction(()=>window.__batchTest);
  assert.deepEqual(errors,[]);
  await page.evaluate(()=>{
   const api=window.__batchTest;api.state.accessToken='offline-test';api.state.profileId='self';
   api.state.chatroomUsers=new Map([['self',{name:'Me'}],['alice',{name:'Alice'}],['bob',{name:'Bob'}]]);
   api.state.autographer.instantMode=true;api.open();
  });
  await page.waitForFunction(()=>window.__batchTest.state.autographer.vipChecked);
  const clickButton=async text=>{
   const handle=await page.evaluateHandle(text=>window.__batchTest.buttons().find(b=>b.textContent.includes(text)),text);
   const el=handle.asElement();assert.ok(el,`Missing button: ${text}; ${await page.evaluate(()=>window.__batchTest.buttons().map(b=>b.textContent).join(" | "))}`);await el.click();
  };
  await clickButton('Wyślij do wszystkich');
  await page.waitForFunction(()=>window.__batchTest.state.autographer.greetingAllProgress===2&&!window.__batchTest.state.autographer.greetingAllRunning);
  assert.deepEqual(calls.map(x=>[x.greetingType,x.receiverProfileId]),[['Autograph','alice'],['Autograph','bob']]);
  await clickButton('Halloween Greeting');
  let confirmation='';page.once('dialog',async dialog=>{confirmation=dialog.message();await dialog.accept()});
  await clickButton('Wyślij do wszystkich');
  await page.waitForFunction(()=>window.__batchTest.state.autographer.greetingAllSummary?.startsWith('Halloween Greeting')&&!window.__batchTest.state.autographer.greetingAllRunning);
  assert.match(confirmation,/2 Diax/);
  assert.deepEqual(calls.slice(2).map(x=>[x.greetingType,x.receiverProfileId]),[['HalloweenGreeting','alice'],['HalloweenGreeting','bob']]);
  assert.ok(calls.every(x=>x.ignoreDailyCap===false));assert.deepEqual(errors,[]);
  const progress=()=>page.evaluate(()=>{const el=window.__batchTest.body().querySelector('progress');return {value:el?.value,max:el?.max,label:el?.getAttribute('aria-label')}});
  assert.equal((await progress()).value,2);assert.equal((await progress()).label,'Postęp kolejki autografów');
  await page.evaluate(()=>{const a=window.__batchTest.state.autographer;a.greetingAllTotal=100;a.greetingAllProgress=25;a.greetingAllErrors=5;a.greetingAllRunning=true;window.__batchTest.render()});
  assert.equal((await progress()).value,30);assert.equal((await progress()).max,100);
  assert.match(await page.evaluate(()=>window.__batchTest.body().textContent),/Pozostało 70.*Błędy 5/);
  await page.screenshot({path:path.join(root,'test-results/greeting-batch-4.2.2.png')});
  console.log('PASS: actual Send to all button sends normal and Halloween greetings to every room recipient, with cost confirmation and no daily-cap bypass.');
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
