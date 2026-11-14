# Model Notes — Orbital Express (First Delivery slice)

This document separates **real physical inputs** from **fictional or game-modeled assumptions**. It describes exactly what the simulation does, what it omits, and what the committed validation case proves.

> This is a stylized transfer puzzle, not a validated Earth-launch, trajectory-design, guidance or landing simulator. The centrifuge alone does not deliver cargo to the lunar surface; a clearly labeled fictional assisted-ascent stage and a discrete terminal-braking model close the gap.

---

## 1. Frame and units

- **Frame:** Earth-centred inertial, two-dimensional. `+X` points toward the fixed Moon. The Moon is at `(384,400, 0) km`. `+Y` is 90° counterclockwise.
- **Bodies:** Earth at `(0, 0)`; Moon fixed at its mean distance. There is no lunar orbital motion, Earth rotation, or third-body perturbation.
- **Transfer units:** km, s, km/s, km³/s². Gravity is `km/s²`.
- **Launcher units:** the rotor is modeled in m, m/s, m/s², kg and J, then converted explicitly to km/s and GJ at the model boundary.
- **Time:** the transfer uses a fixed step of **4 s**. Playback speed changes how many fixed steps are advanced per frame, never the step itself.

The player-facing map is a rendering-only view. It uses a 14° rotation so Earth sits lower-left and the Moon upper-right. Distances and body radii remain true; the cargo marker is enlarged for visibility. The simulation is unchanged by view rotation or window size.

---

## 2. Real physical inputs

| Input | Value | Use |
|---|---|---|
| Earth gravitational parameter `μ⊕` | **398,600.435507 km³/s²** | Earth inverse-square gravity |
| Moon gravitational parameter `μ☾` | **4,902.800118 km³/s²** | Moon inverse-square gravity |
| Earth mean radius `R⊕` | **6,371.0 km** | Earth surface boundary; launch-ring presentation |
| Moon mean radius `R☾` | **1,737.4 km** | Lunar surface boundary |
| Mean Earth–Moon distance | **384,400 km** | Fixed Moon position |
| Standard gravity `g₀` | **9.80665 m/s²** | Presentation of rotor acceleration in g |

These are the only scientific values that drive the physics. Sources, retrieval context and units are recorded in [`SOURCES.md`](SOURCES.md).

The lunar **reception zone** (12,000 km radius around the Moon centre), cargo tolerances, equipment masses, prices, energy budgets, brake-reserve table and the assisted-ascent boost are **game assumptions**, not measured properties.

---

## 3. Gravity and integrator

For each body `i`:

```text
a_i = −μ_i · (p − p_i) / |p − p_i|³
a   = Σ a_i
```

The Earth–Moon field is integrated with **velocity Verlet**:

```text
p(t+Δt) = p + v·Δt + ½·a(t)·Δt²
a(t+Δt) = acceleration(p(t+Δt))
v(t+Δt) = v + ½·[a(t) + a(t+Δt)]·Δt
```

- Fixed `Δt = 4 s`, no adaptive stepping in the committed path.
- Mission horizon: **8 days** (691,200 s).
- The integrator does not step through a central singularity: body intersections are checked on the swept segment before the next step is accepted. A hit ends the phase with an outcome.

### Timestep convergence

The same committed departure state, with the same terminal rules, at several steps:

| Δt | Outcome | Entry time (days) | Entry speed (km/s) | Brake left (km/s) |
|---:|---|---:|---:|---:|
| 1 s | Delivered | 3.595242 | 0.927357 | 1.501380 |
| 2 s | Delivered | 3.595294 | 0.927377 | 1.501359 |
| **4 s** | **Delivered** | **3.595502** | **0.927421** | **1.501315** |
| 8 s | Delivered | 3.596354 | 0.927637 | 1.501099 |

At 2 s the entry time differs by ≈18 s and the speed by ≈0.000044 km/s; at 8 s the differences are ≈74 s and ≈0.000216 km/s. The 4 s step is the committed trade-off between prediction cost and terminal-event accuracy.

The trajectory is deliberately near escape, so it is sensitive to departure speed. That is why the game ships **discrete validated profiles** rather than free speed tuning. A change from 10.921633 to 10.923817 km/s (about 0.02 %) moves the unbraked closest approach from roughly 4,074 km to roughly 7,737 km in the two-body-plus-static-Moon field. The committed mission stops at the 12,000 km zone boundary and brakes; the unbraked closest approach is reported here only to document sensitivity.

