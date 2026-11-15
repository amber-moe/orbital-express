# Orbital Express — Company Jobs

A browser mission-control game set in **Orbital Express**, a fictional Earth-based centrifuge cargo company. The playable loop includes the original **First Delivery** construction route plus **Supply Delivery** and **Precision Cargo**, with Practice and paid Company Jobs modes.

**Play online:** https://amber-moe.github.io/orbital-express/

Built with **Vue 3**, **strict TypeScript**, **Vite**, **Three.js**, and a standalone TypeScript 2D physics module. No game engine, backend, database, accounts, routing, or third-party physics engine.

---

## Current slice

Working now:

- Vue 3 + strict TypeScript + Vite + Three.js app with a production build.
- Compact loadout console with cargo preview, quantity, protection, braking module, six release-speed detents, readiness and Launch; exact telemetry stays in a collapsed analysis.
- Orthographic schematic Earth–Moon view with procedural bodies, clipped path, launcher animation, phase camera and reduced-motion support.
- One deterministic simulation for preview and live flight: inverse-square gravity, velocity Verlet, fixed 4 s step and swept intersections.
- Practice and Company Jobs, three lunar orders, and a paid dispatch → settlement → Back to Jobs loop.
- Company balance starts at **6,000 cr** and tracks income/spend, completed and resolved flights, failures, delivered crates and launches; net profit excludes capital.
- Versioned browser-local saves with immediate persistence, interrupted-flight recovery, corrupt-save handling and a single-writer Web Locks policy across tabs.
- Outcomes: delivered, contract shortfall, insufficient braking, arrival too fast, missed Moon, Earth/Moon impact, and hard configuration blockers.

Deliberately not included:

- Economy/Fast profiles, continuous speed tuning, other destinations, mixed cargo, steering, audio, accounts, servers or multiplayer.
- A public deployment or submission package.

---

## Quick start

Tested environment: macOS 15.7.3, Node **20.11.0**, npm **9.5.0**. Use npm only; one `package-lock.json` is checked in.

```bash
npm install
npm run dev        # http://localhost:5173/
npm run typecheck  # vue-tsc --noEmit
npm run test       # vitest run
npm run build      # production build in dist/
npm run preview    # http://localhost:4173/ (production build)
```

Open the app over HTTP (`http://localhost:...`), not `file://`.

### How to play

Click **Jobs** in the header to choose **Practice** or **Company Jobs** and accept one of three lunar orders. Practice flights use that order's practice budget and free Retry; they never touch the company account. Company flights pay from the company balance, persist in this browser, and return to Jobs after the result.

The right-hand **Loadout** panel has four numbered choices: cargo quantity, protection, braking module, and release speed. The cargo *type* is fixed by the order. A visual cargo preview shows the crates, protection frame and braking-module size. The release-speed control offers six detents (97–102%) and keeps the release direction fixed. In Company mode the Launch button shows the dispatch price before deduction. The exact terminal prediction is available only in the collapsed **Predicted flight analysis**.

Each order has a validated starting loadout:

| Order | Cargo | Recommended | Release | Cost | Reward | Net |
|---|---|---|---|---:|---:|---:|
| Construction Run | Construction Supplies ×2 | Reinforced · Large | 100% | 2,200 cr | 3,200 cr | **+1,000 cr** |
| Supply Delivery | Supply Packs ×3 | Standard · Large | 100% | 1,790 cr | 2,800 cr | **+1,010 cr** |
| Precision Cargo | Research Modules ×1 | Reinforced · Large | 98% | 2,360 cr | 5,500 cr | **+3,140 cr** |

Press **Launch** and watch the spin-up, assisted departure, Earth–Moon transfer, terminal braking, and reception. Company results show flight cost, income, net and balance, with **Back to jobs**; Practice keeps **Retry attempt**.

Useful experiments:

| Change | Result |
|---|---|
| Quantity 2, Reinforced, Large | **Delivered** (2/2 crates, +3,200 cr) |
| Quantity 1, Reinforced, Large | Reception valid, **contract shortfall** (1/2 crates) |
| Any quantity, Reinforced, **Small** | **Insufficient braking reserve** |
| Protection **Standard** | Launch blocked: rotor load 51.0 g exceeds the 45.0 g cargo limit |
| Quantity 3, Reinforced, Large | Delivered (3 crates; no extra reward in this slice) |
| Release speed **97%** | **Re-entered Earth** (departure below the usable window) |
| Release speed **98% / 99% / 100%** | Delivered |
| Release speed **101% / 102%** | **Missed the Moon** (overshoots the reception zone) |

