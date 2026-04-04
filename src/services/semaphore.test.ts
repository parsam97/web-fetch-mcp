import { describe, it, expect } from "vitest";
import { Semaphore } from "./semaphore.js";

describe("Semaphore", () => {
  it("serializes execution at concurrency 1", async () => {
    const sem = new Semaphore(1);
    const order: number[] = [];

    const task = (id: number, ms: number) =>
      sem.run(
        () =>
          new Promise<void>((resolve) => {
            order.push(id);
            setTimeout(resolve, ms);
          })
      );

    await Promise.all([task(1, 30), task(2, 10), task(3, 10)]);
    expect(order).toEqual([1, 2, 3]);
  });

  it("allows concurrent execution up to the limit", async () => {
    const sem = new Semaphore(3);
    let peak = 0;
    let running = 0;

    const task = () =>
      sem.run(async () => {
        running++;
        peak = Math.max(peak, running);
        await new Promise((r) => setTimeout(r, 20));
        running--;
      });

    await Promise.all([task(), task(), task(), task(), task()]);
    expect(peak).toBe(3);
  });

  it("releases slot on error (no deadlock)", async () => {
    const sem = new Semaphore(1);

    const failing = sem.run(async () => {
      throw new Error("boom");
    });
    await expect(failing).rejects.toThrow("boom");

    // Next task should acquire the slot fine
    const result = await sem.run(async () => "ok");
    expect(result).toBe("ok");
  });

  it("resolves immediately when under the limit", async () => {
    const sem = new Semaphore(5);
    const results = await Promise.all([
      sem.run(async () => 1),
      sem.run(async () => 2),
      sem.run(async () => 3),
    ]);
    expect(results).toEqual([1, 2, 3]);
  });
});
