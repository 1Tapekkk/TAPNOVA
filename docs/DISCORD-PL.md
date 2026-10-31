# Bot TAPNOVA na Cloudflare

Bot korzysta z istniejącego Workera i bazy licencji D1. Nie wymaga uruchomionego komputera, VPS ani połączenia Discord Gateway. Obsługuje komendy slash przez HTTPS; może być widoczny jako offline mimo działających komend. Nie czyta zwykłych wiadomości i nie wymaga Message Content Intent.

## Jednorazowe podłączenie

1. Opublikuj serwer: `pnpm cloudflare:deploy` po zalogowaniu przez `pnpm cloudflare:login`. Migracja `0003_discord.sql` dodaje powiązania użytkowników, kolejkę synchronizacji ról i identyfikatory wykonanych operacji. Istniejące licencje pozostają w tej samej bazie.
2. W [Discord Developer Portal](https://discord.com/developers/applications) wybierz aplikację bota. Dodaj ją do własnego serwera z zakresami `bot`, `applications.commands` i uprawnieniem **Zarządzanie rolami**. Nie potrzebuje uprawnienia Administrator.
3. Utwórz rolę **Klient**, nadaj jej dostęp do kanałów klienta i umieść rolę bota wyżej w hierarchii. Rola Klient nie może mieć uprawnień administracyjnych.
4. Uruchom `pnpm discord:setup`, otwórz wypisany lokalny adres i wpisz token bota, ID serwera, ID swojego konta oraz ID roli Klient. ID kopiujesz z Discorda po włączeniu trybu dewelopera w ustawieniach zaawansowanych. Twoje konto musi być właścicielem lub administratorem serwera.
5. Formularz sprawdza uprawnienia, zapisuje konfigurację jako sekrety Cloudflare, ustawia adres interakcji i rejestruje siedemnaście komend na tym serwerze. Inne komendy nie są kasowane. Jeśli aplikacja ma już inny adres interakcji, konfigurator wymaga użycia osobnej aplikacji albo świadomego usunięcia poprzedniego adresu.
6. Wpisz w Discordzie `/pomoc` i `/status-bota`. Po zakończeniu konfiguracji lokalny formularz się wyłącza. Możesz wyłączyć komputer.

Token przechodzi z formularza tylko do lokalnego procesu, Discorda przez HTTPS i Cloudflare przez stdin programu Wrangler. Nie zapisujemy go w plikach projektu ani w GitHubie. Nie wklejaj tokena na czacie. Po jego wycieku zresetuj go w Developer Portal i uruchom konfigurator ponownie.

Adres interakcji: `https://tapnova-licenses.tapnova-1tapekkk.workers.dev/discord/interactions`.

## Komendy klienta

| Komenda | Działanie |
| --- | --- |
| `/pomoc` | Instrukcja po polsku |
| `/pobierz` | Oficjalne wydanie Windows/macOS na GitHubie |
| `/polacz` | Prywatny formularz istniejącego kodu; wiąże go z jednym kontem Discord |
| `/licencja` | Pokazuje do pięciu ostatnich licencji użytkownika i odświeża rolę |

Odpowiedzi są prywatne (ephemeral). Inni członkowie kanału nie widzą kodów ani informacji o licencji. Discord i osoby mające dostęp do konta nadal mogą mieć dostęp do tych danych.

## Komendy właściciela

| Komenda | Działanie |
| --- | --- |
| `/wydaj uzytkownik dni urzadzenia` | Generuje licencję na 7/30/90 dni lub bezterminowo (0), na 1–20 urządzeń |
| `/przedluz id dni` | Przedłuża dostęp; nie odblokowuje wcześniej zablokowanej licencji |
| `/licencje uzytkownik` | Pokazuje licencje wskazanej osoby wraz z ID i ważnością |
| `/zablokuj uzytkownik` | Unieważnia licencję, sesje urządzeń i aktualizuje rolę |
| `/odblokuj uzytkownik` | Odblokowuje licencję; nie przedłuża daty ważności |
| `/odlacz uzytkownik` | Usuwa powiązanie konta Discord z licencją i synchronizuje rolę; kod i dostęp do aplikacji pozostają ważne |
| `/usun potwierdz:Tak uzytkownik` | Trwale usuwa licencję oraz aktywacje i synchronizuje rolę |
| `/resetuj id` | Usuwa przypisania urządzeń; użytkownik ponownie aktywuje aplikację |
| `/status-bota` | Liczba powiązanych osób i błędów synchronizacji ról |

Serwer sprawdza dokładne ID właściciela dla każdej operacji. Sama rola administratora innej osoby nie daje dostępu do tych komend. Discord domyślnie ukrywa je przed osobami bez uprawnień administratora.

W komendach blokowania, odblokowania, odłączania i usuwania można zamiast osoby podać `id`. Gdy osoba ma kilka licencji, bot wyświetla listę i nie zmienia żadnej, dopóki nie wskażesz konkretnego `id`. Podanie osoby oraz ID naraz wymaga zgodności obu pól. Rola Klient pozostaje, jeśli użytkownik ma inną ważną licencję.

Odłączenie nie jest blokadą: posiadacz kodu może ponownie połączyć go przez `/polacz`. Po odłączeniu kodem zarządzasz w panelu właściciela, dopóki nie zostanie ponownie przypisany do konta Discord. Jeśli chcesz odebrać dostęp osobie, użyj `/zablokuj` lub `/usun`.

## Przykład sprzedaży

1. Użytkownik kontaktuje się z Tobą w prywatnym tickecie. Ten bot nie zakłada ticketów; można do tego użyć istniejącego bota ticketowego.
2. Samodzielnie potwierdzasz płatność. Bot nie jest podłączony do operatora płatności.
3. Wpisujesz `/wydaj uzytkownik:@Klient dni:30 urzadzenia:1`.
4. Pełny kod otrzymujesz w prywatnej odpowiedzi. Zapisz go i przekaż kupującemu prywatnie. Bot nie wysyła automatycznych wiadomości DM. Baza przechowuje wyłącznie skrót kryptograficzny kodu i jego fragment do rozpoznawania.
5. Licencja zostaje od razu związana z tym kontem Discord. Rola jest nadawana przy synchronizacji albo po `/licencja`. Klient pobiera aplikację i wpisuje kod. Okres ważności zaczyna się przy pierwszej aktywacji aplikacji, nie przy wydaniu kodu.
6. Licencję, aktywne urządzenia i historię sprawdzasz też w dotychczasowym panelu właściciela. Etykieta `Discord <ID>` pozwala rozpoznać kupującego.

Istniejący klient może powiązać wcześniej kupiony kod przez `/polacz`. Jeden kod może należeć do jednego konta Discord. Powiązanie nie zastępuje aktywacji aplikacji ani limitu urządzeń.

Kod przekazany prywatnie z panelu właściciela działa tak samo: klient na serwerze wpisuje `/polacz`, wypełnia prywatny formularz i dostaje rolę Klient, jeśli kod jest ważny i nie należy już do innego konta Discord. Nie wkleja kodu do wiadomości na kanale.

## Kreator wiadomości i grafiki z telefonu

Bot udostępnia 17 komend. Cztery dotyczą wiadomości:

1. `/embed` — wybierz szablon: ogłoszenie, cennik, aktywacja, instrukcja, aktualizacja lub konkurs. Opcjonalnie wybierz kanał, zdjęcie i miniaturkę jako załączniki.
2. `/aktualizacja wersja:4.2.3 zmiany:...` — przygotuj changelog.
3. `/panel-aktywacji` — przygotuj wiadomość z przyciskiem **Aktywuj kod**. Po publikacji każdy klient może otworzyć prywatny formularz i połączyć otrzymany kod.
4. `/edytuj-embed wiadomosc:...` — wklej **Kopiuj link do wiadomości**, aby zmienić istniejącą wiadomość tego bota.

Najpierw widzisz **prywatny podgląd**. Przycisk **Popraw tekst** otwiera formularz tytułu, treści Markdown, koloru HEX i stopki. **Zdjęcia** pozwala wybrać pliki z telefonu (PNG/JPG/GIF/WebP, maks. 5 MB każdy). **Przyciski** konfiguruje Pobierz, Kup, Pomoc i Aktywuj kod. Puste pole usuwa dany przycisk; `auto` w Kup lub Pomoc włącza prywatną instrukcję bota. Możesz też wkleić własny link HTTPS.

**Opublikuj** wysyła wiadomość na wskazany kanał. **Zapisz zmiany** aktualizuje istniejącą wiadomość. **Anuluj** porzuca projekt. Zdjęcia są ponownie załączane do opublikowanej wiadomości; nie zależą od chwilowego linku do załącznika podglądu. Projekty wygasają po godzinie. Używaj przycisków pod najnowszym podglądem.

Publikować i edytować może wyłącznie skonfigurowany właściciel. Bot potrzebuje na docelowym kanale uprawnień: Wyświetlanie kanału, Wysyłanie wiadomości, Osadzanie linków, Załączanie plików i Czytanie historii wiadomości. Zarządzanie rolami jest wymagane osobno do nadawania roli Klient. Edytor obsługuje jeden embed i przyciski TAPNOVA; odmawia zmiany bogatszych, nieobsługiwanych wiadomości, aby nie zgubić ich zawartości.

Szablon konkursu jest ogłoszeniem — nie zbiera zgłoszeń ani nie losuje zwycięzców. Przycisk Kup podaje kontakt do właściciela lub otwiera ustawiony link; nie realizuje płatności. W cenniku uzupełnij ceny przed publikacją. W razie niepewnego wyniku API bot prosi o sprawdzenie kanału, zamiast automatycznie wysyłać duplikat.

## Diagnozowanie publikacji

Błąd publikacji wskazuje teraz kod HTTP, kod Discorda i — gdy Discord je poda — nazwy odrzuconych pól. Błąd pobrania zdjęcia nie jest opisywany jako brak uprawnień. Przy odrzuceniu wiadomości przed publikacją projekt pozostaje dostępny do poprawienia; przy niepewnym wyniku wysyłania najpierw sprawdź kanał.

Na komputerze właściciela z istniejącą konfiguracją Cloudflare polecenie `node scripts/Inspect-Discord.cjs ID_KANALU` sprawdza efektywne uprawnienia bota, a `node scripts/Inspect-Discord.cjs UUID_PROJEKTU --draft` sprawdza pobranie zdjęć. Nie publikują wiadomości. Dostęp wymaga konta Cloudflare właściciela i lokalnej konfiguracji; token bota pozostaje na serwerze. Diagnostyka nie wypisuje podpisanych adresów załączników ani treści wiadomości.

## Wdrażanie nowych komend

Po wdrożeniu zmian przez `pnpm cloudflare:deploy` uruchom `pnpm discord:register`. Polecenie używa istniejącego dostępu właściciela do Cloudflare i krótkiej sesji administracyjnej, usuwanej po operacji. Token bota pozostaje w sekretach Workera; nie trzeba wpisywać go ponownie. Endpoint rejestracji wymaga sesji administratora i ochrony CSRF. Aktualizowane są wyłącznie komendy TAPNOVA, bez usuwania innych komend aplikacji.

## Role, blokowanie i utrzymanie

- Co pięć minut synchronizowanych jest do 20 najdawniej sprawdzanych użytkowników. Przy większej liczbie klientów pełna runda zajmie kilka cykli. `/licencja` odświeża rolę danej osoby od razu. Błąd Discorda, ograniczenie API lub brak uprawnień może opóźnić zmianę roli.
- Użytkownik zachowuje rolę, jeżeli ma choć jedną ważną licencję. Po usunięciu ostatniej licencji z panelu rola również zostanie odebrana w kolejnym cyklu.
- Dostęp w aplikacji nadal kontroluje serwer licencji i jej mechanizm sprawdzania sesji. Rola Discord jest osobnym mechanizmem dostępu do kanałów; nie gwarantujemy natychmiastowego odebrania jej na każdym koncie.
- Jeśli polecenie zwróci niepewny wynik, sprawdź panel przed ponowieniem. Ponowne dostarczenie tej samej interakcji przez Discord nie powtarza wydania ani przedłużenia. Nowe wpisanie komendy jest nową operacją.
- Gdy utracisz odpowiedź z kodem, w panelu obróć/wygeneruj ponownie klucz danej licencji. Pełnego starego kodu nie da się odczytać z bazy.
- `/resetuj` resetuje urządzenia, nie powiązanie Discord. Aby przekazać dostęp innemu kontu, unieważnij poprzednią licencję i wydaj nową właściwej osobie.
- Zmiana ID serwera lub roli w konfiguracji nie usuwa ról ze starego serwera — takie przenoszenie wymaga osobnego uporządkowania uprawnień.
- Darmowy plan Cloudflare ma limity Workers i D1 współdzielone z serwerem licencji. Śledź użycie w panelu Cloudflare; nie jest to obietnica nieograniczonego hostingu.
- Kod bota działa tylko na serwerze: nie jest dołączany do instalatorów Windows/macOS. Zmiany bota nie wymagają aktualizacji aplikacji klientów.

## Sprawdzenie działania

`pnpm test:discord` testuje podpisy Discorda, uprawnienia właściciela, izolację serwera, rzeczywistą bazę D1 w lokalnym Workers, idempotencję operacji, powiązania, aktywację, przedłużenie, blokowanie, odbieranie ról po usunięciu licencji, błędy API i ograniczanie prób. Wywołania Discord REST są w testach zastąpione kontrolowanymi odpowiedziami. `pnpm test:cloudflare` sprawdza dodatkowo dotychczasowy serwer i panel licencji.

Test kreatora uruchamiany jest też we właściwym środowisku Workers: pobiera dwa testowe obrazy, sprawdza wysłane dane multipart i odrzucenie przekierowania CDN bez odwiedzania jego celu. Wykrywa różnice między `fetch` w Node.js a Cloudflare, które wcześniej powodowały awarię załączników.

Źródła: [Discord — hosting na Workers](https://docs.discord.com/developers/tutorials/hosting-on-cloudflare-workers), [interakcje i podpisy](https://docs.discord.com/developers/interactions/receiving-and-responding), [konfiguracja aplikacji](https://docs.discord.com/developers/resources/application), [limity Cloudflare](https://developers.cloudflare.com/workers/platform/limits/).
