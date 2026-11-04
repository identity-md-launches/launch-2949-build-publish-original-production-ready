/** Production-export tests; all API fixtures below are test-only, never bundled into the site. */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { createRequire } from "node:module";
const { chromium } = await import(process.env.DESK_PLAYWRIGHT || "playwright");
const require = createRequire(
  resolve(process.env.DESK_DEPENDENCY_ROOT || ".", "package.json"),
);
const axeSource = await readFile(
  require.resolve("axe-core/axe.min.js"),
  "utf8",
);
const out = resolve("test/scratch/browser-validation");
await mkdir(out, { recursive: true });
const root = resolve("dist"),
  types = {
    ".html": "text/html",
    ".js": "text/javascript",
    ".css": "text/css",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".woff2": "font/woff2",
    ".txt": "text/plain",
  };
const server = createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url, "http://local").pathname;
    if (!pathname.startsWith("/preview/")) {
      res.writeHead(404).end();
      return;
    }
    const file = resolve(
      root,
      "." +
        decodeURIComponent(pathname.slice("/preview".length)) +
        (pathname.endsWith("/") ? "index.html" : ""),
    );
    if (!file.startsWith(root + sep)) {
      res.writeHead(403).end();
      return;
    }
    const content = await readFile(file);
    res.setHeader(
      "Content-Type",
      types[extname(file)] || "application/octet-stream",
    );
    res.end(content);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const url = `http://127.0.0.1:${server.address().port}/preview/`;
