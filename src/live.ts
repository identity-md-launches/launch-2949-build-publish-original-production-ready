import { useEffect, useState } from "react";

export const STATUS_URL = "https://api.squeekchain.com/v1/status";
import { parseStatus, type Measurement } from "./status";

export function useChain() {
  const [sample, setSample] = useState<Measurement | null>(null);
  const [now, setNow] = useState(Date.now());
  const [manualPractice, setManualPractice] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [retryAt, setRetryAt] = useState<number | null>(null);
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (manualPractice) {
      setLoading(false);
      setRetryAt(null);
      return;
    }
    let cancelled = false,
      timer: ReturnType<typeof setTimeout>,
      controller: AbortController;
    let failures = 0;
    async function poll() {
      controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 7000);
      setLoading(true);
      try {
        const response = await fetch(STATUS_URL, {
          signal: controller.signal,
          cache: "no-store",
          credentials: "omit",
          referrerPolicy: "no-referrer",
        });
        if (!response.ok)
          throw new Error(`Live status returned HTTP ${response.status}.`);
        const next = parseStatus(await response.json());
        if (cancelled) return;
        setSample(next);
        setError("");
        failures = 0;
      } catch (e) {
        if (cancelled) return;
        failures++;
        setError(
          e instanceof Error && e.name === "AbortError"
            ? "The live request timed out."
            : e instanceof TypeError
              ? "The live feed could not be reached."
              : e instanceof Error
                ? e.message
                : "The live feed is unavailable.",
        );
      } finally {
        clearTimeout(timeout);
        if (!cancelled) {
          setLoading(false);
          const delay = Math.min(
            120_000,
            15_000 * 2 ** Math.min(3, Math.max(0, failures - 1)),
          );
          setRetryAt(Date.now() + delay);
          timer = setTimeout(poll, delay);
        }
      }
    }
    void poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
      controller?.abort();
    };
  }, [manualPractice, nonce]);
  const stale = !!sample && now - sample.observedAt > sample.staleAfterMs;
  const connecting = !manualPractice && !sample && loading && !error;
  const mode = connecting
    ? "connecting"
    : manualPractice || error || stale || !sample
      ? "practice"
      : "live";
  return {
    sample,
    now,
    mode,
    stale: stale || !!error,
    error,
    loading,
    retryAt,
    manualPractice,
    setManualPractice,
    retry: () => {
      setManualPractice(false);
      setNonce((n) => n + 1);
    },
    spinning:
      mode === "live" ? sample?.status === "SPINNING" : mode === "practice",
  } as const;
}
