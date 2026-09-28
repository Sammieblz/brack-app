# 11. BRACK feature UX patterns

## 11.1 Library

The library is a core product surface.

Priorities:

1. recognize books quickly;
2. understand reading status/progress;
3. find or filter quickly;
4. resume reading/update progress with minimal friction.

Book cards/rows should prioritize:

- cover;
- title;
- author;
- reading status;
- useful progress information.

Secondary metadata must not overwhelm the title and progress.

Provide sensible grid/list adaptation:

- grid is useful for visual browsing;
- list is useful for metadata density and accessibility;
- preserve the user's chosen mode if the product supports both.

Empty library:

- explain that the library is empty;
- provide a direct add/discover action;
- do not display a dead blank canvas.

---

## 11.2 Book detail

The book detail screen should answer:

- What book is this?
- What is my relationship to it?
- What is my current status/progress?
- What can I do next?

A typical priority order:

1. cover/title/author identity;
2. status and progress;
3. primary action such as start/resume/update;
4. reading history or session summary;
5. notes/quotes/journal related to the book;
6. metadata/details;
7. secondary management actions.

Avoid presenting Edit, Delete, Share, Change Cover, Move Shelf, Reset Progress, etc. as equally prominent primary buttons.

Put secondary management actions into a context menu or action sheet when appropriate.

---

## 11.3 Add book

BRACK supports multiple acquisition paths. The UX should degrade gracefully.

Preferred conceptual flow:

```text
Add book
  -> Search metadata
  -> Scan barcode / OCR where available
  -> Manual entry fallback
```

Do not make scanning mandatory.

For scan workflows:

- request camera permission at the moment it is needed;
- explain why permission is needed;
- show scanning state clearly;
- provide torch/flash controls when supported and useful;
- give immediate success feedback;
- allow the user to verify metadata before committing if recognition is uncertain;
- preserve the ability to correct title/author/ISBN;
- provide a manual route when scanning fails.

Do not trap a web/desktop user in a camera-first flow when text search is more appropriate.

---

## 11.4 Reading session / timer

The reading session is a high-frequency, focus-sensitive interaction.

It should be intentionally calm.

Priorities:

- current book identity;
- elapsed reading time;
- pause/resume/finish controls;
- optional progress context;
- accidental-exit protection when a session is active.

Avoid:

- decorative looping animations;
- bouncing controls;
- noisy analytics while the user is trying to read;
- hiding the session stop/end action.

The primary session control should be thumb-reachable on mobile.

When the app is backgrounded, suspended, or resumed:

- derive elapsed time from reliable timestamps rather than assuming JS timers ran continuously;
- make session recovery deterministic;
- do not double-count time after resume;
- reconcile local session state before remote sync.

If ending a session requires page/location input, keep the end flow short and focused.

---

## 11.5 Progress updates

Progress input may be pages, percentage, or another book-specific unit depending on the current domain model.

Rules:

- show the current value before editing;
- prevent impossible values;
- do not silently decrease progress unless the user intentionally changes it;
- make completion explicit;
- if a progress update changes a book to "finished," clearly communicate that consequence;
- use optimistic local feedback where safe;
- sync in the background;
- do not block progress logging because the network is unavailable.

---

## 11.6 Goals

Goals should be understandable in plain language.

A goal card should make visible:

- target;
- current progress;
- time period;
- remaining amount or completion state.

Avoid charts when a progress bar and two numbers communicate the same thing better.

Goal creation/editing should:

- use appropriate numeric keyboards on mobile;
- validate ranges inline;
- make period/date boundaries understandable;
- avoid requiring users to calculate derived values themselves.

---

## 11.7 Streaks

Streaks are motivating context, not a threat.

Display:

- current streak;
- what qualifies;
- when the next successful action is needed;
- historical/best streak where useful.

Do not use misleading urgency.
Do not punish users visually with excessive red.
Do not imply a streak is synced if the local event is still pending.

---

## 11.8 Journal, notes, and quotes

