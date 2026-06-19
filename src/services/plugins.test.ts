import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  findHandler,
  registerHandlers,
  clearHandlers,
  loadPlugins,
  type Handler,
} from "./plugins.js";

function fakeHandler(name: string, pattern: string): Handler {
  return {
    name,
    matches: (url) => url.includes(pattern),
    fetch: async () => ({ content: `from ${name}` }),
  };
}

describe("plugin registry", () => {
  beforeEach(() => clearHandlers());

  it("findHandler returns the first matching handler in registration order", () => {
    registerHandlers([fakeHandler("a", "foo"), fakeHandler("b", "foo")]);
    expect(findHandler("https://x/foo")?.name).toBe("a");
  });

  it("findHandler returns null when nothing matches", () => {
    registerHandlers([fakeHandler("a", "foo")]);
    expect(findHandler("https://x/bar")).toBeNull();
  });

  it("skips a handler whose matches() throws and continues", () => {
    const boom: Handler = {
      name: "boom",
      matches: () => {
        throw new Error("bad matcher");
      },
      fetch: async () => ({ content: "" }),
    };
    registerHandlers([boom, fakeHandler("ok", "foo")]);
    expect(findHandler("https://x/foo")?.name).toBe("ok");
  });

  it("clearHandlers empties the registry", () => {
    registerHandlers([fakeHandler("a", "foo")]);
    clearHandlers();
    expect(findHandler("https://x/foo")).toBeNull();
  });
});

describe("loadPlugins", () => {
  let dir: string;
  let counter = 0;
  const original = process.env.FETCH_PLUGINS;

  beforeEach(() => {
    clearHandlers();
    dir = mkdtempSync(join(tmpdir(), "wfm-plugins-"));
  });

  afterEach(() => {
    if (original === undefined) delete process.env.FETCH_PLUGINS;
    else process.env.FETCH_PLUGINS = original;
    rmSync(dir, { recursive: true, force: true });
  });

  function writePlugin(body: string): string {
    const file = join(dir, `plugin-${counter++}.mjs`);
    writeFileSync(file, body);
    return file;
  }

  it("loads handlers from a valid plugin module", async () => {
    const file = writePlugin(
      `export const handlers = [{ name: "atlas", matches: (u) => u.includes("atlas"), fetch: async () => ({ content: "hi" }) }];`
    );
    process.env.FETCH_PLUGINS = file;
    await loadPlugins();
    expect(findHandler("https://x/atlas")?.name).toBe("atlas");
  });

  it("skips a module with no handlers export without throwing", async () => {
    const file = writePlugin(`export const notHandlers = [];`);
    process.env.FETCH_PLUGINS = file;
    await expect(loadPlugins()).resolves.toBeUndefined();
    expect(findHandler("https://x/atlas")).toBeNull();
  });

  it("skips handlers with an invalid shape", async () => {
    const file = writePlugin(
      `export const handlers = [{ name: "broken" }, { name: "good", matches: (u) => true, fetch: async () => ({ content: "x" }) }];`
    );
    process.env.FETCH_PLUGINS = file;
    await loadPlugins();
    expect(findHandler("https://anything")?.name).toBe("good");
  });

  it("registers nothing when FETCH_PLUGINS is unset", async () => {
    delete process.env.FETCH_PLUGINS;
    await loadPlugins();
    expect(findHandler("https://x/atlas")).toBeNull();
  });
});
