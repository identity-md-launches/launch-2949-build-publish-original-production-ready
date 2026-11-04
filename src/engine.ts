/** All amounts, receipts and assets in this module are local paper simulation data. */
export const STORAGE_KEY = "squeekstr-desk:v1";
export const RULES = {
  starterSqk: 10_000,
  starterSqkstr: 500,
  friendSqk: 2_000,
  startingPower: 1_000,
  mergeBump: 0.1,
  communityShare: 0.75,
  cooldownBlocks: 3,
  emissionPerSecond: 0.8,
  spinMultiplier: 1.5,
  tax: 0.05,
  acquisitionThreshold: 100,
  sqkstrPrice: 2,
  practiceBlockMs: 8_000,
} as const;
export type Owner = "You" | "Friend";
export type Source = "live" | "practice";
export type Squeek = {
  id: number;
  name: string;
  level: number;
  power: number;
  location: Owner | "vault";
  cooldown: number;
};
export type Tracker = {
  id: number;
  owner: Owner | "Protocol";
  power: number;
  accrued: number;
};
export type Entry = {
  id: number;
  at: number;
  kind: "start" | "deposit" | "merge" | "claim" | "swap" | "trade" | "purchase";
  text: string;
};
export type Lab = {
  version: 1;
  started: boolean;
  wallets: Record<Owner, { sqk: number; sqkstr: number }>;
  squeeks: Squeek[];
  trackers: Tracker[];
  reservePower: number;
  taxPool: number;
  purchases: number;
  nextSqueek: number;
  nextTracker: number;
  nextEntry: number;
  clock: { source: Source | null; height: number; epoch: string };
  practiceHeight: number;
  events: Entry[];
};
export type Action =
  | { type: "start" }
  | { type: "deposit"; owner: Owner; ids: number[] }
  | { type: "merge"; ids: number[] }
  | { type: "claim"; owner: Owner; id: number }
  | { type: "trade"; owner: Owner; id: number; price: number }
  | { type: "swap"; owner: Owner; side: "buy" | "sell"; amount: number };
export type Outcome = { state: Lab; message: string; error: boolean };
export const round = (n: number) => Math.round(n * 1e8) / 1e8;
export const communityPower = (s: Lab) =>
  s.trackers
    .filter((t) => t.owner !== "Protocol")
    .reduce((n, t) => n + t.power, 0);
export const totalPower = (s: Lab) =>
  s.squeeks
    .filter((t) => t.location === "vault")
    .reduce((n, t) => n + t.power, 0);
