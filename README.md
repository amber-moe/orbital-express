# Orbital Express — First Delivery

A browser mission-control slice of **Orbital Express**, a fictional Earth-based centrifuge cargo company. This release implements the first contract, **First Delivery**: load construction supplies, launch from Earth, and meet the lunar reception criteria at the Selene Receiving Depot.

Built with **Vue 3**, **strict TypeScript**, **Vite**, **Three.js**, and a standalone TypeScript 2D physics module. No game engine, backend, database, accounts, routing, or third-party physics engine.

---

## Current slice (stages A + B)

Working now:

- Runnable Vue/TS/Vite application and a production build.
- Orthographic Three.js Earth–Moon playfield with true distances and body radii, a predicted trajectory, an animated cargo marker, a flown trail, a reception-zone ring, and a centrifugal rotor inset.
- Shared deterministic simulation for preview and live flight: inverse-square two-body gravity, velocity Verlet, fixed 4 s step, swept Earth/Moon/zone intersections.
- One documented, verified **Balanced** launch profile.
- Contract **First Delivery**, Construction Supplies, quantities 1/2/3, **Standard/Reinforced** protection, **Small/Large** maneuver modules.
- Finite credits, grid energy, inventory, finite ascent/braking reserves, single-charge launch, deterministic preview, result overlay, and Retry.
- Meaningful outcomes: delivered, contract shortfall, insufficient braking reserve, arrival too fast, missed Moon, Earth impact, lunar impact, and hard configuration blockers.
- Sources & Model Notes dialog, README, `docs/MODEL_NOTES.md`, and `docs/SOURCES.md`.

Deliberately **not wired yet**:

- Economy and Fast launch profiles. Only Balanced is shown; the panel says so.
- Other destinations, mixed cargo, warehouse construction, manual flight steering, audio, persistence, accounts, or multiplayer.
- A selectable trajectory that misses the Moon. The “missed Moon” and impact paths are implemented and covered by tests but are not reachable with the current single profile and mass-independent flight. The in-UI failure path is the Small braking module.

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

The default configuration is the validated one. Press **Launch** and watch the spin-up, assisted departure, Earth–Moon transfer, terminal braking, and reception. The result overlay reports the terminal event; **Retry attempt** resets the order and keeps the current configuration.

Useful experiments:

| Change | Result |
|---|---|
| Quantity 2, Reinforced, Large | **Delivered** (2/2 crates, +3,200 cr) |
| Quantity 1, Reinforced, Large | Reception valid, **contract shortfall** (1/2 crates) |
| Any quantity, Reinforced, **Small** | **Insufficient braking reserve** |
| Protection **Standard** | Launch blocked: rotor load 51.0 g exceeds the 45.0 g cargo limit |
| Quantity 3, Reinforced, Large | Delivered (3 crates; no extra reward in this slice) |

The simulation preview is deterministic. A populated preview is not a promise of success: the preview describes the same physics the live flight will run.

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

For the full derivation, sensitivity, failure cases and omitted physics, see [`docs/MODEL_NOTES.md`](docs/MODEL_NOTES.md).

---

## Architecture

```text
src/
  main.ts, App.vue
  styles/tokens.css
  components/
    MissionHeader.vue, ContractCard.vue, SpaceViewport.vue,
    LauncherInset.vue, ConfigPanel.vue, MissionProgress.vue,
    ResultDialog.vue, SourcesDialog.vue
  game/
    types.ts, data.ts, missionController.ts, outcomeMessages.ts
    simulation/
      physics.ts             gravity, velocity Verlet, swept circle test
      departureModel.ts      rotor + fictional assisted-ascent mapping
      arrivalModel.ts        finite terminal-braking decision
      transferSimulator.ts   shared step + terminal events
    rules/configRules.ts     data-driven totals, validation, prediction
  rendering/
    createSpaceScene.ts      Three.js lifecycle and render loop
    coordinateTransform.ts   km → scene mapping, camera fit
  composables/useMission.ts  Vue bridge + low-frequency simulation ticker
  data/
    physicalConstants.json, modelAssumptions.json, cargo.json,
    equipment.json, launchProfiles.json, contracts.json
tests/
  physics.test.ts, transfer.test.ts, missionRules.test.ts
docs/
  MODEL_NOTES.md, SOURCES.md, AI_USAGE.md
```

- **MissionController** owns `CONFIGURING → SPINNING_UP → DEPARTURE → TRANSFER → APPROACH → RESULT`, resource deduction, configuration locking, prediction cache, live stepping, and settling.
- The simulation imports nothing from Vue, Three.js or the DOM. Preview and live flight both call `stepTransfer` and `evaluateReception`.
- Vue receives a low-frequency `MissionSnapshot` only on configuration changes, phase changes, and results. The renderer reads a plain `FrameState` every animation frame; the Three.js scene is never deeply proxied by Vue.
- The renderer owns high-frequency transforms, camera fit, trail geometry, and disposal. The simulation ticker is separate from rendering, so the mission still advances if WebGL fails and shows the fallback message.
- Prediction is bounded by the 8-day mission horizon and the fixed 4 s step (≈172,800 steps maximum), sampled to ~5,179 points for the validated path. Discrete configurations are cached (3 quantities × 2 protections × 2 modules = 12). The current implementation computes synchronously (≈9–18 ms for the first run); a generation guard is in place for future asynchronous prediction.

