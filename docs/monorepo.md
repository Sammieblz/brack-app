# Monorepo and Turborepo

Brack is an npm-workspace monorepo orchestrated by Turborepo. The repository still ships one shared React renderer across web, Capacitor mobile, and Electron desktop; the workspace split exists to make build ownership, type checking, packaging, and CI easier to reason about.

## Workspace Layout

```
brack-app/
|-- apps/
|   |-- client/              # @brack/client: Vite React renderer
|   |-- mobile/              # @brack/mobile: Capacitor config and commands
|   `-- desktop/             # @brack/desktop: Electron main/preload source
|-- packages/
|   `-- typescript-config/   # @brack/typescript-config: shared TS configs
|-- android/                 # Root native Android project, referenced by apps/mobile
|-- ios/                     # Root native iOS project, referenced by apps/mobile
|-- supabase/                # Root-managed migrations, config, and Edge Functions
|-- resources/               # Desktop/mobile icon and splash assets
|-- assets/                  # Source brand assets
|-- package.json             # Root scripts, npm workspaces, packageManager
|-- package-lock.json        # Canonical lockfile
`-- turbo.json               # Task graph, cache rules, env inputs
```

## Package Ownership

| Workspace | Package | Owns | Does not own |
| --- | --- | --- | --- |
| `apps/client` | `@brack/client` | React source, Vite, Tailwind, PostCSS, shadcn config, public assets, web build output | Native projects, Supabase migrations/functions, Electron main process |
| `apps/mobile` | `@brack/mobile` | `capacitor.config.ts` and Capacitor commands | `android/`, `ios/`, renderer source |
| `apps/desktop` | `@brack/desktop` | Electron `main`, `preload`, desktop SQLite IPC, desktop TypeScript config | Renderer source, packaged web assets |
| `packages/typescript-config` | `@brack/typescript-config` | Shared base/client/desktop TypeScript compiler options | Application source |

The renderer stays in `apps/client/src`. Do not create shared packages until there is a proven boundary; moving code too early makes platform code harder to ship.

## Root-Owned Assets

Some folders intentionally remain outside `apps/*`:

- `supabase/` stays at the root because the Supabase CLI expects project config, migrations, and functions from a single project directory.
- `android/` and `ios/` stay at the root because they are generated/native projects with Gradle, Xcode, CocoaPods, Firebase, and signing state. `apps/mobile/capacitor.config.ts` points back to them with `android.path: "../../android"` and `ios.path: "../../ios"`.
- `resources/` and `assets/` stay at the root because desktop and mobile packaging both consume them.

## Package Manager

npm is canonical.

- Root `package.json` declares `packageManager: "npm@11.3.0"`.
- Root `package.json` declares `workspaces: ["apps/*", "packages/*"]`.
- `package-lock.json` is committed and is the only lockfile.
- `bun.lockb` is retired; do not reintroduce Bun as a second package manager.

Use `npm ci` in CI and clean validation. Use `npm install` for local dependency changes.

## Common Commands

Run commands from the repository root unless noted otherwise.

| Task | Command | Notes |
| --- | --- | --- |
| Web dev server | `npm run dev` | Runs `@brack/client#dev` through Turbo on port 8080. |
| Web build | `npm run build` | Builds `apps/client/dist`. |
| Type check all workspaces | `npm run check-types` | Turbo runs package checks against the task graph. |
| Lint all workspaces | `npm run lint` | Runs package lint scripts through Turbo. |
| Preview web build | `npm run preview` | Serves the built client. |
| Mobile sync | `npm run cap:sync` | Builds `@brack/client` first, then runs Capacitor sync from `apps/mobile`. |
| Android sync | `npm run cap:sync:android` | Uses root `android/`. |
| iOS sync | `npm run cap:sync:ios` | Uses root `ios/`. |
| Desktop typecheck | `npm run desktop:typecheck` | Type checks `apps/desktop`. |
| Desktop build | `npm run desktop:build` | Emits `apps/desktop/dist`. |
| Windows desktop package | `npm run desktop:dist:win` | Builds client and desktop first, then runs `electron-builder`. |

## Turbo Task Graph

`turbo.json` is the source of truth for orchestration:

- `build` caches `dist/**` outputs inside each package.
- `check-types` and `lint` depend on the `transit` task so workspace dependency order is respected without forcing package builds.
- `dev` and `preview` are persistent and uncached.
- Capacitor sync tasks are uncached because they mutate native projects.
- Desktop packaging tasks are uncached because they write installer artifacts and depend on both `@brack/client#build` and `@brack/desktop#build`.
- Global cache inputs include `.env`, `.env.*`, `package-lock.json`, `NODE_ENV`, `VITE_*`, CI, and desktop signing variables.

Useful inspection commands:

```bash
npx turbo run build check-types --dry=json
npx turbo run build check-types
npx turbo run build check-types
```

The second full run should show cache hits for unchanged cacheable tasks. Remote caching is intentionally disabled for the first Turborepo implementation; local and GitHub Actions `.turbo/cache` are enough for now.

## Build Outputs

| Output | Path | Produced by |
| --- | --- | --- |
| Web/PWA static files | `apps/client/dist` | `@brack/client#build` |
| Electron main/preload files | `apps/desktop/dist` | `@brack/desktop#build` |
| Desktop installers/packages | `release/desktop` | root desktop packaging tasks |
| Capacitor copied web assets | Native platform folders under `android/` and `ios/` | `@brack/mobile#sync*` |

Electron packaging copies `apps/client/dist` into the packaged app as app-root `dist/`, preserving the main-process expectation in the packaged runtime.

## CI

GitHub Actions runs Turbo-backed commands on every push to `main` and every pull request:

- `npm ci`
- `npm run lint`
- `npm run check-types`
- `npm run build`
- `npm run cap:sync:android`
- `npm run cap:sync:ios`
- `npm run desktop:typecheck`
- platform-specific `desktop:dist:*` packaging jobs

The workflow caches npm packages through `actions/setup-node` and caches Turborepo state at `.turbo/cache`. There are no Vercel Remote Cache secrets in CI.

## Supabase Boundary

Turborepo does not run the backend by default. Supabase remains root-managed:

- Migrations live in `supabase/migrations`.
- Edge Functions live in `supabase/functions`.
- Function JWT settings live in `supabase/config.toml`.
- Deploy functions with `npx supabase functions deploy --project-ref waftnaqgkcgufzapcihe --use-api`.

Backend validation should be added to CI as a separate Supabase job when we are ready to enforce migration/function drift checks.

## References

- [Add Turborepo to an existing repository](https://turborepo.dev/docs/getting-started/add-to-existing-repository)
- [Structuring a repository](https://turborepo.dev/docs/crafting-your-repository/structuring-a-repository)
- [Configuring tasks](https://turborepo.dev/docs/crafting-your-repository/configuring-tasks)
- [Configuration reference](https://turborepo.dev/docs/reference/configuration)
- [Run command reference](https://turborepo.dev/docs/reference/run)
