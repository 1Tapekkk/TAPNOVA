'use strict';
const { app, BrowserWindow, WebContentsView, ipcMain, dialog, Menu, session, net, shell, safeStorage } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { GAME_URL, isGameURL, tabs } = require('./policy.cjs');
const takePhoto = require('./photo.cjs').createPhotographer();
const {createUpdates,windowsEngine,RELEASES}=require('./updates.cjs');
const smoke = process.argv.includes('--smoke-test');
const resources = app.isPackaged ? path.join(process.resourcesPath,'extension') : path.join(__dirname,'../Resources/Extension');
const shellURL = pathToFileURL(path.join(__dirname,'index.html')).href;
const packCache = new Map();
let win, game, gameSession, visible = false, loaded = false, busy = false;
let lastStatus = { kind:'idle', text:'Gotowe do gry' };
let updates;
let license;
app.setName('TAPNOVA');
// A separate profile avoids corrupting or exporting the legacy WebView2 profile.
app.setPath('userData', smoke ? path.join(require('node:os').tmpdir(),'tapnova-test-'+process.pid) : path.join(app.getPath('appData'),'TAPNOVA'));
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.show(); win.focus(); } });
  app.whenReady().then(createWindow).catch(error => { if(smoke) console.error(error); else dialog.showErrorBox('TAPNOVA', error.message); app.quit(); });
}

function status(kind, text) {
  lastStatus = { kind, text };
  if (win && !win.isDestroyed()) win.webContents.send('tapnova:status', lastStatus);
}
function layout() {
  if (!win || !game || !visible) return;
  const [width,height] = win.getContentSize();
  game.setBounds({x:216,y:88,width:Math.max(1,width-216),height:Math.max(1,height-118)});
}
function showGame(show) {
  if (show === visible) return;
  visible = show;
  if (show) { win.contentView.addChildView(game); layout(); game.webContents.focus(); }
  else { win.contentView.removeChildView(game); win.webContents.focus(); }
}
async function startGame() {
  if (smoke) { status('idle','Podgląd offline — połączenia z grą wyłączone'); return; }
  if(!license?.isActive()){status('error','Aktywuj TAPNOVA prawidłową licencją.');return}
  if (busy) return;
  if (!loaded) {
    busy = true;
    status('loading','Ładowanie MovieStarPlanet 2…');
    try { await game.webContents.loadURL(GAME_URL); loaded = true; status('ready','Gra otwarta · zaloguj się w MSP2'); }
    catch { status('error','Nie udało się wczytać gry. Sprawdź internet i ponów.'); }
    finally { busy = false; }
  }
  if (loaded) showGame(true);
}
async function photograph() {
  if (!loaded || !visible || !game || game.webContents.isDestroyed()) {
    status('idle','Najpierw otwórz grę.');return {ok:false};
  }
  const wc=game.webContents;
  try {
    const result=await takePhoto({webContents:wc,valid:()=>visible&&game?.webContents===wc,
      countdown:n=>status('ready',`Zdjęcie za ${n}… Panel TAPNOVA zostanie ukryty.`),
      chooseFile:()=>dialog.showSaveDialog(win,{title:'Zapisz zdjęcie gry',defaultPath:path.join(app.getPath('pictures'),'TAPNOVA-'+new Date().toISOString().replace(/[:.]/g,'-')+'.png'),filters:[{name:'Obraz PNG',extensions:['png']}]}),
      writeFile:(file,bytes)=>fs.writeFile(file,bytes)
    });
    if(!result.busy)status('ready',result.ok?'Zdjęcie zapisane.': 'Anulowano zapis zdjęcia.');
    return result;
  } catch { status('error','Nie udało się zapisać zdjęcia. Panel został przywrócony.');return {ok:false}; }
}
async function pack(name) {
  if (!['d1','d2','d3'].includes(name)) throw Error('Unknown data pack');
  if (!packCache.has(name)) packCache.set(name, fs.readFile(path.join(resources,name+'.json'),'utf8').then(JSON.parse).catch(error => { packCache.delete(name); throw error; }));
  return packCache.get(name);
}
async function extensionMessage(event, message) {
  if (event.sender !== game?.webContents || !isGameURL(event.senderFrame?.url) || !message || typeof message !== 'object') return {ok:false};
  try {
    switch (message.type) {
      case 'xb:boot': return {ok:true,homes:[],questions:{},emojis:null,deferred:true};
      case 'xb:injectMain': return {ok:true}; // Installed at document start through CDP.
      case 'xb:catalog': {
        const [homes,questions] = await Promise.all([pack('d1'),pack('d2')]);
        return {ok:true,homes:homes.map(h=>({name:h.name,bundled:true,hasBson:!!h.bson_data,hasImg:!!h.img,img:''})),questions};
      }
      case 'xb:home': {
        if (typeof message.name !== 'string' || message.name.length > 256) return {ok:false};
        const home = (await pack('d1')).find(h=>h.name===message.name);
        return home ? {ok:true,home:{...home,bundled:true}} : {ok:false,error:'home-not-found'};
      }
      case 'xb:pack': return {ok:true,emojis:await pack('d3')};
      case 'xb:prefetch': {
        const names = Array.isArray(message.packs) ? message.packs : ['d1','d2'];
        await Promise.all(names.filter(n=>['d1','d2','d3'].includes(n)).map(pack));
        return {ok:true};
      }
      case 'xb:input': {
        if (['attach','detach'].includes(message.op)) return {ok:true,via:'desktop'};
        if (message.op !== 'click') return {ok:false,error:'unsupported-op'};
        // Restrict synthetic pointer operations to the displayed game and main frame.
        const {x,y} = message, bounds = game.getBounds();
        if (!visible || event.senderFrame !== game.webContents.mainFrame || !Number.isFinite(x) || !Number.isFinite(y) || x<0 || y<0 || x>=bounds.width || y>=bounds.height) return {ok:false,error:'invalid-point'};
        game.webContents.sendInputEvent({type:'mouseDown',x:Math.round(x),y:Math.round(y),button:'left',clickCount:1});
        game.webContents.sendInputEvent({type:'mouseUp',x:Math.round(x),y:Math.round(y),button:'left',clickCount:1});
        return {ok:true,via:'desktop'};
      }
      default: return {ok:false,error:'unsupported-message'};
    }
  } catch { return {ok:false,error:'local-resource-error'}; }
}

