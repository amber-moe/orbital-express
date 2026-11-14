import { describe, expect, it } from 'vitest'
import { gameData } from '../src/game/data'
import {
  buildBodies,
  buildTransferContext,
  computeTotals,
  defaultConfig,
  predictMission,
} from '../src/game/rules/configRules'
import { buildDepartureState, computeCentrifuge } from '../src/game/simulation/departureModel'
import {
  STANDARD_GRAVITY_MPS2,
  gravityAcceleration,
  segmentCircleIntersection,
  velocityVerletStep,
} from '../src/game/simulation/physics'
import {
  createTransferState,
  runTransfer,
  stepTransfer,
  type TransferContext,
} from '../src/game/simulation/transferSimulator'

describe('gravity and units', () => {
  it('uses inverse-square acceleration with the documented Earth and Moon parameters', () => {
    const bodies = buildBodies(gameData)
    const acceleration = gravityAcceleration(7000, 0, bodies)
    const earth = gameData.physicalConstants.earth
    const moon = gameData.physicalConstants.moon
    const distanceEarthMoon = gameData.physicalConstants.earthMoonMeanDistanceKm

    const expectedEarth = -earth.muKm3S2 / (7000 * 7000)
    const moonDelta = 7000 - distanceEarthMoon
    const expectedMoon =
      (-moon.muKm3S2 * moonDelta) / Math.abs(moonDelta) ** 3
    expect(acceleration.x).toBeCloseTo(expectedEarth + expectedMoon, 12)
    expect(acceleration.y).toBeCloseTo(0, 18)
    expect(acceleration.x).toBeLessThan(0)
  })

  it('points acceleration toward each body', () => {
    const bodies = buildBodies(gameData)
    const aboveEarth = gravityAcceleration(0, 10000, bodies)
    expect(aboveEarth.y).toBeLessThan(0)
    const nearMoon = gravityAcceleration(
      gameData.physicalConstants.moonPositionKm.x,
      gameData.physicalConstants.moonPositionKm.y + 5000,
      bodies,
    )
    expect(nearMoon.y).toBeLessThan(0)
  })

  it('converts the centrifuge from metres to km/s and reports g-load correctly', () => {
    const profile = gameData.profiles['balanced']
    expect(profile).toBeDefined()
    if (!profile) return
    const result = computeCentrifuge(profile, 800, gameData.assumptions)
    expect(result.releaseSpeedKms).toBeCloseTo(1.0, 12)
    const speedMps = profile.rotorAngularSpeedRadps * profile.rotorRadiusM
    expect(result.launchLoadG).toBeCloseTo(
      speedMps * speedMps / profile.rotorRadiusM / STANDARD_GRAVITY_MPS2,
      12,
    )
    const expectedEnergyGj =
      (800 * speedMps * speedMps) / (2 * gameData.assumptions.launcher.efficiency) / 1e9 +
      gameData.assumptions.launcher.fixedCycleLossGj
    expect(result.rotorEnergyGj).toBeCloseTo(expectedEnergyGj, 10)
  })

  it('keeps an unpowered vacuum path independent of cargo mass', () => {
    const config = defaultConfig(gameData)
    const light = { ...config, quantity: 1 as const }
    const heavy = { ...config, quantity: 3 as const }
    const lightPrediction = predictMission(
      light,
      gameData,
      computeTotals(light, gameData),
    )
    const heavyPrediction = predictMission(
      heavy,
      gameData,
      computeTotals(heavy, gameData),
    )
    expect(lightPrediction.points.length).toBeGreaterThan(100)
    expect(lightPrediction.points.length).toBe(heavyPrediction.points.length)
    for (let index = 0; index < lightPrediction.points.length; index += 97) {
      const a = lightPrediction.points[index]
      const b = heavyPrediction.points[index]
      expect(a).toBeDefined()
      expect(b).toBeDefined()
      if (a && b) {
        expect(a.x).toBeCloseTo(b.x, 9)
        expect(a.y).toBeCloseTo(b.y, 9)
      }
    }
  })
})

