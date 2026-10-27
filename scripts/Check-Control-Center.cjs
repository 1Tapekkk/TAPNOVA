// End-to-end checks with a synthetic account. External game traffic is blocked.
const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const files=['locales-pl.js','control-core.js','control-center.js','panel-ui.js','app.js'];
(async()=>{
  const browser=await chromium.launch({headless:true});
  try{
    const page=await browser.newPage({viewport:{width:1000,height:950},acceptDownloads:true});
    const errors=[];let writes=0;
    page.on('pageerror',error=>{errors.push(error.message);console.error('PAGE ERROR',error.message)});
    await page.route('**/*',route=>{
      const url=new URL(route.request().url());
      if(url.origin!=='https://tapnova-preview.invalid')return route.abort();
      if(url.pathname==='/mock-write'){writes++;return route.fulfill({body:'{}',contentType:'application/json'})}
      if(url.pathname==='/')return route.fulfill({contentType:'text/html',body:'<!doctype html><meta charset="utf-8"><body style="background:#0b0b11">'+files.map(file=>`<script src="/${file}"></script>`).join('')});
      const file=url.pathname.slice(1);if(!files.includes(file))return route.abort();
      let source=fs.readFileSync(path.join(root,'Resources/Extension',file),'utf8');
      if(file==='app.js')source=source.replace('function tnText(value)','window.__tcTest={get controls(){return tnControls},get gate(){return tnGate},get state(){return ce},get afk(){return __afkState},get sockets(){return On},run:_o,get sleep(){return dn},get request(){return cn},incoming:oo,lang:le,select:sd,rebuild:Bd};function tnText(value)');
      return route.fulfill({contentType:'text/javascript',body:source});
    });
    const mount=async()=>{
      await page.goto('https://tapnova-preview.invalid/');
      await page.waitForFunction(()=>window.__tcTest&&window.__xbMountPanel);
      await page.evaluate(()=>{window.__xbPlayAt=Date.now();window.__xbMountPanel();const s=window.__tcTest.state;s.accessToken='offline-test';s.profileId='00000000000000000000000000000000';s.profileName='Tester';window.__tcTest.rebuild()});
      await page.waitForFunction(()=>window.__xbPanel?.isConnected);
    };
    const element=async selector=>(await page.evaluateHandle(selector=>window.__xbPanel.querySelector(selector),selector)).asElement();
    const click=async selector=>{const handle=await element(selector);assert.ok(handle,selector);await handle.click();await handle.dispose()};
    const clickText=async(text,scope='.tnc-center')=>{
      const handle=(await page.evaluateHandle(({text,scope})=>[...window.__xbPanel.querySelectorAll(scope+' button')].find(button=>button.textContent===text),{text,scope})).asElement();
      assert.ok(handle,'Missing '+text);await handle.click();await handle.dispose();
    };
    const text=()=>page.evaluate(()=>window.__xbPanel.querySelector('.tnc-center').innerText);
    await mount();
    await click('[data-tnc-help]');
    let search=await element('.tnc-search');await search.fill('worker');
    assert.match(await text(),/Równoległe zadania i paczki/);
    await search.fill('żaden-wynik');assert.match(await text(),/Brak wyników/);
    await search.press('Escape');assert.equal(await page.evaluate(()=>window.__xbPanel.querySelector('.tnc-center').hidden),true);
    await click('[data-tnc-presets]');
    const input=await element('#tnc-new-name');await input.fill('Mój zestaw');await input.press('Enter');
    assert.match(await text(),/Zapisano zestaw/);
    await (await element('#tnc-new-name')).fill('Mój zestaw');await clickText('Zapisz');
    assert.match(await text(),/już istnieje/);
    const original=await page.evaluate(()=>window.__tcTest.controls.capture());
    await page.evaluate(()=>{const card=[...window.__xbPanel.querySelectorAll('.tnc-card')].find(card=>card.textContent.includes('Mały ekran'));card.querySelector('button').click()});
    assert.match(await text(),/Kompaktowy panel/);
    await click('[data-tnc-apply]');
    assert.equal(await page.evaluate(()=>window.__tcTest.state.ui.compact),true);
    await click('[data-tnc-undo]');
    assert.deepEqual(await page.evaluate(()=>window.__tcTest.controls.capture()),original);
    await page.evaluate(()=>{const card=window.__xbPanel.querySelector('[data-tnc-set="Mój zestaw"]');[...card.querySelectorAll('button')].find(b=>b.textContent==='Zmień nazwę').click()});
    await (await element('[data-tnc-set="Mój zestaw"] input')).fill('Wieczór');await clickText('Zapisz nazwę');
    await page.evaluate(()=>{const card=window.__xbPanel.querySelector('[data-tnc-set="Wieczór"]');[...card.querySelectorAll('button')].find(b=>b.textContent==='Usuń').click()});
    await clickText('Usuń');assert.match(await text(),/Usunięto zestaw/);
    await clickText('↶ Przywróć usunięty zestaw');assert.match(await text(),/Wieczór/);
    const upload=async data=>{await(await element('.tnc-file')).setInputFiles({name:'settings.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))})};
    const doc=settings=>({format:'tapnova-settings',version:1,presets:[{name:'Import test',settings}]});
    await upload(doc({password:'not-allowed'}));await page.waitForFunction(()=>window.__xbPanel.querySelector('.tnc-error'));assert.match(await text(),/nieobsługiwane ustawienia/);
    await upload(doc({th:'blue',uis:'0'}));await page.waitForFunction(()=>window.__xbPanel.querySelector('.tnc-center').innerText.includes('Zestawy do importu'));assert.match(await text(),/Zestawy do importu/);
    assert.equal(await page.evaluate(()=>window.__tapnovaControl.createStore(localStorage).read().length),1);
    await clickText('Dodaj te zestawy');assert.equal(await page.evaluate(()=>window.__tapnovaControl.createStore(localStorage).read().length),2);
    const downloadEvent=page.waitForEvent('download');await clickText('Eksportuj JSON');const download=await downloadEvent;
    const exported=JSON.parse(fs.readFileSync(await download.path(),'utf8'));
    assert.equal(exported.presets.length,2);assert.ok(exported.presets.every(item=>Object.keys(item.settings).every(key=>Object.hasOwn(original,key))));

    // A queued multi-step operation must not send a write after STOP, even when unlock is requested immediately.
    await page.evaluate(()=>{
      const api=window.__tcTest;window.__queuedDone=false;
      window.__queued=api.run('quests',async()=>{await api.sleep(30,30);await api.request('/mock-write',{method:'POST'})}).finally(()=>window.__queuedDone=true);
      api.state.quizBot.enabled=true;api.state.dressUpBot.enabled=true;api.state.autographer.running=true;api.afk.on=true;api.afk.dm=true;api.state.misc.autoLiker=true;api.state.dmSpamGuard.enabled=true;
    });
    await click('[data-tnc-stop]');await page.waitForFunction(()=>window.__queuedDone);
    assert.equal(writes,0,'Cancelled action must not write');
    const stopped=await page.evaluate(()=>({state:window.__tcTest.controls.activity(),quiz:window.__tcTest.state.quizBot.enabled,dress:window.__tcTest.state.dressUpBot.enabled,afk:window.__tcTest.afk.on,protection:window.__tcTest.state.dmSpamGuard.enabled,paused:JSON.parse(localStorage.getItem('_xb_prefs_v1')).tnPaused}));
    assert.equal(stopped.state.paused,true);assert.equal(stopped.state.items.length,0);
    assert.equal(stopped.quiz||stopped.dress||stopped.afk||stopped.protection,false);assert.equal(stopped.paused,'1');
    await page.waitForFunction(()=>!window.__xbPanel.querySelector('[data-tnc-stop]').disabled);
    await click('[data-tnc-stop]');assert.equal(await page.evaluate(()=>window.__tcTest.controls.activity().paused),false);
    assert.equal(await page.evaluate(()=>window.__tcTest.controls.activity().items.length),0,'Unlock never restarts automation');

    // A sleeping WebSocket bot cannot fire a stale answer after STOP and unlock.
    await page.evaluate(()=>{
      const api=window.__tcTest;window.__sent=[];
      const socket={readyState:1,send:message=>window.__sent.push(message)};
      api.sockets.set(socket,{isQuiz:true});api.state.quizBot.enabled=true;
      window.__answerDone=false;window.__answer=api.incoming(socket,'42["quiz:question",{"question":"offline-test","answers":[]}]').finally(()=>window.__answerDone=true);
      api.controls.stop();api.controls.resume();
    });
    await page.waitForFunction(()=>window.__answerDone);
    assert.deepEqual(await page.evaluate(()=>window.__sent),[],'Stale quiz answer must not reach WebSocket');
    await page.evaluate(()=>window.__tcTest.controls.stop());await mount();
    assert.equal(await page.evaluate(()=>window.__tcTest.controls.activity().paused),true,'Pause survives reload');
    assert.equal(await page.evaluate(()=>window.__tapnovaControl.createStore(localStorage).read().length),2,'Sets survive reload');
    await page.evaluate(()=>window.__tcTest.controls.resume());
    await page.evaluate(()=>window.__tcTest.lang('en',{silent:true}));
    assert.match(await page.evaluate(()=>window.__xbPanel.querySelector('.tnc-bar').innerText),/Settings sets/);
    await page.evaluate(()=>window.__tcTest.lang('pl',{silent:true}));
    if(await page.evaluate(()=>window.__xbPanel.querySelector('.tnc-center').hidden))await click('[data-tnc-presets]');
    await page.setViewportSize({width:390,height:850});
    const layout=await page.evaluate(()=>{const p=window.__xbPanel;p.style.left='auto';p.style.right='12px';p.style.top='12px';const c=p.querySelector('.tn-content');c.scrollTop=0;return{overflow:c.scrollWidth-c.clientWidth,right:p.getBoundingClientRect().right}});
    assert.ok(layout.overflow<=1);assert.ok(layout.right<=390);
    if(process.env.TAPNOVA_CONTROL_SCREENSHOT)await page.screenshot({path:process.env.TAPNOVA_CONTROL_SCREENSHOT,animations:'disabled'});
    assert.deepEqual(errors,[]);
    console.log('PASS: search, keyboard, presets CRUD, preview/apply/undo, validated import/export, queue cancellation, all automation off, stale WebSocket blocked, reload persistence, language switch, narrow layout.');
  }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
