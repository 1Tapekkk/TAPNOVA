'use strict';
(() => {
  const dialog=document.querySelector('#account-dialog'),form=document.querySelector('#account-form'),submit=document.querySelector('#account-submit'),message=document.querySelector('#account-message'),button=document.querySelector('#account-open');
  let active=false,pending=false;
  const errors={input:'Wpisz nick, hasło i wybierz serwer.',credentials:'Nieprawidłowy nick, hasło lub serwer.',denied:'MSP2 odmówiło logowania. Sprawdź konto w oficjalnej grze.',profile:'Nie udało się jednoznacznie wybrać profilu MSP2.',response:'Serwer zwrócił nierozpoznaną odpowiedź. Spróbuj zalogować się w grze.',network:'Nie udało się połączyć z MSP2. Spróbuj ponownie.',unavailable:'Najpierw aktywuj TAPNOVA. Logowanie jest niedostępne w podglądzie testowym.',busy:'Logowanie już trwa.',cancelled:'Anulowano logowanie.','rate-limit':'MSP2 ograniczyło próby logowania. Odczekaj chwilę przed ponowieniem.'};
  function display(state){
    if(!state?.phase)return;active=state.active===true;
    button.textContent=active?state.username+' · '+state.region:'Zaloguj do MSP2';
    document.querySelector('#welcome-title').textContent=active?'Cześć, '+state.username+'!':'Miło Cię widzieć.';
    document.querySelector('#dashboard-account-copy').textContent=active?'Twoje konto jest połączone. Wybierz narzędzie i zaczynajmy.':'Wszystko gotowe na Twoją następną sesję.';
    const session=document.querySelector('#dashboard-session');
    session.textContent=active?'Konto połączone · '+state.region:'Zaloguj się, aby połączyć konto';
    session.dataset.active=String(active);
    document.querySelector('#account-logout').hidden=!active;document.querySelector('#account-switch').hidden=!active;document.querySelector('#profile-picker').hidden=active;
    document.querySelector('#account-fields').hidden=active;submit.hidden=active;
    message.textContent=active?'Konto połączone. Wybierz narzędzie z biblioteki. Funkcje pokoju wymagają otwartej gry.':state.phase==='expired'?'Sesja MSP2 wygasła lub odświeżenie się nie powiodło. Zaloguj się ponownie.':'Zaloguj się, aby korzystać z panelu bez uruchamiania gry.';
  }
  button.addEventListener('click',()=>dialog.showModal());
  async function cancel(){document.querySelector('#account-password').value='';if(pending)await command('account-logout')}
  document.querySelector('#account-close').addEventListener('click',()=>{void cancel();dialog.close()});
  dialog.addEventListener('cancel',()=>void cancel());
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(pending)return;pending=true;submit.disabled=true;message.textContent='Łączenie z serwerem MSP2…';
    const input={username:document.querySelector('#account-username').value,password:document.querySelector('#account-password').value,region:document.querySelector('#account-region').value,remember:document.querySelector('#account-remember').checked};
    document.querySelector('#account-password').value='';
    try{const result=await command('account-login',input);if(result.ok){display(result);dialog.close();displayStatus({kind:'ready',text:result.profileSaveError?'Konto połączone, ale profilu nie udało się zapisać.':'Konto MSP2 połączone · wybierz narzędzie'})}else message.textContent=errors[result.error]||errors.network}
    finally{input.password='';pending=false;submit.disabled=false}
  });
  document.querySelector('#account-logout').addEventListener('click',async()=>display(await command('account-logout')));
  api?.onAccount?.(display);if(api)command('account-status').then(display);
})();
