import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import TurndownService from "turndown";

const turndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  bulletListMarker: "-",
});

export function htmlToMarkdown(html: string): string | null {
  try {
    const { document } = parseHTML(html);
    const reader = new Readability(document, { charThreshold: 100 });
    const article = reader.parse();
    if (!article?.content) return null;
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
