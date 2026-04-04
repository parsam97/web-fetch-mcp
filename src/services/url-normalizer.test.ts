import { describe, it, expect } from "vitest";
import { normalizeUrl } from "./url-normalizer.js";

describe("normalizeUrl", () => {
  it("returns undefined for invalid URLs", () => {
    expect(normalizeUrl("not-a-url")).toBeUndefined();
    expect(normalizeUrl("")).toBeUndefined();
  });

  it("strips whitespace from input", () => {
    expect(normalizeUrl("  https://example.com/page  ")).toBe(
      "https://example.com/page"
    );
    expect(normalizeUrl("https://example .com/page")).toBe(
      "https://example.com/page"
    );
  });

  it("rejects non-http(s) protocols", () => {
    expect(normalizeUrl("ftp://example.com/file")).toBeUndefined();
    expect(normalizeUrl("data:text/html,<h1>hi</h1>")).toBeUndefined();
  });

  it("lowercases the hostname", () => {
    expect(normalizeUrl("https://Example.COM/path")).toBe(
      "https://example.com/path"
    );
  });

  it("removes www. prefix", () => {
    expect(normalizeUrl("https://www.example.com/page")).toBe(
      "https://example.com/page"
    );
  });

  it("removes default ports (80 for http, 443 for https)", () => {
    expect(normalizeUrl("https://example.com:443/page")).toBe(
      "https://example.com/page"
    );
    expect(normalizeUrl("http://example.com:80/page")).toBe(
      "http://example.com/page"
    );
  });

  it("keeps non-default ports", () => {
    expect(normalizeUrl("https://example.com:8080/page")).toBe(
      "https://example.com:8080/page"
    );
  });

  it("strips hash fragments", () => {
    expect(normalizeUrl("https://example.com/page#section")).toBe(
      "https://example.com/page"
    );
  });

  it("strips UTM parameters", () => {
    expect(
      normalizeUrl(
        "https://example.com/page?utm_source=google&utm_medium=cpc&key=val"
      )
    ).toBe("https://example.com/page?key=val");
  });

  it("strips tracking parameters (fbclid, gclid, ref, etc.)", () => {
    expect(
      normalizeUrl("https://example.com/page?fbclid=abc123&gclid=def456&q=test")
    ).toBe("https://example.com/page?q=test");
  });

  it("strips session ID parameters", () => {
    expect(
      normalizeUrl(
        "https://example.com/page?phpsessid=abc&jsessionid=def&id=123"
      )
    ).toBe("https://example.com/page?id=123");
  });

  it("sorts remaining query parameters alphabetically", () => {
    expect(normalizeUrl("https://example.com/page?z=1&a=2&m=3")).toBe(
      "https://example.com/page?a=2&m=3&z=1"
    );
  });

  it("removes the query string entirely when all params are stripped", () => {
    expect(
      normalizeUrl("https://example.com/page?utm_source=google&fbclid=abc")
    ).toBe("https://example.com/page");
  });

  it("removes trailing slash on path", () => {
    expect(normalizeUrl("https://example.com/page/")).toBe(
      "https://example.com/page"
    );
  });

  it("preserves root path", () => {
    expect(normalizeUrl("https://example.com/")).toBe("https://example.com/");
    expect(normalizeUrl("https://example.com")).toBe("https://example.com/");
  });

  it("handles a complex real-world URL", () => {
    expect(
      normalizeUrl(
        "https://WWW.Example.COM:443/docs/page/?utm_source=twitter&utm_campaign=launch&ref=homepage&id=42&lang=en#section-3"
      )
    ).toBe("https://example.com/docs/page?id=42&lang=en");
  });
});
