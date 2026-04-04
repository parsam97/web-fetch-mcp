import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchViaJina } from "./jina.js";

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
  vi.useFakeTimers();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  mockFetch.mockReset();
});

describe("fetchViaJina", () => {
  it("returns content on success", async () => {
    mockFetch.mockResolvedValue(new Response("# Hello", { status: 200 }));

    const result = await fetchViaJina("https://example.com/page");
    expect(result.content).toBe("# Hello");
    expect(result.truncated).toBe(false);
  });

  it("on 403, suggests adding hostname to STEALTH_HOSTS", async () => {
    mockFetch.mockResolvedValue(new Response("", { status: 403, statusText: "Forbidden" }));

    await expect(fetchViaJina("https://blocked.example.com/page")).rejects.toThrow(
      /add "blocked\.example\.com" to the STEALTH_HOSTS environment variable/
    );
  });

  it("on 403, includes the HTTP status in the message", async () => {
    mockFetch.mockResolvedValue(new Response("", { status: 403, statusText: "Forbidden" }));

    await expect(fetchViaJina("https://blocked.example.com/page")).rejects.toThrow(
      /HTTP 403/
    );
  });

  it("on 429, does NOT suggest STEALTH_HOSTS (it's rate limiting, not bot detection)", async () => {
    mockFetch.mockResolvedValue(new Response("", { status: 429, statusText: "Too Many Requests" }));

    let caught: Error | undefined;
    const promise = fetchViaJina("https://example.com/page").catch((e) => { caught = e; });

    // Advance through all retry delays (1s + 2s + 4s)
    await vi.advanceTimersByTimeAsync(1000 + 2000 + 4000 + 1000);
    await promise;

    expect(caught).toBeInstanceOf(Error);
    expect(caught!.message).toMatch(/HTTP 429/);
    expect(caught!.message).not.toMatch(/STEALTH_HOSTS/);
  });

  it("on 200 with CAPTCHA warning, suggests adding hostname to STEALTH_HOSTS", async () => {
    const captchaBody = [
      "Warning: This page maybe requiring CAPTCHA, please make sure you are authorized to access this page.",
      "# Salesforce Help",
      "Loading",
    ].join("\n");
    mockFetch.mockResolvedValue(new Response(captchaBody, { status: 200 }));

    await expect(fetchViaJina("https://help.salesforce.com/s/article")).rejects.toThrow(
      /add "help\.salesforce\.com" to the STEALTH_HOSTS environment variable/
    );
  });

  it("on 200 with 'not yet fully loaded' warning, suggests STEALTH_HOSTS", async () => {
    const loadingBody = "Warning: This page maybe not yet fully loaded, consider explicitly specify a timeout.\n# Loading";
    mockFetch.mockResolvedValue(new Response(loadingBody, { status: 200 }));

    await expect(fetchViaJina("https://protected.example.com/page")).rejects.toThrow(
      /CAPTCHA or loading shell.*add "protected\.example\.com" to the STEALTH_HOSTS/
    );
  });

  it("on 5xx, does NOT suggest STEALTH_HOSTS (server error, not bot detection)", async () => {
    mockFetch.mockResolvedValue(new Response("", { status: 500, statusText: "Internal Server Error" }));

    let caught: Error | undefined;
    const promise = fetchViaJina("https://example.com/page").catch((e) => { caught = e; });

    await vi.advanceTimersByTimeAsync(1000 + 2000 + 4000 + 1000);
    await promise;

    expect(caught).toBeInstanceOf(Error);
    expect(caught!.message).toMatch(/HTTP 500/);
    expect(caught!.message).not.toMatch(/STEALTH_HOSTS/);
  });
});
