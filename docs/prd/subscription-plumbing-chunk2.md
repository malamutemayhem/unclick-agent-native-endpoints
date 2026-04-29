# Subscription Plumbing Chunk 2

**Status**: Draft
**Last updated**: 2026-04-29
**Owner**: `🦾`
**Purpose**: Lock the subscription-plumbing scope contract before implementation or packaging expands

## Why this exists

Subscription plumbing needs a clear boundary before entitlement wiring, pricing UI, or billing rails spread across the product.

This chunk defines:

- what subscription plumbing is allowed to represent
- what account and entitlement state it must expose
- what it must explicitly decline to promise
- what banner language should stay visible while billing is scaffolded but not live

This is a doc-first scope lock, not an implementation PR.

## One-sentence definition

Subscription plumbing is the entitlement layer that records which UnClick route a customer is on and which product surfaces that route unlocks.

It is not a claim that paid billing, charging, invoicing, or live plan enforcement is already active.

## Product posture

Subscription plumbing should feel:

- explicit
- conservative in claims
- easy to audit
- honest about scaffolding status

Subscription plumbing should not feel:

- like a live billing system before one exists
- like a pricing-page promise engine
- like a vague future placeholder with no entitlement meaning
- like a hidden paywall toggle with unclear rules

## Core promise

Subscription plumbing promises:

1. it will represent a defined route for a defined customer or tenant boundary
2. it will expose which Pass or platform surfaces that route is meant to unlock
3. it will distinguish scaffolded free-routing state from future paid-billing state
4. it will preserve enough context that later billing activation does not require guessing what a route meant
5. it will stay compatible with UnClick's subscription-only billing posture rather than implying that UnClick proxies or meters LLM token usage

Subscription plumbing does not promise:

1. that customers are being charged today
2. that invoices, tax handling, proration, or refunds are live
3. that every future monetization edge case is solved in this first contract
4. that a route state alone is legal proof of payment
5. that future pricing, packaging, or Stripe semantics are locked forever

## Disclaimer banner

This should mirror the LegalPass pattern: plain language, always visible, hard to misread.

### Banner headline

`Subscription routes are scaffolded, but billing is not active yet.`

### Banner body

`UnClick can represent Master UnClick, individual Pass, and Family Pass bundle routes for entitlement testing during scaffolding. These routes do not yet imply live charging, invoice history, tax handling, or production billing enforcement.`

### Compact variant

`Scaffolding mode only. Routes exist for entitlement wiring, not live billing.`

## Locked route types

For this phase, Chunk 2 locks three subscription route shapes:

### 1. Master UnClick

- top-level platform route
- intended to unlock the full UnClick product family when enabled
- should be modeled distinctly from buying multiple individual Passes

### 2. Individual Pass subscription

- one route per Pass product
- should unlock only the named Pass and whatever shared platform capabilities are explicitly included
- must not silently imply Family Pass or Master UnClick breadth

### 3. Family Pass bundle

- one route that unlocks a defined bundle of Pass products
- broader than one individual Pass
- narrower than Master UnClick unless explicitly promoted later

These are route shapes, not final public tier names, price points, or checkout objects.

## Scaffolding rule

During scaffolding:

- all routes are free for scaffolding and entitlement testing
- no route should imply that money changed hands
- no user-facing copy should describe a route as a paid active tier
- no codepath should require real billing success before route state can be tested

This means the system may represent entitlements before it represents real commerce.
It is not a customer-facing promise that launch pricing will stay free forever.

## Required subscription artifact

Every subscription route record or API payload must show five things:

1. **Subject**
   - exact user, org, workspace, or api-key owner the route belongs to
2. **Route type**
   - whether the route is Master UnClick, an individual Pass, or a Family Pass bundle
3. **Entitlement scope**
   - exact products or capabilities the route unlocks
4. **Billing mode**
   - explicit indication that the route is in `scaffolding_free` mode until billing goes live
5. **Audit context**
   - when the route was granted, changed, revoked, or migrated

If any of those are missing, the route is incomplete as a product artifact.

## In-scope plumbing areas

Subscription plumbing may define:

### 1. Route identity and ownership

