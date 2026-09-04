# Staging Web Deployment

Brack's staging web release uses the separate `brack-app-staging` Cloudflare
Pages project and is deployed from the `test` branch by
`.github/workflows/deploy-staging.yml`. The project is served at
`https://staging.brack-app.com` and must use a dedicated staging Supabase
project. The workflow rejects Brack's production Supabase project.

The release boundary is:

```text
test branch -> GitHub stage environment -> verified Vite build
            -> Cloudflare Pages project brack-app-staging
            -> https://staging.brack-app.com
            -> dedicated staging Supabase project
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

## 1. Provision the staging Supabase project

Create a Supabase project specifically for staging before configuring the
GitHub variables. Do not reuse project `waftnaqgkcgufzapcihe`, copy production
user data, or copy service-role credentials into a browser variable.

The remote staging schema must be established through a reviewed migration
release. The existing `Deploy Production Database Migrations` workflow and the
Auth-template apply commands are production-locked and must not be repointed or
weakened. The staging web workflow never mutates a database, deploys Edge
Functions, or changes hosted Auth settings.

Do not accept the first staging web release until its backend readiness record
confirms all of the following:

- reviewed migrations were applied to the dedicated staging project and the
  remote history, schema fingerprint, contracts, and database lint passed;
- the matching Edge Functions were deployed to staging;
- staging-only function secrets and CORS origins were configured; and
- hosted Auth, CAPTCHA, OAuth, SMTP, redirects, and email templates were tested.

Pull requests into `test` run the local migration replay and integrity workflow,
but that check does not apply anything remotely. Until a separately guarded
staging database release workflow exists, backend promotion remains an explicit
reviewed prerequisite and must never reuse or weaken the production workflow.
For a newly created Supabase project, also mirror Brack's intended Data API
schema exposure explicitly and verify grants and RLS; do not expose every table
in `public` by assumption.

In the staging Supabase dashboard, configure:

- **Auth Site URL:** `https://staging.brack-app.com`
- **Additional Redirect URLs:**
  - `https://staging.brack-app.com/auth/callback`
  - `https://staging.brack-app.com/auth/reset-password`
- **Turnstile:** the secret matching the sitekey used by the staging build.
- **Google OAuth, if enabled:** authorize the staging Supabase project's
  `/auth/v1/callback` URL in Google Cloud.
- **SMTP, if email flows are tested:** use server-side staging credentials and
  a verified sender. Never put Brevo credentials in GitHub variables prefixed
  with `VITE_`.
- **Edge Function CORS:** include `https://staging.brack-app.com` in the
  staging project's `ALLOWED_ORIGINS` secret.
- **Edge-generated links:** set the staging project's `PUBLIC_APP_URL` secret
  to `https://staging.brack-app.com`; do not change the production project's
  canonical value.

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
| `STAGE_SUPABASE_PROJECT_REF` | The exact 20-character ref of the dedicated staging project; it must not be the production ref. |
| `STAGE_SUPABASE_URL` | Exactly `https://<STAGE_SUPABASE_PROJECT_REF>.supabase.co`. |
| `STAGE_SUPABASE_PUBLISHABLE_KEY` | Staging project's `sb_publishable_…` key or legacy JWT whose role is `anon`. |
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
