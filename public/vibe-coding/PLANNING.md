# [App Name] — Planning Doc

Fill this in with your AI before writing a single line of code. It takes about 5 minutes. If you skip it, you'll spend that time debugging a misunderstood requirement instead.

---

## What this does (one sentence)

> [AI: help the user write this in plain language — what problem does it solve, and for whom? "An app that shows weather" is not a one-sentence description. "A widget that shows the next 24 hours of Sydney weather so a tradie can decide whether to book outdoor jobs" is.]

---

## Who it's for

> [AI: describe the specific person using this. Not "users" — a real human with a job, a context, and a problem. The more specific you are, the better the decisions you'll make about the UI. E.g.: "A small business owner who checks crypto prices a few times a day but doesn't want to open an exchange — they just want a number."]

---

## The core flow (what happens when it works perfectly)

1. User opens the app and sees...
2. They do X, which causes...
3. The result is...

> [AI: keep this to 5 steps maximum. If the flow needs more than 5 steps to describe, the app is trying to do too much. Suggest cutting scope before building. A good app does one thing clearly — it doesn't need a user manual.]

---

## What can go wrong (and what the user sees)

Don't skip this section. Every UnClick tool call can fail. Plan for it.

- **If the API call fails:** [user sees... — not a stack trace, not "Error", but a sentence a normal person can act on]
- **If there's no data:** [user sees... — empty state copy and any fallback UI]
- **If they're offline:** [user sees... — does the app detect this? Does it cache anything?]
- **If input is invalid:** [user sees... — what validation happens before the API call?]

> [AI: write these states as actual copy. "Something went wrong, please try again." is better than nothing. "Couldn't load weather — check your connection and try again." is better still. Draft real strings here, not placeholders.]

---

## UnClick tools needed

> [AI: list which UnClick tools this app will call. For each one, specify:
> - The tool name (from CLAUDE.md Section 2)
> - What args it needs
> - What data you're pulling from the response
>
> Example:
> - `openweather` — args: `{ city: "Sydney" }` — using: temperature, description, humidity
> - `datetime` — args: `{ format: "relative", timestamp: <unix> }` — using: human-readable time string
>
> If you're not sure which tool to use, check CLAUDE.md Section 2 first. Don't call a tool without knowing its args.]

---

## Mobile layout

> [AI: describe what the screen looks like on a 375px wide phone (iPhone SE). What's visible above the fold? What does the user see before they scroll? Where are the primary actions? Sketch it in plain text if useful — even a rough layout description ("header with logo, big number centered, refresh button at bottom") is enough to catch layout mistakes before they're built.]

---

## Definition of done

Check these off before saying "it's ready."

- [ ] Core flow works end to end
- [ ] Error states are handled and show human-readable messages
- [ ] Empty/no-data states are handled
- [ ] Layout works correctly at 375px width
- [ ] No API keys in frontend code
- [ ] All async calls have loading states
- [ ] Lighthouse score above 70 (run in Chrome DevTools > Lighthouse)
- [ ] CHECKLIST.md reviewed and all items addressed

---

## Notes / decisions made

> [Use this space to record anything you decided during planning — why you chose a particular tool, why you cut a feature, what you're explicitly not building. Future you (and your AI) will thank you.]
