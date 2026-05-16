# Runbook: Deactivate legacy plaintext `api_keys_legacy` rows

**Status:** owner-auth required. Do NOT execute the SQL in this document without explicit Chris approval and an authenticated owner session.

Closes UnClick todo "SECURITY: deactivate legacy plaintext api_keys_legacy rows after owner auth" (Priority-1 safety).

## Why

Live database evidence (2026-05-08) shows `api_keys_legacy` still has 3 active plaintext rows. The encrypted replacement table is in use; tracked code references appear absent. Until the plaintext rows are deactivated, there's a residual risk surface — a leaked DB snapshot would expose live credentials in clear text.

## Two-phase approach

### Phase A — verify NO live references in the codebase

Run from the repo root:

```bash
node scripts/audit-api-keys-legacy-refs.mjs
# Exit 0 = safe. Exit 1 = references remain; fix them first.
```

If the audit returns exit 1, see the printed list and remove each reference (or refactor to the encrypted table). Do not proceed to Phase B until exit 0.

For machine-readable output (e.g., for CI):

```bash
node scripts/audit-api-keys-legacy-refs.mjs --json > audit.json
```

### Phase B — perform the deactivation (owner-auth required)

> ⚠ **Chris-only step. Requires authenticated owner session against the production database. Do NOT delegate to an autopilot seat.**

**B1. Confirm the row count one more time on production.** Don't trust stale dashboards:

```sql
SELECT COUNT(*) AS active_legacy_rows FROM api_keys_legacy WHERE deactivated_at IS NULL;
```

**B2. Snapshot before changing anything.** This is a *defence-in-depth* step. The legacy rows may need to be retrievable for forensic reasons even after deactivation.

```sql
-- Snapshot table — keeps a copy of every row about to be deactivated, with a timestamp.
CREATE TABLE IF NOT EXISTS api_keys_legacy_archive_2026_05_15 AS
SELECT *, NOW() AS archived_at
FROM api_keys_legacy
WHERE deactivated_at IS NULL;

-- Quick sanity check on the snapshot.
SELECT COUNT(*) FROM api_keys_legacy_archive_2026_05_15;
```

**B3. Soft-deactivate (do NOT delete).** Soft-deactivation lets the rows still exist for forensic / rollback purposes but invalidates them as credentials.

```sql
-- DO NOT EXECUTE WITHOUT OWNER AUTH
BEGIN;
  UPDATE api_keys_legacy
  SET deactivated_at = NOW(),
      key            = NULL,           -- zero out plaintext immediately
      deactivation_reason = 'security_decommission_2026_05_15'
  WHERE deactivated_at IS NULL;
COMMIT;
```

If your schema has a different plaintext column name (`api_key`, `secret`, `value`...), substitute. If the table has cascading FKs from active sessions, run a quick `SELECT` first to confirm what would break before committing.

**B4. Post-verify.**

```sql
SELECT COUNT(*) AS still_active FROM api_keys_legacy WHERE deactivated_at IS NULL;
-- Expected: 0

SELECT id, deactivated_at, deactivation_reason FROM api_keys_legacy ORDER BY id;
-- Expected: every row has a non-null deactivated_at.
```

**B5. Schedule a hard-delete window.** Soft-deactivate solves the immediate security gap. For a clean kill, schedule a follow-up after 30 days (so forensic queries still work) to drop the rows entirely. Create a calendar reminder and a UnClick todo titled "SECURITY: hard-delete api_keys_legacy archive after 30-day soft-deactivate window".

## Rollback (if anything breaks)

```sql
-- ONLY if a live system unexpectedly broke after B3.
BEGIN;
  UPDATE api_keys_legacy AS l
  SET deactivated_at = NULL,
      key = a.key,
      deactivation_reason = NULL
  FROM api_keys_legacy_archive_2026_05_15 AS a
  WHERE l.id = a.id;
COMMIT;
```

This restores plaintext from the archive. Use only if absolutely necessary. The minute it's restored, the security gap re-opens — fix the breakage and re-deactivate immediately after.

## Acceptance

- [x] Audit script exists, exits 0 when codebase is clean.
- [x] Audit script tests cover the live-ref / docs-ref / clean / ignored-dirs cases.
- [ ] Phase A audit on `feat/audit-api-keys-legacy` branch returns exit 0 (Chris runs locally).
- [ ] Phase B SQL executed by Chris on production with owner auth (date this).
- [ ] Phase B4 post-verify shows 0 still-active rows.
- [ ] Follow-up todo created for hard-delete after 30 days.

## What I'm explicitly NOT doing

- I am NOT running the SQL.
- I am NOT proposing to run the SQL via any autopilot lane. Database destructive changes are explicitly outside the executor lane's CommonSensePass (rank-20 protected-surface category).
- I am NOT skipping the snapshot step. Even when "everything looks fine," do the snapshot — the marginal cost is seconds, the rollback value is enormous.

## Source

Drafted 2026-05-15 by `claude-cowork-coordinator-seat`. Files in `Z:\Other computers\My laptop\G\CV\_unclick-drafts\api-keys-legacy-deactivation\`.
