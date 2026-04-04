#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { fetchDocPage } from "./services/fetch-doc.js";
import { paginateContent, DEFAULT_MAX_LENGTH } from "./services/paginate.js";

const server = new McpServer({
  name: "web-fetch-mcp",
  version: "0.1.0",
});

server.registerTool(
  "fetch_page",
  {
    title: "Fetch Web Page",
    description: `Fetch a web page and return its content as clean text.

Uses Jina Reader for most sites. Falls back to a headless browser with stealth mode for sites with aggressive bot detection (configurable via the stealth_hosts list).

Args:
  - url (string): Full URL of the page to fetch
  - start_index (number): Character offset to start returning content from (default: 0). Use this to paginate through large pages without re-fetching.
  - max_length (number): Maximum characters to return per call (default: ${DEFAULT_MAX_LENGTH}). Adjust based on how much content you need.

Returns:
  Page content as text, plus metadata about total length and whether more content is available.`,
    inputSchema: {
      url: z
        .string()
        .url("Must be a valid URL")
        .describe("Full URL of the web page to fetch"),
      start_index: z
        .number()
        .int()
        .min(0)
        .default(0)
        .describe(
          "Character offset to start from. Use to paginate through large content."
        ),
      max_length: z
        .number()
        .int()
        .min(1)
        .max(1_000_000)
        .default(DEFAULT_MAX_LENGTH)
        .describe(
          "Maximum characters to return. Increase for more content per call, decrease to save context."
        ),
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  async ({ url, start_index, max_length }) => {
    try {
      const { content } = await fetchDocPage(url);
      const { text } = paginateContent(content, start_index, max_length);

      return {
        content: [{ type: "text" as const, text }],
      };
    } catch (error) {
      return {
        isError: true,
        content: [
          {
            type: "text" as const,
            text: `Error fetching page: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }
);

server.registerTool(
  "fetch_pages",
  {
    title: "Fetch Multiple Web Pages",
    description: `Fetch multiple web pages concurrently and return their content.

Same as fetch_page but accepts an array of URLs (up to 10). Fetches run in parallel with automatic concurrency limiting to prevent memory issues.

Each URL can have its own pagination parameters. Results are returned in order, one per URL. Partial failures are reported per-URL — a single failed URL does not block the others.

Args:
  - urls: Array of objects, each with:
    - url (string): Full URL of the page to fetch
    - start_index (number): Character offset (default: 0)
    - max_length (number): Max characters to return (default: ${DEFAULT_MAX_LENGTH})`,
    inputSchema: {
      urls: z
        .array(
          z.object({
            url: z
              .string()
              .url("Must be a valid URL")
              .describe("Full URL of the web page to fetch"),
            start_index: z
              .number()
              .int()
              .min(0)
              .default(0)
              .describe("Character offset to start from."),
            max_length: z
              .number()
              .int()
              .min(1)
              .max(1_000_000)
              .default(DEFAULT_MAX_LENGTH)
              .describe("Maximum characters to return."),
          })
        )
        .min(1)
        .max(10)
        .describe("Array of URLs to fetch with optional pagination parameters."),
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  async ({ urls }) => {
    const results = await Promise.allSettled(
      urls.map(({ url, start_index, max_length }) =>
        fetchDocPage(url).then(({ content }) => ({
          url,
          ...paginateContent(content, start_index, max_length),
        }))
      )
    );

    const contentItems = results.map((result, i) => {
      const url = urls[i].url;
      const label = `--- [${i + 1}/${urls.length}] ${url} ---`;

      if (result.status === "fulfilled") {
        return { type: "text" as const, text: `${label}\n${result.value.text}` };
      }

      const errMsg =
        result.reason instanceof Error
          ? result.reason.message
          : String(result.reason);
      return { type: "text" as const, text: `${label}\nError: ${errMsg}` };
    });

    const allFailed = results.every((r) => r.status === "rejected");

    return {
      ...(allFailed ? { isError: true } : {}),
      content: contentItems,
    };
  }
);

// --- Start server ---

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("web-fetch-mcp server running via stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
