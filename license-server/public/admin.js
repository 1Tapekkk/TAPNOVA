'use strict';
const $=s=>document.querySelector(s),notice=text=>{$('#notice').textContent=text};let licenses=[];
const errors={login:'Zaloguj się hasłem właściciela.','remove-devices-first':'Najpierw usuń nadmiarowe przypisania urządzeń.','rate-limit':'Zbyt wiele prób. Odczekaj i spróbuj ponownie.'};
async function api(url,data){const response=await fetch(url,{method:data?'POST':'GET',headers:data?{'content-type':'application/json','x-tapnova-admin':'1'}:{},...(data?{body:JSON.stringify(data)}:{})});const result=await response.json();if(!response.ok){if(response.status===401)logged(false);throw Error(errors[result.error]||'Operacja nie powiodła się: '+result.error)}return result}
function logged(value){$('#login').hidden=value;$('#workspace').hidden=!value;$('#logout').hidden=!value;if(!value){$('#key').value='';$('#new-key').hidden=true;licenses=[];$('#licenses').replaceChildren()}}
const el=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e};
const date=n=>n?new Date(n).toLocaleString('pl-PL'):'—';
function showKey(key){$('#key').value=key;$('#new-key').hidden=false;$('#key').focus();$('#key').select()}
async function change(id,data){await api('/api/admin/licenses/'+id,data).then(result=>{if(result.key)showKey(result.key)});notice('Zapisano zmianę.');await refresh()}
function render(){
 const query=$('#search').value.toLowerCase(),list=$('#licenses');list.replaceChildren();
 const stats=[['Licencje',licenses.length],['Online',licenses.filter(l=>l.devices.some(d=>d.online)).length],['Zablokowane',licenses.filter(l=>l.revoked).length],['Wygasłe',licenses.filter(l=>l.expired).length]];$('#stats').replaceChildren(...stats.map(([name,n])=>{const e=el('div',name);e.prepend(el('strong',n));return e}));
 for(const l of licenses.filter(l=>(l.label+' '+l.keyHint).toLowerCase().includes(query))){
  const card=el('article',undefined,'card'),head=el('div',undefined,'license-head');head.append(el('h2',l.label),el('span',l.revoked?'Zablokowana':l.expired?'Wygasła':l.activated?'Aktywna':'Oczekuje na aktywację',l.revoked||l.expired?'bad':'tag'));card.append(head,el('p',l.keyHint+' · urządzenia '+l.devices.length+'/'+l.maxDevices),el('p','Utworzono: '+date(l.created)+' · Aktywacja: '+date(l.activated)+' · Koniec: '+(l.durationDays===0?'bezterminowo':l.expires?date(l.expires):l.durationDays+' dni od aktywacji'),'muted'));
  for(const d of l.devices){const row=el('div',undefined,'device'),remove=el('button','Odłącz');remove.onclick=()=>{if(confirm('Odłączyć to urządzenie?'))change(l.id,{action:'remove-device',deviceId:d.id}).catch(e=>notice(e.message))};row.append(el('span',d.label+' · '+d.platform+' · '+(d.online?'Online':date(d.lastSeen))),remove);card.append(row)}
  const actions=el('div',undefined,'actions'),select=el('select'),duration=el('select'),count=el('input'),run=el('button','Wykonaj');
  for(const[value,text]of [['extend','Przedłuż ważność'],['revoke','Zablokuj dostęp'],['enable','Odblokuj'],['devices','Zmień limit urządzeń'],['reset','Resetuj urządzenia'],['rotate','Zastąp kod nowym'],['delete','Usuń licencję']]){const o=el('option',text);o.value=value;select.append(o)}
  for(const[value,text]of [[7,'7 dni'],[30,'30 dni'],[90,'90 dni'],[0,'Bezterminowo']]){const o=el('option',text);o.value=value;duration.append(o)}count.type='number';count.min=1;count.max=20;count.value=l.maxDevices;count.hidden=true;
  select.setAttribute('aria-label','Operacja na licencji');duration.setAttribute('aria-label','Okres przedłużenia');count.setAttribute('aria-label','Limit urządzeń');select.onchange=()=>{duration.hidden=select.value!=='extend';count.hidden=select.value!=='devices'};
  run.onclick=async()=>{if(!confirm('Wykonać '+select.selectedOptions[0].textContent+' dla '+l.label+'?'))return;run.disabled=true;try{await change(l.id,{action:select.value,durationDays:Number(duration.value),maxDevices:Number(count.value)})}catch(e){notice(e.message);run.disabled=false}};actions.append(select,duration,count,run);card.append(actions);list.append(card);
 }
 if(!list.children.length)list.append(el('p','Brak licencji pasujących do wyszukiwania.'));
}
async function refresh(){const data=await api('/api/admin/licenses');licenses=data.licenses;logged(true);render();$('#audit').replaceChildren(...data.audit.map(e=>el('p',date(e.at)+' · '+e.action+' · '+(e.license_id||''))))}
$('#login').onsubmit=async e=>{e.preventDefault();try{await api('/api/admin/login',{password:$('#password').value});$('#password').value='';notice('Zalogowano.');await refresh()}catch(e){notice(e.message)}};
$('#logout').onclick=async()=>{try{await api('/api/admin/logout',{});logged(false);notice('Wylogowano.')}catch(e){notice(e.message)}};
$('#create').onsubmit=async e=>{e.preventDefault();const form=e.currentTarget,button=form.querySelector('button'),data=Object.fromEntries(new FormData(form));button.disabled=true;try{const result=await api('/api/admin/licenses',{label:data.label,durationDays:Number(data.durationDays),maxDevices:Number(data.maxDevices)});showKey(result.key);notice('Wygenerowano kod. Zapisz go i przekaż odbiorcy.');await refresh()}catch(e){notice(e.message)}finally{button.disabled=false}};
$('#copy').onclick=async()=>{try{await navigator.clipboard.writeText($('#key').value);notice('Kod skopiowany.')}catch{$('#key').select();notice('Zaznaczono kod — skopiuj go ręcznie.')}};
$('#refresh').onclick=()=>refresh().catch(e=>notice(e.message));$('#search').oninput=render;
setInterval(()=>{if(!$('#workspace').hidden&&!$('#licenses').contains(document.activeElement))refresh().catch(e=>notice(e.message))},15000);
refresh().catch(()=>logged(false));
