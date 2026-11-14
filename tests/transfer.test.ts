import { describe, expect, it } from 'vitest'
import { gameData } from '../src/game/data'
import { MissionController } from '../src/game/missionController'
import {
  buildTransferContext,
  computeTotals,
  defaultConfig,
  predictMission,
} from '../src/game/rules/configRules'
import { buildDepartureState } from '../src/game/simulation/departureModel'
import { runTransfer } from '../src/game/simulation/transferSimulator'
import type { MissionConfig } from '../src/game/types'

function configure(overrides: Partial<MissionConfig>): MissionConfig {
  return { ...defaultConfig(gameData), ...overrides }
}

function runWithTimestep(config: MissionConfig, dt: number) {
  const totals = computeTotals(config, gameData)
  const profile = gameData.profiles[config.profileId]
  expect(profile).toBeDefined()
  if (!profile) throw new Error('missing profile')
  const departure = buildDepartureState(
    profile,
    totals.totalMassKg,
    gameData.physicalConstants.earth.radiusKm,
    gameData.assumptions,
  )
  const context = buildTransferContext(config, gameData, totals)
  return runTransfer(departure, context, dt, 60)
}

describe('validated Earth-to-Moon transfer', () => {
  it('delivers the default two-crate, reinforced, Large-module load', () => {
    const config = defaultConfig(gameData)
    const totals = computeTotals(config, gameData)
    const prediction = predictMission(config, gameData, totals)
    expect(prediction.outcome.kind).toBe('delivered')
    expect(prediction.outcome.relativeSpeedKms).not.toBeNull()
    expect(prediction.outcome.relativeSpeedKms ?? 0).toBeGreaterThan(0.8)
    expect(prediction.outcome.relativeSpeedKms ?? 0).toBeLessThan(1.0)
    expect(prediction.outcome.timeSeconds / 86400).toBeGreaterThan(3.4)
    expect(prediction.outcome.timeSeconds / 86400).toBeLessThan(3.8)
    expect(prediction.outcome.brakeRemainingKms).toBeGreaterThan(1.2)
    expect(prediction.points.length).toBeGreaterThan(1000)
  })

  it('arrives at the same terminal event when the timestep is halved', () => {
    const config = defaultConfig(gameData)
    const coarse = runWithTimestep(config, 4)
    const fine = runWithTimestep(config, 2)
    expect(coarse.outcome.kind).toBe('delivered')
    expect(fine.outcome.kind).toBe('delivered')
    expect(fine.outcome.relativeSpeedKms).not.toBeNull()
    expect(coarse.outcome.relativeSpeedKms).not.toBeNull()
    expect(
      Math.abs((fine.outcome.relativeSpeedKms ?? 0) - (coarse.outcome.relativeSpeedKms ?? 0)),
    ).toBeLessThan(0.002)
    expect(Math.abs(fine.outcome.timeSeconds - coarse.outcome.timeSeconds)).toBeLessThan(60)
    expect(
      Math.abs(
        (fine.outcome.brakeRemainingKms ?? 0) - (coarse.outcome.brakeRemainingKms ?? 0),
      ),
    ).toBeLessThan(0.005)
  })

  it('also converges at an even coarser step and keeps the delivery result', () => {
    const config = defaultConfig(gameData)
    const coarse = runWithTimestep(config, 8)
    expect(coarse.outcome.kind).toBe('delivered')
    expect(coarse.outcome.relativeSpeedKms ?? 0).toBeGreaterThan(0.9)
    expect(coarse.outcome.relativeSpeedKms ?? 0).toBeLessThan(0.96)
  })

  it('matches prediction and live flight exactly at the terminal event', () => {
    const controller = new MissionController(gameData)
    const prediction = controller.getPrediction()
    expect(prediction).not.toBeNull()
    if (!prediction) return
    expect(controller.launch()).toBe(true)
    for (let i = 0; i < 2000; i += 1) {
      controller.tick(0.1)
      if (controller.getSnapshot().phase === 'RESULT') break
    }
    const snapshot = controller.getSnapshot()
    expect(snapshot.phase).toBe('RESULT')
    expect(snapshot.result).not.toBeNull()
    if (!snapshot.result) return
    expect(snapshot.result.kind).toBe(prediction.outcome.kind)
    expect(snapshot.result.timeSeconds).toBeCloseTo(prediction.outcome.timeSeconds, 6)
    expect(snapshot.result.relativeSpeedKms).toBeCloseTo(
      prediction.outcome.relativeSpeedKms ?? -1,
      9,
    )
    expect(snapshot.result.positionKm.x).toBeCloseTo(prediction.outcome.positionKm.x, 6)
    expect(snapshot.result.positionKm.y).toBeCloseTo(prediction.outcome.positionKm.y, 6)
  })

  it('fails with a clear reason when the Small braking module cannot null the encounter', () => {
    const config = configure({ moduleId: 'small' })
    const totals = computeTotals(config, gameData)
    const prediction = predictMission(config, gameData, totals)
    expect(prediction.outcome.kind).toBe('insufficient-braking')
    expect(prediction.outcome.requiredBrakeKms ?? 0).toBeGreaterThan(
      prediction.outcome.brakeRemainingKms,
    )
  })

  it('flags a partial load as a contract shortfall after a valid reception', () => {
    const config = configure({ quantity: 1 })
    const totals = computeTotals(config, gameData)
    const prediction = predictMission(config, gameData, totals)
    expect(prediction.outcome.kind).toBe('contract-shortfall')
    expect(prediction.outcome.deliveredQuantity).toBe(1)
    expect(prediction.outcome.requiredQuantity).toBe(2)
    expect(prediction.outcome.brakeRemainingKms).toBeGreaterThan(0)
  })

  it('rejects arbitrary weak departures instead of turning them into success', () => {
    const config = defaultConfig(gameData)
    const totals = computeTotals(config, gameData)
    const profile = gameData.profiles[config.profileId]!
    const departure = buildDepartureState(
      profile,
      totals.totalMassKg,
      gameData.physicalConstants.earth.radiusKm,
      gameData.assumptions,
    )
    const weak = {
      ...departure,
      velocityKms: {
        x: departure.velocityKms.x * 0.98,
        y: departure.velocityKms.y * 0.98,
      },
    }
    const context = buildTransferContext(config, gameData, totals)
    const run = runTransfer(weak, context, 4, 120)
    expect(run.outcome.kind).toBe('missed-moon')
    expect(run.outcome.closestApproachKm).toBeGreaterThan(100000)
  })

  it('rejects Standard protection at the rotor load limit', () => {
    const controller = new MissionController(gameData)
    controller.setConfig({ protectionId: 'standard' })
    const snapshot = controller.getSnapshot()
    expect(snapshot.validation.ok).toBe(false)
    expect(snapshot.validation.blockers.join(' ')).toContain('Rotor load')
    expect(controller.launch()).toBe(false)
  })
})
