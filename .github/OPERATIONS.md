# Operations & Automation

What's automated, what secrets are required, and what to do when something goes red.

## CI/CD at a glance

| Workflow | Trigger | What it does |
|---|---|---|
| `ci.yml` | PRs + push to main | Lint + build the website, typecheck + build the MCP server |
| `testpass-pr-check.yml` | PRs | Runs the shared TestPass action against the MCP endpoint under test and posts a receipt summary |
| `testpass-scheduled-smoke.yml` | Every 5 minutes + manual dispatch | Runs scheduled TestPass smoke with explicit token precedence and fail-closed infra reporting |
| `dogfood-report.yml` | Nightly schedule + manual dispatch | Rebuilds `public/dogfood/latest.json` with honest passing / blocked / pending proof status |
| `event-wake-router.yml` | `issue_comment` + workflow fan-in | Routes ready-work wake events without waking healthy quiet cycles |
| `auto-close-fishbowl-todo.yml` | PR merge hooks | Closes linked Fishbowl todos when a merged PR satisfies them |
| `publish-mcp-package.yml` | Push to main touching `packages/mcp-server/**` | Bumps patch version, publishes `@unclick/mcp-server` to npm, tags the commit |
| `apply-migrations.yml` | Push to main touching `supabase/migrations/**` | Runs `supabase db push` against production |
| `dependabot.yml` | Weekly schedule | Opens PRs for npm + GH Actions updates, grouped sensibly |

Vercel auto-deploys the website on any push to main. No workflow needed for that.

## Required GitHub secrets

Set these at **Settings → Secrets and variables → Actions → Repository secrets**.

| Secret | Used by | Where to get it |
|---|---|---|
| `TESTPASS_TOKEN` | `testpass-pr-check.yml`, `dogfood-report.yml` TestPass proof | Active TestPass bearer for `/api/testpass-run` |
| `TESTPASS_CRON_SECRET` | `testpass-scheduled-smoke.yml` first-choice token | Optional dedicated scheduled-smoke bearer for `/api/testpass-run` |
| `UXPASS_TOKEN` | `dogfood-report.yml` UXPass proof | Active UXPass bearer for `/api/uxpass-run` |
| `CRON_SECRET` | `testpass-scheduled-smoke.yml` fallback, `dogfood-report.yml` UXPass fallback | Shared cron bearer when a dedicated pass token is not set |
| `NPM_TOKEN` | `publish-mcp-package.yml` | npm → Account → Access Tokens → Create Automation token (Bypass 2FA) |
| `SUPABASE_ACCESS_TOKEN` | `apply-migrations.yml` | https://supabase.com/dashboard/account/tokens |
| `SUPABASE_PROJECT_REF` | `apply-migrations.yml` | The subdomain from `xxxxx.supabase.co` |
| `SUPABASE_DB_PASSWORD` | `apply-migrations.yml` | Supabase dashboard → Settings → Database |

`GITHUB_TOKEN` is provided automatically; no setup needed.

## Pass-family credential precedence

These proof workflows are intentionally explicit about which token they use.
If a receipt says `blocked`, prefer fixing the missing secret path instead of
papering over the status.

### `testpass-scheduled-smoke.yml`

Scheduled TestPass smoke uses this precedence:

1. `TESTPASS_CRON_SECRET`
2. `CRON_SECRET`
3. `TESTPASS_TOKEN`

This keeps the scheduled lane fail-closed while still allowing a shared cron
bearer or the normal TestPass bearer as a fallback.

### `dogfood-report.yml`

Nightly dogfood splits the proof lanes on purpose:

| Proof lane | Secret precedence | Notes |
|---|---|---|
| TestPass | `TESTPASS_TOKEN` | Exported into the script as `DOGFOOD_TESTPASS_TOKEN`; no cron fallback in the current workflow |
| UXPass | `UXPASS_TOKEN`, then `CRON_SECRET` | Exported into the script as `DOGFOOD_UXPASS_TOKEN`; a blocked receipt is expected if neither secret exists |

The public receipt at `public/dogfood/latest.json` should stay honest:

- `passing` only when the live scheduled check actually completed.
- `blocked` when the workflow cannot run because a secret path is missing.
- `pending` for proof families that are intentionally scaffolded but not live yet.

## Runtime env vars

Everything the app + serverless functions need at runtime lives in Vercel
(Settings → Environment Variables). Keep `.env.local.example` in sync with
anything added.

