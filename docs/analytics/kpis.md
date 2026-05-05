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
| Onboarding completion rate | Completed onboarding profiles divided by new profiles. |
| Offline sync success rate | Accepted sync outbox items divided by attempted items. |
| Review/post creation rate | Community content writes per active reader. |

## Notes

- Primary KPIs should be computed from source tables or analytics snapshots, not frontend-only calculations.
- Avoid storing personally sensitive reading details in product analytics beyond what is already needed for user-facing features.
- Analytics should aggregate by user/time period unless a feature explicitly needs event-level inspection.

