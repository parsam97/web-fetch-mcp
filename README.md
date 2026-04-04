# web-fetch-mcp

MCP server that fetches web pages as clean, LLM-ready markdown. Uses [Jina Reader](https://r.jina.ai) for most sites and a headless browser with stealth mode for sites with aggressive bot detection.

## Tools

| Tool | Description |
|------|-------------|
| `fetch_page` | Fetch a single URL with pagination support |
| `fetch_pages` | Fetch up to 10 URLs concurrently |

## Setup

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

      // optional
      "env": {
        "STEALTH_HOSTS": "help.salesforce.com,example.com",
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

Make sure you instruct your agent to relay this information to you, so you can know to add this to your env variable in the mcpServer config. For example:

```plaintext
## Bot detection errors

If a fetch fails with a message mentioning `STEALTH_HOSTS`, you **must** relay this to the user immediately. Tell them:

1. Which hostname was blocked (it's in the error message)
2. They need to add that hostname to the `STEALTH_HOSTS` environment variable in their MCP server config
3. The format is comma-separated hostnames, e.g. `"STEALTH_HOSTS": "help.salesforce.com,other.example.com"`
4. They need to restart the MCP server after changing the config

Do not silently skip the failed URL or try to work around it. The user needs to know so they can fix their config permanently.
```

## Development

```bash
npm run dev
npm test
npm run test:integration
DEBUG=1 npm run dev
```
