# Operations & Automation

What's automated, what secrets are required, and what to do when something goes red.

## CI/CD at a glance

| Workflow | Trigger | What it does |
|---|---|---|
| `ci.yml` | PRs + push to main | Lint + build the website, typecheck + build the MCP server |
| `publish-mcp-server.yml` | Push to main touching `packages/mcp-server/**` | Bumps patch version, publishes `@unclick/mcp-server` to npm, tags the commit |
| `apply-migrations.yml` | Push to main touching `supabase/migrations/**` | Runs `supabase db push` against production |
| `dependabot.yml` | Weekly schedule | Opens PRs for npm + GH Actions updates, grouped sensibly |

Vercel auto-deploys the website on any push to main. No workflow needed for that.

## Required GitHub secrets

Set these at **Settings → Secrets and variables → Actions → Repository secrets**.

| Secret | Used by | Where to get it |
|---|---|---|
| `NPM_TOKEN` | `publish-mcp-server.yml` | npm → Account → Access Tokens → Create Automation token (Bypass 2FA) |
| `SUPABASE_ACCESS_TOKEN` | `apply-migrations.yml` | https://supabase.com/dashboard/account/tokens |
| `SUPABASE_PROJECT_REF` | `apply-migrations.yml` | The subdomain from `xxxxx.supabase.co` |
| `SUPABASE_DB_PASSWORD` | `apply-migrations.yml` | Supabase dashboard → Settings → Database |

`GITHUB_TOKEN` is provided automatically; no setup needed.

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
2. **`publish-mcp-server.yml` 401/403** - `NPM_TOKEN` expired or wrong type.
   Generate a new **Automation** token (not Classic) and update the secret.
3. **`apply-migrations.yml` link failure** - the access token may have been
   rotated. Regenerate at https://supabase.com/dashboard/account/tokens.
4. **`apply-migrations.yml` migration error** - open the run logs. If it's a
   destructive change we don't want automated, revert the migration commit
   and apply it manually via the SQL editor instead.

## Manual escape hatches

All workflows (publish + migrations) accept `workflow_dispatch`, so you can
re-run them from the Actions tab without needing a new commit.
