// Real keyboard events in a closed ShadowRoot, with hostile Unity-like capture
// handlers. External traffic is always blocked; no real game actions are used.
const {chromium} = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname,'..');
const files = ['locales-pl.js','control-core.js','control-center.js','panel-ui.js','app.js'];
(async()=>{
  const browser=await chromium.launch({headless:true});
  try {
    const page=await browser.newPage({viewport:{width:1100,height:950},permissions:['clipboard-read','clipboard-write']});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/*',route=>{
      const url=new URL(route.request().url());
      if(url.origin!=='https://tapnova-preview.invalid')return route.abort();
      if(url.pathname==='/')return route.fulfill({contentType:'text/html',body:'<!doctype html><meta charset="utf-8"><body><canvas tabindex="0"></canvas>'+files.map(f=>`<script src="/${f}"></script>`).join('')});
      const file=url.pathname.slice(1);if(!files.includes(file))return route.abort();
      let source=fs.readFileSync(path.join(root,'Resources/Extension',file),'utf8');
      if(file==='app.js')source=source.replace('function tnText(value)','window.__keyboardTest={select:sd,rebuild:Bd,renderAutograph:Ns,get state(){return ce}};function tnText(value)');
      return route.fulfill({contentType:'text/javascript',body:source});
    });
    await page.goto('https://tapnova-preview.invalid/');
    await page.waitForFunction(()=>window.__keyboardTest&&window.__xbMountPanel);
    await page.evaluate(()=>{
      window.__xbPlayAt=Date.now();window.__xbMountPanel();
      const state=window.__keyboardTest.state;state.accessToken='offline-test';state.profileId='00000000000000000000000000000000';state.profileName='Tester';window.__keyboardTest.rebuild();window.__keyboardTest.select('bots');
      [...window.__xbPanel.querySelectorAll('button')].find(b=>b.textContent.trim()==='Otwórz panel autografu').click();
      window.gameKeys=0;
      // Unity typically registers document capture handlers after document start.
      document.addEventListener('keydown',e=>{window.gameKeys++;e.preventDefault();},true);
    });
    await page.waitForFunction(()=>window.__keyboardTest.state.autographer.vipChecked);
    let field=(await page.evaluateHandle(()=>window.__xbPanel.getRootNode().querySelector('[data-ag-search]'))).asElement();
    assert.ok(field,'Autograph nickname field exists');
    await field.click();await page.keyboard.type('Nick gracza_42');
    assert.equal(await field.inputValue(),'Nick gracza_42','Native typing survives game capture');
    await page.evaluate(()=>window.__keyboardTest.renderAutograph());
    field=(await page.evaluateHandle(()=>window.__xbPanel.getRootNode().querySelector('[data-ag-search]'))).asElement();
    await page.keyboard.type('x');
    assert.equal(await field.inputValue(),'Nick gracza_42x','Membership/status redraw preserves focus and caret');
    await page.keyboard.press('ControlOrMeta+A');await page.keyboard.type('NowyNick');
    assert.equal(await field.inputValue(),'NowyNick');
    await page.keyboard.press('Backspace');assert.equal(await field.inputValue(),'NowyNic');
    await page.evaluate(()=>navigator.clipboard.writeText('Żółw_123'));
    await page.keyboard.press('ControlOrMeta+A');await page.keyboard.press('ControlOrMeta+V');
    assert.equal(await field.inputValue(),'Żółw_123','Clipboard shortcuts retain native behavior');
    await page.evaluate(()=>{
      const input=window.__xbPanel.getRootNode().querySelector('[data-ag-search]');
      window.enterCount=0;input.addEventListener('keydown',e=>{if(e.key==='Enter')window.enterCount++;});
    });
    // Empty search prevents a network action but still exercises real Enter handlers.
    await page.keyboard.press('ControlOrMeta+A');await page.keyboard.press('Backspace');await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(()=>window.enterCount),1,'Enter reaches handlers exactly once');
    assert.equal(await page.evaluate(()=>window.gameKeys),0,'Game receives no UI keyboard events');
    await page.keyboard.press('Tab');
    assert.notEqual(await page.evaluate(()=>window.__xbPanel.getRootNode().activeElement?.dataset.agSearch),'1','Tab advances focus');
    await page.evaluate(()=>document.querySelector('canvas').focus());await page.keyboard.press('a');
    assert.equal(await page.evaluate(()=>window.gameKeys),1,'Game input resumes outside the panel');
    assert.equal(await page.locator('canvas').getAttribute('tabindex'),'0','Original game tab order survives field redraw');
    assert.deepEqual(errors,[]);
    console.log('PASS: autograph nickname typing, replacement, Backspace, Polish paste, Enter, Tab, closed shadow root, game isolation and restored game input.');
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
