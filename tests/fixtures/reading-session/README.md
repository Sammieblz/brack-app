# Reading session and book editing fixture

Run from the repository root with the isolated Playwright configuration at
`tests/playwright/reading-session.config.ts` (port 8106; `F11C_RUN` labels output).
Do not run full browser matrices concurrently with the other Windows fixtures.

The fixture mounts the real TimerProvider, timer arithmetic, BookDetail,
Dashboard, EditBook, Library, shell utility portal, adaptive overlays, Back and
confirmation providers, JournalPromptHandler and useJournalEntries. Production API, repository and device boundaries are
in-memory controls. The fixture does not establish native lifecycle, SQLite,
sync transport, backend, notification delivery, camera, or assistive-technology
behavior on a device.

Routes: `/book/book-1`, `/dashboard`, `/my-books`, `/edit-book/book-1`, and the
existing F11b progress and Library routes. `/achievements` mounts the real Reader
Journey with controlled quest data. `timerQuest` supplies a reading-minutes quest
to Dashboard; `streakEntry` also supplies an at-risk streak and its actual Read
now action. These read models exercise timer consumers, not economy mutations.
Query `populated` supplies book data;
`text=200`, `long`, `theme=dark`, `palette=paper-library`, `runtime=ios`, and
`runtime=android` reuse the established shell fixture presentation profiles.

`window.readingSession` exposes:

- `configure(operation, mode)` / `settle(operation, outcome)`: operations
  `session`, `identity`, `auth`, `edit`, `book-read`, `journal`, `library`; modes `resolve`, `reject`,
  `defer`, `commit-reject`. Session commit-reject writes first and then throws,
  exercising ambiguous response recovery. The outbox count records every
  enqueue call, so duplicate work cannot be hidden by overwriting the same ID.
  `library` controls the real `useBooks` repository list boundary for the shared
  picker's initial loading, failure, retry and obsolete-account response checks.
- `snapshot()`: repository sessions and journals, calls, pending operations, session outbox,
  and persisted timer/recovery strings.
- `timer()`: the real context's elapsed seconds, running/visible state, book ID
  and client session ID; no test arithmetic or replacement timer context.
- `remap(owner, from, to)`: the canonical identity resolver boundary.
- `device.configurePermission(mode)` / `settlePermission(granted)`,
  `device.appState(isActive)`, `device.stop(identity?)`, and `device.snapshot()`.
  Stop defaults to the latest notification's identity; explicit identity models
  an obsolete session/account, and null deliberately supplies no identity.

The inherited `window.readingCapture` controls book-stage, upload and picker
boundaries and exposes their outbox counts. `window.libraryTasks` changes the
fixture account, navigates, or emits the existing Android Back callback.

Initial query `timer=running|paused|stale` seeds a real timestamp snapshot once
per browser tab. `seconds` overrides the ordinary 754 seconds; stale uses 13
hours. `timerOwner` controls the owner. Production duration calculations remain
real; Playwright may control Date/timers using its clock API. Seeds use the scoped
storage keys; `legacyTimer` deliberately seeds the old unscoped key. The fixture
session repository and outbox survive reload through a separate sessionStorage
boundary, allowing completion-envelope recovery checks without pretending to
exercise the real IndexedDB/SQLite driver.

Historical baseline tests use each reachable Library entry: compact Quick
actions opens its timer sheet, while the tablet NativeHeader opens its timer
popover. Dashboard has no equivalent header timer action in the baseline.
