# UnClick — AI Assistant Context

Drop this file in your project root. It gives your AI assistant (Claude, Cursor, Copilot, Windsurf) everything it needs to build well on top of UnClick.

---

## Section 1: What UnClick is

UnClick is a unified tool API for AI agents. One API key unlocks 100+ tools across weather, finance, email, security, sports, food, developer utilities, and more.

**How it works:**
- One key, one endpoint pattern, every tool
- MCP-compatible: works natively with Claude, Cursor, and any MCP client
- Also has a plain REST API — no SDK required, just fetch

**REST API pattern:**
```
POST https://api.unclick.world/tools/{toolName}
Authorization: Bearer YOUR_KEY
Content-Type: application/json

{ "args": { ...tool-specific args } }
```

**Response format:**
```json
{ "success": true, "data": { ... } }
// or on failure:
{ "success": false, "error": "Human-readable error message" }
```

Errors are structured for AI to interpret. If a call fails, the error message tells you what went wrong and often how to fix it.

---

## Section 2: Available tools by category

### Zero-config (no third-party API key needed)

| Tool name | What it does |
|-----------|-------------|
| `calculator` | Evaluate math expressions safely |
| `unit_converter` | Convert between units (length, weight, temperature, etc.) |
| `datetime` | Parse, format, and compute dates and times |
| `text_tools` | Transform text: case, trim, count, slugify, etc. |
| `color_tools` | Convert between color formats (hex, rgb, hsl) |
| `random` | Generate random numbers, UUIDs, passwords |
| `meal` | Recipe search and meal lookup via TheMealDB |
| `espn_scores` | Live and recent sports scores from ESPN |
| `sleeper_fantasy` | Fantasy football data from Sleeper |
| `deezer` | Music search, artist info, track previews |
| `usgs_earthquakes` | Recent earthquake data from USGS |
| `openfoodfacts` | Nutrition data for food products |
| `public_toilets` | Find public toilets near a location (AU/NZ) |
| `tab_racing` | Australian horse racing form and results (TAB) |
| `thelott` | Australian lottery results |

### Weather & Location

| Tool name | What it does |
|-----------|-------------|
| `openweather` | Current weather and forecasts via OpenWeatherMap |
| `weatherapi` | Weather with more detail — UV, air quality, astronomy |
| `opencage` | Forward and reverse geocoding |
| `ipinfo` | IP address geolocation and ISP info |
| `here_maps` | Routing, geocoding, and place search |

### Finance

| Tool name | What it does |
|-----------|-------------|
| `alpha_vantage` | Stock prices, forex, and technical indicators |
| `coingecko` | Crypto prices, market cap, and coin data |
| `coinmarketcap` | Crypto market data and rankings |
| `fixer_exchange` | Currency exchange rates via Fixer |
| `open_exchange` | Exchange rates via Open Exchange Rates |

### Email & Communication

| Tool name | What it does |
|-----------|-------------|
| `email` | Send and receive email via SMTP/IMAP |
| `resend` | Send transactional email via Resend |
| `hunter` | Find and verify professional email addresses |
| `mailchimp` | Manage lists and send campaigns via Mailchimp |

### Security

| Tool name | What it does |
|-----------|-------------|
| `virustotal` | Scan files, URLs, and IPs for malware |
| `abuseipdb` | Check if an IP address has been reported for abuse |
| `urlscan` | Scan and analyse URLs for threats |
| `shodan` | Search Shodan for internet-connected device info |
| `haveibeenpwned` | Check if an email or password has been in a breach |
| `nvd` | Search the NIST vulnerability database (CVEs) |

### Developer

| Tool name | What it does |
|-----------|-------------|
| `github` | Repos, issues, PRs, and user data via GitHub API |
| `vercel` | Deployments, project info, and logs via Vercel API |
| `toggl` | Time tracking entries and reports |
| `clockify` | Time tracking, workspaces, and project data |

### Productivity

| Tool name | What it does |
|-----------|-------------|
| `notion` | Read and write Notion pages and databases |
| `readwise` | Highlights and reading list from Readwise |
| `raindrop` | Bookmarks via Raindrop.io |
| `instapaper` | Save and retrieve articles via Instapaper |
| `feedly` | Read and manage RSS feeds via Feedly |
| `monica` | Personal CRM contacts and notes via Monica |
| `splitwise` | Expense splitting and balances via Splitwise |

