# Orbital Express
## 48-Hour Hackathon Game Plan · Earth-to-Moon MVP

**Working title:** Orbital Express. **Tagline:** Spin up. Ship smart. Deliver beyond Earth.

**Format:** Single-player, English-language, 2D browser engineering puzzle game.

**World:** A fictional delivery company launches cargo from Earth to destinations across the Solar System. The first playable release implements Earth → Moon only. Other planets and moons are future destinations, not implemented levels.

This revision replaces the previous Moon A → Moon B concept. Both existing document filenames are retained for continuity; Lunar Sling is the former working title.

## 1. Concept and first-release boundary

The player operates an Earth-based centrifugal cargo launcher. Orders arrive from a lunar receiving depot. The player chooses cargo and capsule equipment, allocates energy and credits, plans a launch, and watches whether the shipment arrives safely.

The complete mission loop is: order → cargo/capsule design → launch planning → flight → reception → evaluation → retry. The aim is to teach linked engineering trade-offs through a readable, entertaining delivery game.

The setting, company, launcher, receiving depot and capsule technology are fictional. Real company and agency names are not part of the story, tutorial or product branding. Required scientific attribution and competition information are kept in separate source and submission documentation.

The Moon is the simplest initial destination for this project's Earth-origin delivery scope. It is not simpler than local Moon-to-Moon delivery. Future interplanetary routes require additional mechanics, not just a different background.

Target session: 3–5 minutes of accelerated simulation. Target release: one complete route and at least one polished contract; three contracts if stable.

## 2. Player experience

1. **Accept an order:** review required cargo, quantity, deadline and reward.
2. **Load the capsule:** select allowed cargo quantities from a small catalog. The contract determines what counts toward completion.
3. **Configure protection and propulsion:** choose light/reinforced protection and a small/large maneuver reserve.
4. **Plan:** select release speed and direction; view the predicted path, load, energy requirement and arrival estimate.
5. **Launch:** watch a brief centrifugal spin-up and automatic release, then a clearly labeled simplified Earth-departure phase.
6. **Fly:** watch the cargo travel through the Earth–Moon scene. The system performs the planned departure assistance and terminal braking using finite configured reserves.
7. **Deliver and review:** receive credit for intact requested cargo actually accepted by the depot. See the reason for failure and change the previous configuration to retry.

Do not make release a high-speed reflex test. Players choose an angle; the controller releases at the matching rotor phase. A slowed animation illustrates the action and does not claim to show physical RPM in real time. Adjustable direction represents fictional adjustable hardware.

## 3. Cargo rules: choice within constraints

The player does not invent arbitrary cargo properties. The MVP offers three predefined classes and lets players choose quantities. Begin with one cargo class per capsule; mixed manifests are a stretch feature.

| Cargo | Intended gameplay role | Main constraints | Contract role |
|---|---|---|---|
| **Construction Supplies** | Forgiving tutorial cargo: standardized solid construction parts | Relatively heavy, high modeled load tolerance | Build or expand the lunar depot |
| **Supply Packs** | Balanced logistics cargo: dry food and packaged nonliving consumables | Moderate tolerance; delivery deadline | Replenish the depot |
| **Research Equipment** | High-value engineering challenge: fictional ruggedized instrument modules | Low modeled tolerance, tighter arrival-speed limit, greater protection cost | Deliver equipment for a research task |

These are game balance categories. No claim is made that an arbitrary real instrument or packaged food can survive the modeled acceleration. Every catalog item has an explicit configured tolerance. Protective structures add limited tolerance; they do not make sustained centrifugal acceleration disappear. If a cargo cannot survive any permitted launch configuration, exclude it from centrifuge orders rather than inventing unlimited protection.

All classes use the same fields: item ID, display name, unit mass, volume units, price, value, maximum effective launch load, maximum arrival speed and available quantity. The contract stores requested item IDs, required quantities, deadline, destination and reward. Protection and propulsion have separate mass, volume, cost and performance fields.

### Hard limits

- Total capsule mass and volume must fit launcher and capsule limits.
- Payload includes structure, protection and propulsion; fuel/modules cannot be massless bonuses.
- Inventory, credits and energy must be sufficient.
- Launch-load tolerance must be satisfied after the bounded protection adjustment.
- An incompatible configuration blocks launch with a precise explanation; do not quietly fix it.

