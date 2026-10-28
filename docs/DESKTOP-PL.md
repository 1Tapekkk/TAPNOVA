# TAPNOVA 4 — Windows i macOS

created by 1TapGod

## Uruchomienie

- Windows x64: uruchom `TAPNOVA-4.1.0-win-x64.exe`, wybierz katalog instalacji i otwórz skrót „TAPNOVA 4”. Nie potrzebujesz .NET ani WebView2 — przeglądarka jest w paczce.
- macOS: wybierz paczkę `arm64` dla Apple Silicon (M1 i nowsze) lub `x64` dla Intela. Otwórz DMG i przeciągnij TAPNOVA do Applications albo rozpakuj ZIP i przenieś TAPNOVA.app do Applications.
  Wymagany macOS 13 Ventura lub nowszy. Wydanie z GitHub Actions buduje i sprawdza paczki osobno na Macach Intel i Apple Silicon.
- Kliknij „Otwórz grę”, zaloguj się w MSP2, a następnie wybierz narzędzie z bocznego menu.
- W autografach otwórz panel, wpisz nick, naciśnij Enter albo kliknij wyszukiwanie. Wybierz gracza z listy wyników.
- Przycisk STOP w panelu zatrzymuje aktywne zadania. Nie cofa operacji przyjętych wcześniej przez serwer gry.

## Komentarze pod statusem

Otwórz **Profil → Status → Komentarze statusu**. Lista pojawi się w osobnym
oknie z avatarami, nickami, treścią i datą. Ikona kosza otwiera podgląd
konkretnego komentarza oraz przyciski „Anuluj” i „Tak, usuń”.

Możesz szukać po autorze lub treści. Przycisk „Zaznacz” umożliwia usunięcie
kilku wybranych komentarzy. Opcja autora w potwierdzeniu pokazuje jego wpisy
przed ich usunięciem. Jeśli pozostały kolejne strony, najpierw je pobiera,
a następnie wymaga zatwierdzenia pełnej listy. Odświeżanie i zamknięcie są
w nagłówku; Escape zamyka najpierw potwierdzenie, potem okno listy.

Usunięcie jest nieodwracalne. Po zakończeniu lub błędzie odśwież listę przed
kolejną operacją. STOP przerywa dalsze żądania, ale żądanie już wysłane mogło
zostać wykonane przez grę. Zmiana konta czyści listę.

Funkcja komunikuje się bezpośrednio z API MSP2 i nie przekazuje sesji do
msp2tool.lol ani innych zewnętrznych narzędzi. Nie gwarantuje zniknięcia napisu
„komentarz usunięty” u innych graczy — tym steruje serwer i klient gry.
Integracja ma testy z symulowanym API; działanie na prawdziwym koncie i widok
z drugiego konta wymagają osobnej weryfikacji.

## Sesja i dane

### Własny pulpit i skróty

W panelu narzędzi kliknij **Mój pulpit** albo **Szukaj · Ctrl+K**. Na Macu
działa też `Cmd+K`. Wyszukiwarka ignoruje polskie znaki, a Enter otwiera pierwszy
wynik. Gwiazdka przypina narzędzie do ulubionych (do 12 skrótów). W zakładce
Ulubione zmienisz kolejność strzałkami. Skróty pojawiają się także pod nagłówkiem
aktualnej sekcji. Otwarcie narzędzia nie uruchamia jego automatyzacji.

**Archiwum** przechowuje kopie komentarzy przed usunięciem, oddzielnie dla każdego
konta i regionu. „Usunięcie potwierdzone” oznacza odpowiedź serwera; „wynik
niepotwierdzony” oznacza wyłącznie zapisaną kopię. Archiwum nie odtwarza wpisów
w grze. Gdy osiągnie 500 wpisów lub zapis się nie powiedzie, usuwanie zostanie
wstrzymane przed wysłaniem żądań. Możesz wyeksportować archiwum do JSON i wyczyścić
lokalne wpisy po potwierdzeniu.

