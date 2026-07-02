import { describe, it, expect } from "vitest";
import { paginateContent, DEFAULT_MAX_LENGTH } from "./paginate.js";

const LONG_CONTENT = "a".repeat(10_000);

describe("paginateContent", () => {
  it("returns full content when shorter than max_length", () => {
    const result = paginateContent("short text", 0, 5000);
    expect(result.text).toBe("short text");
    expect(result.hasMore).toBe(false);
  });

  it("truncates content to max_length", () => {
    const result = paginateContent(LONG_CONTENT, 0, 100);
    expect(result.text).toContain("a".repeat(100));
    expect(result.hasMore).toBe(true);
    expect(result.text).toContain("start_index=100");
  });

  it("applies start_index offset", () => {
    const content = "abcdefghij";
    const result = paginateContent(content, 5, 5000);
    expect(result.text).toContain("fghij");
    expect(result.text).toContain("character 5");
    expect(result.hasMore).toBe(false);
  });

  it("combines start_index and max_length", () => {
    const content = "abcdefghij"; // length 10
    const result = paginateContent(content, 2, 3);
    // Should return "cde" (index 2, length 3)
    expect(result.text).toContain("cde");
    expect(result.hasMore).toBe(true);
    expect(result.text).toContain("start_index=5");
  });

  it("returns hasMore=false when slice reaches end", () => {
    const content = "abcdefghij"; // length 10
    const result = paginateContent(content, 7, 5000);
    expect(result.text).toContain("hij");
    expect(result.hasMore).toBe(false);
  });

  it("returns empty slice when start_index is beyond content", () => {
    const result = paginateContent("short", 100, 5000);
    expect(result.hasMore).toBe(false);
  });

  it("includes total length in metadata when paginating", () => {
    const result = paginateContent(LONG_CONTENT, 500, 100);
    expect(result.text).toContain("10000 total");
  });

  it("uses DEFAULT_MAX_LENGTH when max_length is omitted", () => {
    const content = "b".repeat(DEFAULT_MAX_LENGTH + 1000);
    const result = paginateContent(content, 0);
    expect(result.hasMore).toBe(true);
    expect(result.text).toContain(`start_index=${DEFAULT_MAX_LENGTH}`);
  });

  it("prepends a fetch-metadata header when meta is provided", () => {
    const result = paginateContent(LONG_CONTENT, 0, 100, {
      strategy: "puppeteer+stealth",
      extraction: "full-dom",
    });
    expect(result.text.startsWith("[fetch: puppeteer+stealth")).toBe(true);
    expect(result.text).toContain("full-DOM fallback (Readability under-extracted)");
    expect(result.text).toContain("10000 chars total");
    expect(result.text).toContain("showing 0–100");
  });

  it("adds a raw-DOM note only for paginated full-dom extraction", () => {
    const note = "raw page DOM";
    expect(
      paginateContent(LONG_CONTENT, 0, 100, {
        strategy: "puppeteer+stealth",
        extraction: "full-dom",
      }).text
    ).toContain(note);
    expect(
      paginateContent(LONG_CONTENT, 0, 100, {
        strategy: "puppeteer+stealth",
        extraction: "readability",
      }).text
    ).not.toContain(note);
    expect(
      paginateContent("short", 0, 5000, {
        strategy: "puppeteer+stealth",
        extraction: "full-dom",
      }).text
    ).not.toContain(note);
  });

  it("puts a loud partial-content banner before the content when truncated", () => {
    const result = paginateContent(LONG_CONTENT, 0, 100);
    const bannerIdx = result.text.indexOf("⚠️ PARTIAL CONTENT");
    expect(bannerIdx).toBeGreaterThanOrEqual(0);
    expect(bannerIdx).toBeLessThan(result.text.indexOf("aaaa"));
    expect(result.text).toContain("showing 0–100 of 10000 chars (1%)");
    expect(result.text).toContain("start_index=100");
  });

  it("appends a machine-readable JSON footer when paginated", () => {
    const result = paginateContent(LONG_CONTENT, 0, 100);
    const footer = JSON.parse(result.text.slice(result.text.lastIndexOf("\n") + 1));
    expect(footer).toEqual({
      has_more: true,
      next_start_index: 100,
      total_chars: 10000,
      start_index: 0,
      end_index: 100,
      pct_shown: 1,
    });
  });

  it("footer reports has_more=false with null next_start_index on the last page", () => {
    const result = paginateContent(LONG_CONTENT, 9900, 5000);
    const footer = JSON.parse(result.text.slice(result.text.lastIndexOf("\n") + 1));
    expect(footer.has_more).toBe(false);
    expect(footer.next_start_index).toBeNull();
    expect(result.text).not.toContain("⚠️ PARTIAL CONTENT");
  });

  it("omits banner and footer for a complete single-page result", () => {
    const result = paginateContent("short text", 0, 5000);
    expect(result.text).toBe("short text");
  });

  it("omits extraction and window for a single-page jina fetch", () => {
    const result = paginateContent("short text", 0, 5000, { strategy: "jina" });
    expect(result.text).toContain("[fetch: jina · 10 chars total]");
    expect(result.text).not.toContain("extraction:");
    expect(result.text).not.toContain("showing");
  });
});
