# Durable handoff and evidence-first delivery

## Original audit checkpoint

Baseline: `8d3b35ecd778f30d52e40498509dc4beab056e42`, audited 2026-09-27. Deliverable: frontend audit, detailed plan, documentation and skills. No application implementation, dependency migration, database change, deployment, or native build was performed. The three Library fixture screenshots are limited observations described in [evidence](evidence/README.md).

Start future implementation at [F00](09-execution-plan.md), with F01–F04 able to proceed from their verified source findings. Do not restart a repository-wide audit by default. Revalidate the affected path against current HEAD and proceed from the smallest relevant context.

## Facts worth retaining

- One renderer lives in `apps/client`; mobile/desktop workspaces own wrappers/build integration. A monorepo does not force identical interfaces.
- Current source uses BrowserRouter/React Router 6. Ionic is not installed at the audited baseline; skill examples suggesting Ionic are direction, not implementation facts.
- Actual runtime helpers already exist in `services/platform.ts`; legacy `lib/platform.ts` and width-only UI branches do not represent the same concept.
- Initial native navigation retains Home, Library, Lists, Feed, Readers; social gating removes the last two. Browser menu presentation changes chrome, not the destination model.
- The existing custom DatePicker, library modes, region loading, brand loader and reduced-motion/reward work contain valuable contracts. Inspect before replacing.
- Source-backed immediate defects include journal write errors swallowed below editors, premature draft clearing/false success, a `/book-clubs/` link with no registered destination, click-only navigational cards, and notification loading/error shown as empty.
- Navigation/gesture problems include duplicate back-swipe ownership, history-length assumptions, long-press cancellation gaps and decoration-imposed route waits. Some consequences require reproduction; no latency trace was fabricated.
- Preserve themes, logos, Inter/Merriweather/Playfair roles, Iconoir, domain language, offline capture, timer reliability and service ownership.
- Accessibility is default behavior. App settings may reduce effects/haptics; they cannot substitute for semantic access or enable OS screen readers.
- Ticket progress is recorded in 09 and the linked active checkpoint. F01 is committed; F02/F03 are implemented and browser-verified in 14, with real-AT/device evidence unverified. Other ticket specifications remain plans.

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

The summary work ledger is the table under **Work ledger template** in [09-execution-plan.md](09-execution-plan.md). The user explicitly requested durable implementation documents: [13](13-implementation-tracker.md) preserves F01 and [14](14-next-implementation-batch.md) owns the current F02/F03 checkpoint. Keep one authoritative checkpoint per batch, with older records clearly marked historical; do not duplicate the active status across competing detailed records.

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

F01 is committed at `229dd677e33a8b7c6e81ac31d75b34aa94ea728d`. The user authorized the next implementation and multiple tickets only if completed. **F02 + F03 implementation and browser checks are complete**, with detailed scope/results in [14-next-implementation-batch.md](14-next-implementation-batch.md): 63 current-batch Playwright checks, 54 journal browser regressions, 86 combined focused unit/component tests, plus the additional consumer checks. Follow 14 for final graph/vault status. **STOP for user review; no new commit or F04 work was requested.** Actual native/AT/live-service checks remain release evidence gaps. [13](13-implementation-tracker.md) preserves F01; the original audit above remains historical.

## Skills and documentation maintenance

The BRACK frontend skill entrypoint was reduced from 2,758 lines to a short router. All 61 original numbered sections were preserved in eight topical reference files. This reduces always-loaded text; it does not remove review/behavior obligations. Read only relevant references and inspect current source when remembered context conflicts.

The new `.codex/skills/brack-frontend-delivery/SKILL.md` routes renewal execution through this evidence workflow. It is intentionally scoped to frontend audit/renewal work, not every repository task. The animation skill remains the specialist motion reference; the plan supplies BRACK-specific decisions.

Update the living UI docs after each implemented slice: `ui-shell-scrolling.md`, `ui-library-interactions.md`, `ui-date-pickers.md`, `loading-motion.md`, design/iconography, component guides and device/service boundaries as affected. This dossier retains the historical baseline and records implementation decisions. Avoid copying the complete plan into multiple skills or docs.
