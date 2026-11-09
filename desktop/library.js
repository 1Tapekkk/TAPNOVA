'use strict';
(() => {
  const tools=[
    ['bots','Autografy','Społeczność','social','star','Wybierz odbiorców i rodzaj autografu.',['Zwykłe autografy i Halloween Greeting','Wysyłka kolejno do wybranych osób','Postęp, limity i zatrzymanie kolejki']],
    ['profile','Profil i styl','Twoje konto','account','user','Twoja postać, status i własne ustawienia.',['Profil i wygląd postaci','Status oraz komentarze pod statusem','Podgląd zmian przed wykonaniem']],
    ['homes','Dom','Twoje konto','account','grid','Zarządzaj swoją przestrzenią w MSP2.',['Wybór i narzędzia domu','Komentarze pod domkiem','Operacje na własnym koncie']],
    ['auto','Aktywności','Narzędzia','tools','bolt','Wszystkie aktywności w jednym miejscu.',['Wybór zadania i tempa pracy','Kontrola postępu oraz limitów','Zatrzymanie aktywnych operacji']],
    ['chatroom','Rozmowy','Społeczność','social','chat','Narzędzia rozmów i aktualnego pokoju.',['Uczestnicy bieżącego pokoju','Archiwum rozmów','Funkcje pokoju wymagają otwartej gry']],
    ['spam','Ochrona','Narzędzia','tools','shield','Ustawienia porządku i ochrony w pokoju.',['Filtry wiadomości','Ustawienia ochrony','Działanie na połączeniu z aktualnym pokojem']],
    ['misc','Dodatki','Narzędzia','tools','grid','Pozostałe narzędzia Twojej sesji.',['Dodatkowe opcje dostępne w panelu','Ustawienia dla bieżącego konta','Dostępność zależna od sesji MSP2']],
    ['emoji','Emotikony','Społeczność','social','star','Przeglądaj emotikony i wybieraj swoje ulubione.',['Biblioteka emotikonów','Wyszukiwanie dostępnych elementów','Szybki dostęp z panelu']],
    ['settings','Ustawienia','Twoje konto','account','settings','Dopasuj panel do swojego sposobu gry.',['Wygląd i rozmiar panelu','Zapisane zestawy ustawień','Import, eksport i przywracanie']],
    ['radar','Aktualności','Narzędzia','tools','refresh','Sprawdź informacje dostępne w panelu.',['Widok aktualności','Informacje o narzędziach','Szybki powrót do pozostałych sekcji']]
  ];
  const grid=document.querySelector('#tool-grid'),search=document.querySelector('#tool-search'),dialog=document.querySelector('#tool-dialog');
  let category='all';
  const norm=value=>value.toLocaleLowerCase('pl').normalize('NFD').replace(/\p{M}/gu,'').replace(/ł/g,'l');
  for(const [id,title,label,group,icon,description,features] of tools){
    const card=document.createElement('button');card.type='button';card.className='tool-card';card.dataset.tool=id;card.dataset.group=group;
    card.setAttribute('aria-label','Otwórz: '+title);card.setAttribute('aria-haspopup','dialog');
    card.innerHTML=`<span class="tool-symbol"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">${paths[icon]}</svg></span><span class="tool-tag">MSP2</span><strong></strong><span class="tool-category"></span><span class="tool-arrow" aria-hidden="true">↗</span><svg class="tool-watermark" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width=".65" aria-hidden="true">${paths[icon]}</svg>`;
    card.querySelector('strong').textContent=title;card.querySelector('.tool-category').textContent=description;
    card.addEventListener('click',()=>{
      document.querySelector('#tool-title').textContent=title;document.querySelector('#tool-description').textContent=description;
      document.querySelector('#tool-dialog-category').textContent=label;
      const list=document.querySelector('#tool-features');list.replaceChildren(...features.map(text=>{const li=document.createElement('li');li.textContent=text;return li}));
      document.querySelector('#tool-open').dataset.tab=id;dialog.showModal();
    });grid.append(card);
  }
  function filter(){
    const query=norm(search.value.trim());let count=0;
    for(const card of grid.children){const data=tools.find(t=>t[0]===card.dataset.tool);card.hidden=!((category==='all'||category===data[3])&&norm(data.slice(1).flat().join(' ')).includes(query));if(!card.hidden)count++}
    document.querySelector('#tool-count').textContent=`${count} z ${tools.length} narzędzi`;
    document.querySelector('#tool-empty').hidden=count!==0;
  }
  search.addEventListener('input',filter);
  document.querySelectorAll('[data-tool-filter]').forEach(button=>button.addEventListener('click',()=>{category=button.dataset.toolFilter;document.querySelectorAll('[data-tool-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));filter()}));
  document.querySelector('#tool-reset').addEventListener('click',()=>{search.value='';document.querySelector('[data-tool-filter="all"]').click();search.focus()});
  document.querySelector('#tool-close').addEventListener('click',()=>dialog.close());
  document.querySelector('#tool-open').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close()}});
  document.addEventListener('keydown',event=>{
    if(event.key==='/'&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&!document.querySelector('dialog[open]')&&!document.activeElement?.matches('input,textarea,select,[contenteditable=true]')&&!document.querySelector('#page-home').hidden){event.preventDefault();search.focus()}
  });filter();
})();
