import test from "node:test";
import assert from "node:assert/strict";
import {
  accrue,
  blankLab,
  communityPower,
  mergePreview,
  observeBlocks,
  parseLab,
  RULES,
  swapQuote,
  totalPower,
  transact,
  type Lab,
  type Action,
} from "../src/engine.ts";
import { parseStatus } from "../src/status.ts";

const start = () => transact(blankLab(), { type: "start" }, 0).state;
function doAction(s: Lab, a: Action) {
  const r = transact(s, a, 0);
  assert.equal(r.error, false, r.message);
  return r.state;
}
function deposited(ids = [1, 2]) {
  return doAction(start(), { type: "deposit", owner: "You", ids });
}
function close(a: number, b: number, tolerance = 0.00001) {
  assert.ok(Math.abs(a - b) <= tolerance, `${a} != ${b}`);
}
function conserved(s: Lab) {
  close(
    totalPower(s),
    s.trackers.reduce((n, t) => n + t.power, s.reservePower),
  );
  assert.ok(s.taxPool >= 0 && s.taxPool < 100);
}

test("starter kit is one-click, finite and cannot be claimed twice", () => {
  const s = start();
  assert.equal(s.squeeks.length, 6);
  assert.ok(s.squeeks.every((t) => t.level === 1 && t.power === 1000));
  assert.deepEqual(s.wallets.You, { sqk: 10000, sqkstr: 500 });
  assert.equal(s.wallets.Friend.sqk, 2000);
  assert.equal(transact(s, { type: "start" }).state, s);
});
test("selected deposits mint one receipt per owned Squeek and prevent replay", () => {
  const s = deposited();
  assert.equal(s.trackers.length, 2);
  assert.equal(totalPower(s), 2000);
  assert.equal(
    transact(s, { type: "deposit", owner: "You", ids: [1] }).error,
    true,
  );
  assert.equal(
    transact(start(), { type: "deposit", owner: "Friend", ids: [1] }).error,
    true,
  );
  conserved(s);
});
test("duplicate selection cannot mint duplicate power", () => {
  const s = deposited([1, 1]);
  assert.equal(s.trackers.length, 1);
  conserved(s);
});
test("merge preview matches 10% bump, community 75%, protocol 25%", () => {
  let s = deposited();
  assert.deepEqual(mergePreview(s.squeeks[0], s.squeeks[1]), {
    before: 2000,
    after: 2200,
    bump: 200,
    community: 150,
    protocol: 50,
    level: 2,
  });
  s = doAction(s, { type: "merge", ids: [1, 2] });
  assert.equal(totalPower(s), 2200);
  assert.equal(communityPower(s), 2150);
  assert.equal(s.trackers.find((t) => t.owner === "Protocol")?.power, 50);
  assert.ok(
    s.trackers.filter((t) => t.owner === "You").every((t) => t.power === 1075),
  );
  conserved(s);
});
test("merge growth goes proportionally to all community receipts, including Friend", () => {
  let s = deposited([1, 2, 3, 4]);
  s = doAction(s, { type: "trade", owner: "You", id: 1, price: 0 });
  s = doAction(s, { type: "merge", ids: [1, 2] });
  assert.equal(s.trackers.find((t) => t.owner === "Friend")?.power, 1037.5);
  assert.equal(communityPower(s), 4150);
  conserved(s);
});
test("merge rejects wrong level, reused tips, incomplete pairs and cooling tips", () => {
  let s = deposited([1, 2, 3, 4]);
  s = doAction(s, { type: "merge", ids: [1, 2] });
  assert.equal(transact(s, { type: "merge", ids: [1, 2] }).error, true);
  assert.equal(transact(s, { type: "merge", ids: [3, 7] }).error, true);
  assert.equal(transact(s, { type: "merge", ids: [3, 3] }).error, true);
  s = doAction(s, { type: "merge", ids: [3, 4] });
  assert.equal(transact(s, { type: "merge", ids: [7, 8] }).error, true);
});
test("cooldown uses completed block deltas, not elapsed time or polling count", () => {
  let s = observeBlocks(deposited(), "live", 4000, "epoch");
  s = doAction(s, { type: "merge", ids: [1, 2] });
  s = observeBlocks(s, "live", 4000, "epoch");
  assert.equal(s.squeeks.find((t) => t.level === 2)?.cooldown, 3);
  s = accrue(s, 1000, false);
  assert.equal(s.squeeks.find((t) => t.level === 2)?.cooldown, 3);
  s = observeBlocks(s, "live", 4002, "epoch");
  assert.equal(s.squeeks.find((t) => t.level === 2)?.cooldown, 1);
  s = observeBlocks(s, "live", 4003, "epoch");
  assert.equal(s.squeeks.find((t) => t.level === 2)?.cooldown, 0);
});
test("source changes and epoch changes rebase without a fabricated block jump", () => {
  let s = observeBlocks(deposited(), "live", 5000, "epoch");
  s = doAction(s, { type: "merge", ids: [1, 2] });
  s = observeBlocks(s, "practice", 0);
  assert.equal(s.squeeks.find((t) => t.level === 2)?.cooldown, 3);
  s = observeBlocks(s, "practice", 1);
  assert.equal(s.squeeks.find((t) => t.level === 2)?.cooldown, 2);
  s = observeBlocks(s, "live", 9999, "epoch");
  assert.equal(s.squeeks.find((t) => t.level === 2)?.cooldown, 2);
  s = observeBlocks(s, "live", 10050, "new-epoch");
  assert.equal(s.squeeks.find((t) => t.level === 2)?.cooldown, 2);
  s = observeBlocks(s, "live", 10051, "new-epoch");
  assert.equal(s.squeeks.find((t) => t.level === 2)?.cooldown, 1);
});
test("base rewards are proportional, and Spin Rush gives 1.5x", () => {
  const s = deposited();
  close(accrue(s, 1, false).trackers[0].accrued, 0.4);
  close(accrue(s, 1, true).trackers[0].accrued, 0.6);
  const merged = doAction(s, { type: "merge", ids: [1, 2] });
  const earned = accrue(merged, 1, false);
  close(earned.trackers[0].accrued, (0.8 * 1075) / 2200);
  close(
    earned.trackers.find((t) => t.owner === "Protocol")!.accrued,
    (0.8 * 50) / 2200,
  );
});
test("negative, non-finite and long suspension accrual cannot corrupt balances", () => {
  const s = deposited();
  assert.equal(accrue(s, -1, false), s);
  assert.equal(accrue(s, NaN, false), s);
  close(accrue(s, 10000, false).trackers[0].accrued, 0.8);
});
test("claim moves accrued rewards exactly once into the receipt owner wallet", () => {
  let s = accrue(deposited(), 1, false);
  const before = s.wallets.You.sqk;
  s = doAction(s, { type: "claim", owner: "You", id: 1 });
  close(s.wallets.You.sqk, before + 0.4);
  assert.equal(s.trackers[0].accrued, 0);
  assert.equal(transact(s, { type: "claim", owner: "You", id: 1 }).error, true);
  assert.equal(
    transact(s, { type: "claim", owner: "Friend", id: 2 }).error,
    true,
  );
});
test("buy and sell both pay 5% SQK-equivalent tax at the transparent fixed lab quote", () => {
  assert.deepEqual(swapQuote("buy", 2000), {
    gross: 2000,
    tax: 100,
    receive: 950,
  });
  assert.deepEqual(swapQuote("sell", 100), {
    gross: 200,
    tax: 10,
    receive: 190,
  });
  let s = doAction(start(), {
    type: "swap",
    owner: "You",
    side: "sell",
    amount: 100,
  });
  assert.deepEqual(s.wallets.You, { sqk: 10190, sqkstr: 400 });
  assert.equal(s.taxPool, 10);
});
test("tax threshold auto-buys a Squeek and shares its power with depositors", () => {
  const s = doAction(deposited(), {
    type: "swap",
    owner: "You",
    side: "buy",
    amount: 2000,
  });
  assert.equal(s.purchases, 1);
  assert.equal(s.taxPool, 0);
  assert.equal(totalPower(s), 3000);
  assert.equal(communityPower(s), 3000);
  assert.equal(s.trackers[0].power, 1500);
  assert.equal(s.wallets.You.sqkstr, 1450);
  conserved(s);
});
test("tax reserve before first deposit is preserved and distributed when receipts exist", () => {
  let s = doAction(start(), {
    type: "swap",
    owner: "You",
    side: "buy",
    amount: 2000,
  });
  assert.equal(s.reservePower, 1000);
  conserved(s);
  s = doAction(s, { type: "deposit", owner: "You", ids: [1, 2] });
  assert.equal(s.reservePower, 0);
  assert.equal(s.trackers[0].power, 1500);
  conserved(s);
});
test("multiple automatic purchases preserve remainder and power", () => {
  let s = deposited();
  s = doAction(s, { type: "swap", owner: "You", side: "buy", amount: 4500 });
  assert.equal(s.purchases, 2);
  assert.equal(s.taxPool, 25);
  conserved(s);
});
test("invalid or overspent swaps are atomic and leave all balances unchanged", () => {
  const s = start();
  for (const amount of [-1, 0, NaN, Infinity, 1e20, 10001]) {
    const r = transact(s, { type: "swap", owner: "You", side: "buy", amount });
    assert.equal(r.error, true);
    assert.equal(r.state, s);
  }
});
test("receipt trade settles payment and carries accumulated and future rewards", () => {
  let s = accrue(deposited(), 1, false);
  const power = s.trackers[0].power,
    earned = s.trackers[0].accrued;
  s = doAction(s, { type: "trade", owner: "You", id: 1, price: 100 });
  assert.equal(s.wallets.You.sqk, 10100);
  assert.equal(s.wallets.Friend.sqk, 1900);
  assert.equal(s.trackers[0].owner, "Friend");
  assert.equal(s.trackers[0].power, power);
  assert.equal(s.trackers[0].accrued, earned);
  assert.equal(s.taxPool, 0);
  s = doAction(s, { type: "claim", owner: "Friend", id: 1 });
  close(s.wallets.Friend.sqk, 1900.4);
  conserved(s);
});
test("unaffordable trades and unauthorized claims do not change either wallet", () => {
  const s = deposited();
  for (const price of [-1, 2001, NaN, Infinity])
    assert.equal(
      transact(s, { type: "trade", owner: "You", id: 1, price }).state,
      s,
    );
  assert.equal(
    transact(s, { type: "trade", owner: "Friend", id: 1, price: 1 }).error,
    true,
  );
});
test("save roundtrip preserves positions but never credits offline blocks", () => {
  let s = observeBlocks(deposited(), "live", 100, "one");
  s = doAction(s, { type: "merge", ids: [1, 2] });
  s = accrue(s, 1, false);
  const restored = parseLab(JSON.stringify(s))!;
  assert.ok(restored);
  assert.deepEqual(restored.trackers, s.trackers);
  assert.equal(restored.clock.source, null);
  const after = observeBlocks(restored, "live", 100000, "one");
  assert.equal(after.squeeks.find((t) => t.level === 2)?.cooldown, 3);
});
test("corrupt, unsupported, nonfinite and inconsistent saves are rejected", () => {
  assert.equal(parseLab("{"), null);
  assert.equal(parseLab("{}"), null);
  const a = start();
  a.version = 2 as 1;
  assert.equal(parseLab(JSON.stringify(a)), null);
  const b = deposited();
  b.wallets.You.sqk = -1;
  assert.equal(parseLab(JSON.stringify(b)), null);
  const c = deposited();
  c.trackers[0].power = 500;
  assert.equal(parseLab(JSON.stringify(c)), null);
  const d = deposited();
  d.squeeks.push({ ...d.squeeks[0] });
  assert.equal(parseLab(JSON.stringify(d)), null);
});
test("100 repeated buy/sell/merge cycles preserve vault power and valid persistence", () => {
  let s = deposited([1, 2, 3, 4, 5, 6]);
  for (let i = 0; i < 100; i++) {
    s = doAction(s, {
      type: "swap",
      owner: "You",
      side: "buy",
      amount: Math.min(100, s.wallets.You.sqk),
    });
    s = doAction(s, { type: "swap", owner: "You", side: "sell", amount: 20 });
    s = observeBlocks(s, "practice", i * 3);
    const ready = s.squeeks.filter(
      (t) => t.location === "vault" && !t.cooldown,
    );
    const first = ready.find((t) =>
      ready.some((o) => o.id !== t.id && o.level === t.level),
    );
    if (first) {
      const pair = ready.filter((t) => t.level === first.level).slice(0, 2);
      s = doAction(s, { type: "merge", ids: pair.map((t) => t.id) });
    }
    conserved(s);
    assert.ok(parseLab(JSON.stringify(s)), `bad save at iteration ${i}`);
  }
});

