import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import TurndownService from "turndown";

const turndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  bulletListMarker: "-",
});

const MIN_EXTRACTION_RATIO = 0.15;

export function htmlToMarkdown(html: string): string | null {
  try {
    const { document } = parseHTML(html);
    const bodyTextLen = document.body?.textContent?.trim().length ?? 0;
    const reader = new Readability(document, { charThreshold: 100 });
    const article = reader.parse();
    if (!article?.content) return null;
    const articleTextLen = article.textContent?.trim().length ?? 0;
    if (bodyTextLen > 1000 && articleTextLen < bodyTextLen * MIN_EXTRACTION_RATIO) {
      return null;
    }
    return turndown.turndown(article.content);
  } catch {
    return null;
  }
}

export function htmlToMarkdownFallback(html: string): string {
  const { document } = parseHTML(html);
  for (const el of document.querySelectorAll(
    "nav, footer, header, script, style, noscript, " +
      '[role="navigation"], [role="banner"]'
  )) {
    el.remove();
  }
  return turndown.turndown(document.body?.innerHTML ?? html);
}