### Performance limits

- The destination must be intercepted within the modeled mission horizon.
- Arrival velocity is relative to the receiving depot, not just speed relative to Earth.
- Maneuver reserve must support the modeled departure and braking requirements.
- Late or damaged shipments follow the explicit contract policy: the tutorial gives a clear retry; later contracts may reduce rewards. Requested intact cargo is what satisfies the order.

No humans, animals, living cargo, hazardous cargo or arbitrary custom scientific attributes in the MVP. An optional shipment nickname is cosmetic only. Sandbox cargo editing belongs in a later version and should not qualify for contract scores.

## 4. Required features and acceptance

| Feature | First-release scope | Acceptance |
|---|---|---|
| Earth launcher | One fixed departure facility with a centrifugal animation | Cargo visibly starts on Earth |
| Lunar reception | One fixed depot in the simplified lunar frame | Delivery occurs at the Moon, not at a second lunar launch site |
| Orders | Cargo type, quantity, deadline and resource limits | Objective is clear before launch |
| Cargo and capsule | Three catalog classes; one per shipment; protection and maneuver options | Choices change feasibility and useful delivered payload |
| Planning | Release speed/direction and predicted trajectory | Prediction matches the actual model |
| Flight | Shared deterministic 2D simulation | Same settings produce the same result |
| Reception | Target zone, relative speed and braking checks | High-speed collision is not successful delivery |
| Logistics | Inventory, credits, launch energy, delivered quantities | No overdraw or reward exploit |
| Evaluation/retry | Failure reason and retained configuration | Player can improve a second attempt |
| Sources | Separate English model/source panel or linked document | Fictional assumptions and real inputs are distinguishable |
| Public build | Browser-playable without login | A reviewer can complete a contract in a clean session |

No warehouse interior or construction management is required. The warehouse is represented by orders, stock and reception totals.

## 5. Three contracts on the same Earth–Moon route

| Contract | Cargo | Lesson | Scope |
|---|---|---|---|
| **First Delivery** | Construction Supplies | Launch planning and safe reception | Generous resources, clear guidance |
| **Handle With Care** | Research Equipment | Protection versus useful payload | Lower load tolerance, stricter arrival limit |
| **Supply Run** | Supply Packs | Quantity, energy, propulsion and deadline | Tighter budget; multiple launches only if time permits |

Do not describe later contracts as longer lunar routes. All use Earth → Moon; difficulty comes from cargo and resource constraints. Balance all contracts around at least one feasible, validated configuration.

## 6. Physics and simulation scope

This is a stylized transfer puzzle, not a validated Earth-launch or landing simulator. A centrifugal release is the initial acceleration mechanism; a fictional assisted departure stage and limited maneuver system account for the rest of the mission. Do not claim that the centrifuge alone delivers cargo from the Earth's surface to the lunar ground.

### Three explicit phases

**A. Earth launch:** Compute release speed `v = omega*r`, acceleration `a = v^2/r`, load in Earth standard-g units, and energy `E = m*v^2/(2*efficiency) + fixed_cycle_loss`. The machine radius, efficiency, losses, protection and prices are game assumptions. Atmosphere, heating and detailed ascent are omitted and replaced by a labeled assisted-ascent abstraction. That abstraction has a documented mapping from release conditions and capsule mass to a departure state and propulsion cost; it must not teleport every bad shot into a successful path.

**B. Earth–Moon transfer:** Use a fixed-position Earth–Moon configuration for the first release. Both bodies exert inverse-square gravity on a test-particle capsule. Integrate position and velocity numerically with a fixed simulation timestep and a stable method such as velocity Verlet. This is a static two-center gravity approximation: the Moon is held fixed, and orbital motion, Earth rotation and solar gravity are omitted. Do not apply constant downward gravity or the flat-surface range equation to this route.

For body i: `a_i = -mu_i*(p - p_i)/|p - p_i|^3`. Stop or change phase at body boundaries; never integrate through the central singularity. Keep physical units consistent, e.g. kilometers, seconds and km^3/s^2. Convert launcher calculations in meters explicitly. Screen distances may be compressed and body graphics exaggerated, with a scale note; do not silently change simulation inputs.

