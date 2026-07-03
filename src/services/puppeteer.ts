import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import type { Browser } from "puppeteer";
import { withRetry } from "./retry.js";
import { htmlToMarkdown, htmlToMarkdownFallback } from "./html-to-markdown.js";
import { debug } from "./debug.js";

(puppeteer as any).use(StealthPlugin());

const NAV_TIMEOUT_MS = 30_000;
const CONTENT_WAIT_MS = 10_000;

export interface PuppeteerResult {
  content: string;
  extraction: "readability" | "full-dom";
}

let browserInstance: Browser | null = null;
let browserPromise: Promise<Browser> | null = null;

async function getBrowser(): Promise<Browser> {
  if (browserInstance && browserInstance.connected) return browserInstance;
  if (!browserPromise) {
    browserPromise = (puppeteer as any)
      .launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      })
      .then((b: Browser) => {
        browserInstance = b;
        browserPromise = null;
        return b;
      });
  }
  return browserPromise!;
}

export async function closeBrowser(): Promise<void> {
  const b = browserInstance;
  browserInstance = null;
  if (b) await b.close().catch(() => {});
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

        // Flatten shadow roots into the light DOM, then strip
        // script/style/noscript, so Readability sees content that web
        // components render inside shadow DOM (invisible to it otherwise).
        const rawHtml = await page.evaluate(() => {
          const hosts: Element[] = [];
          const roots: (Document | ShadowRoot)[] = [document];
          while (roots.length) {
            const root = roots.pop()!;
            for (const el of root.querySelectorAll("*")) {
              if (el.shadowRoot) {
                hosts.push(el);
                roots.push(el.shadowRoot);
              }
            }
          }
          // Reverse order inlines nested shadow roots before their ancestors.
          for (let i = hosts.length - 1; i >= 0; i--) {
            const host = hosts[i];
            const frag = document.createElement("div");
            frag.innerHTML = host.shadowRoot!.innerHTML;
            for (const slot of frag.querySelectorAll("slot")) slot.remove();
            host.append(...frag.childNodes);
          }
          for (const el of document.querySelectorAll("script, style, noscript")) {
            el.remove();
          }
          return document.documentElement.outerHTML;
        });

        debug(`puppeteer: extracted ${rawHtml.length} chars of HTML`);
        const readable = htmlToMarkdown(rawHtml);
        const content = readable ?? htmlToMarkdownFallback(rawHtml);
        const extraction = readable ? "readability" : "full-dom";
        debug(`puppeteer: converted to ${content.length} chars of markdown (${extraction})`);

        return { content, extraction };
      } finally {
        await page.close().catch(() => {});
      }
    },
    { maxAttempts: 3 }
  );
}
