import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import type { Browser } from "puppeteer";
import { withRetry } from "./retry.js";
import { htmlToMarkdown, htmlToMarkdownFallback } from "./html-to-markdown.js";
import { debug } from "./debug.js";

(puppeteer as any).use(StealthPlugin());

const CHARACTER_LIMIT = 50_000;
const NAV_TIMEOUT_MS = 30_000;
const CONTENT_WAIT_MS = 10_000;

export interface PuppeteerResult {
  content: string;
  truncated: boolean;
}

let browserInstance: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (browserInstance && browserInstance.connected) {
    return browserInstance;
  }
  browserInstance = await (puppeteer as any).launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  return browserInstance!;
}

export async function fetchViaPuppeteer(url: string): Promise<PuppeteerResult> {
  return withRetry(
    async () => {
      debug(`puppeteer: launching page for ${url}`);
      const browser = await getBrowser();
      const page = await browser.newPage();

      try {
        await page.setUserAgent(
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        );

        await page.goto(url, {
          waitUntil: "networkidle2",
          timeout: NAV_TIMEOUT_MS,
        });

        // Wait for meaningful content to render (not just a loading shell).
        // Try specific content selectors first, fall back to generic ones.
        await page
          .waitForFunction(
            () => {
              for (const sel of [".siteforceContentArea", "article", "main", "[role='main']"]) {
                const el = document.querySelector(sel);
                if (el && el.textContent && el.textContent.trim().length > 200) {
                  return true;
                }
              }
              return false;
            },
            { timeout: CONTENT_WAIT_MS }
          )
          .catch(() => {});

        // Extract a focused HTML fragment from the page to avoid OOM
        // when parsing multi-MB Aura/SPA pages with linkedom.
        const rawHtml = await page.evaluate(() => {
          for (const sel of [".siteforceContentArea", "article", "main", "[role='main']"]) {
            const el = document.querySelector(sel);
            if (el && el.textContent && el.textContent.trim().length > 200) {
              return `<html><body>${el.outerHTML}</body></html>`;
            }
          }
          return document.documentElement.outerHTML;
        });

        debug(`puppeteer: extracted ${rawHtml.length} chars of HTML`);
        let content = htmlToMarkdown(rawHtml) ?? htmlToMarkdownFallback(rawHtml);
        debug(`puppeteer: converted to ${content.length} chars of markdown`);

        let truncated = false;
        if (content.length > CHARACTER_LIMIT) {
          content = content.slice(0, CHARACTER_LIMIT);
          truncated = true;
        }

        return { content, truncated };
      } finally {
        await page.close();
      }
    },
    { maxAttempts: 3 }
  );
}

export async function closeBrowser(): Promise<void> {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
  }
}
