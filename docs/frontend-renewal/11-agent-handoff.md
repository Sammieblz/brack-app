# Durable handoff and evidence-first delivery

## Original audit checkpoint

Baseline: `8d3b35ecd778f30d52e40498509dc4beab056e42`, audited 2026-09-27. Deliverable: frontend audit, detailed plan, documentation and skills. No application implementation, dependency migration, database change, deployment, or native build was performed. The three Library fixture screenshots are limited observations described in [evidence](evidence/README.md).

The original audit proposed starting at [F00](09-execution-plan.md), with F01–F04 able to proceed from their verified source findings. Subsequent implementation is recorded below; do not restart completed work or a repository-wide audit by default. Revalidate the affected path against current HEAD and proceed from the smallest relevant context.

## Facts worth retaining

- One renderer lives in `apps/client`; mobile/desktop workspaces own wrappers/build integration. A monorepo does not force identical interfaces.
- Production uses BrowserRouter/React Router 6. F06 installs Ionic 9.0.5 only in an isolated fixture; [the current decision](../ui-ionic-fit.md) defers its tested route shell and modal. Skill or historical plan examples do not establish production adoption.
- Canonical runtime helpers live in `services/platform.ts`. F05's [UI environment](../ui-environment.md) separates runtime, window and capabilities; its legacy UI adapters no longer infer native runtime from user-agent text.
- Initial native navigation retains Home, Library, Lists, Feed, Readers; social gating removes the last two. Browser menu presentation changes chrome, not the destination model.
- The existing custom DatePicker, library modes, region loading, brand loader and reduced-motion/reward work contain valuable contracts. Inspect before replacing.
- The original audit's journal save-outcome, draft-clearing, invalid club-link, click-only card and notification-state defects were addressed in F01–F03. Preserve the living journal/navigation contracts rather than reopening them from the baseline list.
- F07 removes duplicate edge navigation and provides [one app Back coordinator](../ui-back-navigation.md) plus [local contact cancellation](../ui-local-gestures.md). Its exact implemented scope and remaining native gates are in checkpoint 17. Preserve F04's [action feedback](../ui-action-feedback.md). Do not infer measured latency improvements from source changes alone.
- Preserve themes, logos, Inter/Merriweather/Playfair roles, Iconoir, domain language, offline capture, timer reliability and service ownership.
- Accessibility is default behavior. App settings may reduce effects/haptics; they cannot substitute for semantic access or enable OS screen readers.
- Ticket progress is recorded in09 and [active20](20-coverage-reconciliation.md). F01–F09 code is committed through `db076cf`, but shared-contract consumer coverage is reopened. Checkpoints13–19 preserve bounded historical evidence; they do not prove whole-ticket/frontend acceptance. CR01–CR10 own reconciliation and omitted work. Later user steering authorizes F10a visual reconstruction alongside that open queue; checkpoint28 records the bounded scope and reason.

## Bounded retrieval workflow

1. Read this file and the relevant F-ticket; do not load all thirteen plan documents for a single component change.
2. Check `git status --short` and current HEAD. Preserve unrelated work. Inspect relevant instruction files.
3. If an existing graph is available, run a narrow `graphify query` with actual symbols and a bounded budget, e.g. `graphify query "JournalEntryDialog useJournalEntries" --budget 1800`. Use `graphify path` for a relationship or `graphify explain` for a concept. Follow the installed skill's query guidance.
4. If `graphify-out/wiki/index.md` exists, use it for broad navigation. Otherwise the generated Obsidian vault can identify source files/connections. Do not treat old inferred edges or line numbers as current proof.
5. Read cited source and consumers, not unrelated directory dumps. Use `rg -n` for symbols/owners; read bounded ranges and relevant tests. Escalate search scope only when evidence is insufficient.
6. Read the matching compact frontend-skill reference and the one or two plan sections needed. Motion tasks also use the relevant animation reference. Reuse already-read source within a session.
7. For version-sensitive APIs, check installed package and lockfile versions, then official matching docs; record retrieval limitations. Upstream `main` is not a released-version guarantee.
8. Implement the authorized slice; validate meaningful behavior; update the work ledger and source-of-truth docs with real evidence.

Budgets are retrieval hints, not limits on investigation or correctness. A truncated graph result may omit the relevant dependency; narrow the query or expand deliberately. No graph means use source normally; do not create a large index just to complete unrelated UI work. Keep indexing local; no API extraction, live database introspection, hooks or watchers are implied.

## Evidence format

Each new finding or changed decision needs:

```text
ID: document-qualified finding or F-ticket
Claim class: source-verified / fixture-observed / user-reported / hypothesis / proposed / device-unverified
Source: repository path + symbol + current commit, or official URL + retrieved date/version
Observed behavior: exact trigger and outcome
Target behavior: user-visible change
Preserved contract: routes/data/theme/input/offline semantics
Validation: actual command or manual environment and result
Limits: untested conditions, missing access or unresolved dependency
Next action: one bounded step
```

Do not duplicate the entire source file, graph report or transcript. Prefer a useful excerpt/symbol and link. Never store account tokens, private reading content, environment secrets or raw production telemetry in this plan.

## Anti-hallucination rules specific to this work