const now = Date.parse("2026-11-04T05:00:00Z");
const sample = () => ({
  generatedAt: new Date(now).toISOString(),
  measurement: {
    coreStatus: "SPINNING",
    rpmMilli: 56523,
    observedAt: new Date(now).toISOString(),
    freshness: "online",
    staleAfterSeconds: 120,
    counterEpoch: "test",
  },
  builder: {
    anchor: { blockHeight: "8343" },
    projected: { blockHeight: "8397" },
  },
});
test("API parser uses exact hardware state, milli-RPM and confirmed anchor height", () => {
  const s = parseStatus(sample(), now);
  assert.equal(s.rpm, 56.523);
  assert.equal(s.height, 8343);
  assert.equal(s.projectedHeight, 8397);
  assert.equal(s.status, "SPINNING");
  const raw = sample();
  raw.measurement.coreStatus = "IDLE";
  assert.equal(parseStatus(raw, now).status, "IDLE");
});
test("API parser rejects stale, missing, malformed and future timestamps", () => {
  assert.throws(() => parseStatus(sample(), now + 121000));
  assert.throws(() => parseStatus({}, now));
  assert.throws(() => parseStatus(sample(), now - 61000));
  const a = sample();
  a.builder.anchor.blockHeight = "oops";
  assert.throws(() => parseStatus(a, now));
  const b = sample();
  b.measurement.freshness = "stale";
  assert.throws(() => parseStatus(b, now));
});
test("missing RPM is unavailable rather than a guessed live speed", () => {
  const s = sample();
  delete (s.measurement as { rpmMilli?: number }).rpmMilli;
  assert.equal(parseStatus(s, now).rpm, null);
});

test("regressed and replayed confirmed heights cannot count completed blocks twice", () => {
  let s = observeBlocks(deposited(), "live", 100, "epoch");
  s = doAction(s, { type: "merge", ids: [1, 2] });
  s = observeBlocks(s, "live", 98, "epoch");
  assert.equal(s.clock.height, 100);
  s = observeBlocks(s, "live", 100, "epoch");
  assert.equal(s.squeeks.find((t) => t.level === 2)?.cooldown, 3);
  s = observeBlocks(s, "live", 101, "epoch");
  assert.equal(s.squeeks.find((t) => t.level === 2)?.cooldown, 2);
});

test("a tax pool fraction just below the threshold never creates negative balance", () => {
  const s = doAction(start(), {
    type: "swap",
    owner: "You",
    side: "buy",
    amount: 1999.9999998,
  });
  assert.equal(s.purchases, 0);
  assert.equal(s.taxPool, 99.99999999);
  assert.ok(parseLab(JSON.stringify(s)));
});
