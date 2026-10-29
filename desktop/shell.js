'use strict';
const paths = {
  camera:'<path d="M3 7h4l2-3h6l2 3h4v13H3z"/><circle cx="12" cy="13" r="4"/>',
  home:'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
  play:'<path d="m8 5 11 7-11 7z"/>',
  user:'<circle cx="12" cy="8" r="4"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/>',
  star:'<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9z"/>',
  bolt:'<path d="m13 2-9 12h7l-1 8 10-12h-8z"/>',
  grid:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  chat:'<path d="M21 11a9 9 0 0 1-9 9H3l2-5a9 9 0 1 1 16-4Z"/><path d="M8 10h8M8 14h5"/>',
  shield:'<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6z"/><path d="m8 12 3 3 5-6"/>',
  help:'<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 4 2c-1 .6-1.5 1-1.5 2M12 17h.01"/>',
  settings:'<path d="m9 3-1 3-3 1v3l-2 2 2 2v3l3 1 1 3h6l1-3 3-1v-3l2-2-2-2V7l-3-1-1-3z"/><circle cx="12" cy="12" r="3"/>',
  refresh:'<path d="M20 7v5h-5M4 17v-5h5"/><path d="M6 6a8 8 0 0 1 13 2M18 18A8 8 0 0 1 5 16"/>',
  arrow:'<path d="M4 12h16m-6-6 6 6-6 6"/>'
};
document.querySelectorAll('[data-icon]').forEach(el=>{el.innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[el.dataset.icon]||paths.star}</svg>`;});
const api = window.tapnova;
document.querySelector('#platform').textContent = api?.platform === 'darwin' ? '· macOS' : '· Windows';
function displayStatus(value) {
  document.querySelector('#status-text').textContent=value.text;
  const connection=document.querySelector('#connection');
  connection.dataset.state=value.kind;
  connection.lastChild.textContent=value.kind==='loading'?'Ładowanie…':value.kind==='error'?'Brak połączenia':value.kind==='ready'?'Gra otwarta':'Gotowe do gry';
}
async function command(name,value) {
  try {
    if (!api) { displayStatus({kind:'idle',text:'Podgląd interfejsu — uruchom aplikację TAPNOVA, aby otworzyć grę.'}); return {ok:false}; }
    return await api.command(name,value);
  } catch { displayStatus({kind:'error',text:'Nie udało się wykonać operacji. Spróbuj ponownie.'}); return {ok:false}; }
}
function current(button,title) {
  document.querySelectorAll('.sidebar [aria-current]').forEach(el=>el.removeAttribute('aria-current'));
  button?.setAttribute('aria-current','page');
  document.querySelector('#page-title').textContent=title;
}
document.querySelectorAll('[data-page]').forEach(button=>button.addEventListener('click',async event=>{
  event.preventDefault();
  await command('home');
  const page=button.dataset.page;
  document.querySelectorAll('.page').forEach(el=>el.hidden=el.id!==`page-${page}`);
  current(document.querySelector(`.nav-item[data-page="${page}"]`),{home:'Przegląd',help:'Jak zacząć?',settings:'Ustawienia aplikacji'}[page]);
  document.querySelector('#main').scrollTop=0;
}));
document.querySelectorAll('[data-game]').forEach(button=>button.addEventListener('click',async()=>{
  button.disabled=true; const result=await command('game'); button.disabled=false;
  if(result?.ok) current(document.querySelector('.nav-item[data-game]'),'MovieStarPlanet 2');
}));
document.querySelectorAll('[data-tab]').forEach(button=>button.addEventListener('click',async()=>{
  button.disabled=true; const result=await command('tab',button.dataset.tab); button.disabled=false;
  if(result?.ok) { const nav=document.querySelector(`.nav-item[data-tab="${button.dataset.tab}"]`); current(nav,nav?.textContent||'Narzędzia'); }
}));
document.querySelector('[data-photo]').addEventListener('click',async event=>{const button=event.currentTarget;button.disabled=true;try{await command('photo')}finally{button.disabled=false}});
document.querySelector('[data-reload]').addEventListener('click',()=>command('reload'));
document.querySelector('#clear-data').addEventListener('click',()=>command('clear-data'));
api?.onStatus(displayStatus);
if(api) command('status').then(value=>{if(value?.text)displayStatus(value);});
let updateState={phase:'idle',automatic:api?.platform==='win32'};
function displayUpdate(state){
  updateState=state;
  document.querySelectorAll('[data-app-version]').forEach(el=>{if(state.installed)el.textContent=state.installed});
  const pending=['checking','downloading','installing'].includes(state.phase);
  const action=document.querySelector('#update-action'),badge=document.querySelector('#update-badge'),progress=document.querySelector('#update-progress');
  const labels={idle:'Sprawdź, czy jest dostępna nowa wersja.',disabled:'Aktualizacje są dostępne w zainstalowanym wydaniu aplikacji.',checking:'Sprawdzanie aktualizacji…',current:'Masz aktualną wersję TAPNOVA.',available:`Dostępna nowa wersja: ${state.version}.`,downloading:`Pobieranie: ${Math.round(state.progress)}%`,ready:'Aktualizacja została pobrana.',installing:state.automatic?'Instalowanie i ponowne uruchamianie…':'Otwieranie instalatora…',opened:'Instalator otwarty. Zamknij TAPNOVA i przenieś nową wersję do Aplikacji.',error:'Nie udało się sprawdzić, pobrać lub zainstalować aktualizacji. Sprawdź połączenie i spróbuj ponownie.'};
  document.querySelector('#update-text').textContent=labels[state.phase]||labels.idle;
  document.querySelector('#update-note').textContent=state.automatic?'Po zatwierdzeniu aktualizacji TAPNOVA zamknie grę i uruchomi się ponownie.':'Na tym wydaniu macOS aplikacja pobierze i otworzy DMG. Zastąpienie aplikacji wymaga ręcznego przeciągnięcia jej do Aplikacji.';
  action.disabled=pending||state.phase==='disabled';
  action.textContent=pending?'Proszę czekać…':['ready','opened'].includes(state.phase)?(state.automatic?'Zainstaluj i uruchom ponownie':'Otwórz instalator'):state.phase==='available'?(state.automatic?'Pobierz i zainstaluj':'Pobierz aktualizację'):state.phase==='error'?'Spróbuj ponownie':'Sprawdź aktualizacje';
  progress.hidden=state.phase!=='downloading';progress.value=state.progress||0;
  badge.hidden=!['available','downloading','ready','installing','opened'].includes(state.phase);
  badge.textContent=state.phase==='downloading'?`Pobieranie ${Math.round(state.progress)}%`:state.phase==='available'?`Nowa wersja ${state.version}`:'Aktualizacja TAPNOVA';
}
document.querySelector('#update-action').addEventListener('click',async()=>{
  const button=document.querySelector('#update-action');button.disabled=true;
  const result=await command(['available','ready','opened'].includes(updateState.phase)?'update-apply':'update-check');
  if(result?.phase)displayUpdate(result);else{button.disabled=false}
});
document.querySelector('#update-badge').addEventListener('click',()=>{document.querySelector('.nav-item[data-page="settings"]').click();setTimeout(()=>document.querySelector('#update-action').focus(),0)});
api?.onUpdate(displayUpdate);
if(api)command('update-status').then(state=>{if(state?.phase)displayUpdate(state)});

function displayLicense(state){
  if(!state?.phase)return;
  const gate=document.querySelector('#license-gate');
  const messages={locked:'Wprowadź kod aktywacyjny otrzymany od twórcy.',unconfigured:'To wydanie nie ma skonfigurowanego serwera licencji. Skontaktuj się z twórcą.',checking:'Aktywowanie…',offline:'Brak połączenia z serwerem licencji. Dostęp zostanie przywrócony po ponownej weryfikacji.',revoked:'Ta licencja została zablokowana.',expired:'Licencja wygasła. Poproś twórcę o przedłużenie.','device-limit':'Osiągnięto limit urządzeń. Zwolnij poprzednie urządzenie lub poproś twórcę o reset.','invalid-key':'Nieprawidłowy kod aktywacyjny.',error:'Aktywacja nie powiodła się. Sprawdź połączenie i spróbuj ponownie.'};
  if(state.active){if(gate.open)gate.close();document.querySelector('#license-key').value='';}
  else {if(!gate.open)gate.showModal();document.querySelector('#license-message').textContent=messages[state.phase]||messages.locked;}
  document.querySelector('#license-submit').disabled=['unconfigured','checking'].includes(state.phase);
  document.querySelector('#license-summary').textContent=state.active?(state.label+' · '+(state.expires?'ważna do '+new Date(state.expires).toLocaleString('pl-PL'):'bezterminowa')):'Licencja nieaktywna';
}
document.querySelector('#license-gate').addEventListener('cancel',event=>event.preventDefault());
document.querySelector('#license-form').addEventListener('submit',async event=>{event.preventDefault();document.querySelector('#license-submit').disabled=true;displayLicense(await command('license-activate',{key:document.querySelector('#license-key').value,deviceLabel:document.querySelector('#license-device').value}));});
document.querySelector('#license-retry').addEventListener('click',async()=>displayLicense(await command('license-refresh')));
document.querySelector('#license-release').addEventListener('click',async()=>{if(confirm('Zwolnić to urządzenie? Gra zostanie zamknięta, a aplikacja poprosi o kod.'))displayLicense(await command('license-deactivate'));});
api?.onLicense?.(displayLicense);
if(api)command('license-status').then(displayLicense);
