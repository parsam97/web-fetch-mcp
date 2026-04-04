import { describe, it, expect } from "vitest";
import { htmlToMarkdown, htmlToMarkdownFallback } from "./html-to-markdown.js";

const ARTICLE_HTML = `
<html><body>
  <nav><a href="/">Home</a></nav>
  <article>
    <h1>Getting Started</h1>
    <p>This is the introduction paragraph with enough content to pass the character threshold for Readability extraction.</p>
    <p>Here is a second paragraph with a <a href="https://example.com">link</a> to demonstrate anchor conversion.</p>
    <h2>Installation</h2>
    <p>Run the following command to install:</p>
    <pre><code>npm install my-package</code></pre>
    <p>That's all you need to get started with the basic setup and configuration of the package.</p>
  </article>
  <footer>Copyright 2025</footer>
</body></html>
`;

const SALESFORCE_LIKE_HTML = `
<html><body>
  <header class="ht-header">Site Header</header>
  <nav role="navigation">Nav links</nav>
  <div class="siteforceContentArea">
    <div class="toc-container"><ul><li>Section 1</li><li>Section 2</li></ul></div>
    <div class="content-body">
      <h1>Named Credentials Overview</h1>
      <p>Named credentials provide a secure way to store and manage authentication details for external services. They simplify callout configuration by separating the endpoint URL and authentication from the callout logic.</p>
      <h2>Benefits</h2>
      <p>Using named credentials offers several advantages including centralized credential management, simplified code, and enhanced security through credential isolation.</p>
    </div>
  </div>
  <div class="cb-section_background">Background decoration</div>
  <footer class="ht-footer">Site Footer</footer>
</body></html>
`;

const MINIMAL_HTML = `<html><body><p>x</p></body></html>`;

const SCRIPT_STYLE_HTML = `
<html><body>
  <script>var x = 1;</script>
  <style>.foo { color: red; }</style>
  <p>Visible content here.</p>
</body></html>
`;

describe("htmlToMarkdown", () => {
  it("extracts article content as markdown", () => {
    const result = htmlToMarkdown(ARTICLE_HTML);
    expect(result).not.toBeNull();
    expect(result).toContain("Getting Started");
    expect(result).toContain("Installation");
    expect(result).toContain("[link](https://example.com)");
  });

  it("produces fenced code blocks", () => {
    const result = htmlToMarkdown(ARTICLE_HTML);
    expect(result).toContain("```");
    expect(result).toContain("npm install my-package");
  });

  it("extracts content from Salesforce-like structure", () => {
    const result = htmlToMarkdown(SALESFORCE_LIKE_HTML);
    expect(result).not.toBeNull();
    expect(result).toContain("Named Credentials Overview");
    expect(result).toContain("centralized credential management");
  });

  it("excludes nav/footer chrome from Salesforce-like pages", () => {
    const result = htmlToMarkdown(SALESFORCE_LIKE_HTML);
    expect(result).not.toBeNull();
    expect(result).not.toContain("Site Header");
    expect(result).not.toContain("Site Footer");
    expect(result).not.toContain("Background decoration");
  });

  it("returns null for empty/unparseable HTML", () => {
    expect(htmlToMarkdown("")).toBeNull();
    expect(htmlToMarkdown("<html><body></body></html>")).toBeNull();
  });
});

describe("htmlToMarkdownFallback", () => {
  it("returns markdown from minimal HTML", () => {
    const result = htmlToMarkdownFallback(MINIMAL_HTML);
    expect(result).toContain("x");
  });

  it("strips script and style tags", () => {
    const result = htmlToMarkdownFallback(SCRIPT_STYLE_HTML);
    expect(result).toContain("Visible content");
    expect(result).not.toContain("var x = 1");
    expect(result).not.toContain("color: red");
  });

  it("strips nav, header, footer", () => {
    const result = htmlToMarkdownFallback(ARTICLE_HTML);
    expect(result).not.toContain("Home");
    expect(result).not.toContain("Copyright 2025");
    expect(result).toContain("Getting Started");
  });
});