### AU-specific

| Tool name | What it does |
|-----------|-------------|
| `amber` | Wholesale electricity prices via Amber Electric |
| `willyweather` | Australian weather and surf forecasts |
| `domain` | Property listings and suburb data via Domain |
| `trove` | Digitised historical content from NLA Trove |
| `australiapost` | Postcode lookup and parcel tracking |
| `sendle` | Parcel shipping rates and labels via Sendle |
| `ipaustralia` | Trade mark and patent search |
| `tab` | Australian racing — TAB odds and results |
| `thelott` | Australian lottery draws and results |

### Science & Environment

| Tool name | What it does |
|-----------|-------------|
| `openaq` | Air quality data from monitoring stations worldwide |
| `ebird` | Bird observation data from eBird |
| `carboninterface` | Carbon emissions estimates |

---

## Section 3: How to call tools

```javascript
// Basic pattern — works in any JS/TS project
const response = await fetch('https://api.unclick.world/tools/openweather', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + process.env.UNCLICK_API_KEY,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    args: { city: 'Sydney' }
  })
});

const result = await response.json();

if (!result.success) {
  // Handle the error — result.error is a human-readable string
  throw new Error(result.error);
}

// Use result.data
console.log(result.data);
```

```typescript
// TypeScript helper — add this to your project
async function callUnclick<T>(toolName: string, args: Record<string, unknown>): Promise<T> {
  const res = await fetch(`https://api.unclick.world/tools/${toolName}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.UNCLICK_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ args }),
  });

  const result = await res.json();

  if (!result.success) {
    throw new Error(result.error ?? 'UnClick tool call failed');
  }

  return result.data as T;
}
```

```python
# Python pattern
import os, httpx

def call_unclick(tool_name: str, args: dict) -> dict:
    response = httpx.post(
        f"https://api.unclick.world/tools/{tool_name}",
        headers={
            "Authorization": f"Bearer {os.environ['UNCLICK_API_KEY']}",
            "Content-Type": "application/json",
        },
        json={"args": args},
    )
    result = response.json()
    if not result.get("success"):
        raise ValueError(result.get("error", "UnClick tool call failed"))
    return result["data"]
```

---

## Section 4: Quality standards — AI must follow these

These are not suggestions. Every app built on UnClick should meet these standards before submission.

**API keys**
- Never hardcode API keys in frontend code
- Always use environment variables: `process.env.UNCLICK_API_KEY` (Node) or `import.meta.env.VITE_UNCLICK_API_KEY` (Vite)
- Never log API keys, even accidentally in debug output

**Error handling**
- Always check `result.success` before using `result.data`
- Every error that reaches the user must be human-readable — not a raw error object, not `[object Object]`
- Catch network failures separately from API errors (the fetch itself can fail)

**Loading states**
- Every async call must have a loading state
- The UI must not appear broken while data is fetching
- Use skeleton screens or spinners — never just hide content

**Mobile-first**
- Design for 375px width first, then expand
- Touch targets minimum 44px tall
- Body text minimum 16px
- Test in Chrome DevTools at iPhone SE (375px) before calling it done

**UI components**
- Use `@unclick/ui` components if the package is available in this project
- Otherwise use the design tokens from the existing theme — don't introduce new colors or font sizes

**Scope discipline**
- Do one thing well. If the app is growing beyond its original brief, push back.
- Every feature you add is a feature that can break.

---

## Section 5: Before writing any code

Always do this first. It takes 5 minutes and prevents hours of rework.

1. **Define who this is for** — not "users", but a specific person with a specific job. "A tradie tracking quotes on their phone" is useful. "People who need stuff" is not.

2. **Map the core flow** — what happens when everything works perfectly, in 3-5 steps. If you can't describe it in 5 steps, the app is too complex. Simplify before building.

3. **Identify failure modes** — what does the user see when the API call fails? When there's no data? When they're offline? These are not edge cases. Plan them.

4. **List the UnClick tools** — which tools does this app need, and what args does each call require? Confirm the tool names against Section 2 above.

5. **Then code.**

Use the `PLANNING.md` template in this folder before starting any new feature or app.
