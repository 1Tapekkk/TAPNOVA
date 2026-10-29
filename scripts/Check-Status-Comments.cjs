'use strict';
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'Resources/Extension/status-comments.js'),'utf8');
const scope={window:{},AbortController,DOMException};vm.runInNewContext(source,scope);
const sample=(id,author='p2',text='Komentarz')=>({commentId:id,author,text,created:'2026-10-28T10:00:00Z',deleted:false,profile:{id:author,name:'Autor '+author}});
function fixture(base='https://eu.mspapis.com',kind='status'){
  const state={token:'offline-token',profileId:'p1',base};
  const controller=new AbortController(),calls=[];
  const f={state,calls,controller,id:'status1',owner:'p1',items:[sample('c1'),sample('c2'),{...sample('c3'),deleted:true}],cursor:'',failure:null};
  const context={kind,session:()=>state,request:async(url,opts)=>{
    calls.push({url,opts});assert.equal(opts.headers.authorization,'Bearer offline-token');assert.equal(opts.redirect,'error');assert.equal(opts.credentials,'omit');
    let data;
    if(url.includes('/profileattributes/'))data={additionalData:{WAYD:'other-status',DefaultMyHome:f.id,...(kind==='status'?{WAYD:f.id}:{})}};
    else if(url.includes('/profilegeneratedcontent/'))data={owner:f.owner,type:'WAYD'};
    else {assert.equal(url,state.base+'/edgecomments/graphql');const body=JSON.parse(opts.body);const vars=body.variables;
      assert.equal(typeof vars,'object','GraphQL variables must be an object, not a JSON-encoded string');
      if(f.networkFailure)throw new TypeError('Failed to fetch');
      if(f.httpStatus)return {ok:false,status:f.httpStatus};
      if(f.invalidJSON)return {ok:true,json:async()=>{throw new SyntaxError('invalid response')}};
      if(body.query.includes('mutation')){f.onWrite?.(vars.commentId);data=f.failure||{data:{deleteComment:{success:true}}}}
      else data=f.readFailure||{data:{comments:{comments:f.items,cursor:f.cursor}}};
    }
    f.afterRequest?.();return {ok:true,json:async()=>data};
  }};
  f.client=scope.window.__tapnovaComments.createClient(context,controller.signal);return f;
}
const mutations=f=>f.calls.filter(c=>c.opts.body&&JSON.parse(c.opts.body).query.includes('mutation'));
async function serviceTests(){
  let f=fixture(),r=await f.client.load();assert.deepEqual(Array.from(r.items,x=>x.id),['c1','c2']);
  await assert.rejects(()=>f.client.remove(['unseen'],()=>{}),/selection/);assert.equal(mutations(f).length,0);
  const progress=[];await f.client.remove(['c1','c1','c2'],id=>progress.push(id));assert.deepEqual(progress,['c1','c2']);assert.equal(mutations(f).length,2);
  await assert.rejects(()=>f.client.remove(['c2'],()=>{}),/selection/);
  f=fixture();f.owner='other';await assert.rejects(()=>f.client.load(),/owner/);assert.equal(mutations(f).length,0);
  f=fixture();await f.client.load();f.id='status2';await assert.rejects(()=>f.client.remove(['c1'],()=>{}),/statusChanged/);assert.equal(mutations(f).length,0);
  f=fixture();await f.client.load();f.state.profileId='other';await assert.rejects(()=>f.client.remove(['c1'],()=>{}),/session/);assert.equal(mutations(f).length,0);
  f=fixture();f.afterRequest=()=>{f.state.token='changed'};await assert.rejects(()=>f.client.load(),/session/);assert.equal(f.calls.length,1);
  f=fixture();f.readFailure={errors:[{message:'denied'}]};await assert.rejects(()=>f.client.load(),/api/);
  f=fixture();f.httpStatus=400;await assert.rejects(()=>f.client.load(),error=>error.message==='server'&&error.diagnostic==='COMMENTS · HTTP 400');
  f=fixture();f.networkFailure=true;await assert.rejects(()=>f.client.load(),error=>error.message==='http'&&error.diagnostic==='COMMENTS · NETWORK');
  f=fixture();f.invalidJSON=true;await assert.rejects(()=>f.client.load(),error=>error.message==='api'&&error.diagnostic==='COMMENTS · JSON');
  f=fixture();f.readFailure={errors:[{message:'private server details',extensions:{code:'UNAUTHENTICATED'}}]};await assert.rejects(()=>f.client.load(),error=>error.message==='login'&&error.diagnostic==='COMMENTS · GRAPHQL');
  f=fixture();await f.client.load();f.failure={data:{deleteComment:{success:false}}};let count=0;await assert.rejects(()=>f.client.remove(['c1'],()=>count++),/delete/);assert.equal(count,0);
  f=fixture();await f.client.load();count=0;f.onWrite=id=>{if(id==='c2')f.failure={errors:[{message:'failure'}]}};
  await assert.rejects(()=>f.client.remove(['c1','c2'],()=>count++),/api/);assert.equal(count,1);await assert.rejects(()=>f.client.remove(['c2'],()=>{}),/selection/);
  f=fixture();f.cursor='next';await f.client.load();await assert.rejects(()=>f.client.load(true),/pagination/);
  f=fixture();f.cursor='next';await f.client.load();f.cursor='';f.items=[sample('c2'),sample('c4')];r=await f.client.load(true);assert.deepEqual(Array.from(r.items,x=>x.id),['c1','c2','c4']);
  f=fixture();await f.client.load();f.controller.abort();await assert.rejects(()=>f.client.remove(['c1'],()=>{}),{name:'AbortError'});assert.equal(mutations(f).length,0);
  f=fixture('https://msp2tool.lol');await assert.rejects(()=>f.client.load(),/region/);assert.equal(f.calls.length,0);
  f=fixture();await f.client.load();count=0;await assert.rejects(()=>f.client.remove(['c1','c2'],()=>{count++;f.controller.abort()}),{name:'AbortError'});assert.equal(count,1);assert.equal(mutations(f).length,1);
  f=fixture();await f.client.load();scope.window.__tapnovaExtras={prepareArchive(){throw Error('disk-full')}};
  await assert.rejects(()=>f.client.remove(['c1'],()=>{}),/archiveStorage/);assert.equal(mutations(f).length,0);
  scope.window.__tapnovaExtras={prepareArchive(){throw Error('archiveFull')}};
  f=fixture();await f.client.load();await assert.rejects(()=>f.client.remove(['c1'],()=>{}),/archiveFull/);assert.equal(mutations(f).length,0);
  delete scope.window.__tapnovaExtras;
  f=fixture(undefined,'home');await f.client.load();assert.equal(JSON.parse(f.calls.find(c=>c.opts.body).opts.body).variables.threadId,f.id);await f.client.remove(['c1'],()=>{});assert.equal(mutations(f).length,1);
  f=fixture(undefined,'home');await f.client.load();f.id='changed-home';await assert.rejects(()=>f.client.remove(['c1'],()=>{}),/homeChanged/);
  f=fixture(undefined,'home');f.owner='other';await assert.rejects(()=>f.client.load(),/owner/);
  f=fixture(undefined,'home');f.id='';await assert.rejects(()=>f.client.load(),/noHome/);
  console.log('PASS: own-status checks, pagination, stale sessions/status, GraphQL failures, confirmed writes, partial failure, cancellation, API host restriction.');
}
async function browserTests(){
  const browser=await chromium.launch({headless:true});
  try{
    const page=await browser.newPage({viewport:{width:1000,height:900}}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    let comments=[sample('c1','p2','<img src=x onerror=alert(1)>'),sample('c2','p3','Drugi komentarz')],writes=0,blockWrites=false,pages=null,readHTTPError=false;
    const files=['locales-pl.js','control-core.js','control-center.js','workspace-tools.js','status-comments.js','panel-ui.js','app.js'];
    await page.route('**/*',async route=>{
      const url=new URL(route.request().url());
      if(url.origin==='https://eu.mspapis.com'){
        let data;
        if(url.pathname.includes('/profileattributes/'))data={additionalData:{WAYD:'status1'}};
        else if(url.pathname.includes('/profilegeneratedcontent/'))data={owner:'p1',type:'WAYD'};
        else if(url.pathname==='/edgecomments/graphql'){
          const body=route.request().postDataJSON(),vars=body.variables;
          assert.equal(typeof vars,'object','Live API rejects stringified GraphQL variables');
          if(readHTTPError)return route.fulfill({status:400,body:'private server details'});
          if(body.query.includes('mutation')){
            writes++;if(blockWrites)return;comments=comments.filter(c=>c.commentId!==vars.commentId);data={data:{deleteComment:{success:true}}};
          }else data={data:{comments:pages?pages[vars.cursor]:{comments,cursor:''}}};
        }else return route.abort();
        return route.fulfill({contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(data)});
      }
      if(url.hostname==='cdn.moviestarplanet2.com'){
        if(url.pathname.endsWith('/version.txt'))return route.fulfill({body:'1',headers:{'access-control-allow-origin':'*'}});
        return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#282233"/><path d="M8 64c0-30 48-30 48 0" fill="#bb9ed6"/><ellipse cx="32" cy="27" rx="17" ry="22" fill="#dcc6b9"/><path d="M15 32C2 3 57-9 50 32L40 12 16 29" fill="#cbc1d7"/><circle cx="25" cy="28" r="2" fill="#33283c"/><circle cx="39" cy="28" r="2" fill="#33283c"/></svg>'});
      }
      if(url.origin!=='https://tapnova-preview.invalid')return route.abort();
      if(url.pathname==='/')return route.fulfill({contentType:'text/html',body:'<!doctype html><meta charset="utf-8">'+files.map(f=>`<script src="/${f}"></script>`).join('')});
      const file=url.pathname.slice(1);if(!files.includes(file))return route.abort();
      let js=fs.readFileSync(path.join(root,'Resources/Extension',file),'utf8');
      if(file==='app.js')js=js.replace('function tnText(value)','window.__commentsTest={get state(){return ce},get controls(){return tnControls},rebuild:Bd,select:sd};function tnText(value)');
      return route.fulfill({contentType:'text/javascript',body:js});
    });
    await page.routeWebSocket('**/*',socket=>socket.close());
    await page.goto('https://tapnova-preview.invalid/');
    await page.waitForFunction(()=>window.__commentsTest&&window.__xbMountPanel);
    await page.evaluate(()=>{window.__xbPlayAt=Date.now();window.__xbMountPanel();Object.assign(window.__commentsTest.state,{accessToken:'offline-token',profileId:'p1',profileName:'Tester'});window.__commentsTest.rebuild();window.__commentsTest.select('profile')});
    const element=async selector=>(await page.evaluateHandle(selector=>window.__xbPanel.querySelector(selector),selector)).asElement();
    const click=async selector=>{const e=await element(selector);assert.ok(e,selector);await e.click();await e.dispose()};
    const waitText=async text=>{try{await page.waitForFunction(text=>window.__xbPanel.querySelector('.tn-comments-status').textContent.includes(text),text,{timeout:7000})}catch(e){console.error('Comments state:',await page.evaluate(()=>window.__xbPanel.querySelector('.tn-comments').innerText),errors);throw e}};
    await click('[data-comments=open]');await waitText('Wczytano: 2');
    readHTTPError=true;await click('[data-comments=refresh]');await waitText('COMMENTS · HTTP 400');
    assert.equal(writes,0);assert.doesNotMatch(await page.evaluate(()=>window.__xbPanel.querySelector('.tn-comments-status').textContent),/private server details|offline-token|połączyć/);
    readHTTPError=false;await click('[data-comments=refresh]');await waitText('Wczytano: 2');
    assert.equal(await page.evaluate(()=>window.__xbPanel.querySelectorAll('.tn-comments-bubble img').length),0,'Comment HTML is plain text');
    await (await element('.tn-comments input[type=search]')).fill('Drugi');
    assert.equal(await page.evaluate(()=>window.__xbPanel.querySelectorAll('.tn-comments-item').length),1);
    await click('[data-comments=trash]');assert.equal(writes,0);
    assert.match(await page.evaluate(()=>window.__xbPanel.querySelector('.tn-comments-preview').textContent),/Drugi komentarz/);
    await click('[data-comments=cancel]');assert.equal(writes,0);
    await click('[data-comments=trash]');await click('[data-comments=confirm]');await waitText('Serwer potwierdził');assert.equal(writes,1);
    const archived=await page.evaluate(()=>JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k=>k.startsWith('_tn_archive_v1_')))));assert.equal(archived[0].id,'c2');assert.equal(archived[0].state,'deleted');
    await (await element('.tn-comments input[type=search]')).fill('');await click('[data-comments=refresh]');await waitText('Wczytano: 1');
    // Clean preview fixture: render the same two-card layout as the reference.
    comments=[{...sample('c1','p2','aaaaaaaaaaaa'),profile:{id:'p2',name:'xalviss',membership:{lastTierExpiry:'2099-01-01'}}},
      {...sample('c2','p3','O matko'),profile:{id:'p3',name:'99panda',membership:{lastTierExpiry:'2099-01-01'}}}];
    await click('[data-comments=refresh]');await waitText('Wczytano: 2');
    fs.mkdirSync(path.join(root,'test-results'),{recursive:true});
    await page.screenshot({path:path.join(root,'test-results/status-comments-desktop.png'),animations:'disabled'});
    await page.setViewportSize({width:390,height:800});
    await page.evaluate(()=>{const p=window.__xbPanel;p.style.left='auto';p.style.right='10px';p.style.top='10px'});
    const overflow=await page.evaluate(()=>{const e=window.__xbPanel.querySelector('.tn-comments-window');return e.scrollWidth-e.clientWidth});assert.ok(overflow<=1,'No horizontal overflow');
    await page.screenshot({path:path.join(root,'test-results/status-comments-390.png'),animations:'disabled'});
    await click('.tn-comments-item:nth-child(2) [data-comments=trash]');
    await page.waitForFunction(()=>{const e=window.__xbPanel.querySelector('.tn-comments-confirm');return e.open&&getComputedStyle(e).opacity==='1'});
    await page.screenshot({path:path.join(root,'test-results/status-comments-confirm-390.png'),animations:'disabled'});
    // Native modal focus remains in the confirmation, including Shift+Tab wrap.
    await (await element('[data-comments=cancel]')).press('Shift+Tab');
    assert.equal(await page.evaluate(()=>window.__xbPanel.getRootNode().activeElement?.dataset.comments),'author');
    await (await element('[data-comments=author]')).press('Escape');
    assert.equal(await page.evaluate(()=>window.__xbPanel.querySelector('.tn-comments-confirm').open),false);
    assert.equal(await page.evaluate(()=>window.__xbPanel.querySelector('.tn-comments-window').open),true);
    await click('[data-comments=trash]');await click('[data-comments=author]');assert.equal(writes,1);
    assert.match(await page.evaluate(()=>window.__xbPanel.querySelector('.tn-comments-question').textContent),/wszystkie/);
    await click('[data-comments=cancel]');
    // Author action reads all pages and previews exact scope before any mutation.
    pages={'':{comments:[sample('c4','p2','Pierwsza strona')],cursor:'next'},next:{comments:[sample('c5','p2','Druga strona'),sample('c6','p3','Inny autor')],cursor:''}};
    await click('[data-comments=refresh]');await waitText('Wczytano: 1');await click('[data-comments=trash]');await click('[data-comments=author]');
    await page.waitForFunction(()=>window.__xbPanel.querySelector('.tn-comments-confirm').open);
    assert.equal(writes,1,'Author preview does not delete');
    assert.match(await page.evaluate(()=>window.__xbPanel.querySelector('.tn-comments-preview').textContent),/Druga strona/);
    assert.doesNotMatch(await page.evaluate(()=>window.__xbPanel.querySelector('.tn-comments-preview').textContent),/Inny autor/);
    await click('[data-comments=confirm]');await waitText('Serwer potwierdził usunięcie: 2');assert.equal(writes,3);pages=null;
    await click('[data-comments=close]');assert.equal(await page.evaluate(()=>window.__xbPanel.querySelector('.tn-comments-window').open),false);
    await click('[data-comments=open]');await waitText('Wczytano:');
    // Global STOP must abort an in-flight deletion and prevent later writes.
    comments=[sample('c1'),sample('c2')];await click('[data-comments=refresh]');await waitText('Wczytano: 2');
    await click('[data-comments=toggle]');await click('[data-comments=select]');await click('[data-comments=delete]');blockWrites=true;await click('[data-comments=confirm]');
    await page.waitForFunction(()=>window.__xbPanel.querySelector('.tn-comments [data-comments=stop]').hidden===false);
    for(let i=0;i<30&&writes<4;i++)await new Promise(r=>setTimeout(r,30));assert.equal(writes,4);
    await page.evaluate(()=>window.__commentsTest.controls.stop());await page.waitForFunction(()=>window.__commentsTest.controls.activity().pending===0);assert.equal(writes,4);
    // Session changes clear old account content without making another request.
    await page.evaluate(()=>{window.__commentsTest.state.profileId='p9';window.__tapnovaComments.sync()});
    assert.equal(await page.evaluate(()=>window.__xbPanel.querySelectorAll('.tn-comments-item').length),0);
    await page.evaluate(()=>{window.__xbPanel.querySelectorAll('dialog[open]').forEach(e=>e.close());window.__commentsTest.state.profileId='p1';window.__commentsTest.select('homes')});
    assert.equal(await page.evaluate(()=>Array.from(window.__xbPanel.querySelectorAll('.tn-comments-launch')).some(e=>e.textContent.includes('Komentarze domku'))),true);
    await page.evaluate(()=>window.__commentsTest.select('profile'));
    assert.equal(await page.evaluate(()=>Array.from(window.__xbPanel.querySelectorAll('.tn-comments-launch')).some(e=>e.textContent.includes('Komentarze statusu'))),true);
    assert.deepEqual(errors,[]);
    console.log('PASS: integrated status card, text escaping, search, selection, confirmation/cancel, author pagination, modal focus and Escape, deletion, mobile layout, global STOP and account clearing.');
  }finally{await browser.close()}
}
(async()=>{await serviceTests();await browserTests()})().catch(error=>{console.error(error);process.exitCode=1});
