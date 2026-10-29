# TAPNOVA — licencje i wdrożenie

## Co jest gotowe i czego wymaga publikacja

Projekt zawiera działający serwer Node.js 24 + SQLite, panel właściciela i klienta aktywacji w aplikacji Electron. Lokalny serwer służy do testów na Twoim komputerze. Nie jest usługą dostępną dla znajomych. Wdrożenie publiczne wymaga serwera działającego stale, domeny i HTTPS. GitHub przechowuje kod i instalatory, lecz nie uruchamia tego serwera jako stałej usługi.

Wydanie testowe z adresem `http://127.0.0.1:8787` działa tylko z serwerem uruchomionym na tym samym komputerze. Nie wysyłaj go innym osobom jako wydania produkcyjnego. Publiczny adres jest wbudowywany podczas pakowania. Użytkownik nie wpisuje ani nie zmienia go w aplikacji.

## Pierwszy test lokalny — właściciel

1. Uruchom `START_TAPNOVA.bat` lub poprawiony skrót „TAPNOVA - aktualna”. Program uruchamia serwer w tle, sprawdza jego gotowość i otwiera aktualną paczkę testową. W razie potrzeby zamyka normalnie stare okno TAPNOVA, aby nie przechwyciło uruchomienia nowej wersji. Nie kończy go przymusowo. Serwer można też uruchomić osobno przez `START_LICENSE_SERVER.bat`; panel otwiera `OPEN_LICENSE_ADMIN.bat`. Wymagany Node.js 24 jest wykrywany w PATH lub lokalnym środowisku Codex. Pierwszy start generuje konfigurację i losowe hasło właściciela; kolejne zachowują te same dane. Po restarcie komputera ponownie użyj skrótu — nie trzeba ręcznie włączać serwera.
2. Otwórz `http://127.0.0.1:8787` w przeglądarce.
3. Hasło odczytaj z `license-server/.data/OWNER-LOGIN.txt`. Zachowaj je w menedżerze haseł. Możesz potem usunąć ten plik — serwer korzysta ze skrótu hasła w `config.json`.
4. Zaloguj się, wypełnij „Odbiorca / Twoja notatka”, wybierz 7, 30, 90 dni lub bezterminowo i limit urządzeń. Kliknij „Wygeneruj kod”.
5. Skopiuj pełny kod. Pokazuje się tylko po utworzeniu lub zastąpieniu kodu. Później lista pokazuje identyfikator licencji i fragment kodu. Baza nie przechowuje pełnych kodów w postaci jawnej.
6. Uruchom lokalne wydanie testowe TAPNOVA, wpisz kod i nazwę urządzenia. Po aktywacji otwórz grę. W panelu pojawi się urządzenie z ostatnią aktywnością.
7. Użyj operacji „Zablokuj dostęp”. W uruchomionej aplikacji pojawi się ponownie aktywacja, a widok gry zostanie zamknięty przy następnej weryfikacji.

Ręczne uruchomienie z PowerShell, w katalogu projektu:

```powershell
node license-server/setup.cjs
node license-server/server.cjs
```

`setup.cjs` uruchamia się tylko raz. Nie nadpisuje istniejącej konfiguracji. W drugim terminalu możesz uruchomić aplikację ze źródeł:

```powershell
$env:TAPNOVA_LICENSE_URL = 'http://127.0.0.1:8787'
$env:TAPNOVA_LICENSE_TEST = '1'
pnpm start
```

## Jak korzysta użytkownik