async function createWindow() {
  if(!license){
    const config=JSON.parse(await fs.readFile(path.join(__dirname,'generated/license-config.json'),'utf8'));
    license=require('./license.cjs').createLicense({serverUrl:config.serverUrl,fetch:(...args)=>net.fetch(...args),platform:process.platform,test:smoke&&!process.argv.includes('--test-activation'),
      storage:require('./license.cjs').encryptedStorage({safeStorage,file:path.join(app.getPath('userData'),'license.bin')}),
      notify:state=>{if(win&&!win.isDestroyed())win.webContents.send('tapnova:license',state);if(!state.active&&game&&!game.webContents.isDestroyed()){showGame(false);loaded=false;game.webContents.loadURL('about:blank').catch(()=>{})}}
    });
    await license.start();
  }
  if(!updates) {
    let engine=null;
    if(app.isPackaged&&!smoke) {
      if(process.platform==='win32')engine=windowsEngine(new (require('electron-updater').NsisUpdater)({provider:'generic',url:RELEASES+'/latest/download'}));
      else if(process.platform==='darwin')engine=require('./mac-updates.cjs').macEngine({fetch:(...args)=>net.fetch(...args),arch:process.arch,directory:path.join(app.getPath('userData'),'updates'),openPath:file=>shell.openPath(file)});
    }
    updates=createUpdates({engine,currentVersion:app.getVersion(),automatic:process.platform==='win32',
      notify:state=>{if(win&&!win.isDestroyed())win.webContents.send('tapnova:update',state)},
      confirm:async()=>{if(!win||win.isDestroyed())return false;const result=await dialog.showMessageBox(win,{type:'question',title:'Aktualizacja TAPNOVA',message:'Pobrać aktualizację i uruchomić TAPNOVA ponownie?',detail:'Po pobraniu aplikacja zamknie grę, zainstaluje nową wersję i uruchomi się ponownie. Zakończ najpierw aktywne zadania.',buttons:['Anuluj','Pobierz i zainstaluj'],defaultId:0,cancelId:0});return result.response===1}
    });
    if(engine)setTimeout(()=>updates.check(),15000).unref();
  }
  gameSession = session.fromPartition('persist:tapnova-game');
  if (!gameSession.getPreloadScripts().some(script=>script.id==='tapnova-bridge')) gameSession.registerPreloadScript({id:'tapnova-bridge',type:'frame',filePath:path.join(__dirname,'generated/game-preload.cjs')});
  gameSession.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
  gameSession.setPermissionCheckHandler(() => false);
  if(!smoke)gameSession.webRequest.onBeforeRequest((details,callback)=>callback({cancel:/^(https?|wss?):/.test(details.url)&&!license.isActive()}));
  if (smoke) gameSession.webRequest.onBeforeRequest((details,callback)=>callback({cancel:!details.url.startsWith('data:')}));
  win = new BrowserWindow({width:1360,height:920,minWidth:960,minHeight:700,show:false,backgroundColor:'#101116',title:'TAPNOVA · created by 1TapGod',icon:path.join(__dirname,'generated/tapnova.png'),webPreferences:{preload:path.join(__dirname,'shell-preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
  game = new WebContentsView({webPreferences:{session:gameSession,contextIsolation:true,nodeIntegration:false,sandbox:true,backgroundThrottling:false}});
  game.setBackgroundColor('#101116');
  game.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  game.webContents.on('will-navigate',(event,url)=>{ if (!isGameURL(url)) event.preventDefault(); });
  game.webContents.on('will-redirect',(event,url)=>{ if (!isGameURL(url)) event.preventDefault(); });
  game.webContents.on('will-frame-navigate',event=>{ if (event.isMainFrame && !isGameURL(event.url)) event.preventDefault(); });
  game.webContents.on('did-start-loading',()=>status('loading','Ładowanie gry…'));
  game.webContents.on('did-stop-loading',()=>{ if(loaded) status('ready','Gra otwarta · zaloguj się w MSP2'); });
  game.webContents.on('did-fail-load',(_event,code,_description,_url,isMainFrame)=>{ if (isMainFrame && code!==-3) { loaded=false; showGame(false); status('error','Brak połączenia z grą. Spróbuj ponownie.'); } });
  game.webContents.on('render-process-gone',()=>{ loaded=false; showGame(false); status('error','Proces gry został zamknięty. Otwórz grę ponownie.'); });
  // Chromium injects into each new frame before the game's keyboard/network
  // handlers. Page JavaScript has no access to Electron or the debugger.
  // Materialize the renderer before issuing CDP commands to the new view.
  await game.webContents.loadURL('about:blank');
  game.webContents.debugger.attach('1.3');
  await game.webContents.debugger.sendCommand('Page.enable');
  const sources = await Promise.all(['locales-pl.js','control-core.js','control-center.js','workspace-tools.js','status-comments.js','panel-ui.js','app.js'].map(f=>fs.readFile(path.join(resources,f),'utf8')));
  const source = `if(location.protocol==='https:'&&(location.hostname==='moviestarplanet2.com'||location.hostname.endsWith('.moviestarplanet2.com'))){\n${sources.join('\n;\n')}\n}`;
  await game.webContents.debugger.sendCommand('Page.addScriptToEvaluateOnNewDocument',{source});
  win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  win.webContents.on('will-navigate',event=>event.preventDefault());
  win.on('resize',layout);
  win.on('closed',()=>{ game?.webContents.close(); win=null; game=null; visible=false; loaded=false; });
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    ...(process.platform==='darwin'?[{role:'appMenu'}]:[]),
    {label:'Edycja',submenu:[{role:'undo'},{role:'redo'},{type:'separator'},{role:'cut'},{role:'copy'},{role:'paste'},{role:'selectAll'}]},
    {label:'Widok',submenu:[{label:'Zrób zdjęcie gry',accelerator:'CmdOrCtrl+Shift+S',click:photograph},{type:'separator'},{role:'togglefullscreen'},{role:'minimize'}]}
  ]));
  await win.loadFile(path.join(__dirname,'index.html'));
  if (!smoke) win.show();
  status('idle','Gotowe do gry');
}

ipcMain.handle('tapnova:extension',extensionMessage);
ipcMain.handle('tapnova:command',async(event,name,value)=>{
  if(event.sender!==win?.webContents || event.senderFrame!==win.webContents.mainFrame || event.senderFrame.url!==shellURL) throw Error('Untrusted caller');
  switch(name) {
    case 'status': return lastStatus;
    case 'update-status': return updates.snapshot();
    case 'update-check': return updates.check();
    case 'update-apply': return updates.apply();
    case 'license-status': return license.snapshot();
    case 'license-activate': return license.activate(value?.key,value?.deviceLabel);
    case 'license-refresh': return license.heartbeat();
    case 'license-deactivate': return license.deactivate();
    case 'photo': return photograph();
    case 'home': showGame(false); return {ok:true};
    case 'game': await startGame(); return {ok:loaded};
    case 'reload':
      if (loaded) { showGame(true); game.webContents.reload(); }
      else await startGame();
      return {ok:true};
    case 'tab': {
      if(!tabs.includes(value)) return {ok:false};
      await startGame();
      if(!loaded) return {ok:false};
      await game.webContents.executeJavaScript(`(()=>{window.__xbPlayAt=Date.now();window.__xbMountPanel?.();const p=window.__xbPanel;if(!p)return false;p.style.display='flex';p.querySelector('[data-tab-id="${value}"]')?.click();return true})()`);
      return {ok:true};
    }
    case 'clear-data': {
      showGame(false);
      const reply = await dialog.showMessageBox(win,{type:'warning',title:'Wyczyścić dane TAPNOVA?',message:'Zostaniesz wylogowany z gry. Ustawienia panelu zostaną usunięte.',buttons:['Anuluj','Wyczyść dane'],defaultId:0,cancelId:0});
      if(reply.response!==1) return {ok:false,cancelled:true};
      // Stop the remote document before clearing so it cannot restore storage.
      await game.webContents.loadURL('about:blank'); loaded=false;
      await gameSession.clearStorageData(); await gameSession.clearCache();
      status('idle','Dane usunięte. Możesz zalogować się ponownie.'); return {ok:true};
    }
    default: return {ok:false};
  }
});
app.on('window-all-closed',()=>{ if(process.platform!=='darwin') app.quit(); });
app.on('before-quit',()=>{updates?.stop();license?.stop()});
app.on('activate',()=>{ if(!win) createWindow().catch(error=>dialog.showErrorBox('TAPNOVA',error.message)); });
