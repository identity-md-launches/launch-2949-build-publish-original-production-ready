import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { BrandMark, Hamster, Icon, Wheel, type IconName } from "./Art";
import {
  blankLab,
  communityPower,
  mergePreview,
  RULES,
  swapQuote,
  totalPower,
  transact,
  type Owner,
  type Squeek,
  type Tracker,
} from "./engine";
import { STATUS_URL, useChain } from "./live";
import { useLab } from "./useLab";

const fmt = (n: number, decimals = 0) =>
  n.toLocaleString("en-US", {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  });
const receiptId = (id: number) => `#${String(id).padStart(3, "0")}`;
const kit = transact(blankLab(), { type: "start" }, 0).state.squeeks;

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const active = document.activeElement as HTMLElement | null;
    ref.current?.showModal();
    return () => {
      if (active?.isConnected) active.focus();
      else document.getElementById("receipts-title")?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      aria-labelledby="modal-title"
      onCancel={onClose}
      onKeyDown={(e) => {
        if (e.key !== "Tab") return;
        const controls = Array.from(
          e.currentTarget.querySelectorAll<HTMLElement>(
            'button:not(:disabled), a[href], input:not(:disabled), [tabindex="0"]',
          ),
        ).filter((el) => el.getClientRects().length);
        const first = controls[0],
          last = controls[controls.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }}
      onClick={(e) => {
        if (e.target !== e.currentTarget) return;
        const bounds = e.currentTarget.getBoundingClientRect();
        if (
          e.clientX < bounds.left ||
          e.clientX > bounds.right ||
          e.clientY < bounds.top ||
          e.clientY > bounds.bottom
        )
          onClose();
      }}
    >
      <div className="modal-heading">
        <h2 id="modal-title">{title}</h2>
        <button
          className="icon-button"
          onClick={onClose}
          aria-label="Close dialog"
        >
          <Icon name="close" />
        </button>
      </div>
      {children}
    </dialog>
  );
}

function SqueekTile({
  squeek,
  selected,
  onSelect,
  disabled,
  merge,
}: {
  squeek: Squeek;
  selected: boolean;
  onSelect: () => void;
  disabled: boolean;
  merge: boolean;
}) {
  return (
    <button
      className={`squeek-tile variant-${(squeek.id - 1) % 6} ${selected ? "selected" : ""}`}
      aria-pressed={selected}
      aria-label={`Select ${squeek.name}, level ${squeek.level}, ${fmt(squeek.power)} power${squeek.cooldown ? `, ${squeek.cooldown} blocks cooling` : ""}`}
      disabled={disabled}
      onClick={onSelect}
    >
      <span className="tile-top">
        <span>Level {squeek.level}</span>
        <span className="selection-check">
          {selected ? (
            <Icon name="check" size={14} />
          ) : (
            <Icon name="plus" size={14} />
          )}
        </span>
      </span>
      <Hamster variant={squeek.id - 1} />
      <span className="tile-name">{squeek.name}</span>
      <span className="tile-power">
        <Icon name={squeek.cooldown ? "clock" : "bolt"} size={14} />
        {merge && squeek.cooldown
          ? `${squeek.cooldown} blocks to ready`
          : `${fmt(squeek.power, squeek.power % 1 ? 1 : 0)} power`}
      </span>
    </button>
  );
}

