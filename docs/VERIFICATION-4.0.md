# TAPNOVA 4.0 — verification

Verified on Windows, 2026-10-26. Tests use fake accounts and intercept game traffic.

- Control core: preset validation, persistence, duplicate handling, invalid imports, cancelled requests, stale epochs, STOP persistence.
- Keyboard: actual autograph input in the closed shadow root; typing, selection, Backspace, Polish clipboard paste, Enter exactly once, Tab navigation; simulated game capture listeners; game input restored after leaving the panel. Autograph status redraw retains focus and caret.
- Panel: identity, settings migration, navigation, shortcuts, maximize/minimize, close/restore, narrow viewport.
- Localization: ten tabs, three dialogs, PL/EN/TR switching, placeholders and user text retained.
- Control center: preset CRUD, preview/apply/undo, import/export, cancellation and stopped automations.
- Electron: real application runtime, navigation, minimum window size, sandbox and context isolation, document-start injection in main and child frames, local data-pack bridge and reinjection after navigation. All remote requests fulfilled with offline fixtures.
- macOS archives: official Electron SHA-256 verified; Mach-O CPU matches arm64/x64; executable permissions and framework symlinks preserved; required resources and ZIP CRC verified.

## Not verified

- Execution on a real Mac, macOS signing/notarization and Gatekeeper behavior.
- Live MSP2 account login, autograph sending and other game operations.
- The installer does not have a publisher signing certificate.

The Figma file contains native editable frames, vectors, text and component instances. The API Starter quota prevented the final height adjustment of its bottom onboarding row. The implemented desktop app uses scrolling and does not inherit that canvas clipping.

Run `pnpm prepare:desktop` and `pnpm test` to repeat the offline checks. Set `TAPNOVA_TEST_EXE` to the built Windows executable to run `node scripts/Check-Desktop.cjs` against the packaged application.