1. Pobiera odpowiedni instalator z GitHub Releases: Windows x64, Mac z procesorem Apple Silicon arm64 lub Mac Intel x64.
2. Instaluje i uruchamia aplikację.
3. Wkleja otrzymany kod i nadaje urządzeniu nazwę, np. „MacBook Kasi”.
4. Serwer sprawdza kod, ważność i dostępne miejsce na urządzenie. Okres 7/30/90 dni liczy się od pierwszej udanej aktywacji, nie od wygenerowania kodu.
5. Po aktywacji kod znika z formularza. Token sesji licencyjnej jest zapisany przez Electron safeStorage: Windows korzysta z ochrony systemowej, macOS z Keychain. Hasło MSP2 nie jest wysyłane do serwera licencji.
6. Następne uruchomienie weryfikuje zapisany token online. Aplikacja ponawia weryfikację co 15 sekund i po błędzie połączenia blokuje dostęp. Nie ma trybu korzystania offline z narzędzi.
7. Przed zmianą komputera użytkownik może wybrać „Ustawienia aplikacji → Twoja licencja → Zwolnij to urządzenie”. Jeżeli stary komputer jest niedostępny, właściciel odłącza go w panelu.

## Codzienna obsługa panelu

| Operacja | Działanie |
|---|---|
| Nowa licencja | Losowy indywidualny kod, odbiorca, okres i limit urządzeń. |
| Przedłuż ważność | Dodaje 7/30/90 dni od późniejszego terminu: teraz lub obecna data końca. Bezterminowo usuwa datę końca. Przedłużenie jeszcze nieaktywowanego kodu rozpoczyna jego ważność teraz. |
| Zablokuj dostęp | Natychmiast unieważnia kod i tokeny na serwerze. |
| Odblokuj | Ponownie zezwala na aktywację tym kodem, jeśli ważność nie minęła. Nie przywraca usuniętych tokenów urządzeń. |
| Zmień limit urządzeń | Ustawia od 1 do 20. Przed obniżeniem poniżej liczby przypisań trzeba odłączyć nadmiarowe urządzenia. |
| Odłącz przy urządzeniu | Unieważnia token tego urządzenia i zwalnia miejsce. |
| Resetuj urządzenia | Odłącza wszystkie; zachowuje klucz i datę ważności. |
| Zastąp kod nowym | Unieważnia stary kod i wszystkie aktywacje. Nowy kod wyświetla się jednorazowo. |
| Usuń licencję | Trwale usuwa licencję i urządzenia. Dziennik pozostawia identyfikator operacji. |

Przekazuj użytkownikowi **kod oraz link do instalatora**, np. w prywatnej wiadomości. Nie przekazuj hasła właściciela ani folderu `.data`. Aplikacja nie wysyła wiadomości automatycznie.

„Online” oznacza kontakt aplikacji w ostatnich 45 sekundach; nie oznacza aktywności w grze w tej konkretnej chwili. Nazwa odbiorcy jest Twoją notatką, a nazwa urządzenia pochodzi od użytkownika. System nie weryfikuje tożsamości osoby. Widzisz daty utworzenia, pierwszej aktywacji, końca ważności i ostatniego kontaktu każdego przypisanego urządzenia.

Blokada serwerowa działa natychmiast. Uruchomiony klient wykrywa ją podczas następnego zapytania. Przy działającym połączeniu to zwykle do 15 sekund; timeout sieci wynosi 8 sekund, lokalne zezwolenie wygasa po 24 sekundach. Uśpiony komputer weryfikuje dostęp po wznowieniu. „Natychmiast” nie oznacza zdalnego wykonania polecenia na wyłączonym lub odłączonym komputerze.

## Wdrożenie publiczne na serwerze z Docker Compose

Potrzebujesz własnego serwera Linux z Docker Engine i Compose oraz domeny, np. `licencje.twoja-domena.pl`. Skieruj rekord DNS A na IP serwera, udostępnij porty 80 i 443. Nie wystawiaj portu 8787 ani bazy SQLite. Instrukcję instalacji Dockera dobierz do systemu serwera: https://docs.docker.com/engine/install/.

1. Skopiuj katalog `license-server` na serwer, **bez lokalnego `.data`**. Możesz pobrać repozytorium przez Git i wejść do tego katalogu. Lokalna baza testowa nie jest bazą produkcyjną.
2. Utwórz `.env` obok `compose.yaml`, kopiując `.env.example`, i ustaw własną domenę:

```dotenv
LICENSE_DOMAIN=licencje.twoja-domena.pl
```

3. Zbuduj usługę i zainicjuj produkcyjne dane:

```sh
docker compose build licenses
docker compose run --rm licenses node setup.cjs
```

4. Odczytaj produkcyjne hasło **we własnym terminalu** i zapisz je w menedżerze haseł:

```sh
docker compose run --rm licenses cat /data/OWNER-LOGIN.txt
```

5. Włącz usługę:

```sh
docker compose up -d
docker compose ps
```

6. Otwórz `https://licencje.twoja-domena.pl/health` — oczekiwana odpowiedź to `{"ok":true}`. Wejdź na główny adres i zaloguj się hasłem produkcyjnym. Jeśli HTTPS nie działa, sprawdź DNS, porty i `docker compose logs caddy`.
7. Utwórz testową licencję produkcyjną. Sprawdź aktywację i blokowanie na gotowym wydaniu aplikacji przed udostępnieniem go użytkownikom.

Caddy obsługuje HTTPS i odnawianie certyfikatu, gdy domena wskazuje serwer i porty są dostępne. Konfiguracja opiera się na dokumentacji [Caddy reverse proxy](https://caddyserver.com/docs/quick-starts/reverse-proxy) i [zmiennych Docker Compose](https://docs.docker.com/compose/how-tos/environment-variables/variable-interpolation/). Usługa aplikacji nie publikuje własnego portu; ruch przechodzi przez Caddy. Obecny limiter widzi adres proxy, więc jego limit 600 żądań/minutę jest wspólny dla klientów tego wdrożenia. Przy większej liczbie użytkowników potrzebna będzie konfiguracja zaufanego proxy i limitów per klient.

## Połączenie z GitHub Releases

1. W repozytorium wybierz **Settings → Secrets and variables → Actions → Variables → New repository variable**.
2. Nazwa: `TAPNOVA_LICENSE_URL`. Wartość: `https://licencje.twoja-domena.pl` — bez ścieżki i danych logowania. To publiczny adres, nie sekret.
3. Wypchnij zmiany projektu przez GitHub Desktop: **Push origin**. Workflow sprawdza `/health`, wykonuje testy i buduje Windows x64, Mac Intel oraz Mac Apple Silicon.
4. Gdy wszystkie platformy przejdą, workflow publikuje komplet instalatorów i metadane aktualizacji. Brak adresu lub niedostępny serwer zatrzymuje przygotowanie wydania, żeby nie wysłać zablokowanej aplikacji.
5. Przy kolejnym wydaniu zwiększ wersję w `package.json`, dodaj `docs/releases/NUMER.md`, zatwierdź i wypchnij. Nie zastępuj plików już opublikowanej wersji.
6. Pierwszą wersję z aktywacją i aktualizatorem trzeba zainstalować ręcznie. Wcześniejsze wydania nie otrzymają tych mechanizmów bez aktualizacji.

Na Windows użytkownik zatwierdza aktualizację; aplikacja pobiera, sprawdza sumę, zamyka grę i uruchamia instalator z ponownym startem. Na Macu pobiera i otwiera DMG; użytkownik zamyka TAPNOVA i zastępuje ją w Aplikacjach. Bez Developer ID nie jest to bezobsługowa, podpisana dystrybucja Apple. Nie wyłączaj systemowych zabezpieczeń globalnie; przed publiczną dystrybucją przetestuj instalację na rzeczywistym Macu.

## Dane, kopia zapasowa i odzyskiwanie

Lokalnie dane są w `license-server/.data`. W Dockerze — w nazwanym wolumenie `license_data`, zamontowanym jako `/data`. `config.json` zawiera sekret HMAC i skrót hasła; `licenses.sqlite` zawiera licencje, skróty kodów i tokenów, urządzenia oraz dziennik. Pliki `-wal` i `-shm` SQLite mogą istnieć podczas pracy. Zmiana lub utrata sekretu HMAC unieważnia dotychczasowe kody/tokeny, dlatego kopia musi obejmować **bazę i konfigurację**.

Najprostsza spójna kopia (krótka przerwa w aktywacji):

```sh
docker compose stop licenses
mkdir -p backup
docker compose cp licenses:/data/. ./backup/
docker compose start licenses
```

Przechowuj datowane, zaszyfrowane kopie poza tym serwerem. Nie dodawaj ich do repozytorium. Aby przywrócić, zatrzymaj usługę, przywróć komplet danych do `/data`, upewnij się, że należą do użytkownika `node`, uruchom usługę i sprawdź aktywację istniejącego kodu. Nie nadpisuj działającej bazy podczas zapisu. Nie wykonuj `docker compose down -v`, jeśli chcesz zachować licencje.

Zapomniane hasło właściciela — dostęp administracyjny do serwera jest wymagany:

```sh
docker compose stop licenses
docker compose run --rm licenses node reset-password.cjs
docker compose run --rm licenses cat /data/OWNER-LOGIN.txt
docker compose start licenses
```

Reset zachowuje sekret licencyjny, kody i daty. Restart usuwa poprzednie sesje panelu. Aktualizacja kodu serwera: wykonaj kopię, pobierz zmiany, następnie `docker compose up -d --build`. Utrzymuj jedną instancję korzystającą z tej bazy SQLite; ten projekt nie zawiera klastra ani replikacji.

## Granice ochrony

Limit dotyczy losowych identyfikatorów instalacji i aktywnych tokenów, a nie niepodrabialnego odcisku fizycznego komputera. Nowa instalacja zajmuje nowe miejsce. Kopiowanie pliku aktywacji ogranicza szyfrowanie systemowe; nie stanowi ono gwarancji wobec osoby modyfikującej aplikację.

Klient jest dystrybuowany razem z kodem wykonywanym na komputerze użytkownika. Osoba techniczna może próbować usunąć lokalną blokadę w zmodyfikowanej wersji. Stare wydania TAPNOVA bez systemu licencji nie zostają zdalnie wyłączone. Pełne wymuszanie uprawnień wymagałoby wykonywania chronionych funkcji na własnym serwerze; obecny serwer kontroluje oficjalny klient i jego aktywacje. Nie ma wbudowanych płatności, poczty, automatycznej sprzedaży ani uwierzytelniania MFA.

## Funkcje gry — zakres sprawdzenia

Komentarze domku używają `DefaultMyHome`, sprawdzają własność UGC i tego samego mechanizmu komentarzy co status. Potwierdzanie, zaznaczanie, wyszukiwanie, anulowanie oraz archiwum lokalne są wspólne. Widok innych graczy po usunięciu zależy od API gry, nie od TAPNOVA.

Dodano opcję `Halloween Greeting` z kosztem 1 Diax podanym przez właściciela, identyfikatorem `HalloweenGreeting` oraz wspólnym mechanizmem wysyłania. Ten identyfikator i bieżąca cena **nie zostały potwierdzone na żywej sesji gry**. Serwer może odrzucić nieaktywną lub inaczej nazwaną ofertę. Nie przypisujemy rzeczywistych nagród Fame/StarCoins ani nie potwierdzamy sezonowego czasu odnowienia. Płatne autografy wymagają potwierdzenia skończonego kosztu; nie są automatycznie ponawiane po niejednoznacznym błędzie. Testy nie wykonują zakupów ani prawdziwych operacji usuwania.

Przed wydaniem: sprawdź jeden autograf na wybranym koncie za zgodą właściciela oraz jeden własny komentarz domku. Jeśli serwer zwróci błąd, zanotuj kod bez kopiowania tokenów sesji. Testy lokalne potwierdzają obsługę protokołu i interfejsu, nie aktualne uprawnienia udostępniane przez MSP2.
