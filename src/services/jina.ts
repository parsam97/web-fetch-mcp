import { withRetry } from "./retry.js";
import { debug } from "./debug.js";

const JINA_BASE_URL = "https://r.jina.ai/";
const CHARACTER_LIMIT = 50000;
const FETCH_TIMEOUT_MS = 30000;

export interface JinaResult {
  content: string;
  truncated: boolean;
}

function isRetryable(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  // Network / abort errors
  if (err.name === "AbortError" || err.message.includes("fetch failed")) {
    return true;
  }
  // HTTP 429 or 5xx
  const match = err.message.match(/HTTP (\d+)/);
  if (match) {
    const status = parseInt(match[1], 10);
    return status === 429 || status >= 500;
  }
  return false;
}

export async function fetchViaJina(url: string): Promise<JinaResult> {
  return withRetry(
    async () => {
      debug(`jina: fetching ${url}`);
      const jinaUrl = `${JINA_BASE_URL}${url}`;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

      try {
        const response = await fetch(jinaUrl, {
          headers: {
            Accept: "text/markdown",
            "X-Return-Format": "markdown",
          },
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(
            `Jina Reader returned HTTP ${response.status}: ${response.statusText}`
          );
        }

        debug(`jina: got HTTP ${response.status} for ${url}`);
        let content = await response.text();
        let truncated = false;

        if (content.length > CHARACTER_LIMIT) {
          content = content.slice(0, CHARACTER_LIMIT);
          truncated = true;
        }

        return { content, truncated };
      } finally {
        clearTimeout(timeout);
      }
    },
    { shouldRetry: isRetryable }
  );
}
