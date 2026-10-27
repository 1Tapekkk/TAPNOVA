# TAPNOVA 4 — Windows i macOS

created by 1TapGod

## Uruchomienie

- Windows x64: uruchom `TAPNOVA-4.0.0-win-x64.exe`, wybierz katalog instalacji i otwórz skrót „TAPNOVA 4”. Nie potrzebujesz .NET ani WebView2 — przeglądarka jest w paczce.
- macOS: wybierz paczkę `arm64` dla Apple Silicon (M1 i nowsze) lub `x64` dla Intela. Otwórz DMG i przeciągnij TAPNOVA do Applications albo rozpakuj ZIP i przenieś TAPNOVA.app do Applications.
  Wymagany macOS 13 Ventura lub nowszy. Utworzone na Windows ZIP-y zachowują uprawnienia plików i dowiązania frameworków, ale wymagają sprawdzenia na Macu.
- Kliknij „Otwórz grę”, zaloguj się w MSP2, a następnie wybierz narzędzie z bocznego menu.
- W autografach otwórz panel, wpisz nick, naciśnij Enter albo kliknij wyszukiwanie. Wybierz gracza z listy wyników.
- Przycisk STOP w panelu zatrzymuje aktywne zadania. Nie cofa operacji przyjętych wcześniej przez serwer gry.

## Sesja i dane

Wydanie Electron ma oddzielny profil od starej aplikacji WPF. Przy pierwszym uruchomieniu zaloguj się ponownie. Stary profil pozostaje bez zmian.

- Windows: `%APPDATA%/TAPNOVA`
- macOS: `~/Library/Application Support/TAPNOVA`

Nie przekazuj innym tych katalogów — zawierają sesję gry. Instalatory i paczki budują się wyłącznie z kodu i publicznych zasobów, bez lokalnych danych konta.

## Budowanie

Wymagania dla programisty: Node.js 24 i pnpm 11.25.0. Użytkownik gotowej paczki nie potrzebuje Node.js.

```sh
corepack enable
corepack prepare pnpm@11.25.0 --activate
pnpm install --frozen-lockfile
node node_modules/electron/install.js
pnpm start
```

Windows: `pnpm dist:win` tworzy instalator x64 w `release/desktop`.

Na Macu: `pnpm dist:mac` tworzy DMG i ZIP osobno dla Apple Silicon i Intela. Workflow `.github/workflows/desktop.yml` wykonuje kompilacje i testy na obu systemach, gdy projekt zostanie umieszczony w repozytorium GitHub i uruchomiony ręcznie. Nie publikuje plików automatycznie.

Alternatywnie na Windows po `pnpm prepare:desktop`: `python scripts/Package-Mac.py` tworzy niepodpisane ZIP-y bez rozpakowywania dowiązań Unix na dysk Windows. Skrypt sprawdza oficjalne sumy SHA-256 środowiska Electron, architekturę Mach-O, prawa wykonywania, dowiązania i integralność archiwów. Wymaga Pythona 3.11+ i dostępu do oficjalnych wydań Electron na GitHub.

## Podpisywanie i stan weryfikacji

Lokalne paczki są niepodpisane. Windows może pokazać SmartScreen, a macOS Gatekeeper. Do publicznej dystrybucji bez ostrzeżeń potrzebne są certyfikaty wydawcy; macOS wymaga podpisu Developer ID i notaryzacji wykonanej na Macu. Konfiguracja domyślnie nie podszywa się pod podpisane wydanie. Aby włączyć podpisywanie macOS, usuń `mac.identity: null` z konfiguracji i skonfiguruj własne certyfikaty i notaryzację w środowisku budowania.

Testy automatyczne używają sztucznej sesji i blokują ruch sieciowy gry. Sprawdzają klawiaturę, interfejs, lokalny most danych i izolację od systemu. Nie zastępują sprawdzenia funkcji MSP2 na prawdziwym koncie ani uruchomienia gotowej paczki na docelowym Macu.

## Projekt

[Edytowalny projekt w Figmie](https://www.figma.com/design/4rK0z1zkwGDv91K1z9ldCN)

Kod aplikacji: `desktop/`. Wspólna warstwa panelu: `Resources/Extension/panel-ui.js`. Logika funkcji: `Resources/Extension/app.js`. Projekt bazuje na MSP2TOOL / 6x0k Space; szczegóły pochodzenia w LICENSE i NOTICE.
