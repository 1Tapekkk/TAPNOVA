// The control center renders only local UI. All game actions stay in app.js.
(() => {
  'use strict';
  const core = window.__tapnovaControl;
  const store = core.createStore(localStorage);
  const session = { mode:null, query:'', draft:'', preview:null, notice:'', error:'', deleted:null, importing:null, rename:null, remove:null };
  let current = null, timer = null;
  const el = (tag, className, text) => {
    const item = document.createElement(tag); item.className = className;
    if (text !== undefined) item.textContent = text;
    return item;
  };
  const tr = (pl, en) => current.context.lang() === 'pl' ? pl : en;
  const button = (text, action, className='') => {
    const item = el('button', 'tnc-button '+className, text); item.type='button';
    item.addEventListener('click', action); return item;
  };
  const normalize = value => String(value).toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu,'').replace(/ł/g,'l');
  const fields = {
    th:['Motyw','Theme'], pfn:['Czcionka','Font'], pop:['Krycie panelu','Panel opacity'], uis:['Dźwięki','Sounds'], uic:['Kompaktowy panel','Compact panel'],
    dsm:['Tryb ochrony','Protection mode'], dsl:['Próg poziomu','Level threshold'], dsw:['Równoległe zadania','Parallel tasks'],
    dsb:['Odstęp między paczkami','Batch interval'], dsf:['Próg wiadomości / 10 s','Messages per 10 s'], dsq:['Czas ciszy','Quiet period'], dsbc:['Równoległe blokady','Parallel blocks'],
    sc:['Tempo zbierania','Collection speed'], sm:['Tempo odczytu wiadomości','Message processing speed'], sa:['Tempo akceptowania zaproszeń','Accepting invitations'],
    sr:['Tempo odrzucania zaproszeń','Rejecting invitations'], sdl:['Usuwanie według poziomu','Removal by level'], sdv:['Usuwanie według VIP','Removal by VIP'], sal:['Tempo polubień','Like speed']
  };
  const activityNames = { quiz:['Quiz','Quiz'], dressup:['Dress Up','Dress Up'], autographs:['Autografy','Autographs'], afk:['Odpowiedzi AFK','AFK replies'], likes:['Polubienia','Likes'], protection:['Ochrona przed spamem','Spam protection'] };
  const operationNames = {
    gender:['Zmiana płci','Changing gender'], mood:['Zmiana nastroju','Changing mood'], status:['Zapisywanie statusu','Saving status'],
    roomTeleport:['Zmiana pokoju','Changing room'], restore:['Przywracanie statusu','Restoring status'], quests:['Codzienne zadania','Daily tasks'],
    crystals:['Zbieranie nagród','Collecting rewards'], acceptFriends:['Akceptowanie zaproszeń','Accepting invitations'], rejectFriends:['Odrzucanie zaproszeń','Rejecting invitations'],
    deleteFriendsLevel:['Usuwanie znajomych według poziomu','Removing friends by level'], deleteFriendsVip:['Usuwanie znajomych według VIP','Removing friends by VIP'], deleteFriendsAll:['Usuwanie znajomych','Removing friends'],
    readMessages:['Odczytywanie wiadomości','Reading messages'], avatar:['Przesyłanie zdjęcia','Uploading picture'], lookInspect:['Sprawdzanie ubrań','Inspecting clothes'],
    colorsPull:['Pobieranie kolorów','Fetching colors'], roomImage:['Przesyłanie zdjęcia pokoju','Uploading room image'], outfitCopy:['Zmiana stroju','Changing outfit'],
    homes:['Zmiana domu','Changing home'], homesHarvest:['Pobieranie domu','Fetching home'], profileLookup:['Wyszukiwanie profilu','Looking up profile'],
    moodPull:['Pobieranie nastroju','Fetching mood'], plazaFollow:['Podążanie za graczem','Following player'], dmSpamGuard:['Przetwarzanie wiadomości','Processing messages'],
    friendsList:['Pobieranie znajomych','Loading friends'], petClone:['Zmiana pupila','Changing pet']
  };
  const starters = [
    { id:'calm', name:['Spokojna sesja','Quiet session'], note:['Cisza i wolniejsze tempo zadań.','No sounds and slower task pacing.'], settings:{uis:'0',sc:'slow',sm:'slow',sa:'slow',sr:'slow',sdl:'slow',sdv:'slow',sal:'slow'} },
    { id:'daily', name:['Na co dzień','Everyday'], note:['Standardowe tempo i czytelny panel.','Standard pacing and a readable panel.'], settings:{th:'nova',pfn:'system',pop:'1',uic:'0',sc:'normal',sm:'normal',sa:'normal',sr:'normal',sdl:'normal',sdv:'normal',sal:'normal'} },
    { id:'compact', name:['Mały ekran','Small screen'], note:['Węższy panel i systemowa czcionka.','A narrower panel and system font.'], settings:{uic:'1',pfn:'system',pop:'1',uis:'0'} }
  ];
  // Each guide explains the actual operation, prerequisites and relevant limitations.
  const guides = [
    ['profile','Nastrój i animacja','Moods and animations','Wybierz wygląd zachowania postaci.','Choose how your avatar moves.', 'Nastrój wybierasz z biblioteki i zatwierdzasz przez „Zastosuj”. Po zmianie odwiedź sklep lub zmień pokój. Animacje uruchamiaj w pokoju gry.', 'Choose a mood from the library and apply it. Visit the shop or change rooms to refresh it. Play animations while in a game room.', 'mood animacja biblioteka'],
    ['profile','Profil, ubrania i kolory','Profile, clothes and colors','Najpierw wyszukaj gracza po nicku.','Find a player by nickname first.', '„Otwórz profil” pokazuje informacje o graczu. „Sprawdź” wyświetla ubrania i kody kolorów. Kliknięcie kodu kopiuje go; odczyt profilu sam nie zmienia Twojej postaci.', 'Open a profile to inspect a player. Inspect clothes and colors to see item details. Clicking a color code copies it; looking up a profile does not change your avatar.', 'nick id kolor kopiuj'],
    ['profile','Status i poprzednie wpisy','Status and previous posts','Zapisz nowy tekst albo przywróć poprzedni.','Save new text or restore an earlier post.', 'Najpierw utwórz status w grze. „Zapisz status” aktualizuje jego treść. „Przywróć status” otwiera poprzednie wpisy, aby wybrać konkretny do przywrócenia.', 'Create a status in the game first. Save status updates its text. Restore status opens earlier posts so you can choose one.', 'wayd post przywracanie'],
    ['profile','Zdjęcie profilowe','Profile picture','Wybierz plik i sprawdź podgląd.','Choose a file and inspect the preview.', 'Upuść obraz w polu zdjęcia lub wybierz go z komputera. Dopiero „Prześlij” wysyła zdjęcie. Jeśli serwer odrzuci duży plik, spróbuj mniejszego obrazu.', 'Drop an image or choose one from your computer. Upload sends it to the server. If a large file is rejected, try a smaller image.', 'avatar obraz png'],
    ['homes','Pobieranie i stosowanie domu','Fetching and applying a home','Pobranie do listy i zastosowanie to osobne operacje.','Saving to the list and applying are separate actions.', 'Wpisz nick lub ID profilu. „Tylko pobierz” dodaje dom do biblioteki. „Zastosuj dom” zmienia Twój dom na wybrany. Najpierw potrzebujesz własnego domu zapisanego w grze.', 'Enter a nickname or profile ID. Fetch only adds a home to the library. Apply home changes your home to the selected one. You need a saved home in the game first.', 'kopia biblioteka dom'],
    ['homes','Zdjęcie pokoju','Room image','To podgląd domu, a nie jego układ.','This is the home preview, not its layout.', 'Wybierz obraz i kliknij „Prześlij”. Ta opcja zmienia zdjęcie pokoju. Nie przestawia mebli ani nie przebudowuje domu.', 'Select an image and upload it. This changes the room preview image; it does not rearrange furniture or rebuild the home.', 'pokoj obraz tlo'],
    ['auto','Codzienne zadania','Daily tasks','Uruchom serię i obserwuj liczniki.','Start the sequence and watch its counters.', 'Panel wykonuje obsługiwane codzienne zadania. Zadania wymagające wydania StarCoins lub diamentów są pomijane. Po zakończeniu odśwież widok w grze, aby zobaczyć wyniki.', 'The panel performs supported daily tasks. Tasks that require spending StarCoins or diamonds are skipped. Refresh the game view afterwards to see the results.', 'quest misje'],
    ['auto','Porządkowanie znajomych','Managing friends','Sprawdź filtr przed uruchomieniem.','Check the filter before starting.', 'Akceptowanie i odrzucanie dotyczy oczekujących zaproszeń. Usuwanie według poziomu, VIP albo całej listy dotyczy obecnych znajomych. STOP zatrzymuje kolejne kroki, ale nie przywraca już usuniętych osób.', 'Accept and reject act on pending invitations. Removal by level, VIP or the entire list acts on existing friends. STOP cancels later steps but cannot restore people already removed.', 'usun zaproszenia vip poziom'],
    ['auto','Nieprzeczytane wiadomości','Unread messages','Oznacz rozmowy jako przeczytane.','Mark conversations as read.', 'Najpierw otwórz skrzynkę w grze. Przycisk przetwarza nieprzeczytane rozmowy i aktualizuje licznik. Nie wysyła odpowiedzi do rozmówców.', 'Open the game inbox first. The button processes unread conversations and updates their count. It does not send replies.', 'dm skrzynka'],
    ['bots','Bot quizu i Dress Up','Quiz and Dress Up bots','Włącz wybraną funkcję, potem wejdź do gry.','Enable a feature, then join its game.', 'Quiz korzysta z dołączonej bazy odpowiedzi. Dress Up automatyzuje kolejne etapy rund. Pasek aktywności pokazuje włączone funkcje; STOP przerywa także oczekujące odpowiedzi.', 'The quiz uses the included answer database. Dress Up automates round stages. The activity bar shows enabled features; STOP also cancels pending responses.', 'starquiz pytania rundy'],
    ['bots','Autografy i limity','Autographs and limits','Wybierz odbiorców, styl oraz liczbę.','Choose recipients, style and quantity.', 'Otwórz panel autografów i wybierz graczy. Sprawdź koszt wybranego stylu. Tempo zależy od ograniczeń serwera i konta. „Bez limitu” działa aż do ręcznego zatrzymania albo błędu.', 'Open the autograph panel and choose players. Check the selected style’s cost. Pacing depends on server and account limits. Unlimited continues until stopped manually or interrupted by an error.', 'imza podpis greeting'],
    ['misc','Tryb nieobecności (AFK)','Away mode (AFK)','Ustaw tekst odpowiedzi i słowa wywołujące.','Set a reply and its trigger words.', 'Tryb AFK może odpowiadać na wzmianki na czacie. „Automatyczna odpowiedź na wiadomości prywatne” jest osobnym przełącznikiem i wymaga włączonego AFK. {nick} wstawia nazwę rozmówcy.', 'AFK can reply to mentions in chat. Private-message replies have a separate switch and require AFK to be on. {nick} inserts the other player’s name.', 'afk odpowiedz nieobecnosc'],
    ['misc','Filtr czatu','Chat filter','Przełącznik zmienia sposób wysyłania tekstu.','The switch changes how text is sent.', 'Panel modyfikuje zapis wysyłanych wiadomości. Wyłączenie przywraca zwykły sposób pisania. To osobna opcja od automatycznych odpowiedzi AFK.', 'The panel modifies outgoing text formatting. Switching it off restores normal typing. This is separate from automatic AFK replies.', 'bypass tekst'],
    ['emoji','Ulubione emotki','Favorite emoji','Prawy przycisk myszy otwiera opcje.','Right-click to open options.', 'Szukaj emotek lub wybierz kategorię. Prawy przycisk myszy pozwala skopiować emotkę i zarządzać listami ulubionych oraz najczęściej używanych.', 'Search emoji or choose a category. Right-click to copy an emoji or manage your favorites and most-used lists.', 'emoji ulubione ppm'],
    ['chatroom','Lista graczy i aktywność','Players and activity','Dane pojawiają się po wejściu do pokoju.','Data appears after joining a room.', 'Lista pokazuje graczy wykrytych w aktualnym pokoju. Aktywność zawiera dołączenia, wyjścia i zmiany nastroju. Pusta lista może oznaczać, że jeszcze nie dołączono do pokoju.', 'The list shows players detected in the current room. Activity includes joins, departures and mood changes. An empty list may mean you have not joined a room yet.', 'czat pokoj ghost'],
    ['spam','Próg wiadomości i czas ciszy','Message threshold and quiet period','Określ, kiedy reakcja na spam ma się uruchomić.','Set when spam handling should react.', 'Próg to liczba wiadomości w oknie 10 sekund. Czas ciszy określa okres uspokojenia po natłoku wiadomości. Zmniejszenie progu może powodować częstsze reakcje ochrony.', 'The threshold counts messages within ten seconds. The quiet period controls recovery after a burst. Lowering the threshold can make protection react more often.', 'flood dm quiet spam'],
    ['spam','Równoległe zadania i paczki','Parallel tasks and batches','Ustawienia tempa przetwarzania.','Processing speed settings.', '„Równoległe zadania” to liczba pracujących zadań. „Odstęp między paczkami” to przerwa między seriami. Więcej zadań i krótsza przerwa zwiększają liczbę żądań; serwer nadal może je ograniczyć.', 'Parallel tasks controls the number of workers. Batch interval is the delay between groups. More tasks and shorter intervals increase requests; the server can still rate-limit them.', 'worker batch flush wydajnosc'],
    ['spam','Blokada awaryjna','Emergency blocking','Wzmożona reakcja ochrony na napływ spamu.','An intensified response to incoming spam.', 'Ta opcja uruchamia tryb blokowania w module ochrony. Nie jest tym samym co „Zatrzymaj wszystko”, które wyłącza automatyzacje, w tym samą ochronę przed spamem.', 'This starts the protection module’s blocking mode. It is different from Stop all, which disables automation including spam protection itself.', 'lockdown blokada'],
    ['settings','Własne zestawy ustawień','Your settings sets','Zapisuj, porównuj i stosuj konfiguracje.','Save, compare and apply configurations.', 'Zestaw obejmuje wygląd, dźwięki, tempo i parametry ochrony. Przed zastosowaniem zobaczysz różnice. Nie zapisuje loginu, haseł, graczy ani treści wiadomości i nie uruchamia botów. Ostatnią zmianę możesz cofnąć.', 'A set includes appearance, sound, pacing and protection parameters. Review differences before applying. It does not save credentials, players or message content, and does not start bots. You can undo the last application.', 'preset konfiguracja eksport import'],
    ['settings','Zatrzymaj wszystko','Stop all','Zatrzymaj działanie narzędzi jednym kliknięciem.','Stop toolkit activity with one click.', 'Przycisk wyłącza boty, autografy, AFK, polubienia i ochronę, przerywa żądania narzędzi oraz kolejne kroki zadań. Nie cofa operacji już przyjętych przez serwer. „Odblokuj narzędzia” umożliwia nowe akcje; automatyzacje włączasz ponownie samodzielnie.', 'The button disables bots, autographs, AFK, likes and protection, aborts toolkit requests and stops subsequent task steps. It cannot undo operations already accepted by the server. Unlock tools allows new actions; restart automation yourself.', 'stop pauza anuluj'],
    ['settings','Wygląd panelu','Panel appearance','Dopasuj motyw, czcionkę i tło.','Customize theme, font and background.', 'Wybrany kolor jest używany jako akcent. Krycie zmienia tło panelu. Własny obraz tła wybierasz osobno; zdjęcia nie są dodawane do eksportowanych zestawów ustawień.', 'The chosen color is used as an accent. Opacity changes the panel background. Custom background images are chosen separately and are not included in exported sets.', 'motyw kolor przezroczystosc czcionka'],
    ['radar','Informacje o wydaniu','Release notes','Sprawdź, co zmieniło się w panelu.','See what changed in the panel.', 'Tutaj znajdziesz informacje dołączone do wydania. Pomoc pod przyciskiem „Co to robi?” opisuje funkcje aktualnego interfejsu.', 'This section contains the notes included with the release. What does this do? explains features of the current interface.', 'nowosci aktualizacja']
  ];
  const css = `
    .tnc-bar{flex-shrink:0;padding:10px 18px;background:#1b1922;border-bottom:1px solid #ffffff10;color:#eee9f6}
    .tnc-line{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}
    .tnc-meta{display:flex;align-items:center;gap:7px;font-size:10px;min-width:0;color:#bcb3cb}
    .tnc-dot{width:6px;height:6px;border-radius:50%;background:#8ce6cf;flex-shrink:0}
    .tn-panel[data-tn-paused=true] .tnc-dot{background:#f5b291}
    .tnc-actions{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}
    .tnc-button{font:600 11px/1.4 'Segoe UI',sans-serif;color:#e2daed;background:#ffffff07;border:1px solid #ffffff16;border-radius:7px;padding:8px 10px;cursor:pointer;min-height:32px;text-align:center}
    .tnc-button:hover{background:#ffffff12;border-color:#b7a1db}
    .tnc-button:disabled{opacity:.45;cursor:not-allowed}
    .tnc-button[aria-expanded=true],.tnc-primary{background:var(--tn-accent,#b8a4ff);color:#20192d;border-color:transparent}
    .tnc-danger{color:#ffc3b2;border-color:#ef9c7b55;background:#dc795114}
    .tnc-stop{margin-left:auto;white-space:normal!important}
    .tnc-summary{font-size:10px;color:#a99fb7;line-height:1.5;margin-top:7px}
    .tnc-center{margin-bottom:18px;color:#ece6f3;min-width:0}
    .tnc-heading{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:14px}
    .tnc-kicker{font-size:9px;letter-spacing:.12em;color:var(--tn-accent,#b8a4ff);font-weight:700;text-transform:uppercase;margin-bottom:5px}
    .tnc-title{font-size:24px;line-height:1.12;font-weight:750;letter-spacing:-.7px;margin:0}
    .tnc-copy{font-size:11px;line-height:1.7;color:#b7adC4;margin:8px 0 0}
    .tnc-input{width:100%;padding:10px 12px;border:1px solid #ffffff20;border-radius:7px;background:#101017;color:#f2ebfb;font:12px 'Segoe UI',sans-serif;box-sizing:border-box}
    .tnc-search{margin:0 0 12px}
    .tnc-label{font-size:10px;font-weight:600;color:#c9bfd7;display:block;margin-bottom:6px}
    .tnc-row{display:flex;gap:7px;align-items:center}.tnc-row .tnc-input{flex:1;min-width:0}
    .tnc-group{margin-top:19px}.tnc-group-title{font-size:11px;font-weight:700;margin:0 0 9px}
    .tnc-card{padding:12px;border:1px solid #ffffff12;background:#ffffff03;border-radius:9px;margin-bottom:8px;min-width:0}
    .tnc-card-title{font-size:12px;font-weight:650;overflow-wrap:anywhere}
    .tnc-card small{display:block;color:#a99fb7;font-size:10px;line-height:1.6;margin-top:4px}
    .tnc-card-actions{display:flex;gap:6px;margin-top:10px;flex-wrap:wrap}.tnc-card-actions .tnc-button{padding:6px 9px;font-size:10px}
    .tnc-card summary{cursor:pointer;list-style:none;display:flex;gap:12px;justify-content:space-between;align-items:center}
    .tnc-card summary::-webkit-details-marker{display:none}.tnc-card summary::after{content:'+';font-size:18px;color:var(--tn-accent)}
    .tnc-card[open] summary::after{content:'−'}.tnc-card[open]{border-color:#b8a4ff50}
    .tnc-card p{font-size:11px;line-height:1.8;color:#c7bcd6;margin:12px 0 0}
    .tnc-empty{border:1px dashed #ffffff22;border-radius:9px;padding:18px 14px;color:#b7adc4;font-size:11px;line-height:1.7}
    .tnc-notice{font-size:11px;line-height:1.6;padding:9px 11px;margin:0 0 12px;border-radius:6px;background:#8ce6cf12;color:#a8e9d9;border:1px solid #8ce6cf25;overflow-wrap:anywhere}
    .tnc-error{background:#ed9a7712;color:#ffc7b2;border-color:#ed9a7735}
    .tnc-diff{width:100%;border-collapse:collapse;font-size:10px;table-layout:fixed;margin:12px 0}
    .tnc-diff th,.tnc-diff td{text-align:left;border-bottom:1px solid #ffffff10;padding:9px 6px;overflow-wrap:anywhere;vertical-align:top}
    .tnc-diff th{color:#ab9fbc;font-weight:500}.tnc-diff td:last-child{color:#cfc0fc}
    .tnc-diff td:first-child{width:38%}.tnc-file{display:none}
    .tn-panel[data-tn-center=presets] .tn-content>:not(.tnc-center){display:none!important}
    .tn-panel[data-tn-paused=true] .tn-content>[inert]{opacity:.45}
    .tn-panel[data-tn-minimized=true] .tnc-bar{display:none}
    @container(max-width:400px){.tnc-bar{padding:9px 12px}.tnc-button{font-size:10px;padding:7px 8px}.tnc-title{font-size:22px}.tnc-actions{gap:5px}.tnc-stop{max-width:145px}}
  `;
  function errorText(error) {
    const messages = {
      name:['Wpisz nazwę od 1 do 40 znaków.','Enter a name of 1–40 characters.'],
      duplicate:['Zestaw o tej nazwie już istnieje. Użyj innej nazwy.','A set with this name already exists. Use a different name.'],
      limit:['Możesz zapisać maksymalnie 20 zestawów.','You can store up to 20 sets.'],
      active:['Najpierw zatrzymaj aktywne zadania przyciskiem u góry.','Stop active tasks using the button above first.'],
      settings:['Plik zawiera nieobsługiwane ustawienia lub wartości. Nic nie zmieniono.','The file contains unsupported settings or values. Nothing was changed.'],
      file:['Wybierz plik JSON z zestawami TAPNOVA (maks. 64 KB, wersja 1).','Choose a TAPNOVA settings JSON file (up to 64 KB, version 1).'],
      empty:['Ten plik nie zawiera zestawów.','This file contains no sets.']
    };
    return tr(...(messages[error?.message] || ['Nie udało się zapisać danych. Sprawdź dostępne miejsce w pamięci aplikacji.','Could not save data. Check available application storage.']));
  }
  function notify(text) { session.error=''; session.notice=text; }
  function fail(error) { session.notice=''; session.error=errorText(error); render(); }
  function perform(action) { try { action(); } catch (error) { fail(error); } }
  function valueLabel(key,value) {
    if (value === undefined) return '—';
    const names = { very_slow:['Bardzo wolno','Very slow'], slow:['Wolno','Slow'], normal:['Normalnie','Normal'], fast:['Szybko','Fast'], very_fast:['Bardzo szybko','Very fast'], agresif:['Agresywnie','Aggressive'], max:['Maksymalne tempo','Maximum speed'], system:['Systemowa','System'], nova:['TAPNOVA','TAPNOVA'] };
    if (key==='uis'||key==='uic') return value==='1'?tr('Włączone','On'):tr('Wyłączone','Off');
    if (key==='pop') return Math.round(Number(value)*100)+'%';
    if (key==='dsb') return value+' ms';
    if (key==='dsq') return value+' s';
    if (names[value]) return tr(...names[value]);
    if (key==='th') {
      const legacy={yellow:'Sari',amber:'Kehribar',orange:'Turuncu',red:'Kirmizi',purple:'Mor',blue:'Mavi',green:'Yesil',white:'Beyaz',silver:'Gumus',pink:'Pembe',violet:'Menekse',coral:'Mercan',rose:'Gul',fuchsia:'Fusya',sky:'Gok',cyan:'Camgobegi',teal:'Deniz',emerald:'Zumrut',lime:'Lime',ice:'Buz',void:'Siyah',neonpink:'Neon Pembe',neoncyan:'Neon Cyan',neonlime:'Neon Lime',neongold:'Neon Altın',neonpurple:'Neon Mor',neonorange:'Neon Turuncu'};
      if(current.context.lang()==='pl')return window.__tapnovaPL?.text[legacy[value]]||String(value);
    }
    return String(value);
  }
  function open(mode) {
    session.mode=session.mode===mode?null:mode; session.preview=null; session.importing=null;
    session.notice='';session.error='';render();sync();
    if(session.mode)current.context.refs.body.scrollTop=0;
    if(session.mode==='help')current.host.querySelector('input')?.focus();
  }
  function heading(title,description) {
    const row=el('div','tnc-heading'), copy=el('div','');
    copy.append(el('div','tnc-kicker',tr('Twoje centrum sterowania','Your control center')),el('h2','tnc-title',title));
    if(description)copy.append(el('p','tnc-copy',description));
    const close=button('×',()=>{const mode=session.mode;session.mode=null;render();sync();(mode==='help'?current.help:current.presets).focus();});
    close.setAttribute('aria-label',tr('Zamknij centrum','Close center'));
    row.append(copy,close);return row;
  }
  function showHelp(host) {
    host.append(heading(tr('Co to robi?','What does this do?'),tr('Wyjaśnienia bez zgadywania. Szukaj po nazwie lub rozwiń opis.','Clear explanations. Search by name or expand a guide.')));
    const label=el('label','tnc-label',tr('Szukaj funkcji','Find a feature'));
    const input=el('input','tnc-input tnc-search');input.type='search';input.value=session.query;input.placeholder=tr('Np. autograf, AFK, worker…','E.g. autograph, AFK, worker…');
    label.append(input);host.append(label);
    const results=el('div','');host.append(results);
    function paintResults(){
      results.replaceChildren();const query=normalize(session.query.trim());
      const list=guides.filter(g=>query?normalize(g.join(' ')).includes(query):g[0]===current.context.active());
      results.append(el('h3','tnc-group-title',query?tr('Wyniki: ','Results: ')+list.length:tr('W tej zakładce','In this section')));
      if(!list.length)results.append(el('div','tnc-empty',tr('Brak wyników. Spróbuj krótszej nazwy, np. „dom” lub „spam”.','No matches. Try a shorter term such as home or spam.')));
      for(const guide of list){
        const details=el('details','tnc-card'),summary=el('summary',''),copy=el('div','');
        copy.append(el('div','tnc-card-title',tr(guide[1],guide[2])),el('small','',tr(guide[3],guide[4])));summary.append(copy);
        details.append(summary,el('p','',tr(guide[5],guide[6])));
        if(query&&guide[0]!==current.context.active())details.append(button(tr('Przejdź do zakładki →','Go to section →'),()=>{session.mode=null;session.query='';current.context.select(guide[0]);render();sync();}));
        results.append(details);
      }
      const all=button(query?tr('Pokaż pomoc tej zakładki','Show this section’s help'):tr('Zobacz wszystkie funkcje','See all features'),()=>{session.query=query?'':' ';input.value='';if(!query){results.replaceChildren();for(const guide of guides){const row=button(tr(guide[1],guide[2]),()=>{session.query=guide[1];input.value=session.query;paintResults();});row.style.margin='0 6px 6px 0';results.append(row)}}else paintResults();});
      results.append(all);
    }
    input.addEventListener('input',()=>{session.query=input.value;paintResults()});paintResults();
  }
  function previewSet(item) { session.preview=item;session.notice='';session.error='';session.importing=null;render();current.context.refs.body.scrollTop=0;current.host.querySelector('h2')?.focus(); }
  function differences(settings) {
    const before=current.context.controls.capture();
    return Object.entries(settings).filter(([key,value])=>String(before[key])!==String(value));
  }
  function showPreview(host) {
    const item=session.preview, changes=differences(item.settings), snapshot=current.context.controls.capture();
    host.append(heading(item.name,tr('Sprawdź zmiany przed zastosowaniem. Pozostałe ustawienia zostaną zachowane.','Review changes before applying. Other settings will be preserved.')));
    if(changes.length){
      const table=el('table','tnc-diff'),head=el('thead',''),row=el('tr','');
      for(const name of [tr('Ustawienie','Setting'),tr('Teraz','Current'),tr('Po zmianie','New')])row.append(el('th','',name));
      head.append(row);table.append(head);const body=el('tbody','');
      for(const [key,value] of changes){const row=el('tr','');row.append(el('td','',tr(...fields[key])),el('td','',valueLabel(key,snapshot[key])),el('td','',valueLabel(key,value)));body.append(row)}
      table.append(body);host.append(table);
    }else host.append(el('div','tnc-empty',tr('Ten zestaw jest już zgodny z bieżącymi ustawieniami.','This set already matches your current settings.')));
    host.append(el('p','tnc-copy',tr('Zastosowanie nie uruchamia botów ani ochrony. Nie zmienia konta, języka, tła ze zdjęcia ani zapisanych domów.','Applying does not start bots or protection. Your account, language, background image and saved homes stay unchanged.')));
    const actions=el('div','tnc-card-actions');
    const apply=button(tr('Zastosuj zmiany','Apply changes'),()=>perform(()=>{
      const selected=session.preview;session.preview=null;notify(tr('Zastosowano: ','Applied: ')+selected.name);
      try{current.context.controls.apply(selected.settings)}catch(error){session.preview=selected;throw error}render();
    }),'tnc-primary');apply.dataset.tncApply='1';apply.disabled=!changes.length;
    actions.append(apply,button(tr('Wróć do zestawów','Back to sets'),()=>{session.preview=null;render()}));host.append(actions);
    const busy=el('p','tnc-copy');busy.dataset.tncBusy='1';host.append(busy);
  }
  function showSets(host) {
    if(session.preview){showPreview(host);return;}
    host.append(heading(tr('Ustaw po swojemu.','Make it yours.'),tr('Zapisz sprawdzoną konfigurację. Przed każdą zmianą zobaczysz jej podgląd.','Save a configuration you like. Preview every change before applying.')));
    const undo=button(tr('↶ Cofnij ostatnie zastosowanie','↶ Undo last application'),()=>perform(()=>{notify(tr('Przywrócono poprzednie ustawienia.','Previous settings restored.'));current.context.controls.undo();render()}));
    undo.dataset.tncUndo='1';host.append(undo);
    if(session.importing){
      const card=el('div','tnc-card');card.append(el('div','tnc-card-title',tr('Zestawy do importu','Sets to import')));
      for(const item of session.importing.items)card.append(el('small','',item.name+' · '+Object.keys(item.settings).length+tr(' ustawień',' settings')));
      const row=el('div','tnc-card-actions');row.append(button(tr('Dodaj te zestawy','Add these sets'),()=>perform(()=>{store.import(session.importing.raw);session.importing=null;notify(tr('Zaimportowano zestawy. Ustawienia nie zostały zmienione.','Sets imported. Current settings were not changed.'));render()}),'tnc-primary'),button(tr('Anuluj','Cancel'),()=>{session.importing=null;render()}));card.append(row);host.append(card);
    }
    const saveGroup=el('section','tnc-group');const label=el('label','tnc-label',tr('Zapisz bieżące ustawienia jako','Save current settings as'));
    const form=el('form','tnc-row'),name=el('input','tnc-input');name.maxLength=40;name.placeholder=tr('Np. Mój wieczorny zestaw','E.g. My evening setup');name.required=true;name.value=session.draft;name.addEventListener('input',()=>session.draft=name.value);name.setAttribute('aria-label',tr('Nazwa nowego zestawu','New set name'));
    label.htmlFor='tnc-new-name';name.id='tnc-new-name';const save=el('button','tnc-button tnc-primary',tr('Zapisz','Save'));save.type='submit';
    form.append(name,save);form.addEventListener('submit',event=>{event.preventDefault();perform(()=>{store.save(name.value,current.context.controls.capture());session.draft='';notify(tr('Zapisano zestaw.','Set saved.'));render();current.host.querySelector('#tnc-new-name')?.focus()})});saveGroup.append(label,form);host.append(saveGroup);
    const builtin=el('section','tnc-group');builtin.append(el('h3','tnc-group-title',tr('Dobry punkt wyjścia','A useful starting point')));
    for(const item of starters){const card=el('div','tnc-card');card.append(el('div','tnc-card-title',tr(...item.name)),el('small','',tr(...item.note)));const actions=el('div','tnc-card-actions');actions.append(button(tr('Porównaj ustawienia →','Compare settings →'),()=>previewSet({name:tr(...item.name),settings:item.settings})));card.append(actions);builtin.append(card)}host.append(builtin);
    const own=el('section','tnc-group');let sets;
    try{sets=store.read()}catch(error){host.append(el('div','tnc-notice tnc-error',errorText(error)));return;}
    own.append(el('h3','tnc-group-title',tr('Twoje zestawy','Your sets')+' · '+sets.length+'/20'));
    if(!sets.length)own.append(el('div','tnc-empty',tr('Jeszcze bez zestawów. Dopasuj panel w ustawieniach, wpisz nazwę powyżej i zapisz swoją pierwszą konfigurację.','No saved sets yet. Adjust the panel settings, enter a name above and save your first configuration.')));
    for(const item of sets){
      const card=el('div','tnc-card');card.dataset.tncSet=item.name;card.append(el('div','tnc-card-title',item.name));
      card.append(el('small','',Object.keys(item.settings).length+tr(' ustawień · zapisane na tym urządzeniu',' settings · saved on this device')));
      const actions=el('div','tnc-card-actions');
      if(session.remove===item.name){actions.append(el('span','tnc-copy',tr('Usunąć ten zestaw?','Delete this set?')),button(tr('Usuń','Delete'),()=>perform(()=>{store.remove(item.name);session.deleted=item;session.remove=null;notify(tr('Usunięto zestaw. Możesz go przywrócić.','Set deleted. You can restore it.'));render()}),'tnc-danger'),button(tr('Anuluj','Cancel'),()=>{session.remove=null;render()}));}
      else if(session.rename===item.name){const input=el('input','tnc-input');input.value=item.name;input.maxLength=40;input.setAttribute('aria-label',tr('Nowa nazwa','New name'));actions.append(input,button(tr('Zapisz nazwę','Save name'),()=>perform(()=>{store.rename(item.name,input.value);session.rename=null;notify(tr('Zmieniono nazwę.','Renamed.'));render()})),button(tr('Anuluj','Cancel'),()=>{session.rename=null;render()}));}
      else actions.append(button(tr('Porównaj i zastosuj','Compare and apply'),()=>previewSet(item)),button(tr('Zmień nazwę','Rename'),()=>{session.rename=item.name;render()}),button(tr('Usuń','Delete'),()=>{session.remove=item.name;render()},'tnc-danger'));
      card.append(actions);own.append(card);
    }
    if(session.deleted)own.append(button(tr('↶ Przywróć usunięty zestaw','↶ Restore deleted set'),()=>perform(()=>{store.save(session.deleted.name,session.deleted.settings);session.deleted=null;notify(tr('Przywrócono zestaw.','Set restored.'));render()})));
    if(sets.length)host.insertBefore(own,builtin);else host.append(own);
    const files=el('section','tnc-group');files.append(el('h3','tnc-group-title',tr('Przenieś swoje ustawienia','Take your settings with you')));
    const actions=el('div','tnc-card-actions');const exportButton=button(tr('Eksportuj JSON','Export JSON'),()=>perform(()=>{
      const blob=new Blob([store.serialize(store.read())],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='tapnova-zestawy.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);notify(tr('Przygotowano plik zestawów.','Settings file prepared.'));render();
    }));exportButton.disabled=!sets.length;
    const file=el('input','tnc-file');file.type='file';file.accept='.json,application/json';file.setAttribute('aria-label',tr('Importuj zestawy','Import sets'));
    file.addEventListener('change',async()=>{try{const selected=file.files?.[0];if(!selected)return;if(selected.size>65536)throw Error('file');const raw=await selected.text();session.importing={raw,items:store.previewImport(raw)};session.preview=null;session.error='';session.notice='';render();current.context.refs.body.scrollTop=0;}catch(error){fail(error)}finally{file.value=''}});
    actions.append(exportButton,button(tr('Importuj JSON','Import JSON'),()=>file.click()),file);files.append(actions,el('p','tnc-copy',tr('Plik zawiera wyłącznie ustawienia panelu i parametrów zadań. Import najpierw pokazuje listę; nie nadpisuje istniejących zestawów.','Files contain only panel settings and task parameters. Import previews the list first and never overwrites existing sets.')));host.append(files);
  }
  function render() {
    if(!current)return;
    const {host,panel}=current;host.replaceChildren();host.hidden=!session.mode;panel.dataset.tnCenter=session.mode||'';
    if(!session.mode)return;
    if(session.notice){const message=el('div','tnc-notice',session.notice);message.setAttribute('role','status');host.append(message)}
    if(session.error){const message=el('div','tnc-notice tnc-error',session.error);message.setAttribute('role','alert');host.append(message)}
    if(session.mode==='help')showHelp(host);else showSets(host);
    sync();
  }
  function sync() {
    if(!current||!current.panel.isConnected)return;
    const {context,panel,status,summary,stop,help,presets,host}=current;
    const state=context.controls.activity();if(panel.dataset.tnPaused!==String(state.paused))panel.dataset.tnPaused=String(state.paused);
    const statusText=state.paused?tr('Narzędzia zatrzymane','Tools stopped'):state.items.length?tr('Aktywne funkcje: ','Active features: ')+state.items.length:tr('Gotowe. Ty decydujesz, co uruchomić.','Ready. You choose what to run.');
    if(status.textContent!==statusText)status.textContent=statusText;
    const detail=state.paused?(state.pending?tr('Kończenie przerwanych zadań…','Finishing cancelled tasks…'):tr('Możesz odblokować panel. Automatyzacje pozostaną wyłączone.','Unlock the panel when ready. Automation will remain off.')):state.items.map(id=>tr(...(activityNames[id]||operationNames[id.slice(3)]||['Zadanie w toku','Task in progress']))).join(' · ');
    if(summary.textContent!==detail)summary.textContent=detail;if(summary.hidden!==!detail)summary.hidden=!detail;
    const stopText=state.paused?(state.pending?tr('Zatrzymywanie…','Stopping…'):tr('Odblokuj narzędzia','Unlock tools')):tr('■ Zatrzymaj wszystko','■ Stop all');
    if(stop.textContent!==stopText)stop.textContent=stopText;if(stop.disabled!==(state.paused&&state.pending>0))stop.disabled=state.paused&&state.pending>0;
    for(const [node,expanded] of [[help,session.mode==='help'],[presets,session.mode==='presets']])if(node.getAttribute('aria-expanded')!==String(expanded))node.setAttribute('aria-expanded',String(expanded));
    for(const [key,pane]of Object.entries(context.refs.panes||{})){const inert=state.paused&&key!=='settings'&&key!=='radar';if(pane.inert!==inert)pane.inert=inert;}
    const fav=context.refs.body.querySelector('[data-panel-chrome="fav-bar"]');if(fav&&fav.inert!==state.paused)fav.inert=state.paused;
    host.querySelectorAll('[data-tnc-undo]').forEach(node=>node.disabled=!state.canUndo||state.items.length>0||state.pending>0);
    const apply=host.querySelector('[data-tnc-apply]');if(apply)apply.disabled=!session.preview||!differences(session.preview.settings).length||state.items.length>0||state.pending>0;
    const busy=host.querySelector('[data-tnc-busy]');if(busy)busy.textContent=state.items.length||state.pending?tr('Przed zastosowaniem zatrzymaj aktywne zadania przyciskiem u góry.','Stop active tasks using the button above before applying.'):' ';
    if(current.tab!==context.active()){current.tab=context.active();if(session.mode==='help')render();else if(session.mode==='presets'){session.mode=null;render();}}
  }
  function mount(panel,context) {
    if(!context.controls)return;
    if(timer)clearInterval(timer);
    const sheet=el('style','');sheet.textContent=css;panel.append(sheet);
    const bar=el('section','tnc-bar');bar.setAttribute('aria-label',context.lang()==='pl'?'Centrum sterowania':'Control center');
    const line=el('div','tnc-line'),meta=el('div','tnc-meta'),status=el('span','');meta.append(el('span','tnc-dot'),status);line.append(meta);
    const actions=el('div','tnc-actions'),summary=el('div','tnc-summary');
    const host=el('section','tnc-center');host.id='tnc-center';host.hidden=true;
    current={panel,context,host,status,summary,tab:context.active()};
    const help=button(tr('? Co to robi?','? What does this do?'),()=>open('help'));
    const presets=button(tr('Zestawy ustawień','Settings sets'),()=>open('presets'));
    const stop=button('',()=>perform(()=>{if(context.controls.activity().paused){if(context.controls.resume())notify(tr('Narzędzia odblokowane. Automatyzacje włączysz samodzielnie.','Tools unlocked. Restart automation yourself.'));}else{session.notice='';session.error='';context.controls.stop();}sync();}),'tnc-danger tnc-stop');
    stop.dataset.tncStop='1';help.dataset.tncHelp='1';presets.dataset.tncPresets='1';
    help.setAttribute('aria-controls',host.id);presets.setAttribute('aria-controls',host.id);
    Object.assign(current,{help,presets,stop});actions.append(help,presets,stop);bar.append(line,actions,summary);
    context.refs.tabBar.after(bar);context.refs.body.prepend(host);
    host.addEventListener('keydown',event=>{event.stopPropagation();if(event.key==='Escape'){event.preventDefault();const mode=session.mode;session.mode=null;render();sync();(mode==='help'?help:presets).focus();}});
    render();queueMicrotask(sync);
    timer=setInterval(()=>{if(!current?.panel.isConnected){clearInterval(timer);timer=null;return}if(!document.hidden&&current.panel.style.display!=='none')sync()},1000);
  }
  window.__tapnovaCenter={mount,sync};
})();
