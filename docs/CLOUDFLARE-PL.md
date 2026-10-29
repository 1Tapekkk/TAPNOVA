# TAPNOVA na darmowym Cloudflare Workers + D1

Serwer licencji i panel właściciela działają w Cloudflare. Komputer twórcy może być wyłączony. Użytkownicy Windows i macOS łączą się z tym samym adresem HTTPS; potrzebują internetu oraz ważnego kodu.

Adres TAPNOVA: **https://tapnova-licenses.tapnova-1tapekkk.workers.dev**.

## Pierwsze wdrożenie

W katalogu projektu, z Node.js 24 i pnpm:

```powershell
pnpm install --frozen-lockfile
pnpm test:cloudflare
pnpm cloudflare:login
pnpm cloudflare:setup
pnpm cloudflare:deploy
```

1. `login` otwiera stronę Cloudflare. Zaloguj się i zatwierdź Wrangler. Nie przekazuj nikomu swojego hasła do Cloudflare.
2. `setup` otwiera na Windows okno z dwoma polami hasła panelu właściciela. Możesz wpisać obecne hasło; oba wpisy muszą być identyczne i mieć przynajmniej 14 znaków. Jest to hasło panelu TAPNOVA, niezależne od hasła konta Cloudflare.
3. Zapisany zostaje wyłącznie weryfikator PBKDF2/SHA-256, sól i losowy sekret serwera w ignorowanym `license-server/.data/cloudflare-secrets.json`. Nie ma w nim jawnego hasła. Traktuj ten plik jako poufny i wykonaj bezpieczną kopię zapasową.
4. `deploy` tworzy lub wykorzystuje bazę `tapnova-licenses`, nakłada migracje, przesyła sekrety przez standardowe wejście do Cloudflare Secrets i publikuje Worker. Nie włącza płatnego planu ani nie kupuje domeny.
5. Przy pierwszym wdrożeniu do pustej bazy skrypt przenosi istniejące lokalne licencje, zachowując kody, terminy ważności oraz blokady. Nie przenosi przypisań urządzeń: użytkownicy aktywują aplikację ponownie. Znacznik w D1 zapobiega ponownemu importowi, również po celowym usunięciu wszystkich licencji przez właściciela.
6. Otwórz adres HTTPS `workers.dev` wypisany przez Wrangler. To jednocześnie adres serwera licencji i strony logowania administratora.

Konfiguracja konkretnego konta i D1 znajduje się w ignorowanym `license-server/cloudflare/wrangler.local.json`. Publiczny szablon `wrangler.json` nie zawiera sekretów ani prawdziwego identyfikatora bazy. Nie wdrażaj szablonu bez przygotowania lokalnej konfiguracji.

## Połączenie aplikacji i wydań GitHub

Adres musi zostać zapisany w nowo zbudowanym instalatorze. Stara lokalna wersja, która wskazuje `127.0.0.1`, nie przełączy się sama po wdrożeniu serwera.

Wersja 4.2.1 ma już publiczny adres w `desktop/license-server.json`, używany również w GitHub Actions. Przy zmianie serwera zmień ten plik lub ustaw nadpisującą zmienną w repozytorium GitHub **Settings → Secrets and variables → Actions → Variables → New repository variable**:

```text
TAPNOVA_LICENSE_URL = https://tapnova-licenses.TWOJ-ADRES.workers.dev
```

To publiczny adres, więc jest zmienną, a nie sekretem. Nie wpisuj tam hasła ani klucza licencyjnego. Workflow sprawdza `/health` przed budowaniem instalatorów i nie publikuje niekompletnego wydania. Windows instaluje aktualizację przez istniejący updater, a macOS pobiera i otwiera instalator.

Lokalna kompilacja Windows:

```powershell
$env:TAPNOVA_LICENSE_URL='https://tapnova-licenses.TWOJ-ADRES.workers.dev'
Remove-Item Env:TAPNOVA_LICENSE_TEST -ErrorAction SilentlyContinue
pnpm dist:win
```

macOS buduje się na natywnych runnerach GitHub Actions dla Intel i Apple Silicon. Sam test protokołu `darwin` nie jest testem uruchomienia macOS.

## Obsługa licencji

1. Otwórz panel i wpisz swoje hasło właściciela.
2. Wpisz etykietę odbiorcy, wybierz 7/30/90 dni lub bezterminowo oraz limit 1–20 urządzeń.
3. Wygeneruj kod i skopiuj go od razu: pełny kod jest pokazany tylko przy tworzeniu lub zastąpieniu. Baza przechowuje HMAC kodu oraz jego skróconą podpowiedź.
4. Przekaż kod danej osobie prywatnie. Użytkownik wpisuje kod i nazwę urządzenia w aplikacji. Licencja zaczyna odliczać czas przy pierwszej aktywacji.
5. Panel pokazuje przypisane urządzenia i ostatni kontakt. „Online” oznacza kontakt w ciągu ostatnich 45 sekund, nie potwierdzenie, że osoba patrzy na ekran. Etykieta to nazwa nadana przez Ciebie, a nie zweryfikowana tożsamość gracza.
6. Dostępne są: przedłużenie, zmiana limitu, odłączenie urządzenia, reset wszystkich urządzeń, blokada, odblokowanie, zastąpienie kodu i usunięcie licencji. Zastąpienie kodu unieważnia stary kod i sesje urządzeń.

