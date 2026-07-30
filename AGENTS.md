# Notes for agents working in this repo

Read this before running anything. It exists because `codex exec review` cannot be re-prompted
(`--base` refuses a prompt argument), so this file is the only steering a reviewer gets.

## What this is

A TypeScript/Node CLI toolkit that pulls personal finance data from Monarch Money via the unofficial
community `monarchmoney` client, then emits alerts and HTML email reports (large purchases, budget
status, spending anomalies, new recurring charges, upcoming bills, daily digest, weekly summary). It
runs unattended under macOS `launchd` and maintains a local SQLite warehouse at `~/.mm/data/`.

## Running things

- Install: `npm install` (CI uses `npm ci`), then `cp .env.example .env`.
- Lint: `npm run lint` (`eslint .`). Format check: `npm run format:check` (`prettier --check .`).
- **That check includes markdown**, so this file and the README are CI-gated like the code. Prettier
  rewrites `*em*` to `_em_` and will dedent a list item whose wrapped line starts a code span, so keep
  an inline `` `code` `` on one line. Run `npx prettier --write` on any doc you edit.
- Typecheck: `npm run typecheck` (`tsc --noEmit`).
- Test: `npm test` (`vitest run --passWithNoTests`).
- Entry points: `npm run alerts`, `npm run daily-digest`, `npm run weekly-summary`,
  `npm run test-auth` — or `npx tsx scripts/<name>.ts` directly.
- CI runs, in order: `npm ci` → lint → format:check → typecheck → test. Match that before claiming a
  change is green.
- **There is no build step.** `tsconfig.json` sets `outDir: dist` but nothing invokes `tsc` to emit;
  everything runs through `tsx`. Node 22 is pinned in CI only — there is no `engines` field and no
  `.nvmrc`.

## Things that look like bugs and are not

- **`--passWithNoTests` is deliberate scaffolding**, so CI stays green before a full suite exists. It
  is documented in the workflow. Do not report it as a coverage-hiding trick — but do note that
  deleting the only test file would still pass CI.
- **Several npm scripts point at files that are not in the repo.** `sync`, `sync:backfill`,
  `explore`, `extract-token` target scripts that are gitignored local-only scratch, listed in
  `.gitignore` under a "not published" comment. They exist on this machine, not in a fresh clone.
  (`npm run monarch` → `src/cli.ts` is different: that file does not exist anywhere and is genuinely
  dead script config.)
- **`playwright` is a declared dependency with no imports** in tracked code. It belonged to a
  gitignored login-scraping script. Heavy and unused-looking, but removing it would break local
  scratch tooling.
- **`DEFAULT_START_DATE = "2026-01-01"` in `src/warehouse/queries.ts` is a data-quality decision**,
  not a hardcoded-date bug: pre-2026 data is unreliable because of recategorization churn.
- **`buildIncomeNoiseSql()` filtering is load-bearing.** It strips credit-card payments, self
  transfers matched against `MONARCH_ACCOUNT_HOLDER`, and double-counted ATM check deposits.
  Removing any of it silently corrupts income math — silently is the problem.
- **`src/analysis/`, `src/output/`, `src/types/` are empty placeholders** on disk, untracked by git.
  Not missing files.
- **The `eslint.config.mjs` ignore list duplicates the `.gitignore` local-only list by hand.** The
  comment says it mirrors it. Keeping the two in sync is a real maintenance hazard worth flagging if
  a change touches one and not the other.

## Invariants worth knowing before judging a change

- **Everything sensitive lives outside the repo, under `~/.mm/`, with `0o700` directories and `0o600`
  files** (`src/storage.ts`, and an explicit `chmodSync(DB_PATH, 0o600)` in `db.ts`). Credentials come
  only from a gitignored `.env`. A change that widens those modes, or writes state into the repo, is a
  real regression — check for it.
- **Migrations run implicitly on the first `getDb()`**, tracked in a `schema_migrations` table, with
  SQL read from `src/warehouse/migrations/`. `MIGRATIONS_DIR` is resolved relative to `__dirname`,
  which works under `tsx` from source but would break under a `dist/` build, since `tsc` does not copy
  `.sql` files. Relevant if anyone adds the missing build step.
- **Auth is a three-tier fallback**: cached instance → stored session validated → direct login with
  TOTP, keyed on `MonarchSessionExpiredError`. A change that collapses a tier will look like it works
  right up until a session expires.
- `loadConfig()` / `loadAlertConfig()` call `process.exit(1)` on missing env rather than throwing.
  Fine for a CLI entry point; it makes them unsafe to call from library code or a test.
- `scripts/launchd-run.sh` needs `MONARCH_NODE_BIN` exported because launchd supplies a minimal
  `PATH`, and guards against double runs with marker files in `~/.mm/logs`.

## Where the risk actually is

One test file (`tests/dedup.test.ts`, vitest) covers dedup logic with `src/storage` mocked. Auth,
fetchers, alert rules, warehouse SQL and email templates have **no** coverage. In that test the
`vi.mock` call must precede the imports — that ordering is load-bearing, not a style slip.

The two bug classes to weight most heavily, both learned from a sibling project:

1. **Fail-open** — an error or absence read as success. A failure path that returns something
   indistinguishable from success.
2. **Persistence** — key collision, dedupe, merge, overwrite. Especially relevant here: alert dedupe
   deciding whether a notification has already been sent, and warehouse upserts.