---

## 4. Fictional departure model

### 4.1 Rotor

The launcher is a fictional surface centrifuge:

```text
v_release = ω · r
a_rotor   = v_release² / r
E_rotor   = m · v_release² / (2·η) + E_fixed
```

| Parameter | Value |
|---|---|
| Rotor radius | **2,000 m** |
| Angular speed | **0.5 rad/s** |
| Release speed | **1,000 m/s = 1.000 km/s** |
| Rotor load | **50.9858 g** (`500 / 9.80665`) |
| Efficiency `η` | 0.62 (fictional) |
| Fixed cycle loss | 0.22 GJ (fictional) |

For the 815 kg validated load, rotor energy is `815 × 1,000² / (2 × 0.62) + 0.22 GJ = 0.877258 GJ`.

The rotor load is independent of capsule mass, as `v²/r` requires. The force is not modeled; the cargo’s **modeled launch-load tolerance** is the game rule (45 g Standard, 90 g Reinforced after the 2.0 multiplier). At 51.0 g the Standard frame is therefore blocked, and the Reinforced frame passes.

### 4.2 Assisted ascent

The game models the interval between surface release and the transfer start as a **fictional assisted ascent**:

1. Release at the surface at the profile’s release angle, with the rotor’s prograde tangent velocity.
2. The ascent stage adds a fixed prograde delta-v and inserts the capsule at `r_insertion = 6,571 km` (200 km above mean Earth radius).
3. The stage has a finite capacity; the profile’s required delta-v must fit, or launch is blocked.

Balanced values:

| Parameter | Value |
|---|---|
| Release angle | 180° (Earth’s far side, in the simulation frame) |
| Release position | `(−6,371, 0) km` |
| Insertion radius | `6,571 km` |
| Insertion position | `(−6,571, 0) km` |
| Prograde tangent at 180° | `(0, −1)` |
| Ascent delta-v | **9.923817 km/s** |
| Ascent stage capacity | **10.0 km/s** |
| Departure speed | **10.923817 km/s** |
| Departure velocity | `(0, −10.923817) km/s` |

The departure speed is `1.0002 ×` the ideal two-body Hohmann perigee speed for `6,571 → 384,400 km`:

```text
a_H = (6,571 + 384,400)/2 = 195,485.5 km
v_H = sqrt(μ⊕ · (2/6,571 − 1/195,485.5)) = 10.9216326677 km/s
v_departure = 10.923817 km/s
```

This is a **fitted game profile**, not an optimized real mission. The added 0.0002 factor avoids an unbraked pass that would be much closer to the lunar surface and gives the validated reception-zone entry.

The mapping is deterministic and does not correct a bad shot. A 2 % lower departure speed misses the Moon entirely (see §7). The ascent stage is not a real propulsion design, and its 9.92 km/s delta-v is not an engineering claim.

### 4.3 Departure resource

- The ascent stage consumes `9.923817` of its `10.0 km/s` finite capacity; `0.076183 km/s` remains on paper.
- The launcher’s credits, grid energy and inventory are deducted once at launch.
- The capsule’s own maneuver reserve is reserved for terminal braking; it is not free extra ascent performance.

---

## 5. Arrival and reception

The receiving depot is a fictional point at the Moon centre with a marked **12,000 km-radius reception zone** (about 10,263 km above the mean lunar surface). Entry is detected with a **swept segment–circle intersection**, so a large simulation step cannot tunnel through the boundary or a body unnoticed.

On the first zone entry:

1. The capsule’s speed relative to the depot is `|v|`, because the Moon is fixed in this model.
2. The cargo has a modeled maximum arrival speed, **1.5 km/s** for Construction Supplies.
3. If `|v| > 1.5 km/s`, the result is **Arrival too fast**; no burn is attempted.
4. Otherwise the required retrograde burn is `max(0, |v| − 0.15) km/s`, where **0.15 km/s** is the docking threshold.
5. If the required burn exceeds the remaining brake reserve, the result is **Insufficient braking reserve**.
6. If it fits, the single discrete burn is applied, the reserve is reduced, and reception is accepted. The cargo is delivered if the loaded quantity meets the contract; otherwise the result is **Contract shortfall**.
7. The final descent from the zone boundary to the depot is an **animation after acceptance**, not integrated landing dynamics.

