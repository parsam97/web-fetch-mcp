const SESSION_PARAMS = new Set([
  "s",
  "session",
  "sid",
  "sessionid",
  "phpsessid",
  "jsessionid",
  "aspsessionid",
  "asp.net_sessionid",
]);

const TRACKING_PARAMS = new Set([
  "ref",
  "referrer",
  "fbclid",
  "gclid",
  "cid",
  "mcid",
  "source",
  "medium",
  "campaign",
  "term",
  "content",
  "sc_rid",
]);

/**
 * Normalize a URL for use as a cache key.
 * Strips tracking/session params, fragments, www prefix, default ports,
 * lowercases hostname, and sorts remaining query params.
 * Returns undefined for invalid URLs.
 */
export function normalizeUrl(raw: string): string | undefined {
  let url: URL;
  try {
    url = new URL(raw.replace(/\s+/g, "").trim());
  } catch {
    return undefined;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return undefined;
  }

  // Lowercase hostname, strip www.
  url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");

  // Remove default ports
  if (
    (url.protocol === "https:" && url.port === "443") ||
    (url.protocol === "http:" && url.port === "80")
  ) {
    url.port = "";
  }

  // Strip hash
  url.hash = "";

  // Filter and sort query params
  const filtered: [string, string][] = [];
  for (const [key, value] of url.searchParams) {
    const lower = key.toLowerCase();
    if (lower.startsWith("utm_")) continue;
    if (lower.startsWith("mc_")) continue;
    if (SESSION_PARAMS.has(lower)) continue;
    if (TRACKING_PARAMS.has(lower)) continue;
    filtered.push([key, value]);
  }

  filtered.sort(([a], [b]) => a.localeCompare(b));

  // Rebuild search string
  url.search = "";
  for (const [key, value] of filtered) {
    url.searchParams.append(key, value);
  }

  // Remove trailing slash from pathname (but keep root "/")
  if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
    url.pathname = url.pathname.slice(0, -1);
  }

  return url.toString();
}
