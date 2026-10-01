# CR06b route recovery

`npx playwright test --config tests/playwright/route-recovery.config.ts`

Port8100, independent Vite cache/output, one worker. Set `CR06B_RUN` to keep separate attempts. Actual BookLists (both aliases), GoalsManagement/GoalManager, BookClubDetail, BookClubs, MyBooks and Auth screens, Router, OnboardingRouteGuard, AppNavigationProvider, shared shell/overlays and relevant reader hooks are mounted. Account scope distinguishes auth resolving, anonymous and authenticated states.

Only service/captcha/device and unrelated shell-state boundaries are controlled. Fixtures reuse the CR04 per-account Library store and CR06a/CR02 club data. Auth submits the actual form and invokes the real authRedirect resolver with a controlled established profile. No credentials, Supabase clients, live writes, provider OAuth, real Turnstile, onboarding persistence or permission prompts are exercised. Changed setup completion consumers are covered by component/unit tests; this is not browser validation of those whole screens.

Queries: `anonymous`, `resolving`, `club=loading|empty|401|403|404|network|ready`, `text=200`, `theme=dark`. `window.routeRecovery` changes auth and club responses, or navigates within the fixture. Mutation APIs outside this task throw. Analytics, AddBook and public Home are outside this fixture; their link URLs are source-verified, not destination-screen acceptance. Production App's social gate remains unchanged and was independently covered by CR06a; it is not mounted here.

Tests cover actual sign-in/return, auth-loading with a stale user, sign-out/account change, explicit auth cancel, club loading/unavailable/retry/contextual Back, phone/medium Library names and semantic link activation, touch, modified-click, keyboard focus/traversal, clipping/hit ownership and loaded brand fonts. Windows WebKit's plain-anchor Tab limitation is recorded as one skip, separate from Enter/modified-click/touch coverage. UI roots and setup guard remain real; this fixture does not measure actual App cold-load performance, backend authorization, native runtimes or assistive technology.

Checkpoint: [27-route-recovery.md](../../../docs/frontend-renewal/27-route-recovery.md). Baseline and failed attempts are retained; don't overwrite them to manufacture a clean history.
