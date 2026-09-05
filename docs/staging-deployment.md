# Staging Web Deployment

Brack's staging web release uses the separate `brack-app-staging` Cloudflare
Pages project and is deployed from the `test` branch by
`.github/workflows/deploy-staging.yml`. The project is served at
`https://staging.brack-app.com` and uses the isolated, persistent Supabase
branch named `stage` (`satrvrfapnnpsvqgpjer`). The workflow rejects the parent
production ref (`waftnaqgkcgufzapcihe`) even though both environments belong to
the same Supabase project.

The release boundary is:

```text
test branch -> GitHub stage environment -> verified Vite build
            -> Cloudflare Pages project brack-app-staging
            -> https://staging.brack-app.com
            -> persistent Supabase stage branch
```

`brack-app-staging` was created with Cloudflare's Git integration. Keep that
repository connection, but disable Cloudflare's automatic production and
preview deployments. GitHub Actions is the sole staging build and release
owner; after validation and any required `stage` approval, it performs a
Wrangler Direct Upload to the existing project. This prevents one commit from
creating competing builds with different environment values.

Cloudflare calls `test` this project's **Production** environment because
`test` is the production branch of this staging-only Pages project. That label
does not make the deployment Brack production. GitHub's lowercase `stage`
environment is a separate GitHub concept and is the source of build variables,
secrets, approvals, and the deployment record.

## 1. Provision and maintain the Supabase stage branch

The Supabase GitHub integration maps repository branch `test` to the persistent
Supabase branch `stage`. `supabase/config.toml` pins that mapping under
`[remotes.test]`; do not replace it with the parent production ref. Supabase
branches have independent database, Auth, Storage, API keys, and runtime
secrets even when they share a parent project.

The production migration ledger remains the only schema source. Apply missing
migrations forward, then require exact migration history, the protected
database contracts, schema fingerprint, pgTAP, and database lint. Never use
`migration repair` to make a failed branch look current. The production
database workflow remains locked to `main`; Supabase's branch integration owns
backend deployment for `test`, while the staging web workflow owns only the
Cloudflare build.

The branch was provisioned on 2026-09-04 with all 83 locked migrations, all 76
Edge Functions, 70 RLS-enabled public tables, Storage bucket definitions,
Realtime publications, queues, cron jobs, and source-controlled Auth email
templates. A clean local replay and the linked postflight checks passed. The
`claim_push_token` hosted ACL discrepancy was closed by the forward-only
`20260905015937_restrict_claim_push_token_service_role.sql` migration.

At the owner's explicit request, stage also received a production data snapshot:

- Auth users and identities were copied so existing test operators keep their
  account UUIDs and can exercise password/provider linking flows.
- All durable application tables and seven referenced Storage objects were
  copied and content-fingerprinted against production.
- Sessions, refresh tokens, one-time tokens, MFA state, Auth audit logs, push
  tokens, telemetry, rate-limit counters, dashboard snapshots, and import jobs
  were excluded. Pending Auth tokens in copied user rows were cleared.

Stage therefore contains production personal data and must be protected and
retained like production. Keep Cloudflare Access enabled, limit Supabase project
membership, never expose a service-role/secret key to Vite, and repeat a data
refresh only with explicit owner approval. The CLI's `db dump --dry-run` output
can contain temporary database credentials; never run or archive that output in
CI logs.

Before accepting a staging release, confirm all of the following:

- migration history, schema fingerprint, contracts, and database lint pass;
- production and stage Edge Function names, hashes, and JWT settings match;
- stage-only function origins, app URL, and worker secret are configured;
- hosted Auth redirects and templates match source control; and
- CAPTCHA, Google OAuth, and SMTP are exercised end to end with branch-specific
  provider secrets.

In the staging Supabase dashboard, configure:

- **Auth Site URL:** `https://staging.brack-app.com`
- **Additional Redirect URLs:**
  - `https://staging.brack-app.com/auth/callback`
  - `https://staging.brack-app.com/auth/reset-password`
- **Turnstile:** set the branch-specific secret matching the sitekey used by the
  staging build, then enable CAPTCHA. A browser sitekey alone is insufficient.
- **Google OAuth, if enabled:** authorize the staging branch project's
  `/auth/v1/callback` URL in Google Cloud.
