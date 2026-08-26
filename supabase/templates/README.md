# Brack Auth Email Templates

These files are the source of truth for Brack's six authentication emails and
seven security notifications. They contain no SMTP credentials, API tokens, or
provider secrets.

## Local validation

```sh
npm run auth:emails:validate
npm run auth:emails:test
```

The corresponding `subject`, `content_path`, and notification `enabled` values
live in `supabase/config.toml`. Restart the local Supabase stack after changing a
template so GoTrue reloads it.

The local Auth policy also enables email confirmation, uses Brack's exact local
and `brack://` callback routes, expires email OTPs after one hour, and enforces
the same eight-character/lowercase/uppercase/digit password contract as the
client. Mail remains captured by the local Mailpit service; hosted Brevo SMTP
credentials are never copied into `config.toml`.

The Supabase CLI's path bases are intentionally asymmetric: authentication
template paths use `./supabase/templates/...`, while security-notification paths
use `./templates/...` relative to `supabase/config.toml`. The validator enforces
both forms, and `npx supabase status` is the quick CLI parse check.

## Hosted drift check

Create a short-lived Supabase personal access token and keep it in the process
environment. Never put it in an `.env` file committed to the repository.

```sh
SUPABASE_ACCESS_TOKEN=... npm run auth:emails:check
```

In PowerShell, use a masked prompt so the token is not stored in shell history:

```powershell
$secureToken = Read-Host "Supabase access token" -AsSecureString
$tokenPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureToken)
try {
  $env:SUPABASE_ACCESS_TOKEN = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($tokenPointer)
  npm run auth:emails:check
} finally {
  Remove-Item Env:SUPABASE_ACCESS_TOKEN -ErrorAction SilentlyContinue
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($tokenPointer)
}
```

The check reads hosted Auth configuration and reports only names of fields that
differ. It never prints remote template bodies or secret-bearing configuration.

## Hosted synchronization

Review the template diff and run:

```sh
SUPABASE_ACCESS_TOKEN=... npm run auth:emails:apply
```

`--apply` sends a partial Management API PATCH containing only the 33 fields
listed in `auth-email-manifest.json`: subjects and HTML for every template, plus
the seven notification enable flags. It cannot change SMTP, CAPTCHA, OAuth,
Site URL, redirect URLs, password policy, or any secret. The script reads the
configuration again after applying it and fails if drift remains.

For production, prefer the manually dispatched **Auth Email Templates** GitHub
workflow. It uses the protected `production` environment, defaults to a
read-only drift check, and requires an explicit `apply` selection plus the
environment's `SUPABASE_ACCESS_TOKEN` secret to mutate hosted configuration.

Authentication templates do not have per-template enable flags. All seven
security-change notifications are enabled in source control and production so
a reader is warned about password, email, phone, linked-identity, and MFA-factor
changes even when the corresponding product surface is uncommon.

Confirmation and recovery templates display Supabase's six-digit `Token` as the
primary action so the reader can finish in the Brack window that requested it.
Their `ConfirmationURL` remains a secure fallback and requests a separate
browser context; an email client cannot reopen a specific existing tab. Links
continue to follow the web, Capacitor, or desktop redirect passed by the client.
The magic-link template also includes `Token`; email-change explicitly
identifies `NewEmail`.

## Delivery operations

- Keep Supabase pointed at the verified Brevo SMTP relay and keep SMTP secrets
  in Supabase only; this repository must never contain them.
- Disable Brevo click/link rewriting for Auth messages. Rewritten confirmation
  links can be consumed by inbox scanners before the reader taps them. The
  magic-link template includes the one-time code as a fallback.
- Maintain exactly one SPF TXT record. Brack currently receives mail through
  Cloudflare Email Routing and signs outbound Auth mail with Brevo DKIM; follow
  Brevo's domain-status screen instead of adding a second SPF record.
- Check delivered message headers for aligned DKIM and DMARC before tightening
  DMARC beyond monitoring mode. Confirm that `support@brack-app.com` is an
  active Cloudflare Email Routing address before advertising it to users.
- Treat `npm run auth:emails:check` as the hosted drift check after every Auth
  template or Supabase Dashboard change.
