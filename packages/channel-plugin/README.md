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

The plugin also exposes `unclick_save_conversation_turn`, a small fallback
tool for Orchestrator continuity. Use it when a seat is running through this
channel but the normal UnClick MCP `save_conversation_turn` tool is not
available. The receipt-first rule is: when a real chat message wakes the seat,
save that accepted turn first and keep the returned `turn_id` as the receipt.
It saves one external chat turn through
`admin_conversation_turn_ingest`, so `/admin/orchestrator` can show and search
the turn. If neither save path is available, the seat should say `UNTETHERED`
with any partial receipt it captured instead of silently continuing.

The plugin also exposes `unclick_orchestrator_context_read`. Call it
immediately after saving the accepted turn and before deciding what the user
meant. The required order is: Log -> Read -> Decide -> Reply -> Log reply.
This stops a seat from treating a test cue, proof marker, or check phrase as a
real operator request without reading nearby Orchestrator context first. If the
read fails, say `CONTEXT_UNREAD` or `UNTETHERED` instead of guessing.

The plugin also exposes `unclick_orchestrator_tether_check`. Call it on startup
or heartbeat to save a harmless synthetic self-check turn and confirm
`/admin/orchestrator` search can find it. The backup order is:

1. save the live chat wake/message first;
2. use the UnClick MCP `save_conversation_turn` tool;
3. use this channel plugin's `unclick_save_conversation_turn` tool;
4. use the `admin_conversation_turn_ingest` API directly;
5. read Orchestrator context before deciding what the saved turn means;
6. run `unclick_orchestrator_tether_check`;
7. save any safe partial status/proof still available;
8. say `UNTETHERED` with the missing path and any captured receipt ids.

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
