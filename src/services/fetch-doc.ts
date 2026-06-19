import { fetchViaJina } from "./jina.js";
import { fetchViaPuppeteer } from "./puppeteer.js";
import * as cache from "./cache.js";
import { normalizeUrl } from "./url-normalizer.js";
import { isAllowedByRobots } from "./robots.js";
import { Semaphore } from "./semaphore.js";
import { findHandler } from "./plugins.js";
import { debug } from "./debug.js";

export interface DocFetchResult {
  content: string;
}

const MAX_CONTENT_CHARS = 10_000_000;

function capContent(content: string): string {
  if (content.length <= MAX_CONTENT_CHARS) return content;
  const notice =
    `⚠️ This page was very large (${content.length} characters) and has been ` +
    `truncated to the first ${MAX_CONTENT_CHARS}.\n\n`;
  return notice + content.slice(0, MAX_CONTENT_CHARS);
}

// Hosts that require a stealth headless browser because they block
// standard fetchers (Jina, curl, etc.) with bot detection / CAPTCHAs.
// Configured via the STEALTH_HOSTS env var (comma-separated hostnames).
const STEALTH_HOSTS = new Set(
  process.env.STEALTH_HOSTS?.split(",").map(h => h.trim().toLowerCase()).filter(Boolean) ?? []
);
debug(`stealth hosts: ${STEALTH_HOSTS.size ? [...STEALTH_HOSTS].join(", ") : "(none)"}`);

// Concurrency limiters — Puppeteer tabs are ~200MB each, Jina is lightweight HTTP
const stealthSemaphore = new Semaphore(2);
const jinaSemaphore = new Semaphore(5);

function needsStealth(url: string): boolean {
  try {
    return STEALTH_HOSTS.has(new URL(url).hostname);
  } catch {
    return false;
  }
}

export async function fetchDocPage(url: string): Promise<DocFetchResult> {
  const cacheKey = normalizeUrl(url) ?? url;

  const cached = cache.get<DocFetchResult>(cacheKey);
  if (cached) {
    debug(`cache hit: ${url}`);
    return cached;
  }

  if (!(await isAllowedByRobots(url))) {
    debug(`blocked by robots.txt: ${url}`);
    throw new Error(
      `Blocked by robots.txt: ${url}. The site's robots.txt disallows fetching this path.`
    );
  }

  const handler = findHandler(url);
  if (handler) {
    debug(`fetching via plugin ${handler.name}: ${url}`);
    const { content } = await jinaSemaphore.run(() => handler.fetch(url));
    const result: DocFetchResult = { content: capContent(content) };
    debug(`fetched ${result.content.length} chars via plugin ${handler.name}: ${url}`);
    cache.set(cacheKey, result);
    return result;
  }

  const stealth = needsStealth(url);
  const path = stealth ? "puppeteer" : "jina";
  debug(`fetching via ${path}: ${url}`);

  const semaphore = stealth ? stealthSemaphore : jinaSemaphore;
  const { content } = await semaphore.run(() =>
    stealth ? fetchViaPuppeteer(url) : fetchViaJina(url)
  );

  const result: DocFetchResult = { content: capContent(content) };
  debug(`fetched ${result.content.length} chars: ${url}`);
  cache.set(cacheKey, result);
  return result;
}
