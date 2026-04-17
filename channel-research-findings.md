# Claude Code Channels for a Web Admin Chat Bridge -- Findings

## Verdict: Partially viable today

Channels can bridge a web admin panel to a live Claude Code session, but not the way the question implies. The web app on Vercel cannot be the channel MCP server itself. A small local channel plugin is still required on the user's machine to relay messages between Vercel and the running session.

## What Claude Code Channels are

Shipped March 2026 in Claude Code 2.1.80 as a research preview. A channel is an MCP plugin launched with `claude --channels plugin:<name>@<marketplace>`. It declares the `claude/channel` capability and, instead of waiting to be queried like a normal MCP tool, actively pushes events into the open session. Events arrive inline as `<channel source="..."> ... </channel>` tags. Claude replies through a `reply` tool exposed by the plugin. Integration is at the protocol layer, so no response parsing is needed. Plugins are Bun scripts distributed via the plugins marketplace system.

## Remote web to local MCP

Channels are loaded locally by the Claude Code process, so a Vercel function cannot register a channel directly. The working pattern is identical to how the Telegram and Discord plugins work: the local plugin polls an outbound HTTPS endpoint (Telegram's Bot API, Discord's gateway) and injects new messages as channel events. An UnClick channel plugin would long-poll a Vercel endpoint (for example `/api/admin-inbox/poll`) and POST replies back to `/api/admin-inbox/reply`. No inbound ports, no exposed local server.

## When no session is active

Messages are dropped. There is no queueing in the Claude Code runtime. "Events only arrive while the session is open." The admin panel would need to buffer unsent messages itself (Vercel + Postgres/Redis) and replay on reconnect.

## Comparable projects

- **claude-peers-mcp (louislva)**: runs a broker daemon on localhost:7899 with SQLite; each Claude instance spawns a stdio MCP that registers with the broker and declares `claude/channel` to push peer messages in. A web UI could POST to the same broker, so this is a direct template for the UnClick use case.
- **claude-slack-bridge (tomeraitz)**: predates Channels. Uses blocking I/O inside an `ask_user` style tool: Claude calls a tool, the MCP server blocks on a Unix socket until Slack replies, then returns. Different pattern -- Claude pauses and asks, rather than messages being pushed in asynchronously. Not a fit for a chat-style admin panel.
- **mcp-bridgekit (mkbhardwas12)**: stdio-to-HTTP bridge for exposing MCP tools to web apps. Solves the opposite direction (web calling tools). Does not help with pushing events into a running Claude session.

## Biggest blocker

During the research preview, `--channels` only loads plugins from Anthropic's allowlist. Custom plugins require `--dangerously-load-development-channels`. End users would need that dev flag plus Bun installed locally, and Claude Code must be kept running in tmux/screen for the channel to receive anything.

## Recommended next step

Build a minimal Bun-based UnClick channel plugin modeled on the fakechat plugin in `anthropics/claude-plugins-official`. It long-polls a new Vercel admin inbox endpoint and exposes a `reply` tool that POSTs back. Test locally with `--dangerously-load-development-channels`, then file for inclusion in the Anthropic allowlist. Ship docs telling users to run Claude Code under tmux with `--channels`.