**C. Lunar reception:** On entering a marked approach region, an automatic controller applies the finite configured braking reserve. Compare velocity to the depot's velocity in the chosen model. The MVP may simplify braking to a discrete delta-v maneuver and represent the final descent by a docking/landing animation after acceptance criteria are met. State that continuous thrust, guidance and detailed landing dynamics are omitted. Mere proximity or collision is not delivery.

Use the exact same departure mapping, integrator and arrival rules for preview and live flight. Time acceleration changes playback rate, not physics. Avoid manual in-flight steering in the MVP.

### Consistency and fallback

Equal post-departure position and velocity give equal unpowered vacuum trajectories regardless of cargo mass. Mass still changes launch energy, capacity and maneuver capability. At fixed rotor radius/speed, acceleration is independent of payload mass; force is not.

Maneuver modules may expose a precomputed delta-v-versus-loaded-mass table, explicitly fictional and monotonically decreasing with loaded mass. The departure assistance and terminal braking share a tracked reserve or separate explicitly tracked budgets; do not allow free burns.

If free trajectory tuning is not reliably playable by hour 12, keep the same model but offer three precomputed, validated launch profiles. Players still choose cargo/protection/reserve and compare mission outcomes. Preserve Earth-origin launch; do not revert to Moon-to-Moon delivery or silently substitute straight-line teleportation.

## 7. Presentation and controls

One reusable main screen: Earth and its launcher on the left, lunar receiver on the right, cargo capsule and dotted trajectory between them. A close-up inset can show the rotor without requiring a second interactive scene. Original flat/vector art is sufficient.

- Top: contract, required/delivered cargo, credits and energy.
- Side: cargo type/quantity, protection, maneuver reserve, release speed and angle.
- Feedback: total mass, capacity, load tolerance, energy, maneuver budget and predicted outcome.
- Buttons: **Launch**, **Retry**, **Mission Brief**, **Sources & Model Notes**.
- Outcomes: **Delivered**, **Missed Moon**, **Cargo Damaged**, **Insufficient Maneuver Reserve**, **Arrival Too Fast**, **Out of Resources**, **Mission Complete**.

Explain the actual cause, e.g. “Your cargo exceeded its launch-load limit. Choose stronger compatible packaging or reduce release speed.” Do not issue a diagnosis unsupported by the simulation. Planet selection beyond the Moon is optional decorative roadmap text, not functioning gameplay.

## 8. Technology and extensibility

Default: Godot 2D, one scene plus lightweight panels, a shared deterministic simulation module and data-driven cargo/contracts/destinations. No backend, accounts, database, multiplayer or cloud saves. Verify current official web-export requirements for the installed engine before implementation. Freeze engine choice by hour 2 and test a hosted minimal build by hour 4. A familiar JavaScript renderer is an alternative if the team is much faster with it.

Separate destination data from cargo data. A future destination can specify body ID, parent body, physical parameters, reception model, route model and available contracts. Only the Moon needs actual data and executable route logic now.

Later planets and moons need moving targets, heliocentric transfer, launch windows, different arrival environments and longer mission budgets. Gas giants require orbital depots or atmospheric platforms, not generic solid-surface warehouses. Do not promise that all routes can be enabled merely by editing a distance value.

## 9. Sources and competition documentation — separate from the fictional story

The following references support the educational simulation and submission. They do not appear as agencies or companies in the fictional story, and no real organization is implied to endorse or operate the game technology.

**Essential physical inputs:** NASA/JPL Astrodynamic Parameters gives Earth and Moon gravitational parameters: https://ssd.jpl.nasa.gov/astro_par.html . The retrieved page lists Earth `398600.435507` and Moon `4902.800118` in km^3/s^2 (DE440). Preserve these units and source version notes. Use documented radii and a documented mean Earth–Moon distance; do not confuse perigee or apogee with the mean.

Supporting lunar physical parameters: https://ssd.jpl.nasa.gov/sats/phys_par/sep.html . Earth–Moon descriptive reference: https://science.nasa.gov/moon/by-the-numbers/ . Verify selected fields before implementation. These inputs influence gravity, boundaries and geometry; they are not merely a background credit.

**Mission-design reference:** https://www.nasa.gov/wp-content/uploads/2025/04/250323-design-and-develop-science-mission.pdf . Use it to inform requirements, design, operation and evaluation, and document actual use.