- **SMTP, if email flows are tested:** use server-side staging credentials and
  a verified sender. Never put Brevo credentials in GitHub variables prefixed
  with `VITE_`.
- **Edge Function CORS:** include `https://staging.brack-app.com` in the
  stage branch's `ALLOWED_ORIGINS` secret.
- **Edge-generated links:** set the stage branch's `PUBLIC_APP_URL` secret
  to `https://staging.brack-app.com`; do not change the production project's
  canonical value.
- **Journey worker:** use a stage-only `GAMIFICATION_WORKER_SECRET` and store
  the identical value in Vault as `gamification_worker_secret`; Vault
  `project_url` must be the stage branch URL.
- **Optional integration secrets:** set `TENOR_API_KEY` for GIF search and
  `FCM_SERVICE_ACCOUNT_JSON` for push delivery when those integrations are in
  the staging test scope. Provider credentials are write-only and cannot be
  recovered from the parent branch through the CLI.

The browser callback helpers use the current `window.location.origin`, so the
same client code produces the correct staging URLs once the exact routes above
are allowlisted.

## 2. Configure the existing Cloudflare Pages project

The existing project is Git-integrated, which Cloudflare supports as a target
for later Wrangler uploads once its automatic deployments are paused. Do not
delete or recreate it. Configure both Cloudflare environment views:

1. Open **Cloudflare > Workers & Pages > brack-app-staging > Settings > Build**.
   Some dashboard layouts call this **Builds & deployments**.
2. In **Choose Environment**, select **Production**. Edit **Branch control**,
   confirm the production branch is exactly `test`, turn off **Enable automatic
   production branch deployments**, and save.
3. Switch **Choose Environment** to **Preview**. Edit **Branch control**, set
   **Preview branch** to **None**, and save. Do not leave it at **All
   non-production branches**.
4. Keep the `Sammieblz/brack-app` GitHub repository connected. Its connection is
   metadata only for this release model; Cloudflare must not build on a push.

The build command, output directory, `NODE_VERSION`, and `VITE_*` values visible
in Cloudflare are not used by the GitHub-built Direct Upload. The authoritative
build configuration is the lowercase GitHub `stage` environment. Remove
duplicated Cloudflare build-time variables after automatic builds are disabled
so future maintainers do not update the wrong copy. Runtime Pages Function
bindings, if Brack adds any later, must be documented separately.

Every deployment calls the Cloudflare Pages API before building and fails
closed unless:

- the project is `brack-app-staging`;
- its production branch is `test`;
- it is connected to the current GitHub repository;
- automatic production deployments are disabled; and
- preview deployments are set to `none`.

A true Direct Upload project without a Git source remains compatible with the
guard, but it must still use `test` as its production branch. After upload, the
workflow also checks that Cloudflare classified the deployment as production.

Create a custom Cloudflare API token for GitHub with only:

- Permission: **Account > Cloudflare Pages > Edit**
- Account resources: only the account that contains Brack

Do not use the Global API Key. The token is account-scoped, so the workflow
hard-codes `brack-app-staging` to reduce accidental deployment to another Pages
project.

## 3. Configure the GitHub `stage` environment

Open **GitHub repository > Settings > Environments > stage**. The workflow uses
this lowercase name exactly; do not create a second `Stage` environment.

Configure these protection rules:

- Deployment branches and tags: **Selected branches and tags**, pattern
  `test` only.
- Required reviewers when the repository plan supports them.
- Prevent self-review only when another maintainer is available.
- Protect the `test` branch from force-push and deletion, require pull-request
  review, and require CI for pull requests into `test`.

Approval grants the approved workflow revision access to `stage` credentials.
Review changes under `.github/workflows/**` before approving a deployment and
consider a CODEOWNERS rule for that directory.

Add these environment secrets:

| Name | Purpose |
| --- | --- |
| `STAGE_CLOUDFLARE_API_TOKEN` | Account-scoped Pages Edit token used only by the project preflight and publish steps. |
| `STAGE_TURNSTILE_SITE_KEY` | Existing-widget sitekey compiled into the staging browser bundle. Store it as a GitHub secret to keep it out of source and routine logs. |

Add these environment variables:

