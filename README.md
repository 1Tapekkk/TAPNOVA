# TAPNOVA
**created by 1TapGod**

## Nowe wydanie 4.0 — Windows i macOS

Nowa aplikacja w `desktop/` ma profesjonalny interfejs z bocznym menu, lokalnymi fontami Inter, ekranem startowym, przewodnikiem i ustawieniami. Wspólny panel ma większe pola oraz naprawioną obsługę klawiatury: wpisywanie nicku, wklejanie, polskie znaki, Enter i Tab działają niezależnie od obsługi klawiatury w grze.

- Windows: instalator `release/desktop/TAPNOVA-4.0.0-win-x64.exe`. `START_TAPNOVA.bat` wybiera nową aplikację, jeśli została zbudowana.
- macOS: paczki ZIP dla Apple Silicon (`arm64`) i Intela (`x64`). Natywne DMG można zbudować na Macu przez `pnpm dist:mac` lub workflow `.github/workflows/desktop.yml`.
- [Projekt w Figmie](https://www.figma.com/design/4rK0z1zkwGDv91K1z9ldCN) · [Instrukcja instalacji, budowania i ograniczenia weryfikacji](docs/DESKTOP-PL.md).

Paczki lokalne nie mają podpisu wydawcy. macOS wymaga weryfikacji na prawdziwym Macu; testy funkcji gry korzystają wyłącznie ze sztucznej sesji. Nowy profil jest oddzielny od starego — zaloguj się ponownie.

Programiści: `pnpm install --frozen-lockfile`, `node node_modules/electron/install.js`, `pnpm start`. Testy: `pnpm prepare:desktop`, `pnpm exec playwright install chromium`, `pnpm test`. Instalator Windows: `pnpm dist:win`.

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
