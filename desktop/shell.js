'use strict';
const paths = {
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
document.querySelector('[data-reload]').addEventListener('click',()=>command('reload'));
document.querySelector('#clear-data').addEventListener('click',()=>command('clear-data'));
api?.onStatus(displayStatus);
if(api) command('status').then(value=>{if(value?.text)displayStatus(value);});