For implemented save/draft behavior, read [the journal editing contract](../../../../docs/ui-journal-editing.md) and the [active renewal checkpoint](../../../../docs/frontend-renewal/13-implementation-tracker.md). Confirm local commit before success; keep upload/refresh failure separate. Preserve unsynced records atomically during hydration. Process-memory draft retention is not reload or process-death recovery. Do not delete replaced assets before a sync-aware reference policy exists.

Writing is content-first.

Use:

- generous text area;
- legible line length;
- autosave/draft behavior when safe;
- explicit save state if autosave latency matters;
- keyboard-aware layout;
- persistent content during navigation interruptions.

For quotes:

- allow source/page/location metadata where supported;
- prioritize quote text;
- provide edit/copy/share actions without visually competing with the text.

On desktop, keyboard shortcuts can improve writing efficiency.
Keyboard-initiated actions should not receive decorative animations.

---

## 11.9 Analytics

Analytics should answer user questions, not merely display charts.

Start with summaries such as:

- reading time;
- books/pages completed;
- current pace;
- goal progress;
- trends.

Then provide charts when they reveal a relationship or change that is difficult to see from numbers alone.

Every chart should have:

- clear title;
- readable units;
- accessible text summary or equivalent data;
- usable contrast;
- touch/pointer interaction that is not required to understand the chart;
- empty/no-data state;
- sensible date range.

Do not create dashboard clutter with redundant mini-charts.

---

## 11.10 Recommendations

Recommendations must explain themselves enough to be useful.

Good supporting context may include:

- because you read;
- based on a genre/author preference;
- similar to a completed book;
- aligned with current reading patterns.

Do not present personalized recommendations as guaranteed user preference.

Keep recommendation actions clear:

- view;
- add/save;
- dismiss/not interested if supported.

---

## 11.11 Achievements, badges, and currencies

Achievement visuals are collectible rewards, not navigation UI.

For BRACK achievement/badge artwork, preserve the established direction:

- cozy magical 3D storybook feel;
- soft clay-like rounded forms;
- warm golden fantasy lighting;
- pastel parchment / amber / terracotta / sage / dusty-purple / soft-teal family;
- transparent composition when used as an asset;
- one main focal subject;
- at most one or two supporting elements;
- minimal text;
- generous negative space;
- readable silhouette;
- premium, collectible, playful, storybook-like;
- never flat corporate, sci-fi, or visually crowded;
- do not include author/person silhouettes unless a specific badge explicitly calls for them.

Currency concepts such as **Lifetime Ink** and **Gold Leaves** should use simpler, more icon-like representations than achievement badges.

Do not let collectible art dictate the functional UI color system.

---

# 12. Component hierarchy and states

Every reusable interactive component must account for the states relevant to it.

Possible states:

- default;
- hover;
- focus-visible;
- pressed/active;
- disabled;
- loading;
- selected;
- error;
- success;
- offline/pending;
- syncing;
- destructive.

Do not ship components that look correct only in their default state.

---

# 13. Buttons and actions

## 13.1 Hierarchy

Within one action group:

- one primary action;
- secondary actions visibly quieter;
- tertiary actions may be text/icon treatments;
- destructive actions use semantic warning/destructive styling.

Do not use destructive red for ordinary navigation.

---

## 13.2 Feedback

A press should feel acknowledged immediately.

Good feedback:

- subtle background change;
- opacity change;
- tiny scale/transform response;
- platform-native ripple/highlight where Ionic provides it;
- haptic feedback for selected high-value native interactions.

Do not wait for the network before showing that the press was received.

---

## 13.3 Labels

Prefer clear verbs:

- Add book
- Start reading
- Resume session
- Finish session
- Save note
- Update progress

Avoid vague labels such as:

- OK
- Submit
- Continue

unless context makes them unambiguous.

---

# 14. Forms and input

## 14.1 Native input semantics

Use the correct:

- `type`;
- `inputmode`;
- `enterkeyhint`;
- autocomplete;
- autocorrect;
- capitalization behavior.

Examples:

- ISBN/page numbers -> numeric-oriented input where suitable;
- email -> email keyboard;
- search -> search semantics;
- URLs -> URL semantics.

