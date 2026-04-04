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

async function main() {
  try {
    await testPuppeteerPath();
    await testJinaPath();
  } finally {
    await closeBrowser();
  }

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