export const blankLab = (): Lab => ({
  version: 1,
  started: false,
  wallets: { You: { sqk: 0, sqkstr: 0 }, Friend: { sqk: 0, sqkstr: 0 } },
  squeeks: [],
  trackers: [],
  reservePower: 0,
  taxPool: 0,
  purchases: 0,
  nextSqueek: 1,
  nextTracker: 1,
  nextEntry: 1,
  clock: { source: null, height: 0, epoch: "" },
  practiceHeight: 0,
  events: [],
});
function log(s: Lab, kind: Entry["kind"], text: string, now: number) {
  s.events.unshift({ id: s.nextEntry++, at: now, kind, text });
  s.events = s.events.slice(0, 40);
}
function communityGrant(s: Lab, amount: number) {
  const trackers = s.trackers.filter((t) => t.owner !== "Protocol");
  const power = communityPower(s);
  if (!power) {
    s.reservePower = round(s.reservePower + amount);
    return;
  }
  // Give rounding remainder to the last receipt to conserve vault power exactly.
  let distributed = 0;
  trackers.forEach((t, i) => {
    const grant =
      i === trackers.length - 1
        ? round(amount - distributed)
        : round((amount * t.power) / power);
    t.power = round(t.power + grant);
    distributed = round(distributed + grant);
  });
}
export function mergePreview(a: Squeek, b: Squeek) {
  const before = round(a.power + b.power),
    bump = round(before * RULES.mergeBump);
  const community = round(bump * RULES.communityShare);
  return {
    before,
    after: round(before + bump),
    bump,
    community,
    protocol: round(bump - community),
    level: a.level + 1,
  };
}
export function swapQuote(side: "buy" | "sell", amount: number) {
  const gross = side === "buy" ? amount : amount * RULES.sqkstrPrice;
  const tax = round(gross * RULES.tax);
  return {
    gross: round(gross),
    tax,
    receive: round((gross - tax) / (side === "buy" ? RULES.sqkstrPrice : 1)),
  };
}
export function transact(
  state: Lab,
  action: Action,
  now = Date.now(),
): Outcome {
  const fail = (message: string): Outcome => ({ state, message, error: true });
  const s = structuredClone(state);
  if (action.type !== "start" && !s.started)
    return fail("Start the paper desk to receive your starter kit.");
  let message = "";
  switch (action.type) {
    case "start": {
      if (s.started) return fail("Your paper desk is already running.");
      s.started = true;
      s.wallets.You = { sqk: RULES.starterSqk, sqkstr: RULES.starterSqkstr };
      s.wallets.Friend = { sqk: RULES.friendSqk, sqkstr: 0 };
      s.squeeks = ["Pip", "Byte", "Nibbles", "Pixel", "Mochi", "Bolt"].map(
        (name) => ({
          id: s.nextSqueek++,
          name,
          level: 1,
          power: RULES.startingPower,
          location: "You",
          cooldown: 0,
        }),
      );
      message =
        "Starter kit ready. Select Squeeks and make your first deposit.";
      log(
        s,
        "start",
        "Starter kit opened: 6 Squeeks, 10,000 paper SQK, 500 paper SQKSTR.",
        now,
      );
      break;
    }
    case "deposit": {
      const ids = [...new Set(action.ids)];
      if (!ids.length) return fail("Select at least one Squeek to deposit.");
      const selected = s.squeeks.filter(
        (t) => ids.includes(t.id) && t.location === action.owner,
      );
      if (selected.length !== ids.length)
        return fail(
          "These Squeeks are no longer in this wallet. Select again.",
        );
      selected.forEach((t) => {
        t.location = "vault";
        s.trackers.push({
          id: s.nextTracker++,
          owner: action.owner,
          power: t.power,
          accrued: 0,
        });
      });
      if (s.reservePower) {
        const reserve = s.reservePower;
        s.reservePower = 0;
        communityGrant(s, reserve);
      }
      message = `${selected.length} Squeek${selected.length === 1 ? "" : "s"} deposited. ${selected.length} tracker receipt${selected.length === 1 ? "" : "s"} minted to ${action.owner}.`;
      log(s, "deposit", message, now);
      break;
    }
    case "merge": {
      const ids = [...new Set(action.ids)];
      const selected = s.squeeks.filter(
        (t) => ids.includes(t.id) && t.location === "vault",
      );
      if (ids.length !== 2 || selected.length !== 2)
        return fail("Select two vault Squeeks to merge.");
      const [a, b] = selected;
      if (a.level !== b.level)
        return fail("Choose two Squeeks at the same level.");
      if (a.cooldown || b.cooldown)
        return fail(
          "Wait for the remaining completed blocks before merging these Squeeks.",
        );
      const p = mergePreview(a, b);
      communityGrant(s, p.community);
      let protocol = s.trackers.find((t) => t.owner === "Protocol");
      if (!protocol) {
        protocol = { id: 0, owner: "Protocol", power: 0, accrued: 0 };
        s.trackers.push(protocol);
      }
      protocol.power = round(protocol.power + p.protocol);
      s.squeeks = s.squeeks.filter((t) => !ids.includes(t.id));
      const id = s.nextSqueek++;
      s.squeeks.push({
        id,
        name: p.level === 2 ? `${a.name} + ${b.name}` : `Fusion ${id}`,
        level: p.level,
        power: p.after,
        location: "vault",
        cooldown: RULES.cooldownBlocks,
      });
      message = `Level ${p.level} merged. +${p.community} community power, +${p.protocol} protocol power.`;
      log(s, "merge", message, now);
      break;
    }
    case "claim": {
      const t = s.trackers.find(
        (t) => t.id === action.id && t.owner === action.owner,
      );
      if (!t)
        return fail(
          "This receipt belongs to another paper wallet. Switch wallets to manage it.",
        );
      if (t.accrued <= 0)
        return fail(
          "Nothing to claim yet. Rewards accrue while this page is visible.",
        );
      const amount = t.accrued;
      s.wallets[action.owner].sqk = round(s.wallets[action.owner].sqk + amount);
      t.accrued = 0;
      message = `Claimed ${amount.toFixed(4)} paper SQK to ${action.owner}.`;
      log(s, "claim", message, now);
      break;
    }
    case "trade": {
      const t = s.trackers.find(
        (t) => t.id === action.id && t.owner === action.owner,
      );
      const buyer = action.owner === "You" ? "Friend" : "You";
      if (!t)
        return fail(
          "This receipt is no longer in this wallet. Close the trade and try again.",
        );
      if (
        !Number.isFinite(action.price) ||
        action.price < 0 ||
        action.price > 1e9
      )
        return fail("Enter a paper SQK price between 0 and 1,000,000,000.");
      const price = round(action.price);
      if (s.wallets[buyer].sqk < price)
        return fail(
          `${buyer} needs more paper SQK. Choose a lower trade price.`,
        );
      s.wallets[buyer].sqk = round(s.wallets[buyer].sqk - price);
      s.wallets[action.owner].sqk = round(s.wallets[action.owner].sqk + price);
      t.owner = buyer;
      message = `Tracker #${String(t.id).padStart(3, "0")} traded to ${buyer} for ${price} paper SQK. Accrued rewards move with it.`;
      log(s, "trade", message, now);
      break;
    }
    case "swap": {
      if (
        !Number.isFinite(action.amount) ||
        action.amount <= 0 ||
        action.amount > 1e9 ||
        round(action.amount) === 0
      )
        return fail(
          "Enter an amount greater than 0 and no more than 1,000,000,000.",
        );
      const amount = round(action.amount),
        w = s.wallets[action.owner];
      const input = action.side === "buy" ? "sqk" : "sqkstr";
      const output = action.side === "buy" ? "sqkstr" : "sqk";
      if (w[input] < amount)
        return fail(
          `Not enough paper ${input.toUpperCase()}. Lower the amount or use Max.`,
        );
      const q = swapQuote(action.side, amount);
      w[input] = round(w[input] - amount);
      w[output] = round(w[output] + q.receive);
      s.taxPool = round(s.taxPool + q.tax);
      message = `${action.side === "buy" ? "Bought" : "Sold"} paper SQKSTR. ${q.tax} paper SQK added to the tax pool.`;
      log(s, "swap", message, now);
      const count = Math.floor(s.taxPool / RULES.acquisitionThreshold);
      // Inputs are bounded by finite paper balances; batching prevents extreme local saves from freezing the UI.
      if (count > 1000)
        return fail(
          "Choose a smaller amount, below 1,001 tax-funded purchases per swap.",
        );
      if (count) {
        s.taxPool = round(s.taxPool - count * RULES.acquisitionThreshold);
        s.purchases += count;
        for (let i = 0; i < count; i++) {
          const id = s.nextSqueek++;
          s.squeeks.push({
            id,
            name: `Pool Squeek ${id}`,
            level: 1,
            power: RULES.startingPower,
            location: "vault",
            cooldown: 0,
          });
        }
        communityGrant(s, count * RULES.startingPower);
        const bought = `Tax pool bought ${count} paper Squeek${count === 1 ? "" : "s"} for the vault.`;
        message += ` ${bought}`;
        log(s, "purchase", bought, now);
      }
      break;
    }
  }
  return { state: s, message, error: false };
}
export function accrue(state: Lab, seconds: number, rush: boolean): Lab {
  if (!state.started || seconds <= 0 || !Number.isFinite(seconds)) return state;
  const power = totalPower(state);
  if (!power) return state;
  const emission =
    RULES.emissionPerSecond *
    Math.min(seconds, 2) *
    (rush ? RULES.spinMultiplier : 1);
  return {
    ...state,
    trackers: state.trackers.map((t) => ({
      ...t,
      accrued: round(t.accrued + (emission * t.power) / power),
    })),
  };
}
export function observeBlocks(
  state: Lab,
  source: Source,
  height: number,
  epoch = "",
): Lab {
  if (!Number.isSafeInteger(height) || height < 0) return state;
  const sameClock =
    state.clock.source === source && state.clock.epoch === epoch;
  const delta = sameClock ? Math.max(0, height - state.clock.height) : 0;
  // Keep a high-water mark within one epoch: regressed/replayed heights cannot
  // count already-observed completed blocks a second time.
  const observedHeight = sameClock
    ? Math.max(state.clock.height, height)
    : height;
  return {
    ...state,
    clock: { source, height: observedHeight, epoch },
    practiceHeight:
      source === "practice" ? observedHeight : state.practiceHeight,
    squeeks: delta
      ? state.squeeks.map((t) => ({
          ...t,
          cooldown: Math.max(0, t.cooldown - delta),
        }))
      : state.squeeks,
  };
}

