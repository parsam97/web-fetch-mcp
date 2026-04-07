import { describe, it, expect } from "vitest";
import { fetchDocPage } from "./fetch-doc.js";

describe("fetchDocPage", () => {
  describe("stealth-hosted sites (Puppeteer)", () => {
    it("returns meaningful markdown from a bot-protected page", async () => {
      const result = await fetchDocPage(
        "https://help.salesforce.com/s/articleView?id=sf.named_credentials_about.htm&type=5&language=en_US"
      );

      expect(result).toHaveProperty("content");
      expect(result).toHaveProperty("truncated");
      expect(typeof result.content).toBe("string");
      expect(typeof result.truncated).toBe("boolean");
      expect(result.content.length).toBeGreaterThan(500);

      // Structural markdown checks — validates the extraction pipeline
      expect(result.content).toMatch(/^#+\s/m); // has at least one markdown heading
      expect(result.content).not.toContain("<script");
      expect(result.content).not.toContain("<nav");
      expect(result.content).not.toContain("<style");
    }, 60_000);
  });

  describe("standard sites (Jina)", () => {
    it("returns meaningful markdown from a JS-rendered page", async () => {
      const result = await fetchDocPage(
        "https://developer.salesforce.com/docs/platform/named-credentials/guide/get-started.html"
      );

      expect(result).toHaveProperty("content");
      expect(result).toHaveProperty("truncated");
      expect(result.content.length).toBeGreaterThan(500);

      // Jina returns markdown — same structural checks
      expect(result.content).toMatch(/^#+\s/m);
      expect(result.content).not.toContain("<script");
      expect(result.content).not.toContain("<nav");
    }, 60_000);
  });
});
