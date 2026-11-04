# Squeekstr Desk

Squeekstr Desk is a community project for the Squeekchain Buildooooor badge. It is an independent, interactive paper simulation of SQUEEKSTR mechanics, not the official on-chain sqkstr.xyz protocol. Participation does not promise a badge or whitelist.

An original dark protocol desk with a local starter kit, vault deposits, tracker receipts, power-growing merges, paper swaps, claims and receipt trades between two simulated wallets. No wallet extension, account, private key, payment, approval or blockchain transaction is used.

## Run locally

Use Node.js 22.12+ and npm.

```sh
npm ci
npm run dev
```

Build and preview the production export:

```sh
npm run typecheck
npm test
npm run build
npm run preview
```

Vite prints the local preview address. Serve through HTTP rather than opening `index.html` with `file://`. The complete production site is included in **`dist/`**; its fonts, illustrations, favicon, JavaScript, stylesheet and share image are local. The status API is the only runtime network dependency, and failure switches to Practice mode.

## Try the full desk

1. Select **Start paper desk**. You receive six Level 1 Squeeks with 1,000 power each, 10,000 paper SQK and 500 paper SQKSTR. Friend receives 2,000 paper SQK for receipt trading.
2. Two Squeeks are selected initially. Choose **Deposit 2 Squeeks** to mint two 1,000-power tracker receipts. Other Squeeks stay in the paper collection.
3. Open **Merge & grow**. Preview 2,000 → 2,200 total power: +150 community power and +50 protocol power. Merge the two tips. Both original receipts now hold 1,075 power; the resulting Level 2 vault Squeek starts a three-block cooldown.
4. Leave the page visible to accrue paper SQK. **Claim SQK** on a receipt credits the active paper wallet. In **The wheel**, enable **Spin Rush** when SPINNING to try the 1.5× rate. An IDLE wheel always uses the base rate.
5. In **Paper swap**, buy with 2,000 paper SQK. The 5% tax contributes 100 SQK, automatically buys one Level 1 paper Squeek and adds 1,000 shared community power. The net buy returns 950 paper SQKSTR. Selling also pays 5% tax.
6. Select **Trade** on a receipt, set a price, and confirm **Trade to Friend**. The price settles between the paper wallets. The receipt's power, accrued rewards and future reward claim all move together. Switch the **Paper wallet** control to **Friend** and claim from the acquired receipt. You control both wallets; this is not a multiplayer market.
7. Reload to continue the same lab. Use **Reset lab**, then confirm, to remove its local save and begin again. Cancelling reset preserves everything.

Use **Practice** in the wheel panel for an explicitly simulated wheel and one completed local tick every eight visible seconds. This makes cooldowns practical to explore when the real wheel is idle or the API is unavailable.

## Mechanics and deliberate lab choices

