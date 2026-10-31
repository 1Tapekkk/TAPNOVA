const command=(name,description,options=[],owner=false)=>({name,description,type:1,dm_permission:false,...(owner?{default_member_permissions:'0'}:{}),...(options.length?{options}:{})});
const option=(type,name,description,extra={})=>({type,name,description,required:true,...extra});
const days=option(4,'dni','Okres licencji; 0 oznacza bezterminowo',{choices:[7,30,90,0].map(value=>({name:value?`${value} dni`:'Bezterminowo',value}))});
const license=option(3,'id','Identyfikator licencji z panelu właściciela');
const person=option(6,'uzytkownik','Osoba, której licencją zarządzasz');
const target=[{...person,required:false},{...license,required:false}];
const channel=option(7,'kanal','Kanał publikacji (domyślnie bieżący)',{required:false,channel_types:[0,5]});
const pictures=[option(11,'zdjecie','Duże zdjęcie do 5 MB',{required:false}),option(11,'miniaturka','Miniaturka do 5 MB',{required:false})];
export const commands=[
 command('pomoc','Instrukcja korzystania z TAPNOVA'),
 command('pobierz','Oficjalna strona pobierania TAPNOVA'),
 command('licencja','Sprawdź swoją licencję i odśwież rolę Klient'),
 command('polacz','Połącz posiadany kod licencji ze swoim kontem Discord'),
 command('powitania','Właściciel: automatyczne powitania nowych członków',[
  option(3,'akcja','Wybierz działanie',{choices:[{name:'Status',value:'status'},{name:'Włącz',value:'wlacz'},{name:'Wyłącz',value:'wylacz'}]}),channel],true),
 command('embed','Właściciel: kreator wiadomości z podglądem',[
  option(3,'szablon','Wybierz wygląd i przykładową treść',{required:false,choices:[['Ogłoszenie','ogloszenie'],['Cennik','cennik'],['Aktywacja','aktywacja'],['Instrukcja','instrukcja'],['Aktualizacja','aktualizacja'],['Konkurs','konkurs']].map(([name,value])=>({name,value}))}),channel,...pictures],true),
 command('aktualizacja','Właściciel: przygotuj changelog',[
  option(3,'wersja','Numer wersji',{max_length:40}),option(3,'zmiany','Lista zmian (możesz uzupełnić w edytorze)',{required:false,max_length:4000}),channel,...pictures],true),
 command('panel-aktywacji','Właściciel: panel z przyciskiem Aktywuj kod',[channel,...pictures],true),
 command('edytuj-embed','Właściciel: zmień opublikowaną wiadomość bota',[
  option(3,'wiadomosc','Link z opcji Kopiuj link do wiadomości',{max_length:200}),...pictures],true),
 command('wydaj','Właściciel: wydaj licencję po potwierdzeniu zakupu',[
  option(6,'uzytkownik','Osoba, dla której wydajesz dostęp'),days,
  option(4,'urzadzenia','Liczba urządzeń',{min_value:1,max_value:20})],true),
 command('przedluz','Właściciel: przedłuż licencję',[license,days],true),
 command('licencje','Właściciel: sprawdź licencje wskazanej osoby',[person],true),
 command('zablokuj','Właściciel: zablokuj licencję wskazanej osoby',target,true),
 command('odblokuj','Właściciel: odblokuj licencję wskazanej osoby',target,true),
 command('odlacz','Właściciel: odłącz licencję od konta Discord',target,true),
 command('usun','Właściciel: trwale usuń licencję',[option(5,'potwierdz','Ustaw Tak, aby potwierdzić trwałe usunięcie'),...target],true),
 command('resetuj','Właściciel: usuń przypisania urządzeń',[license],true),
 command('status-bota','Właściciel: sprawdź połączenie i synchronizację ról',[],true)
];
export const ownerCommands=new Set(['wydaj','licencje','przedluz','zablokuj','odblokuj','odlacz','usun','resetuj','status-bota','embed','aktualizacja','panel-aktywacji','edytuj-embed']);
