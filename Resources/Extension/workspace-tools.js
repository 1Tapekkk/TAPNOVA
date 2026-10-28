// Local workspace conveniences. Never stores credentials or raw API errors.
(() => {
  'use strict';
  const catalog=[
    ['profile','Profil i styl','Profile and style','profil ubrania kolory avatar'],
    ['comments','Komentarze statusu','Status comments','status komentarz usuwanie comment'],
    ['status','Status i poprzednie wpisy','Status and previous posts','wayd przywracanie restore'],
    ['avatar','Zdjęcie profilowe','Profile picture','avatar obraz upload'],
    ['homes','Dom i przestrzeń','Home and space','dom pokoj room home'],
    ['auto','Codzienne zadania','Daily tasks','misje quest nagrody crystals'],
    ['friends','Porządkowanie znajomych','Manage friends','znajomi friends zaproszenia'],
    ['bots','Boty i autografy','Bots and autographs','quiz dress up autograf'],
    ['misc','Inne i AFK','Miscellaneous and AFK','afk odpowiedzi filtr'],
    ['emoji','Emotki','Emoji','emotki emotikony emoji'],
    ['chatroom','Gracze w pokoju','Players in the room','pokoj czat players'],
    ['spam','Ochrona','Protection','spam ochrona blokada'],
    ['settings','Ustawienia','Settings','motyw wyglad font ustawienia'],
    ['radar','Co nowego','What’s new','aktualizacja nowosci'],
    ['archive','Archiwum komentarzy','Comment archive','kopia eksport backup archive'],
    ['journal','Dziennik działań','Activity journal','historia log operacje errors']
  ];
  const ids=new Set(catalog.map(x=>x[0]));
  const normalize=s=>String(s).toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu,'').replace(/ł/g,'l');
  function createStore(storage){
    const key=(type,account)=>{
      if(!account?.profileId||!/^https:\/\/(eu|us)\.mspapis\.com$/.test(account.base))throw Error('account');
      return `_tn_${type}_v1_${encodeURIComponent(account.base+'|'+account.profileId)}`;
    };
    const read=(k)=>{const raw=storage.getItem(k);if(!raw)return [];if(raw.length>2500000)throw Error('storage');const data=JSON.parse(raw);if(!Array.isArray(data))throw Error('storage');return data};
    const write=(k,items)=>{const raw=JSON.stringify(items);if(raw.length>2500000)throw Error('storage');storage.setItem(k,raw)};
    const text=(v,max=10000)=>typeof v==='string'?v.slice(0,max):'';
    const archiveRead=account=>read(key('archive',account)).slice(-500).map(x=>({id:text(x.id,200),threadId:text(x.threadId,200),author:text(x.author,200),name:text(x.name,200),text:text(x.text),date:text(x.date,80),capturedAt:text(x.capturedAt,80),state:x.state==='deleted'?'deleted':'prepared'}));
    return {
      favorites(){return read('_tn_favorites_v1').filter(x=>ids.has(x)).filter((x,i,a)=>a.indexOf(x)===i).slice(0,12)},
      setFavorites(value){if(!Array.isArray(value)||value.length>12||value.some(x=>!ids.has(x)))throw Error('favorites');write('_tn_favorites_v1',[...new Set(value)])},
      archive:archiveRead,
      prepare(account,threadId,items){
        const before=archiveRead(account),now=new Date().toISOString();
        const entries=items.map(x=>({id:text(x.id,200),threadId:text(threadId,200),author:text(x.author,200),name:text(x.name,200),text:text(x.text),date:text(x.date,80),capturedAt:now,state:'prepared'}));
        if(items.some(x=>typeof x.text!=='string'||x.text.length>10000))throw Error('storage');
        const rest=before.filter(x=>!entries.some(y=>x.id===y.id&&x.threadId===y.threadId));
        if(rest.length+entries.length>500)throw Error('archiveFull');
        write(key('archive',account),[...rest,...entries]);
        return id=>{const saved=archiveRead(account);write(key('archive',account),saved.map(x=>x.id===id&&x.threadId===threadId?{...x,state:'deleted'}:x))};
      },
      clearArchive(account){storage.removeItem(key('archive',account))},
      journal(account){return read(key('journal',account)).slice(-100).map(x=>({name:text(x.name,80),state:['finished','failed','stopped'].includes(x.state)?x.state:'failed',date:text(x.date,80)}))},
      log(account,name,state){write(key('journal',account),[...this.journal(account),{name:text(name,80),state,date:new Date().toISOString()}].slice(-100))},
      clearJournal(account){storage.removeItem(key('journal',account))}
    };
  }
  let current=null;
  const store=createStore(localStorage);
  const operationNames={status:['Zapis statusu','Save status'],restore:['Przywracanie statusu','Restore status'],statusComments:['Komentarze statusu','Status comments'],quests:['Codzienne zadania','Daily tasks'],crystals:['Nagrody','Rewards'],avatar:['Zdjęcie profilowe','Profile picture'],acceptFriends:['Akceptowanie zaproszeń','Accept invitations'],rejectFriends:['Odrzucanie zaproszeń','Reject invitations'],deleteFriendsAll:['Usuwanie znajomych','Remove friends'],readMessages:['Odczyt wiadomości','Read messages'],mood:['Zmiana nastroju','Change mood'],homes:['Zmiana domu','Change home']};
  function begin(name){
    const account={...current?.context.account?.()};if(!account.profileId)return null;
    return {finish(state){try{store.log(account,name,state);if(current?.mode==='journal')current.render()}catch{/* Never interrupt a game operation because a local journal is full. */}}};
  }
  function mount(panel,context){
    current?.dispose();
    const tr=(pl,en)=>context.lang()==='pl'?pl:en;
    const el=(tag,cls,text)=>{const e=document.createElement(tag);e.className=cls;if(text!==undefined)e.textContent=text;return e};
    const btn=(text,action,id)=>{const b=el('button','tnw-button',text);b.type='button';if(id)b.dataset.tnw=id;b.addEventListener('click',action);return b};
    const style=el('style','');style.textContent=`
      .tnw-button{font:inherit;font-size:11px;padding:8px 10px;border:1px solid #b598ff38;border-radius:9px;background:#b598ff0d;color:#e2dce9;cursor:pointer}.tnw-button:hover{background:#b598ff20}.tnw-button:disabled{opacity:.4}.tnw-launch{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}.tnw-pins{display:flex;gap:6px;flex-wrap:wrap;margin-top:12px}.tnw-pins:empty{display:none}
      .tnw-dialog{position:fixed;inset:0;margin:auto;width:min(620px,calc(100vw - 24px));height:min(690px,calc(100dvh - 36px));max-width:none;max-height:none;box-sizing:border-box;padding:0;border:1px solid #b598ff40;border-radius:23px;background:#101017;color:#eeeaf4;font:13px 'Segoe UI',sans-serif;box-shadow:0 28px 100px #000a;overflow:hidden}.tnw-dialog[open]{display:flex;flex-direction:column}.tnw-dialog::backdrop{background:#03030acb;backdrop-filter:blur(3px)}.tnw-dialog *{box-sizing:border-box}.tnw-dialog [hidden]{display:none!important}
      .tnw-head{display:flex;gap:12px;align-items:center;padding:18px 20px;border-bottom:1px solid #ffffff0b}.tnw-head h2{font-size:19px;margin:0;flex:1}.tnw-nav{display:flex;gap:6px;padding:12px 18px 0;flex-wrap:wrap}.tnw-nav [aria-pressed=true]{border-color:#b598ff;background:#b598ff20}.tnw-search{margin:12px 18px 0;padding:12px;border:1px solid #b598ff38;background:#ffffff04;border-radius:12px;font:inherit;color:inherit;width:calc(100% - 36px)}.tnw-content{overflow:auto;flex:1;min-height:0;padding:16px 18px;scrollbar-width:thin;scrollbar-color:#826099 #101116}.tnw-row{display:flex;gap:7px;align-items:center;padding:10px;margin-bottom:8px;border:1px solid #ffffff12;background:#ffffff03;border-radius:13px;min-width:0}.tnw-row>.tnw-button:first-child{flex:1;text-align:left;border:0;background:none;font-size:13px}.tnw-row button{flex:none}.tnw-row [aria-pressed=true]{color:#f0d79c}.tnw-card{padding:14px;border:1px solid #ffffff12;border-radius:13px;margin-bottom:10px;overflow-wrap:anywhere}.tnw-card p{white-space:pre-wrap;line-height:1.6;margin:8px 0}.tnw-card small,.tnw-hint{font-size:11px;color:#aaa1b9;line-height:1.6}.tnw-foot{padding:12px 18px;border-top:1px solid #ffffff0b;display:flex;gap:8px;flex-wrap:wrap}.tnw-notice{flex:1;min-width:140px;color:#d4badf;font-size:11px;line-height:1.5}.tnw-dialog :focus-visible{outline:2px solid #b598ff;outline-offset:2px}.tnw-empty{padding:25px 0;text-align:center;color:#a89db9}
      @media(max-width:440px){.tnw-row{gap:4px;padding:7px}.tnw-row .tnw-button{padding:7px}.tnw-head{padding:15px}.tnw-nav{padding-inline:12px}.tnw-content{padding:12px}}
    `;panel.append(style);
    const dialog=el('dialog','tnw-dialog');dialog.setAttribute('aria-label',tr('Mój pulpit','My workspace'));
    const head=el('header','tnw-head'),title=el('h2','',tr('Mój pulpit','My workspace'));
    const close=btn('×',()=>dialog.close(),'close');close.setAttribute('aria-label',tr('Zamknij','Close'));head.append(title,close);
    const nav=el('nav','tnw-nav'),search=el('input','tnw-search');search.type='search';search.placeholder=tr('Szukaj narzędzi…','Search tools…');search.setAttribute('aria-label',tr('Szukaj','Search'));
    const content=el('div','tnw-content'),foot=el('footer','tnw-foot'),notice=el('div','tnw-notice');notice.setAttribute('role','status');
    const exportButton=btn(tr('Eksport JSON','Export JSON'),()=>perform(()=>{
      const account=context.account();const data=entry.mode==='archive'?store.archive(account):store.journal(account);
      const blob=new Blob([JSON.stringify({format:'tapnova-'+entry.mode,version:1,exportedAt:new Date().toISOString(),entries:data},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),link=el('a','');link.href=url;link.download=`tapnova-${entry.mode}-${Date.now()}.json`;panel.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
    }),'export');
    let clearArmed=false;
    const clear=btn(tr('Wyczyść','Clear'),()=>{if(!clearArmed){clearArmed=true;clear.textContent=tr('Potwierdź wyczyszczenie','Confirm clearing');notice.textContent=tr('Usunie tylko lokalne wpisy. Gra pozostanie bez zmian.','Only local records will be removed. Game data is unaffected.');return}perform(()=>{entry.mode==='archive'?store.clearArchive(context.account()):store.clearJournal(context.account());clearArmed=false;render()})},'clear');
    foot.append(notice,exportButton,clear);dialog.append(head,nav,search,content,foot);panel.append(dialog);
    const pins=el('div','tnw-pins');panel.querySelector('.tn-section-head')?.append(pins);
    const launch=el('div','tnw-launch');launch.append(btn(tr('⌕ Szukaj · Ctrl+K','⌕ Search · Ctrl+K'),()=>open('tools'),'search'),btn(tr('☆ Mój pulpit','☆ My workspace'),()=>open('home'),'home'));
    panel.querySelector('.tnc-bar')?.append(launch);
    const entry={panel,context,dialog,mode:'home',render,dispose(){if(dialog.open)dialog.close();launch.remove();pins.remove();dialog.remove();style.remove()},identity:JSON.stringify(context.account())};current=entry;
    const modeNames={home:['Ulubione','Favorites'],tools:['Narzędzia','Tools'],archive:['Archiwum','Archive'],journal:['Dziennik','Journal']};
    for(const [mode,label] of Object.entries(modeNames)){const b=btn(tr(...label),()=>open(mode),mode);b.dataset.mode=mode;nav.append(b)}
    function perform(action){try{notice.textContent='';action()}catch(error){notice.textContent=error.message==='account'?tr('Zaloguj się do gry, aby zobaczyć dane tego konta.','Sign in to view this account’s data.'):tr('Nie udało się odczytać lub zapisać danych lokalnych.','Could not read or save local data.')}}
    const label=id=>{const item=catalog.find(x=>x[0]===id);return item?tr(item[1],item[2]):id};
    function go(id){
      if(['archive','journal'].includes(id)){open(id);return}
      dialog.close();context.select(({comments:'profile',status:'profile',avatar:'profile',friends:'auto'})[id]||id);
      if(id==='comments')panel.querySelector('[data-comments=open]')?.click();
      else if(['status','avatar','friends'].includes(id)){
        const pane=context.refs.panes[id==='friends'?'auto':'profile'];const word=id==='status'?'status':id==='avatar'?tr('zdjęcie profilowe','profile picture'):tr('znajom','friend');
        const card=[...(pane?.children||[])].find(e=>normalize(e.textContent).includes(normalize(word)));
        card?.scrollIntoView({block:'start',behavior:'auto'});card?.querySelector('input,textarea,button')?.focus();
      }
    }
    function pin(id){perform(()=>{const favorites=store.favorites();store.setFavorites(favorites.includes(id)?favorites.filter(x=>x!==id):[...favorites,id]);render();renderPins()})}
    function move(id,offset){perform(()=>{const favorites=store.favorites(),i=favorites.indexOf(id),j=i+offset;if(j<0||j>=favorites.length)return;[favorites[i],favorites[j]]=[favorites[j],favorites[i]];store.setFavorites(favorites);render();renderPins()})}
    function renderPins(){pins.replaceChildren();try{for(const id of store.favorites())pins.append(btn('☆ '+label(id),()=>go(id)))}catch{}}
    function render(){
      if(current!==entry)return;content.replaceChildren();clearArmed=false;clear.textContent=tr('Wyczyść','Clear');
      const dataMode=['archive','journal'].includes(entry.mode);exportButton.hidden=clear.hidden=!dataMode;
      nav.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===entry.mode)));
      title.textContent=tr(...modeNames[entry.mode]);search.placeholder=dataMode?tr('Szukaj w zapisanych wpisach…','Search saved entries…'):tr('Szukaj narzędzi…','Search tools…');
      perform(()=>{
        const query=normalize(search.value);
        if(!dataMode){
          const favorites=store.favorites(),rows=entry.mode==='home'?favorites.map(id=>catalog.find(x=>x[0]===id)):catalog;
          content.append(el('p','tnw-hint',tr(entry.mode==='home'?'Twoje skróty. Dodaj je gwiazdką w Narzędziach i ustaw kolejność strzałkami.':'Wybierz narzędzie lub przypnij gwiazdką. Skrót tylko otwiera widok. Nie uruchamia zadania.',entry.mode==='home'?'Your shortcuts. Star tools and arrange them with the arrows.':'Open a tool or star it. Shortcuts open views without running tasks.')));
          for(const item of rows.filter(x=>normalize(x.slice(1).join(' ')).includes(query))){
            const id=item[0],row=el('div','tnw-row'),openButton=btn(label(id),()=>go(id));openButton.dataset.tool=id;
            const star=btn(favorites.includes(id)?'★':'☆',()=>pin(id));star.setAttribute('aria-pressed',String(favorites.includes(id)));star.setAttribute('aria-label',tr('Ulubione: ','Favorite: ')+label(id));row.append(openButton,star);
            if(entry.mode==='home'){for(const [arrow,delta] of [['↑',-1],['↓',1]]){const b=btn(arrow,()=>move(id,delta));b.setAttribute('aria-label',tr('Przesuń: ','Move: ')+label(id)+' '+arrow);b.disabled=favorites.indexOf(id)+delta<0||favorites.indexOf(id)+delta>=favorites.length;row.append(b)}}content.append(row);
          }
          if(!content.querySelector('.tnw-row'))content.append(el('div','tnw-empty',tr('Brak wyników. Dodaj ulubione w zakładce Narzędzia.','No results. Add favorites in Tools.')));
          return;
        }
        const account=context.account();const rows=entry.mode==='archive'?store.archive(account):store.journal(account);
        content.append(el('p','tnw-hint',entry.mode==='archive'?tr('Kopie sprzed usunięcia, tylko dla tego konta. Nie przywracają komentarzy w grze. Limit: 500 wpisów.','Copies saved before deletion, for this account only. These cannot restore comments in the game. Limit: 500 entries.'):tr('Ostatnie 100 zadań wykonanych od dodania tej funkcji. „Zakończono” oznacza koniec zadania, nie potwierdzenie każdej zmiany w grze.','Last 100 tasks since this feature was added. “Finished” means the task ended, not confirmation of every game change.')));
        const statusNames={prepared:tr('Kopia przed usunięciem · wynik niepotwierdzony','Copy before deletion · outcome unconfirmed'),deleted:tr('Usunięcie potwierdzone','Deletion confirmed'),finished:tr('Zakończono zadanie','Task finished'),failed:tr('Błąd zadania','Task failed'),stopped:tr('Zatrzymano zadanie','Task stopped')};
        const matches=rows.slice().reverse().filter(x=>normalize([x.name,x.text,statusNames[x.state]].join(' ')).includes(query));
        for(const item of matches){const card=el('article','tnw-card');card.append(el('strong','',entry.mode==='archive'?item.name:tr(...(operationNames[item.name]||['Zadanie: '+item.name,'Task: '+item.name]))));if(entry.mode==='archive')card.append(el('p','',item.text));card.append(el('small','',`${statusNames[item.state]} · ${item.capturedAt||item.date}`));content.append(card)}
        if(!matches.length)content.append(el('div','tnw-empty',tr('Brak zapisanych wpisów.','No saved entries.')));
        exportButton.disabled=clear.disabled=!rows.length;
      });
    }
    function open(mode){entry.mode=mode;search.value='';render();if(!dialog.open)dialog.showModal();search.focus()}
    entry.open=open;entry.sync=()=>{const next=JSON.stringify(context.account());if(next!==entry.identity){entry.identity=next;if(dialog.open)render()}};
    search.addEventListener('input',render);
    search.addEventListener('keydown',event=>{if(event.key==='Enter'&&['tools','home'].includes(entry.mode)){event.preventDefault();content.querySelector('[data-tool]')?.click()}});
    dialog.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();dialog.close()}if(event.key==='Tab'){const targets=[...dialog.querySelectorAll('button:not(:disabled),input')].filter(e=>e.getClientRects().length);const index=targets.indexOf(panel.getRootNode().activeElement);event.preventDefault();targets[(index+(event.shiftKey?-1:1)+targets.length)%targets.length]?.focus()}});
    renderPins();
  }
  window.addEventListener('keydown',event=>{
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'&&!event.altKey&&!event.isComposing&&current?.panel.isConnected){
      if(current.panel.querySelector('dialog[open]:not(.tnw-dialog)'))return;
      event.preventDefault();event.stopImmediatePropagation();current.open('tools');
    }
  },true);
  window.__tapnovaExtras={createStore,mount,begin,sync:()=>current?.sync(),prepareArchive:(account,threadId,items)=>store.prepare(account,threadId,items)};
})();
