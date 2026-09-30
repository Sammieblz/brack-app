# CR04 actual Library tasks fixture

Authority: [coverage reconciliation, CR04](../../../docs/frontend-renewal/20-coverage-reconciliation.md) and [implementation checkpoint 24](../../../docs/frontend-renewal/24-library-list-tasks.md). This fixture provides deterministic browser evidence; it does not replace the implementation checkpoint or claim a real backend/device/assistive technology audit.

## Actual consumers retained

- `MyBooks` → flat `LibraryBookCard` within `SwipeableBookCard`; `LibraryBookshelfView` → `LibraryBookshelfSelection`; `LibraryCarouselView` → inline actions and `LibraryBookDetailSheet`.
- All five membership entries (flat, bookshelf nested, carousel inline, carousel nested, `BookDetail`) render real `LibraryBookActions`/`AddToListDialog`.
- `BookLists` → `BookListManager` create, edit, delete and duplicate; actual card menus and safe dirty confirmation.
- `BookListDetail` → real header and empty-state Add Books triggers, the shared `AddBooksToListDialog` owner, and actual row removal.
- Real `useBooks`, `useBookLists`, `useListBooks`, `useReadingProfile`, BookDetail progress/review hooks; real router, adaptive modal primitives, confirmation, app Back registration, loading regions, shell and font CSS.

Source census dispositions: `BookCard.tsx` has no mounted production JSX caller; `SwipeableBookListsCarousel` also has no incoming production imports. They are not substituted for actual consumers or counted as covered entry points.

## Controlled boundaries

`api.ts` supplies deterministic per-account books, list catalog and membership stores. Every relevant catalog/lookup/add/remove/create/update/delete/duplicate call is recorded with its account and payload. `state.ts` can defer or reject an operation globally or by book/list ID and explicitly settle one pending call. This makes partial sequential writes and obsolete completion measurable. Book/list change events use the production names and shapes. Real hooks observe those events.

Aliases replace API, local repository, sync engine, connectivity, offline mutation and auth boundaries. Target hooks/components are not aliased. Unrelated shell badge/gamification/notifications/network/scanning/journal/timer/profile/theme hooks reuse the existing adaptive-shell fixture; its theme helper applies the real BRACK theme values. BookDetail progress/review reads return empty data while their actual hooks remain mounted. Unsupported unrelated mutations reject. `devices.ts` reuses the synthetic Capacitor/native-Back boundary. `runtime=android` tests app Back ownership, not hardware or browser chrome. The tablet visual profile explicitly overrides pointer media queries to coarse; runtime does not imply touch capability.

No Supabase server, IndexedDB persistence, real sync conflict, native gesture recognizer, biometric/system UI or real account is used. Successful fixture writes establish UI behavior after a confirmed service result, not server idempotency.

## Finite matrix

33 scenarios per engine: ten membership lookup/outcome/continuity cases across five actual entries; four list-manager outcomes; six list-detail Add Books cases across header/empty entries; two nested selection deletions plus ordinary flat inline deletion; one list-only removal; one partial bulk Library deletion; account and route abandonment; one later-page metadata continuity task; one actual flat swipe removal; four visual profiles. Flat and both preview deletion cases exercise a surviving collection and deletion of the final book that unmounts the entire view.

The touch swipe uses trusted Chromium CDP input and is explicitly skipped in WebKit/Firefox. The final suite registers99 checks, with97 runnable checks and two declared skips. The earlier full run used32 scenarios/96 scheduled checks; the final additional inline-delete path and stronger focus assertions have separate results below. This is not a claim of cross-engine native touch verification.

Visual profiles: 320×740; 390×844 at 200% root text; 834×1112 at 200% text with synthetic coarse pointer; 390×480 short height. Each visits real bookshelf selection, nested membership, Create List, Edit List, Delete List, Add Books and row removal, plus the actual list card before opening removal. It verifies loaded Inter/Merriweather/Playfair Display faces, horizontal dialog/card overflow, keyboard focus revelation of the row action, full viewport reachability and three-point pointer hit tests; screenshot and geometry/font evidence are retained. Responsive continuity separately exercises 390→767→768→834→1024→1280→390 with node identity, focus and editor caret or selected checkbox. The later-page case seeds17 lists, retains the actual15-record paging hook, and defers/rejects page2 during a partial membership write.

## Commands and results

Use isolated port **8097**, cache `node_modules/.vite/library-tasks`, one worker and sequential engines. Override both run output and JSON report for every run; quote the reporter argument in PowerShell.

```powershell
$env:PLAYWRIGHT_JSON_OUTPUT_FILE = "$PWD/test-results/cr04-RUN-summary.json"
npx playwright test --config tests/playwright/library-tasks.config.ts --output test-results/cr04-RUN '--reporter=list,json' 2>&1 | Tee-Object -FilePath test-results/cr04-RUN-console.log
npx tsc -p tests/playwright/tsconfig.library-tasks.json --noEmit
npx eslint tests/fixtures/library-tasks tests/e2e/library-tasks.spec.ts tests/playwright/library-tasks.config.ts --max-warnings=0
```

