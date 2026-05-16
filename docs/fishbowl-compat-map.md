# Boardroom / Fishbowl / Popcorn compatibility map v1

Closes UnClick todo "Architecture QC: Boardroom/Fishbowl compatibility map v1" (child of `87fb888e`).

## Canonical name today

**Boardroom**. This is the name for the worker-coordination chat where seats post ACK/CLAIM, PASS/BLOCKER, handoff, and routing messages. All new code, docs, and UI should use "Boardroom".

## Legacy names

| Legacy name | Era | Status | Action |
|---|---|---|---|
| **Fishbowl** | original API/DB name | deprecated, still load-bearing in some `api/lib/fishbowl-*` files | retire gradually; don't add new references |
| **Popcorn** | UI experiment name | deprecated, mostly gone | retire on sight |
| **Boardroom** | current canonical | active | use everywhere |

## Why three names exist

Refactors happened, but renames in code can be costly when the old name is baked into:

- Database column/table names (cheapest to migrate via a view + rename window, but disruptive)
- API contract field names (breaks consumers; needs compat alias period)
- Wire-format message kinds (`source_kind: "fishbowl"`) — same as above
- Filenames (cheap to rename in code but breaks deep-linked URLs to source on GitHub)

This compat map is the truth source for which legacy names are still load-bearing, where, and what the migration plan is.

## How to use the audit script

```bash
node scripts/audit-fishbowl-naming.mjs --root .
```

The script scans the working tree, groups matches by layer (`api/`, `lib/`, `ui/`, `tests/`, `docs/`, `scripts/`, `other`), and counts both legacy hits and co-occurring "Boardroom" mentions. Files where Fishbowl and Boardroom appear together usually have a compat alias already; files where only Fishbowl appears are the migration targets.

For machine-readable output (e.g., for CI / planning scripts):

```bash
node scripts/audit-fishbowl-naming.mjs --json > fishbowl-audit.json
```

## Migration order (recommended)

1. **UI / docs first** — These have no contract obligations. Renaming `PopcornPanel` → `BoardroomPanel` is a cheap rename + import update. Do these in small PRs (one component at a time) referencing the relevant audit category.
2. **Tests next** — Match test file names to the production name. After UI, the new BoardroomPanel test should be `BoardroomPanel.test.tsx`.
3. **`lib/` helpers** — Internal-only. Rename functions + add a deprecation re-export from the old name for a release window. Drop the re-export after consumers update.
4. **`api/` and wire-format** — Last. These have external contract weight. The pattern is: add a Boardroom-named field alongside the existing Fishbowl-named field, deprecate the old in docs, give consumers a release to migrate, then drop the old field in a major version bump.

Each migration PR should:

- Cite this doc as its source of truth.
- Run `scripts/audit-fishbowl-naming.mjs` before and after.
- Note in its body whether the rename is a pure rename, a co-existing alias, or a contract change.

## Special cases

### `api/fishbowl-*` files

These files are old enough that several tools, scripts, and external docs deep-link into them. Rename strategy:

1. Create the new `api/boardroom-*` file with the same exports.
2. Keep the old `api/fishbowl-*` file as a thin re-exporter for one minor version: `export * from "./boardroom-channels";`
3. Update internal callers to import from the new path.
4. Remove the re-exporter file in the next minor version.

### `source_kind: "fishbowl"` in stored events

Wire-format strings. **Do not change** without an explicit migration plan. Stored Orchestrator events carry this string in historical records; any rename invalidates queries against the archive. Adding `source_kind: "boardroom"` as a new alias is fine; the old value should keep working for reads.

### Test fixtures

Tests that hardcode `"fishbowl"` as a string literal are fine to leave alone if they're asserting against legacy data. New tests should use "boardroom".

## Acceptance (ScopePack 10%)

- [x] `scripts/audit-fishbowl-naming.mjs` exists, exits 0, groups by layer, counts legacy + co-occurring boardroom hits.
- [x] `scripts/audit-fishbowl-naming.test.mjs` covers classification + end-to-end fixture + render output.
- [x] `docs/fishbowl-compat-map.md` (this file) defines canonical name, legacy status, migration order, special cases.

## Non-goals

- This map doesn't *execute* any renames. It documents the policy and provides the audit so others can migrate file-by-file with confidence.
- DB-level renames are explicitly out of scope — they need their own migration plan and owner sign-off.
- Wire-format aliases are out of scope — handled in a separate API-versioning todo if/when needed.

## Source

Drafted 2026-05-15 by `claude-cowork-coordinator-seat`. Files in `Z:\Other computers\My laptop\G\CV\_unclick-drafts\fishbowl-compat-map\`.
