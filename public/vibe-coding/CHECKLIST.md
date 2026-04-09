# UnClick Submission Checklist

Run through this before submitting. Your AI assistant can check most of these automatically — ask it: "Read this checklist and tell me which items we haven't addressed yet."

---

## Security

- [ ] No API keys hardcoded in frontend code
  - Check: search your codebase for `UNCLICK_API_KEY` appearing as a raw string value, not a variable reference
  - Fix: move to `process.env.UNCLICK_API_KEY` (Node) or `import.meta.env.VITE_UNCLICK_API_KEY` (Vite)
- [ ] No sensitive data logged to the browser console
  - Check: search for `console.log` calls that include API responses, tokens, or user data
- [ ] User input is validated before being sent to APIs
  - Check: any text field or URL input that feeds into an UnClick tool call — is it checked before the request fires?

---

## Quality

- [ ] App does the one thing it promises — no scope creep
  - If you've added features beyond the original PLANNING.md brief, ask: do they make the core thing better, or just bigger?
- [ ] All async calls have loading states
  - Check: every `fetch` or UnClick tool call — what does the user see while it's running?
- [ ] All error states show something human-readable
  - Check: what happens if `result.success === false`? The user should see a sentence, not `[object Object]` or `Error: undefined`
- [ ] Empty states are handled
  - Check: what does the user see when the API returns no results? An empty list should never just be blank — tell the user why.

---

## Mobile

- [ ] Layout works at 375px width
  - Check: open Chrome DevTools, select iPhone SE (375px), and scroll through the entire app
- [ ] Touch targets are at least 44px tall
  - Check: buttons, links, and interactive elements — are they easy to tap on a phone?
- [ ] Text is readable without zooming
  - Check: body text should be at least 16px. Labels and captions no smaller than 12px.

---

## Performance

- [ ] Lighthouse score above 70
  - Check: Chrome DevTools > Lighthouse > run for Mobile. The Performance + Accessibility scores both need to clear 70.
- [ ] No unnecessary re-renders on the main screen
  - Check: does the UI flicker or reload when it shouldn't? Common cause: state updates in the wrong place.
- [ ] Images have dimensions set (prevents layout shift)
  - Check: any `<img>` tag should have explicit `width` and `height` attributes, or use CSS to fix dimensions

---

## UnClick usage

- [ ] All tool calls check `result.success` before using `result.data`
  - Check: every `callUnclick()` or fetch to `/tools/...` — is there an error branch?
- [ ] Tool names match the list in CLAUDE.md Section 2
  - Check: no typos in tool names — a wrong name returns a 404, not a helpful error
- [ ] No tool calls happen on the client side with a visible API key
  - If calling UnClick from the browser, the key must go through a backend route or serverless function — not `import.meta.env.VITE_UNCLICK_API_KEY` in a direct fetch

---

## Submission metadata

- [ ] App name is clear and specific (not "My App" or "Tool")
- [ ] Description explains what it does in one sentence — what it does and for whom
- [ ] At least 2 example prompts or use cases provided (helps the review team understand the intent)
- [ ] Correct category selected
- [ ] Screenshot or preview image uploaded (800x600 minimum, shows the app in a working state)

---

## Final check

Ask your AI: **"Read this checklist and tell me which items we haven't addressed yet."**

Then: **"For each unchecked item, show me the relevant code and tell me what to fix."**

Don't submit until everything is checked.