| Name | Required value |
| --- | --- |
| `STAGE_CLOUDFLARE_ACCOUNT_ID` | The 32-character ID of the Cloudflare account containing Brack. |
| `STAGE_SUPABASE_PROJECT_REF` | The persistent Supabase `stage` branch ref (`satrvrfapnnpsvqgpjer`); it must not be the parent production ref. |
| `STAGE_SUPABASE_URL` | Exactly `https://<STAGE_SUPABASE_PROJECT_REF>.supabase.co`. |
| `STAGE_SUPABASE_PUBLISHABLE_KEY` | Stage branch's `sb_publishable_…` key or legacy JWT whose role is `anon`. |
| `STAGE_SOCIAL_FEATURES_ENABLED` | Set explicitly to `true` or `false`. |
| `STAGE_GAMIFICATION_ENABLED` | Set explicitly to `true` or `false`. |
| `STAGE_LEADERBOARDS_ENABLED` | Set explicitly to `true` or `false`. |
| `STAGE_SENTRY_DSN` | Optional staging browser DSN; leave empty to disable Sentry. |

Create all of these names only inside the lowercase `stage` environment. Do
not duplicate the same `STAGE_*` names as repository or organization variables.

`VITE_APP_VERSION` is set automatically to the Git commit SHA. The Pages
project name and staging URL are fixed in the workflow, so they are not
duplicated as mutable GitHub variables.

The dedicated `STAGE_*` contract avoids accidentally reusing generic
repository-level Vite configuration. After approval, the workflow validates
the values and exports only the browser-safe subset under the `VITE_*` names
consumed by Vite. It positively matches the Supabase URL to the pinned staging
project ref, verifies the URL/key pair against Auth settings, rejects
`sb_secret_` and non-`anon` legacy JWTs, and validates all feature flags.

Every value exported as `VITE_*` is delivered to the browser. A Turnstile
sitekey and a Supabase publishable key are public identifiers even when stored
as GitHub secrets; the corresponding Turnstile secret, Supabase
service-role/secret key, database password, SMTP credentials, and Cloudflare
token must never be placed in a browser variable.

`STAGE_SENTRY_DSN` is not a feature toggle. Do not set it to `true`; remove the
variable (or leave its value empty) when staging does not have a dedicated
Sentry project. When set, it must be the complete HTTPS browser DSN supplied by
Sentry.

`STAGE_SUPABASE_PROJECT_REF` is a non-authorizing target pin; the web workflow
cannot use it to change a database. Backend deployment values such as
`SUPABASE_PROJECT_REF`, `SUPABASE_ACCESS_TOKEN`, and `SUPABASE_DB_PASSWORD` are
not consumed by this workflow. Add them only when a separate, reviewed staging
database workflow is introduced.

## 4. Authorize the staging hostname

Verify or attach the custom domain after the first successful Pages deployment:

1. Open **Cloudflare > Workers & Pages > brack-app-staging > Custom domains**.
2. Select **Set up a domain** and enter `staging.brack-app.com`.
3. Activate it. Because `brack-app.com` is already a Cloudflare zone,
   Cloudflare creates the proxied DNS record and certificate. Do not buy another
   domain and do not manually create a CNAME before associating the custom
   domain with Pages.
4. In the existing Turnstile widget's **Hostname Management**, add
   `staging.brack-app.com` without a protocol or path. Keep `brack-app.com` for
   production.
5. After the domain is Active, protect staging with a free Cloudflare Access
   self-hosted application. Restrict access to the intended tester identities.
   Protect or redirect the `brack-app-staging.pages.dev` hostname as well so it
   cannot bypass the custom-domain policy.

The staging build also writes a global `X-Robots-Tag: noindex` header and a
disallow-all `robots.txt`. Those controls prevent accidental indexing; they are
not authentication and do not replace Cloudflare Access.

## 5. Deploy

Open a pull request into `test`, wait for CI, then merge the approved revision.
`Deploy Staging Web` will:

1. Run lint, type checks, media verification, Auth-template validation and
   guardrail tests, unit tests, and Edge Function tests without access to
   `stage` secrets.
2. Pause for the `stage` environment's approval rules.
3. Reject missing configuration, CI placeholders, the Turnstile test key, an
   insecure Supabase URL, or Brack's production Supabase project.
