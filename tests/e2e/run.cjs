/* End-to-end checks against a running server (default http://localhost:3000).
 *   node tests/e2e/run.cjs [baseUrl]
 * Uses the Playwright that ships with the environment.
 */
const { chromium, devices } = require("playwright");
const path = require("path");
const fs = require("fs");
const BASE = process.argv[2] || "http://localhost:3000";
const AXE = fs.readFileSync(require.resolve("axe-core/axe.min.js", { paths: [path.join(__dirname, "../..")] }), "utf8");

const results = [];
async function step(name, fn) {
  try {
    const info = await fn();
    results.push({ name, ok: true, info });
    console.log(`  ✓ ${name}${info ? ` — ${info}` : ""}`);
  } catch (e) {
    results.push({ name, ok: false, info: e.message });
    console.log(`  ✗ ${name} — ${e.message.split("\n")[0]}`);
  }
}
const assert = (c, m) => {
  if (!c) throw new Error(m);
};
const num = (s) => Number(String(s).replace(/[^\d.]/g, ""));
const axe = async (page) => {
  await page.addScriptTag({ content: AXE });
  const r = await page.evaluate(async () => {
    const x = await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] } });
    return { passes: x.passes.length, v: x.violations.map((v) => `${v.id}(${v.nodes.length}): ${v.nodes[0].target.join(" ")}`) };
  });
  assert(r.v.length === 0, r.v.join(" | "));
  return `${r.passes} rules passed, 0 violations`;
};

/** Test-only fixture used to exercise the "price available" rendering when Groww refuses this account. Never served by the app. */
const fixture = (lastTradeTime) => ({
  serverTime: new Date().toISOString(),
  contract: { tradingSymbol: "GOLDTEN30NOV26FUT", expiry: "2026-11-30" },
  quote: { lastPrice: 135335, dayChange: -75.5, dayChangePct: -0.06, open: 135200, high: 135600, low: 135100, close: 135410.5, lastTradeTime, volume: 1234, openInterest: 5678 },
  status: "live",
  fetchedAt: new Date().toISOString(),
  ticks: [
    { t: lastTradeTime - 60000, p: 135300 },
    { t: lastTradeTime, p: 135335 },
  ],
});

