import { describe, it, expect } from "vitest";
import { paginateContent } from "./paginate.js";

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

  it("uses default max_length of 5000", () => {
    const content = "b".repeat(6000);
    const result = paginateContent(content, 0);
    expect(result.hasMore).toBe(true);
    expect(result.text).toContain("start_index=5000");
  });
});
