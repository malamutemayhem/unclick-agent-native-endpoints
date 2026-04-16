# Session: 2026-04-15 — Glama Release

## Summary

Glama build succeeded for the UnClick MCP Server. Release v0.1.0 published at 17:09 UTC.

## What happened

- Configured the Glama Dockerfile admin with build steps (`npm install -g @unclick/mcp-server`) and CMD (`unclick-mcp`) so the binary lands in PATH and mcp-proxy can find it
- - First build attempt failed with `sh: 1: unclick-mcp: not found` because npx cache is not on the mcp-proxy search path; global install fixed it
  - - Second build succeeded in 18.1s — 128 packages installed, server started cleanly on stdio
    - - Glama proxy connected and detected **9 tools**: `unclick_search`, `unclick_browse`, `unclick_tool_info`, `unclick_call`, plus the five memory tools (`get_startup_context`, `write_session_summary`, `add_fact`, `search_memory`, `set_business_context`)
      - - Release v0.1.0 auto-created from the successful build
       
        - ## Status
       
        - - Security, license, and quality scores now auto-populating from the release
          - - This unblocks the final checkbox on PR #4409 (punkpeye/awesome-mcp-servers)
            - - No further action needed on the Glama side
             
              - ## Open loops
             
              - - Monitor score page at `/score` once Glama finishes scanning
                - - Frank's bot should auto-clear the score checkbox when scores land; if not, drop a comment on PR #4409
