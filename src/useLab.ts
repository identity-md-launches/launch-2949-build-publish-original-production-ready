import { useEffect, useRef, useState } from "react";
import {
  accrue,
  blankLab,
  observeBlocks,
  parseLab,
  RULES,
  STORAGE_KEY,
  transact,
  type Action,
  type Lab,
} from "./engine";
import type { useChain } from "./live";

function restore(): { state: Lab; warning: string } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { state: blankLab(), warning: "" };
    const state = parseLab(raw);
    return state
      ? { state, warning: "" }
      : {
          state: blankLab(),
          warning:
            "The saved lab could not be read. Start a fresh paper desk to replace it.",
        };
  } catch {
    return {
      state: blankLab(),
      warning:
        "Browser storage is unavailable. This session works, but changes will not survive a reload.",
    };
  }
}
export function useLab(chain: ReturnType<typeof useChain>, rush: boolean) {
  const [initial] = useState(restore);
  const [state, setState] = useState(initial.state);
  const [storageWarning, setStorageWarning] = useState(initial.warning);
  const [notice, setNotice] = useState({ text: "", error: false });
  const [readOnly, setReadOnly] = useState(false);
  const current = useRef(state),
    simulation = useRef({ chain, rush }),
    lockHeld = useRef(true);
  simulation.current = { chain, rush };
  const update = (next: Lab) => {
    current.current = next;
    setState(next);
  };

  // A Web Lock lets only one tab earn or modify this local lab at a time.
  useEffect(() => {
    if (!navigator.locks) return;
    let release: (() => void) | undefined,
      disposed = false;
    lockHeld.current = false;
    void navigator.locks
      .request("squeekstr-desk:writer", { ifAvailable: true }, async (lock) => {
        if (disposed) return;
        if (!lock) {
          setReadOnly(true);
          return;
        }
        lockHeld.current = true;
        await new Promise<void>((resolve) => {
          release = resolve;
        });
      })
      .catch(() => {
        lockHeld.current = true;
      });
    return () => {
      disposed = true;
      release?.();
    };
  }, []);
  useEffect(() => {
    if (readOnly || !lockHeld.current || !state.started) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      setStorageWarning(
        "Unable to save this lab. Your changes work in this tab only; browser storage may be full or disabled.",
      );
    }
  }, [state, readOnly]);
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY || lockHeld.current) return;
      const saved = event.newValue ? parseLab(event.newValue) : blankLab();
      if (saved) update(saved);
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  useEffect(() => {
    if (!state.started) return;
    let lastTime = performance.now(),
      practiceElapsed = 0,
      lastMode = "";
    const timer = setInterval(() => {
      const time = performance.now(),
        seconds = Math.min(2, (time - lastTime) / 1000);
      lastTime = time;
      if (
        !lockHeld.current ||
        document.visibilityState !== "visible" ||
        !current.current.started
      )
        return;
      const { chain: c, rush: r } = simulation.current;
      let next = current.current;
      if (lastMode !== c.mode) {
        practiceElapsed = 0;
        lastMode = c.mode;
      }
      if (c.mode === "live" && c.sample)
        next = observeBlocks(next, "live", c.sample.height, c.sample.epoch);
      else if (c.mode === "practice") {
        next = observeBlocks(next, "practice", next.practiceHeight);
        practiceElapsed += seconds * 1000;
        if (practiceElapsed >= RULES.practiceBlockMs) {
          practiceElapsed -= RULES.practiceBlockMs;
          next = observeBlocks(next, "practice", next.practiceHeight + 1);
        }
      }
      next = accrue(next, seconds, r && c.spinning);
      update(next);
    }, 1000);
    return () => clearInterval(timer);
  }, [state.started]);
  function act(action: Action) {
    if (!lockHeld.current) {
      setNotice({
        text: "This lab is active in another tab. Close that tab and reload here to continue.",
        error: true,
      });
      return false;
    }
    // Apply blocks already observed before an action. A just-created merge must
    // not consume block advances that happened before its creation.
    const c = simulation.current.chain;
    let basis = current.current;
    if (c.mode === "live" && c.sample)
      basis = observeBlocks(basis, "live", c.sample.height, c.sample.epoch);
    else if (c.mode === "practice")
      basis = observeBlocks(basis, "practice", basis.practiceHeight);
    const result = transact(basis, action);
    if (!result.error) update(result.state);
    setNotice({ text: result.message, error: result.error });
    return !result.error;
  }
  function reset() {
    if (!lockHeld.current) return;
    try {
      localStorage.removeItem(STORAGE_KEY);
      setStorageWarning("");
    } catch {
      setStorageWarning(
        "The saved lab could not be removed. Browser storage is disabled.",
      );
    }
    update(blankLab());
    setNotice({
      text: "Paper lab reset. Start again for a fresh kit.",
      error: false,
    });
  }
  return {
    state,
    act,
    reset,
    storageWarning,
    notice,
    dismiss: () => setNotice({ text: "", error: false }),
    readOnly,
  };
}