**Deferred terrain:** https://imbrium.mit.edu/ . LRO LOLA is optional after the core route works. No terrain processing is required for the first release, and no integration claim should be made without actual use.

Record actual resource title, provider, URL, product/version, retrieval date, fields, conversions, role and attribution. Bundle the small input set; live APIs are unnecessary. Keep real inputs, omitted physics and fictional propulsion/packaging assumptions clearly separated. This project is an educational approximation, not evidence that the proposed transport system is technically validated.

## 10. Global Offers

Based on the supplied offer text, subject to provider eligibility and terms.

| Offer | Decision |
|---|---|
| GitHub Copilot / Microsoft Copilot | Optional implementation/documentation assistance; disclose actual use |
| Miro templates / Teams | Use only if convenient; retain existing collaboration tools |
| Miro Education / Business | Not needed for delivery |
| GoDaddy Registry / Porkbun | Optional domain/showcase after the build works; verify hosting compatibility |
| Azure / Google Cloud | No backend required; avoid new infrastructure setup |
| Planetary Computer | Earth environmental datasets not needed for this route model |
| Meteomatics | Weather is outside the MVP; no API needed |

Offers are optional and do not substitute for required scientific resource integration. Do not add weather or cloud services merely to use a credit.

## 11. Forty-eight-hour schedule

Elapsed blocks include rest/handoff; reduce scope for a solo developer. The actual event deadline and its official timezone override this development budget.

| Hours | Deliverable | Gate |
|---|---|---|
| 0–4 | Freeze scope/engine; source inputs; host a minimal web build | Browser delivery verified |
| 4–12 | Earth launcher, departure mapping, Earth–Moon trajectory, preview and interception | One known profile reaches the lunar approach region; otherwise use validated presets |
| 12–20 | Cargo, protection, resources, finite maneuvers and safe reception | At least one feasible delivery plus clear failure cases |
| 20–24 | Results, retry, first complete contract | Public build supports a complete session |
| 24–32 | Rest/handoff, usability, tuning; optional contracts 2–3 | New player understands a second-attempt improvement |
| 32–38 | Visual polish, source/model notes, bug fixes | Feature freeze |
| 38–44 | Capture demo, English description, source and AI-use disclosures | Submission draft and public links ready |
| 44–48 | Clean-browser verification, submit and retain buffer | Confirm successful submission before actual deadline |

Do not postpone browser export until the end. If behind at hour 20, ship one cargo class and one contract while retaining capsule/resource decisions. If behind at hour 32, stop all new features.

## 12. Verification and exclusions

Check: inverse-square acceleration at a known position; a single-body circular-orbit sanity case with reception disabled; timestep convergence of a known transfer; identical preview/live paths; equal vacuum paths at equal initial state for different masses; body collisions; finite maneuver accounting; mass/volume/stock limits; incompatible cargo blocking; safe versus excessive arrival speed; retry/reward correctness; deployed build without login and without sound.

**Must ship:** Earth → Moon, one contract, cargo/capsule trade-offs, finite resources, documented physical inputs, meaningful arrival rules, retry and a public English build.

**Should ship:** three catalog cargo classes, three contracts, clear animation and audio controls.

**Stretch:** mixed cargo, local score/attempt comparison, validated launch-time choices with a moving Moon, extra visuals.

**Excluded:** other playable destinations, detailed atmosphere/heating/ascent/landing, full Solar System N-body simulation, realistic launcher structural design, production chains, warehouse construction, multiplayer and AI NPCs.

## 13. Submission and success criteria

Prepare a public playable link, public repository with run instructions, English summary/description, resource and asset references, accurate AI-use disclosure, and a demo of at most 30 seconds or up to seven English slides including title/intro. Generated media and generated code/data must carry the disclosures required by the current submission guide. Use original product branding and keep generated art free of agency logos. These administrative references belong outside the story.

Official challenge: https://www.spaceappschallenge.org/2026/challenges/space-mission-design-game/
Submission guide: https://www.spaceappschallenge.org/resources/project-submission-guide/
Offers: https://www.spaceappschallenge.org/2026/global-offers/

Success means that a new player can launch from Earth, deliver requested cargo to the Moon, explain at least three linked engineering choices, and improve after a failed attempt. Future Solar System delivery is a roadmap, not a claim about the hackathon build.
