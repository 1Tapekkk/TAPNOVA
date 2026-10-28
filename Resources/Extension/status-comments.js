// TAPNOVA status moderation. Uses the game's API, never a third-party proxy.
(() => {
  'use strict';
  const LIST = `query TapnovaComments($threadId: ID!, $entityType: EntityType!, $pageSize: Int, $cursor: String) {
    comments(threadId: $threadId, entityType: $entityType, pageSize: $pageSize, cursor: $cursor) {
      comments { commentId author text created deleted profile { id name membership { lastTierExpiry } } } cursor
    }
  }`;
  const DELETE = `mutation TapnovaDeleteComment($commentId: ID!) {
    deleteComment(input: {commentId: $commentId}) { success }
  }`;
  const fail = (code, diagnostic = '') => { throw Object.assign(new Error(code), { diagnostic }); };
  function createClient(context, signal) {
    const session = { ...context.session() }, known = new Map(), cursors = new Set();
    let threadId = '', cursor = '', loaded = false;
    function check() {
      const now = context.session();
      if (signal.aborted) throw new DOMException('Stopped', 'AbortError');
      if (!session.token || !session.profileId) fail('login');
      if (now.token !== session.token || now.profileId !== session.profileId || now.base !== session.base) fail('session');
      if (!/^https:\/\/(eu|us)\.mspapis\.com$/.test(session.base)) fail('region');
    }
    async function request(path, body) {
      check();
      const stage = path.startsWith('/profileattributes/') ? 'STATUS' : path.startsWith('/profilegeneratedcontent/') ? 'OWNER' : body?.query === DELETE ? 'DELETE' : 'COMMENTS';
      let response;
      try { response = await context.request(session.base + path, {
        method: body ? 'POST' : 'GET', signal, credentials: 'omit', redirect: 'error',
        headers: { authorization: `Bearer ${session.token}`, 'content-type': 'application/json' },
        ...(body ? { body: JSON.stringify(body) } : {})
      }); } catch (error) {
        check();
        if (error?.name === 'AbortError') throw error;
        fail('http', `${stage} · NETWORK`);
      }
      check();
      if (!response.ok) fail(response.status === 429 ? 'limit' : response.status === 401 ? 'login' : response.status === 403 ? 'permission' : 'server', `${stage} · HTTP ${response.status}`);
      let data;
      try { data = await response.json(); } catch (error) {
        check();
        if (error?.name === 'AbortError') throw error;
        fail('api', `${stage} · JSON`);
      }
      check();
      if (Array.isArray(data?.errors) && data.errors.length) {
        const codes = data.errors.map(error => error?.extensions?.code);
        fail(codes.includes('UNAUTHENTICATED') ? 'login' : codes.includes('FORBIDDEN') ? 'permission' : 'api', `${stage} · GRAPHQL`);
      }
      return data;
    }
    async function ownStatus() {
      const attrs = await request(`/profileattributes/v1/profiles/${encodeURIComponent(session.profileId)}/games/j68d/attributes`);
      const id = attrs?.additionalData?.WAYD || attrs?.additionalData?.Wayd || attrs?.additionalData?.wayd;
      if (typeof id !== 'string' || !id) fail('noStatus');
      const meta = await request(`/profilegeneratedcontent/v2/profiles/content/${encodeURIComponent(id)}`);
      if (meta?.owner !== session.profileId || meta?.type !== 'WAYD') fail('owner');
      return id;
    }
    return {
      async load(more = false) {
        check();
        if (!more) {
          known.clear(); cursors.clear(); loaded = false; cursor = '';
          threadId = await ownStatus();
        } else if (!loaded || !cursor) fail('pagination');
        const result = await request('/edgecomments/graphql', {
          query: LIST, variables: { threadId, entityType: 'UGC', pageSize: 30, cursor }
        });
        const page = result?.data?.comments;
        if (!Array.isArray(page?.comments)) fail('api');
        const next = page.cursor || '';
        if (typeof next !== 'string' || (next && (next === cursor || cursors.has(next)))) fail('pagination');
        if (next) cursors.add(next);
        for (const item of page.comments) {
          if (typeof item?.commentId !== 'string' || !item.commentId || typeof item.deleted !== 'boolean') fail('api');
          if (item.deleted) { known.delete(item.commentId); continue; }
          known.set(item.commentId, { id:item.commentId, author:String(item.author || item.profile?.id || ''),
            name:String(item.profile?.name || item.author || '—'), text:String(item.text || ''), date:String(item.created || ''),
            profileId:String(item.profile?.id || item.author || ''), vip:Date.parse(item.profile?.membership?.lastTierExpiry)>Date.now() });
        }
        cursor = next; loaded = true;
        return { items:[...known.values()], more:!!cursor };
      },
      async avatar(profileId) {
        check();
        if (![...known.values()].some(item=>item.profileId===profileId)) return null;
        try {
          const base=`https://cdn.moviestarplanet2.com/avatars/${encodeURIComponent(profileId)}/games/j68d`;
          const response=await context.request(`${base}/version.txt`,{method:'GET',signal,credentials:'omit',redirect:'error'});
          if(!response.ok)return null;
          const version=(await response.text()).trim();check();
          return /^[\w.-]{1,64}$/.test(version)?`${base}/face/${encodeURIComponent(version)}.png`:null;
        } catch { return null; }
      },
      async remove(ids, progress) {
        check();
        const selected = [...new Set(ids)];
        if (!loaded || !selected.length || selected.some(id => !known.has(id))) fail('selection');
        if (await ownStatus() !== threadId) fail('statusChanged');
        let markArchived;
        try { markArchived=window.__tapnovaExtras?.prepareArchive(session,threadId,selected.map(id=>known.get(id))); }
        catch(error) { fail(error.message==='archiveFull'?'archiveFull':'archiveStorage'); }
        // A failed or interrupted write requires a fresh read before any retry.
        loaded = false;
        for (const id of selected) {
          const result = await request('/edgecomments/graphql', { query:DELETE, variables:{commentId:id} });
          if (result?.data?.deleteComment?.success !== true) fail('delete');
          known.delete(id);
          try { markArchived?.(id); } catch { /* The saved copy remains marked unconfirmed. */ }
          progress(id);
        }
      }
    };
  }
  let mounted = null;
  const messages = {
    archiveFull:['Archiwum ma 500 wpisów. Wyeksportuj i wyczyść je w Moim pulpicie. Niczego nie usunięto.','The archive has 500 entries. Export and clear it in My workspace. Nothing was deleted.'],
    archiveStorage:['Nie udało się zapisać kopii komentarzy. Usuwanie nie zostało rozpoczęte. Sprawdź archiwum w Moim pulpicie.','Could not save comment copies. Deletion was not started. Check the archive in My workspace.'],
    login:['Zaloguj się ponownie do gry.','Sign in to the game again.'],
    session:['Konto lub sesja się zmieniły. Wczytaj komentarze ponownie.','Account or session changed. Reload comments.'],
    region:['Nieobsługiwany region gry.','Unsupported game region.'],
    noStatus:['Najpierw zapisz własny status w grze.','Create your own status in the game first.'],
    owner:['Nie udało się potwierdzić, że to Twój status.','Could not verify ownership of this status.'],
    statusChanged:['Twój status się zmienił. Wczytaj komentarze ponownie.','Your status changed. Reload comments.'],
    limit:['Limit serwera. Odczekaj chwilę i odśwież listę.','Server rate limit. Wait a moment and refresh.'],
    permission:['Gra nie zezwoliła na tę operację.','The game did not allow this operation.'],
    selection:['Wczytaj listę i zaznacz komentarze.','Load the list and select comments.'],
    pagination:['Nie udało się odczytać kolejnej strony. Odśwież listę.','Could not read the next page. Refresh the list.'],
    delete:['Serwer nie potwierdził usunięcia. Odśwież listę przed ponowną próbą.','Deletion was not confirmed. Refresh before retrying.'],
    api:['Nieoczekiwana odpowiedź API gry. Odśwież listę.','Unexpected game API response. Refresh the list.'],
    server:['Serwer gry odrzucił żądanie.','The game server rejected the request.'],
    http:['Nie udało się połączyć z API gry. Spróbuj ponownie.','Could not reach the game API. Try again.']
  };
  function mount(parent, context) {
    mounted?.dispose();
    const tr=(pl,en)=>context.lang()==='pl'?pl:en;
    const node=(tag,cls,text)=>{const e=document.createElement(tag);e.className=cls;if(text!==undefined)e.textContent=text;return e};
    const icons={comment:'M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9H13a8.5 8.5 0 0 1 8 8v.5M8 9h8M8 13h5',trash:'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7',refresh:'M20 7v5h-5M4 17v-5h5M6.1 7a7 7 0 0 1 11.5-2L20 8M4 16l2.4 3A7 7 0 0 0 18 17',close:'M6 6l12 12M6 18 18 6'};
    const icon=name=>{const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','1.7');svg.setAttribute('stroke-linecap','round');svg.setAttribute('stroke-linejoin','round');svg.setAttribute('aria-hidden','true');const p=document.createElementNS(svg.namespaceURI,'path');p.setAttribute('d',icons[name]);svg.append(p);return svg};
    const button=(text,name,action,cls='')=>{const e=node('button','tn-comments-button '+cls,text);e.type='button';e.dataset.comments=name;e.addEventListener('click',action);return e};
    const iconButton=(text,name,action,glyph,cls='')=>{const e=button('',name,action,'tn-comments-icon '+cls);e.title=text;e.setAttribute('aria-label',text);e.append(icon(glyph));return e};
    const root=node('div','tn-comments');
    const style=node('style','');
    style.textContent=`
      .tn-comments{margin-top:12px}.tn-comments-button{font:inherit;font-size:12px;font-weight:600;color:#dddde5;background:#14151a;border:1px solid #303138;border-radius:13px;padding:11px 14px;cursor:pointer;transition:background .16s,border-color .16s,transform .16s}
      .tn-comments-button:hover:not(:disabled){background:#202128;border-color:#635575;transform:translateY(-1px)}.tn-comments-button:disabled{opacity:.4;cursor:default}.tn-comments-button svg{width:19px;height:19px;flex:none}
      .tn-comments-launch{display:flex;gap:10px;align-items:center;width:100%;text-align:left;background:linear-gradient(110deg,#b598ff15,#101117);border-color:#b598ff33}.tn-comments-launch svg{color:#bb9af6}.tn-comments-launch span{flex:1}.tn-comments-launch b{color:#b598ff;font-size:18px;font-weight:400}
      .tn-comments-window,.tn-comments-confirm{padding:0;position:fixed;inset:0;margin:auto;box-sizing:border-box;color:#f2f1f5;background:#0c0c12;border:1px solid #b598ff30;border-radius:26px;box-shadow:0 24px 90px #0009;font-family:'Segoe UI',system-ui,sans-serif;max-width:none;max-height:none;overflow:hidden}
      .tn-comments-window{width:min(650px,calc(100vw - 32px));height:min(730px,calc(100dvh - 40px))}.tn-comments-window[open]{display:flex;flex-direction:column}.tn-comments-window::backdrop{background:#030309c7;backdrop-filter:blur(3px)}
      .tn-comments-window[open],.tn-comments-confirm[open]{animation:tn-comments-enter .2s ease-out both}.tn-comments-window *,.tn-comments-confirm *{box-sizing:border-box}
      .tn-comments-head{display:flex;align-items:center;gap:10px;padding:20px 22px;border-bottom:1px solid #ffffff09;flex:none}.tn-comments-head>svg{width:20px;height:20px;flex:none}.tn-comments-head h2{margin:0;flex:1;font-size:20px;font-weight:700;letter-spacing:-.4px;line-height:1.3}
      .tn-comments-icon{display:inline-flex;align-items:center;justify-content:center;flex:none;width:40px;height:40px;padding:9px;border-radius:13px;color:#9c9aa8}
      .tn-comments-toolbar{padding:14px 20px 0;display:flex;gap:8px;flex-wrap:wrap;align-items:center}.tn-comments-toolbar input{flex:1;width:100px;min-width:0;padding:10px 13px;border-radius:12px;border:1px solid #ffffff12;background:#ffffff03;color:#dddde5;font:inherit;font-size:12px}.tn-comments-toolbar input::placeholder{color:#787582}
      .tn-comments-tools{display:flex;gap:6px;flex-wrap:wrap;width:100%}.tn-comments-tools .tn-comments-button{font-size:11px;padding:7px 10px;border-radius:9px}
      .tn-comments-list{flex:1;min-height:0;overflow:auto;padding:18px 20px;display:flex;flex-direction:column;gap:12px;scrollbar-width:thin;scrollbar-color:#826099 #101116}
      .tn-comments-item{display:grid;grid-template-columns:66px minmax(0,1fr) 34px;align-items:start;gap:10px;padding:14px 12px;border:1px solid #34404a;border-radius:21px;background:linear-gradient(130deg,#202326,#181b20);box-shadow:inset 0 1px 0 #ffffff04;flex:none}
      .tn-comments-person{display:flex;flex-direction:column;align-items:center;gap:5px;min-width:0;text-align:center}.tn-comments-avatar{width:48px;height:48px;border-radius:50%;border:3px solid #634455;box-shadow:0 0 0 4px #be628008;background:linear-gradient(145deg,#44324f,#24232d);display:grid;place-items:center;overflow:hidden;color:#d9bbf6;font-size:18px;font-weight:700}.tn-comments-avatar img{width:100%;height:100%;object-fit:cover;grid-area:1/1}.tn-comments-avatar span{grid-area:1/1}
      .tn-comments-person strong{font-size:11px;line-height:1.3;overflow-wrap:anywhere;max-width:100%}.tn-comments-vip{font-size:8px;font-weight:800;letter-spacing:1px;border:1px solid #dab9748c;border-radius:5px;background:#f4c35b16;color:#f2cf7f;padding:2px 5px}
      .tn-comments-bubble{border:1px solid #ffffff0b;border-radius:19px;background:#11131672;padding:13px 14px;min-width:0;align-self:stretch}.tn-comments-bubble p{margin:0;font-size:13px;font-weight:600;line-height:1.55;color:#efedf2;white-space:pre-wrap;overflow-wrap:anywhere}.tn-comments-bubble time{display:block;margin-top:12px;text-align:right;color:#73d6e2;font-size:10px;font-weight:700}
      .tn-comments-trash{width:34px;height:34px;padding:7px;border-radius:50%;color:#eea3ac;background:#bb556224;border-color:#cb6b7655}.tn-comments-trash:hover:not(:disabled),.tn-comments-danger:hover:not(:disabled){background:#a14d5c42;border-color:#db8d97}
      .tn-comments-check{accent-color:#b598ff;width:17px;height:17px;margin:4px 0 0}.tn-comments-empty{margin:auto;text-align:center;color:#908a9d;font-size:13px;padding:30px 12px;line-height:1.7}
      .tn-comments-foot{padding:12px 20px 16px;border-top:1px solid #ffffff09;display:flex;align-items:center;gap:10px;flex-wrap:wrap}.tn-comments-status{color:#a8a1b5;font-size:11px;line-height:1.5;flex:1;min-width:160px;overflow-wrap:anywhere}.tn-comments-foot .tn-comments-button{padding:8px 12px;font-size:11px}
      .tn-comments-confirm{width:min(520px,calc(100vw - 32px));max-height:calc(100dvh - 40px);overflow:auto}.tn-comments-confirm::backdrop{background:#030307c9;backdrop-filter:blur(1.5px)}.tn-comments-confirm .tn-comments-head{padding:20px 22px}.tn-comments-confirm .tn-comments-head h2{font-size:21px}
      .tn-comments-confirm-body{padding:20px 22px 22px}.tn-comments-question{font-size:15px;font-weight:650;line-height:1.5;margin:0 0 17px;overflow-wrap:anywhere}.tn-comments-preview{background:#14161a;border:1px solid #303943;border-radius:17px;padding:15px 17px;max-height:170px;overflow:auto;color:#aaa7b1;font-size:14px;font-weight:600;line-height:1.5;white-space:pre-wrap;overflow-wrap:anywhere}
      .tn-comments-confirm-actions{display:grid;gap:10px;margin-top:17px}.tn-comments-confirm-actions .tn-comments-button{width:100%;min-height:44px;font-size:14px;border-radius:14px;overflow-wrap:anywhere}.tn-comments-danger{color:#eaa0a8;background:#74383d42;border-color:#b6676f66}.tn-comments-confirm-note{font-size:11px;color:#8e889a;margin:12px 0 0;line-height:1.5}
      .tn-comments [hidden]{display:none!important}.tn-comments :focus-visible{outline:2px solid #b598ff;outline-offset:3px}
      @keyframes tn-comments-enter{from{opacity:0;transform:translateY(8px) scale(.985)}to{opacity:1;transform:none}}
      @media(max-width:440px){.tn-comments-window{height:calc(100dvh - 24px);width:calc(100vw - 20px);border-radius:22px}.tn-comments-head{padding:17px 14px;gap:8px}.tn-comments-head h2{font-size:18px}.tn-comments-icon{width:35px;height:35px}.tn-comments-toolbar{padding:12px 12px 0}.tn-comments-list{padding:14px 12px;gap:10px}.tn-comments-item{grid-template-columns:52px minmax(0,1fr) 30px;gap:6px;padding:12px 8px;border-radius:18px}.tn-comments-avatar{width:42px;height:42px}.tn-comments-person strong{font-size:10px}.tn-comments-bubble{padding:10px;border-radius:15px}.tn-comments-bubble p{font-size:12px}.tn-comments-bubble time{font-size:9px}.tn-comments-trash{width:30px;height:30px;padding:6px}.tn-comments-foot{padding:12px}.tn-comments-confirm{width:calc(100vw - 20px);border-radius:23px}.tn-comments-confirm .tn-comments-head{padding:18px}.tn-comments-confirm .tn-comments-head h2{font-size:20px}.tn-comments-confirm-body{padding:18px}}
      @media(prefers-reduced-motion:reduce){.tn-comments-window[open],.tn-comments-confirm[open]{animation:none}.tn-comments-button{transition:none;transform:none!important}}
    `;
    const dialog=node('dialog','tn-comments-window');dialog.setAttribute('aria-label',tr('Komentarze statusu','Status comments'));
    const confirmation=node('dialog','tn-comments-confirm');confirmation.setAttribute('aria-label',tr('Usunąć komentarz?','Delete comment?'));
    let controller=new AbortController(),client=createClient(context,controller.signal),items=[],selected=new Set(),more=false,busy=false,fresh=false,disposed=false,selectionMode=false,confirmationIds=[];
    let identity={...context.session()},avatars=new Map(),returnFocus=null;
    const launch=button('','open',()=>{dialog.showModal();refresh.focus();if(!fresh&&!busy)load(false)},'tn-comments-launch');launch.append(icon('comment'),node('span','',tr('Komentarze statusu','Status comments')),node('b','','›'));
    const refresh=iconButton(tr('Odśwież','Refresh'),'refresh',()=>load(false),'refresh');
    const close=iconButton(tr('Zamknij','Close'),'close',()=>closeWindow(),'close');
    const head=node('header','tn-comments-head');head.append(icon('comment'),node('h2','',tr('Komentarze statusu','Status comments')),refresh,close);
    const toolbar=node('div','tn-comments-toolbar'),search=node('input','');search.type='search';search.placeholder=tr('Szukaj komentarza lub autora…','Search comment or author…');search.setAttribute('aria-label',search.placeholder);
    const toggle=button(tr('Zaznacz','Select'),'toggle',()=>{selectionMode=!selectionMode;selected.clear();render()});
    const tools=node('div','tn-comments-tools');
    const select=button(tr('Zaznacz widoczne','Select visible'),'select',()=>{visible().forEach(item=>selected.add(item.id));render()});
    const clear=button(tr('Odznacz','Clear selection'),'clear',()=>{selected.clear();render()});
    const remove=button('','delete',()=>showConfirmation(items.filter(item=>selected.has(item.id)),null,remove),'tn-comments-danger');
    tools.append(select,clear,remove);toolbar.append(search,toggle,tools);
    const list=node('div','tn-comments-list'),status=node('div','tn-comments-status');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
    const next=button(tr('Wczytaj więcej','Load more'),'more',()=>load(true));
    const stop=button(tr('Zatrzymaj','Stop'),'stop',()=>controller.abort(),'tn-comments-danger');
    const foot=node('footer','tn-comments-foot');foot.append(status,next,stop);
    dialog.append(head,toolbar,list,foot);root.append(style,launch,dialog,confirmation);parent.append(root);
    const visible=()=>items.filter(item=>(item.name+' '+item.text).toLocaleLowerCase().includes(search.value.toLocaleLowerCase()));
    function closeConfirmation(){if(confirmation.open)confirmation.close();confirmationIds=[];if(returnFocus?.isConnected)returnFocus.focus();else refresh.focus()}
    function closeWindow(){controller.abort();fresh=false;closeConfirmation();dialog.close();launch.focus()}
    function showConfirmation(chosen,author,trigger,authorMode=false){
      if(busy||!fresh||!chosen.length)return;
      confirmationIds=chosen.map(item=>item.id);returnFocus=trigger;
      const h=node('header','tn-comments-head');h.append(icon('trash'),node('h2','',tr(chosen.length===1?'Usunąć komentarz?':'Usunąć komentarze?',chosen.length===1?'Delete comment?':'Delete comments?')));
      const body=node('div','tn-comments-confirm-body');
      const question=authorMode?tr(`Usunąć wszystkie wczytane komentarze użytkownika „${author.name}” (${chosen.length})?`,`Delete all loaded comments by “${author.name}” (${chosen.length})?`):chosen.length===1?tr(`Czy chcesz usunąć komentarz użytkownika „${chosen[0].name}”?`,`Delete the comment by “${chosen[0].name}”?`):tr(`Czy chcesz usunąć zaznaczone komentarze (${chosen.length})?`,`Delete the selected comments (${chosen.length})?`);
      body.append(node('p','tn-comments-question',question),node('div','tn-comments-preview',chosen.map(item=>chosen.length===1?item.text:`${item.name}: ${item.text}`).join('\n\n')));
      const actions=node('div','tn-comments-confirm-actions');
      const cancel=button(tr('Anuluj','Cancel'),'cancel',closeConfirmation);
      const confirm=button(tr('Tak, usuń','Yes, delete'),'confirm',()=>deleteChosen(),'tn-comments-danger');
      actions.append(cancel,confirm);
      if(author?.author&&!authorMode){
        const count=items.filter(item=>item.author===author.author).length;
        const all=button(more?tr(`Pokaż wszystkie od ${author.name}`,`Show all by ${author.name}`):tr(`Usuń wszystkie od ${author.name} (${count})`,`Delete all by ${author.name} (${count})`),'author',async()=>{
          closeConfirmation();
          if(more)await work(async()=>{while(more){const result=await client.load(true);if(disposed)return;items=result.items;more=result.more}status.textContent=tr(`Wczytano: ${items.length}.`,`Loaded: ${items.length}.`)});
          if(fresh&&!disposed)showConfirmation(items.filter(item=>item.author===author.author),author,trigger,true);
        },'tn-comments-danger');actions.append(all);
      }
      body.append(actions,node('p','tn-comments-confirm-note',tr('Usunięcia nie można cofnąć.','Deletion cannot be undone.')));confirmation.replaceChildren(h,body);
      if(!confirmation.open)confirmation.showModal();cancel.focus();
    }
    async function deleteChosen(){
      const ids=[...confirmationIds];if(!ids.length||busy)return;
      closeConfirmation();fresh=false;let count=0;
      await work(async()=>{await client.remove(ids,id=>{count++;items=items.filter(item=>item.id!==id);selected.delete(id);render();status.textContent=tr(`Usunięto ${count}/${ids.length}…`,`Deleted ${count}/${ids.length}…`)});status.textContent=tr(`Serwer potwierdził usunięcie: ${count}. Odśwież listę i status w grze.`,`Server confirmed ${count} deletions. Refresh the list and the status in the game.`)},()=>tr(`Potwierdzone usunięcia: ${count}/${ids.length}. `,`Confirmed deletions: ${count}/${ids.length}. `));
      refresh.focus();
    }
    function render(){
      if(disposed)return;list.replaceChildren();
      for(const item of visible()){
        const row=node('article','tn-comments-item'),person=node('div','tn-comments-person'),avatar=node('div','tn-comments-avatar');avatar.setAttribute('aria-hidden','true');avatar.append(node('span','',Array.from(item.name)[0]?.toUpperCase()||'?'));
        person.append(avatar,node('strong','',item.name));if(item.vip)person.append(node('span','tn-comments-vip','VIP'));
        if(item.profileId){
          if(!avatars.has(item.profileId))avatars.set(item.profileId,client.avatar(item.profileId).catch(()=>null));
          avatars.get(item.profileId).then(url=>{if(!url||!avatar.isConnected||disposed)return;const img=node('img','');img.alt='';img.referrerPolicy='no-referrer';img.onload=()=>avatar.querySelector('span')?.remove();img.onerror=()=>img.remove();img.src=url;avatar.append(img)});
        }
        const bubble=node('div','tn-comments-bubble');bubble.append(node('p','',item.text));
        const date=new Date(item.date);if(!Number.isNaN(date.getTime())){const time=node('time','',`${date.toLocaleTimeString(context.lang()==='pl'?'pl-PL':'en-GB',{hour:'2-digit',minute:'2-digit'})} ${date.toLocaleDateString(context.lang()==='pl'?'pl-PL':'en-GB')}`);time.dateTime=date.toISOString();bubble.append(time)}
        const trash=iconButton(tr(`Usuń komentarz użytkownika ${item.name}`,`Delete comment by ${item.name}`),'trash',()=>showConfirmation([item],item,trash),'trash','tn-comments-trash');trash.disabled=busy||!fresh;
        if(selectionMode){const check=node('input','tn-comments-check');check.type='checkbox';check.checked=selected.has(item.id);check.disabled=busy||!fresh;check.setAttribute('aria-label',tr('Zaznacz komentarz: ','Select comment: ')+item.name+' '+item.text);check.addEventListener('change',()=>{check.checked?selected.add(item.id):selected.delete(item.id);controls()});person.append(check)}
        row.append(person,bubble,trash);list.append(row);
      }
      if(!visible().length)list.append(node('div','tn-comments-empty',busy?tr('Wczytuję komentarze…','Loading comments…'):fresh?(items.length?tr('Brak pasujących komentarzy.','No matching comments.'):tr('Brak komentarzy pod tym statusem.','No comments on this status.')):tr('Odśwież, aby wczytać komentarze.','Refresh to load comments.')));
      controls();
    }
    function controls(){refresh.disabled=busy;toggle.disabled=busy||!fresh;toggle.textContent=tr(selectionMode?'Gotowe':'Zaznacz',selectionMode?'Done':'Select');toggle.setAttribute('aria-pressed',String(selectionMode));tools.hidden=!selectionMode;select.disabled=busy||!fresh||!visible().length;clear.disabled=busy||!selected.size;remove.disabled=busy||!fresh||!selected.size;remove.textContent=tr(`Usuń (${selected.size})`,`Delete (${selected.size})`);next.hidden=!more;next.disabled=busy||!fresh;stop.hidden=!busy;search.disabled=busy;list.setAttribute('aria-busy',String(busy))}
    async function work(action,prefix=()=> ''){
      if(busy||disposed)return;busy=true;render();status.textContent=tr('Ładowanie…','Loading…');
      try{await context.run(action)}catch(error){fresh=false;if(!disposed){const message=error.name==='AbortError'?tr('Zatrzymano. Odśwież listę — wysłane żądanie mogło już zostać wykonane.','Stopped. Refresh the list — a sent request may already have completed.'):tr(...(messages[error.message]||messages.http));status.textContent=prefix()+message+(error.diagnostic?` (${error.diagnostic})`:'')}}
      finally{busy=false;if(!disposed)render()}
    }
    async function load(loadMore){
      if(busy)return;closeConfirmation();
      if(!loadMore){controller.abort();controller=new AbortController();client=createClient(context,controller.signal);identity={...context.session()};avatars=new Map();items=[];selected.clear();fresh=false;more=false;}
      await work(async()=>{const result=await client.load(loadMore);if(disposed)return;items=result.items;more=result.more;fresh=true;status.textContent=tr(`Wczytano: ${items.length}${more?' · są kolejne strony':''}.`,`Loaded: ${items.length}${more?' · more pages available':''}.`)});
    }
    search.addEventListener('input',render);
    confirmation.addEventListener('cancel',event=>{event.preventDefault();closeConfirmation()});dialog.addEventListener('cancel',event=>{event.preventDefault();closeWindow()});
    root.addEventListener('keydown',event=>{
      const active=confirmation.open?confirmation:dialog.open?dialog:null;
      if(!active)return;
      if(event.key==='Escape'){event.preventDefault();event.stopPropagation();if(confirmation.open)closeConfirmation();else closeWindow()}
      if(event.key==='Tab'){
        const targets=[...active.querySelectorAll('button:not(:disabled),input:not(:disabled),[tabindex="0"]')].filter(e=>e.getClientRects().length);
        if(!targets.length)return;
        const index=targets.indexOf(root.getRootNode().activeElement);
        event.preventDefault();event.stopPropagation();targets[index<0?(event.shiftKey?targets.length-1:0):(index+(event.shiftKey?-1:1)+targets.length)%targets.length].focus();
      }
    });
    mounted={dispose(){disposed=true;controller.abort();if(confirmation.open)confirmation.close();if(dialog.open)dialog.close()},sync(){const now=context.session();if(!root.isConnected){if(busy)controller.abort();return}if(now.token!==identity.token||now.profileId!==identity.profileId||now.base!==identity.base){controller.abort();identity={...now};items=[];selected.clear();avatars.clear();fresh=false;more=false;closeConfirmation();render();status.textContent=tr(...messages.session)}}};
    render();
  }
  window.__tapnovaComments={createClient,mount,sync:()=>mounted?.sync()};
})();
