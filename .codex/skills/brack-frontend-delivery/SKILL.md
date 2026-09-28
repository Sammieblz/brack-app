---
name: brack-frontend-delivery
description: Execute, extend, or review BRACK frontend renewal tickets using the repository audit plan, verified source evidence, bounded context retrieval, and durable handoffs. Use for this frontend renewal or closely related UI audit work; not for unrelated backend tasks or generic codebase questions.
---

# BRACK frontend delivery

Use the [renewal index](../../../docs/frontend-renewal/README.md), [execution tickets](../../../docs/frontend-renewal/09-execution-plan.md), and [handoff protocol](../../../docs/frontend-renewal/11-agent-handoff.md). The dossier is a plan, not evidence of implemented behavior. Follow current user scope; a request to plan does not authorize application changes.

## Retrieve the smallest sufficient context

1. Read the current ticket/checkpoint and relevant specification section, then inspect current HEAD/worktree and applicable instructions.
2. Query an existing Graphify index using affected symbols and a bounded result. Use the wiki or generated Obsidian source links to navigate when useful, then verify source and consumers. No index means ordinary source discovery; do not launch a broad indexing job just for this task.
3. Load only the matching [frontend skill reference](../brack-frontend-ux/SKILL.md). For motion use the relevant [animation reference](../mblode-agent-skills-ui-animation/SKILL.md), not every reference file.
4. Read tests and current source before proposing new primitives. Use `rg` and bounded reads; expand when evidence is incomplete. Reuse context already read rather than repeating full manuals or raw graph dumps.
5. Check installed/locked versions before consulting official API docs. Package metadata on an upstream development branch does not prove an installed or released version.

Retrieval budgets guide efficiency; they must not truncate necessary correctness investigation. Record an unresolved dependency rather than inventing it.

## Ground every decision

Classify claims as source-verified, fixture-observed, user-reported, hypothesis, proposed or device-unverified. Cite the path + symbol + commit or official URL + version/date. Tests present in a repo are not tests passed; browser emulation is not native/assistive-technology validation.

Preserve branding, theme IDs, fonts, Iconoir, reading/offline semantics, route/auth contracts and service/device boundaries. Ionic adoption is conditional on the dossier's integration gate. Keep app runtime, responsive window size and input capability separate. Basic accessibility never requires enabling a mode.

For conflicts, current user intent wins. Revalidate stale remembered facts against source; record necessary changes in the owning specification. Qualify repeated finding IDs with their document (for example `02/A03`). Never describe timing or conformance as measured without evidence.

## Execute and hand off

Implement the authorized, coherent ticket slice and relevant failure/accessibility states. When the user permits a batch, include only tickets that can be completed and verified before the requested review stop. Run meaningful existing checks and add regressions for demonstrated defects. No decorative animation may delay a confirmed save or navigation. Do not broaden into database or product-rule changes merely to simplify a visual component.

For current navigation/notification ownership read the [living contract](../../../docs/ui-navigation-notifications.md); for editor/input semantics read [form accessibility](../../../docs/ui-form-accessibility.md). These avoid rediscovering established invariants; still inspect source before changing them. Shared primitive changes require a consumer check for regressions outside the original screen. Keep Playwright artifact output independent before running suites concurrently.

Update the work ledger with exact files, decisions, commands/results, evidence limits and the next bounded action. Mark implemented, verified and shipped separately. Update living UI docs after behavior changes. After code edits, update an existing Graphify index locally according to project instructions; do not enable semantic/cloud extraction, database introspection, hooks or watchers implicitly.

Use the handoff template instead of copying the entire transcript. The next agent should be able to continue without re-auditing the whole repo or asking the user to repeat established choices.