| Variable | Scope | Purpose |
|---|---|---|
| `VITE_SUPABASE_URL` | Frontend | Website Supabase client |
| `VITE_SUPABASE_ANON_KEY` | Frontend | Website Supabase client |
| `SUPABASE_URL` | Serverless | Server-side Supabase client |
| `SUPABASE_SERVICE_ROLE_KEY` | Serverless | Server-side Supabase (elevated) |
| `RESEND_API_KEY` | Serverless | Outbound email (bug reports, dev notifications) |
| `ADMIN_NOTIFICATION_EMAIL` | Serverless | Inbox for internal notifications |

## Adding a database migration

1. Drop the SQL into `supabase/migrations/<timestamp>_<name>.sql`.
2. Commit and merge to main.
3. `apply-migrations.yml` runs `supabase db push` automatically.

If the workflow fails (e.g. schema drift) the run logs show the exact SQL
error. Fix the migration, push again. The CLI is idempotent about already
applied migrations.

As a belt-and-braces safety net, `api/install-ticket.ts` also self-heals its
table via `ensureSchema()` on cold start, so even a missed migration won't
break install-ticket issuance.

## Publishing the MCP server

No manual steps. Change anything under `packages/mcp-server/`, merge to main,
workflow:

1. Builds the TypeScript.
2. Runs `npm pack --dry-run` so `files:` errors surface before publish.
3. Bumps patch (`0.3.0 → 0.3.1`), pushes the bump commit + tag with
   `[skip ci]` so it doesn't loop.
4. `npm publish --access public`.
5. Polls `npm view` to confirm propagation.

To cut a minor or major release, bump manually in `packages/mcp-server/package.json`
and push, the workflow will still publish (its `npm version patch` becomes a
no-op if the working tree is dirty, but simpler: just skip the workflow by
including `[skip ci]` in your message and running `npm publish` locally).

## When CI goes red

1. **`ci.yml` lint/build failure** - fix in the PR, push again.
   - If the error is `npm ci` lockfile mismatch on a Dependabot PR (often `Missing: esbuild@... from lock file`), treat it as lockfile drift.
   - Resolve by rebasing the Dependabot branch onto latest `main` first. If still failing, run `npm install --no-audit --no-fund`, commit the lockfile refresh to the Dependabot branch, then rerun checks.
   - Do not patch around this by loosening CI from `npm ci` to `npm install`.
2. **`testpass-pr-check.yml` or `testpass-scheduled-smoke.yml` 401/403** - token precedence resolved to an expired or wrong bearer.
   - Scheduled smoke checks `TESTPASS_CRON_SECRET`, then `CRON_SECRET`, then `TESTPASS_TOKEN`.
   - Dogfood TestPass uses `TESTPASS_TOKEN`.
   - Dogfood UXPass uses `UXPASS_TOKEN` first, then `CRON_SECRET`.
   - If `public/dogfood/latest.json` flips to `blocked`, treat that as honest evidence and refresh the missing secret instead of forcing a green status.
3. **`publish-mcp-package.yml` 401/403** - `NPM_TOKEN` expired or wrong type.
   Generate a new **Automation** token (not Classic) and update the secret.
4. **`apply-migrations.yml` link failure** - the access token may have been
   rotated. Regenerate at https://supabase.com/dashboard/account/tokens.
5. **`apply-migrations.yml` migration error** - open the run logs. If it's a
   destructive change we don't want automated, revert the migration commit
   and apply it manually via the SQL editor instead.

## Manual escape hatches

Most live workflows here, including publish, migrations, scheduled TestPass,
and dogfood report, accept `workflow_dispatch`, so you can re-run them from
the Actions tab without needing a new commit.

## Proof PR review checklist

Proof and reliability PRs should not merge on green CI alone. Before marking
one ready, make the missing proof explicit:

1. Confirm the diff only touches the expected files.
2. Run the narrow local test command for the package or script under review.
3. If the local command cannot run, explain why and point to the equivalent CI
   job that covered the same code path.
4. Check that public receipts stay honest: `passing` means a live check ran,
   `blocked` means an action is needed, and `pending` means the proof is not
   live yet.
5. Check that logs, JSON receipts, docs, and review comments do not expose raw
   secrets, token prefixes, auth headers, cookies, or provider response bodies.
6. Leave the PR draft or HOLD if any proof is incomplete, even when the visible
   checks are green.
