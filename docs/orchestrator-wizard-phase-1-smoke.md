# Orchestrator Wizard Phase 1 -- Smoke Test Checklist

## (a) Run Crews Council from Claude Desktop
- Open Claude Desktop, connect to the UnClick MCP server
- Call `start_crew_run` with a test topic
- Verify: response is a ConversationalCard shape (headline, summary, keyFacts, nextActions)
- Verify: no errors about missing ANTHROPIC_API_KEY in server logs

## (b) Confirm no ANTHROPIC_API_KEY traffic in Vercel logs
- Trigger a crew run via the MCP tool
- Check Vercel function logs for any outbound requests to api.anthropic.com
- Expected: zero hits. All LLM traffic goes through the Claude Desktop sampling bridge.

## (c) Verify admin deep-link shows correct state
- After starting a run, copy the deepLink from the ConversationalCard response
- Open in browser
- Verify: run details page loads and shows correct stage/status