The usable release-speed window measured with the shipped 4 s-step simulator is approximately **98.0–100.2%**. Higher speed is not automatically better; both ends of the detent range fail with different diagnoses.

The planning checks are deterministic and use the same physics as live flight. “Ready for launch” means the load, energy and braking margins pass; a doomed configuration is shown as a flight risk rather than a safe result. Final delivery, consumption and rewards are reported after execution.

---

## Verified configuration

The committed default and the reproducible reference case:

| Field | Value |
|---|---|
| Contract | First Delivery |
| Cargo | Construction Supplies × 2 |
| Protection | Reinforced (95 kg) |
| Maneuver module | Large (120 kg) |
| Launch profile | Balanced |
| Total mass / volume | **815 kg** / **2.10 of 3.00** volume units |
| Rotor / release speed | 2,000 m radius, 0.5 rad/s, **1.000 km/s** |
| Rotor load | **50.9858 g** (limit with Reinforced: 90 g) |
| Rotor energy | **0.877258 GJ** of 3.00 GJ available |
| Launch cost | **2,200 cr** (cargo 560 + protection 420 + module 820 + fee 400) |
| Ascent stage | 9.923817 km/s of a 10.0 km/s finite capacity |
| Departure state | position **(−6,571, 0) km**, velocity **(0, −10.923817) km/s** |
| Lunar zone entry | **≈ 3.59550 days** after departure |
| Entry relative speed | **0.927421 km/s** |
| Required brake | **0.777421 km/s** |
| Large brake reserve | **2.278736 km/s** → **1.501315 km/s left** after braking |
| Outcome | **Delivered**, 2/2 crates, +3,200 cr |

The Small module at the same load has only **0.644645 km/s** of reserve, so the same encounter ends with **insufficient braking reserve**. That is the intended in-UI failure trade-off.

Supply Delivery can use Standard protection because its lighter cargo has a 60 g base tolerance; Construction requires Reinforced. Precision Cargo has a 25 g base tolerance and an arrival limit of 0.80 km/s, so its recommended configuration uses Reinforced protection and the 98% release detent. Jobs shows two separate figures per order: **launchable from** (the cheapest configuration that passes hard validation, which may be underfilled or risky) and **verified delivery** (a simulator-confirmed range using the full required quantity). Neither figure guarantees delivery, and the estimates are computed once per order and cached outside rendering.

---

## Architecture

```text
src/
  main.ts, App.vue
  styles/tokens.css
  components/
    MissionHeader.vue, ContractCard.vue, SpaceViewport.vue,
    LauncherInset.vue, ConfigPanel.vue, CargoPreview.vue,
    JobsPanel.vue, MissionProgress.vue, ResultDialog.vue,
    SourcesDialog.vue, DebugDrawer.vue
  game/
    types.ts, data.ts, missionController.ts, outcomeMessages.ts,
    company.ts              company account, dispatch, settlement, saves
    readiness.ts            player-facing readiness checks
    releaseSpeed.ts         effective-profile resolver + finite detents
    centrifugeAnimation.ts  pure spin/release/coast animation math
    simulation/
      physics.ts             gravity, velocity Verlet, swept circle test
      departureModel.ts      rotor + fictional assisted-ascent mapping
      arrivalModel.ts        finite terminal-braking decision
      transferSimulator.ts   shared step + terminal events
    rules/configRules.ts     data-driven totals, validation, prediction
  rendering/
    createSpaceScene.ts      Three.js lifecycle, procedural art, render loop
    coordinateTransform.ts   km → schematic mapping, path clipping, connectors
    cameraDirector.ts        rendering-only phase camera targets
  composables/useMission.ts  Vue bridge + low-frequency simulation ticker
  composables/useCompany.ts  reactive company store + localStorage lifecycle
  data/
    physicalConstants.json, modelAssumptions.json, cargo.json,
    equipment.json, launchProfiles.json, contracts.json
tests/
  physics.test.ts, transfer.test.ts, missionRules.test.ts,
  rendering.test.ts, readiness.test.ts, releaseSpeed.test.ts,
  centrifugeAnimation.test.ts, company.test.ts, orders.test.ts,
  outcomeMessages.test.ts
docs/
  AI_USAGE.md, ai-usage.json
```

