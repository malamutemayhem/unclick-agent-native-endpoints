# UnClick Review Rubric

Every submission goes through this process. We publish the rubric because developers shouldn't be guessing why their app failed — they should be able to self-assess, fix it, and resubmit.

There is no penalty for revisions. Submit as many times as you need.

---

## Automated checks (instant)

These run the moment you submit. If any fail, you get immediate feedback and your submission doesn't move to the next stage.

| Check | Pass condition |
|-------|---------------|
| Builds without errors | TypeScript/JS compiles with no type errors or missing imports |
| No exposed secrets | No API keys, tokens, or passwords found in source code |
| Has required metadata | Name, description, category, and at least 2 examples are all filled in |
| Lighthouse score | Performance + Accessibility scores both >= 70 (Mobile) |
| Mobile viewport | Renders correctly and usably at 375px width |

**What "no exposed secrets" means:** We scan for patterns that look like API keys, JWT tokens, and hardcoded credentials. Environment variable references (`process.env.X`, `import.meta.env.X`) pass. Inline string values that match credential patterns fail.

---

## AI quality scan (approx. 30 seconds)

Runs after all automated checks pass. A lightweight AI review that catches common quality issues.

| Dimension | What we look for |
|-----------|-----------------|
| Does what it claims | The core feature described in the app's description actually works as described |
| Error handling | API failures and empty states produce readable feedback, not raw errors or blank screens |
| Code quality | No obvious bugs — infinite loops, unhandled promises, broken conditional logic |
| UnClick usage | Tools are called with the correct format, results are checked before use, error branch exists |
| Security basics | No XSS vectors (user input rendered as raw HTML), no sensitive data logged or exposed |

**If the AI scan flags something:** You'll receive a specific note on what failed and where. The scan is designed to give you enough signal to fix it, not just a pass/fail score.

---

## Human review (Certified tier only)

Apps applying for Certified status go through a review by the UnClick team. Certified apps get a badge, appear higher in search, and are eligible for promotion.

We're checking for:

- **Genuinely useful** — solves a real problem for real people, not a demo or a toy
- **Polished** — the UI feels intentional. Error states, empty states, and loading states all exist. Nothing looks like a first draft.
- **Maintained** — the developer is reachable and has committed to keeping the app working as underlying APIs change
- **Original** — not a close clone of an existing Certified app. Building a better version of something is fine; rebuilding it identically is not.

Certified review is manual, so it takes longer. We'll tell you what to improve if your app doesn't pass on the first attempt.

---

## What happens when you fail

1. You get a report that names the specific checks that failed
2. Each failure includes what we found and how to fix it
3. You fix it and resubmit — no waiting period, no strike count

The process is meant to make apps better, not to keep apps out. If the feedback is unclear, reach out — we'd rather explain it than have you guess.
