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

async function launchBrowser(): Promise<Browser> {
  return (puppeteer as any).launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
}

export async function fetchViaPuppeteer(url: string): Promise<PuppeteerResult> {
  return withRetry(
    async () => {
      debug(`puppeteer: launching page for ${url}`);
      const browser = await launchBrowser();
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

        // Strip script/style/noscript in-page to keep Readability fast and
        // avoid OOM on multi-MB Aura/SPA pages, then hand the whole document
        // to Readability so it can find the article on its own.
        const rawHtml = await page.evaluate(() => {
          for (const el of document.querySelectorAll("script, style, noscript")) {
            el.remove();
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
        await page.close().catch(() => {});
        await browser.close().catch(() => {});
      }
    },
    { maxAttempts: 3 }
  );
}
