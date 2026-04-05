# web-fetch-mcp

MCP server that fetches web pages as clean, LLM-ready markdown. Uses [Jina Reader](https://r.jina.ai) for most sites and a headless browser with stealth mode for sites with aggressive bot detection.

## Tools

| Tool | Description |
|------|-------------|
| `fetch_page` | Fetch a single URL with pagination support |
| `fetch_pages` | Fetch up to 10 URLs concurrently |

## Prerequisites

- **Docker** — for the Docker install method (recommended, no other dependencies needed)
- **Node.js** (v18+) — for local installation
- **System libraries for Chromium** — only needed for local install if you want to use puppeteer and `STEALTH_HOSTS`.

## Setup

### Option 1: Docker

Add to your MCP client config:

```json
{
  "mcpServers": {
    "web-fetch": {
      "command": "docker",
      "args": [
        "run", "-i", "--rm",
        "-e", "STEALTH_HOSTS=example.com",
        "-e", "DEBUG=1",
        "parsam97/web-fetch-mcp"
      ]
    }
  }
}
```

### Option 2: Clone and build

```bash
git clone https://github.com/parsam97/web-fetch-mcp.git
cd web-fetch-mcp
npm install
npm run build
```

Then add to your MCP client config:

```json
{
  "mcpServers": {
    "web-fetch": {
      "command": "node",
      "args": ["/path/to/web-fetch-mcp/dist/index.js"],
      "env": {
        "STEALTH_HOSTS": "example.com",
        "DEBUG": "1"
      }
    }
  }
}
```

## Features

- **Jina Reader** for fast fetching with JS rendering
- **Puppeteer + stealth plugin** for bot-protected sites (configured via `STEALTH_HOSTS` env var)
- **Mozilla Readability + Turndown** for clean markdown extraction
- **In-memory cache** (30-min TTL) — repeat fetches are instant
- **Concurrency limiting** — caps Puppeteer tabs to prevent OOM
- **Retry with exponential backoff** on 429/5xx/network errors
- **robots.txt compliance**
- **URL normalization** — strips tracking params so equivalent URLs share cache

## Configuration

| Variable | Description |
|----------|-------------|
| `STEALTH_HOSTS` | Comma-separated hostnames that need a stealth headless browser |
| `DEBUG` | Set to `1` to enable debug logging to stderr |

When a fetch fails due to bot detection, the error message will suggest adding the hostname to `STEALTH_HOSTS`.

Make sure you instruct your agent to relay this information to you. If you are configuring a subagent to use this mcp server, instruct **both** the subagent and your main agent (e.g. in `CLAUDE.md`) to relay this information back to you.

Example subagent instructions:

````plaintext
- **CRITICAL — Bot detection errors:** If ANY fetch returns an error mentioning
  `STEALTH_HOSTS`, you must **start your entire response** with a clearly
  separated, prominent block like this:

  ```
  ⚠️ ACTION REQUIRED: MCP Server Configuration Change Needed

  [hostname] blocked the fetch due to bot detection.

  To fix this permanently:
  1. Open your MCP server config
  2. Add "STEALTH_HOSTS": "[hostname]" to the "env" section of the web-fetch server
  3. Restart the MCP server

  Until this is fixed, documentation from [hostname] cannot be fetched.
  ```

  This block MUST appear at the very top of your response — before any
  documentation content. Do NOT bury it at the end, in a footnote, or as a
  "Note" section. The parent agent summarizes your response and will drop
  anything that looks like a minor aside. Making it the first thing ensures
  it gets relayed to the user.

  Do NOT silently skip the failed URL, retry it, or try workarounds.
````

Example agent instructions:

```
# User-level instructions

## MCP STEALTH_HOSTS warnings

When any subagent response mentions `STEALTH_HOSTS` or bot detection blocking a fetch,
you MUST relay this to the user. This is a configuration issue that only the user can fix.
Include the blocked hostname and tell them to add it to `STEALTH_HOSTS` in their MCP server
config. Do not drop or summarize away this information.
```

## Development

```bash
npm run dev
npm test
npm run test:integration
DEBUG=1 npm run dev
```
