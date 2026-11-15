# Orbital Express

A browser mission-control game set in **Orbital Express**, a fictional Earth-based centrifuge cargo company. Plan a launch, fly to the Moon, and deliver cargo in Practice or paid Company Jobs.

**Play online:** https://amber-moe.github.io/orbital-express/

Built with **Vue 3**, **TypeScript**, **Vite**, **Three.js**, and a standalone TypeScript 2D physics module. No backend, database, accounts, routing, or third-party physics engine.

## Features

- One deterministic simulation for preview and live flight: inverse-square gravity, velocity Verlet, fixed 4 s step.
- Three lunar orders and a paid dispatch → settlement → Back to Jobs loop.
- Cargo quantity, protection, braking module, and six release-speed detents, with readiness checks and collapsed telemetry.
- Company balance starts at **6,000 cr** and tracks income/spend, completed and resolved flights, failures, delivered crates and launches; net profit excludes capital.
- Browser-local saves with interrupted-flight recovery, corrupt-save handling and a single writer tab via Web Locks.
- Outcomes: delivered, contract shortfall, insufficient braking, arrival too fast, missed Moon, Earth/Moon impact, and hard configuration blockers.
- Not included: other launch profiles, destinations, steering, audio, accounts, servers or multiplayer.

## Run locally

Tested with Node **20.11** and npm **9.5**.

```bash
npm install
npm run dev        # http://localhost:5173/
npm run typecheck
npm run test
npm run build
npm run preview    # http://localhost:4173/
```

Open the app over HTTP, not `file://`.

## Orders

| Order | Cargo | Recommended | Cost | Reward | Net |
|---|---|---|---:|---:|---:|
| Construction Run | Construction Supplies ×2 | Reinforced · Large · 100% | 2,200 cr | 3,200 cr | **+1,000 cr** |
| Supply Delivery | Supply Packs ×3 | Standard · Large · 100% | 1,790 cr | 2,800 cr | **+1,010 cr** |
| Precision Cargo | Research Modules ×1 | Reinforced · Large · 98% | 2,360 cr | 5,500 cr | **+3,140 cr** |

Jobs also shows **launchable from** (cheapest loadout that passes hard validation) and **verified delivery** (simulator-confirmed full-quantity cost). A launchable price does not guarantee delivery.

## Key failure cases

| Change | Result |
|---|---|
| Release speed 97% | **Re-entered Earth** |
| Release speed 98–100% | **Delivered** |
| Release speed 101–102% | **Missed the Moon** |
| Reinforced with Small module | **Insufficient braking reserve** |
| Construction with Standard protection | Launch blocked by rotor load |
| Underfilled quantity | Reception succeeds, **contract shortfall**, no full reward |

## Verification

- Typecheck passed; **76 tests passed in 10 files**.
- Production build: JavaScript **726.33 KB** (196.86 KB gzip), CSS **43.51 KB**.
- Public site checked in Chrome with a fresh profile: assets load, no console or network errors, Company Jobs opens, and the production build has no debug drawer.
- Five consecutive Company Jobs: 9,960 cr final balance, +3,960 net, 4 completed / 5 resolved, 1 failure, 9 delivered crates.
- Failed flight: ACCEPTED 0/2, LOADED 2, cost retained, zero delivered crates counted.
- Reload records one interruption; a second reload adds nothing. A second tab is read-only during a live flight and cannot interrupt it.
- Not tested: Safari/Firefox, a real process crash, a true same-millisecond launch race.

## Limitations

- **Single fictional profile.** The Balanced profile has six quantized release-speed detents; it is not a real mission design.
- **Browser-local company state.** `localStorage` is not a server account and gives no server-grade anti-cheat. An interrupted paid flight loses its cost.
- **Schematic visuals.** Earth and Moon are enlarged and the path is clipped at visual bodies; physical positions and outcomes are unchanged. Textures are original procedural Canvas art.
- **Static two-center model.** The Moon is fixed; Earth rotation, lunar motion, solar gravity, atmosphere, ascent, guidance and landing are omitted.

## AI usage

See [`docs/AI_USAGE.md`](docs/AI_USAGE.md) and [`docs/ai-usage.json`](docs/ai-usage.json).