- Every claimed existing component, route, dependency and test command must resolve in the current checkout. Mark proposed names/paths as proposed.
- Source confirms implementation; real browser/device observation confirms behavior under that environment. Do not infer measured performance, contrast, usability or native behavior from code alone.
- A generated graph/vault, older doc or skill can be stale. Resolve against source; update the appropriate maintained doc rather than the generated export.
- A test file existing is not a passing result. A passing mocked fixture is not production/native/AT conformance.
- A plan status is not a work status. Never mark F-tickets done because their document is detailed.
- “WCAG target,” “measured conformance,” and “applicable legal obligation” are different claims. Check actual legal applicability and current primary guidance before release statements.
- Preserve surprising existing contracts until understood: date-only parsing, account scope, provisional rewards, duplicate add, timer completion and auth callback runtimes are examples.
- Correct conflicts across documents once at the owning specification: 03 owns shell/runtime policy, 04 component ownership, 05 screen behavior, 06 timing/gestures/performance budgets, 07 accessibility, 09 sequencing, 10 validation.
- Qualify findings by document: `02/A03` is journal persistence; `07/A03` may be unrelated. Do not refer to a bare repeated identifier across audit files.

## Progress checkpoint template

The summary work ledger is the table under **Work ledger template** in [09-execution-plan.md](09-execution-plan.md). Checkpoints13–19 preserve committed batches;20 owns coverage reconciliation;21–25 preserve CR01–CR05 evidence; [26](26-social-destinations.md) preserves committed CR06a; [27](27-route-recovery.md) preserves committed CR06b (`d944fef`); [28](28-library-reconstruction.md) preserves committed F10a (`8c01615`); [29](29-lists-reconstruction.md) preserves committed F10b (`b97119d`); [30](30-library-modes.md) owns the current F10c bookshelf/carousel reconstruction. Keep one authoritative checkpoint per batch, with older records clearly marked historical; do not duplicate detailed active status across competing records.

Update the relevant ticket and append a concise checkpoint when handing off:

```text
Objective and current user steering:
Current commit / worktree changes:
Selected ticket and exact scope:
Read sources/spec sections:
Verified findings and decisions:
Changed files and behavioral outcome:
Checks run and actual results:
Remaining device/accessibility/performance checks:
Next bounded action:
Blocker, if any, and independent work still possible:
```

An interrupted session should be resumable from this checkpoint without asking the user to reconstruct prior decisions. Keep one authoritative current checkpoint per active ticket rather than appending hundreds of duplicate status paragraphs.

## Active implementation checkpoint

Current checkpoint: **[F11c reading sessions and F11d book editing](33-timer-and-book-editing.md): frontend implementation complete; final verification pending.** F11b is committed in baseline `6e68b57`; current session/editor changes remain uncommitted. Read the [session contract](../ui-reading-sessions.md) and [book-editing contract](../ui-book-editing.md) before touching these owners. **Final verification: PENDING — checkpoint33 must record final commands, reports, visual evidence and Graphify/Obsidian readback before the review stop is accepted.** Do not infer a final pass count from pilot runs or count retries twice.

The next bounded action is to finish that verification/handoff and stop for the user's review, without staging or committing. After authorized continuation, the next main implementation is **F12 add/search/scan/import**. F11's physical lifecycle/notification, native input/gesture and assistive-technology gates remain open, as do the explicitly carried corrective/pane/performance requirements. These are separate from implementing the session and EditBook children; do not restart those children from historical baseline findings or claim the entire renewal complete.

Preserve checkpoint23's failure history: the complete Settings matrix passed83/87, followed by17/18 continuity,18/18 after correction and3/3 repeated WebKit checks. These overlap;95 units across12 files and shared shell21/21/overlay15/15 are historical evidence. CR03 is committed in 74ed7d7,CR04 in ef5b2f9 and CR05 in a610871. Preserve their verified contracts; their review stops are historical. Checkpoint32's F11b review stop is also historical after commit `6e68b57`; checkpoint33 owns the current continuation and pending Graphify/Obsidian evidence.

Earlier F02/F03 results and their review stop are historical in [14](14-next-implementation-batch.md). Actual native/AT/live-service checks remain release evidence gaps. The original audit above is historical; do not restart completed tickets from its defect list.

## Skills and documentation maintenance

The BRACK frontend skill entrypoint was reduced from 2,758 lines to a short router. All 61 original numbered sections were preserved in eight topical reference files. This reduces always-loaded text; it does not remove review/behavior obligations. Read only relevant references and inspect current source when remembered context conflicts.

The new `.codex/skills/brack-frontend-delivery/SKILL.md` routes renewal execution through this evidence workflow. It is intentionally scoped to frontend audit/renewal work, not every repository task. The animation skill remains the specialist motion reference; the plan supplies BRACK-specific decisions.

Update the living UI docs after each implemented slice: `ui-shell-scrolling.md`, `ui-library-interactions.md`, `ui-date-pickers.md`, `ui-ionic-fit.md`, `loading-motion.md`, design/iconography, component guides and device/service boundaries as affected. This dossier retains the historical baseline and records implementation decisions. Avoid copying the complete plan into multiple skills or docs.
