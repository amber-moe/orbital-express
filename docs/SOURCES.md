# Sources and Attribution

This file records the real scientific inputs used by the simulation, their retrieval context, and the boundary between sourced physical data and fictional game assumptions. It is intentionally separate from the in-universe story and branding.

Retrieval date for the scientific pages below: **2026-11-14**.

---

## 1. Real physical inputs used by the simulation

| Field | Value used | Source | Role in this build |
|---|---:|---|---|
| Earth gravitational parameter `GM⊕` | **398,600.435507 km³/s²** | JPL Solar System Dynamics, *Astrodynamic Parameters* (DE440 table), https://ssd.jpl.nasa.gov/astro_par.html | Earth inverse-square acceleration |
| Moon gravitational parameter `GM☾` | **4,902.800118 km³/s²** | Same JPL *Astrodynamic Parameters* page (DE440 table); also listed as `4902.800 ± 0.001` in JPL planetary-satellite physical parameters | Moon inverse-square acceleration |
| Earth mean radius | **6,371.0 km** | NASA Science, *Earth's Moon — Compare Earth and the Moon / By the Numbers*, https://science.nasa.gov/moon/by-the-numbers/ (equatorial-radius field; the value is the conventional mean spherical radius used here) | Earth surface boundary; launch-ring presentation |
| Moon mean radius | **1,737.4 km** | JPL Solar System Dynamics, *Planetary Satellite Physical Parameters*, https://ssd.jpl.nasa.gov/sats/phys_par/sep.html (Moon mean radius `1737.4 ± 0.1 km`) | Lunar surface boundary |
| Mean Earth–Moon distance | **384,400 km** | NASA Science, *Earth's Moon — By the Numbers* (average orbit distance) | Fixed position of the Moon at `(384,400, 0) km` |
| Standard gravity `g₀` | **9.80665 m/s²** | Defined standard value used for presentation of rotor acceleration in g | Display only; not a fitted source |

### Notes on the retrieved values

- The JPL *Astrodynamic Parameters* page lists `Earth 398600.435507` and `Moon 4902.800118` in `km³ s⁻²` from the DE440 planetary ephemeris. These exact values are stored in `src/data/physicalConstants.json`.
- The JPL planetary-satellite page lists the Moon’s GM as `4902.800 ± 0.001 km³/s²` and its mean radius as `1737.4 ± 0.1 km`. The build uses the DE440 value for GM and the mean radius for the boundary. The NASA page separately lists an equatorial radius of `1,737.5 km`; the difference is not material to this game’s boundaries, and the JPL mean radius is the documented choice.
- The NASA *By the Numbers* page lists the average Earth–Moon distance as `384,400 km`. This is the fixed separation in the model. It is not a perigee, apogee, or an instantaneous ephemeris distance.
- No live API, ephemeris file, or time-varying position is used. The inputs are bundled as JSON. The simulation is a static two-centre approximation.

### Unit conversions and conventions

- Gravitational parameters are used directly in `km³/s²`; positions in `km`; velocities in `km/s`; time in `s`.
- The launcher is computed in SI: rotor radius in `m`, angular speed in `rad/s`, release speed in `m/s`, acceleration in `m/s²`, energy in `J`.
- At the model boundary, `m/s` is divided by 1,000 to obtain `km/s`, and `J` is divided by `10⁹` to obtain `GJ`.
- `g`-load presentation divides rotor acceleration by `9.80665 m/s²`.
- The Moon is fixed at `(384,400, 0) km` in an Earth-centred 2D inertial frame. `+X` is toward the Moon, `+Y` is 90° counter-clockwise. There is no lunar orbital velocity in the model, so “relative speed” at reception is the capsule’s inertial speed.

---

## 2. Fictional or game-modeled assumptions (not sourced)

The following are original game assumptions and should not be attributed to any scientific source:

- The **Orbital Express** company, the **Selene Receiving Depot**, the contract, and all in-universe names.
- The 2,000 m radius centrifuge, its 0.5 rad/s spin, 0.62 efficiency, 0.22 GJ fixed cycle loss, and the 2,000 m-scale launch facility.
- The **fictional assisted-ascent stage** and its 9.923817 km/s delta-v against a 10.0 km/s finite capacity. This is not a real propulsion design.
- The Balanced profile’s fitted 10.923817 km/s departure speed and 180° release geometry.
- The 12,000 km reception-zone radius, 0.15 km/s docking threshold, and the discrete retrograde-braking approximation.
- Cargo masses, volumes, launch-load tolerances (45 g Standard / 90 g Reinforced), arrival-speed limit (1.5 km/s), stock, prices, credits, grid-energy budget and rewards.
- Maneuver-module masses and the `base × sqrt(800 kg / m)` brake-reserve table (Small 0.62 km/s, Large 2.30 km/s base values).
- The 45,000× presentation playback, 4 s fixed physics step, 8-day mission horizon, and the 360-step per-frame cap.
- The visual layout, colors, body glows, rotor inset, star field and all UI copy.

The cargo tolerances are modeled game constraints. No claim is made that an arbitrary real construction crate, instrument or packaged food can survive the modeled acceleration.

---

## 3. Omitted physics / model boundary

The following are intentionally omitted or simplified; see `MODEL_NOTES.md` for detail:

- Earth atmosphere, drag, heating, max-Q and structural dynamics;
- detailed ascent, staging, engine performance and launch operations;
- Earth rotation and latitude;
- lunar orbital motion, libration, and a moving depot;
- solar and other third-body gravity, non-spherical gravity, tides and relativity;
- continuous-thrust guidance, navigation, attitude control, finite burn duration and mass flow;
- terminal descent, terrain, landing gear, dust and surface interaction;
- any real launch-window or mission-design analysis.

The static two-centre model, the fixed Moon, and the discrete brake are educational/game approximations, not a validated flight dynamics result.

---

## 4. Tooling and documentation references

These are software references, not scientific inputs:

- Vue 3 documentation — https://vuejs.org/guide/typescript/overview.html
- Vite documentation — https://vite.dev/guide/ and https://vite.dev/guide/static-deploy.html
- Three.js documentation — https://threejs.org/docs/
- Vitest documentation — https://vitest.dev/guide/
- TypeScript documentation — https://www.typescriptlang.org/docs/
- npm package registry metadata used to select compatible versions (recorded in `package.json` and `package-lock.json`).

Tested versions are recorded in the README and in the lockfile. The stack selection was checked against the installed Node 20.11.0 runtime; Vite 6.4.6 is the compatible major line for that runtime (Vite 7 requires Node 20.19+).

---

## 5. Assets and licenses

- All visual assets in this slice are **original procedural placeholders**: CSS surfaces and layout, SVG rotor inset and favicon, Three.js spheres, lines, points, and canvas-generated glow textures.
- No external textures, photographs, fonts, audio files, 3D models or icon packs are bundled.
- The UI font stack uses locally available system fonts (`Avenir Next`, `Helvetica Neue`, etc.); no web font is downloaded.
- No real company or agency logo, wordmark, or brand asset is used in the game.
- Generated media, if added later, must retain the disclosure required by the relevant submission guide. This slice contains no generated image assets.

---

## 6. Attribution and non-endorsement

The scientific sources are credited for the physical constants and descriptive values that inform the educational approximation. Their inclusion does not imply that NASA, JPL, Caltech, or any other organization endorses, sponsors, operates or validates Orbital Express, its fictional centrifuge, its cargo system, or its results.

The project is a fictional game. Real organizations do not appear in the story, branding, tutorial or player-facing marketing.
