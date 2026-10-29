# TAPNOVA
**created by 1TapGod**

## Wydanie 4.2.1 — Windows i macOS

[Pobierz gotową aplikację z Releases](https://github.com/1Tapekkk/TAPNOVA/releases/latest). Pliki pojawiają się po zakończeniu testów i budowania wszystkich systemów w GitHub Actions.

| Komputer | Plik do pobrania |
| --- | --- |
| Windows 10/11 (64-bit) | TAPNOVA-4.2.1-win-x64.exe |
| Mac Apple Silicon (M1 i nowsze), macOS 13+ | TAPNOVA-4.2.1-mac-arm64.dmg |
| Mac Intel, macOS 13+ | TAPNOVA-4.2.1-mac-x64.dmg |

Na Windows uruchom instalator. Na Macu otwórz DMG i przeciągnij TAPNOVA do Applications. ZIP jest alternatywą dla DMG. Do używania programu nie potrzebujesz Node.js, GitHuba ani plików „Source code”.

Nowość w 4.2.1: **licencje online w Cloudflare**, działające również przy wyłączonym komputerze twórcy. Zachowano aktualizacje z aplikacji, komentarze statusu, wyszukiwarkę i ulubione, archiwum komentarzy, dziennik zadań i zdjęcia gry. [Lista zmian](docs/releases/4.2.1.md) · [Instrukcja](docs/DESKTOP-PL.md).

Paczki nie mają certyfikatu wydawcy. Mac używa podpisu ad-hoc, bez notaryzacji Apple, więc system może zablokować pierwsze uruchomienie. Instrukcja opisuje instalację i ograniczenia. Testy gry używają symulowanej sesji.

Użytkownicy 4.1.0 i starszych muszą zainstalować 4.2.1 ręcznie jeden raz, aby otrzymywać kolejne aktualizacje w aplikacji.

### Wydanie na GitHubie

Wyślij commit na gałąź **main** (w GitHub Desktop: **Push origin**). Workflow **TAPNOVA desktop packages** przetestuje aplikację i gotowe paczki na Windows, Macu Intel i Apple Silicon. Dopiero po sukcesie wszystkich trzech zadań opublikuje wersję z package.json, instalatory, instrukcję i sumy SHA-256 w Releases. Ręczne uruchomienie: Actions → TAPNOVA desktop packages → Run workflow.

Kolejne wydanie wymaga zwiększenia wersji w package.json i dodania odpowiadającego jej pliku docs/releases/WERSJA.md. Opublikowane wydanie nie jest nadpisywane.

Programiści: pnpm install --frozen-lockfile, node node_modules/electron/install.js, pnpm start. Testy: pnpm prepare:desktop, pnpm exec playwright install chromium, pnpm test.

Poniżej zachowano opis starszego wydania WPF i jego skryptów .NET.

Klient MSP2 z monogramem TN, grafitowym interfejsem, lawendą i brzoskwiniowym akcentem.

![TAPNOVA](Resources/Brand/tapnova.png)

## Uruchomienie
Otwórz `release\TAPNOVA\TAPNOVA.exe` albo uruchom `START_TAPNOVA.bat`.
Przenieś cały folder `release\TAPNOVA`, jeśli chcesz używać aplikacji w innym miejscu — zawiera także rozszerzenie i biblioteki.
Wymagania: Windows x64, Microsoft Edge WebView2 Runtime i połączenie z internetem.
Opublikowana wersja zawiera środowisko .NET.

## Panel TAPNOVA 3.3
Panel ma dwurzędową nawigację u góry, lawendowy blok „Graj po swojemu.”, monogram TN i listę skrótów. Na wąskich ekranach ikony menu układają się nad podpisami. Okno aplikacji ma osobny pasek przycisków po lewej oraz nowy ekran startowy w tym samym stylu.
Warstwa wyglądu znajduje się w `Resources/Extension/panel-ui.js`; logika gry pozostaje w `app.js`.
Przy pierwszym uruchomieniu tej wersji panel przechodzi na fioletowy motyw i język polski; późniejsze własne wybory zostają zachowane.
TAPNOVA wyłącza inne zainstalowane kopie tego narzędzia w swoim profilu, aby stary panel nie pojawiał się zamiast nowego.
Zamknij poprzedni klient MSP2MultiToolV3 i uruchamiaj aplikację przez `START_TAPNOVA.bat`.

## Co zmieniono
- Wersja 3.3.0: centrum sterowania z listą aktywnych funkcji, pomocą kontekstową z wyszukiwaniem i zestawami ustawień. STOP przerywa żądania narzędzi, wyłącza boty, autografy, AFK, automatyczne polubienia i ochronę przed spamem. Stan zatrzymania jest zapisany; odblokowanie nie uruchamia tych funkcji ponownie. Operacje już przyjęte przez serwer nie są cofane.
- Zestawy: trzy konfiguracje startowe, do 20 własnych zestawów, porównanie przed zastosowaniem, cofnięcie ostatniego zastosowania, zmiana nazwy, usuwanie z możliwością przywrócenia oraz import/eksport JSON z walidacją i podglądem. Obejmują wygląd, dźwięki, tempa i parametry ochrony; nie zawierają danych konta, treści wiadomości, list graczy ani obrazów. Przed zastosowaniem należy zatrzymać aktywne zadania.
- Wersja 3.2.1: uzupełniono polskie przyciski, opisy, podpowiedzi, komunikaty i nazwy kolorów. Ustawienia ochrony używają polskich nazw i jednostek czasu. Słownik dodatkowych tłumaczeń znajduje się w `Resources/Extension/locales-pl.js`; wybór innego języka pozostaje zachowany.
- Nowa nazwa TAPNOVA i podpis „created by 1TapGod” w oknie, ekranie startowym i panelu narzędzi.
- Autorskie logo wektorowe, wielorozmiarowa ikona EXE i ikony rozszerzenia.
- Nowy układ panelu i okna, elastyczny pasek adresu, kolory, przyciski oraz ekran ładowania.
- Polskie komunikaty aplikacji i domyślny polski język rozszerzenia; zapisany wybór języka i motywu ma pierwszeństwo.
- Opcja ponowienia startu po błędzie.
- Metadane pliku EXE, gotowy katalog wydania i skrypty budowania.

Dotychczasowy profil pozostaje w `%LocalAppData%\MSP2MultiToolV3\WebView2`, aby zachować sesję i ustawienia.
Przycisk „Wyczyść dane” usuwa lokalne dane stron po potwierdzeniu i wylogowuje z gry.

## Budowanie
Zainstaluj .NET 8 SDK i uruchom `BUILD_TAPNOVA.bat`.
Wynik: `release\TAPNOVA\TAPNOVA.exe`.
Pliki `BUILD.bat` i `BUILD_V3.bat` wywołują ten sam skrypt.

Kontrola interfejsu offline (wymaga Playwright i Chromium): `node scripts/Check-Panel.cjs` oraz `node scripts/Check-Localization.cjs`.
Drugi skrypt sprawdza 10 zakładek, 3 okna narzędzi, zmianę języka i wąski układ na sztucznej sesji, blokując wszystkie połączenia z grą.

Centrum sterowania: `node scripts/Check-Control-Core.cjs` sprawdza walidację, zapis i mechanizm anulowania. `node scripts/Check-Control-Center.cjs` sprawdza obsługę klawiaturą, zestawy i pliki, przerywanie kolejki, blokadę opóźnionej odpowiedzi bota, restart, język i mały ekran. Testy korzystają ze sztucznego konta i blokują zewnętrzny ruch gry.

Ręcznie:
```powershell
dotnet publish MSP2TOOL.Desktop.csproj -c Release -r win-x64 --self-contained true -o release/TAPNOVA
```

## Logo i wygląd
- `Resources/Brand/tapnova.svg` — logo wektorowe.
- `Resources/Brand/tapnova.png` — logo PNG.
- `Resources/Brand/tapnova.ico` — ikona Windows.
- `Resources/Brand/Theme.xaml` — kolory, style i znak WPF.
- `Resources/Brand/preview-1440.png` — podgląd ekranu startowego.

Ponowne generowanie ikon i podglądów na Windows:
```powershell
powershell -NoProfile -ExecutionPolicy Bypass -STA -File scripts/Render-Brand.ps1 -Preview
```
Podglądy renderują lokalny układ WPF bez ładowania gry.

## Pochodzenie
TAPNOVA jest zmodyfikowanym wydaniem MSP2 MultiTool v3, opartym na MSP2TOOL Desktop / 6x0k Space autorstwa 6x0k.
Podpis „created by 1TapGod” identyfikuje tę edycję i jej oprawę.
Informacje o bazie: [NOTICE](NOTICE), [LICENSE](LICENSE), [oryginalny README](docs/README-upstream.md) i [historia v3](docs/README-v3-history.md).
Logika modułów gry pochodzi z dołączonego rozszerzenia; nie przeprowadzono testów funkcji na zalogowanym koncie ani pełnego audytu rozszerzenia.
Projekt jest niezależny od właścicieli MovieStarPlanet 2.

## Licencje i panel właściciela

Wdrożenie na darmowym Cloudflare, generowanie kodów, limity i kopie zapasowe: [CLOUDFLARE-PL.md](docs/CLOUDFLARE-PL.md). Publiczny URL jest ustawiony w `desktop/license-server.json`; zmienna repozytorium `TAPNOVA_LICENSE_URL` może go nadpisać. Alternatywny serwer lokalny/VPS: [LICENCJE-PL.md](docs/LICENCJE-PL.md). Wydanie z adresem 127.0.0.1 służy wyłącznie do lokalnych testów właściciela.