4. Verify the Pages project, branch, repository connection, and disabled
   Cloudflare automatic-deployment controls through the Cloudflare API.
5. Build with Node 22, verify Auth/PWA artifacts, apply the staging crawl
   policy, and upload `apps/client/dist` to the `test` production branch of
   `brack-app-staging`.
6. Fail the job if Cloudflare does not classify the upload as a production
   deployment for that staging-only project.

The manual dispatch is also restricted to `refs/heads/test`. GitHub only shows
a workflow-dispatch control after the workflow exists on the repository's
default branch; the `push` trigger works from the `test` branch immediately.

### Configuration failures

If the job reports `Staging cannot target Brack's production Supabase project`,
the protected GitHub `stage` environment still contains the parent production
ref, URL, and key. Select the Supabase `stage` branch in its dashboard and
replace all three `STAGE_SUPABASE_*` values together with that branch's ref,
URL, and browser-safe publishable key. Do not remove or weaken this check: the
staging app exercises Auth and write paths and must never target production.

If the log shows `STAGE_SENTRY_DSN: true`, delete that value or replace it with
a complete staging Sentry browser DSN. `STAGE_SENTRY_DSN` is optional and is
not a Boolean feature flag.

The Supabase branch badge can continue to show the result of an older failed
Git deployment even after an operator completes a verified CLI recovery. Do
not change migration history to clear the badge. Commit the forward migration,
lock, and `[remotes.test]` configuration to `test`; the next Supabase GitHub
integration run replaces the stale deployment result. Until then, require the
linked 83-migration postflight, contracts, schema fingerprint, and lint evidence
before treating the database as ready.

CI ownership is intentionally split by event:

- Pull requests whose base branch is `test` run `.github/workflows/ci.yml`.
- The merged commit pushed to `test` is revalidated and released by
  `.github/workflows/deploy-staging.yml`.
- Pull-request code never receives the authenticated Playwright account
  credentials; those are available only on trusted `main` pushes.
- Cloudflare's Git integration creates no automatic deployment or duplicate
  status check because both branch controls are disabled.

## 6. Release verification

Before accepting the staging release, verify:

- `https://staging.brack-app.com/` loads over HTTPS.
- Refreshing a nested SPA route does not return a hosting 404.
- `/auth/callback` and `/auth/reset-password` load the SPA and return
  `Cache-Control: private, no-store`.
- `/turnstile.html` loads without Cloudflare error `110200` and remains
  `no-store`.
- Responses include `X-Robots-Tag: noindex, nofollow, noarchive`.
- Browser network requests target only the staging Supabase hostname, never
  `waftnaqgkcgufzapcihe.supabase.co`.
- Signup, confirmation, sign-in, password reset, Google OAuth (if enabled), and
  onboarding profile finalization work with staging-only accounts.
- Edge Function preflights accept `https://staging.brack-app.com`.
- Cloudflare Access protects both the custom hostname and any retained
  `pages.dev` entry point.

The Auth, database, and Edge Function checks above assume the backend readiness
gate in section 1 is already complete. A successful web upload alone does not
prove that the staging backend was promoted.

Cloudflare Pages retains deployments for rollback. Rolling back the web bundle
does not roll back database migrations; database recovery remains a separate,
reviewed operation.

## Platform references

- [Cloudflare: disable automatic deployments on a Git-integrated Pages project](https://developers.cloudflare.com/pages/configuration/git-integration/#disable-automatic-deployments)
- [Cloudflare: production and preview branch controls](https://developers.cloudflare.com/pages/configuration/branch-build-controls/)
- [GitHub: configuration-variable precedence and environment timing](https://docs.github.com/en/actions/reference/workflows-and-actions/variables#configuration-variable-precedence)
- [Supabase: separate staging and production environments](https://supabase.com/docs/guides/deployment/managing-environments)

## Native and desktop scope

This staging project is a web/PWA environment. It does not change Android App
Links, iOS Associated Domains, Capacitor bundle identifiers, Electron protocol
registration, or production JSON metadata. Packaged apps continue using
`brack://auth/*` and the canonical `brack-app.com` configuration unless a
separate signed staging build flavor is deliberately introduced.
