# Product KPIs

Source date: 2026-05-05  
Scope: ticket 9.1, Brack success metrics.

## Primary KPIs

| KPI | Definition | Source |
| --- | --- | --- |
| Weekly active readers | Count of users with at least one `reading_sessions` row or `progress_logs` row in the last 7 days. | `reading_sessions`, `progress_logs` |
| Sessions logged per active user | Total reading sessions in period divided by active readers in the same period. | `reading_sessions` |
| 7-day return rate after first session | Share of users who log another session or progress log within 7 days after their first session. | `reading_sessions`, `progress_logs` |

## Secondary Metrics

| Metric | Definition |
| --- | --- |
| Books added per active reader | New `books` rows per active reader. |
| Progress logs per active reader | `progress_logs` count per active reader. |
| Timer completion rate | Finished timer sessions divided by started timers if timer-start telemetry is added. |
| Books completed per month | Completed `books` count grouped by `date_finished`. |
| Reading minutes per active reader | Session duration plus progress-log time per active reader. |
| Onboarding finalization rate | New eligible profiles reaching `completed` or `skipped`, divided by new eligible profiles after the observation window. Report completion and skip separately. |
| Verified signup-to-completed-onboarding | New profiles with `onboarding_status = 'completed'` divided by verified new profiles in the same cohort; never count an anonymous in-memory draft as an account. |
| Draft-finalization recovery rate | Readers routed to authenticated draft recovery who subsequently reach `completed` or `skipped`, once non-sensitive recovery telemetry exists. |
| Native permission-intro continuation | New native readers who leave the optional education screen for the dashboard, regardless of whether notifications were granted, once platform-scoped telemetry exists. |
| Offline sync success rate | Accepted sync outbox items divided by attempted items. |
| Review/post creation rate | Community content writes per active reader. |

## Notes

- Primary KPIs should be computed from source tables or analytics snapshots, not frontend-only calculations.
- Avoid storing personally sensitive reading details in product analytics beyond what is already needed for user-facing features.
- Analytics should aggregate by user/time period unless a feature explicitly needs event-level inspection.

## Onboarding-first funnel

The product sequence is:

```text
landing Get Started
  -> anonymous onboarding started
  -> onboarding completed or skipped locally
  -> signup attempted
  -> account verified
  -> draft finalized
  -> native permission education (native only)
  -> dashboard
```

The anonymous draft is intentionally process-only, versioned, and temporary.
It is not persisted in browser/native storage or the database and must not
contain an analytics identifier, password, session token, Turnstile token, or
other secret merely to make funnel joins easier. Current durable measurement
begins at the verified `profiles` row and its onboarding status/timestamps.
Landing-to-signup conversion remains an instrumentation gap until
privacy-reviewed, allowlisted events are added.

When that telemetry is added, keep it coarse and non-sensitive: runtime
(`web`, `pwa`, `desktop`, `ios`, `android`), draft version, outcome
(`completed`/`skipped`), and finalizer result are sufficient. Do not record
genre answers, goals, email addresses, captcha values, exact location, OS device
tokens, or permission identifiers in product telemetry.

Permission grant state is OS- and installation-specific; it must not be inferred
from `profiles` or treated as a signup success requirement. Measure permission
education continuation separately from notification registration success, and
segment iOS delivery only after Firebase APNs credentials, Apple capability,
and physical-device receipt are verified.