describe('swept intersections', () => {
  it('finds the entry point of a chord and rejects a miss', () => {
    expect(
      segmentCircleIntersection({ x: -10, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 0 }, 2),
    ).toBeCloseTo(0.4, 12)
    expect(
      segmentCircleIntersection({ x: -10, y: 3 }, { x: 10, y: 3 }, { x: 0, y: 0 }, 2),
    ).toBeNull()
    expect(
      segmentCircleIntersection({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 0 }, 2),
    ).toBe(0)
  })

  it('cannot tunnel through the lunar reception boundary in a large step', () => {
    const departure = buildDepartureState(
      gameData.profiles['balanced']!,
      800,
      gameData.physicalConstants.earth.radiusKm,
      gameData.assumptions,
    )
    const config = defaultConfig(gameData)
    const context = buildTransferContext(config, gameData, computeTotals(config, gameData))
    const state = createTransferState(departure, context)
    state.positionKm.x = gameData.physicalConstants.moonPositionKm.x - 20000
    state.positionKm.y = 0
    state.velocityKms.x = 20
    state.velocityKms.y = 0
    const result = stepTransfer(state, context, 5000)
    expect(result.done).toBe(true)
    expect(result.outcome?.kind).toBe('arrival-too-fast')
    expect(result.entry).not.toBeNull()
    expect(result.entry?.positionKm.x).toBeLessThan(
      gameData.physicalConstants.moonPositionKm.x,
    )
  })

  it('detects a lunar surface impact when the reception zone is not reached', () => {
    const departure = buildDepartureState(
      gameData.profiles['balanced']!,
      800,
      gameData.physicalConstants.earth.radiusKm,
      gameData.assumptions,
    )
    const base = buildTransferContext(
      defaultConfig(gameData),
      gameData,
      computeTotals(defaultConfig(gameData), gameData),
    )
    const context: TransferContext = { ...base, zoneRadiusKm: 0.1 }
    const state = createTransferState(departure, context)
    state.positionKm.x = gameData.physicalConstants.moonPositionKm.x - 10000
    state.positionKm.y = 0
    state.velocityKms.x = 20
    state.velocityKms.y = 0
    const result = stepTransfer(state, context, 5000)
    expect(result.done).toBe(true)
    expect(result.outcome?.kind).toBe('moon-impact')
  })

  it('detects an Earth impact instead of integrating through the surface', () => {
    const config = defaultConfig(gameData)
    const context = buildTransferContext(config, gameData, computeTotals(config, gameData))
    const departure = buildDepartureState(
      gameData.profiles['balanced']!,
      800,
      gameData.physicalConstants.earth.radiusKm,
      gameData.assumptions,
    )
    const suborbital = {
      ...departure,
      positionKm: { x: 7000, y: 0 },
      velocityKms: { x: -1, y: 0 },
    }
    const run = runTransfer(suborbital, context, 4, 60)
    expect(run.outcome.kind).toBe('earth-impact')
    expect(run.outcome.impactSpeedKms).not.toBeNull()
  })
})

describe('velocity Verlet', () => {
  it('preserves a circular orbit energy over a short integration window', () => {
    const earth = buildBodies(gameData)[0]
    expect(earth).toBeDefined()
    if (!earth) return
    const radius = 10000
    const speed = Math.sqrt(earth.muKm3S2 / radius)
    const position = { x: radius, y: 0 }
    const velocity = { x: 0, y: speed }
    const energy = speed * speed / 2 - earth.muKm3S2 / radius
    for (let i = 0; i < 2000; i += 1) {
      velocityVerletStep(position, velocity, [earth], 2)
    }
    const finalEnergy =
      (velocity.x * velocity.x + velocity.y * velocity.y) / 2 -
      earth.muKm3S2 / Math.hypot(position.x, position.y)
    expect(Math.abs(finalEnergy - energy)).toBeLessThan(1e-9)
  })
})
