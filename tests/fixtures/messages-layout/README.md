# CR05 actual Messages fixture

Authority: [coverage reconciliation, CR05](../../../docs/frontend-renewal/20-coverage-reconciliation.md) and [checkpoint25](../../../docs/frontend-renewal/25-messages-layout-gestures.md). This is deterministic browser evidence for the Messages task and its responsive parents, not a native, backend or assistive-technology certification.

## Actual consumers and boundaries

The fixture renders the production `Messages` route, `useConversations`, `useMessages`, `ConversationsList`, `MessageThread`, `useTypingIndicator`, loading regions, shell, confirmation provider, real router, app Back coordinator and modal/popover primitives. It uses two conversations and 23 history messages so overflow, background refresh, reply selection and following the latest message have real DOM owners.

API functions in `api.ts` replace the service boundary. Calls are recorded with immutable entry payloads; `state.ts` can reject, defer and settle writes and reads. The conversation subscription retains the real `messages-changed` event contract. A separate fixture event delivers a deterministic incoming-message refresh instead of a remote realtime server. Explicit row Mark as read calls are recorded separately from the last-message read receipt performed during thread loading. Successful results mutate the fixture catalog/history so production hooks consume actual changed data. Unrelated mutations reject.

Auth/profile/network/timer/sync/scanning/badge/notification/theme boundaries reuse the adaptive-shell fixture, including real BRACK theme tokens and fonts. The target message hooks and components are not aliased. Synthetic Capacitor adapters retain an app Back listener and runtime identity; they do not claim native navigation, haptics, keyboard or gestures. Profile navigation uses a destination receipt solely to establish approved departure from the actual Messages caller. The user profile screen is outside this fixture.

The keyboard case overrides the observed `visualViewport.height` and dispatches its resize event; it proves available-height handling, not physical IME delivery. CDP touch cases inject contacts into actual browser hit targets, with explicit cancellation, second contact and text selection. They do not establish OS edge arbitration or touch behavior in other engines. The 200% profiles double root font size; they are text-scaling evidence, not browser pinch zoom or assistive technology evidence.

## Finite matrix and execution

21 scenarios per engine cover real textarea/file/reply/query/caret retention through 390→767→768→834→1024→1280→390, route entry/retry and obsolete entry completion, initial and cached read failures, offline draft recovery, nested GIF query and Back/focus, upload/send rejection and idempotent retry payload, refresh/incoming scroll ownership, row actions and failed/pending outcomes, explicit transient-draft departure, split-pane profile departure, delete/block confirmation outcomes, observed viewport contraction, two local touch sequences and five visual profiles.

Visual profiles are 320×740, 390×844/200%, 834×1112/200%, 390×480 and 1280×900. Inbox, row actions, thread and GIF screenshots require loaded Inter/Merriweather/Playfair faces, visible hit targets, page overflow checks and history/composer separation. Phone 200% and short-height profiles also inspect reply/file contexts. Shared timer state is enabled in all but the smallest profile; real shell occupancy decides whether to display it while composing.

```powershell
$env:CR05_RUN='cr05-full-1'
npx --no-install playwright test --config tests/playwright/messages-layout.config.ts
npx --no-install tsc -p tests/playwright/tsconfig.messages-layout.json
```

Use port 8098, the dedicated `node_modules/.vite/messages-layout` cache and run-specific report/artifact folders. HMR is disabled. Run browser matrices sequentially with one worker; freeze relevant source before the final matrix. Two CDP scenarios explicitly skip on Firefox and WebKit: 63 scheduled checks contain 59 runnable checks and four declared skips. Never add overlapping smoke counts to the final distinct result.

## Diagnostic record

- `cr05-baseline-1`: 0/2 passed against the initial production parent. The 390→834 resize retained persisted text but replaced the actual textarea; the 834×1112/200% fixed inbox width clipped the thread offscreen. Both failures and their screenshots/traces are preserved.
- `cr05-smoke-1`: 7/7 assertions passed, but direct visual inspection found a real phone 200% history/composer overlap and an oversized multi-row icon toolbar. This run does not constitute visual acceptance. The thread owner fixed icon-only sizing and contained history overflow; the fixture gained an explicit overlap assertion. Missing fixture media was corrected with a local SVG.
- `cr05-behavior-1`: 2/6 passed. Trace-confirmed fixture errors were an alert outside the action group, a real `dialog` queried as `alertdialog`, a Playwright tap unsupported by a CDP-only context flag, and a text selector also matching the preserved hidden inbox. Corrected to actual semantics, scoped history and actual CDP contact taps; no production action requirement was removed.
- `cr05-behavior-2`: 5/5 passed after those corrections, including viewport contraction, Back/draft ownership, row retries and local contacts.
- `cr05-smoke-2`: 7/8 passed. All visual profiles and actual deletion passed. The block follow-up exposed a missing `messages-changed` subscription in the copied fixture API boundary; production already listens to that event. The fixture subscription now matches it, so the final matrix exercises post-action production hook refresh.
- `cr05-entry-smoke`: 4/4 passed, covering route entry/retry/late completion, initial and cached read failures, offline drafts and Block confirmation reflow/focus.
- `cr05-full-1`: 59 passed, four declared CDP skips, zero failed across three engines (3.6 minutes). Final review still found the phone 200% Hide label clipped by the pinned inbox header. The old viewport/center-hit predicate had missed clipping by a scroll ancestor; the parent moved its inbox header into that owned scroll region. The fixture now checks the full control rectangle against all clipping ancestors plus top/middle/bottom hit ownership. Parent subtitle/dependency cleanup and obsolete message-mutation feedback guards also landed around this run; the targeted final-source pass repeats all affected behavior and visuals. This run alone is not final visual acceptance.
- `cr05-final-geometry`: 30/30 passed on the final source across all three engines (2.3 minutes). Entry/read recovery, row outcomes, message deletion, viewport contraction and all five visual profiles passed the strengthened clipping checks. The entire Hide control is now inside its owned scroll area in Chromium, WebKit and Firefox.

The latest result per scenario/engine from the full and final targeted runs is **59 distinct passes and four declared skips**. This is split evidence, not an unperformed clean final 63-case rerun. [Retained evidence](../../../docs/frontend-renewal/evidence/cr05-messages-layout/README.md) includes 26 final screenshots, four diagnostic images, 15 loaded-font records, 66 geometry records, source hashes and run provenance. Fixture TypeScript and scoped ESLint passed after the stronger clipping helper (`cr05-browser-types-3.log`, `cr05-browser-eslint-3.log`).

The phone 200% reply/file context and shell timer still produce a dense composition, although controls remain reachable. Main visual tickets retain that work. Initial failures remain diagnostic evidence; browser conditions and confirmed service outcomes do not prove backend persistence or physical-device behavior.