**Dziennik** zapisuje ostatnie 100 obsługiwanych zadań od dodania tej funkcji:
zakończenie, błąd lub zatrzymanie. Nie odtwarza wcześniejszej historii konta i nie
jest rejestrem każdej automatycznej czynności gry. Eksport zawiera nazwy operacji,
wyniki oraz daty, bez haseł, tokenów i surowych odpowiedzi API.

### Zdjęcia gry

W desktopowej aplikacji otwórz grę i kliknij aparat obok odświeżania albo naciśnij
`Ctrl+Shift+S` (`Cmd+Shift+S` na Macu). Po trzech sekundach TAPNOVA ukryje swój
panel, wykona zdjęcie widoku gry i przywróci panel. Następnie wybierzesz miejsce
zapisu PNG. Elementy interfejsu samej gry pozostają na zdjęciu. Przejście do
innego widoku lub przeładowanie gry podczas odliczania przerywa zdjęcie.

### Dane lokalne

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

Na Macu: `pnpm dist:mac` tworzy DMG i ZIP osobno dla Apple Silicon i Intela. Workflow `.github/workflows/desktop.yml` uruchamia się po wysłaniu zmian na main lub ręcznie. Wykonuje testy i buduje paczki na Windows x64, macOS Intel oraz macOS Apple Silicon. Sprawdza zasoby i uruchamia gotową aplikację na każdej platformie. Po sukcesie wszystkich trzech zadań publikuje nowe wydanie na GitHub Releases. Numer pochodzi z package.json; opublikowane wydania nie są nadpisywane.

Alternatywnie na Windows po `pnpm prepare:desktop`: `python scripts/Package-Mac.py` tworzy niepodpisane ZIP-y bez rozpakowywania dowiązań Unix na dysk Windows. Skrypt sprawdza oficjalne sumy SHA-256 środowiska Electron, architekturę Mach-O, prawa wykonywania, dowiązania i integralność archiwów. Wymaga Pythona 3.11+ i dostępu do oficjalnych wydań Electron na GitHub.

## Podpisywanie i stan weryfikacji

Paczka Windows nie ma podpisu wydawcy. Paczki macOS budowane przez electron-builder mają podpis techniczny ad-hoc, bez certyfikatu Developer ID i notaryzacji. Windows może pokazać SmartScreen, a macOS Gatekeeper. Do publicznej dystrybucji bez ostrzeżeń potrzebne są certyfikaty wydawcy; macOS wymaga podpisu Developer ID i notaryzacji wykonanej na Macu. Konfiguracja domyślnie nie podszywa się pod podpisane wydanie. Aby włączyć podpis wydawcy macOS, zastąp `mac.identity: "-"` tożsamością Developer ID, włącz hardenedRuntime i notaryzację oraz skonfiguruj certyfikaty i uprawnienia w środowisku budowania.

Testy automatyczne używają sztucznej sesji i blokują ruch sieciowy gry. Sprawdzają klawiaturę, interfejs, lokalny most danych i izolację od systemu. Nie zastępują sprawdzenia funkcji MSP2 na prawdziwym koncie ani uruchomienia gotowej paczki na docelowym Macu.

Jeśli macOS blokuje pobraną aplikację i ufasz temu wydaniu, po próbie uruchomienia wybierz Ustawienia systemowe → Prywatność i ochrona → Otwórz mimo to. Nie wyłączaj Gatekeepera. [Instrukcja Apple](https://support.apple.com/pl-pl/102445).

## Projekt

[Edytowalny projekt w Figmie](https://www.figma.com/design/4rK0z1zkwGDv91K1z9ldCN)

Kod aplikacji: `desktop/`. Wspólna warstwa panelu: `Resources/Extension/panel-ui.js`. Logika funkcji: `Resources/Extension/app.js`. Projekt bazuje na MSP2TOOL / 6x0k Space; szczegóły pochodzenia w LICENSE i NOTICE.
