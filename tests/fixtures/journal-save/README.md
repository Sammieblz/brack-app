# Journal save browser fixture

This fixture renders the production `JournalEntriesList`, `JournalEntryDialog`, `QuickJournalEntryDialog`, `useJournalEntries`, TipTap editor, dialog primitives and toast presentation. The fixture does not replace editor or save-hook behavior.

Boundary adapters supply a synthetic authenticated reader, in-memory journal records, controlled local create/update promises, connectivity, attachment picking/upload, book-status follow-up and remote refresh. A deferred write changes local records only on commit. Rejection leaves the original record intact. The fixture exposes operation payloads/results and a parent-remount control to verify duplicate prevention and draft recovery without inspecting application hook state.

The dedicated Playwright configuration serves `127.0.0.1:8086`, requires a fresh server and blocks service workers. Tests abort every network request outside that exact origin. Synthetic attachments use a local SVG/data URL. There is no account, backend connection or production data.

Run from the repository root:

```sh
npx tsc -p tests/playwright/tsconfig.journal-save.json --noEmit
npx eslint tests/playwright/journal-save.config.ts tests/e2e/journal-save.spec.ts tests/fixtures/journal-save --max-warnings=0
npx playwright test --config tests/playwright/journal-save.config.ts
```

The 18 browser scenarios exercise full/quick save rejection and retry, formatted writing and metadata, attachment replacement integrity, duplicate activation, pending dismissal and editing locks, clean cancellation, explicit discard with keyboard focus restoration, full-editor pointer focus restoration, offline feedback, post-commit follow-up failure and pending parent remount. Upload scenarios defer attachment replacement, reject it while preserving the previous preview and writing, and then retry successfully. The suite runs in Chromium, Firefox and WebKit (54 cases), at widths of 390, 834 and 1024 CSS pixels depending on the scenario. Assertions concern visible behavior and boundary writes, not the implementation of the draft store.

Limits: controlled service adapters do not prove actual IndexedDB/SQLite, outbox/sync, stale-remote reconciliation, attachment storage, authenticated API, process-kill restoration, native Back/keyboard, or assistive-technology behavior. Real persistence adapters need their own targeted tests. A parent remount represents renderer component lifetime, not browser reload or device process death. Resized desktop engines do not prove native-device rendering. Quick-editor focus assertions use keyboard invocation; WebKit pointer clicks do not focus buttons by default. Record completed runs separately; this file describes coverage, not a passing result.

The separate [hydration driver tests](../../../apps/client/src/services/local/driver.hydration.test.ts) exercise the real Dexie driver against `fake-indexeddb`, including concurrent refresh/save operations through a second database connection. Those are emulated persistence tests, separate from this browser fixture's controlled service adapters.
