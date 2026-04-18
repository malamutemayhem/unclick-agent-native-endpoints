# @unclick/channel

UnClick Channel plugin for Claude Code. Routes the UnClick admin chat through
your local Claude Code session so you do not need a separate AI API key.

## How it works

1. You install this plugin once and launch Claude Code with it.
2. The plugin connects to the UnClick Supabase project over Realtime and
   subscribes to `chat_messages` rows for your api key.
3. When you type into the admin chat at `/memory/admin`, the UI writes a
   pending row. The plugin picks it up and pushes the message into your
   Claude Code session.
4. Claude processes it with the full UnClick MCP toolset available and
   calls back via the `unclick_channel_respond` tool.
5. The reply is written back to Supabase and streamed to the admin UI.

Every 30 seconds the plugin POSTs a heartbeat to `admin_channel_heartbeat`
so the admin UI knows the channel is online.

## Install

```bash
npm install -g @unclick/channel
```

## Run

```bash
export UNCLICK_API_KEY=your_api_key
export UNCLICK_SUPABASE_URL=https://<project>.supabase.co
export UNCLICK_SUPABASE_ANON=<anon key>

claude --channel @unclick/channel
```

If you are on a preview build that requires loading development channels:

```bash
claude --dangerously-load-development-channels --channel @unclick/channel
```

## Environment

| Variable | Required | Notes |
|----------|----------|-------|
| `UNCLICK_API_KEY` | yes | Your UnClick API key (starts with `uc_` or `agt_`). |
| `UNCLICK_SUPABASE_URL` | yes | The UnClick project URL. |
| `UNCLICK_SUPABASE_ANON` | yes | UnClick project anon key (Realtime only). |
| `UNCLICK_API_BASE` | no | Defaults to `https://unclick.world`. |
| `UNCLICK_CHANNEL_POLL` | no | Fallback poll interval in ms (default 5000). |
