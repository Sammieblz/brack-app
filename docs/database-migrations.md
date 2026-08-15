# Database migration integrity

Brack treats `supabase/migrations` as an append-only release ledger. A migration
is not complete merely because its version appears in Supabase migration
history: the pipeline also replays the ledger from an empty PostgreSQL 17
database and compares the linked schema with that replay after deployment.

## Invariants

- One file represents one immutable migration version.
- Filenames use `<UTC timestamp>_<lowercase_snake_case>.sql`.
- Every new timestamp is greater than the newest migration already on the base
  branch. Never insert a migration into the middle of history.
- `supabase/migrations.lock.json` records the filename and SHA-256 digest of
  every migration. A merged migration may not be renamed, edited, or deleted.
- Production schema changes are made only through a reviewed migration. Do not
  use the Dashboard SQL editor, direct `psql`, `db pull`, or schema-changing RPCs
  as a second deployment path.
- Only the protected database deployment workflow may run `db push` against
  production. It is serialized so two releases cannot migrate concurrently.
- Production database credentials belong only to the protected GitHub
  environment; do not retain them in developer shells or alternate automation.

The historical bookshelf migration was forward-ordered relative to its parent
commit, so timestamp validation alone would not have caught it. The
post-deployment schema and production-contract checks are the controls that
detect its actual failure mode: recorded history that does not match deployed
DDL or data invariants. Once merged, the checksum lock also prevents the old
file from being silently rewritten during a repair.

## Create and validate a migration

From a current branch based on `main`:

```bash
npm run db:migration:new -- descriptive_name
# Edit the new SQL file and add pgTAP coverage under supabase/tests.
npm run db:migrations:lock
node scripts/verify-migration-integrity.mjs --base-ref origin/main
```

Before opening a pull request, run the same database proof as CI:

```bash
npx supabase start
npx supabase db reset --local --no-seed
npx supabase test db --local
npx supabase db lint --local --level error --fail-on error
```

The Supabase CLI is an exact development dependency. Use `npx --no-install
supabase` or the npm scripts so local work, CI, and deployment use the same
version. Do not install or substitute a floating `latest` CLI in automation.

When the migration changes after review, regenerate the lock file and rerun the
proof. The lock command will not permit a previously locked base migration to be
silently rewritten.

## Design migrations for data safety

- Prefer expand/backfill/switch/contract over a single destructive release.
  Deploy compatible columns or tables first, migrate data, switch application
  reads and writes, and remove the old shape only after all clients are safe.
- Add important constraints explicitly. For large existing tables, consider
  adding a check or foreign key as `NOT VALID`, backfilling, then validating it
  in a later controlled step.
- Keep transactions and exclusive locks short. Set an appropriate local
  `lock_timeout` for lock-taking DDL so production traffic fails the migration
  safely instead of hanging indefinitely.
- Make repair and backfill SQL idempotent where practical, but never use that as
  permission to edit or replay an old migration.
- Test invariants, not only object existence: null counts, uniqueness,
  ownership, RLS/grants, function security, and representative writes belong in
  pgTAP tests.
- Before destructive or high-volume work, confirm backups/PITR and a rollback
  or forward-fix procedure. The production environment approval is mandatory.

## Automated release gates

The pull-request workflow performs all of the following on a fresh runner:

1. Verifies filenames, timestamps, checksums, and base-branch immutability.
2. Rejects a migration whose version is not newer than the base branch maximum.
3. Replays every migration into a clean PostgreSQL 17 database.
4. Runs all pgTAP contracts and database lint at error severity.

The production workflow then:

1. Requires the protected `production` GitHub environment.
2. Verifies that remote migration history is an exact ordered prefix of the
   reviewed local ledger.
3. previews `supabase db push --dry-run`;
4. applies the pending migrations once;
5. requires remote history to equal the local ledger; and
6. verifies read-only production contracts for data backfills, protected
   functions, RLS, constraints/indexes, Storage, and Realtime; and
7. fails if a linked public-schema diff remains after deployment.

Configure the GitHub `production` environment with required reviewers, the
`SUPABASE_ACCESS_TOKEN` and `SUPABASE_DB_PASSWORD` secrets, and a protected
`SUPABASE_PROJECT_REF` variable. Branch protection should require the database
integrity check and CODEOWNERS approval for migrations and deployment controls.
Also require branches to be current before merge or use GitHub's merge queue;
the integrity workflow runs for both pull requests and merge groups so two
independently green branches cannot merge migrations out of timestamp order.

## Recovery and history repair

`supabase migration repair` changes migration-history records; it does **not**
execute the SQL in a migration. It is therefore never a normal deployment tool
and is intentionally absent from CI.

If history and schema disagree:

1. Stop automated and manual database deployment.
2. Take or confirm a recoverable backup and preserve diagnostic evidence.
3. Compare the linked schema, migration ledger, and intended invariants.
4. If history says a version is applied but its DDL is absent, create a new,
   forward-only, idempotent repair migration. Do not amend or replay the old
   file, because later migrations may depend on newer function definitions.
5. Add a regression that proves the repaired data and security invariants.
6. Deploy through the protected workflow and require both exact history and a
   clean post-deployment schema comparison.

Use history repair only during an explicitly reviewed incident where the actual
schema is already known to match the target state and only the ledger is wrong.
Record the evidence, commands, operator, and affected version in the incident
report.