---

## 14.2 Validation

Validate near the field.

Error text should explain how to recover.

Bad:

> Invalid value.

Better:

> End page cannot be lower than your current page of 184.

Do not clear the user's input on validation failure.

---

## 14.3 Labels

Do not rely on placeholders as labels.

Labels should remain understandable when a field contains a value.

Required/optional semantics must be explicit where ambiguity matters.

---

## 14.4 Keyboard behavior

On mobile:

- prevent focused fields from being hidden by the software keyboard;
- keep the primary form action reachable;
- test sheets/modals with the keyboard open;
- listen to Capacitor keyboard lifecycle events when custom layout response is necessary;
- use the correct resize strategy for the app shell;
- avoid brittle `100vh` assumptions.

---

# 15. Search UX

Search is a high-frequency workflow.

Use debouncing for remote queries.
Do not delay local filtering unnecessarily.

Search states:

- untouched;
- typing;
- loading remote results;
- results;
- no results;
- offline/local-only results;
- recoverable error.

For book search:

- visually distinguish title and author;
- include cover/edition identifiers when needed;
- avoid accidental duplicate library entries;
- show whether a result is already in the user's library if known.

Do not show a full-screen spinner on every keystroke.

---

# 16. Lists, rows, and selection

Lists should support fast scanning.

Use consistent alignment/keylines for:

- cover/icon;
- primary text;
- secondary text;
- trailing metadata/action.

Selection mode should clearly change the interface state:

- show selected count;
- reveal only actions relevant to the selection;
- provide an obvious exit/cancel;
- preserve accessibility semantics.

Do not overload normal row taps with multi-select behavior unless selection mode is active.

---

# 17. Swipe actions

Swipe may accelerate frequent row actions, but it must not be the only path.

If using `IonItemSliding`:

- map actions semantically to start/end rather than hard-coded left/right;
- ensure RTL remains sensible;
- reserve full-swipe destructive behavior for cases with strong recovery/undo;
- close other sliding rows when appropriate;
- expose the same actions through an accessible menu.

---

# 18. Modals, sheets, popovers, action sheets, and dialogs

Choose the surface based on the task.

## 18.1 Sheet / bottom sheet

Prefer for mobile contextual tasks such as:

- book actions;
- filters/sort;
- quick progress updates;
- compact creation/editing;
- secondary details.

Use Ionic sheet modal breakpoints when the interaction benefits from partial/full heights.

Do not force a desktop-like centered dialog for every mobile task.

---

## 18.2 Centered modal/dialog

Use for:

- focused decisions;
- content that benefits from stable centered reading;
- destructive confirmation;
- larger tablet/desktop modal workflows.

---

## 18.3 Popover

Use for content spatially tied to a trigger.

It should emerge from the trigger region.

On touch/compact screens, an action sheet or sheet may be more appropriate than a tiny popover.

---

## 18.4 Ionic vs. actual native system UI

Use Ionic overlays when BRACK requires:

- custom branding;
- custom content;
- consistent product controls;
- React content;
- complex flow.

Use Capacitor/native system UI when the operating system's own prompt/action surface is materially better and the plugin is appropriate.

Examples can include native:

- action sheet;
- dialog;
- share;
- permission prompt;
- haptic feedback;
- keyboard behavior;
- status bar behavior.

Do not invoke a native dialog merely to avoid styling an ordinary BRACK screen.

---

# 19. Toasts, alerts, and feedback

Use feedback proportional to importance.

### Inline message

Use when the message belongs to a specific field/section.

### Toast

Use for short, nonblocking confirmation such as:

- saved;
- copied;
- added to library;
- sync completed after a background operation.

Action toasts may include Undo when appropriate.

### Dialog

Use when the user must decide before continuing.

Do not use a modal alert for routine success.

---

# 20. Loading and progress

Distinguish determinate from indeterminate work.

Use:

- spinner/skeleton for unknown duration;
- progress bar/percentage for known progress;
- local button loading for local actions;
- region-level skeleton for data sections;
- optimistic content for safe local-first changes.