The public [SQUEEKSTR mechanism](https://sqkstr.xyz/mechanism) describes deposits and tracker receipt NFTs, reward distribution by receipt power, a 10% same-level merge bump divided 75% to community depositors and 25% to the protocol, transferable reward claims, and a 5% buy/sell tax funding Squeek purchases. These mechanics are implemented locally in `src/engine.ts`.

| Parameter | Paper desk value |
| --- | --- |
| Level 1 mining power | 1,000 |
| Merge increase | 10% of the two input tips' combined power |
| Community / protocol split | 75% / 25% of the increase, not of the original power |
| Community allocation | Proportional to all existing non-protocol receipts, across You and Friend |
| Merge cooldown | Three confirmed Squeek blocks, or three labelled Practice ticks |
| Pool reward emission | 0.8 paper SQK / second; 1.2 with active Spin Rush |
| Receipt reward | Pool emission × receipt power / total vault power, including protocol power |
| Paper exchange rate | Fixed 1 SQKSTR = 2 SQK, with 5% tax in SQK equivalents |
| Tax acquisition | Each 100 tax-pool SQK buys a 1,000-power Level 1 paper Squeek; remainder stays in pool |
| Purchased power | Shared proportionally with community receipts; held as reserve before the first deposit |
| Receipt trade | User-entered paper SQK price; 0 is a gift; no SQKSTR swap tax |
| Storage | Versioned `squeekstr-desk:v1` localStorage entry |

Starter balances, emissions, exchange price, cooldown duration, purchase threshold, purchased-power allocation and simulated tick speed are **lab parameters**, not assertions about official contract configuration, NFT prices or investment returns. They are declared in `RULES` in `src/engine.ts` and explained in the UI. No market price, APY or real token balance is fabricated.

Deposited assets remain in the paper vault; receipt trading moves the reward position. There is no redemption or real withdrawal. The protocol receipt accrues its own share but cannot be claimed by You or Friend.

Only time with the page visible earns rewards. A suspended timer is capped at two seconds; closing/reopening never produces offline earnings. Receipts remain separate from merged vault tips. Power is conserved across tips, community receipts, protocol power and any unallocated reserve, with rounding to eight decimal places.

## Live Squeekchain integration

The client fetches [`https://api.squeekchain.com/v1/status`](https://api.squeekchain.com/v1/status) with omitted credentials, no referrer, a seven-second abort timeout and no overlapping requests. Successful polling repeats every 15 seconds. Failures back off through 15, 30, 60 and 120 seconds; a success resets the interval. Retry and explicit Practice controls are available.

- **State:** `measurement.coreStatus`, specifically `SPINNING` or `IDLE`. State is never inferred from nonzero RPM. Unknown states enter Practice.
- **RPM:** `measurement.rpmMilli / 1000` when numeric and present. Missing RPM is displayed as unavailable, not as a guessed reading.
- **Completed blocks:** `builder.anchor.blockHeight`. The confirmed anchor is used for cooldowns. `builder.projected.blockHeight` is parsed but never spends a cooldown because projections are optimistic.
- **Timestamp/freshness:** `measurement.observedAt`, falling back to `generatedAt`, with `measurement.freshness` and `staleAfterSeconds`. The latter defaults to 120 seconds and is bounded to 15–300 seconds. Invalid, stale and failed responses enter Practice. Last accepted readings are explicitly marked stale after a failure.
- **Epoch:** `measurement.counterEpoch` rebases the block clock on a reset. Switching between live and Practice also establishes a new baseline and preserves remaining cooldowns. Regressed heights within an epoch cannot replay already-counted blocks. Blocks already observed are applied before creating a new merge.
- **Practice:** explicitly labelled, locally simulated 48 RPM and one local tick per eight visible seconds. Practice ticks never masquerade as live block heights. Fresh API recovery returns to live automatically unless Practice was explicitly selected.

The wheel drawing is an animation, not a video feed. Its pause button controls only animation. Reduced-motion preferences stop it; text always communicates the state and rate.

## Storage and browser behavior

Saves are validated on load. Unsupported or malformed saves show a recovery message instead of loading invalid balances. If storage is blocked/full, the session remains interactive and a visible warning states that changes cannot be saved. Reset removes only this app's storage key.

Where the Web Locks API is available, one tab owns the lab; other tabs receive updates but cannot double-credit rewards or transact. Close the active tab and reload another to take over. Browsers without Web Locks should use one desk tab. Data is local to the current browser and origin, not synced across devices, gateways or people; browser-data clearing removes it. These are ordinary editable paper balances, not a security boundary.

## Static / IPFS delivery

`dist/index.html` and its complete assets are included beside source and lockfile. Vite uses `base: './'`. Navigation uses in-page anchors, so no server rewrites or backend are needed. The production export was tested at the `/preview/` subpath and its local asset references were verified.

For this contributor submission, `dist/` is the artifact the IdentityMD delivery pipeline pins to IPFS after the job. No final CID or public gateway URL was available during local validation, and no separate publication command was run. This repository does not invent a live URL or claim that local testing independently proves public hosting. The deployment pipeline supplies that address.

The Open Graph image is locally bundled as `dist/social.png` (1200 × 630). Its metadata uses a relative path because the final hosting origin is assigned later. The export contains no package registry, dependency archives, caches or submodules.

## Validation

Actual local results on 2026-11-04:

| Check | Result |
| --- | --- |
| Production Vite build | Passed; complete `dist/` generated |
| Strict TypeScript typecheck | Passed, zero diagnostics |
| Engine/API parser tests | 26 passed |
| Chromium production interaction checks | 35 passed, including the full required workflow |
| Accessibility scans | Zero axe violations in initial desktop, active desktop, active mobile and help dialog |
| Pinned taste@1 design probe | 16/16 passed at 320, 390 and 1440 wide |
| Responsive / text checks | No page overflow at 320, 390, 768, 1024, 1440; 200% text enlargement checked at 390 |
| Local resource / script failures | Zero in the controlled browser suite |
| Relative asset / bundle check | Passed; full export and submission below 8 MiB |

Run the browser suite after building:

```sh
npx playwright install chromium
npm run test:browser
npm run check:bundle
```

The suite starts and closes its own bounded local HTTP server and browser, writes disposable results to `test/scratch/browser-validation/`, and uses test-only API responses and a virtual clock. Fixtures are not bundled into the product. The engine tests additionally run 100 repeated purchase/merge cycles and check power conservation, ownership, invalid inputs, precision and corrupted saves.

The worker installed dependencies under disposable `test/scratch/tooling/` rather than modifying a repository `node_modules/`. It invoked the installed Vite and TypeScript binaries directly, with `DESK_DEPENDENCY_ROOT=test/scratch/tooling` for Vite and `--typeRoots ./test/scratch/tooling/node_modules/@types` for typecheck. Normal `npm ci` and the scripts above use the standard project layout. Browser tooling can optionally be selected by `DESK_PLAYWRIGHT`; normal installations need no override.

**Limitations:** direct Chromium access to the external API returned `ERR_EMPTY_RESPONSE` in this environment, while an HTTP client received valid JSON and CORS headers. The actual fallback was observed; live state, timestamps, RPM, timeout/backoff and block logic were validated with schema-shaped responses. The provided browser launcher had a temporary-path socket-length error, so the installed Chromium was run in a bounded local harness. WebKit was downloaded but could not launch because `libGLESv2.so.2` and `libx264.so` were absent; Safari behavior remains unverified. Screen readers, physical devices and native browser zoom were not tested; 200% CSS text enlargement is not claimed as native zoom.

See [DESIGN.md](DESIGN.md) for implemented design decisions and [artifacts/validation.md](artifacts/validation.md) for the six-domain review, fixes, evidence and remaining limits. These are worker-side results, not an independent certification.

## Source map

- `src/App.tsx`: desk, native modal flows, deposits, merge preview, receipts, wallet selector, swaps, activity, About.
- `src/engine.ts`: pure paper state machine, power accounting, accrual, block clocks, storage validation.
- `src/status.ts`, `src/live.ts`: API schema normalization, freshness and polling hook.
- `src/useLab.ts`: local persistence, one-tab writer lock, visible-page timer and actions.
- `src/Art.tsx`, `src/styles.css`: original vector hamster/wheel artwork, icons and responsive tokens.
- `tests/`: engine and production-browser validation.
- `scripts/check-bundle.mjs`: byte budget, relative assets, lockfile and packaging audit.
- `scripts/create-social.mjs`: reproducible share-card rendering; run with Node after installing the Playwright browser, then rebuild.

## Sources and attribution

Official references: [SQUEEKSTR](https://sqkstr.xyz/), [Mechanism](https://sqkstr.xyz/mechanism), [Squeekchain](https://squeekchain.com/), [Genesis Code lane](https://squeekchain.com/genesis/d4sp8cje). Paper-vault and live-wheel interaction inspiration: [quad.cx](https://quad.cx/) and [squeekout.fun](https://squeekout.fun/). No logos, interface code or artwork were copied from those sites.

The original interface artwork is drawn in SVG in the source. Manrope is bundled locally under the [SIL Open Font License](public/fonts/OFL.txt). Design review used the supplied Better Interface and design-critic references; design/documentation guidance attribution and retained license notices are in [artifacts/attribution.md](artifacts/attribution.md).
