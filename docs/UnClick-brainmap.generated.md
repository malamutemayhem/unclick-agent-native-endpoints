# UnClick Ecosystem Brainmap

Internal admin only. Auto-generated from tracked source so new AI seats can understand UnClick without a separate handover.

## Source Manifest

| Source | Hash | Bytes |
| --- | --- | --- |
| AUTOPILOT.md | 1183ec7b66ca | 16591 |
| FLEET_SYNC.md | a0bbe1c49b60 | 13517 |
| docs/unclick-context-boot-packet.md | 513173ecd757 | 4910 |
| docs/agent-observability.md | 4614ea97481d | 3114 |
| docs/pinballwake-nudgeonly-api.md | f414abc72f91 | 7056 |
| docs/fleet-worker-roles.md | 46758e20b953 | 3757 |
| docs/adr/0005-two-layer-admin-gating.md | 928a93930df6 | 2213 |
| docs/adr/0006-orchestrator-is-user-chat.md | f9b527b76e69 | 2195 |
| src/App.tsx | f68b6213c740 | 12938 |
| src/pages/admin/AdminShell.tsx | 0a10956e5222 | 17947 |
| .github/workflows/ci.yml | 274c6cfc5ca8 | 1661 |
| .github/workflows/brainmap-auto-update.yml | 7e8b08eb16aa | 1137 |
| package.json | 75e54cc0969e | 4292 |
| scripts/pinballwake-ack-ledger-room.mjs | 9b189b79d2aa | 13139 |
| scripts/pinballwake-close-supersede-room.mjs | 053ed54576d3 | 4019 |
| scripts/pinballwake-coding-room.mjs | a364fd4620de | 26334 |
| scripts/pinballwake-continuous-improvement-room.mjs | 345e292456e4 | 9093 |
| scripts/pinballwake-dogfood-room.mjs | 4cdc2ce23e94 | 2865 |
| scripts/pinballwake-event-ledger-room.mjs | 068a276d4314 | 16600 |
| scripts/pinballwake-jobs-room.mjs | be5f80f6f5b9 | 12265 |
| scripts/pinballwake-launchpad-room.mjs | aadc787a2a39 | 13024 |
| scripts/pinballwake-merge-room.mjs | 8a8a1ffb4789 | 8762 |
| scripts/pinballwake-overlap-resolver-room.mjs | bc15491c5662 | 7007 |
| scripts/pinballwake-personality-room.mjs | 2da4ce09fac4 | 9928 |
| scripts/pinballwake-planning-room.mjs | 25b8110ce4f9 | 9997 |
| scripts/pinballwake-post-merge-watch-room.mjs | 8c7f0c3c5f1b | 5642 |
| scripts/pinballwake-publish-room.mjs | 4204e788d834 | 7737 |
| scripts/pinballwake-queue-health-room.mjs | 4cde05855108 | 2921 |
| scripts/pinballwake-release-notes-room.mjs | 8d29cf325087 | 2677 |
| scripts/pinballwake-repair-room.mjs | 042026b476f8 | 3665 |
| scripts/pinballwake-research-room.mjs | b66f6f472d33 | 7860 |
| scripts/pinballwake-rollback-room.mjs | 77a05b0bbe6a | 4287 |
| scripts/pinballwake-stale-room.mjs | f283068a64da | 4004 |
| scripts/pinballwake-worker-registry-room.mjs | 591b4d3dae0f | 16688 |
| scripts/pinballwake-xpass-gate-room.mjs | 198e6e087e0a | 14879 |
| packages/mcp-server/src/abn-tool.ts | 5a99641b1c53 | 3784 |
| packages/mcp-server/src/abuseipdb-tool.ts | 25918fdf5b44 | 4800 |
| packages/mcp-server/src/airtable-tool.ts | 8af9e9f48331 | 7292 |
| packages/mcp-server/src/algolia-tool.ts | 9a00f054791c | 5048 |
| packages/mcp-server/src/alphavantage-tool.ts | 7c30fef805d5 | 7822 |
| packages/mcp-server/src/amazon-tool.ts | 356a4d6956dc | 15279 |
| packages/mcp-server/src/amber-tool.ts | 2209eb5a73c5 | 4255 |
| packages/mcp-server/src/anthropic-tool.ts | 35d2f8f564bd | 5469 |
| packages/mcp-server/src/asana-tool.ts | 63c7ad0204ce | 8281 |
| packages/mcp-server/src/assemblyai-tool.ts | b27e9f288768 | 6194 |
| packages/mcp-server/src/australiapost-tool.ts | 5457f4f106db | 5282 |
| packages/mcp-server/src/bandsintown-tool.ts | 2511ad072df5 | 3266 |
| packages/mcp-server/src/bgg-tool.ts | 9e9da1c7dc51 | 10752 |
| packages/mcp-server/src/bluesky-tool.ts | 2ee3d7248e91 | 14692 |
| packages/mcp-server/src/bungie-tool.ts | 662abcc0d373 | 6838 |
| packages/mcp-server/src/calculator-tool.ts | 5e2923a36738 | 7464 |
| packages/mcp-server/src/calendly-tool.ts | e1f3d3e61c22 | 6566 |
| packages/mcp-server/src/carboninterface-tool.ts | 267e879e2c79 | 6900 |
| packages/mcp-server/src/chessdotcom-tool.ts | 5ac956210a8e | 7073 |
| packages/mcp-server/src/circleci-tool.ts | 7995e408ce85 | 5090 |
| packages/mcp-server/src/clickup-tool.ts | 99869c2eb359 | 6469 |
| packages/mcp-server/src/clockify-tool.ts | 36c40b339239 | 6954 |
| packages/mcp-server/src/cohere-tool.ts | 4925ac1d87f2 | 9488 |
| packages/mcp-server/src/coingecko-tool.ts | 992219483e17 | 7022 |
| packages/mcp-server/src/coinmarketcap-tool.ts | a7aeebfb21dd | 7080 |
| packages/mcp-server/src/color-tool.ts | 8d5544aebb09 | 14005 |
| packages/mcp-server/src/convertkit-tool.ts | f1d95417df2d | 8768 |
| packages/mcp-server/src/copypass-tool.ts | 8a2fb30ff964 | 5920 |
| packages/mcp-server/src/crews-tool.ts | b8c82fc0d59a | 5895 |
| packages/mcp-server/src/csuite-tool.ts | 3d2bffa207c7 | 71272 |
| packages/mcp-server/src/datadog-tool.ts | 0532d8c68cf6 | 5675 |
| packages/mcp-server/src/datetime-tool.ts | c6ec64101b48 | 10902 |
| packages/mcp-server/src/deepl-tool.ts | 25ae400acbc2 | 5829 |
| packages/mcp-server/src/deezer-tool.ts | a6b31ea1a334 | 7493 |
| packages/mcp-server/src/discogs-tool.ts | 7d8a9830ade7 | 5084 |
| packages/mcp-server/src/discord-tool.ts | 1fd1f375bb11 | 8456 |
| packages/mcp-server/src/domain-tool.ts | f18a499e01ef | 6234 |
| packages/mcp-server/src/ebay-tool.ts | 6cfa2d126469 | 7794 |
| packages/mcp-server/src/ebird-tool.ts | 41cf6c211b88 | 6471 |
| packages/mcp-server/src/elevenlabs-tool.ts | 2c6f2e966a50 | 7919 |