- Initial fixture typecheck and bundle passed after adding explicit unsupported service exports needed by the actual BookDetail imports. Sandbox-only Vite launch first reported EPERM; authorized elevated build succeeded. No runtime change was made for fixture boot.
- `cr04-smoke-1`: **0/2 passed**. Both failures were an incorrect test assumption that unknown memberships render disabled checkboxes. The actual corrected product withholds unknown options. Assertions now require the retained lookup error, zero choices and no write before retry.
- `cr04-smoke-2`: **1/4 passed**. Empty-list partial add/refresh/retry passed. Flat pending backdrop click exposed a real React portal event leak into the swipe-card activation handler, navigating away from the pending dialog; root fixed the actual DOM ownership guard. BookDetail error copy and list refresh retry label failures were fixture selector mismatches, corrected against current source. Failed screenshots/traces/JSON are retained.
- `cr04-chromium-1`: **26/31 passed**. All four initial dialog visual profiles and real Chromium swipe removal passed. Three carousel-preview tests used a pointer locator aimed behind deliberately selectable metadata; corrected to the actual visible title surface delegated by production. The bulk task now expands the actual compact Library controls before selecting. A nested Back assertion incorrectly assumed there was no restored-focus tooltip layer; further diagnostic evidence follows.
- `cr04-chromium-2`: **5/9 passed**. The corrected carousel pointer entry, nested delete and bulk partial retry passed. Additional actual list-row checks exposed a **75px horizontal card overflow** at390/200% and a clipped removal control at834/200%; root is correcting the production card layout. Both parent Back assertions still failed even after requiring the previous dialog node to disconnect.
- `cr04-back-diagnostic`: **0/2 passed**, retaining the unchanged failing assertions and adding observational pre-Back attachments. Both show the child membership dialog disconnected and a newly restored-focus **Add to list tooltip** above the retained parent. Radix owns this tooltip first. This is distinct from losing the parent task or an unhandled Escape; the final test must explicitly cover that visible layer's dismissal before the parent.
- `cr04-chromium-3`: **7/8 passed**. Explicit tooltip→parent Back layering passed both nested entries, both catalog/library lookup recovery paths passed, and the card reflow fixed the tablet case. The phone200% real row action was then found completely underneath the floating Scroll to top button; all three hit points failed. Root added corresponding scroll clearance. The final test also uses Details→Tab→Remove to exercise actual keyboard focus revelation, retaining all pointer/viewport assertions.
- `cr04-later-page`: **1/1 passed**. Actual page2 metadata and same task/checkbox survive catalog reset, rejected page2 read, partial membership rejection and successful remaining-only retry.
- `cr04-visual-final`: **5/5 passed**. All four profiles now pass actual row focus/viewport/hit/overflow checks and all seven task dialogs; carousel pointer/Enter and actual tooltip→parent Back ordering also passed. 32 PNGs, 28 font records and 32 geometry records are retained with provenance under [CR04 evidence](../../../docs/frontend-renewal/evidence/cr04-library-list-tasks/README.md).
- Final fixture TypeScript and scoped ESLint checks passed before the full run.
- `cr04-full-1`: **92 passed, 2 failed, 2 declared CDP skips** across96 scheduled checks (6.7 minutes). Chromium32/32 and Firefox31/31 runnable checks passed; WebKit29/31 runnable checks passed. Both failures were the final focus assertion after deleting a book from a nested preview; all write outcome and task-retention checks had passed. Every visual profile passed in every engine.
- `cr04-focus-diagnostic`: **0/2 passed** on unchanged production. Requiring the explicit named Library books main to receive focus, with normal5-second assertion polling, still failed in both WebKit preview cases. Root corrected close-autofocus to use the surviving page ref after the removed book trigger disconnects. This is a confirmed production focus loss, not merely an immediate assertion corrected by a wait.
- `cr04-focus-final`: **16 passed, zero failed, two declared CDP skips** across18 scheduled removal checks (1.4 minutes). They include the added ordinary flat entry and final-book view-unmount outcomes. Chromium6/6, WebKit5/5 runnable and Firefox5/5 runnable passed. Named Library/main or surviving Add Books focus assertions now pass after the actual source fallback correction.
- Final fixture TypeScript and scoped ESLint passed again after the additional final-book and strict focus coverage. Combining the latest result for each scenario/project from `full-1` and `focus-final` yields **97 distinct passing checks and two declared skips**. This is split evidence, not an unperformed clean99-case rerun; overlapping runs must not be added.

This fixture's bounded CR04 acceptance is complete. Parent-owned legacy/shared-shell regressions and the final implementation manifest remain authoritative in checkpoint24. Failed reports/traces are historical evidence and must not be replaced by later passing reruns.

No pre-change browser baseline is claimed: implementation had started before the new actual-consumer fixture was ready. Earlier committed gesture suites and new source/unit controls provide their own separately labeled evidence.
