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
- `supabase/public-schema.lock.json` records typed hashes for the clean public
  schema: relations, columns, constraints, indexes, functions, effective API
  function access, triggers, policies, sequences, enums, and domains. It
  normalizes function line endings so cross-platform checkouts cannot create
  false drift or conceal a semantic change.
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

The August 2026 incident was closed with forward migrations
`20260815015012_repair_bookshelf_schema_drift.sql` and
`20260816001827_reconcile_public_schema_integrity.sql`. The latter reconciles
the remaining index, foreign-key, activity-integrity, private helper, and
trigger-permission differences. Production now has the same 1,753 typed public
catalog objects as a clean replay, with 80 migration versions in exact order.
The closure did not edit or repair-mark any historical version.

## Create and validate a migration

From a current branch based on `main`:

```bash
npm run db:migration:new -- descriptive_name
# Edit the new SQL file and add pgTAP coverage under supabase/tests.
npm run db:migrations:lock
npm run db:schema:lock
node scripts/verify-migration-integrity.mjs --base-ref origin/main
```

Before opening a pull request, run the same database proof as CI:

```bash
npx --no-install supabase start
npx --no-install supabase db reset --local --no-seed
npx --no-install supabase test db --local
npx --no-install supabase db lint --local --level error --fail-on error
```

The Supabase CLI is an exact development dependency. Use `npx --no-install
supabase` or the npm scripts so local work, CI, and deployment use the same
version. Do not install or substitute a floating `latest` CLI in automation.

Automated local and linked migration-history checks use the pinned Supabase CLI
2.114.0 machine contract: `supabase migration list --<target> --output-format
json`. The verifier parses only the JSON payload written to stdout and treats
stderr as diagnostic output. It fails closed when the command exits nonzero or
when stdout is empty, malformed, or does not satisfy the expected migration
schema. Automation must never parse the CLI's human-readable tables because
their formatting is agent-sensitive and may change between terminal contexts.
Use `--output-format json` specifically; the legacy `--output json` flag is a
different output mechanism and does not provide this migration-list contract.
The production-contract and schema-fingerprint query wrappers also request
`--output-format json` explicitly. Their validators accept the two JSON payload
shapes emitted by the pinned CLI in ordinary and agent-aware environments,
then validate every row; any other payload shape remains a hard failure.

Generate the schema lock only after a clean reset. When the migration changes
after review, regenerate both locks and rerun the proof. CI recreates the
database and refuses a schema lock that was generated from ad-hoc local state.
The migration lock command will not permit a previously locked base migration
to be silently rewritten.

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
4. Compares the replayed catalog with the committed typed schema fingerprint.
5. Runs all pgTAP contracts and database lint at error severity.

The production workflow then:

1. Requires the protected `production` GitHub environment.
2. Verifies that remote migration history is an exact ordered prefix of the
   reviewed local ledger.
3. previews `supabase db push --dry-run`;
4. applies the pending migrations once;
5. requires remote history to equal the local ledger; and
6. verifies read-only production contracts for data backfills, protected
   functions, RLS, constraints/indexes, Storage, and Realtime; and
7. compares the linked catalog with the same typed schema fingerprint and fails
   on missing, unexpected, or changed objects.

The fingerprint intentionally compares effective `anon`, `authenticated`, and
`service_role` function execution instead of raw ACL text. Supabase-managed
default grants can be represented differently between local and hosted
Postgres even when effective access is identical. Security-sensitive data,
Storage, Realtime publications, RLS, grants, constraints, and indexes are also
covered by the read-only production contracts and pgTAP suite.

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
   clean post-deployment schema fingerprint comparison.

Use history repair only during an explicitly reviewed incident where the actual
schema is already known to match the target state and only the ledger is wrong.
Record the evidence, commands, operator, and affected version in the incident
report.
