# Strict Tool Schemas Audit (Tier 1, Chip 3)

**Date:** 2026-04-28
**Scope:** `packages/mcp-server/src/` — all MCP tool schema definitions
**Mode:** Audit only. No code changes in this PR.

## What was checked

For every tool with an `inputSchema`, verify three properties of strict MCP schemas:

1. `additionalProperties: false` declared at the top level of the schema.
2. `required: [...]` correctness — every name in `required` exists as a key in `properties`; no missing or stale names.
3. Enums use `enum: [...]` rather than describing allowed values in prose.

## Where schemas live

| File | Group | Tool count |
|---|---|---|
| `packages/mcp-server/src/server.ts` | `VISIBLE_TOOLS` (memory + Fishbowl + signals) | 28 |
| `packages/mcp-server/src/server.ts` | `INTERNAL_TOOLS` (meta tools, hidden from list) | 4 |
| `packages/mcp-server/src/server.ts` | `DIRECT_TOOLS` (utility direct tools) | 21 |
| `packages/mcp-server/src/tool-wiring.ts` | `ADDITIONAL_TOOLS` (third-party integrations) | 761 |
| **Total** | | **814** |

## Headline finding

**0 of 814 tool schemas declare `additionalProperties: false`.** A grep for `additionalProperties:\s*false` returns zero matches across the entire `packages/mcp-server/src/` tree. The 17 occurrences of `additionalProperties` in `tool-wiring.ts` are all `additionalProperties: true` on nested object-typed property fields (`filter`, `metadata`, `params`, etc.), not strict-schema declarations.

This is a systemic gap rather than a per-tool defect. A single codemod can fix it.

## Findings

### Bulk row (systemic)

| tool_name | file:line | issues | needs_fix |
|---|---|---|---|
| **ALL 814 tool entries** | server.ts + tool-wiring.ts (every `inputSchema:` block) | missing top-level `additionalProperties: false` | yes |

### server.ts (28 visible + 4 internal + 21 direct)

| tool_name | file:line | issues | needs_fix |
|---|---|---|---|
| `save_fact` | server.ts:282 | enum-as-prose: `category` description "preference, decision, technical, contact, project, general" not encoded as `enum` | yes |
| `save_identity` | server.ts:344 | enum-as-prose: `category` description "identity, preference, client, workflow, technical, standing_rule" not encoded as `enum` | yes |
| `unclick_json_format` | server.ts:897 | `indent` field has no `type:` (description "2, 4, or 'tab'") — intentional any-typed but should at minimum be `oneOf`/enum | yes |
| `unclick_color_convert` | server.ts:976 | `color` field has no `type:` (intentional polymorphic) — document via `oneOf` for strict clients | yes |
| `unclick_timestamp_convert` | server.ts:1001 | `timestamp` field has no `type:` (intentional polymorphic) — document via `oneOf` | yes |
| `unclick_kv_set` | server.ts:1027 | `value` field has no `type:` (intentional any-typed) — acceptable but worth annotating | informational |

All other server.ts tools (`load_memory`, `search_memory`, `save_session`, `invalidate_fact`, `check_signals`, `set_my_emoji`, `post_message`, `set_my_status`, `read_messages`, all 11 Fishbowl todo/idea/comment tools, `unclick_search`, `unclick_browse`, `unclick_tool_info`, `unclick_call`, all 21 direct tools) are clean on `required` and `enum` axes — only the systemic `additionalProperties` gap applies.

### tool-wiring.ts — enum-as-prose hotspots (~50 tools)

Description text lists allowed values but no `enum: [...]` is declared. Fixing the two clusters below covers ~25 of these.

**Action-dispatcher cluster (lines 7331-7498)** — `action` parameter drives routing logic. Encoding as enum prevents typo-based silent failures.

| tool_name | file:line |
|---|---|
| `github_action_dispatcher` | tool-wiring.ts:7331 |
| `gitlab_action_dispatcher` | tool-wiring.ts:7355 |
| `clickup_action_dispatcher` | tool-wiring.ts:7377 |
| `linear_action_dispatcher` | tool-wiring.ts:7402 |
| `airtable_action_dispatcher` | tool-wiring.ts:7425 |
| `trello_action_dispatcher` | tool-wiring.ts:7448 |
| `sentry_action_dispatcher` | tool-wiring.ts:7477 |
| `postman_action_dispatcher` | tool-wiring.ts:7498 |

**Payment-integration cluster (lines 6755-7150)** — `action`, `status`, `intent` parameters.

| tool_name | file:line |
|---|---|
| `stripe_subscriptions` | tool-wiring.ts:6795 |
| `stripe_invoices` | tool-wiring.ts:6811 |
| `paypal_invoices` | tool-wiring.ts:6859, 6874 |
| `square_payments` | tool-wiring.ts:6893 |
| `quickbooks_*` | tool-wiring.ts:6977 |
| `plaid_*` | tool-wiring.ts:7032 |
| `woocommerce_orders` | tool-wiring.ts:7116, 7120, 7138, 7143 |

