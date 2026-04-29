# SEOPass product brief and build plan

SEOPass is the search visibility sibling to TestPass and UXPass. It gives agents a repeatable way to inspect whether a site can be crawled, understood, ranked, and cited by search engines and AI answer systems.

## Wedge

Most SEO tooling is built for specialists and dashboards. SEOPass is built for agents. The first version should answer four questions quickly: can crawlers reach the site, can search engines understand the page, does Lighthouse show obvious quality gaps, and is the content structured enough for AI search surfaces.

## Chunk 1 scope

This chip is a scaffold only. It adds the SEOPass pack schema, a core pack, a Lighthouse execution-plan helper, four MCP tools, and this product brief. It does not run Lighthouse, write database rows, or create UI.

## MCP tools

- `seopass_run` returns a planned run for a URL or registered pack.
- `seopass_status` reserves the status shape for the later persistence chip.
- `seopass_register_pack` validates and stores a YAML pack locally.
- `seopass_lighthouse_plan` builds the Lighthouse plan that later execution will consume.

## Build sequence

1. Chunk 1: schema, pack, MCP tools, Lighthouse plan, brief.
2. Chunk 2: execute Lighthouse and persist SEOPass runs/findings.
3. Chunk 3: crawler checks for robots, sitemap, canonical, redirects, and internal links.
4. Chunk 4: admin UI, reports, and Fishbowl/Signals routing.

## Positioning

TestPass checks agent tools. UXPass checks user experience. SEOPass checks whether the public web can find and trust the page.