- **MissionController** owns `CONFIGURING → SPINNING_UP → DEPARTURE → TRANSFER → APPROACH → RESULT`, resource deduction, configuration locking, prediction cache, live stepping, and settling.
- The simulation imports nothing from Vue, Three.js or the DOM. Preview and live flight both call `stepTransfer` and `evaluateReception`.
- Vue receives a low-frequency `MissionSnapshot` only on configuration changes, phase changes, and results. The renderer reads a plain `FrameState` every animation frame; the Three.js scene is never deeply proxied by Vue.
- The renderer owns high-frequency transforms, schematic mapping, camera direction, trail geometry, procedural textures and disposal. The simulation ticker is separate from rendering, so the mission still advances if WebGL fails and shows the fallback message. The schematic view fixes its layout, so changing a configuration updates the path but never refits the camera to a distant wide shot.
- Prediction is bounded by the 8-day mission horizon and the fixed 4 s step (≈172,800 steps maximum), sampled to ~5,179 points for the validated path. Twelve loadouts × six release-speed detents = 72 possible cache keys; the controller keeps at most 48. The current implementation computes synchronously (≈9–18 ms for the first run); a generation guard is in place for future asynchronous prediction.

---

## Verification

Run from the repository root:

```bash
npm run typecheck
npm run test
npm run build
npm run preview
```

Last verified results:

- Typecheck passed.
- **76 tests passed across 10 files**, covering physics/convergence, transfer, rendering, readiness, release speed, orders, company settlement, ownership policy and outcome copy.
- Production build: JavaScript **726.33 KB** (196.86 KB gzip), CSS **43.51 KB** (8.05 KB gzip).
- Headless Chrome (fresh profile, 1280×720) against the production build:
  - Five consecutive Company Jobs across all cargo types: Construction +1,000, Supply +1,010, Precision +3,140, Construction at 97% Earth impact −2,200, Supply recovery +1,010. Final: **9,960 cr**, **+3,960 net**, 4 completed / 5 resolved, 1 failure, **9 delivered crates**, 80%.
  - A second tab was read-only during a live flight and did not interrupt it; after the owner settled, it showed the same save. Takeover after owner closure recovered the pending flight once.
  - Reloading mid-flight recorded one interruption; a second reload added nothing. Reopening the result and refreshing did not duplicate rewards.
  - Practice left the company save untouched; 500 cr disabled all paid orders; Restart cancel/confirm worked; a corrupt save was replaced with a valid 6,000 cr company.
  - With Web Locks unavailable, Company was disabled and Practice stayed available.
- Not exercised: Safari/Firefox, a real process crash, a true same-millisecond launch race, sub-path deployment.

---

## Known limitations

- **One verified profile.** Economy/Fast and continuous speed tuning are absent; the Balanced profile has six quantized release-speed detents. It is a fitted fictional case, not a real mission design.
- **Browser-local company state.** `localStorage` is not a server account and gives no server-grade anti-cheat. One tab holds the exclusive writer lock; other tabs are read-only until the owner closes or reloads. An interrupted paid flight loses its cost.
- **No public deployment, demo or submission package.** No backend, paid account or user accounts were created.
- **Schematic overview.** Earth and Moon are enlarged, and the path is clipped at visual bodies; physical radii, positions and outcomes are unchanged.
- **Procedural art.** Planet textures are original 1024×512 Canvas textures, not third-party or generated imagery; the renderer falls back to flat colours if texture creation fails.
- **Static two-center model.** The Moon is fixed; Earth rotation, lunar motion, solar gravity, atmosphere, ascent, guidance and landing are omitted. The delivered release-speed window is narrow (≈0.980–1.002×), so the UI uses detents.
- **No audio, extra destinations, warehouse upgrades or steering.** Headless FPS is software-rendered and not representative of hardware performance.

No hard blocker prevents running or verifying the slice.

---

## Documentation

- [`docs/AI_USAGE.md`](docs/AI_USAGE.md) — development-assistance disclosure.
- [`docs/ai-usage.json`](docs/ai-usage.json) — machine-readable disclosure metadata.