/** Reject malformed/unsupported saves instead of loading NaN, dangling ids or negative balances. */
export function parseLab(raw: string): Lab | null {
  try {
    const s: Lab = JSON.parse(raw);
    const num = (n: unknown) =>
      typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 1e15;
    const integer = (n: unknown) => num(n) && Number.isSafeInteger(n);
    if (!s || s.version !== 1 || typeof s.started !== "boolean" || !s.wallets)
      return null;
    for (const owner of ["You", "Friend"] as const)
      if (
        !s.wallets[owner] ||
        !num(s.wallets[owner].sqk) ||
        !num(s.wallets[owner].sqkstr)
      )
        return null;
    if (
      !Array.isArray(s.squeeks) ||
      !Array.isArray(s.trackers) ||
      !Array.isArray(s.events) ||
      s.squeeks.length > 10_000 ||
      s.trackers.length > 10_000 ||
      s.events.length > 40
    )
      return null;
    if (
      !s.squeeks.every(
        (t) =>
          integer(t.id) &&
          t.id > 0 &&
          typeof t.name === "string" &&
          t.name.length <= 2000 &&
          integer(t.level) &&
          t.level > 0 &&
          num(t.power) &&
          t.power > 0 &&
          ["You", "Friend", "vault"].includes(t.location) &&
          integer(t.cooldown) &&
          t.cooldown <= RULES.cooldownBlocks,
      )
    )
      return null;
    if (
      !s.trackers.every(
        (t) =>
          integer(t.id) &&
          ["You", "Friend", "Protocol"].includes(t.owner) &&
          num(t.power) &&
          num(t.accrued),
      )
    )
      return null;
    if (
      !s.events.every(
        (e) =>
          integer(e.id) &&
          num(e.at) &&
          [
            "start",
            "deposit",
            "merge",
            "claim",
            "swap",
            "trade",
            "purchase",
          ].includes(e.kind) &&
          typeof e.text === "string",
      )
    )
      return null;
    if (
      ![s.reservePower, s.taxPool].every(num) ||
      s.taxPool >= RULES.acquisitionThreshold ||
      ![
        s.purchases,
        s.nextSqueek,
        s.nextTracker,
        s.nextEntry,
        s.practiceHeight,
      ].every(integer)
    )
      return null;
    if (
      !s.clock ||
      ![null, "live", "practice"].includes(s.clock.source) ||
      !integer(s.clock.height) ||
      typeof s.clock.epoch !== "string"
    )
      return null;
    if (
      new Set(s.squeeks.map((t) => t.id)).size !== s.squeeks.length ||
      new Set(s.trackers.map((t) => t.id)).size !== s.trackers.length
    )
      return null;
    if (
      s.nextSqueek <= Math.max(0, ...s.squeeks.map((t) => t.id)) ||
      s.nextTracker <= Math.max(0, ...s.trackers.map((t) => t.id)) ||
      s.nextEntry <= Math.max(0, ...s.events.map((t) => t.id))
    )
      return null;
    if (s.trackers.filter((t) => t.owner === "Protocol").length > 1)
      return null;
    const assigned = s.trackers.reduce((n, t) => n + t.power, s.reservePower);
    if (Math.abs(totalPower(s) - assigned) > 0.001) return null;
    // Never count blocks completed while the desk was closed.
    return { ...s, clock: { source: null, height: 0, epoch: "" } };
  } catch {
    return null;
  }
}
