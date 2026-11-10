# Nowe funkcje TAPNOVA 4.4.0

## Aplikacja

W oknie logowania zaznacz „Zapamiętaj nick i serwer”. Profile przechowują tylko te dwie informacje (maksymalnie 20 profili). „Zmień profil” wylogowuje panel konta, umożliwia wybór innego profilu i ponowne podanie hasła. Sesja oficjalnej gry jest odrębna.

Biblioteka pokazuje wymagania licencji, konta i gry. Komunikat o otwartej grze nie potwierdza zalogowania do pokoju; należy sprawdzić to w MSP2. Rozmowy i ochrona otwierają grę. Historia w Ustawieniach pokazuje ostatnie 100 zapisanych zdarzeń; pełniejszy raport (do 500 zdarzeń) można wyeksportować. Ponowienie otwarcia gry nie powtarza zakupów ani zadań zmieniających konto.

## Panel licencji

„Zarządzaj” pozwala edytować odbiorcę i notatki. Notatki są widoczne tylko w panelu administratora, nie w odpowiedziach aktywacji i heartbeat aplikacji.

„Utwórz serię” generuje od 1 do 20 kodów z numerowanymi nazwami. Pobierz CSV przed zamknięciem okna. CSV neutralizuje początkowe znaki formuł arkusza. Ponowienie identycznej próby w tym samym otwartym formularzu przez godzinę zwraca tę samą serię. Odpowiedź jest przez ten czas przechowywana zaszyfrowana w bazie. Po odświeżeniu strony lub zamknięciu okna odzyskanie kodów z panelu nie jest dostępne — w razie utraty zastąp klucze nowymi.

Historia udostępnia wszystkie zachowane wpisy, po 50 na stronę, z filtrem operacji i wyszukiwaniem odbiorcy lub ID. Usuniętych wcześniej wpisów starszych niż 90 dni nie można odtworzyć. Nowa wersja nie usuwa historii automatycznie; zaplanuj archiwizację bazy wraz ze wzrostem liczby wpisów.

## Włączenie 2FA

1. Otwórz „Bezpieczeństwo i alerty” → „Konfiguruj 2FA”.
2. Potwierdź hasło administratora i rozpocznij konfigurację.
3. Dodaj podany klucz ręcznie w aplikacji uwierzytelniającej: TOTP, 6 cyfr, 30 sekund. Wpisz kod i zatwierdź w ciągu 10 minut.
4. Zapisz osiem jednorazowych kodów odzyskiwania poza tym urządzeniem. Możesz ich użyć zamiast kodu z aplikacji. Ten sam kod TOTP nie może zostać użyty dwukrotnie; po konfiguracji poczekaj na kolejny kod lub użyj kodu odzyskiwania.

Włączenie i wyłączenie 2FA unieważnia pozostałe sesje panelu. Wyłączenie wymaga hasła i nowego kodu lub kodu odzyskiwania. Sekret TOTP jest szyfrowany AES-GCM z kluczem wyprowadzonym z LICENSE_SECRET, a kody odzyskiwania są przechowywane jako skróty. Zachowaj kopię LICENSE_SECRET poza repozytorium. Implementacja TOTP jest weryfikowana wektorami z [RFC 6238](https://www.rfc-editor.org/rfc/rfc6238).

## Przypomnienia Discord

Wpisz ID kanału w „Bezpieczeństwo i alerty”, zaznacz wysyłanie i zapisz. Bot musi mieć dostęp do kanału tekstowego na skonfigurowanym serwerze oraz uprawnienie wysyłania wiadomości. Cron Cloudflare sprawdza terminy co 5 minut, także przy wyłączonym komputerze.

Alerty zawierają liczbę nowo wykrytych licencji dla progów: do 7 dni, do 24 godzin i po wygaśnięciu (do 7 dni wstecz). Licencje zablokowane i bezterminowe są pomijane. Nie wysyłają nazw odbiorców, kodów ani notatek. Zmiana daty ważności rozpoczyna nowy cykl powiadomień. Baza deduplikuje wysłane progi, a Discord otrzymuje stały identyfikator wiadomości. Po niejednoznacznym błędzie sieci ponowienie następuje najwcześniej po 10 minutach; w rzadkich przypadkach utraty potwierdzenia możliwy jest duplikat. Stan błędu jest widoczny w panelu.

## Pozostałe kroki wymagające właściciela

- Podpisywanie instalatorów: potrzebne certyfikaty Windows oraz Apple Developer ID i dane notaryzacji. Obecne wydanie zachowuje dotychczasową konfigurację bez certyfikatów.
- Test rzeczywistego konta: zaloguj się, zapisz profil, przełącz go i sprawdź narzędzia konta; następnie otwórz grę i pokój. Automatyczne testy nie wysyłają rzeczywistych autografów, nie kupują przedmiotów i nie korzystają z kont użytkowników.

Walidacja: `pnpm test`, `pnpm test:admin`, `pnpm test:cloudflare`.