## UnClick Structure

- UnClick is the platform: tools, memory, agents, proof, and admin surfaces.
- Launchpad is the control hub for Autopilot work.
- Rooms are the operational stages that route work through research, planning, build, proof, review, safety, merge, publish, repair, and improvement.
- Heartbeat Master at `/admin/agents/heartbeat` teaches scheduled AI seats how to pulse safely.
- Ecosystem Brainmap at `/admin/brainmap` teaches seats what the system is and what each surface means.

## Pages and Meaning

| Route | Page | Meaning | Source |
| --- | --- | --- | --- |
| /admin/activity | Admin Activity | Admin surface for Admin Activity. | src/pages/admin/AdminActivity.tsx |
| /admin/agents | Admin Agents | Admin surface for Admin Agents. | src/pages/admin/AdminAgents.tsx |
| /admin/analytics | Admin Analytics | Internal analytics view for platform signals and usage. | src/pages/admin/AdminAnalytics.tsx |
| /admin/audit-log | Admin Audit Log | Internal audit trail for sensitive admin actions. | src/pages/admin/AdminAuditLog.tsx |
| /admin/brainmap | Admin Brainmap | Generated ecosystem map that teaches seats what UnClick is. | src/pages/admin/AdminBrainmap.tsx |
| /admin/codebase | Admin Codebase | Internal source and architecture orientation surface. | src/pages/admin/AdminCodebase.tsx |
| /admin/dashboard | Admin Dashboard | Front door for current operator state. | src/pages/admin/AdminDashboard.tsx |
| /admin/ecosystem-pages | Admin Ecosystem Pages | Admin surface for Admin Ecosystem Pages. | src/pages/admin/AdminEcosystemPages.tsx |
| /admin/jobs | Admin Jobs | Operational job and task queue. | src/pages/admin/AdminJobs.tsx |
| /admin/keychain | Admin Keychain | Passport and credential connection health. | src/pages/admin/AdminKeychain.tsx |
| /admin/memory | Admin Memory | Admin view of persistent memory, facts, sessions, and recall. | src/pages/admin/AdminMemory.tsx |
| /admin/moderation | Admin Moderation | Admin surface for Admin Moderation. | src/pages/admin/AdminModeration.tsx |
| /admin/orchestrator | Admin Orchestrator | Readable continuity stream for seats and operator context. | src/pages/admin/AdminOrchestrator.tsx |
| /admin/pinball-wake | Admin Pinball Wake | PinballWake rooms, wake routes, and automation visibility. | src/pages/admin/AdminPinballWake.tsx |
| /admin/agents/heartbeat | Admin Seat Heartbeat | Master heartbeat copy policy for scheduled AI seats. | src/pages/admin/AdminSeatHeartbeat.tsx |
| /admin/settings | Admin Settings | Account and admin configuration. | src/pages/admin/AdminSettings.tsx |
| /admin/shell | Admin Shell | Admin surface for Admin Shell. | src/pages/admin/AdminShell.tsx |
| /admin/system-health | Admin System Health | Health checks and operational status. | src/pages/admin/AdminSystemHealth.tsx |
| /admin/test-pass | Admin Test Pass | Admin surface for Admin Test Pass. | src/pages/admin/AdminTestPass.tsx |
| /admin/tools | Admin Tools | Apps, tools, and connector capability surface. | src/pages/admin/AdminTools.tsx |
| /admin/users | Admin Users | Internal user management. | src/pages/admin/AdminUsers.tsx |
| /admin/you | Admin You | Personal account, identity, and access panel. | src/pages/admin/AdminYou.tsx |
| /brain-map | Brain Map | Legacy Memory Brain Map component kept distinct from ecosystem Brainmap. | src/pages/admin/BrainMap.tsx |
| /fishbowl | Fishbowl | Boardroom discussion surface for worker coordination. | src/pages/admin/Fishbowl.tsx |
| /copy-pass-catalog | Copy Pass Catalog | Admin surface for Copy Pass Catalog. | src/pages/admin/copypass/CopyPassCatalog.tsx |
| /crew-composer | Crew Composer | Crews admin page for Crew Composer. | src/pages/admin/crews/CrewComposer.tsx |
| /crew-run | Crew Run | Crews admin page for Crew Run. | src/pages/admin/crews/CrewRun.tsx |
| /crews-catalog | Crews Catalog | Crews admin page for Crews Catalog. | src/pages/admin/crews/CrewsCatalog.tsx |
| /crews-runs | Crews Runs | Crews admin page for Crews Runs. | src/pages/admin/crews/CrewsRuns.tsx |
| /crews-settings | Crews Settings | Crews admin page for Crews Settings. | src/pages/admin/crews/CrewsSettings.tsx |
| /comments | Comments | Admin surface for Comments. | src/pages/admin/fishbowl/Comments.tsx |
| /ideas | Ideas | Admin surface for Ideas. | src/pages/admin/fishbowl/Ideas.tsx |
| /settings | Settings | Admin surface for Settings. | src/pages/admin/fishbowl/Settings.tsx |
| /todos | Todos | Admin surface for Todos. | src/pages/admin/fishbowl/Todos.tsx |
| /context-tab | Context Tab | Memory admin panel for Context Tab. | src/pages/admin/memory/ContextTab.tsx |
| /empty-state | Empty State | Memory admin panel for Empty State. | src/pages/admin/memory/EmptyState.tsx |
| /facts-tab | Facts Tab | Memory admin panel for Facts Tab. | src/pages/admin/memory/FactsTab.tsx |
| /info-card | Info Card | Memory admin panel for Info Card. | src/pages/admin/memory/InfoCard.tsx |
| /library-tab | Library Tab | Memory admin panel for Library Tab. | src/pages/admin/memory/LibraryTab.tsx |
| /memory-activity-tab | Memory Activity Tab | Memory admin panel for Memory Activity Tab. | src/pages/admin/memory/MemoryActivityTab.tsx |
| /sessions-tab | Sessions Tab | Memory admin panel for Sessions Tab. | src/pages/admin/memory/SessionsTab.tsx |
| /storage-bar | Storage Bar | Memory admin panel for Storage Bar. | src/pages/admin/memory/StorageBar.tsx |
| /search-highlight | search Highlight | Admin surface for search Highlight. | src/pages/admin/searchHighlight.tsx |
| /signals-catalog | Signals Catalog | Admin surface for Signals Catalog. | src/pages/admin/signals/SignalsCatalog.tsx |
| /signals-settings | Signals Settings | Admin surface for Signals Settings. | src/pages/admin/signals/SignalsSettings.tsx |
| /new-run-wizard | New Run Wizard | Admin surface for New Run Wizard. | src/pages/admin/testpass/NewRunWizard.tsx |
| /report-detail | Report Detail | Admin surface for Report Detail. | src/pages/admin/testpass/ReportDetail.tsx |
| /run-detail | Run Detail | Admin surface for Run Detail. | src/pages/admin/testpass/RunDetail.tsx |
| /test-pass-catalog | Test Pass Catalog | Admin surface for Test Pass Catalog. | src/pages/admin/testpass/TestPassCatalog.tsx |
| /tools/connected-services | Connected Services | Tool page for Connected Services. | src/pages/admin/tools/ConnectedServices.tsx |
| /tools/un-click-tools | Un Click Tools | Tool page for Un Click Tools. | src/pages/admin/tools/UnClickTools.tsx |
| /admin/settings | Admin Settings | Account and admin configuration. | src/pages/AdminSettings.tsx |
| /auth-callback | Auth Callback | User-facing page for Auth Callback. | src/pages/AuthCallback.tsx |
| /backstage-pass | Backstage Pass | User-facing page for Backstage Pass. | src/pages/BackstagePass.tsx |
| /build-desk | Build Desk | Build and project work surface. | src/pages/BuildDesk.tsx |
| /connect | Connect | User-facing page for Connect. | src/pages/Connect.tsx |
| /crews | Crews | Public Crews explanation and entry point. | src/pages/Crews.tsx |
| /developer-docs | Developer Docs | Developer documentation. | src/pages/DeveloperDocs.tsx |
| /developer-submit | Developer Submit | Tool submission flow. | src/pages/DeveloperSubmit.tsx |
| /developers | Developers | Developer-facing entry point. | src/pages/Developers.tsx |
| /dispatch | Dispatch | Dispatch and message handoff surface. | src/pages/Dispatch.tsx |
| /docs | Docs | User-facing page for Docs. | src/pages/Docs.tsx |
| /dogfood-report | Dogfood Report | Public dogfood proof report. | src/pages/DogfoodReport.tsx |
| /faqpage | FAQPage | User-facing page for FAQPage. | src/pages/FAQPage.tsx |
| / | Index | Public home and first explanation of UnClick. | src/pages/Index.tsx |
| /install-recover | Install Recover | User-facing page for Install Recover. | src/pages/InstallRecover.tsx |
| /login | Login | Sign-in page. | src/pages/Login.tsx |
| /memory | Memory | Public memory product page. | src/pages/Memory.tsx |
| /memory-admin | Memory Admin | User-facing page for Memory Admin. | src/pages/MemoryAdmin.tsx |
| /memory-connect | Memory Connect | User-facing page for Memory Connect. | src/pages/MemoryConnect.tsx |
| /memory-setup | Memory Setup | User-facing page for Memory Setup. | src/pages/MemorySetup.tsx |
| /memory-setup-guide | Memory Setup Guide | User-facing page for Memory Setup Guide. | src/pages/MemorySetupGuide.tsx |
| /new-to-ai | New To AI | Beginner-friendly AI orientation. | src/pages/NewToAI.tsx |
| /not-found | Not Found | User-facing page for Not Found. | src/pages/NotFound.tsx |
| /organiser | Organiser | User-facing page for Organiser. | src/pages/Organiser.tsx |
| /pricing | Pricing | Plans, billing, and packaging. | src/pages/Pricing.tsx |
| /privacy | Privacy | Privacy policy. | src/pages/Privacy.tsx |
| /settings | Settings | User-facing page for Settings. | src/pages/Settings.tsx |
| /signup | Signup | Sign-up page. | src/pages/Signup.tsx |
| /smart-home | Smart Home | User-facing page for Smart Home. | src/pages/SmartHome.tsx |
| /terms | Terms | Terms of service. | src/pages/Terms.tsx |
| /tools | Tools | Public tools marketplace entry point. | src/pages/Tools.tsx |
| /verify-mfa | Verify Mfa | User-facing page for Verify Mfa. | src/pages/VerifyMfa.tsx |
| /vibe-coding | Vibe Coding | User-facing page for Vibe Coding. | src/pages/VibeCoding.tsx |
| /arena/arena-home | Arena Home | Arena page for Arena Home. | src/pages/arena/ArenaHome.tsx |
| /arena/arena-leaderboard | Arena Leaderboard | Arena page for Arena Leaderboard. | src/pages/arena/ArenaLeaderboard.tsx |
| /arena/arena-problem | Arena Problem | Arena page for Arena Problem. | src/pages/arena/ArenaProblem.tsx |
| /arena/arena-submit-problem | Arena Submit Problem | Arena page for Arena Submit Problem. | src/pages/arena/ArenaSubmitProblem.tsx |
| /tools/link-in-bio | Link In Bio | Tool page for Link In Bio. | src/pages/tools/LinkInBio.tsx |
| /tools/scheduling | Scheduling | Tool page for Scheduling. | src/pages/tools/Scheduling.tsx |
| /tools/solve | Solve | Tool page for Solve. | src/pages/tools/Solve.tsx |

