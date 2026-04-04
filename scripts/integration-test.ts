/**
 * Standalone integration test runner.
 * Run with: npx tsx scripts/integration-test.ts
 *
 * Bypasses vitest workers to avoid OOM with Puppeteer + linkedom.
 */
import { fetchDocPage } from "../src/services/fetch-doc.js";
import { closeBrowser } from "../src/services/puppeteer.js";

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`  FAIL: ${msg}`);
    failed++;
  } else {
    console.log(`  PASS: ${msg}`);
    passed++;
  }
}

async function testPuppeteerPath() {
  console.log("\n--- Puppeteer path (help.salesforce.com) ---");
  const result = await fetchDocPage(
    "https://help.salesforce.com/s/articleView?id=sf.named_credentials_about.htm&type=5&language=en_US"
  );

  assert(typeof result.content === "string", "content is a string");
  assert(typeof result.truncated === "boolean", "truncated is a boolean");
  assert(result.content.length > 500, `content length ${result.content.length} > 500`);
  assert(/^#+\s/m.test(result.content), "contains markdown heading");
  assert(!result.content.includes("<script"), "no <script> tags");
  assert(!result.content.includes("<nav"), "no <nav> tags");
  assert(!result.content.includes("<style"), "no <style> tags");

  console.log(`\n  Preview (first 500 chars):\n${result.content.slice(0, 500)}`);
}

async function testJinaPath() {
  console.log("\n--- Jina path (developer.salesforce.com) ---");
  const result = await fetchDocPage(
    "https://developer.salesforce.com/docs/platform/named-credentials/guide/get-started.html"
  );

  assert(typeof result.content === "string", "content is a string");
  assert(typeof result.truncated === "boolean", "truncated is a boolean");
  assert(result.content.length > 500, `content length ${result.content.length} > 500`);
  assert(/^#+\s/m.test(result.content), "contains markdown heading");
  assert(!result.content.includes("<script"), "no <script> tags");
  assert(!result.content.includes("<nav"), "no <nav> tags");

  console.log(`\n  Preview (first 500 chars):\n${result.content.slice(0, 500)}`);
}

async function testFetchPagesParallel() {
  console.log("\n--- fetch_pages: parallel fetch of 2 URLs ---");
  const urls = [
    "https://developer.salesforce.com/docs/platform/named-credentials/guide/get-started.html",
    "https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_callouts_named_credentials.htm",
  ];

  const start = Date.now();
  const results = await Promise.all(urls.map((u) => fetchDocPage(u)));
  const elapsed = Date.now() - start;

  for (let i = 0; i < results.length; i++) {
    assert(results[i].content.length > 200, `URL ${i + 1}: content length ${results[i].content.length} > 200`);
    assert(/^#+\s/m.test(results[i].content), `URL ${i + 1}: contains markdown heading`);
  }
  console.log(`  Fetched ${urls.length} URLs in ${elapsed}ms`);
}

async function testFetchPagesSequentialCache() {
  console.log("\n--- fetch_pages: sequential calls share cache ---");

  // First call — should fetch fresh (or hit cache from previous test)
  const url = "https://developer.salesforce.com/docs/platform/named-credentials/guide/get-started.html";
  const first = await fetchDocPage(url);

  // Second call — must be a cache hit with identical content
  const start = Date.now();
  const second = await fetchDocPage(url);
  const elapsed = Date.now() - start;

  assert(second.content === first.content, "cached content is identical");
  assert(elapsed < 50, `cache hit took ${elapsed}ms (expected < 50ms)`);
}

async function testCrossToolCacheSharing() {
  console.log("\n--- cache sharing: fetch_page then fetch_pages hit same cache ---");

  // This URL was fetched by testJinaPath or testFetchPagesParallel above
  const url = "https://developer.salesforce.com/docs/platform/named-credentials/guide/get-started.html";

  const start = Date.now();
  const result = await fetchDocPage(url);
  const elapsed = Date.now() - start;

  assert(result.content.length > 200, `content length ${result.content.length} > 200`);
  assert(elapsed < 50, `cross-tool cache hit took ${elapsed}ms (expected < 50ms)`);
}

async function main() {
  try {
    await testPuppeteerPath();
    await testJinaPath();
    await testFetchPagesParallel();
    await testFetchPagesSequentialCache();
    await testCrossToolCacheSharing();
  } finally {
    await closeBrowser();
  }

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