The saving rules are explicit:

- Proximity or a collision alone is never delivery.
- Collision with the Moon without a valid reception is **Lunar impact**.
- Falling back to Earth is **Re-entering Earth**.
- Not entering the zone inside the 8-day horizon is **Missed the Moon**.

The burn is a scalar approximation, not a guided burn with attitude, thrust duration or mass flow. If the burn fits, the game does not integrate the post-burn descent; it accepts the reception and animates the final approach. This is documented in the result overlay and in the game’s Sources & Model Notes.

---

## 6. Resources, mass and braking reserve

### 6.1 Loadout

| Component | Mass | Volume |
|---|---:|---:|
| Courier capsule (dry) | 240 kg | — |
| Construction Supplies (per crate) | 180 kg | 0.75 |
| Standard protection | 30 kg | 0.10 |
| Reinforced protection | 95 kg | 0.25 |
| Small maneuver module | 45 kg | 0.15 |
| Large maneuver module | 120 kg | 0.35 |
| Capsule capacity | max 1,500 kg | 3.00 |

The default 2-crate Reinforced/Large load is `240 + 2×180 + 95 + 120 = 815 kg`, `2×0.75 + 0.25 + 0.35 = 2.10` volume units.

### 6.2 Brake reserve

The maneuver module’s reserve is an explicitly fictional, mass-scaled table:

```text
brake_reserve(m) = base_reserve · sqrt(800 kg / m)
base: Small 0.62 km/s, Large 2.30 km/s
```

For the 815 kg validated load, Large gives `2.30 × sqrt(800/815) = 2.278736 km/s`. A hypothetical Small module at that same total mass would be ≈0.614 km/s; the actual committed Small configuration is lighter (740 kg) and gives **0.644645 km/s**. Either way it is below the required ≈0.777421 km/s.

This gives a monotonic decrease with loaded mass, as required by the design, while remaining a game assumption rather than a propulsion table.

### 6.3 Credits, energy and inventory

- Starting budget: 4,000 cr; grid energy: 3.00 GJ; stock: 3 crates.
- Launch cost: cargo `280/crate`, protection 120/420, module 350/820, launch fee 400 cr. Default: **2,200 cr**.
- Rotor energy is deducted from the grid budget; the fictional ascent-stage energy is not separately priced in this slice.
- A legal launch deducts credits, energy and stock once. Repeated Launch clicks are ignored because the controller leaves `CONFIGURING` synchronously.
- A successful delivery adds the contract reward **once**. Retry resets the whole order to its initial resources and keeps the current configuration; it is not an unlimited free-shipping exploit across orders, because this slice has one order.
- The visible budget and energy are the source of truth for validation. No hidden free resources.

---

## 7. Verified case and failure cases

### 7.1 Committed success

`First Delivery / Construction Supplies ×2 / Reinforced / Large / Balanced`:

- departure at `(−6,571, 0) km`, velocity `(0, −10.923817) km/s`;
- zone entry after **≈3.59550 days** at **0.927421 km/s**;
- required brake **0.777421 km/s**; Large reserve **2.278736 km/s**; remaining **1.501315 km/s**;
- reception accepted, 2/2 crates, **Delivered**, reward +3,200 cr.

### 7.2 Selectable failures

| Configuration | Result | Why |
|---|---|---|
| Same load, **Small** module | Insufficient braking reserve | ≈0.645 km/s available vs ≈0.777 km/s required |
| Quantity 1, Reinforced, Large | Contract shortfall | Reception valid, but 1 of 2 required crates |
| Protection **Standard** | Launch blocked | 51.0 g rotor load vs 45.0 g limit |
| Quantity 3, Reinforced, Large | Delivered | Higher mass, still within resources and reserve |

### 7.3 Non-selectable validation failures

| Synthetic case | Result |
|---|---|
| 98 % of the committed departure speed | **Missed the Moon**; closest ≈272,098 km; 8-day horizon |
| Suborbital state at 7,000 km with radial −1 km/s | **Re-entering Earth**, detected by swept surface intersection |
| 20 km/s segment across the 12,000 km zone | **Arrival too fast**; no tunnelling; entry point interpolated |
| 20 km/s segment across the Moon with the zone shrunk below the surface | **Lunar impact** |