**Other enum-as-prose cases** (one-offs, mechanically convertible):

| tool_name | file:line | field |
|---|---|---|
| `domain_listings` | tool-wiring.ts:1401 | `listingType` "Sale or Rent" |
| `discogs_search_releases` | tool-wiring.ts:1261 | `status` |
| `youtube_upload` | tool-wiring.ts:1968 | `visibility` "public, private, or unlisted" |
| `lastfm_top_tracks` | tool-wiring.ts:2355 | `period` "hour, day, week, month" |
| `string_transform` | tool-wiring.ts:2845 | `transform` |
| `sleeper_trending_players` | tool-wiring.ts:3077 | `type` "add or drop" |
| `deezer_search` | tool-wiring.ts:3126 | `type` |
| `deezer_chart` | tool-wiring.ts:3171 | `type` |
| `color_palette` | tool-wiring.ts:3222 | `type` |
| TMDb search | tool-wiring.ts:3725-3726 | `media_type`, `time_window` |
| `opentdb_questions` | tool-wiring.ts:3774 | `difficulty` |
| `nasa_mars_rover_photos` | tool-wiring.ts:3819 | `rover` |
| `numbersapi` | tool-wiring.ts:4029 | `type` |
| `lichess_*` | tool-wiring.ts:4937 | `perfType` |
| `alphavantage_*` | tool-wiring.ts:5226 | `outputsize` "compact or full" |
| `tomorrow_forecast` | tool-wiring.ts:5618 | `timesteps` "1h or 1d" |
| `reddit_read` | tool-wiring.ts:5743, 5746 | `sort`, `t` |
| `reddit_post` | tool-wiring.ts:5760 | `kind` |
| `reddit_user` | tool-wiring.ts:5805 | `type` |
| `mailchimp_subscribe` | tool-wiring.ts:5832 | `action` "sub or unsub" |
| `telegram_send_media` | tool-wiring.ts:6049 | `media_type` |
| `quickchart_*` | tool-wiring.ts:6200 | `format` |
| `coingecko_*` | tool-wiring.ts:6682, 11010 | `sort_order` |
| `unclick_search` | tool-wiring.ts:7182 | `depth` "quick, standard, or deep" |
| `twilio_call_status` | tool-wiring.ts:7579 | `status` |
| `twilio_send` | tool-wiring.ts:7595 | `channel` |
| `whatsapp_send_media` | tool-wiring.ts:7730 | `media_type` |
| `youtube_search` | tool-wiring.ts:7776, 7778 | `type`, `order` |
| `openai_audio_transcribe` | tool-wiring.ts:9697 | `response_format` |
| `openai_dalle` | tool-wiring.ts:9680-9682 | `quality`, `style`, `response_format` |
| `pinterest_list_boards` | tool-wiring.ts:10009 | `privacy` |
| `speedrun_list_runs` | tool-wiring.ts:10300-10302 | `status`, `orderby`, `direction` |
| `cohere_embed` | tool-wiring.ts:10849 | `input_type` |

### `required` correctness

**No defects observed.** Sampled chunks (lines 1-100, 1530-1570, 3000-3300, 5500-5800, 10000-10300) showed every name in `required:` arrays mapping to a property declaration. The codebase appears uniformly disciplined on this axis. No stale-required, no missing-required defects flagged.

A separate informational pattern: integrations with action-dispatchers (e.g. `paypal_*`, `quickbooks_*`) describe fields as "Required for action='create'" but cannot encode this in JSON Schema's unconditional `required:` array. This is acceptable behavior; conditional requirements would need `oneOf`/`allOf` blocks per action.

## Summary

- **814 tool entries total. 0 declare `additionalProperties: false`.** Single bulk codemod adds it everywhere.
- **~52 tools** describe enum values in prose without `enum: [...]`. ~25 of those live in two clusters (`*_action_dispatcher`, payment integrations); the remaining ~27 are one-offs.
- **0 `required` defects.** That axis is clean across the codebase.
- **2 server.ts memory tools** (`save_fact`, `save_identity`) have enum-as-prose `category` fields that should be tightened.

## Recommended fix order (separate PR)

1. Codemod: add `additionalProperties: false` to every `inputSchema` block. Mechanical, low risk.
2. Convert action-dispatcher and payment cluster `action`/`status` enums (lines 6795-7498). Highest leverage — these are routing keys.
3. Sweep remaining ~27 one-off enum-as-prose cases.
4. Tighten the two server.ts memory `category` fields.
5. Decide whether the 4 polymorphic any-typed fields in `DIRECT_TOOLS` (`indent`, `color`, `timestamp`, `value`) should be encoded as `oneOf` or annotated as intentional any-types.

Strict clients (some MCP gateways and validators) reject schemas without `additionalProperties: false`; once fixed, the surface area for typo'd parameters silently passing through drops to zero.