## Tool Families and Meaning

| Tool family | Meaning | Source |
| --- | --- | --- |
| abn | abn MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/abn-tool.ts |
| abuseipdb | abuseipdb MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/abuseipdb-tool.ts |
| airtable | airtable MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/airtable-tool.ts |
| algolia | algolia MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/algolia-tool.ts |
| alphavantage | alphavantage MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/alphavantage-tool.ts |
| amazon | amazon MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/amazon-tool.ts |
| amber | amber MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/amber-tool.ts |
| anthropic | anthropic MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/anthropic-tool.ts |
| asana | asana MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/asana-tool.ts |
| assemblyai | assemblyai MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/assemblyai-tool.ts |
| australiapost | australiapost MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/australiapost-tool.ts |
| bandsintown | bandsintown MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/bandsintown-tool.ts |
| bgg | bgg MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/bgg-tool.ts |
| bluesky | bluesky MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/bluesky-tool.ts |
| bungie | bungie MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/bungie-tool.ts |
| calculator | calculator MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/calculator-tool.ts |
| calendly | calendly MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/calendly-tool.ts |
| carboninterface | carboninterface MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/carboninterface-tool.ts |
| chessdotcom | chessdotcom MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/chessdotcom-tool.ts |
| circleci | circleci MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/circleci-tool.ts |
| clickup | clickup MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/clickup-tool.ts |
| clockify | clockify MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/clockify-tool.ts |
| cohere | cohere MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/cohere-tool.ts |
| coingecko | coingecko MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/coingecko-tool.ts |
| coinmarketcap | coinmarketcap MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/coinmarketcap-tool.ts |
| color | color MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/color-tool.ts |
| convertkit | convertkit MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/convertkit-tool.ts |
| copypass | copypass MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/copypass-tool.ts |
| crews | crews MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/crews-tool.ts |
| csuite | csuite MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/csuite-tool.ts |
| datadog | datadog MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/datadog-tool.ts |
| datetime | datetime MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/datetime-tool.ts |
| deepl | deepl MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/deepl-tool.ts |
| deezer | deezer MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/deezer-tool.ts |
| discogs | discogs MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/discogs-tool.ts |
| discord | discord MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/discord-tool.ts |
| domain | domain MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/domain-tool.ts |
| ebay | ebay MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/ebay-tool.ts |
| ebird | ebird MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/ebird-tool.ts |
| elevenlabs | elevenlabs MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/elevenlabs-tool.ts |
| email | email MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/email-tool.ts |
| espn | espn MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/espn-tool.ts |
| etsy | etsy MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/etsy-tool.ts |
| eventbrite | eventbrite MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/eventbrite-tool.ts |
| exchangerate | exchangerate MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/exchangerate-tool.ts |
| feedly | feedly MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/feedly-tool.ts |
| figma | figma MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/figma-tool.ts |
| flyio | flyio MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/flyio-tool.ts |
| foursquare | foursquare MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/foursquare-tool.ts |
| fpl | fpl MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/fpl-tool.ts |
| gdelt | gdelt MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/gdelt-tool.ts |
| genius | genius MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/genius-tool.ts |
| github | github MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/github-tool.ts |
| gitlab | gitlab MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/gitlab-tool.ts |
| groq | groq MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/groq-tool.ts |
| guardian | guardian MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/guardian-tool.ts |
| gumroad | gumroad MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/gumroad-tool.ts |
| hackernews | hackernews MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/hackernews-tool.ts |
| haveibeenpwned | haveibeenpwned MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/haveibeenpwned-tool.ts |
| Heartbeat Protocol | Canonical heartbeat policy served to scheduled seats. | packages/mcp-server/src/heartbeat-protocol.ts |
| heygen | heygen MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/heygen-tool.ts |
| higgsfield | higgsfield MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/higgsfield-tool.ts |
| hunter | hunter MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/hunter-tool.ts |
| igdb | igdb MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/igdb-tool.ts |
| instapaper | instapaper MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/instapaper-tool.ts |
| ipapi | ipapi MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/ipapi-tool.ts |
| ipaustralia | ipaustralia MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/ipaustralia-tool.ts |
| keychain | keychain MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/keychain-tool.ts |
| kling | kling MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/kling-tool.ts |
| lastfm | lastfm MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/lastfm-tool.ts |
| legalpass | legalpass MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/legalpass-tool.ts |
| lego | lego MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/lego-tool.ts |
| lemonsqueezy | lemonsqueezy MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/lemonsqueezy-tool.ts |
| lichess | lichess MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/lichess-tool.ts |
| line | line MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/line-tool.ts |
| linear | linear MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/linear-tool.ts |
| mailchimp | mailchimp MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/mailchimp-tool.ts |
| mapbox | mapbox MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/mapbox-tool.ts |
| mastodon | mastodon MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/mastodon-tool.ts |
| meal | meal MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/meal-tool.ts |
| mistral | mistral MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/mistral-tool.ts |
| mixpanel | mixpanel MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/mixpanel-tool.ts |
| monday | monday MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/monday-tool.ts |
| monica | monica MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/monica-tool.ts |
| musicbrainz | musicbrainz MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/musicbrainz-tool.ts |
| nasa | nasa MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/nasa-tool.ts |
| neon | neon MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/neon-tool.ts |
| newsapi | newsapi MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/newsapi-tool.ts |
| notion | notion MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/notion-tool.ts |
| NudgeOnly | NudgeOnly low-token receipt bridge and advisory classifier. | packages/mcp-server/src/nudgeonly-tool.ts |
| numbers | numbers MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/numbers-tool.ts |
| nvd | nvd MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/nvd-tool.ts |
| omdb | omdb MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/omdb-tool.ts |
| openai | openai MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/openai-tool.ts |
| openaq | openaq MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/openaq-tool.ts |
| openexchangerates | openexchangerates MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/openexchangerates-tool.ts |
| openf1 | openf1 MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/openf1-tool.ts |
| openfoodfacts | openfoodfacts MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/openfoodfacts-tool.ts |
| openlibrary | openlibrary MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/openlibrary-tool.ts |
| openmeteo | openmeteo MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/openmeteo-tool.ts |
| pagerduty | pagerduty MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/pagerduty-tool.ts |
| pandascore | pandascore MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/pandascore-tool.ts |
| paypal | paypal MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/paypal-tool.ts |
| perplexity | perplexity MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/perplexity-tool.ts |
| pika | pika MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/pika-tool.ts |
| pinecone | pinecone MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/pinecone-tool.ts |
| pinterest | pinterest MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/pinterest-tool.ts |
| plaid | plaid MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/plaid-tool.ts |
| podcastindex | podcastindex MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/podcastindex-tool.ts |
| postman | postman MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/postman-tool.ts |
| postmark | postmark MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/postmark-tool.ts |
| ptv | ptv MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/ptv-tool.ts |
| pushover | pushover MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/pushover-tool.ts |
| qc | qc MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/qc-tool.ts |
| quickbooks | quickbooks MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/quickbooks-tool.ts |
| radiobrowser | radiobrowser MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/radiobrowser-tool.ts |
| raindrop | raindrop MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/raindrop-tool.ts |
| random | random MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/random-tool.ts |
| rawg | rawg MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/rawg-tool.ts |
| readwise | readwise MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/readwise-tool.ts |
| reddit | reddit MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/reddit-tool.ts |
| render | render MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/render-tool.ts |
| replicate | replicate MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/replicate-tool.ts |
| resend | resend MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/resend-tool.ts |
| restcountries | restcountries MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/restcountries-tool.ts |
| riot | riot MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/riot-tool.ts |
| runway | runway MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/runway-tool.ts |
| seatgeek | seatgeek MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/seatgeek-tool.ts |
| segment | segment MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/segment-tool.ts |
| sendgrid | sendgrid MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/sendgrid-tool.ts |
| sendle | sendle MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/sendle-tool.ts |
| sentry | sentry MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/sentry-tool.ts |
| seopass | seopass MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/seopass-tool.ts |
| setlistfm | setlistfm MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/setlistfm-tool.ts |
| shodan | shodan MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/shodan-tool.ts |
| shopify | shopify MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/shopify-tool.ts |
| slack | slack MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/slack-tool.ts |
| sleeper | sleeper MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/sleeper-tool.ts |
| speedrun | speedrun MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/speedrun-tool.ts |
| splitwise | splitwise MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/splitwise-tool.ts |
| spotify | spotify MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/spotify-tool.ts |
| square | square MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/square-tool.ts |
| stability | stability MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/stability-tool.ts |
| steam | steam MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/steam-tool.ts |
| stripe | stripe MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/stripe-tool.ts |
| supercell | supercell MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/supercell-tool.ts |
| tab | tab MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/tab-tool.ts |
| telegram | telegram MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/telegram-tool.ts |
| testpass | TestPass proof and test orchestration capability. | packages/mcp-server/src/testpass-tool.ts |
| text | text MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/text-tool.ts |
| thelott | thelott MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/thelott-tool.ts |
| ticketmaster | ticketmaster MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/ticketmaster-tool.ts |
| tiktok | tiktok MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/tiktok-tool.ts |
| tmdb | tmdb MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/tmdb-tool.ts |
| togetherai | togetherai MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/togetherai-tool.ts |
| toggl | toggl MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/toggl-tool.ts |
| toilets | toilets MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/toilets-tool.ts |
| tomorrowio | tomorrowio MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/tomorrowio-tool.ts |
| trello | trello MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/trello-tool.ts |
| trivia | trivia MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/trivia-tool.ts |
| trove | trove MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/trove-tool.ts |
| turso | turso MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/turso-tool.ts |
| twilio | twilio MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/twilio-tool.ts |
| twitch | twitch MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/twitch-tool.ts |
| unit converter | unit converter MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/unit-converter-tool.ts |
| untappd | untappd MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/untappd-tool.ts |
| upstash | upstash MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/upstash-tool.ts |
| urlscan | urlscan MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/urlscan-tool.ts |
| usgs | usgs MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/usgs-tool.ts |
| uxpass | UXPass experience verification capability. | packages/mcp-server/src/uxpass-tool.ts |
| vault | vault MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/vault-tool.ts |
| vercel | vercel MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/vercel-tool.ts |
| virustotal | virustotal MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/virustotal-tool.ts |
| whatsapp | whatsapp MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/whatsapp-tool.ts |
| willyweather | willyweather MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/willyweather-tool.ts |
| wise | wise MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/wise-tool.ts |
| woocommerce | woocommerce MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/woocommerce-tool.ts |
| xero | xero MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/xero-tool.ts |
| yelp | yelp MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/yelp-tool.ts |
| youtube | youtube MCP capability, available through the UnClick tool gateway. | packages/mcp-server/src/youtube-tool.ts |

