# Must-Win Screens

Source date: 2026-05-05  
Scope: ticket 10.2, retention-critical surfaces and quality bars.

## Top Surfaces

| Surface | Why it matters | Quality bar |
| --- | --- | --- |
| Dashboard/Home | First authenticated read loop and daily return surface. | Shows the next best reading action within one screen; fast enough to feel instant; no duplicate stats; useful offline/refresh behavior. |
| Book Detail | Core action hub for reading, progress, journal, reviews, and status. | Start timer and log progress are obvious; progress state is trustworthy; destructive actions are clear; offline book detail works for cached books. |
| Timer/Session Flow | Converts intent into tracked reading time and streak progress. | Start/pause/finish are reliable across app backgrounding; finish is idempotent; offline finish syncs later; optional post-session journal prompt feels contextual. |
| Add/Import Flow | First value creation and ongoing library growth. | Search/manual/scan paths converge cleanly; duplicate handling routes to existing book; mobile scan flows recover gracefully from permission/OCR failures. |

## Follow-Up Task List

| Surface | Tasks |
| --- | --- |
| Dashboard/Home | Complete dashboard read model, remove duplicate live hooks, use snapshot-backed heatmap, test mobile/tablet/desktop density. |
| Book Detail | Convert quick progress into logged progress or relabel as correction-only, replace browser confirm delete with app dialog, tighten action grouping on mobile. |
| Timer/Session Flow | Add optional page progress on finish, move native notification code into a service, test Android/iOS background behavior. |
| Add/Import Flow | Improve failed-search recovery, prioritize native scan QA, ensure fixed save button never overlaps mobile nav, keep duplicate restore messaging clear. |

## Non-Negotiables

- Mobile-first on phone, responsive on tablet/desktop.
- Theme-aware Brack identity and iconography.
- Reading actions must not silently create duplicate or hidden state.
- Offline reading-core actions must be understandable before sync completes.

