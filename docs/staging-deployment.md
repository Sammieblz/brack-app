# Staging Web Deployment

Brack's staging web release is a separate Cloudflare Pages project deployed
from the `test` branch by `.github/workflows/deploy-staging.yml`. The project is
served at `https://staging.brack-app.com` and must use a dedicated staging
Supabase project. The workflow rejects Brack's production Supabase project.

The release boundary is:

```text
test branch -> GitHub Stage environment -> verified Vite build
            -> Cloudflare Pages project brack-app-staging
            -> https://staging.brack-app.com
            -> dedicated staging Supabase project
```

The GitHub workflow performs a Direct Upload. Do not also connect the same
Pages project to Cloudflare's Git integration, or one commit can create two
competing deployments with different environment values.

## 1. Provision the staging Supabase project

Create a Supabase project specifically for staging before configuring the
GitHub variables. Do not reuse project `waftnaqgkcgufzapcihe`, copy production
user data, or copy service-role credentials into a browser variable.

The remote staging schema must be established through a reviewed migration
release. The existing `Deploy Production Database Migrations` workflow and the
Auth-template apply commands are production-locked and must not be repointed or
weakened. The staging web workflow never mutates a database, deploys Edge
Functions, or changes hosted Auth settings.

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

## 2. Create the Cloudflare Pages project

Create a Direct Upload Pages project in the same Cloudflare account that owns
the `brack-app.com` zone. The repository workflow intentionally fixes its name
to `brack-app-staging` and its production branch to `test`.

Using Wrangler:

```bash
npx wrangler@4.127.0 login
npx wrangler@4.127.0 pages project create brack-app-staging --production-branch=test
```

Alternatively, create a Direct Upload project named `brack-app-staging` from
**Cloudflare Dashboard > Workers & Pages**, then set its production branch to
`test`. Do not configure a Cloudflare build command: GitHub builds the app and
uploads `apps/client/dist`.

Create a custom Cloudflare API token for GitHub with only:

- Permission: **Account > Cloudflare Pages > Edit**
- Account resources: only the account that contains Brack

Do not use the Global API Key. The token is account-scoped, so the workflow
hard-codes `brack-app-staging` to reduce accidental deployment to another Pages
project.

## 3. Configure the GitHub `Stage` environment

Open **GitHub repository > Settings > Environments > Stage**.

Configure these protection rules:

- Deployment branches and tags: **Selected branches and tags**, pattern
  `test` only.
- Required reviewers when the repository plan supports them.
- Prevent self-review only when another maintainer is available.
- Protect the `test` branch from force-push and deletion, require pull-request
  review, and require CI for pull requests into `test`.

Approval grants the approved workflow revision access to Stage credentials.
Review changes under `.github/workflows/**` before approving a deployment and
consider a CODEOWNERS rule for that directory.

Add these environment secrets:

| Name | Purpose |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | Account-scoped Pages Edit token used only by the publish step. |
| `VITE_TURNSTILE_SITE_KEY` | Existing-widget sitekey compiled into the staging browser bundle. Store it as a GitHub secret to keep it out of source and routine logs. |

Add these environment variables:

| Name | Required value |
| --- | --- |
| `CLOUDFLARE_ACCOUNT_ID` | The 32-character ID of the Cloudflare account containing Brack. |
| `VITE_SUPABASE_URL` | HTTPS URL of the dedicated staging Supabase project. |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Staging project's publishable/anon browser key. |
| `VITE_SOCIAL_FEATURES_ENABLED` | Set explicitly to `true` or `false`. |
| `VITE_GAMIFICATION_ENABLED` | Set explicitly to `true` or `false`. |
| `VITE_LEADERBOARDS_ENABLED` | Set explicitly to `true` or `false`. |
| `VITE_SENTRY_DSN` | Optional staging browser DSN; leave empty to disable Sentry. |

`VITE_APP_VERSION` is set automatically to the Git commit SHA. The Pages
project name and staging URL are fixed in the workflow, so they are not
duplicated as mutable GitHub variables.

Every `VITE_*` value is delivered to the browser. A Turnstile sitekey and a
Supabase publishable key are public identifiers even when stored as GitHub
secrets; the corresponding Turnstile secret, Supabase service-role/secret key,
database password, SMTP credentials, and Cloudflare token must never be placed
in a `VITE_*` variable.

Reserved backend deployment values such as `SUPABASE_PROJECT_REF`,
`SUPABASE_ACCESS_TOKEN`, and `SUPABASE_DB_PASSWORD` are not consumed by the web
workflow. Add them only when a separate, reviewed staging database workflow is
introduced.

## 4. Authorize the staging hostname

After the first successful Pages deployment:

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

Push an approved commit to `test`. `Deploy Stage Web` will:

1. Run lint, type checks, media verification, Auth-template validation, and
   unit tests without access to Stage secrets.
2. Pause for the `Stage` environment's approval rules.
3. Reject missing configuration, CI placeholders, the Turnstile test key, an
   insecure Supabase URL, or Brack's production Supabase project.
4. Build with Node 22, verify Auth/PWA artifacts, apply the staging crawl
   policy, and upload `apps/client/dist` to the `test` production branch of
   `brack-app-staging`.

The manual dispatch is also restricted to `refs/heads/test`. GitHub only shows
a workflow-dispatch control after the workflow exists on the repository's
default branch; the `push` trigger works from the `test` branch immediately.

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

Cloudflare Pages retains deployments for rollback. Rolling back the web bundle
does not roll back database migrations; database recovery remains a separate,
reviewed operation.

## Native and desktop scope

This staging project is a web/PWA environment. It does not change Android App
Links, iOS Associated Domains, Capacitor bundle identifiers, Electron protocol
registration, or production JSON metadata. Packaged apps continue using
`brack://auth/*` and the canonical `brack-app.com` configuration unless a
separate signed staging build flavor is deliberately introduced.