## Public/Internal Alias Table

| Internal name | Public name | Meaning |
| --- | --- | --- |
| EnterprisePass | CompliancePass | Enterprise readiness checks need a public-safe product name. |
| SlopPass | QualityPass | Roughness and polish checks should be framed constructively. |
| Fishbowl | Boardroom | Internal worker discussion becomes a user-facing room name. |
| To-Do List | Jobs | Task queue language maps to the current admin Jobs surface. |
| Heartbeat | Heartbeat Master | The copy policy that teaches scheduled seats how to pulse. |
| NudgeOnlyAPI | NudgeOnly | Low-risk receipt nudges, never source-of-truth mutation. |

## Rooms List

| Room | Meaning | Source |
| --- | --- | --- |
| ack ledger | PinballWake room logic generated from scripts/pinballwake-ack-ledger-room.mjs. | scripts/pinballwake-ack-ledger-room.mjs |
| close supersede | PinballWake room logic generated from scripts/pinballwake-close-supersede-room.mjs. | scripts/pinballwake-close-supersede-room.mjs |
| coding | PinballWake room logic generated from scripts/pinballwake-coding-room.mjs. | scripts/pinballwake-coding-room.mjs |
| continuous improvement | PinballWake room logic generated from scripts/pinballwake-continuous-improvement-room.mjs. | scripts/pinballwake-continuous-improvement-room.mjs |
| dogfood | PinballWake room logic generated from scripts/pinballwake-dogfood-room.mjs. | scripts/pinballwake-dogfood-room.mjs |
| event ledger | PinballWake room logic generated from scripts/pinballwake-event-ledger-room.mjs. | scripts/pinballwake-event-ledger-room.mjs |
| jobs | PinballWake room logic generated from scripts/pinballwake-jobs-room.mjs. | scripts/pinballwake-jobs-room.mjs |
| launchpad | PinballWake room logic generated from scripts/pinballwake-launchpad-room.mjs. | scripts/pinballwake-launchpad-room.mjs |
| merge | PinballWake room logic generated from scripts/pinballwake-merge-room.mjs. | scripts/pinballwake-merge-room.mjs |
| overlap resolver | PinballWake room logic generated from scripts/pinballwake-overlap-resolver-room.mjs. | scripts/pinballwake-overlap-resolver-room.mjs |
| personality | PinballWake room logic generated from scripts/pinballwake-personality-room.mjs. | scripts/pinballwake-personality-room.mjs |
| planning | PinballWake room logic generated from scripts/pinballwake-planning-room.mjs. | scripts/pinballwake-planning-room.mjs |
| post merge watch | PinballWake room logic generated from scripts/pinballwake-post-merge-watch-room.mjs. | scripts/pinballwake-post-merge-watch-room.mjs |
| publish | PinballWake room logic generated from scripts/pinballwake-publish-room.mjs. | scripts/pinballwake-publish-room.mjs |
| queue health | PinballWake room logic generated from scripts/pinballwake-queue-health-room.mjs. | scripts/pinballwake-queue-health-room.mjs |
| release notes | PinballWake room logic generated from scripts/pinballwake-release-notes-room.mjs. | scripts/pinballwake-release-notes-room.mjs |
| repair | PinballWake room logic generated from scripts/pinballwake-repair-room.mjs. | scripts/pinballwake-repair-room.mjs |
| research | PinballWake room logic generated from scripts/pinballwake-research-room.mjs. | scripts/pinballwake-research-room.mjs |
| rollback | PinballWake room logic generated from scripts/pinballwake-rollback-room.mjs. | scripts/pinballwake-rollback-room.mjs |
| stale | PinballWake room logic generated from scripts/pinballwake-stale-room.mjs. | scripts/pinballwake-stale-room.mjs |
| worker registry | PinballWake room logic generated from scripts/pinballwake-worker-registry-room.mjs. | scripts/pinballwake-worker-registry-room.mjs |
| xpass gate | PinballWake room logic generated from scripts/pinballwake-xpass-gate-room.mjs. | scripts/pinballwake-xpass-gate-room.mjs |