These are unit-test paths, not player-facing choices in this slice. The single available profile always reaches the zone; the Small-module failure is the selectable in-flight failure.

---

## 8. Prediction, live flight and frame pacing

- **One step function.** `transferSimulator.stepTransfer` performs the Verlet update, swept event checks, zone entry and terminal decision. `runTransfer` (preview) and `MissionController` (live) both call it. There is no second physics implementation.
- **Terminal equality.** The tests run the committed config through preview and through the controller and assert equal outcome kind, terminal time, relative speed and terminal position.
- **Bounded prediction.** The horizon is 8 days and the step is 4 s, so a prediction is capped at 172,802 steps. The committed path is 77,663 steps and is sampled every 60 s to 5,179 points. A prediction takes ≈9–18 ms in the tested build; cached configurations take no integration.
- **Cache and cancellation.** The cache key is the full discrete configuration. At most 12 configurations exist in this slice, so the cache is bounded. `MissionController` increments a prediction generation before each refresh and discards a result whose generation is no longer current. The current computation is synchronous, so no stale result can actually interleave; the guard is ready for future asynchronous prediction.
- **Playback.** Live flight accumulates `realDt × 45,000` simulated seconds, then executes whole 4 s steps. A 360-step per-frame cap prevents a slow frame from stalling the page; when the cap is reached the remaining playback backlog is dropped. Playback speed therefore changes presentation time, not the physics step.
- **Hidden tabs.** Animation frames pause in a hidden tab. On resume, the controller clamps a single real-time delta to 0.1 s and the composable resets its wall clock. A multi-hour background delta cannot jump the mission state.
- **Resize.** `ResizeObserver` updates the renderer and camera only. Simulation state is untouched.
- **No workers.** Prediction is small enough at this scope to run on the main thread with a bounded step count and a discrete cache; workers are unnecessary complexity for the first slice.

---

## 9. Rendering model

- Orthographic camera, 1 scene unit = 1 km, full Earth–Moon distance.
- Earth and Moon use true physical radii and true mean separation. The reception ring shows the 12,000 km target radius. The cargo marker is enlarged so it is visible at planetary scale.
- A 14° view rotation is purely cosmetic and does not alter coordinates used by physics.
- A small star field, body glows, a dashed predicted path, a solid flown trail, and a rotor inset provide atmosphere without postprocessing or a free camera.
- Device pixel ratio is capped at **1.5**; the trail is capped at 12,000 points; stars are 780 points; there is no bloom or full-screen blur pass.
- Geometry, materials, the canvas texture, the ResizeObserver and the animation frame are disposed on unmount. The scene is not placed in Vue’s reactive proxy.
- No external textures, fonts or audio are loaded. The favicon and all placeholders are original procedural/CSS/SVG work.

---

## 10. Omitted physics and claims not made

Omitted or simplified:

- Earth atmosphere, drag, aerodynamic heating, max-Q and structural loads;
- detailed ascent, staging, engine performance and launch-site operations;
- Earth rotation and latitude;
- lunar orbital motion around Earth, lunar libration and a moving depot;
- solar gravity, other third-body gravity, non-spherical gravity fields, tides and relativity;
- continuous-thrust guidance, navigation, attitude control, burn duration and mass flow;
- terminal descent, terrain, landing gear, dust and surface interaction;
- atmospheric entry or reuse.

The model does **not** claim:

- that a 2 km centrifuge can launch this cargo in reality;
- that the fictional 9.92 km/s ascent stage exists or is feasible;
- that the cargo tolerances, prices, energy budget or reward are engineering or market data;
- that the final descent is a validated lunar landing;
- that the static two-body trajectory is a real mission design or a launch-window analysis;
- that a real agency or company endorses or operates anything depicted.

The only claim is that, **under the stated approximations**, the committed discrete configuration leaves Earth, enters the marked lunar reception zone, meets the modeled relative-speed and braking criteria, and can be reproduced from the same shared simulation.

---

## 11. Reproduce

```bash
npm run typecheck
npm run test
npm run build
npm run preview
```

The tests in `tests/` are the executable form of the checks above. The committed default is set in `src/game/rules/configRules.ts` (`defaultConfig`) and the numerical values live in `src/data/`.