---

## Verification

Run from the repository root:

```bash
npm run typecheck
npm run test
npm run build
npm run preview
```

Results from this turn:

- **Typecheck:** passed with no output (`vue-tsc --noEmit`).
- **Tests:** **25 passed** across 3 files (`physics.test.ts`, `transfer.test.ts`, `missionRules.test.ts`).
  - gravity direction/magnitude and units;
  - mass-independent vacuum path;
  - preview/live terminal-event equality;
  - timestep convergence at 4 s versus 2 s (and 8 s);
  - the known Balanced delivery, the Small-module braking failure, the 1-crate shortfall, the Standard-protection block, and a 2 % weak departure that misses the Moon;
  - swept Earth/Moon/reception-circle intersections, including a 20 km/s large-step pass;
  - double-launch charging, retry reset, reward settled once, config lock, prediction cache, volume/energy validation.
- **Build:** Vite 6.4.6 production build succeeded. `dist/` is **692 KB** total:
  - JavaScript **669.18 KB** (179.95 KB gzip)
  - CSS **26.88 KB** (5.65 KB gzip)
  - Build time ≈1.1 s. Vite warns that the single JS chunk exceeds 500 KB; this is mostly Three.js and is accepted for this slice.
- **Production preview:** served at `http://localhost:4173/` and exercised with Chrome.
- **Development server:** Vite 6.4.6 served `http://localhost:5173/` (HTTP 200) with the same Delivered preview and one WebGL canvas. No console or page errors.
- **Browser exercise (actual, not inferred):** Chrome **157.0.8103.51** on Apple M1 Max, macOS 15.7.3.
  - Headed, 1600×1000, ANGLE Metal: **120.3 fps** over a 3 s rAF sample.
  - Headless with SwiftShader (software WebGL): **33–34 fps** at 1600×1000. This is a software-rendering floor, not a hardware target.
  - Load timing on localhost: DOMContentLoaded/load ≈**1.67–1.77 s** including local asset fetches; JS transfer 180.5 KB, CSS 5.9 KB, favicon 0.6 KB.
  - Exercised: initial 1600×1000 layout, Launch, spin-up, transfer, Delivered result, Retry reset (budget 4,000 / energy 3.00 / stock 3), quantity change, Small-module failure preview, Standard-protection blocker and disabled Launch, restore to the validated config, and resize to 1280×720 with the Launch button still visible. Escape closes the result dialog; **Mission report** reopens it; the **Sources & Model Notes** dialog opens and closes. No console errors, page errors or failed requests.
- **Safari:** not exercised in this turn. Chromium/Chrome is the verified browser; WebGL fallback messaging is present.
- **Sub-path deployment:** `base: './'` is configured, but only root-path preview was tested. No public deployment was performed.

### Measured prediction work

| Case | Result | Notes |
|---|---|---|
| First preview, Balanced / q2 / Large | ≈**9–18 ms** | 5,179 sampled points, 77,663 fixed steps |
| Same config again | cache hit | no re-integration |
| 98 % weak departure | misses Moon at 8 d | closest ≈272,098 km |
| 4 s vs 2 s step | same Delivered event | Δt ≈18 s, Δv ≈0.000044 km/s |
| 4 s vs 8 s step | same Delivered event | Δt ≈74 s, Δv ≈0.000216 km/s |

The 4 s step is the committed default. Playback is 45,000× through a fixed-step accumulator with a 360-step per-frame cap; increasing speed never enlarges the physics timestep. A slow frame drops playback backlog instead of changing physics.

---

## Known limitations and blockers

- **One verified profile only.** Economy/Fast and free launch tuning are intentionally absent. The profile is a fitted fictional assisted-ascent case, not a real mission design.
- **The transfer is a static two-center approximation.** The Moon is fixed; Earth rotation, lunar motion, solar gravity, atmosphere, ascent, guidance and landing are omitted. Relative speed at reception is therefore inertial speed relative to a stationary depot. See `docs/MODEL_NOTES.md`.
- **The current UI cannot produce “missed Moon”, “Earth impact”, “lunar impact” or “arrival too fast”.** Those paths are implemented and tested; the single Balanced profile always reaches the zone. The selectable failure is the Small braking module.
- **No audio, persistence, additional contracts, or destinations.** These are outside this slice.
- **Headless performance is software-rendered.** The 33–34 fps headless number should not be read as hardware performance; the headed Metal measurement is 120.3 fps.
- **No public deployment or paid account was created.** No backend is required.
- **The repository directory was not a git repository when work began.** A local repository was initialized for this slice; `package-lock.json` is tracked, while `node_modules/` and `dist/` are ignored. No remote or public deployment was created.

No hard blocker prevents running or verifying the slice.

---

## Documentation

- [`docs/MODEL_NOTES.md`](docs/MODEL_NOTES.md) — frame, constants, equations, validated path, convergence, omissions, fictional assumptions.
- [`docs/SOURCES.md`](docs/SOURCES.md) — real inputs, retrieval context, URLs, units, asset licenses, non-endorsement.
- [`docs/AI_USAGE.md`](docs/AI_USAGE.md) — development-assistance disclosure.
- Supplied planning documents remain at the repository root.