## Workers List

| Worker | Meaning |
| --- | --- |
| Coordinator | Routes work, chooses the next room, and keeps lanes aligned. |
| Builder | Implements focused code or content changes from a scoped packet. |
| Tester | Runs proof and reports what passed or blocked. |
| Reviewer | Checks quality, regressions, and missing tests. |
| Safety Checker | Protects secrets, auth, destructive actions, and release gates. |
| Ledger | Records proof, receipts, approvals, and rollback evidence. |
| Publisher | Moves approved work toward deployment and public proof. |
| Improver | Turns repeated pain into system improvements. |

## Safety Rules

- Admin-only surfaces use `RequireAdmin` and must also be hidden from non-admin sidebar navigation.
- NudgeOnly can request receipt or escalation only. Trusted lanes verify before action.
- Heartbeats must never print keys or credentials.
- Generated Brainmap changes must come from source updates plus a regenerated artifact, not hand editing the generated file.
- Proof should include TestPass, Reviewer, Safety Checker, and Ledger-style evidence where applicable.

## Launchpad Route

- Launchpad routes work from Coordinator to Builder, Tester, Reviewer, Safety Checker, and Ledger PASS.
- Launchpad readiness is represented in `scripts/pinballwake-launchpad-room.mjs` and related tests.
- User-facing control lives in Autopilot admin surfaces, with worker discussion in Boardroom.

## Ledger Rules

- Ledger records proof, approvals, receipts, worker status, rollback notes, and audit trails.
- PASS means proof exists and cleanup is done.
- BLOCKER means a safe reason, checked progress, and next fix are recorded.
- Receipts should use source links, run ids, commit ids, PRs, or generated artifact hashes.

## CI and Stale Guard

| Script | Command |
| --- | --- |
| brainmap:check | node scripts/UnClick-brainmap.mjs --check |
| brainmap:generate | node scripts/UnClick-brainmap.mjs |
| build | vite build |
| build:dev | vite build --mode development |
| lint | eslint . |
| test | vitest run |
| test:api | npm run test --workspace=apps/api |
| test:brainmap | node --test scripts/UnClick-brainmap.test.mjs |
| test:enterprisepass-receipt | node --test scripts/enterprisepass-receipt-guard.test.mjs |
| test:rotatepass-redaction | node --test scripts/rotatepass-redaction-guard.test.mjs |
| test:watch | vitest |

- `node scripts/UnClick-brainmap.mjs --check` fails if `docs/UnClick-brainmap.generated.md` is stale.
- `node --test scripts/UnClick-brainmap.test.mjs` verifies required sections and meaning rows.