(async () => {
  const browser = await chromium.launch();
  const req = (await browser.newContext()).request;
  let api;

  console.log("API (real Groww call)");
  await step("GET /api/mcx resolves the current Gold Ten contract from Groww", async () => {
    const r = await req.get(`${BASE}/api/mcx`);
    api = await r.json();
    assert(api.contract && /^GOLDTEN\d{2}[A-Z]{3}\d{2}FUT$/.test(api.contract.tradingSymbol), `contract ${JSON.stringify(api.contract)}`);
    return `${api.contract.tradingSymbol} (expires ${api.contract.expiry})`;
  });
  await step("quote is either a real price or an honest error (never a fallback)", async () => {
    if (api.quote) {
      assert(api.status === "live" || api.status === "stale", api.status);
      assert(api.quote.lastPrice > 0, "bad price");
      return `LIVE ₹${api.quote.lastPrice} (status ${api.status})`;
    }
    assert(api.status === "error" || api.status === "unconfigured", api.status);
    assert(api.error && api.error.length > 10, "no error message");
    return `no price · status ${api.status} · "${api.error.slice(0, 90)}…"`;
  });
  await step("removed endpoints are gone", async () => {
    for (const p of ["/api/rate", "/api/market", "/api/history"]) assert((await req.get(`${BASE}${p}`)).status() === 404, `${p} still served`);
    return "/api/rate, /api/market, /api/history → 404";
  });

  console.log("Page with the real API response");
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errs = [];
  const hosts = new Set();
  page.on("pageerror", (e) => errs.push(e.message));
  page.on("request", (r) => hosts.add(new URL(r.url()).host));
  await step("page renders the MCX price, or the unavailable notice with Groww's reason", async () => {
    await page.goto(BASE, { waitUntil: "networkidle" });
    if (api.quote) {
      const ltp = num(await page.textContent("[data-testid=mcx-ltp]"));
      assert(Math.abs(ltp - api.quote.lastPrice) < 1, `${ltp} vs ${api.quote.lastPrice}`);
      return `₹${ltp}`;
    }
    const t = await page.textContent("[data-testid=mcx-unavailable]");
    assert(t.includes("isn’t available") && t.includes("No estimated, old or substitute price"), t);
    assert((await page.locator("[data-testid=mcx-ltp]").count()) === 0, "price shown without data");
    const badge = (await page.locator("#price [data-slot=badge]").first().textContent()).trim();
    return `notice shown · badge "${badge}"`;
  });
  await step("only the MCX price: no GST totals, coin comparison, calculator or other sources", async () => {
    const body = await page.textContent("body");
    for (const bad of ["incl. GST", "OroPocket", "Compare 10 g", "Calculator", "Making charge", "Estimated price", "US$", "World Bank", "gold-api"]) assert(!body.includes(bad), `found "${bad}"`);
    for (const id of ["coins", "calculator", "rate"]) assert((await page.locator(`#${id}`).count()) === 0, `#${id} still present`);
    const ext = [...hosts].filter((h) => !h.startsWith("localhost"));
    assert(ext.length === 0, `browser contacted ${ext}`);
    return "no GST, coins, calculator, OroPocket or third-party requests";
  });
  await step("accessibility (axe) — unavailable state", async () => axe(page));
  await step("no page errors", async () => assert(errs.length === 0, errs.join(" | ")));

  console.log("Rendering with a test fixture (Groww response shape)");
  const f = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  await step("live quote: price, change, OHLC passed through without GST", async () => {
    const now = Date.now();
    await f.route("**/api/mcx", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(fixture(now - 30000)) }));
    await f.goto(BASE, { waitUntil: "networkidle" });
    assert(num(await f.textContent("[data-testid=mcx-ltp]")) === 135335, "ltp");
    const chg = await f.textContent("[data-testid=mcx-change]");
    assert(chg.includes("−₹75.5") && chg.includes("−0.06%"), chg);
    const det = await f.textContent("[data-testid=mcx-details]");
    for (const v of ["₹1,35,200", "₹1,35,600", "₹1,35,100", "₹1,35,410.5", "1,234", "5,678"]) assert(det.includes(v), `missing ${v} in ${det}`);
    const badge = (await f.locator("#price [data-slot=badge]").first().textContent()).trim();
    assert(badge.startsWith("Live"), badge);
    assert((await f.textContent("body")).includes("GOLDTEN30NOV26FUT"), "contract not shown");
    return `₹1,35,335 · "${chg.trim()}" · badge "${badge}"`;
  });
  await step("quiet market: shows last trade time, badge Delayed", async () => {
    await f.unroute("**/api/mcx");
    await f.route("**/api/mcx", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(fixture(Date.now() - 3 * 3600_000)) }));
    await f.reload({ waitUntil: "networkidle" });
    assert((await f.textContent("#price")).includes("No trades in the last 10 minutes"), "quiet message missing");
    const badge = (await f.locator("#price [data-slot=badge]").first().textContent()).trim();
    assert(badge.startsWith("Delayed"), badge);
    return badge;
  });
  await step("accessibility (axe) — price state", async () => axe(f));

  console.log("Mobile");
  const m = await (await browser.newContext({ ...devices["iPhone 13"] })).newPage();
  await m.route("**/api/mcx", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(fixture(Date.now() - 30000)) }));
  await step("no horizontal scroll; price readable", async () => {
    await m.goto(BASE, { waitUntil: "networkidle" });
    const [sw, iw] = await m.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
    assert(sw <= iw, `${sw} > ${iw}`);
    assert(await m.locator("[data-testid=mcx-ltp]").isVisible(), "price hidden");
    return `scrollWidth ${sw}/${iw}`;
  });
  await step("accessibility (axe) — mobile", async () => axe(m));

  await browser.close();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  fs.writeFileSync(path.join(__dirname, "last-run.json"), JSON.stringify({ base: BASE, at: new Date().toISOString(), results }, null, 2));
  process.exit(failed.length ? 1 : 0);
})();
