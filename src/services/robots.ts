import robotsParser_ from "robots-parser";

const robotsParser = robotsParser_ as unknown as (
  url: string,
  robotstxt: string
) => {
  isAllowed(url: string, ua?: string): boolean | undefined;
};

type Robots = ReturnType<typeof robotsParser>;

export const USER_AGENT = "WebFetchMCP/1.0";

const FETCH_TIMEOUT_MS = 5_000;

// Cache parsed robots.txt per origin
const cache = new Map<string, Robots>();

/** Clear the robots.txt cache. Exported for testing. */
export function clearRobotsCache(): void {
  cache.clear();
}

async function fetchRobotsTxt(
  origin: string
): Promise<Robots> {
  const url = `${origin}/robots.txt`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!response.ok) {
      // No robots.txt or error → allow everything
      return robotsParser(url, "");
    }

    const body = await response.text();
    return robotsParser(url, body);
  } catch {
    // Network error → allow everything
    return robotsParser(url, "");
  }
}

async function getRobots(
  origin: string
): Promise<Robots> {
  const cached = cache.get(origin);
  if (cached) return cached;

  const robots = await fetchRobotsTxt(origin);
  cache.set(origin, robots);
  return robots;
}

export async function isAllowedByRobots(url: string): Promise<boolean> {
  const origin = new URL(url).origin;
  const robots = await getRobots(origin);
  return robots.isAllowed(url, USER_AGENT) ?? true;
}
