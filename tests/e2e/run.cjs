/* End-to-end checks against a running server (default http://localhost:3000).
 * Uses the Playwright that ships with the environment: node tests/e2e/run.cjs [baseUrl]
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
const parseInr = (s) => Number(String(s).replace(/[^\d.]/g, ""));

(async () => {
  const browser = await chromium.launch();
  const req = await (await browser.newContext()).request;

  console.log("API connectivity");
  let market;
  await step("GET /api/market returns live, consistent data", async () => {
    const r = await req.get(`${BASE}/api/market`);
    assert(r.ok(), `status ${r.status()}`);
    market = await r.json();
    const d = market.derived;
    assert(d && d.per10g24k999 > 0, "no derived prices");
    const fine = market.goldInr.pricePerOz / 31.1034768;
    assert(Math.abs(d.finePerGram - fine) < 1e-6, "fine/gram mismatch");
    assert(Math.abs(d.per10g24k999 - fine * 9.99) < 1e-6, "24K per 10g mismatch");
    assert(Math.abs(d.fxCrossCheckDiff) < 0.02, `FX cross-check off by ${(d.fxCrossCheckDiff * 100).toFixed(2)}%`);
    const age = Date.now() - Date.parse(market.goldUsd.updatedAt);
    return `24K ₹${Math.round(d.per10g24k999).toLocaleString("en-IN")}/10g · spot age ${Math.round(age / 1000)}s · FX diff ${(d.fxCrossCheckDiff * 100).toFixed(3)}%`;
  });
  await step("OroPocket: server values match the raw public API", async () => {
    const raw = await (await fetch("https://api.oropocket.com/public/prices")).json(); // Node fetch: honours HTTPS_PROXY with NODE_USE_ENV_PROXY=1
    const o = market.oroPocket;
    assert(o, "oroPocket missing from /api/market");
    const g = raw.data.gold;
    // Server caches 5 min; OroPocket refreshes ~30 min, so values normally match exactly.
    if (raw.data.timestamp === o.timestamp) {
      assert(o.gold.buy === g.buy && o.gold.sell === g.sell && Math.abs(o.gold.gst - g.gst) < 1e-9, "gold buy/sell/gst mismatch");
    }
    assert(Math.abs(o.gold.finalBuy - (o.gold.buy + o.gold.gst)) < 1e-9, "finalBuy != buy + gst");
    assert(Math.abs(o.gold.gst / o.gold.buy - 0.03) < 0.0005, "GST is not 3% of buy");
    const prem = o.gold.buy / (market.derived.finePerGram * 0.999) - 1;
    assert(Math.abs(prem - market.derived.oroPremiumOverParity) < 1e-12, "premium formula mismatch");
    return `buy ₹${g.buy}/g + GST ₹${g.gst} = ₹${(g.buy + g.gst).toFixed(2)} · sell ₹${g.sell} · rate time ${raw.data.timestamp} · premium ${(prem * 100).toFixed(2)}%`;
  });
  await step("GET /api/history serves monthly data with attribution", async () => {
    const r = await req.get(`${BASE}/api/history?range=10Y`);
    const h = await r.json();
    assert(r.ok() && h.points.length >= 100, `points ${h.points?.length}`);
    assert(h.source === "world-bank" || h.source === "gold-api-history", "unknown source");
    assert(h.points.every((p) => p.inrPer10g > 0), "missing INR values");
    const p = h.points.at(-1);
    assert(Math.abs(p.inrPer10g - (p.usdPerOz * p.usdInr / 31.1034768) * 9.99) < 1e-6, "history INR formula mismatch");
    return `${h.points.length} ${h.granularity} points from ${h.source}`;
  });
  await step("GET /api/history rejects unserviceable ranges honestly", async () => {
    const h = await (await req.get(`${BASE}/api/history?range=1M`)).json();
    if (h.availableRanges.includes("1M")) return "1M available (key configured)";
    assert(h.points.length === 0 && h.status === "unconfigured", "1M should be unconfigured without key");
    return "1M → unconfigured, no fake points";
  });
  await step("GET /api/health reports every source", async () => {
    const h = await (await req.get(`${BASE}/api/health`)).json();
    const ids = h.sources.map((s) => `${s.id}:${s.status}`);
    assert(h.sources.length >= 5, "too few sources");
    assert(h.sources.every((s) => s.licence && s.attribution), "missing licence/attribution");
    return ids.join(", ");
  });
  await step("API responses never leak credentials", async () => {
    const txt = await (await req.get(`${BASE}/api/health`)).text();
    assert(!/x-api-key\s*[:=]\s*\w|GOLD_API_KEY=|Bearer\s+\w{8,}/i.test(txt), "possible secret in output");
  });

  console.log("Desktop UI");
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on("pageerror", (e) => consoleErrors.push(e.message));
  page.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text()));
  let perf;
  await step("page loads and hero price matches API", async () => {
    await page.goto(BASE, { waitUntil: "networkidle" });
    perf = await page.evaluate(() => {
      const n = performance.getEntriesByType("navigation")[0];
      const fcp = performance.getEntriesByName("first-contentful-paint")[0];
      return { domContentLoaded: Math.round(n.domContentLoadedEventEnd), load: Math.round(n.loadEventEnd), fcp: fcp ? Math.round(fcp.startTime) : null, transferKB: Math.round(performance.getEntriesByType("resource").reduce((a, r) => a + (r.transferSize || 0), n.transferSize || 0) / 1024) };
    });
    const hero = parseInr(await page.textContent("[data-testid=hero-price]"));
    const api = await (await req.get(`${BASE}/api/market`)).json();
    assert(Math.abs(hero - api.derived.per10g24k999) < 60, `hero ${hero} vs api ${api.derived.per10g24k999}`);
    return `₹${hero.toLocaleString("en-IN")} · FCP ${perf.fcp}ms · load ${perf.load}ms · ${perf.transferKB} KB`;
  });
  await step("source attribution & timestamps visible", async () => {
    const badge = page.locator("#overview [data-slot=badge]").first();
    const t = await badge.textContent();
    assert(/Live|Delayed|Stale/.test(t) && /ago/.test(t), `badge "${t}"`);
    await page.waitForSelector("[data-testid=source-list] li");
    const txt = await page.textContent("#methodology");
    for (const s of ["gold-api.com", "European Central Bank", "World Bank", "OroPocket"]) assert(txt.includes(s), `missing ${s}`);
    const oroUi = parseInr(await page.textContent("[data-testid=oro-final]"));
    const m2 = await (await req.get(`${BASE}/api/market`)).json();
    assert(Math.abs(oroUi - m2.oroPocket.gold.finalBuy) < 0.01, `OroPocket card ${oroUi} vs ${m2.oroPocket.gold.finalBuy}`);
    return t.trim();
  });
  await step("history chart: range switch, hover tooltip, table view", async () => {
    await page.locator("#chart").scrollIntoViewIfNeeded();
    await page.getByRole("radio", { name: "Range 10Y" }).click();
    await page.waitForFunction(() => /\d/.test(document.querySelector("[data-testid=history-stats]")?.textContent || ""));
    const stats10 = await page.textContent("[data-testid=history-stats]");
    await page.getByRole("radio", { name: "Range 1Y" }).click();
    await page.waitForFunction((prev) => document.querySelector("[data-testid=history-stats]")?.textContent !== prev, stats10);
    const box = await page.locator("[data-testid=history-chart] .recharts-surface").boundingBox();
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
    await page.waitForSelector(".recharts-tooltip-wrapper >> text=/₹/", { timeout: 5000 });
    const tip = await page.locator(".recharts-tooltip-wrapper").textContent();
    await page.getByRole("button", { name: /Table/ }).click();
    const rows = await page.locator("#chart table tbody tr").count();
    assert(rows >= 12, `table rows ${rows}`);
    await page.getByRole("button", { name: /Chart/ }).click();
    return `tooltip "${tip.trim()}" · ${rows} table rows`;
  });
  await step("calculator arithmetic matches lib formula", async () => {
    await page.locator("#calculator").scrollIntoViewIfNeeded();
    await page.fill("#grams", "20");
    await page.fill("#making", "10");
    await page.fill("#duty", "6");
    const total = parseInr(await page.textContent("[data-testid=calc-total]"));
    const m = await (await req.get(`${BASE}/api/market`)).json();
    const metal = m.derived.finePerGram * 20 * 0.999;
    const expected = metal * 1.06 * 1.1 * 1.03;
    assert(Math.abs(total - expected) / expected < 0.002, `total ${total} vs expected ${Math.round(expected)}`);
    await page.getByRole("radio", { name: "My quote" }).click();
    await page.fill("#custom-rate", "135000");
    await page.fill("#making", "0");
    const t2 = parseInr(await page.textContent("[data-testid=calc-total]"));
    const e2 = 135000 * 2 * 1.03; // 20 g of 999 at ₹135,000/10g, no duty re-added, 3% GST
    assert(Math.abs(t2 - e2) < 2, `custom total ${t2} vs ${e2}`);
    return `parity ₹${total.toLocaleString("en-IN")} · custom ₹${t2.toLocaleString("en-IN")}`;
  });
  await step("seller table: add quote, examples, sort, filter, remove", async () => {
    await page.locator("#sellers").scrollIntoViewIfNeeded();
    await page.getByRole("button", { name: "Add a quote" }).click();
    await page.getByRole("button", { name: "Add to comparison" }).click();
    await page.waitForSelector("#quote-form [role=alert]");
    await page.fill("#qf-seller", "Test Jeweller");
    await page.fill("#qf-product", "10 g test coin");
    await page.fill("#qf-price", "150000");
    await page.getByRole("button", { name: "Add to comparison" }).click();
    await page.getByRole("button", { name: "Try examples" }).click();
    const rowsSel = "[data-testid=seller-table] [data-testid=seller-row]";
    await page.waitForFunction((s) => document.querySelectorAll(s).length === 7, rowsSel);
    const per10 = async () => (await page.locator(`${rowsSel} td:nth-child(10)`).allTextContents()).map(parseInr);
    const asc = await per10();
    assert(asc.every((v, i) => i === 0 || v >= asc[i - 1]), `not ascending ${asc}`);
    await page.getByRole("button", { name: /Per 10 g \(999\)/ }).click();
    const desc = await per10();
    assert(desc.every((v, i) => i === 0 || v <= desc[i - 1]), "not descending");
    assert((await page.locator("th[aria-sort=descending]").count()) === 1, "aria-sort missing");
    await page.getByRole("radio", { name: "Bars" }).click();
    const bars = await page.locator(rowsSel).count();
    await page.fill("input[aria-label='Search seller or product']", "test");
    await page.getByRole("radio", { name: "All" }).click();
    const searched = await page.locator(rowsSel).count();
    assert(bars === 1 && searched === 1, `bars ${bars} search ${searched}`);
    await page.getByRole("button", { name: /Remove Test Jeweller/ }).first().click();
    await page.fill("input[aria-label='Search seller or product']", "");
    const left = await page.locator(rowsSel).count();
    assert(left === 6, `left ${left}`);
    assert((await page.locator(`${rowsSel} >> text=Live API`).count()) === 1, "OroPocket live row missing");
    const illus = await page.locator(`${rowsSel} >> text=Illustrative`).count();
    assert(illus === 5, "examples must be labelled Illustrative");
    return `sorted asc/desc, filtered (bars=${bars}), 5 labelled examples`;
  });
  await step("Advanced mode reveals extra metrics and columns", async () => {
    const before = await page.locator("[data-testid^=metric-]").count();
    await page.getByRole("radio", { name: "Advanced mode" }).first().click();
    const after = await page.locator("[data-testid^=metric-]").count();
    assert(after > before, `${before} → ${after}`);
    assert(await page.locator("th >> text=of which duty*").count(), "duty column missing");
    await page.getByRole("radio", { name: "Simple mode" }).first().click();
    return `${before} → ${after} metric cards`;
  });
  await step("accessibility: axe-core (WCAG 2 A/AA) on desktop", async () => {
    await page.addScriptTag({ content: AXE });
    const r = await page.evaluate(async () => await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] } }));
    const v = r.violations.map((x) => `${x.id}(${x.nodes.length}): ${x.nodes[0].target.join(" ")}`);
    assert(v.length === 0, v.join(" | "));
    return `${r.passes.length} rules passed, 0 violations`;
  });
  await step("no console errors", async () => {
    assert(consoleErrors.length === 0, consoleErrors.slice(0, 3).join(" | "));
  });
  await ctx.close();

  console.log("Mobile UI (iPhone 13)");
  const mctx = await browser.newContext({ ...devices["iPhone 13"] });
  const m = await mctx.newPage();
  await step("no horizontal scroll, cards replace table, dock + sheet nav work", async () => {
    await m.goto(BASE, { waitUntil: "networkidle" });
    const [sw, iw] = await m.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
    assert(sw <= iw, `scrollWidth ${sw} > ${iw}`);
    await m.locator("#sellers").scrollIntoViewIfNeeded();
    await m.getByRole("button", { name: "Try examples" }).click();
    await m.waitForSelector("[data-testid=seller-cards] li");
    assert(!(await m.locator("[data-testid=seller-table]").isVisible()), "table should be hidden on mobile");
    await m.getByRole("button", { name: "Open menu" }).click();
    await m.getByRole("dialog").getByRole("link", { name: "Calculator" }).click();
    await m.waitForTimeout(1600);
    const top = await m.evaluate(() => document.getElementById("calculator").getBoundingClientRect().top);
    assert(Math.abs(top) < 140, `calculator top ${top}`);
    assert(await m.getByRole("navigation", { name: "Quick sections" }).isVisible(), "dock missing");
    return `scrollWidth ${sw}/${iw}`;
  });
  await step("accessibility: axe-core on mobile", async () => {
    await m.addScriptTag({ content: AXE });
    const r = await m.evaluate(async () => await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] } }));
    const v = r.violations.map((x) => `${x.id}(${x.nodes.length}): ${x.nodes[0].target.join(" ")}`);
    assert(v.length === 0, v.join(" | "));
  });
  await mctx.close();

  console.log("Loading & error states");
  const ectx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const e = await ectx.newPage();
  await step("skeletons show while market data is pending", async () => {
    let release;
    const gate = new Promise((r) => (release = r));
    await e.route("**/api/market", async (route) => {
      await gate;
      await route.continue();
    });
    await e.goto(BASE, { waitUntil: "domcontentloaded" });
    await e.waitForSelector("[data-slot=skeleton]");
    const busy = await e.getAttribute("#top [aria-busy]", "aria-busy");
    release();
    await e.waitForSelector("[data-testid=hero-price]");
    await e.unroute("**/api/market");
    return `aria-busy=${busy}`;
  });
  await step("upstream failure shows an error, never fake numbers", async () => {
    await e.route("**/api/market", (route) => route.fulfill({ status: 502, contentType: "application/json", body: JSON.stringify({ serverTime: new Date().toISOString(), goldUsd: null, goldInr: null, silverUsd: null, fx: null, derived: null, ticks: [], ticksSince: null, sources: [{ id: "gold-api", status: "error", fetchedAt: null, sourceUpdatedAt: null, error: "HTTP 503" }] }) }));
    await e.route("**/api/history*", (route) => route.fulfill({ status: 502, contentType: "application/json", body: JSON.stringify({ error: "World Bank: timed out" }) }));
    await e.goto(BASE, { waitUntil: "networkidle" });
    const alert = await e.locator("#top [role=alert]").textContent();
    assert(/never substitute sample numbers/.test(alert), alert);
    assert((await e.locator("[data-testid=hero-price]").count()) === 0, "price shown during outage");
    await e.waitForSelector("#chart [role=alert]");
    const badge = await e.locator("#overview [data-slot=badge]").first().textContent();
    assert(/Unavailable/.test(badge), badge);
    await e.unroute("**/api/history*");
    await e.locator("#chart").getByRole("button", { name: "Retry" }).click();
    await e.waitForSelector("[data-testid=history-chart]");
    return `hero alert + "${badge.trim()}" badge; chart retry recovered`;
  });
  await ectx.close();
  await browser.close();

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  fs.writeFileSync(path.join(__dirname, "last-run.json"), JSON.stringify({ base: BASE, at: new Date().toISOString(), perf, results }, null, 2));
  process.exit(failed.length ? 1 : 0);
})();
