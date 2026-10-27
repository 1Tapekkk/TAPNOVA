# MSP2 MultiTool v3 — Community Edition

**Źródło:** MSP2TOOL Desktop x64 v1.8.86 autorstwa 6x0k (kod użytkownika).
**Licencja:** Apache License 2.0 — patrz `LICENSE`. Zachowano oryginalne pliki źródłowe i informacje licencyjne.

## Co zmieniono
- Zmieniono nazwę okna, nagłówka i pliku wykonywalnego na MSP2 MultiTool v3.
- Wydzielono osobny katalog danych przeglądarki, aby nie mieszać sesji z oryginalną aplikacją.
- Dodano `BUILD_V3.bat` do publikacji Windows x64.
- Zachowano źródłowe rozszerzenie z repozytorium; **to nie jest niezależna implementacja API**.

## Budowanie
1. Zainstaluj .NET 8 SDK na Windows.
2. Rozpakuj archiwum i uruchom `BUILD_V3.bat`.
3. Po udanej kompilacji uruchom `bin\Release\net8.0-windows\win-x64\publish\MSP2MultiToolV3.exe`.
4. Zaloguj się w oknie klienta gry, jeśli chcesz przetestować dostępne moduły. Nie podawaj tokenów ani haseł żadnym osobom trzecim.

## Funkcje
W źródłowym rozszerzeniu występują moduły quizów, autografów, wiadomości, profilów i ubiorów. Ich obecne działanie na publicznych serwerach MSP2 **nie zostało zweryfikowane**. Zewnętrzne API może się zmieniać; używaj zgodnie z zasadami gry.

## Ważne ograniczenia
- Nie dostarczono gotowego nowego `.exe`: w środowisku budowania nie ma .NET SDK i Windows WebView2.
- Nie przeprowadzono pełnego audytu bezpieczeństwa dużego skryptu `app.js`; przed logowaniem sprawdź kod i uprawnienia rozszerzenia.
- Nie uruchamiano automatyzacji na serwerach produkcyjnych.
- Program jest zmodyfikowanym forkiem, a nie napisanym od zera odpowiednikiem.
