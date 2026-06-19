import { isAbsolute } from "node:path";
import { pathToFileURL } from "node:url";
import { debug } from "./debug.js";

export interface Handler {
  name: string;
  matches(url: string): boolean;
  fetch(url: string): Promise<{ content: string }>;
}

let registry: Handler[] = [];

export function registerHandlers(handlers: Handler[]): void {
  registry.push(...handlers);
}

export function clearHandlers(): void {
  registry = [];
}

export function findHandler(url: string): Handler | null {
  for (const handler of registry) {
    try {
      if (handler.matches(url)) return handler;
    } catch (err) {
      console.error(
        `[web-fetch-mcp] plugin "${handler.name}" matches() threw for ${url}: ${errText(err)}`
      );
    }
  }
  return null;
}

function isValidHandler(h: unknown): h is Handler {
  return (
    !!h &&
    typeof h === "object" &&
    typeof (h as Record<string, unknown>).name === "string" &&
    typeof (h as Record<string, unknown>).matches === "function" &&
    typeof (h as Record<string, unknown>).fetch === "function"
  );
}

function errText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export async function loadPlugins(): Promise<void> {
  const specifiers =
    process.env.FETCH_PLUGINS?.split(",").map(s => s.trim()).filter(Boolean) ?? [];

  if (specifiers.length === 0) {
    debug("plugins: none configured");
    return;
  }

  for (const spec of specifiers) {
    try {
      const importSpec = isAbsolute(spec) ? pathToFileURL(spec).href : spec;
      const mod = await import(importSpec);

      if (!Array.isArray(mod.handlers)) {
        console.error(
          `[web-fetch-mcp] plugin "${spec}" has no exported "handlers" array; skipping.`
        );
        continue;
      }

      const valid: Handler[] = mod.handlers.filter(isValidHandler);
      const skipped = mod.handlers.length - valid.length;
      if (skipped > 0) {
        console.error(
          `[web-fetch-mcp] plugin "${spec}": ${skipped} handler(s) had an invalid shape and were skipped.`
        );
      }

      registerHandlers(valid);
      debug(
        `plugins: loaded ${valid.length} handler(s) from ${spec}: ${valid.map(h => h.name).join(", ")}`
      );
    } catch (err) {
      console.error(`[web-fetch-mcp] failed to load plugin "${spec}": ${errText(err)}`);
    }
  }

  debug(`plugins: ${registry.length} handler(s) registered`);
}