Do not fake progress percentages.

For file/cover uploads, if present:

- show file/asset state;
- show upload progress when known;
- allow retry;
- allow cancellation when feasible;
- explain failures.

---

# 21. Empty states

Every important BRACK collection needs an intentional empty state.

Examples:

- no books;
- no current reads;
- no notes;
- no quotes;
- no goals;
- no session history;
- no analytics for the selected period;
- no search results.

An empty state should include:

1. what this area is;
2. why it is empty when helpful;
3. a relevant next action.

Do not use whimsical illustration at the expense of clarity.

---

# 22. Offline and sync UX

Offline support is a first-class BRACK requirement, especially for reading progress and sessions.

## 22.1 Local-first interaction

For user-generated state that is safe to capture locally:

1. validate locally;
2. persist locally;
3. update the UI immediately;
4. queue remote mutation if offline/unavailable;
5. sync when connectivity returns;
6. reconcile result;
7. surface conflict only when user intervention is actually necessary.

Never make a reader lose a session/progress update solely because the connection disappeared.

---

## 22.2 Sync states

Prefer quiet, understandable state:

- saved locally;
- syncing;
- synced;
- needs attention.

Avoid constant success toasts for background sync.

Only interrupt when user action is needed.

---

## 22.3 Conflict handling

Design for conflicts before they occur.

For simple monotonic data such as some progress cases, domain rules may resolve automatically.

For rich text or ambiguous edits:

- preserve both versions if needed;
- show timestamps/context;
- never silently discard the user's newer local writing.

Conflict logic belongs in the domain/sync layer, not scattered UI conditionals.

---

# 23. Supabase and query UX rules

Use TanStack Query (when present) as the server-state coordinator rather than duplicating remote loading state manually.

Principles:

- cache stable data;
- use query keys consistently;
- invalidate narrowly;
- use optimistic mutations when rollback is safe;
- distinguish remote cache from durable local storage;
- do not treat Realtime as a replacement for a coherent query model;
- protect every client operation with server-side/RLS authorization;
- never rely on hidden UI for authorization.

When Supabase is slow/unavailable:

- preserve local reading state;
- show cached data where safe;
- communicate degraded functionality without making the whole app unusable.

---

# 37. Reading session reliability

Because sessions are time-based and may span platform lifecycle transitions:

- store `startedAt`, pause intervals, and durable session identity;
- derive elapsed duration from timestamps;
- persist meaningful session state locally;
- handle app background/foreground;
- prevent duplicate finalization;
- make network sync idempotent;
- recover interrupted sessions after reload/relaunch where product rules allow;
- clearly distinguish active, paused, completing, saved-locally, and synced states.

The visible timer is presentation. The timestamps are the source of truth.

---

# 38. Authentication UX

Authentication should not feel like a separate website.

Use a focused flow.

Requirements:

- clear email/password or supported provider choices;
- useful loading state;
- field-level validation;
- recoverable errors;
- password manager/autofill support;
- accessible labels;
- deep-link-safe auth callback handling;
- clear offline limitation;
- no loss of user-entered values after recoverable failure.

Do not leak raw Supabase error strings directly to users.

Translate errors into useful product language while preserving diagnostics for logging.

---

# 40. Errors

Errors should answer:

1. What failed?
2. Was my data preserved?
3. What can I do now?

Examples:

Network search failure:

> We couldn't refresh book results. Your library is still available. Try again when you're connected.

Local session sync failure:

> Session saved on this device. We'll sync it when you're back online.

Do not say "Something went wrong" when the application knows more.

Do not expose stack traces, HTTP codes, SQL messages, or RLS details in the UI.

---

# 41. Destructive actions

High-impact examples:

- delete book;
- delete journal entry;
- remove reading history;
- reset progress;
- delete account.

Rules:

- label the exact consequence;
- use confirmation when recovery is difficult;
- prefer Undo for lightweight reversible operations;
- do not position destructive and primary confirmation buttons so close that accidental taps are likely;
- do not use a swipe-to-delete with no recovery for important data.

---

