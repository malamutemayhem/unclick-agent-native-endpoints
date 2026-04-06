# UnClick API

Hono-based REST API. Runs locally on Node.js, deploys to Cloudflare Workers.

## Quick Start

```bash
# From repo root
npm install

# Start the API (from apps/api)
cd apps/api
npx tsx src/index.ts

# Or from repo root
npm run dev:api
```

Server starts at `http://localhost:3001`.

On first run in dev mode, a test org and API key are seeded automatically:

```
API Key: agt_test_devkey_localdev_00000000000000000000000000
```

## Test

```bash
cd apps/api
npx vitest run
```

## Key Endpoints

```
GET  /health                                  Health check (no auth)
GET  /v1/p/:slug                              Public page render (no auth)

GET  /v1/themes                               List themes
GET  /v1/themes/:id                           Get theme

POST /v1/links/pages                          Create page
GET  /v1/links/pages                          List pages
GET  /v1/links/pages/:id                      Get page
PATCH /v1/links/pages/:id                     Update page
DELETE /v1/links/pages/:id                    Delete page (soft)
POST /v1/links/pages/:id/publish              Publish page
POST /v1/links/pages/:id/duplicate            Clone page

POST /v1/links/pages/:id/links                Add link
GET  /v1/links/pages/:id/links                List links
PATCH /v1/links/pages/:id/links/:link_id      Update link
DELETE /v1/links/pages/:id/links/:link_id     Delete link
POST /v1/links/pages/:id/links/reorder        Reorder links
POST /v1/links/pages/:id/links/batch          Batch operations

GET  /v1/links/pages/:id/analytics            Analytics summary
GET  /v1/links/pages/:id/analytics/timeseries Time series
GET  /v1/links/pages/:id/analytics/referrers  Top referrers
GET  /v1/links/pages/:id/analytics/countries  By country
GET  /v1/links/pages/:id/analytics/devices    By device

PUT  /v1/links/pages/:id/socials              Set social links
GET  /v1/links/pages/:id/socials              Get social links

POST /v1/links/pages/:id/domain               Set custom domain
DELETE /v1/links/pages/:id/domain             Remove domain
GET  /v1/links/pages/:id/domain/verify        Check DNS status

POST /v1/webhooks                             Create webhook
GET  /v1/webhooks                             List webhooks
PATCH /v1/webhooks/:id                        Update webhook
DELETE /v1/webhooks/:id                       Revoke webhook
POST /v1/webhooks/:id/test                    Send test event
GET  /v1/webhooks/:id/deliveries              Delivery log

POST /v1/keys                                 Create API key
GET  /v1/keys                                 List API keys
DELETE /v1/keys/:id                           Revoke API key
```

## Auth

All `/v1/*` endpoints require:

```
Authorization: Bearer agt_live_<key>
```

Rate limits per plan:
- free: 60 req/min
- pro: 300 req/min
- team: 1000 req/min

## Response Envelope

All responses follow this shape:

```json
{
  "data": { ... },
  "meta": {
    "request_id": "req_01HYX...",
    "pagination": { "total": 100, "page": 1, "per_page": 20, "has_more": true }
  }
}
```

Errors:

```json
{
  "error": {
    "code": "not_found",
    "message": "Page not found",
    "details": [{ "field": "slug", "issue": "required" }]
  },
  "meta": { "request_id": "req_01HYX..." }
}
```

## Stack

- **Runtime**: Node.js (local), Cloudflare Workers (prod)
- **Framework**: Hono
- **Database**: PGlite / embedded Postgres (local), Neon (prod)
- **ORM**: Drizzle
- **Validation**: Zod
- **IDs**: ULID