const browser = await chromium.launch({ headless: true });
const watchdog = setTimeout(() => {
  console.error("Browser validation exceeded 180 seconds.");
  void browser.close();
}, 180000);
watchdog.unref();
const result = {
  checks: [],
  errors: [],
  a11y: [],
  screenshots: [],
  liveNetwork: null,
};
const check = (name, details = "") => {
  result.checks.push({ name, passed: true, details });
  console.log(`PASS ${name}${details ? ": " + details : ""}`);
};
const near = (a, b) => assert.ok(Math.abs(a - b) < 0.00002, `${a} != ${b}`);
const getSaved = async (page) => {
  await page.waitForTimeout(50);
  return page.evaluate(() =>
    JSON.parse(localStorage.getItem("squeekstr-desk:v1")),
  );
};
async function dismiss(page) {
  const button = page.getByRole("button", {
    name: "Dismiss notification",
    exact: true,
  });
  if (await button.count()) await button.click();
}
async function shot(page, name, fullPage = false) {
  await page.screenshot({ path: `${out}/${name}.png`, fullPage });
  result.screenshots.push(name + ".png");
}
async function axe(page, name) {
  await page.clock.resume();
  await page.evaluate(axeSource);
  const r = await page.evaluate(async () =>
    window.axe.run(document, {
      runOnly: {
        type: "tag",
        values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"],
      },
    }),
  );
  result.a11y.push({
    name,
    violations: r.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      nodes: v.nodes.map((n) => n.target),
    })),
    passes: r.passes.length,
  });
  assert.equal(r.violations.length, 0, JSON.stringify(result.a11y.at(-1)));
  check(`axe ${name}`, `${r.passes.length} rules passed; no violations`);
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 1000);
}
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => result.errors.push(e.message));
  page.on("response", (r) => {
    if (r.url().startsWith(url) && r.status() >= 400)
      result.errors.push(`${r.status()} ${r.url().slice(url.length)}`);
  });
  let live = {
    status: "IDLE",
    rpm: 56523,
    height: 8343,
    epoch: "test-epoch",
    fail: false,
    stale: false,
    delay: false,
  };
  let requests = 0;
  await page.route("https://api.squeekchain.com/v1/status", async (route) => {
    requests++;
    if (live.fail) {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: "{}",
      });
      return;
    }
    if (live.delay) {
      return;
    }
    const now = await page.evaluate(() => Date.now());
    const observed = new Date(now - (live.stale ? 180000 : 0)).toISOString();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        generatedAt: observed,
        measurement: {
          coreStatus: live.status,
          rpmMilli: live.rpm,
          observedAt: observed,
          freshness: "online",
          staleAfterSeconds: 120,
          counterEpoch: live.epoch,
        },
        builder: {
          anchor: { blockHeight: String(live.height) },
          projected: { blockHeight: String(live.height + 50) },
        },
      }),
    });
  });
  await page.clock.install();
  await page.goto(url);
  await page.getByText("Live wheel · Idle", { exact: true }).waitFor();
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 1000);
  assert.equal(await page.title(), "Squeekstr Desk");
  assert.equal(
    await page
      .locator("#wheel .chain-data")
      .getByText("#8,343", { exact: true })
      .count(),
    1,
  );
  assert.equal(
    await page.getByRole("checkbox", { name: /Spin Rush/ }).isDisabled(),
    true,
  );
  assert.match(await page.locator(".wheel-reading").innerText(), /56.5/);
  check(
    "live schema and IDLE semantics",
    "confirmed height 8343 used instead of optimistic 8393; 56.523 RPM displayed; rush disabled despite nonzero RPM",
  );
  await axe(page, "initial desktop");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => scrollTo(0, 0));
  const startBox = await page
    .getByRole("button", { name: "Start paper desk", exact: true })
    .boundingBox();
  assert.ok(startBox.y + startBox.height <= 844);
  await shot(page, "mobile-first-screen");
  await page
    .getByRole("button", { name: "Start paper desk", exact: true })
    .click();
  await dismiss(page);
  const depositBox = await page
    .getByRole("button", { name: "Deposit 2 Squeeks", exact: true })
    .boundingBox();
  assert.ok(depositBox.y + depositBox.height <= 844);
  await shot(page, "mobile-started");
  check(
    "390px first screen",
    "start and, after starting, the deposit CTA are within the first viewport",
  );
  await page
    .getByRole("button", { name: "Deposit 2 Squeeks", exact: true })
    .click();
  await dismiss(page);
  let s = await getSaved(page);
  assert.equal(s.trackers.length, 2);
  assert.equal(s.trackers[0].power, 1000);
  check(
    "deposit → receipt",
    "two selected paper Squeeks produce two 1000-power receipts",
  );
  await page.clock.runFor(1000);
  await page.getByRole("button", { name: /Merge & grow/ }).click();
  assert.match(await page.locator(".merge-preview").innerText(), /2,200.0/);
  assert.match(await page.locator(".merge-preview").innerText(), /150.0/);
  await page
    .getByRole("button", { name: "Merge to Level 2", exact: true })
    .click();
  await dismiss(page);
  s = await getSaved(page);
  assert.equal(s.trackers[0].power, 1075);
  assert.equal(s.trackers.find((t) => t.owner === "Protocol").power, 50);
  assert.equal(s.squeeks.find((t) => t.level === 2).cooldown, 3);
  check(
    "merge preview → settlement",
    "2000 becomes 2200; community +150, protocol +50; 3-block cooldown",
  );
  await page.clock.runFor(3000);
  s = await getSaved(page);
  const claim = s.trackers[0].accrued;
  assert.ok(claim > 0);
  const before = s.wallets.You.sqk;
  await page
    .getByRole("button", { name: "Claim SQK", exact: true })
    .first()
    .click();
  await dismiss(page);
  s = await getSaved(page);
  near(s.wallets.You.sqk, before + claim);
  assert.equal(s.trackers[0].accrued, 0);
  check(
    "earn → claim",
    "accrued SQK moves to paper wallet, receipt balance resets",
  );
  await page.locator("#swap-amount").fill("not a number");
  await page
    .getByRole("button", { name: "Buy paper SQKSTR", exact: true })
    .click();
  assert.equal(
    await page.locator("#swap-amount").getAttribute("aria-invalid"),
    "true",
  );
  assert.equal(
    await page.evaluate(() => document.activeElement.id),
    "swap-amount",
  );
  await page.locator("#swap-amount").fill("20000");
  await page
    .getByRole("button", { name: "Buy paper SQKSTR", exact: true })
    .click();
  assert.match(await page.locator("#swap-error").innerText(), /Not enough/);
  await page.locator("#swap-amount").fill("2000");
  await page
    .getByRole("button", { name: "Buy paper SQKSTR", exact: true })
    .click();
  await dismiss(page);
  s = await getSaved(page);
  assert.equal(s.purchases, 1);
  assert.equal(s.taxPool, 0);
  assert.equal(s.trackers[0].power, 1575);
  assert.equal(s.wallets.You.sqkstr, 1450);
  check(
    "buy → tax threshold → automatic acquisition",
    "2000 SQK buy taxes 100, buys a 1000-power vault Squeek, distributes power",
  );
  await page.getByRole("button", { name: "Sell SQKSTR", exact: true }).click();
  await page.locator("#swap-amount").fill("100");
  await page
    .getByRole("button", { name: "Sell paper SQKSTR", exact: true })
    .click();
  await dismiss(page);
  s = await getSaved(page);
  assert.equal(s.taxPool, 10);
  assert.equal(s.wallets.You.sqkstr, 1350);
  check(
    "sell and input validation",
    "5% sell tax, invalid and overspent inputs rejected with inline errors and focus",
  );
  await page.clock.runFor(2000);
  s = await getSaved(page);
  const carried = s.trackers[0].accrued;
  assert.ok(carried > 0);
  await page
    .getByRole("button", { name: "Trade", exact: true })
    .first()
    .click();
  await page.locator("#trade-price").fill("5000");
  await page
    .getByRole("button", { name: "Trade to Friend", exact: true })
    .click();
  assert.match(await page.locator("#trade-error").innerText(), /Enter a price/);
  await page.locator("#trade-price").fill("100");
  await page
    .getByRole("button", { name: "Trade to Friend", exact: true })
    .click();
  await dismiss(page);
  s = await getSaved(page);
  assert.equal(s.trackers[0].owner, "Friend");
  near(s.trackers[0].accrued, carried);
  assert.equal(s.wallets.Friend.sqk, 1900);
  await page.getByRole("button", { name: "Friend", exact: true }).click();
  assert.equal(await page.locator(".receipt-card").count(), 1);
  await page.getByRole("button", { name: "Claim SQK", exact: true }).click();
  await dismiss(page);
  s = await getSaved(page);
  near(s.wallets.Friend.sqk, 1900 + carried);
  check(
    "receipt trade → Friend claim",
    "price settles, power and accrued rewards move to Friend; Friend can claim",
  );
  await page.getByRole("button", { name: "Trade", exact: true }).click();
  await page.keyboard.press("Tab");
  assert.ok(
    await page.evaluate(() =>
      document.querySelector("dialog").contains(document.activeElement),
    ),
  );
  for (let i = 0; i < 8; i++) await page.keyboard.press("Tab");
  assert.ok(
    await page.evaluate(() =>
      document.querySelector("dialog").contains(document.activeElement),
    ),
  );
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("dialog").count(), 0);
  assert.equal(
    await page.evaluate(() => document.activeElement.textContent?.trim()),
    "Trade",
  );
  check(
    "dialog keyboard behavior",
    "focus trapped, Escape closes, focus returns to trade trigger",
  );
  live.status = "SPINNING";
  await page
    .getByRole("button", { name: "Refresh status", exact: true })
    .click();
  await page.getByText("Live wheel · Spinning", { exact: true }).waitFor();
  assert.equal(
    await page.getByRole("checkbox", { name: /Spin Rush/ }).isEnabled(),
    true,
  );
  await page.getByRole("checkbox", { name: /Spin Rush/ }).check();
  let old = (await getSaved(page)).trackers.find(
    (t) => t.owner === "Friend",
  ).accrued;
  await page.clock.runFor(1000);
  let next = (await getSaved(page)).trackers.find(
    (t) => t.owner === "Friend",
  ).accrued;
  near(next - old, (1.2 * 1575) / 3200);
  check("SPINNING → Spin Rush", "exact 1.5x accrual by receipt power share");
  live.status = "IDLE";
  await page
    .getByRole("button", { name: "Refresh status", exact: true })
    .click();
  await page.getByText("Live wheel · Idle", { exact: true }).waitFor();
  old = (await getSaved(page)).trackers.find(
    (t) => t.owner === "Friend",
  ).accrued;
  await page.clock.runFor(1000);
  next = (await getSaved(page)).trackers.find(
    (t) => t.owner === "Friend",
  ).accrued;
  near(next - old, (0.8 * 1575) / 3200);
  check(
    "IDLE returns to base",
    "stored Spin Rush preference cannot boost an idle live wheel",
  );
  live.height += 2;
  await page
    .getByRole("button", { name: "Refresh status", exact: true })
    .click();
  await page.locator("#wheel").getByText("#8,345", { exact: true }).waitFor();
  await page.clock.runFor(1000);
  assert.equal(
    (await getSaved(page)).squeeks.find((t) => t.level === 2).cooldown,
    1,
  );
  live.height += 1;
  await page
    .getByRole("button", { name: "Refresh status", exact: true })
    .click();
  await page.locator("#wheel").getByText("#8,346", { exact: true }).waitFor();
  await page.clock.runFor(1000);
  assert.equal(
    (await getSaved(page)).squeeks.find((t) => t.level === 2).cooldown,
    0,
  );
  check(
    "confirmed-block cooldown",
    "two confirmed blocks reduce 3 to 1; third unlocks it",
  );
  live.fail = true;
  await page
    .getByRole("button", { name: "Refresh status", exact: true })
    .click();
  await page.getByText("Practice mode", { exact: true }).waitFor();
  assert.match(await page.locator("#wheel").innerText(), /Stale/);
  const requestsBefore = requests;
  await page.clock.runFor(15000);
  await page.waitForTimeout(50);
  assert.ok(requests > requestsBefore);
  const calls = requests;
  await page.clock.runFor(14000);
  assert.equal(requests, calls);
  await page.clock.runFor(16000);
  await page.waitForTimeout(50);
  assert.ok(requests > calls);
  for (const delay of [60000, 120000]) {
    const previous = requests;
    await page.clock.runFor(delay - 1000);
    assert.equal(requests, previous);
    await page.clock.runFor(1000);
    await page.waitForTimeout(50);
    assert.equal(requests, previous + 1);
  }
  check(
    "failure → Practice and backoff",
    "failed fetch labels stale; 15s, 30s, 60s and capped 120s retry intervals verified",
  );
  assert.ok((await getSaved(page)).practiceHeight >= 3);
  const practiceBefore = (await getSaved(page)).practiceHeight;
  await page.getByRole("button", { name: "Use Practice", exact: true }).click();
  const stopped = requests;
  await page.clock.runFor(16000);
  assert.equal(requests, stopped);
  assert.ok((await getSaved(page)).practiceHeight >= practiceBefore + 2);
  check(
    "explicit Practice",
    "polling pauses; local 8-second ticks keep desk usable",
  );
  live.fail = false;
  live.stale = true;
  await page
    .getByRole("button", { name: "Retry live feed", exact: true })
    .click();
  await page
    .getByText(
      "The live measurement is stale. Using local ticks every 8 seconds.",
      { exact: true },
    )
    .waitFor();
  check(
    "stale successful response",
    "HTTP 200 with an old measurement is not shown as live",
  );
  live.stale = false;
  await page
    .getByRole("button", { name: "Retry live feed", exact: true })
    .click();
  await page.getByText("Live wheel · Idle", { exact: true }).waitFor();
  check("live recovery", "fresh data exits Practice automatically");
  live.delay = true;
  await page
    .getByRole("button", { name: "Refresh status", exact: true })
    .click();
  await page.clock.runFor(7001);
  await page
    .getByText(
      "The live request timed out. Using local ticks every 8 seconds.",
      { exact: true },
    )
    .waitFor();
  check(
    "request timeout",
    "unanswered request aborts after 7 seconds and enters Practice",
  );
  live.delay = false;
  await page
    .getByRole("button", { name: "Retry live feed", exact: true })
    .click();
  await page.getByText("Live wheel · Idle", { exact: true }).waitFor();
  const visibleRewards = (await getSaved(page)).trackers.map((t) => t.accrued);
  await page.evaluate(() =>
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "hidden",
    }),
  );
  await page.clock.runFor(5000);
  assert.deepEqual(
    (await getSaved(page)).trackers.map((t) => t.accrued),
    visibleRewards,
  );
  await page.evaluate(() => delete document.visibilityState);
  check(
    "foreground-only accrual",
    "simulated hidden-page state earns no paper SQK",
  );
  await page.getByRole("button", { name: "You", exact: true }).click();
  await page
    .getByRole("button", { name: /Deposit Squeeks/ })
    .first()
    .click();
  await dismiss(page);
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: width < 600 ? 844 : 1000 });
    await page.evaluate(() => scrollTo(0, 0));
    const geometry = await page.evaluate(() => ({
      width: innerWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    assert.equal(geometry.scroll, geometry.width, `overflow at ${width}`);
    await shot(page, `active-${width}`, width === 1440 || width === 390);
  }
  check(
    "responsive reflow",
    "no horizontal overflow at 320, 390, 768, 1024, 1440",
  );
  await axe(page, "active desktop");
  await page.setViewportSize({ width: 390, height: 844 });
  await axe(page, "active mobile");
  await page
    .getByRole("button", { name: "How it works", exact: true })
    .first()
    .click();
  await axe(page, "help dialog");
  await shot(page, "help-mobile");
  for (const href of [
    "https://sqkstr.xyz/",
    "https://sqkstr.xyz/mechanism",
    "https://squeekchain.com/",
    "https://squeekchain.com/genesis/d4sp8cje",
  ])
    assert.equal(await page.locator(`dialog a[href="${href}"]`).count(), 1);
  await page.keyboard.press("Escape");
  check(
    "About links and disclosure",
    "all four required official sources present",
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  assert.equal(
    await page.evaluate(
      () =>
        document
          .getAnimations()
          .filter(
            (a) =>
              a.playState === "running" &&
              a.effect.getTiming().iterations === Infinity,
          ).length,
    ),
    0,
  );
  check("reduced motion", "no infinite animations running");
  await page.emulateMedia({ forcedColors: "active" });
  await page
    .getByRole("button", { name: "How it works", exact: true })
    .first()
    .focus();
  assert.notEqual(
    await page.evaluate(
      () => getComputedStyle(document.activeElement).outlineStyle,
    ),
    "none",
  );
  await shot(page, "forced-colors");
  await page.emulateMedia({ forcedColors: "none" });
  check("forced colors focus", "explicit system-color focus indicator remains");
  await page.evaluate(() => (document.documentElement.style.fontSize = "32px"));
  await shot(page, "text-enlargement-200", true);
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth),
    390,
  );
  await page.evaluate(() => (document.documentElement.style.fontSize = ""));
  check(
    "200% text enlargement",
    "390px reflow remains usable without horizontal page scrolling",
  );
  const savedBefore = await getSaved(page);
  await page.reload();
  await page.getByText("Live wheel · Idle", { exact: true }).waitFor();
  const savedAfter = await getSaved(page);
  assert.deepEqual(savedAfter.wallets, savedBefore.wallets);
  assert.deepEqual(savedAfter.trackers, savedBefore.trackers);
  check(
    "reload persistence",
    "wallets, receipt ownership, power and unclaimed rewards survive exactly; no offline credit",
  );
  const tab = await context.newPage();
  await tab.route("https://api.squeekchain.com/v1/status", (r) => r.abort());
  await tab.goto(url);
  await tab.getByText(/This lab is active in another tab/).waitFor();
  assert.equal(
    await tab
      .getByRole("button", { name: "Buy paper SQKSTR", exact: true })
      .isDisabled(),
    true,
  );
  await tab.close();
  check(
    "concurrent tabs",
    "second tab is read-only and cannot double-credit mining",
  );
  await page
    .getByRole("button", { name: "Reset lab", exact: true })
    .last()
    .click();
  await page.getByRole("button", { name: "Keep my desk", exact: true }).click();
  assert.ok((await getSaved(page)).started);
  await page
    .getByRole("button", { name: "Reset lab", exact: true })
    .last()
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Reset lab", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Start paper desk", exact: true })
    .waitFor();
  assert.equal(await getSaved(page), null);
  check(
    "Reset lab",
    "cancel preserves state; confirmation removes only this lab save and returns to starter",
  );
  await page.reload();
  await page
    .getByRole("button", { name: "Start paper desk", exact: true })
    .waitFor();
  await page.keyboard.press("Tab");
  assert.equal(
    await page.evaluate(() => document.activeElement.textContent),
    "Skip to desk",
  );
  await page.keyboard.press("Enter");
  await page
    .getByRole("button", { name: "Start paper desk", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  assert.ok((await getSaved(page)).started);
  check("keyboard entry", "skip link and Enter activation work");
  await page
    .getByRole("button", { name: "Deposit 2 Squeeks", exact: true })
    .click();
  await dismiss(page);
  await page.clock.runFor(1000);
  await page.getByRole("button", { name: /Merge & grow/ }).click();
  live.height += 4;
  await page
    .getByRole("button", { name: "Refresh status", exact: true })
    .click();
  await page
    .locator("#wheel")
    .getByText(`#${live.height.toLocaleString("en-US")}`, { exact: true })
    .waitFor();
  await page
    .getByRole("button", { name: "Merge to Level 2", exact: true })
    .click();
  await dismiss(page);
  await page.clock.runFor(1000);
  assert.equal(
    (await getSaved(page)).squeeks.find((t) => t.level === 2).cooldown,
    3,
  );
  check(
    "merge after a fresh API block advance",
    "blocks already completed before the action do not spend the new tip's cooldown",
  );
  await context.close();
  const keyboardContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const keyboardPage = await keyboardContext.newPage();
  await keyboardPage.route("https://api.squeekchain.com/v1/status", (route) =>
    route.fulfill({ status: 503, body: "{}" }),
  );
  await keyboardPage.goto(url);
  async function keyboardActivate(locator) {
    for (let i = 0; i < 160; i++) {
      if (await locator.evaluate((el) => el === document.activeElement)) {
        assert.notEqual(
          await locator.evaluate((el) => getComputedStyle(el).outlineStyle),
          "none",
        );
        await keyboardPage.keyboard.press("Enter");
        return;
      }
      await keyboardPage.keyboard.press("Tab");
    }
    throw new Error("A primary action was not reachable with Tab.");
  }
  await keyboardActivate(
    keyboardPage.getByRole("button", { name: "Start paper desk", exact: true }),
  );
  await keyboardActivate(
    keyboardPage.getByRole("button", {
      name: "Deposit 2 Squeeks",
      exact: true,
    }),
  );
  await keyboardActivate(
    keyboardPage.getByRole("button", { name: /Merge & grow/ }),
  );
  await keyboardActivate(
    keyboardPage.getByRole("button", { name: "Merge to Level 2", exact: true }),
  );
  await keyboardPage.waitForTimeout(1100);
  await keyboardActivate(
    keyboardPage
      .getByRole("button", { name: "Claim SQK", exact: true })
      .first(),
  );
  await keyboardActivate(
    keyboardPage.getByRole("button", { name: "Buy paper SQKSTR", exact: true }),
  );
  assert.equal((await getSaved(keyboardPage)).purchases, 1);
  await keyboardActivate(
    keyboardPage.getByRole("button", { name: "Trade", exact: true }).first(),
  );
  await keyboardActivate(
    keyboardPage.getByRole("button", { name: "Trade to Friend", exact: true }),
  );
  await keyboardActivate(
    keyboardPage.getByRole("button", { name: "Friend", exact: true }),
  );
  assert.equal(await keyboardPage.locator(".receipt-card").count(), 1);
  await keyboardActivate(
    keyboardPage.getByRole("button", { name: "Claim SQK", exact: true }),
  );
  assert.ok((await getSaved(keyboardPage)).wallets.Friend.sqk > 1900);
  await keyboardActivate(
    keyboardPage.getByRole("button", { name: "Reset lab", exact: true }).last(),
  );
  await keyboardActivate(
    keyboardPage
      .getByRole("dialog")
      .getByRole("button", { name: "Reset lab", exact: true }),
  );
  assert.equal(await getSaved(keyboardPage), null);
  await keyboardContext.close();
  check(
    "keyboard-only primary workflow",
    "Tab/Enter completes start, deposit, merge, claim, tax acquisition, trade, Friend claim and reset at 390px, with focus outlines",
  );
  const blockedContext = await browser.newContext();
  await blockedContext.addInitScript(() => {
    Storage.prototype.setItem = function () {
      throw new DOMException("Blocked", "SecurityError");
    };
  });
  const blocked = await blockedContext.newPage();
  await blocked.route("https://api.squeekchain.com/v1/status", (r) =>
    r.abort(),
  );
  await blocked.goto(url);
  await blocked
    .getByRole("button", { name: "Start paper desk", exact: true })
    .click();
  await blocked.getByText(/Unable to save this lab/).waitFor();
  await blocked
    .getByRole("button", { name: "Deposit 2 Squeeks", exact: true })
    .click();
  assert.equal(await blocked.locator(".receipt-card").count(), 2);
  assert.match(await blocked.locator("footer").innerText(), /Session only/);
  await blockedContext.close();
  check(
    "storage unavailable",
    "paper interactions still work; save limitation is visible and footer stays truthful",
  );
  assert.equal(result.errors.length, 0, JSON.stringify(result.errors));
  check(
    "production resources",
    "no page exceptions or failed local resources; served from /preview/ with relative asset URLs",
  );
} catch (e) {
  result.failure = e.stack;
  console.error(e);
  process.exitCode = 1;
} finally {
  clearTimeout(watchdog);
  await browser.close();
  await new Promise((r) => server.close(r));
  await writeFile(`${out}/results.json`, JSON.stringify(result, null, 2));
}