export default function App() {
  const chain = useChain();
  const [rush, setRush] = useState(false);
  const [paused, setPaused] = useState(false);
  const lab = useLab(chain, rush);
  const { state } = lab;
  const [owner, setOwner] = useState<Owner>("You");
  const [vaultView, setVaultView] = useState<"deposit" | "merge">("deposit");
  const [depositIds, setDepositIds] = useState<number[]>([1, 2]);
  const [mergeIds, setMergeIds] = useState<number[]>([]);
  const [dialog, setDialog] = useState<"help" | "reset" | null>(null);
  const [tradeTracker, setTradeTracker] = useState<Tracker | null>(null);
  const [tradePrice, setTradePrice] = useState("100");
  const [tradeError, setTradeError] = useState("");
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("2000");
  const [swapError, setSwapError] = useState("");
  const started = state.started,
    disabled = !started || lab.readOnly;
  const wallet = state.wallets[owner],
    friend = owner === "You" ? "Friend" : "You";
  const vault = state.squeeks.filter((s) => s.location === "vault");
  const inventory = started
    ? state.squeeks.filter((s) => s.location === owner)
    : kit;
  const receipts = state.trackers.filter((t) => t.owner === owner);
  const power = totalPower(state),
    community = communityPower(state);
  const protocol = state.trackers.find((t) => t.owner === "Protocol");
  const yourPower = receipts.reduce((n, t) => n + t.power, 0);
  const claimable = receipts.reduce((n, t) => n + t.accrued, 0);
  const depositSelection = inventory.filter((t) => depositIds.includes(t.id));
  const mergeSelection = vault.filter((t) => mergeIds.includes(t.id));
  const preview =
    mergeSelection.length === 2 &&
    mergeSelection[0].level === mergeSelection[1].level
      ? mergePreview(mergeSelection[0], mergeSelection[1])
      : null;
  const canMerge = !!preview && mergeSelection.every((t) => t.cooldown === 0);
  const amountNumber = Number(amount),
    validAmount =
      Number.isFinite(amountNumber) && amountNumber > 0 && amountNumber <= 1e9;
  const quote = swapQuote(side, validAmount ? amountNumber : 0);
  const rushActive = rush && chain.spinning;
  const rate =
    RULES.emissionPerSecond * (rushActive ? RULES.spinMultiplier : 1);
  const earnedRate = power ? (rate * yourPower) / power : 0;

  function switchOwner(next: Owner) {
    setOwner(next);
    setDepositIds([]);
    setSwapError("");
  }
  function selectMergeView() {
    setVaultView("merge");
    const ready = vault.filter((t) => !t.cooldown);
    const first = ready.find((t) =>
      ready.some((other) => t.id !== other.id && t.level === other.level),
    );
    setMergeIds(
      first
        ? ready
            .filter((t) => t.level === first.level)
            .slice(0, 2)
            .map((t) => t.id)
        : [],
    );
  }
  function submitSwap(e: FormEvent) {
    e.preventDefault();
    const balance = side === "buy" ? wallet.sqk : wallet.sqkstr;
    if (!validAmount) {
      setSwapError("Enter an amount greater than 0, up to 1,000,000,000.");
      document.getElementById("swap-amount")?.focus();
      return;
    }
    if (amountNumber > balance) {
      setSwapError(
        `Not enough paper ${side === "buy" ? "SQK" : "SQKSTR"}. Lower the amount or use Max.`,
      );
      document.getElementById("swap-amount")?.focus();
      return;
    }
    setSwapError("");
    lab.act({ type: "swap", owner, side, amount: amountNumber });
  }
  function submitTrade(e: FormEvent) {
    e.preventDefault();
    const price = Number(tradePrice);
    if (!tradeTracker) return;
    if (
      !tradePrice.trim() ||
      !Number.isFinite(price) ||
      price < 0 ||
      price > state.wallets[friend].sqk
    ) {
      setTradeError(
        `Enter a price from 0 to ${fmt(state.wallets[friend].sqk, 2)} paper SQK.`,
      );
      document.getElementById("trade-price")?.focus();
      return;
    }
    if (lab.act({ type: "trade", owner, id: tradeTracker.id, price }))
      setTradeTracker(null);
  }

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to desk
      </a>
      <header className="app-header">
        <a className="brand" href="#main" aria-label="Squeekstr Desk home">
          <BrandMark />
          <span>
            Squeekstr<span className="brand-desk">Desk</span>
          </span>
        </a>
        <div className="header-middle">
          <span className="header-divider" />
          Squeekchain <span className="muted">/</span> Genesis Code
        </div>
        <div className="header-tools">
          <span className="paper-badge">
            <Icon name="shield" size={14} />
            Paper only
          </span>
          <button
            className="icon-button"
            aria-label="How it works"
            onClick={() => setDialog("help")}
          >
            <Icon name="help" />
          </button>
        </div>
      </header>

      <div className="app-shell">
        <aside className="sidebar" aria-label="Desk navigation">
          <nav>
            <a className="nav-link active" href="#vault">
              <Icon name="vault" />
              Vault desk
              <span className="nav-dot" />
            </a>
            <a className="nav-link" href="#receipts">
              <Icon name="receipt" />
              Tracker receipts
            </a>
            <a className="nav-link" href="#market">
              <Icon name="swap" />
              Paper market
            </a>
            <a className="nav-link" href="#activity">
              <Icon name="activity" />
              Activity
            </a>
          </nav>
          <div className="sidebar-bottom">
            <div className="sidebar-note">
              <Icon name="shield" />
              <p>
                A little practice.
                <br />A lot of squeek.
              </p>
              <span>
                Local paper assets.
                <br />
                No wallet needed.
              </span>
            </div>
            <button className="nav-link" onClick={() => setDialog("help")}>
              <Icon name="help" />
              How it works
            </button>
            <button
              className="nav-link"
              onClick={() => setDialog("reset")}
              disabled={lab.readOnly}
            >
              <Icon name="reset" />
              Reset lab
            </button>
            <a
              className="network-link"
              href="https://squeekchain.com/genesis/d4sp8cje"
              target="_blank"
              rel="noreferrer"
            >
              Built on Squeekchain
              <Icon name="external" size={14} />
            </a>
          </div>
        </aside>

        <main id="main" className="desk">
          <div className="page-heading">
            <div>
              <h1>Your paper vault</h1>
              <p>Real wheel. Paper assets. A protocol you can play with.</p>
            </div>
            <a
              href="#wheel"
              className={`connection-pill ${chain.mode === "live" ? "live" : ""}`}
            >
              <span className="status-dot" />
              {chain.mode === "connecting"
                ? "Connecting to wheel"
                : chain.mode === "practice"
                  ? "Practice mode"
                  : `Live wheel · ${chain.spinning ? "Spinning" : "Idle"}`}
            </a>
          </div>

          {!started && (
            <section className="starter" aria-labelledby="starter-title">
              <div>
                <h2 id="starter-title">Your first shift starts here.</h2>
                <p>6 Squeeks · 10,000 paper SQK · 500 paper SQKSTR</p>
              </div>
              <button
                className="button primary"
                onClick={() => {
                  if (lab.act({ type: "start" })) setDepositIds([1, 2]);
                }}
                disabled={lab.readOnly}
              >
                Start paper desk
                <Icon name="arrow" size={18} />
              </button>
            </section>
          )}

          {(lab.storageWarning || lab.readOnly) && (
            <div className="warning" role="status">
              {lab.readOnly
                ? "This lab is active in another tab. This view is read-only. Close the other tab and reload here to continue."
                : lab.storageWarning}
            </div>
          )}

          <div className="stats-row">
            <div className="stat">
              <span>
                Community power <Icon name="bolt" size={14} />
              </span>
              <strong>
                {fmt(community, community % 1 ? 1 : 0)}
                <small>pwr</small>
              </strong>
              <span className="stat-note">
                {vault.length} Squeeks in the vault
              </span>
            </div>
            <div className="stat">
              <span>
                {owner === "You" ? "Your" : "Friend’s"} claimable{" "}
                <Icon name="receipt" size={14} />
              </span>
              <strong>
                {fmt(claimable, 2)}
                <small>SQK</small>
              </strong>
              <span className="stat-note">
                {fmt(earnedRate, 3)} paper SQK / sec
              </span>
            </div>
            <div className="stat">
              <span>
                Protocol power <Icon name="merge" size={14} />
              </span>
              <strong>
                {fmt(protocol?.power || 0, 1)}
                <small>pwr</small>
              </strong>
              <span className="stat-note">25% of every merge bump</span>
            </div>
          </div>

          <div className="workspace">
            <div className="main-column">
              <section
                className="panel vault-panel"
                id="vault"
                aria-labelledby="vault-title"
              >
                <div className="panel-heading">
                  <div className="heading-with-icon">
                    <Icon name="vault" />
                    <h2 id="vault-title">The vault</h2>
                  </div>
                  <span className="subtle-tag">{fmt(power)} total power</span>
                </div>
                <div className="vault-tabs" aria-label="Vault view">
                  <button
                    className={vaultView === "deposit" ? "selected" : ""}
                    aria-pressed={vaultView === "deposit"}
                    onClick={() => setVaultView("deposit")}
                  >
                    Deposit Squeeks<span>{inventory.length}</span>
                  </button>
                  <button
                    className={vaultView === "merge" ? "selected" : ""}
                    aria-pressed={vaultView === "merge"}
                    onClick={selectMergeView}
                  >
                    Merge & grow<span>{vault.length}</span>
                  </button>
                </div>

                {vaultView === "deposit" ? (
                  <div className="vault-body">
                    <div className="action-row">
                      <div>
                        <strong>
                          {depositSelection.length} selected{" "}
                          <span className="muted">/ {inventory.length}</span>
                        </strong>
                        <span>
                          {fmt(
                            depositSelection.reduce((n, s) => n + s.power, 0),
                          )}{" "}
                          power to deposit
                        </span>
                      </div>
                      <button
                        className="button primary"
                        disabled={disabled || !depositSelection.length}
                        onClick={() => {
                          if (
                            lab.act({
                              type: "deposit",
                              owner,
                              ids: depositSelection.map((t) => t.id),
                            })
                          )
                            setDepositIds([]);
                        }}
                      >
                        <Icon name="plus" size={16} />
                        Deposit {depositSelection.length || ""} Squeeks
                      </button>
                    </div>
                    <div className="collection-heading">
                      <span>
                        {started
                          ? `${owner === "You" ? "Your" : "Friend’s"} paper collection`
                          : "Starter kit preview"}
                      </span>
                      <button
                        className="text-button"
                        disabled={disabled || !inventory.length}
                        onClick={() =>
                          setDepositIds(
                            depositSelection.length === inventory.length
                              ? []
                              : inventory.map((t) => t.id),
                          )
                        }
                      >
                        {depositSelection.length === inventory.length
                          ? "Clear selection"
                          : "Select all"}
                      </button>
                    </div>
                    {inventory.length ? (
                      <div className="squeek-grid">
                        {inventory.map((s) => (
                          <SqueekTile
                            key={s.id}
                            squeek={s}
                            selected={depositIds.includes(s.id)}
                            disabled={disabled}
                            merge={false}
                            onSelect={() =>
                              setDepositIds((ids) =>
                                ids.includes(s.id)
                                  ? ids.filter((id) => id !== s.id)
                                  : [...ids, s.id],
                              )
                            }
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="empty-state">
                        <Hamster variant={1} />
                        <h3>
                          {owner === "You"
                            ? "Your Squeeks are on shift."
                            : "No Squeeks in this wallet."}
                        </h3>
                        <p>
                          {owner === "You"
                            ? "Merge matching levels to grow the vault’s power."
                            : "Trade a tracker from You to Friend to try a new reward owner."}
                        </p>
                        <button
                          className="button secondary"
                          onClick={
                            owner === "You"
                              ? selectMergeView
                              : () => switchOwner("You")
                          }
                        >
                          {owner === "You" ? "Find a merge" : "Switch to You"}
                          <Icon name="arrow" size={16} />
                        </button>
                      </div>
                    )}
                    <p className="panel-footnote">
                      <Icon name="receipt" size={15} />
                      Each deposit mints a tracker receipt. Deposits stay in
                      this paper vault.
                    </p>
                  </div>
                ) : (
                  <div className="vault-body">
                    <div className="merge-intro">
                      <strong>Two tips. One stronger Squeek.</strong>
                      <span>
                        Select two matching levels in the shared vault.
                      </span>
                    </div>
                    {vault.length ? (
                      <div className="squeek-grid merge-grid">
                        {vault.map((s) => (
                          <SqueekTile
                            key={s.id}
                            squeek={s}
                            selected={mergeIds.includes(s.id)}
                            disabled={disabled}
                            merge
                            onSelect={() =>
                              setMergeIds((ids) =>
                                ids.includes(s.id)
                                  ? ids.filter((id) => id !== s.id)
                                  : [...ids.slice(-1), s.id],
                              )
                            }
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="empty-state compact">
                        <Icon name="merge" size={32} />
                        <h3>Power starts with a deposit.</h3>
                        <p>
                          Add two Level 1 Squeeks to preview your first merge.
                        </p>
                        <button
                          className="button secondary"
                          onClick={() => setVaultView("deposit")}
                        >
                          Select Squeeks
                          <Icon name="arrow" size={16} />
                        </button>
                      </div>
                    )}
                    {preview && (
                      <div className="merge-preview" aria-label="Merge preview">
                        <div className="merge-math">
                          <div>
                            <span>Current power</span>
                            <strong>{fmt(preview.before, 1)}</strong>
                          </div>
                          <Icon name="arrow" />
                          <div>
                            <span>Level {preview.level} power</span>
                            <strong>{fmt(preview.after, 1)}</strong>
                          </div>
                          <span className="gain">+10%</span>
                        </div>
                        <div className="merge-split">
                          <span>
                            Community{" "}
                            <strong>+{fmt(preview.community, 1)}</strong>
                          </span>
                          <span>
                            Protocol{" "}
                            <strong>+{fmt(preview.protocol, 1)}</strong>
                          </span>
                        </div>
                        <p>
                          The bump is shared 75% / 25%. Existing community
                          receipts grow proportionally.
                        </p>
                      </div>
                    )}
                    {vault.length > 0 && (
                      <>
                        <button
                          className="button primary full"
                          disabled={disabled || !canMerge}
                          onClick={() => {
                            if (lab.act({ type: "merge", ids: mergeIds }))
                              setMergeIds([]);
                          }}
                        >
                          <Icon name="merge" size={18} />
                          {preview
                            ? `Merge to Level ${preview.level}`
                            : "Select two matching levels"}
                        </button>
                        <p className="panel-footnote">
                          <Icon name="clock" size={15} />
                          {preview && !canMerge
                            ? "These Squeeks are cooling. "
                            : ""}
                          Next merge unlocks after 3{" "}
                          {chain.mode === "practice"
                            ? "Practice ticks (8s each)"
                            : "confirmed Squeek blocks"}
                          .
                        </p>
                      </>
                    )}
                  </div>
                )}
              </section>

              <section
                className="receipts-section"
                id="receipts"
                aria-labelledby="receipts-title"
              >
                <div className="section-heading">
                  <div className="heading-with-icon">
                    <Icon name="receipt" />
                    <h2 id="receipts-title" tabIndex={-1}>
                      Tracker receipts
                    </h2>
                    <span className="count">{receipts.length}</span>
                  </div>
                  <span>{owner} wallet</span>
                </div>
                {receipts.length ? (
                  <div className="receipt-grid">
                    {receipts.map((t) => (
                      <article className="receipt-card" key={t.id}>
                        <div className="receipt-top">
                          <span>Tracker {receiptId(t.id)}</span>
                          <Icon name="receipt" size={18} />
                        </div>
                        <div className="receipt-power">
                          <strong>{fmt(t.power, t.power % 1 ? 2 : 0)}</strong>
                          <span>mining power</span>
                        </div>
                        <div className="receipt-share">
                          <span>
                            {fmt(power ? (t.power / power) * 100 : 0, 2)}%
                            reward share
                          </span>
                          <span>{owner}</span>
                        </div>
                        <div className="receipt-tear" />
                        <div className="receipt-accrued">
                          <span>Claimable paper SQK</span>
                          <strong>{fmt(t.accrued, 4)}</strong>
                        </div>
                        <div className="receipt-actions">
                          <button
                            className="button receipt-claim"
                            disabled={disabled || t.accrued <= 0}
                            onClick={() =>
                              lab.act({ type: "claim", owner, id: t.id })
                            }
                          >
                            Claim SQK
                            <Icon name="down" size={14} />
                          </button>
                          <button
                            className="button receipt-trade"
                            disabled={disabled}
                            onClick={() => {
                              setTradeTracker(t);
                              setTradePrice("100");
                              setTradeError("");
                            }}
                          >
                            Trade
                            <Icon name="swap" size={14} />
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="receipt-empty">
                    <div className="empty-receipt" aria-hidden="true">
                      <Icon name="receipt" size={28} />
                      <span>001</span>
                    </div>
                    <div>
                      <h3>A little paper. A share of the power.</h3>
                      <p>
                        {owner === "You"
                          ? "Deposit a Squeek to mint your first tracker."
                          : "Receipts traded to Friend will appear here."}
                      </p>
                      <a href="#vault">
                        {owner === "You"
                          ? "Go to deposit"
                          : "Back to the vault"}
                        <Icon name="arrow" size={14} />
                      </a>
                    </div>
                  </div>
                )}
                <p className="section-note">
                  Receipts carry their power and unclaimed rewards when traded.
                </p>
              </section>
            </div>

            <div className="side-column">
              <section
                className="panel wheel-panel"
                id="wheel"
                aria-labelledby="wheel-title"
              >
                <div className="panel-heading">
                  <div className="heading-with-icon">
                    <Icon name="activity" />
                    <h2 id="wheel-title">The wheel</h2>
                  </div>
                  <button
                    className="icon-button"
                    onClick={() => setPaused((p) => !p)}
                    aria-label={
                      paused
                        ? "Resume wheel animation"
                        : "Pause wheel animation"
                    }
                    aria-pressed={paused}
                  >
                    <Icon name={paused ? "play" : "pause"} size={16} />
                  </button>
                </div>
                <div className="wheel-scene">
                  <Wheel
                    spinning={chain.spinning}
                    paused={paused}
                    rpm={chain.mode === "live" ? chain.sample?.rpm || 0 : 48}
                  />
                  <div className="wheel-reading">
                    <span
                      className={`wheel-state ${chain.mode === "live" ? "live" : ""}`}
                    >
                      <span className="status-dot" />
                      {chain.mode === "connecting"
                        ? "Connecting"
                        : chain.mode === "practice"
                          ? "Simulated spin"
                          : chain.spinning
                            ? "Spinning"
                            : "Idle"}
                    </span>
                    <strong>
                      {chain.mode === "connecting"
                        ? "—"
                        : chain.mode === "live"
                          ? chain.sample?.rpm === null
                            ? "—"
                            : fmt(chain.sample?.rpm || 0, 1)
                          : "48.0"}
                      <span>RPM</span>
                    </strong>
                    <span className="wheel-mode">
                      {chain.mode === "live"
                        ? "Live hardware measurement"
                        : chain.mode === "practice"
                          ? "Practice mode · simulated"
                          : "Requesting live measurement"}
                    </span>
                  </div>
                </div>
                <label className={`rush-toggle ${rushActive ? "on" : ""}`}>
                  <span>
                    <Icon name="bolt" size={17} />
                    <strong>Spin Rush</strong>
                    <span className="rush-multiplier">1.5×</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={rush}
                    disabled={!chain.spinning}
                    onChange={(e) => setRush(e.target.checked)}
                    aria-describedby="rush-help"
                  />
                  <span className="switch" aria-hidden="true" />
                </label>
                <p className="rush-help" id="rush-help">
                  {chain.mode === "connecting"
                    ? "Base rate while the wheel connects."
                    : chain.mode === "live" && !chain.spinning
                      ? "Wheel idle. Base accrual is active."
                      : rushActive
                        ? `${chain.mode === "practice" ? "Simulated boost" : "Live boost"} active: ${fmt(rate, 1)} paper SQK / sec.`
                        : "Enable boosted accrual while the wheel spins."}
                </p>
                <dl className="chain-data">
                  <div>
                    <dt>
                      {chain.mode === "practice"
                        ? "Practice tick"
                        : "Confirmed block"}
                    </dt>
                    <dd>
                      {chain.mode === "connecting"
                        ? "Pending"
                        : chain.mode === "practice"
                          ? `#${fmt(state.practiceHeight)}`
                          : `#${fmt(chain.sample?.height || 0)}`}
                    </dd>
                  </div>
                  <div>
                    <dt>Measurement</dt>
                    <dd>
                      {chain.sample ? (
                        <time
                          dateTime={new Date(
                            chain.sample.observedAt,
                          ).toISOString()}
                          title={new Date(
                            chain.sample.observedAt,
                          ).toISOString()}
                        >
                          {new Date(chain.sample.observedAt).toLocaleString(
                            "en-GB",
                            {
                              timeZone: "UTC",
                              day: "2-digit",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                              second: "2-digit",
                              hour12: false,
                            },
                          )}{" "}
                          UTC{" "}
                          {chain.stale && (
                            <span className="stale-label">Stale</span>
                          )}
                        </time>
                      ) : (
                        "No live sample yet"
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>Live source</dt>
                    <dd>
                      <a href={STATUS_URL} target="_blank" rel="noreferrer">
                        Squeekchain API
                        <Icon name="external" size={12} />
                      </a>
                    </dd>
                  </div>
                </dl>
                {chain.mode === "practice" && (
                  <p className="practice-note">
                    {chain.manualPractice
                      ? "Practice selected. Local ticks every 8 seconds."
                      : `${chain.error || "Live data is stale."} Using local ticks every 8 seconds.`}
                  </p>
                )}
                <div className="chain-controls">
                  <button
                    className="text-button"
                    disabled={chain.loading}
                    onClick={chain.retry}
                  >
                    {chain.loading
                      ? "Checking live…"
                      : chain.mode === "live"
                        ? "Refresh status"
                        : "Retry live feed"}
                    <Icon name="reset" size={12} />
                  </button>
                  <button
                    className="text-button"
                    onClick={() =>
                      chain.setManualPractice(!chain.manualPractice)
                    }
                  >
                    {chain.manualPractice ? "Use live mode" : "Use Practice"}
                  </button>
                </div>
                <div className="poll-note">
                  {chain.mode === "practice" && chain.manualPractice
                    ? "Live polling paused"
                    : chain.retryAt
                      ? `Next check in ${Math.max(0, Math.ceil((chain.retryAt - chain.now) / 1000))}s · 7s timeout`
                      : "Live checks every 15s · 7s timeout"}
                </div>
              </section>

              <section
                className="panel wallet-panel"
                aria-labelledby="wallet-title"
              >
                <div className="panel-heading">
                  <div className="heading-with-icon">
                    <Icon name="wallet" />
                    <h2 id="wallet-title">Paper wallet</h2>
                  </div>
                  <div
                    className="wallet-switch"
                    aria-label="Active paper wallet"
                  >
                    <button
                      className={owner === "You" ? "selected" : ""}
                      aria-pressed={owner === "You"}
                      onClick={() => switchOwner("You")}
                    >
                      You
                    </button>
                    <button
                      className={owner === "Friend" ? "selected" : ""}
                      aria-pressed={owner === "Friend"}
                      onClick={() => switchOwner("Friend")}
                    >
                      Friend
                    </button>
                  </div>
                </div>
                <div className="wallet-balances">
                  <div>
                    <span>
                      <span className="coin">s</span>Paper SQK
                    </span>
                    <strong>{fmt(wallet.sqk, 2)}</strong>
                  </div>
                  <div>
                    <span>
                      <span className="coin alt">s</span>Paper SQKSTR
                    </span>
                    <strong>{fmt(wallet.sqkstr, 2)}</strong>
                  </div>
                </div>
              </section>

              <section
                className="panel market-panel"
                id="market"
                aria-labelledby="market-title"
              >
                <div className="panel-heading">
                  <div className="heading-with-icon">
                    <Icon name="swap" />
                    <h2 id="market-title">Paper swap</h2>
                  </div>
                  <span className="subtle-tag">5% tax</span>
                </div>
                <form onSubmit={submitSwap} noValidate>
                  <div className="swap-tabs" aria-label="Swap direction">
                    <button
                      type="button"
                      className={side === "buy" ? "selected" : ""}
                      aria-pressed={side === "buy"}
                      onClick={() => {
                        setSide("buy");
                        setAmount("2000");
                        setSwapError("");
                      }}
                    >
                      Buy SQKSTR
                    </button>
                    <button
                      type="button"
                      className={side === "sell" ? "selected" : ""}
                      aria-pressed={side === "sell"}
                      onClick={() => {
                        setSide("sell");
                        setAmount("100");
                        setSwapError("");
                      }}
                    >
                      Sell SQKSTR
                    </button>
                  </div>
                  <div className="swap-input">
                    <div>
                      <label htmlFor="swap-amount">
                        You pay <span>· {owner} wallet</span>
                      </label>
                      <button
                        type="button"
                        className="text-button"
                        disabled={disabled}
                        onClick={() => {
                          setAmount(
                            String(side === "buy" ? wallet.sqk : wallet.sqkstr),
                          );
                          setSwapError("");
                        }}
                      >
                        Max
                      </button>
                    </div>
                    <div>
                      <input
                        id="swap-amount"
                        name="swap-amount"
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        value={amount}
                        onChange={(e) => {
                          setAmount(e.target.value);
                          setSwapError("");
                        }}
                        aria-invalid={!!swapError}
                        aria-describedby={
                          swapError ? "swap-error" : "swap-price"
                        }
                      />
                      <strong>{side === "buy" ? "SQK" : "SQKSTR"}</strong>
                    </div>
                  </div>
                  {swapError && (
                    <p className="field-error" id="swap-error" role="alert">
                      {swapError}
                    </p>
                  )}
                  <dl className="swap-quote">
                    <div>
                      <dt>You receive</dt>
                      <dd>
                        {fmt(quote.receive, 2)}{" "}
                        {side === "buy" ? "SQKSTR" : "SQK"}
                      </dd>
                    </div>
                    <div>
                      <dt>Tax to vault pool</dt>
                      <dd>{fmt(quote.tax, 2)} SQK</dd>
                    </div>
                  </dl>
                  <button
                    className="button secondary full"
                    disabled={disabled}
                    type="submit"
                  >
                    {side === "buy" ? "Buy paper SQKSTR" : "Sell paper SQKSTR"}
                    <Icon name="swap" size={16} />
                  </button>
                  <p className="swap-price" id="swap-price">
                    Fixed lab rate: 1 SQKSTR = 2 SQK. Paper only.
                  </p>
                </form>
                <div className="tax-pool">
                  <div>
                    <strong>Tax-funded Squeeks</strong>
                    <span>{state.purchases} bought</span>
                  </div>
                  <div
                    className="progress-track"
                    role="progressbar"
                    aria-label="Tax pool toward next paper Squeek"
                    aria-valuenow={state.taxPool}
                    aria-valuemin={0}
                    aria-valuemax={RULES.acquisitionThreshold}
                  >
                    <div
                      style={{
                        width: `${(state.taxPool / RULES.acquisitionThreshold) * 100}%`,
                      }}
                    />
                  </div>
                  <div>
                    <span>
                      {fmt(state.taxPool, 2)} / {RULES.acquisitionThreshold} SQK
                    </span>
                    <span>Next auto-buy</span>
                  </div>
                  <p>
                    Every 100 SQK buys a Level 1 Squeek for the shared vault.
                  </p>
                </div>
              </section>
            </div>
          </div>

          <section
            className="activity-section"
            id="activity"
            aria-labelledby="activity-title"
          >
            <div className="section-heading">
              <div className="heading-with-icon">
                <Icon name="activity" />
                <h2 id="activity-title">Desk activity</h2>
              </div>
              <span>Saved in this browser</span>
            </div>
            {state.events.length ? (
              <ol className="activity-list">
                {state.events.slice(0, 8).map((e) => (
                  <li key={e.id}>
                    <span className={`event-icon event-${e.kind}`}>
                      <Icon
                        name={
                          (
                            {
                              start: "plus",
                              deposit: "vault",
                              merge: "merge",
                              claim: "down",
                              swap: "swap",
                              trade: "receipt",
                              purchase: "bolt",
                            } as Record<string, IconName>
                          )[e.kind]
                        }
                        size={16}
                      />
                    </span>
                    <span>{e.text}</span>
                    <time dateTime={new Date(e.at).toISOString()}>
                      {new Date(e.at).toLocaleTimeString("en-GB", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </time>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="activity-empty">
                Start your desk. Your first deposit, merge and claim will show
                up here.
              </p>
            )}
          </section>

          <footer className="desk-footer">
            <span>
              <span className="status-dot" />
              {lab.storageWarning
                ? "Session only · not saved"
                : started
                  ? "Paper lab saved locally"
                  : "Your browser. Your paper lab."}
            </span>
            <span>Community simulation · Not the official protocol</span>
            <div>
              <button className="text-button" onClick={() => setDialog("help")}>
                About & mechanics
                <Icon name="external" size={12} />
              </button>
              <button
                className="text-button mobile-reset"
                disabled={lab.readOnly}
                onClick={() => setDialog("reset")}
              >
                Reset lab
              </button>
            </div>
          </footer>
        </main>
      </div>

      <div
        className={`toast ${lab.notice.text ? "visible" : ""} ${lab.notice.error ? "error" : ""}`}
        role="status"
        aria-live="polite"
      >
        <Icon name={lab.notice.error ? "help" : "check"} size={18} />
        <span>{lab.notice.text}</span>
        {lab.notice.text && (
          <button
            className="icon-button"
            onClick={lab.dismiss}
            aria-label="Dismiss notification"
          >
            <Icon name="close" size={16} />
          </button>
        )}
      </div>

      {dialog === "help" && (
        <Modal
          title="Small Squeeks. Shared power."
          onClose={() => setDialog(null)}
        >
          <div className="help-content">
            <p>
              <strong>Squeekstr Desk</strong> is a community paper simulation of
              SQUEEKSTR mechanics. All balances, NFTs, swaps and trades exist
              only in your browser. No wallet, real funds or blockchain
              transactions are involved.
            </p>
            <ol className="how-steps">
              <li>
                <strong>Deposit & receive.</strong> Each deposited paper Squeek
                mints a tracker receipt recording its mining power. Deposits
                stay in the vault; trade a receipt to move your claim.
              </li>
              <li>
                <strong>Merge & grow.</strong> Two same-level tips gain 10%
                combined power. 75% of the bump goes proportionally to all
                community receipts; 25% goes to the protocol tracker. The new
                Squeek waits 3 completed blocks before merging again.
              </li>
              <li>
                <strong>Earn & claim.</strong> The pool emits 0.8 paper SQK per
                second, allocated by each receipt’s share of total vault power.
                Spin Rush increases this to 1.2 while SPINNING. Only time with
                this page visible counts; there is no offline catch-up.
              </li>
              <li>
                <strong>Swap & replenish.</strong> Paper buys and sells pay 5%
                tax in SQK. Each 100 SQK automatically buys a 1,000-power Level
                1 Squeek. This power is shared by community receipts; before the
                first deposit it is reserved for the first depositors.
              </li>
              <li>
                <strong>Trade the claim.</strong> You and Friend are local paper
                wallets you control. A trade moves the receipt, all accrued
                rewards and future earnings. Friend starts with 2,000 paper SQK.
                Receipt trades have no token-swap tax.
              </li>
            </ol>
            <h3>Live wheel, explicit fallback</h3>
            <p>
              Live data comes from the Squeekchain status API every 15 seconds,
              with a 7-second timeout and backoff to 120 seconds. Status uses{" "}
              <code>measurement.coreStatus</code>; RPM is{" "}
              <code>measurement.rpmMilli / 1000</code>. Cooldowns use{" "}
              <code>builder.anchor.blockHeight</code>, the confirmed height,
              never optimistic projections.
            </p>
            <p>
              Stale or failed responses switch to labelled Practice mode: 48
              simulated RPM and a local tick every 8 seconds. Switching clock
              sources preserves remaining cooldowns and establishes a fresh
              baseline. Lab rates, starter balances, cooldown length, tax
              threshold and acquisition allocation are demonstration choices,
              not on-chain quotes.
            </p>
            <h3>Follow the originals</h3>
            <div className="source-links">
              <a href="https://sqkstr.xyz/" target="_blank" rel="noreferrer">
                SQUEEKSTR protocol
                <Icon name="external" size={14} />
              </a>
              <a
                href="https://sqkstr.xyz/mechanism"
                target="_blank"
                rel="noreferrer"
              >
                SQUEEKSTR mechanism
                <Icon name="external" size={14} />
              </a>
              <a
                href="https://squeekchain.com/"
                target="_blank"
                rel="noreferrer"
              >
                Squeekchain
                <Icon name="external" size={14} />
              </a>
              <a
                href="https://squeekchain.com/genesis/d4sp8cje"
                target="_blank"
                rel="noreferrer"
              >
                Genesis Code lane
                <Icon name="external" size={14} />
              </a>
            </div>
            <p className="section-note">
              Independent community project. No affiliation, badge or whitelist
              guarantee.
            </p>
          </div>
        </Modal>
      )}

      {dialog === "reset" && (
        <Modal title="Reset this paper lab?" onClose={() => setDialog(null)}>
          <p className="modal-copy">
            This removes both wallets, all Squeeks, receipts, rewards and
            activity saved in this browser. You can start again with a fresh
            kit.
          </p>
          <div className="modal-actions">
            <button
              className="button secondary"
              onClick={() => setDialog(null)}
            >
              Keep my desk
            </button>
            <button
              className="button danger"
              onClick={() => {
                lab.reset();
                setOwner("You");
                setVaultView("deposit");
                setDepositIds([1, 2]);
                setMergeIds([]);
                setRush(false);
                setDialog(null);
              }}
            >
              Reset lab
            </button>
          </div>
        </Modal>
      )}

      {tradeTracker && (
        <Modal
          title={`Trade tracker ${receiptId(tradeTracker.id)}`}
          onClose={() => setTradeTracker(null)}
        >
          <form onSubmit={submitTrade} noValidate>
            <p className="modal-copy">
              Move this receipt from <strong>{owner}</strong> to{" "}
              <strong>{friend}</strong>. Its{" "}
              {fmt(
                state.trackers.find((t) => t.id === tradeTracker.id)?.power ||
                  tradeTracker.power,
                2,
              )}{" "}
              power and all unclaimed SQK move with it. Both wallets are
              simulated and controlled by you.
            </p>
            <div className="trade-field">
              <label htmlFor="trade-price">Trade price in paper SQK</label>
              <input
                id="trade-price"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                value={tradePrice}
                onChange={(e) => {
                  setTradePrice(e.target.value);
                  setTradeError("");
                }}
                aria-invalid={!!tradeError}
                aria-describedby={tradeError ? "trade-error" : "trade-balance"}
                autoFocus
              />
              <p id="trade-balance">
                {friend} can pay up to {fmt(state.wallets[friend].sqk, 2)} SQK.
                Set 0 to gift.
              </p>
              {tradeError && (
                <p id="trade-error" className="field-error" role="alert">
                  {tradeError}
                </p>
              )}
            </div>
            <div className="modal-actions">
              <button
                className="button secondary"
                type="button"
                onClick={() => setTradeTracker(null)}
              >
                Cancel trade
              </button>
              <button className="button primary" type="submit">
                Trade to {friend}
                <Icon name="arrow" size={16} />
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
