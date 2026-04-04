import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { withRetry } from "./retry.js";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("withRetry", () => {
  it("returns on first success", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const result = await withRetry(fn);
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries on failure and succeeds", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("fail"))
      .mockResolvedValue("ok");

    const promise = withRetry(fn);
    await vi.advanceTimersByTimeAsync(1000);
    const result = await promise;

    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("uses exponential backoff (1s, 2s, 4s)", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("fail 1"))
      .mockRejectedValueOnce(new Error("fail 2"))
      .mockRejectedValueOnce(new Error("fail 3"))
      .mockResolvedValue("ok");

    const promise = withRetry(fn);

    // First retry after 1s
    await vi.advanceTimersByTimeAsync(1000);
    expect(fn).toHaveBeenCalledTimes(2);

    // Second retry after 2s
    await vi.advanceTimersByTimeAsync(2000);
    expect(fn).toHaveBeenCalledTimes(3);

    // Third retry after 4s
    await vi.advanceTimersByTimeAsync(4000);
    expect(fn).toHaveBeenCalledTimes(4);

    const result = await promise;
    expect(result).toBe("ok");
  });

  it("throws after max attempts exhausted", async () => {
    const fn = vi.fn().mockImplementation(() => {
      throw new Error("always fails");
    });

    let caught: Error | undefined;
    const promise = withRetry(fn, { maxAttempts: 3 }).catch((e) => {
      caught = e;
    });

    await vi.advanceTimersByTimeAsync(1000 + 2000);
    await promise;

    expect(caught).toBeInstanceOf(Error);
    expect(caught!.message).toBe("always fails");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("only retries errors matching shouldRetry predicate", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("client error"));

    const promise = withRetry(fn, {
      maxAttempts: 3,
      shouldRetry: (err) => err instanceof Error && err.message.includes("server"),
    });

    // Should not retry — predicate returns false
    await expect(promise).rejects.toThrow("client error");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("caps delay at maxDelay", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("fail 1"))
      .mockRejectedValueOnce(new Error("fail 2"))
      .mockRejectedValueOnce(new Error("fail 3"))
      .mockResolvedValue("ok");

    const promise = withRetry(fn, {
      maxAttempts: 4,
      initialDelayMs: 1000,
      backoffFactor: 10,
      maxDelayMs: 5000,
    });

    // First retry: 1000ms
    await vi.advanceTimersByTimeAsync(1000);
    expect(fn).toHaveBeenCalledTimes(2);

    // Second retry: would be 10000ms but capped at 5000ms
    await vi.advanceTimersByTimeAsync(5000);
    expect(fn).toHaveBeenCalledTimes(3);

    // Third retry: still capped at 5000ms
    await vi.advanceTimersByTimeAsync(5000);
    expect(fn).toHaveBeenCalledTimes(4);

    const result = await promise;
    expect(result).toBe("ok");
  });
});
