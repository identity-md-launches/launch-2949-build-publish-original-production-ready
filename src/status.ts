export type Measurement = {
  status: "SPINNING" | "IDLE";
  rpm: number | null;
  height: number;
  observedAt: number;
  generatedAt: number;
  staleAfterMs: number;
  epoch: string;
  projectedHeight: number | null;
};
function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}
function height(value: unknown): number | null {
  if (
    typeof value !== "number" &&
    (typeof value !== "string" || !/^\d+$/.test(value))
  )
    return null;
  const n = Number(value);
  return Number.isSafeInteger(n) && n >= 0 ? n : null;
}
export function parseStatus(value: unknown, now = Date.now()): Measurement {
  const root = record(value),
    m = record(root.measurement),
    builder = record(root.builder);
  if (m.coreStatus !== "SPINNING" && m.coreStatus !== "IDLE")
    throw new Error("The live wheel state is unavailable.");
  const confirmed = height(record(builder.anchor).blockHeight);
  if (confirmed === null)
    throw new Error("The API has no confirmed block height.");
  const observedAt = Date.parse(String(m.observedAt || root.generatedAt || ""));
  const generatedAt = Date.parse(
    String(root.generatedAt || m.observedAt || ""),
  );
  const seconds =
    typeof m.staleAfterSeconds === "number" &&
    Number.isFinite(m.staleAfterSeconds)
      ? m.staleAfterSeconds
      : 120;
  const staleAfterMs = Math.min(300, Math.max(15, seconds)) * 1000;
  if (
    !Number.isFinite(observedAt) ||
    !Number.isFinite(generatedAt) ||
    observedAt > now + 60_000
  )
    throw new Error("The API timestamp is invalid.");
  if (
    (m.freshness && m.freshness !== "online") ||
    now - observedAt > staleAfterMs
  )
    throw new Error("The live measurement is stale.");
  return {
    status: m.coreStatus,
    rpm:
      typeof m.rpmMilli === "number" &&
      Number.isFinite(m.rpmMilli) &&
      m.rpmMilli >= 0
        ? m.rpmMilli / 1000
        : null,
    height: confirmed,
    observedAt,
    generatedAt,
    staleAfterMs,
    epoch: typeof m.counterEpoch === "string" ? m.counterEpoch : "",
    projectedHeight: height(record(builder.projected).blockHeight),
  };
}
