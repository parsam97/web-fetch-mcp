import { fetchViaJina } from "./jina.js";
import { fetchViaPuppeteer } from "./puppeteer.js";
import * as cache from "./cache.js";
import { normalizeUrl } from "./url-normalizer.js";
import { isAllowedByRobots } from "./robots.js";

export interface DocFetchResult {
  content: string;
  truncated: boolean;
}

// Hosts that require a stealth headless browser because they block
// standard fetchers (Jina, curl, etc.) with bot detection / CAPTCHAs.
const STEALTH_HOSTS = new Set([
  "help.salesforce.com",
]);

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
  if (cached) return cached;

  if (!(await isAllowedByRobots(url))) {
    throw new Error(
      `Blocked by robots.txt: ${url}. The site's robots.txt disallows fetching this path.`
    );
  }

  const result = needsStealth(url)
    ? await fetchViaPuppeteer(url)
    : await fetchViaJina(url);

  cache.set(cacheKey, result);
  return result;
}
