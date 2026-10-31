# Tło powitania TAPNOVA

Edycja wykonana wbudowanym narzędziem imagegen. Plik źródłowy użytkownika: `2-Zdjęcie-2.jpg` z wiadomości z banerem TAPNOVA.

Wynik w projekcie: `license-server/public/discord/welcome-background.png`. `welcome-background.jpg` jest kopią zapisaną jako JPEG (jakość 85), aby karta generowana w chmurze mogła osadzić lekkie tło bez dodatkowego pobierania strony. Oryginał użytkownika nie został zmieniony.

Prompt użyty do edycji:

> Use case: precise-object-edit. Edit target: provided purple TAPNOVA banner. Remove the entire large silver/purple TAPNOVA lettering and its lettering shadows and reconstruct the purple abstract textured background naturally in that area. Keep the existing dark purple diagonal abstract ribbons, violet illumination, scattered purple petals/confetti, grain texture, original edge decorations and overall palette/composition. Clean uninterrupted dark violet center for later programmatic overlay of a user avatar and welcome text. Do not add any text, letters, logo, avatar, circles, UI, watermark, or new objects. Preserve landscape 16:9 full-bleed background. This is a reusable Discord welcome-card background.

Tekst powitania i awatar dodaje kod `license-server/cloudflare/welcome-card.mjs`; nie są częścią tła. Test tworzy podgląd w `test-results/discord-welcome-preview.png`, a polecenie `node scripts/Inspect-Discord.cjs welcome-preview` tworzy rzeczywisty podgląd serwerowy w `test-results/discord-welcome-live.png`. Pliki testowe nie trafiają do repozytorium.
