# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Generic MCP server for fetching web page content as clean, LLM-ready text. Exposes `fetch_page` and `fetch_pages` tools. Uses Jina Reader for most sites and a headless browser with stealth mode for bot-protected sites (configured via `STEALTH_HOSTS` env var).

## Build & Run Commands

```bash
npm run build      # tsc — compile TypeScript to dist/
npm run dev        # tsx src/index.ts — run in dev mode (no compile step)
npm start          # node dist/index.js — run compiled output
npm test           # vitest — run integration tests (hits real URLs, ~20s)
```

## Tech Stack

- Node.js + TypeScript (ESM, `"type": "module"`)
- `@modelcontextprotocol/sdk` for MCP server implementation
- Jina Reader (`r.jina.ai/<url>`) for fetching rendered pages as markdown
- Puppeteer + `puppeteer-extra-plugin-stealth` for bot-protected sites
- In-memory cache (per-session, 30-minute TTL)

## Architecture

### Fetching Strategy

`fetchDocPage(url)` in `src/services/fetch-doc.ts` routes requests:

- **Most sites** → Jina Reader (fast, handles JS rendering)
- **Stealth hosts** → Puppeteer with stealth plugin (slower, bypasses bot detection)

The `STEALTH_HOSTS` set in `fetch-doc.ts` controls which hostnames require the headless browser path. It's populated from the `STEALTH_HOSTS` environment variable (comma-separated hostnames) — no hardcoded defaults. When Jina fails with a 4xx on an unknown host, the error message suggests adding the hostname to `STEALTH_HOSTS`.

### MCP Tools

Two tools: `fetch_page` (single URL) and `fetch_pages` (up to 10 URLs concurrently). Both accept optional `start_index` and `max_length` for paginating through large content without re-fetching (content is cached).

### Caching

Simple in-memory `Map` with 30-minute TTL in `src/services/cache.ts`. Keyed on raw URL. Cleared when the process exits.

## Design Decisions & History

### Why Jina + Puppeteer (not just one)

Jina Reader handles JS rendering for most sites, but some sites (like help.salesforce.com) use aggressive bot detection that Jina's headless Chrome can't bypass — it lacks stealth fingerprinting. We confirmed this by testing: Jina returns a "Loading" shell with CAPTCHA warnings for help.salesforce.com. Puppeteer with `puppeteer-extra-plugin-stealth` patches browser fingerprinting and bypasses these checks.

We also investigated help.salesforce.com's internal Aura/Experience Cloud API extensively (trying `fetchArticleContent`, `getArticleVersionId`, etc. via the `/s/sfsites/aura` endpoint). All content-fetching actions are blocked for guest users at the API level, even though the browser renders content. The site bootstraps a full Aura session with guest credentials that we can't replicate without essentially building a headless browser — making Puppeteer the only viable free approach.

### Why a single `fetch_page` tool

This MCP is strictly the **fetching layer**. We decomposed the problem into three layers:

1. **Discovery** — "find me URLs about X" (Google CSE, Stack Exchange API, etc.) — lives in agent config / separate tools, NOT in this MCP
2. **Fetching** — "get me content at this URL" — **this MCP**
3. **Cleanup/Interpretation** — domain-specific post-processing — lives in agent instructions

This project started as a Salesforce-specific docs MCP (with Google CSE search built in), but was deliberately generalized after realizing the fetching logic has nothing to do with Salesforce.

### Why not use an existing web-fetch MCP

We evaluated Jina's official MCP, Firecrawl MCP, Anthropic's fetch server, and others. None handle bot-protected sites like help.salesforce.com — they all fail on aggressive anti-bot detection. Firecrawl's paid stealth mode still can't guarantee success on enterprise-grade protections, and it costs 5 credits per attempt. Our local Puppeteer+stealth approach works and costs nothing.

## Implemented Optimizations

- **Mozilla Readability** — article content extraction in Puppeteer path
- **URL normalization before caching** — strips tracking params so equivalent URLs share a cache entry
- **Retry with exponential backoff** — on 429/5xx/network errors
- **Parallel URL reads** — `fetch_pages` tool with semaphore-based concurrency limiting
- **robots.txt compliance** — respects crawling policies by default
- **Configurable stealth hosts** — `STEALTH_HOSTS` env var with actionable error messages when bot detection is suspected

## Key URLs

- Jina Reader: `https://r.jina.ai/<url>`
- MCP SDK: https://github.com/modelcontextprotocol/typescript-sdk
