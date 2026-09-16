# Support contact delivery

Brack's shared support form submits to the `support-contact` Supabase Edge
Function. Clients never connect to SMTP or Brevo and never receive provider
credentials. The function accepts a message only after Brevo returns HTTP 201
with a message ID.

The canonical public address and the only production destination is
`support@brack-app.com`. Capacitor and Electron may offer a secondary system
composer action, but the in-app form remains available if no mail handler opens.

## Opening support from installed apps

Support links use the local `/support` route on web/PWA. In Capacitor mobile and
Electron desktop builds they open the public `/support` URL in the system browser,
with the local page as a fallback when offline or if the browser cannot be opened.
The default external origin is `https://brack-app.com`; staging builds set
`VITE_SUPPORT_SITE_ORIGIN=https://staging.brack-app.com`. Only those two exact
HTTPS origins are accepted. Before releasing installed production builds,
verify that `https://brack-app.com/support` resolves, serves the support page,
and accepts contact submissions. The production-domain cutover remains tracked
in `docs/deployment.md`.

## Data and privacy boundary

The client sends a category, subject, message, one request UUID, and a validated
reply address. Signed-in requests derive the reply address from the verified
Supabase Auth user. Anonymous requests require a reply address and a Turnstile
token.

Readers opt in to diagnostic metadata and can select the displayed app version
(currently `v1.0.0`) and platform (`web`, `mobile`, or `desktop`). The request ID
is always shown and included for delivery tracking. The optional summary contains
only:

- app version;
- selected platform.

The public `/support` center reuses this form. Its FAQ search is local; Terms,
Privacy, and Known Issues are explicitly labeled placeholders until approved
content and a live issue feed are available.

Do not add auth/session tokens, database records, book or journal notes, social
messages, precise location, user-agent strings, or logs to this payload. The
`support_delivery_requests` table stores delivery state and keyed digests only;
it does not store subjects, messages, email addresses, raw IP addresses, or
Turnstile tokens.

## Required environment configuration

Configure each project independently with `supabase secrets set --project-ref
<verified-ref>`. Never copy a production secret set wholesale into staging and
never put these values in a `VITE_` variable:

| Secret | Purpose |
| --- | --- |
| `BREVO_API_KEY` | Server-only transactional email API key with the minimum sending scope. |
| `SUPPORT_FROM_EMAIL` | A Brevo-verified sender on the Brack domain. |
| `SUPPORT_DELIVERY_MODE` | Exactly `production`, `staging`, or `test`. |
| `SUPPORT_STAGING_SINK_EMAIL` | Required outside production; must not equal the public support address. |
| `SUPPORT_FINGERPRINT_SECRET` | At least 32 random characters used to key non-reversible actor fingerprints. |
| `TURNSTILE_SECRET_KEY` | Server-side Turnstile validation credential. |
| `TURNSTILE_ALLOWED_HOSTNAMES` | Comma-separated exact hostnames accepted from Siteverify. |
| `ALLOWED_ORIGINS` | Comma-separated exact web/app origins allowed to submit. |

The web build needs only the public `VITE_TURNSTILE_SITE_KEY` and, for packaged
app bridges, the existing public `VITE_TURNSTILE_BRIDGE_ORIGIN`.

Staging must use `SUPPORT_DELIVERY_MODE=staging` and a dedicated sink mailbox.
The function refuses to use `support@brack-app.com` as that sink. Before any
secret or deployment command, verify the linked project and branch with
`supabase projects list` and `supabase branches list --project-ref <production-ref>`.

## Sender and DNS readiness

Before production enablement:

1. Verify `SUPPORT_FROM_EMAIL` and its domain in Brevo.
2. Publish and validate Brevo DKIM and SPF records without creating a second,
   conflicting SPF record.
3. Keep a DMARC policy and reporting address active; review aggregate reports
   after sender or DNS changes.
4. Confirm Cloudflare Email Routing still delivers
   `support@brack-app.com` to the staffed support mailbox.
5. Send a real reply test and confirm the validated reader address is used only
   as Reply-To, never as the sender or destination.

## Abuse, idempotency, and failure behavior

Anonymous callers must pass Turnstile with action `support_contact` and an
allowed hostname. All callers use fail-closed distributed IP limits; signed-in
callers also receive an account limit. Header control characters, unknown
categories, invalid addresses, and oversized bodies are rejected.

The request UUID is claimed atomically in Postgres. A retry with identical
content reuses that UUID; changed content receives a new UUID. Brevo also
receives the UUID as its `Idempotency-Key`. Processing claims become
recoverable after 90 seconds, and provider failures become immediately
retryable. The UI preserves the draft and never reports success for timeouts or
unaccepted provider responses.

## Monitoring and triage

In Brevo, create transactional webhook subscriptions for `request`, `sent`,
`delivered`, `deferred`, `soft_bounce`, `hard_bounce`, `invalid`,
`blocked`, `error`, and `spam`. Keep production and staging webhook streams
separate. Alert the support owner on:

- any production `blocked`, `invalid`, `error`, or spam complaint;
- a sustained rise in deferred or bounce events;
- repeated Edge Function `delivery_failed` events; and
- unusual accepted-message volume or rate-limit saturation.

The Brevo message is tagged `support-contact` and `support-<category>`. Edge
logs contain request ID, category on acceptance, and an error class only. Search
by request ID first; do not paste message content or email addresses into logs,
tickets, or incident chat.

For a failed request:

1. Confirm the request ID and environment.
2. Check the Edge Function status/error class and the content-free delivery
   receipt.
3. Check the Brevo event by provider message ID when one exists.
4. If Brevo did not accept it, ask the reader to retry with the preserved draft
   or use the copyable support address.
5. If Brevo accepted it, do not resend manually until its delivery event is
   understood.

For bounces, correct sender/DNS problems before retrying. Never change the
destination based on client input.

## Rotation

Rotate the Brevo, Turnstile, and fingerprint secrets individually in staging,
exercise the rejection and accepted paths, then rotate production. Supabase
Edge Function secrets become available without rebuilding the Vite bundle.
Keep the previous provider key active only for the shortest overlap Brevo
supports, revoke it after validation, and record the rotation date and owner.

## Verification

Run:

```text
npm run check-types
npm run lint
npm run test
npm run test:edge
npm run test:db
```

Database tests require the local Supabase stack. Provider acceptance, Reply-To,
DNS, webhook, and staging-sink checks require explicitly authorized deployment
and provider configuration; unit tests use fakes and do not send email.
