# UnClick Vibe Coding Quality Framework — Strategy

Internal reference doc. Not user-facing, but published openly — we don't need to hide how we think.

---

## The problem

Vibe coding tools (Cursor, Lovable, Bolt, v0, Claude) have made it genuinely fast to ship an app. A developer with no formal training can go from idea to deployed in a few hours. That's not going away, and it's mostly good.

The problem is consistency. AI-assisted apps range from polished and genuinely useful to broken, insecure, and unmaintainable — and there's no reliable signal at submission time for which one you're looking at. We can't review everything manually. We can't just accept everything either.

The failure mode isn't bad developers. It's that AI assistants don't have context. They don't know what UnClick expects. They don't know the tool names, the error format, the mobile requirements, or what a good submission looks like. So they guess — and sometimes they guess wrong.

---

## The solution: quality through foundations, not gatekeeping

The goal isn't to filter more aggressively. It's to make it structurally hard to build a bad app in the first place.

If an AI assistant has good context before it starts coding — what UnClick is, what the tools are called, what the error format is, what the submission criteria look like — most quality problems don't happen. They're not bugs to catch at review time. They're the natural result of an assistant that didn't know what good looked like.

We give developers a small set of files to drop into their project. The AI reads them. The AI now knows what we expect. Most of the problems go away before any code is written.

---

## The three layers

**Layer 1: Context — CLAUDE.md**

The file that teaches an AI assistant everything about UnClick. Tool names, API patterns, error handling, mobile standards, pre-coding planning steps. Drop it in the project root and every major AI coding assistant picks it up automatically.

This is the highest-leverage thing we can ship. One file, dropped once, changes the behavior of every AI-assisted build in that project.

**Layer 2: Planning — PLANNING.md**

A template that forces the developer (and their AI) to answer five questions before writing code: who is this for, what does it do, what goes wrong, which tools does it need, and what does it look like on a phone.

The planning step isn't bureaucracy — it's the thing that makes the difference between an app that does one thing well and an app that sort of does three things. The template is conversational on purpose. It should feel like a 5-minute chat, not a requirements document.

**Layer 3: Quality gates — CHECKLIST.md + automated review**

A pre-submission checklist that developers run through before they submit, and an automated review that runs on every submission. The checklist is designed to be AI-readable — a developer can literally ask their AI to check it.

The review tiers stack on top of each other so that human time is only spent on things humans need to review.

---

## The review tiers

**Tier 1: Automated checks (instant, ~$0)**

Runs on every submission. Catches the obvious problems: build errors, exposed secrets, missing metadata, low Lighthouse scores, broken mobile layouts. Fast enough to be frictionless. Cheap enough to run at any volume.

**Tier 2: AI quality scan (Haiku, ~30 seconds, fractions of a cent)**

Runs after automated checks pass. Haiku reads the source code and checks whether the app does what it claims, handles errors correctly, uses UnClick tools properly, and doesn't have obvious security problems. At current pricing, this costs well under $0.01 per submission.

**Tier 3: Sonnet detailed review (on flag, ~$0.01–0.05 per scan)**

Reserved for apps that Haiku flags as borderline, or apps applying for Certified status. Sonnet does a more thorough code review — architectural issues, subtle bugs, UX problems. Still cheap enough to use freely at realistic volumes.

**Tier 4: Human spot-check (Certified tier only)**

Manual review for apps applying for the Certified badge. We review for genuine usefulness, polish, and maintainability. This is the only tier that costs meaningful human time, and it's only triggered by explicit developer request.

---

## Cost model

At realistic submission volumes:

- 100 submissions/month: Haiku scans cost ~$0.50–1.00 total
- 1,000 submissions/month: ~$5–10 total
- Worst case at scale (Sonnet for everything): ~$50–100/month at 1,000 submissions

This is not a cost concern. The automated pipeline scales to thousands of submissions per month for less than we spend on coffee.

---

## SDK roadmap

**Now: CLAUDE.md**

Ship the context file. Any developer can drop it in their project today. It works with every major AI coding tool. No install required. This is the thing that changes behavior immediately.

**Next: npm package**

```
npm install @unclick/dev-kit
```

Installs CLAUDE.md into the project root, adds the TypeScript helper, sets up the `.env.example`. One command instead of four file downloads. Keeps the files up to date as UnClick evolves.

**After that: Lovable and Bolt integrations**

Both platforms support injecting system context into the AI's prompt. We work with them to have CLAUDE.md content included by default when a developer is building on UnClick. Zero-config quality context for the largest vibe coding platforms.

**Later: IDE extensions**

VS Code and JetBrains extensions that surface the checklist in the editor, warn on hardcoded keys, and show tool documentation inline. Lower priority — the file-based approach covers most of this without requiring an install.

---

## The coaching framing

The review process should feel like feedback from someone who wants the app to succeed, not a bouncer deciding who gets in.

Every failed check has a specific message. Every message says what failed, why it matters, and how to fix it. Resubmissions are frictionless. The review rubric is public so no one is surprised.

The goal is a marketplace where quality is the norm because we made it easy to build quality — not because we rejected everything that didn't meet it.