- whether the route is attached to a user, org, or tenant boundary
- how one account is mapped to one active route or a deliberately managed route set
- how route state is represented without pretending that checkout is already solved

### 2. Entitlement mapping

- which Passes or platform surfaces a route unlocks
- whether route-to-product mapping lives in code, config, or a small table
- how future product additions avoid silent entitlement drift

### 3. Scaffolding-mode honesty

- explicit free-routing flags
- user-facing notices that billing is not active yet
- operator-facing admin views that separate route state from payment state

### 4. Audit and transition safety

- grant, revoke, and migration history
- ability to answer "why does this account have access?"
- clear upgrade path from scaffolding routes to later paid billing records

### 5. Product-surface consistency

- same route language across pricing pages, admin views, marketplace tiles, and product surfaces that present access or upgrade state
- no surface implying more access than the route actually grants

## Explicitly out of scope

Subscription plumbing should not claim to cover:

### 1. Live billing operations

- charging cards
- invoicing
- tax calculation
- refunds
- dunning

### 2. Checkout and payment UX completion

- final Stripe checkout flows
- self-serve upgrade and downgrade polish
- coupon systems
- trials

### 3. Revenue recognition and finance reporting

- GAAP or tax reporting
- finance-grade ledger correctness
- payout and reconciliation flows

### 4. Final packaging strategy

- exact public pricing
- launch discount policy
- long-term grandfathering promises
- the final boundary between Family Pass and Master UnClick if strategy changes later

### 5. Provider-billing mediation

- charging for Claude, OpenAI, Gemini, or other model-provider tokens
- proxying user LLM bills through UnClick
- blending entitlement state with token-consumption metering

## State contract

Each route object should expose enough information to answer:

- who the route belongs to
- what route type it is
- what it unlocks
- whether it is scaffolded or tied to future live billing
- whether it is active, inactive, revoked, or migrating
- why an operator would believe this route exists

Each route summary should include:

- one-sentence route description
- included products
- scaffold-versus-live billing note

## Evidence contract

Subscription plumbing should make later auditing easy.

Acceptable evidence may include:

- route change history
- admin-visible grant reason
- source actor for manual changes
- explicit mapping between route and unlocked products
- billing-mode flag showing scaffolding versus live billing

Evidence should avoid:

- magic booleans with no route meaning
- one-off feature flags standing in for a route model
- route names that do not tell operators what access they imply
- hidden coupling between pricing copy and entitlement code

## Status model

Before live billing exists, route status should stay simple:

- `active`: route grants access in scaffolding mode
- `inactive`: route does not grant access
- `revoked`: route was intentionally removed
- `migrating`: route is being changed to a new model or entitlement set

Status should not imply successful payment unless payment state becomes a separate explicit field later.

## Failure modes to avoid

Subscription plumbing should not:

- describe scaffolded routes as paid plans
- mix billing-state truth with entitlement-state truth
- let one Pass subscription silently unlock Family Pass breadth
- let Family Pass silently become Master UnClick by accumulated exceptions
- require future billing implementation to reverse-engineer old route intent
- hide route changes from operators who need to debug access

## What subscription plumbing can claim publicly

Safe claims:

- UnClick can represent multiple subscription route shapes during scaffolding
- route state can determine which product surfaces a customer can access
- all routes are currently free while billing is scaffolded
- future billing can be added on top of a clearer entitlement model

Unsafe claims:

- billing is live
- this account has paid
- invoices and refunds are handled
- Family Pass and Master UnClick are permanently identical
- route state alone is proof of commercial entitlement

## UI and API acceptance bar

Before implementation is called done:

1. every route surface must show scaffolding-free status plainly while billing is inactive
2. every route payload must expose subject, route type, entitlement scope, billing mode, and audit context
3. no pricing, admin, or marketplace copy may imply that a scaffolded route is a paid active subscription
4. Master UnClick, individual Pass, and Family Pass must stay distinct in both naming and entitlement mapping

## Recommended next step

When Chunk 2 is approved, the next implementation slice should add the route model, scaffolding-free banner treatment, and entitlement mapping primitives before any live billing or checkout work begins.
