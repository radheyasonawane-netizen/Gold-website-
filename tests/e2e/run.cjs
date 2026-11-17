/* End-to-end checks against a running server (default http://localhost:3000).
 * Uses the Playwright that ships with the environment:
 *   NODE_USE_ENV_PROXY=1 node tests/e2e/run.cjs [baseUrl]
 * (NODE_USE_ENV_PROXY is only needed behind an HTTPS proxy, for the raw OroPocket comparison.)
 */
const { chromium, devices } = require("playwright");
const path = require("path");
const fs = require("fs");
const BASE = process.argv[2] || "http://localhost:3000";
const AXE = fs.readFileSync(require.resolve("axe-core/axe.min.js", { paths: [path.join(__dirname, "../..")] }), "utf8");

const results = [];
async function step(name, fn) {
  const t0 = Date.now();
  try {
    const info = await fn();
    results.push({ name, ok: true, ms: Date.now() - t0, info });
    console.log(`  ✓ ${name}${info ? ` — ${info}` : ""}`);
  } catch (e) {
    results.push({ name, ok: false, ms: Date.now() - t0, info: e.message });
    console.log(`  ✗ ${name} — ${e.message.split("\n")[0]}`);
  }
}
const assert = (c, m) => {
  if (!c) throw new Error(m);
};
const num = (s) => Number(String(s).replace(/[^\d.]/g, ""));
const axeRun = (page) =>
  page.evaluate(async () => {
    const r = await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] } });
    return { passes: r.passes.length, violations: r.violations.map((x) => `${x.id}(${x.nodes.length}): ${x.nodes[0].target.join(" ")}`) };
  });

