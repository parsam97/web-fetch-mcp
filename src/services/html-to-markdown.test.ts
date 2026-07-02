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

const bigNav = Array.from(
  { length: 400 },
  (_, i) =>
    `<li><a href="/page-${i}">Navigation link number ${i} pointing to a documentation topic</a></li>`
).join("");

// Short but complete article buried under a very large navigation menu —
// the article is a tiny slice of total page text, but Readability extracted
// it correctly and it should NOT be discarded as under-extraction.
const NAV_HEAVY_SHORT_ARTICLE_HTML = `
<html><body>
  <nav role="navigation"><ul>${bigNav}</ul></nav>
  <article>
    <h1>Permission Set Licenses</h1>
    <p>${"Permission set licenses entitle users to access additional features not included in their assigned user license. ".repeat(20)}</p>
    <p>${"Users can be assigned any number of permission set licenses to expand their access. ".repeat(20)}</p>
  </article>
</body></html>
`;

// "community" class matches Readability's unlikely-candidates regex; a low charThreshold accepts the banners and skips the retry that recovers the article
const BANNERED_COMMUNITY_HTML = `
<html><body>
  <div class="announcements">
    <p>Upcoming Mandatory Changes to Public Key Infrastructure (PKI). Read More.</p>
    <p>New Security Requirements Enforced in Summer 2026. Read More.</p>
  </div>
  <div class="cb-section forceCommunitySection">
    <div class="ui-widget">
      <h1>Standard User Licenses</h1>
      <p>${"Seat-based license, designed for users who need access to custom apps but not to standard CRM functionality. ".repeat(5)}</p>
      <p>${"Users with this license can access core platform functionality, such as accounts, contacts, reports, dashboards, documents, and custom tabs. ".repeat(5)}</p>
    </div>
  </div>
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

  it("recovers an article inside an unlikely-candidate wrapper despite short banners", () => {
    const result = htmlToMarkdown(BANNERED_COMMUNITY_HTML);
    expect(result).not.toBeNull();
    expect(result).toContain("Standard User Licenses");
    expect(result).toContain("core platform functionality");
    expect(result).not.toContain("Public Key Infrastructure");
    expect(result!.length).toBeGreaterThan(500);
  });

  it("keeps a short but complete article on a nav-heavy page", () => {
    const result = htmlToMarkdown(NAV_HEAVY_SHORT_ARTICLE_HTML);
    expect(result).not.toBeNull();
    expect(result).toContain("Permission Set Licenses");
    expect(result).not.toContain("Navigation link number");
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
