import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as cache from "./cache.js";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("cache", () => {
  it("returns undefined for a missing key", () => {
    expect(cache.get("nonexistent")).toBeUndefined();
  });

  it("stores and retrieves a value", () => {
    cache.set("key1", { content: "hello", truncated: false });
    expect(cache.get("key1")).toEqual({ content: "hello", truncated: false });
  });

  it("expires entries after TTL (30 minutes)", () => {
    cache.set("key-ttl", "data");
    expect(cache.get("key-ttl")).toBe("data");

    // Advance 29 minutes — still valid
    vi.advanceTimersByTime(29 * 60 * 1000);
    expect(cache.get("key-ttl")).toBe("data");

    // Advance past 30 minutes — expired
    vi.advanceTimersByTime(2 * 60 * 1000);
    expect(cache.get("key-ttl")).toBeUndefined();
  });

  it("overwrites existing entries", () => {
    cache.set("key-overwrite", "old");
    cache.set("key-overwrite", "new");
    expect(cache.get("key-overwrite")).toBe("new");
  });

  it("overwrite resets the TTL", () => {
    cache.set("key-reset", "v1");
    vi.advanceTimersByTime(25 * 60 * 1000);

    // Overwrite refreshes timestamp
    cache.set("key-reset", "v2");
    vi.advanceTimersByTime(25 * 60 * 1000);

    // 25 min after refresh — still valid
    expect(cache.get("key-reset")).toBe("v2");
  });
});
