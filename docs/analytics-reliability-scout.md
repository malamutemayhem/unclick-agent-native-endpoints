# Analytics Reliability Scout

**Status:** Scout note
**Owner:** Analytics / RotatePass / UXPass
**Last updated:** 2026-05-02

## Intent

UnClick analytics has shown very low or inconsistent traffic compared with expectations. This note keeps the next worker from jumping straight into a rebuild without first checking the obvious low-risk causes.

The goal is reliable basic visibility:

- page views
- sign-in and sign-up starts
- sign-in and sign-up completions
- bug reports
- dogfood and Pass proof traffic
- enough referrer/device context to notice breakage

This is not a mandate to build a full analytics product yet.

## Current wiring observed in repo

- `src/main.tsx` calls `initPostHog()`.
- `src/App.tsx` mounts Vercel Analytics and calls the local pageview tracker on route changes.
- `src/lib/posthog.ts` initializes `posthog-js` from `VITE_POSTHOG_KEY`.
- `src/lib/posthog.ts` defaults the host to `https://us.i.posthog.com` when `VITE_POSTHOG_HOST` is not set.
- `src/lib/analytics.ts` sends custom events and `$pageview` to PostHog.
- `src/lib/analytics.ts` also keeps an optional Umami fallback if `window.umami` exists.
- `/admin/analytics` embeds PostHog shared dashboards from `VITE_POSTHOG_DASHBOARD_*` variables.
- System Credentials inventory already tracks `POSTHOG_API_KEY` and `POSTHOG_HOST` as metadata-only operational credentials.

## Likely failure points

Check these before writing new analytics infrastructure:

1. `VITE_POSTHOG_KEY` missing or stale in Vercel.
2. `VITE_POSTHOG_HOST` points at the wrong PostHog ingest host.
3. Vercel build cache still baked an old `VITE_*` value.
4. Ad blockers suppress PostHog requests for many visitors.
5. A reverse proxy or custom analytics subdomain is misconfigured.
6. Dashboard filters are hiding most events.
7. PostHog project/environment mismatch.
8. Browser privacy settings or DNT reduce captures.
9. Only admin/test traffic exists, so production traffic is genuinely low.
10. Old Umami expectations are being compared against new PostHog event names.

## Safe first checks

These are allowed without touching secrets:

- Confirm a fresh production build includes `VITE_POSTHOG_KEY` presence without printing the value.
- Confirm browser network requests go to the expected PostHog host.
- Confirm a live page route emits one `$pageview` event.
- Confirm auth start/completion events are still wired in Login, Signup, and AuthCallback.
- Confirm `/admin/analytics` dashboard links are configured or clearly empty.
- Compare PostHog path filters against the routes currently being tested.
- Add a System Credentials status note that analytics is `untested` unless a recent event receipt exists.

Do not print or store raw PostHog keys.

## What not to do yet

Do not:

- replace PostHog with a custom product in one jump
- add heavy session replay
- add cross-site tracking
- build visitor fingerprinting
- add privacy-sensitive capture without approval
- touch DNS or domains
- write provider settings
- claim analytics is healthy from key presence alone

## First-party analytics MVP, if PostHog remains unreliable

If the basic PostHog path is still unreliable after the safe checks, the smallest first-party MVP should be boring:

- one append-only event endpoint
- server timestamp
- route path
- event name
- anonymous session id
- referrer host only
- device class
- user id only when already authenticated
- no raw IP display
- no keystrokes
- no session replay
- no secret values

Start with only these event names:

- `pageview`
- `signup_started`
- `signup_completed`
- `signin_started`
- `signin_completed`
- `bug_report_started`
- `bug_report_submitted`
- `dogfood_report_viewed`

The first dashboard can be:

- last 24 hours
- last 7 days
- events by route
- sign-up funnel
- auth completion funnel
- dogfood views

## Product fit

Analytics belongs near:

- RotatePass/System Credentials for credential health and ownership.
- UXPass for user friction and flow evidence.
- Dogfood Report for public/internal proof receipts.
- EnterprisePass later, but only as evidence of product observability hygiene, not compliance certification.

## Recommended next chip

Best next implementation slice:

1. Add a read-only analytics health card in System Credentials that says `Untested` unless a recent safe receipt exists.
2. Add a small browser/network checklist to `/admin/analytics` or docs.
3. Only after that, consider a first-party event endpoint.

This keeps the work safe, useful, and reversible.
