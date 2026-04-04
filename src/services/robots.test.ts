import { describe, it, expect, vi, beforeEach } from "vitest";
import { isAllowedByRobots, USER_AGENT, clearRobotsCache } from "./robots.js";

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
  clearRobotsCache();
});

function mockRobotsTxt(body: string, status = 200) {
  mockFetch.mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(body),
  });
}

describe("isAllowedByRobots", () => {
  it("allows when robots.txt permits the path", async () => {
    mockRobotsTxt("User-agent: *\nAllow: /");
    expect(await isAllowedByRobots("https://example.com/page")).toBe(true);
  });

  it("blocks when robots.txt disallows the path", async () => {
    mockRobotsTxt("User-agent: *\nDisallow: /private/");
    expect(await isAllowedByRobots("https://example.com/private/secret")).toBe(
      false
    );
  });

  it("caches robots.txt per origin (only fetches once)", async () => {
    mockRobotsTxt("User-agent: *\nAllow: /");
    await isAllowedByRobots("https://cached.com/page1");
    await isAllowedByRobots("https://cached.com/page2");
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("fetches separately for different origins", async () => {
    mockRobotsTxt("User-agent: *\nAllow: /");
    mockRobotsTxt("User-agent: *\nDisallow: /");
    await isAllowedByRobots("https://a.com/page");
    await isAllowedByRobots("https://b.com/page");
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("allows everything when robots.txt fetch fails (404)", async () => {
    mockRobotsTxt("", 404);
    expect(await isAllowedByRobots("https://norobots.com/anything")).toBe(true);
  });

  it("allows everything when robots.txt fetch throws", async () => {
    mockFetch.mockRejectedValueOnce(new Error("network error"));
    expect(await isAllowedByRobots("https://down.com/page")).toBe(true);
  });

  it("uses our user agent string for matching", async () => {
    mockRobotsTxt(
      `User-agent: ${USER_AGENT}\nDisallow: /blocked/\n\nUser-agent: *\nAllow: /`
    );
    expect(await isAllowedByRobots("https://specific.com/blocked/page")).toBe(
      false
    );
    // Other paths still allowed
    expect(await isAllowedByRobots("https://specific.com/open/page")).toBe(
      true
    );
  });
});