Blokada działa na kolejnym sprawdzeniu online co około 15 sekund. Klient ma maksymalnie 24-sekundową ważność ostatniego potwierdzenia; błędy połączenia blokują dostęp. Nie jest to obietnica blokady w tej samej milisekundzie.

## Bezpłatne limity i dostępność

Według dokumentacji sprawdzonej 29.10.2026:

- Workers Free: 100 000 wywołań dziennie i 10 ms czasu CPU na żądanie.
- D1 Free: 5 mln odczytanych wierszy dziennie, 100 000 zapisanych wierszy dziennie i 5 GB danych łącznie; obowiązują również limity pojedynczej bazy.
- Jedno urządzenie uruchomione przez całą dobę wykonuje około 5760 kontroli licencji. Przy obecnym interwale rozsądny początkowy budżet to około **15 stale aktywnych urządzeń**, z zapasem na panel i pozostałe zapytania. To wyliczenie, nie gwarantowana pojemność; inne Workery na koncie też zużywają limity. Więcej osób korzystających krótko może zmieścić się w tym samym budżecie.
- Przy przekroczeniu limitów darmowy serwer może przestać odpowiadać do resetu limitu, a aplikacja zablokuje dostęp. Nie ma automatycznego przejścia na płatny plan przez ten skrypt.
- Nie wybieraj Workers Paid, jeśli chcesz pozostać na darmowym planie. W panelu Cloudflare kontroluj Workers → Metrics oraz D1 → Metrics.

Źródła: [limity Workers](https://developers.cloudflare.com/workers/platform/limits/), [cennik D1](https://developers.cloudflare.com/d1/platform/pricing/).

## Hasło, dane i bezpieczeństwo

Przeglądarka wylicza kosztowny PBKDF2-SHA256 (600 000 iteracji), serwer weryfikuje jego skrót. Wysłany przez HTTPS dowód logowania jest poufny tak samo jak hasło: nie zapisujemy go w logach ani w bazie. Sesje właściciela korzystają z ciasteczka HttpOnly/SameSite/ Secure dla HTTPS i wygasają po 12 godzinach. Wylogowanie usuwa sesję. Zmiana weryfikatora unieważnia poprzednie sesje.

Zmiana hasła panelu Cloudflare:

```powershell
node scripts/Setup-Cloudflare.cjs --reset-owner
pnpm cloudflare:deploy
```

Nie zmienia to hasła starego, lokalnego panelu. Nie usuwaj `LICENSE_SECRET`: jego zmiana bez migracji unieważni istniejące kody. Plik `.data` i konfigurację lokalną trzymaj poza Gitem; nie wysyłaj ich użytkownikom. Instalator zawiera tylko publiczny URL serwera. UI logowania jest publicznie dostępne, lecz dane i operacje administratora wymagają uwierzytelnienia po stronie serwera. Ukrycie adresu panelu nie jest zabezpieczeniem.

Rekordy licencji i przypisania znajdują się w Cloudflare D1. Dziennik administracyjny jest przechowywany 90 dni, wygasłe sesje są czyszczone codziennie. Aplikacja przechowuje token aktywacji przez szyfrowanie systemowe Electron. Limit przypisań ogranicza współdzielenie kodów, lecz aplikacji uruchamianej na cudzym komputerze nie da się uczynić niemożliwą do zmodyfikowania.

## Kopia zapasowa i kolejne publikacje

Przed większymi zmianami wykonaj eksport D1 do prywatnego folderu (nie do repozytorium):

```powershell
pnpm exec wrangler d1 export DB --remote --config license-server/cloudflare/wrangler.local.json --output license-server/.data/cloudflare-backup.sql
```

Zabezpiecz eksport oraz plik sekretów razem. Eksport zawiera dane użytkowników i skróty kodów/tokenów. Nie publikuj ich w GitHub Releases. Przy przywracaniu kopii użyj tego samego `LICENSE_SECRET`.

Zmiany backendu: `pnpm test:cloudflare`, następnie `pnpm cloudflare:deploy`. Zmiany aplikacji wymagają osobnego zwiększenia wersji oraz zbudowania i opublikowania instalatorów. Testy Cloudflare uruchamiają prawdziwy lokalny runtime Workers i D1, sprawdzając równoczesne aktywacje, revokację, wygasanie, rotację, wylogowanie, CSRF, limit prób oraz przeglądarkowy panel właściciela.
