# Desktop Packaging

Brack now has an Electron desktop target in addition to the web/PWA and Capacitor iOS/Android targets.

## Runtime Model

- Renderer: the shared Vite/React app in `apps/client/src/`.
- Desktop shell: Electron main/preload code in `apps/desktop/src/`.
- Desktop build output: `apps/desktop/dist/`.
- Packaged renderer files: copied from `apps/client/dist` into app-root `dist/` by `electron-builder.yml`.
- Bundled app protocol: `brack-app://brack/`.
- Deep link protocol: `brack://`.
- Auth callback URLs: `brack://auth/callback` and `brack://auth/reset-password`, shared with Capacitor mobile.

The renderer must not import Node or Electron directly. Desktop-only capabilities are exposed through the typed `window.brackDesktop` preload bridge and consumed through app services such as `apps/client/src/services/platform.ts` and `apps/client/src/services/local/driver.ts`.

## Offline Storage

Desktop uses native SQLite through Electron IPC:

- Database file: `brack_offline.sqlite` under Electron `app.getPath("userData")`.
- Driver: `ElectronSQLiteLocalDriver`, behind the same `LocalDriver` interface used by Dexie and Capacitor SQLite.
- IPC allows only whitelisted local database operations. It does not expose arbitrary SQL to the renderer.

The desktop SQLite schema mirrors the mobile local schema for:

- `books`
- `reading_sessions`
- `progress_logs`
- `journal_entries`
- `goals`
- `profile_preferences`
- `outbox`
- `sync_state`

## Scripts

```bash
npm run desktop:typecheck
npm run desktop:build
npm run desktop:rebuild
npm run desktop:dev
npm run desktop:pack
npm run desktop:dist
npm run desktop:dist:win
npm run desktop:dist:mac
npm run desktop:dist:mac:arm64
npm run desktop:dist:mac:x64
npm run desktop:dist:linux
```

Use `desktop:rebuild` when local Electron development cannot load the native `better-sqlite3` module after dependency or Electron version changes.

## Brand Assets

Desktop package icons use the fixed Brack app mark, not the full wordmark:

- Windows installer/executable: `resources/icon.ico`
- macOS app bundle: `resources/icon.icns`
- Linux/AppImage/deb: `resources/linux-icons/`
- Runtime window icon: `resources/icon.png`

The source artwork is the Brack `B` mark on the orange app field. Regenerate desktop and Capacitor launcher icons with:

```bash
npm run brand:icons
```

In-app logos remain theme-aware through `apps/client/src/components/ThemeAwareLogo.tsx`; packaged app icons stay fixed so they remain legible in light and dark operating-system launchers.

## Packaging Targets

Unsigned internal artifacts are built with `electron-builder`:

- Windows 10/11 x64: NSIS installer.
- macOS Apple Silicon: dmg and zip.
- macOS Intel: dmg and zip.
- Linux/Ubuntu x64: AppImage and deb.

Artifacts are written to `release/desktop/`.

Linux `.deb` artifacts require package maintainer metadata. Brack sets this through both `package.json` author metadata and `linux.maintainer` in `electron-builder.yml`.

## CI

The `build-desktop` GitHub Actions job builds unsigned artifacts on:

- `windows-latest`
- `ubuntu-22.04`
- `macos-latest`
- `macos-15-intel`

The job runs `npm ci`, `npm run desktop:typecheck`, and one explicit architecture script per matrix entry:

- Windows x64: `npm run desktop:dist:win`
- Linux x64: `npm run desktop:dist:linux`
- macOS Apple Silicon: `npm run desktop:dist:mac:arm64`
- macOS Intel: `npm run desktop:dist:mac:x64`

It then uploads `release/desktop/**/*`.

## Supabase Configuration

Supabase Auth must allow these redirect URLs for desktop and web:

```text
brack://auth/callback
brack://auth/reset-password
https://brack.app/auth/callback
https://brack.app/auth/reset-password
http://localhost:8080/auth/callback
http://localhost:8080/auth/reset-password
http://127.0.0.1:8080/auth/callback
http://127.0.0.1:8080/auth/reset-password
http://127.0.0.1:8081/auth/callback
http://127.0.0.1:8081/auth/reset-password
```

If Edge Function CORS is restricted with `ALLOWED_ORIGINS`, include the desktop app origin:

```text
brack-app://brack
```

Keep service role keys and CLI tokens out of desktop/browser-exposed variables. Desktop uses the same `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` as web.

## Security Rules

- Electron renderer runs with `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`, and `webSecurity: true`.
- External navigation is blocked unless it is internal app navigation or an HTTPS URL opened through the system browser.
- IPC requests are accepted only from the Brack renderer window.
- Native SQLite operations validate operation names and table names before touching the database.

## Manual QA

Test these flows on Windows, macOS Intel, macOS Apple Silicon, and Ubuntu:

1. Install and launch the unsigned artifact.
2. Sign in with email and Google.
3. Confirm `brack://auth/callback` returns to the app.
4. Request a password reset and confirm `brack://auth/reset-password` opens the reset screen.
5. Resize desktop, tablet, and phone-width windows.
6. Load library online, go offline, restart, add/delete a book, log progress, finish a timer, create journal entries/goals, reconnect, and confirm sync drains.
7. Open a non-auth deep link such as `brack://book/{id}`.