(async () => {
  const browser = await chromium.launch();
  const req = (await browser.newContext()).request;
  let rate;

  console.log("API");
  await step("GET /api/rate returns OroPocket's current rate", async () => {
    const r = await req.get(`${BASE}/api/rate`);
    assert(r.ok(), `status ${r.status()}`);
    rate = await r.json();
    const g = rate.quote.gold;
    assert(rate.status === "live", `status ${rate.status}`);
    assert(Math.abs(g.finalBuy - (g.buy + g.gst)) < 1e-9, "finalBuy != buy + gst");
    assert(Math.abs(g.gst / g.buy - 0.03) < 0.0005, "GST is not 3% of buy");
    const age = (Date.now() - Date.parse(rate.quote.timestamp)) / 60000;
    assert(age < 60, `rate is ${age.toFixed(0)} min old`);
    return `₹${g.finalBuy}/g incl. GST (buy ₹${g.buy} + GST ₹${g.gst}) · rate age ${age.toFixed(1)} min`;
  });
  await step("server value matches the raw OroPocket API", async () => {
    const raw = await (await fetch("https://api.oropocket.com/public/prices")).json(); // Node fetch honours HTTPS_PROXY with NODE_USE_ENV_PROXY=1
    if (raw.data.timestamp !== rate.quote.timestamp) return `OroPocket moved on since our 2-min cache (${rate.quote.timestamp} → ${raw.data.timestamp}); skipped exact match`;
    assert(raw.data.gold.buy === rate.quote.gold.buy && raw.data.gold.sell === rate.quote.gold.sell && raw.data.gold.gst === rate.quote.gold.gst, "values differ");
    return `exact match at ${raw.data.timestamp}`;
  });
  await step("no international or removed endpoints remain", async () => {
    for (const p of ["/api/market", "/api/history", "/api/health", "/api/sellers"]) {
      const s = (await req.get(`${BASE}${p}`)).status();
      assert(s === 404, `${p} → ${s}`);
    }
    return "/api/market, /history, /health, /sellers → 404";
  });

  console.log("Desktop");
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  const hosts = new Set();
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("request", (r) => hosts.add(new URL(r.url()).host));
  let perf;
  await step("hero shows the 10 g rate incl. GST matching the API", async () => {
    await page.goto(BASE, { waitUntil: "networkidle" });
    perf = await page.evaluate(() => {
      const n = performance.getEntriesByType("navigation")[0];
      const fcp = performance.getEntriesByName("first-contentful-paint")[0];
      return { fcp: fcp ? Math.round(fcp.startTime) : null, load: Math.round(n.loadEventEnd), kb: Math.round(performance.getEntriesByType("resource").reduce((a, r) => a + (r.transferSize || 0), n.transferSize || 0) / 1024) };
    });
    const api = await (await req.get(`${BASE}/api/rate`)).json();
    const ten = num(await page.textContent("[data-testid=rate-10g]"));
    assert(Math.abs(ten - api.quote.gold.finalBuy * 10) <= 1, `hero ${ten} vs ${api.quote.gold.finalBuy * 10}`);
    const one = num(await page.textContent("[data-testid=rate-1g]"));
    assert(Math.abs(one - api.quote.gold.finalBuy) < 0.01, "per-gram mismatch");
    const badge = await page.locator("#rate [data-slot=badge]").first().textContent();
    assert(/Current|Delayed/.test(badge), badge);
    return `₹${ten.toLocaleString("en-IN")}/10 g · badge "${badge.trim()}" · FCP ${perf.fcp} ms · load ${perf.load} ms · ${perf.kb} KB`;
  });
  await step("purity table derives 22K and 18K from 24K", async () => {
    const api = await (await req.get(`${BASE}/api/rate`)).json();
    const cells = await page.locator("[data-testid=purity-table] tbody tr td:nth-child(3)").allTextContents();
    const [k24, k22, k18] = cells.map(num);
    const f = api.quote.gold.finalBuy * 10;
    assert(Math.abs(k24 - f) <= 1 && Math.abs(k22 - (f * 0.916) / 0.999) <= 1 && Math.abs(k18 - (f * 0.75) / 0.999) <= 1, `${cells}`);
    return `24K ${cells[0]} · 22K ${cells[1]} · 18K ${cells[2]}`;
  });
  await step("page uses only Indian data: no international figures or hosts", async () => {
    const txt = await page.textContent("body");
    for (const bad of ["US$", "troy", "XAU", "USD/INR", "parity", "World Bank", "gold-api", "ECB"]) assert(!txt.includes(bad), `found "${bad}"`);
    const external = [...hosts].filter((h) => !h.startsWith("localhost"));
    assert(external.length === 0, `browser contacted ${external.join(", ")}`);
    return "no USD/oz, FX, parity or third-party requests from the browser";
  });
  await step("coin comparison: 10 brands, enter prices, ranking, sort, persist, clear", async () => {
    await page.locator("#coins").scrollIntoViewIfNeeded();
    const rows = "[data-testid=coin-table] [data-testid=coin-row]";
    assert((await page.locator(rows).count()) === 10, "expected 10 brands");
    const api = await (await req.get(`${BASE}/api/rate`)).json();
    const ref = api.quote.gold.finalBuy;
    const fill = async (id, v) => {
      await page.fill(`#price-${id}`, String(v));
      await page.press(`#price-${id}`, "Enter");
    };
    await fill("tanishq", 151000);
    await fill("mmtcpamp", 149500);
    await fill("augmont", 146800);
    await page.fill("#price-kalyan", "12");
    await page.press("#price-kalyan", "Enter");
    assert(await page.locator("text=Enter the 10 g price in ₹").isVisible(), "invalid input not flagged");
    await page.fill("#price-kalyan", "");
    await page.press("#price-kalyan", "Enter");
    const order = await page.locator(rows).evaluateAll((els) => els.slice(0, 3).map((e) => e.getAttribute("data-brand")));
    // MMTC-PAMP is 999.9 by default: 149500 × 0.999/0.9999 = 149,365 per 10 g (999)
    assert(order.join() === "augmont,mmtcpamp,tanishq", `order ${order}`);
    const first = page.locator(rows).first();
    const per10 = num(await first.locator("td:nth-child(5)").textContent());
    assert(Math.abs(per10 - 146800) <= 1, `augmont per10 ${per10}`);
    const prem = num((await first.locator("td:nth-child(6)").textContent()).split("+")[0]);
    assert(Math.abs(prem - (146800 - ref * 10)) <= 1, `premium ${prem} vs ${146800 - ref * 10}`);
    assert((await page.textContent("[data-testid=coins-lowest]")).includes("1,46,800"), "lowest card wrong");
    await page.getByRole("button", { name: /Brand/ }).click();
    const byName = await page.locator(rows).evaluateAll((els) => els.slice(0, 3).map((e) => e.getAttribute("data-brand")));
    assert(byName.join() === "augmont,mmtcpamp,tanishq", `brand sort ${byName}`);
    assert((await page.locator("th[aria-sort=ascending]").count()) === 1, "aria-sort missing");
    await page.reload({ waitUntil: "networkidle" });
    assert((await page.inputValue("#price-tanishq")) === "151000", "price not persisted");
    assert(await page.locator(`${rows} >> text=Entered`).first().isVisible(), "entered time missing");
    await page.getByRole("button", { name: `Clear Tanishq price` }).first().click();
    await page.waitForFunction(() => document.querySelector("#price-tanishq")?.value === "", null, { timeout: 5000 }).catch(() => {});
    assert((await page.inputValue("#price-tanishq")) === "", "clear failed");
    return `ranked augmont < mmtcpamp(999.9→999) < tanishq · premium ₹${prem.toLocaleString("en-IN")} · persisted & cleared`;
  });
  await step("calculator: 10 g 24K equals the rate; 22K with 12% making", async () => {
    const api = await (await req.get(`${BASE}/api/rate`)).json();
    const buy = api.quote.gold.buy;
    await page.locator("#calculator").scrollIntoViewIfNeeded();
    await page.fill("#grams", "10");
    await page.fill("#making", "0");
    const t1 = num(await page.textContent("[data-testid=calc-total]"));
    assert(Math.abs(t1 - buy * 10 * 1.03) <= 1, `${t1} vs ${buy * 10 * 1.03}`);
    await page.selectOption("#purity", "916");
    await page.fill("#making", "12");
    const t2 = num(await page.textContent("[data-testid=calc-total]"));
    const e2 = ((buy * 0.916 * 10) / 0.999) * 1.12 * 1.03;
    assert(Math.abs(t2 - e2) <= 1, `${t2} vs ${e2}`);
    return `₹${t1.toLocaleString("en-IN")} · ₹${t2.toLocaleString("en-IN")}`;
  });
  await step("accessibility (axe, WCAG 2.1 AA) on desktop", async () => {
    await page.addScriptTag({ content: AXE });
    const r = await axeRun(page);
    assert(r.violations.length === 0, r.violations.join(" | "));
    return `${r.passes} rules passed, 0 violations`;
  });
  await step("no console errors", async () => assert(errors.length === 0, errors.slice(0, 3).join(" | ")));
  await ctx.close();

  console.log("Mobile (iPhone 13)");
  const m = await (await browser.newContext({ ...devices["iPhone 13"] })).newPage();
  await step("no horizontal scroll; coin cards; menu and dock navigate", async () => {
    await m.goto(BASE, { waitUntil: "networkidle" });
    const [sw, iw] = await m.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
    assert(sw <= iw, `scrollWidth ${sw} > ${iw}`);
    assert((await m.locator("[data-testid=coin-cards] li").count()) === 10, "10 cards expected");
    assert(!(await m.locator("[data-testid=coin-table]").isVisible()), "table should hide on mobile");
    await m.getByRole("button", { name: "Open menu" }).click();
    await m.getByRole("dialog").getByRole("link", { name: "Calculator" }).click();
    await m.waitForTimeout(1600);
    const top = await m.evaluate(() => document.getElementById("calculator").getBoundingClientRect().top);
    assert(Math.abs(top) < 140, `calculator top ${top}`);
    assert(await m.getByRole("navigation", { name: "Quick sections" }).isVisible(), "dock missing");
    return `scrollWidth ${sw}/${iw}`;
  });
  await step("accessibility (axe) on mobile", async () => {
    await m.addScriptTag({ content: AXE });
    const r = await axeRun(m);
    assert(r.violations.length === 0, r.violations.join(" | "));
  });

  console.log("Loading & error states");
  const e = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  await step("skeleton while the rate loads", async () => {
    let release;
    const gate = new Promise((r) => (release = r));
    await e.route("**/api/rate", async (route) => {
      await gate;
      await route.continue();
    });
    await e.goto(BASE, { waitUntil: "domcontentloaded" });
    await e.waitForSelector("[data-slot=skeleton]");
    release();
    await e.waitForSelector("[data-testid=rate-10g]");
    await e.unroute("**/api/rate");
  });
  await step("OroPocket down: error shown, never a made-up price", async () => {
    await e.route("**/api/rate", (route) => route.fulfill({ status: 502, contentType: "application/json", body: JSON.stringify({ serverTime: new Date().toISOString(), quote: null, status: "error", fetchedAt: null, error: "HTTP 503 from api.oropocket.com", ticks: [] }) }));
    await e.goto(BASE, { waitUntil: "networkidle" });
    const alert = await e.locator("#rate [role=alert]").textContent();
    assert(/unavailable/i.test(alert) && /No old or estimated price/.test(alert), alert);
    assert((await e.locator("[data-testid=rate-10g]").count()) === 0, "price shown during outage");
    const badge = await e.locator("#rate [data-slot=badge]").first().textContent();
    assert(/Unavailable/.test(badge), badge);
    await e.unroute("**/api/rate");
    await e.locator("#rate").getByRole("button", { name: "Retry" }).click();
    await e.waitForSelector("[data-testid=rate-10g]");
    return "alert + Unavailable badge; Retry recovered";
  });
  await browser.close();

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  fs.writeFileSync(path.join(__dirname, "last-run.json"), JSON.stringify({ base: BASE, at: new Date().toISOString(), perf, results }, null, 2));
  process.exit(failed.length ? 1 : 0);
})();
