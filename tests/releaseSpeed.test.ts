import { describe, expect, it } from 'vitest'
import { gameData } from '../src/game/data'
import { MissionController } from '../src/game/missionController'
import { evaluateReadiness } from '../src/game/readiness'
import {
  RELEASE_SPEED_SCALE_DETENTS,
  quantizeReleaseSpeedScale,
  resolveEffectiveProfile,
} from '../src/game/releaseSpeed'
import {
  computeTotals,
  configKey,
  defaultConfig,
  initialResources,
  predictMission,
  validateConfig,
} from '../src/game/rules/configRules'
import { buildDepartureState } from '../src/game/simulation/departureModel'
import type { MissionConfig, OutcomeKind } from '../src/game/types'

function configure(overrides: Partial<MissionConfig>): MissionConfig {
  return { ...defaultConfig(gameData), ...overrides }
}

function runToResult(controller: MissionController): void {
  for (let index = 0; index < 3000; index += 1) {
    controller.tick(0.1)
    if (controller.getSnapshot().phase === 'RESULT') return
  }
  throw new Error('mission did not finish')
}

function outcomeAt(scale: number): OutcomeKind {
  const config = configure({ releaseSpeedScale: scale })
  const totals = computeTotals(config, gameData)
  return predictMission(config, gameData, totals).outcome.kind
}

describe('release-speed control', () => {
  it('keeps the verified default on the known delivered route', () => {
    const config = defaultConfig(gameData)
    expect(config.releaseSpeedScale).toBe(1)
    const totals = computeTotals(config, gameData)
    const prediction = predictMission(config, gameData, totals)
    expect(prediction.outcome.kind).toBe('delivered')
    expect(totals.releaseSpeedKms).toBeCloseTo(1, 9)
    expect(totals.releaseSpeedKms + totals.ascentRequiredKms).toBeCloseTo(10.923817, 5)
    expect(totals.launchLoadG).toBeCloseTo(50.9858, 3)
    expect(totals.rotorEnergyGj).toBeCloseTo(0.877258, 5)
  })

  it('quantizes edge values onto the finite detents', () => {
    expect(quantizeReleaseSpeedScale(0.979)).toBe(0.98)
    expect(quantizeReleaseSpeedScale(1.002)).toBe(1)
    expect(quantizeReleaseSpeedScale(1.003)).toBe(1)
    expect(quantizeReleaseSpeedScale(1.006)).toBe(1.01)
  })

  it('produces understandable failures on both sides of the usable window', () => {
    expect(outcomeAt(0.97)).toBe('earth-impact')
    expect(outcomeAt(1.01)).toBe('missed-moon')
    expect(outcomeAt(1.02)).toBe('missed-moon')
    for (const scale of RELEASE_SPEED_SCALE_DETENTS) {
      const config = configure({ releaseSpeedScale: scale })
      const totals = computeTotals(config, gameData)
      const prediction = predictMission(config, gameData, totals)
      expect(prediction.outcome.kind).toBe(
        scale === 0.97
          ? 'earth-impact'
          : scale >= 1.01
            ? 'missed-moon'
            : 'delivered',
      )
    }
  })

  it('changes departure velocity, load and energy without rotating the release vector', () => {
    const defaultConfigValue = defaultConfig(gameData)
    const high = configure({ releaseSpeedScale: 1.02 })
    const defaultTotals = computeTotals(defaultConfigValue, gameData)
    const highTotals = computeTotals(high, gameData)
    const baseProfile = gameData.profiles[defaultConfigValue.profileId]!

    const lowDeparture = buildDepartureState(
      resolveEffectiveProfile(baseProfile, 1),
      defaultTotals.totalMassKg,
      gameData.physicalConstants.earth.radiusKm,
      gameData.assumptions,
    )
    const highDeparture = buildDepartureState(
      resolveEffectiveProfile(baseProfile, 1.02),
      highTotals.totalMassKg,
      gameData.physicalConstants.earth.radiusKm,
      gameData.assumptions,
    )

    const lowSpeed = Math.hypot(lowDeparture.velocityKms.x, lowDeparture.velocityKms.y)
    const highSpeed = Math.hypot(highDeparture.velocityKms.x, highDeparture.velocityKms.y)
    expect(highSpeed - lowSpeed).toBeCloseTo(0.02, 6)
    expect(highDeparture.releaseSpeedKms).toBeCloseTo(1.02, 9)
    expect(highTotals.launchLoadG / defaultTotals.launchLoadG).toBeCloseTo(1.02 * 1.02, 6)
    expect(highTotals.rotorEnergyGj).toBeGreaterThan(defaultTotals.rotorEnergyGj)
    expect(highTotals.rotorRpm).toBeGreaterThan(defaultTotals.rotorRpm)

    // Fixed assisted ascent, fixed direction: only magnitude changes.
    const lowAngle = Math.atan2(lowDeparture.velocityKms.y, lowDeparture.velocityKms.x)
    const highAngle = Math.atan2(highDeparture.velocityKms.y, highDeparture.velocityKms.x)
    expect(highAngle).toBeCloseTo(lowAngle, 9)
  })

  it('separates cache keys and quantizes accepted values', () => {
    const controller = new MissionController(gameData)
    const initial = controller.getSnapshot()
    expect(initial.predictionComputeCount).toBe(1)

    expect(controller.setConfig({ releaseSpeedScale: 0.98 })).toBe(true)
    const changed = controller.getSnapshot()
    expect(changed.config.releaseSpeedScale).toBe(0.98)
    expect(configKey(changed.config)).not.toBe(configKey(initial.config))
    expect(changed.predictionComputeCount).toBe(2)

    expect(controller.setConfig({ releaseSpeedScale: 1 })).toBe(true)
    const cached = controller.getSnapshot()
    expect(cached.predictionComputeCount).toBe(2)
    expect(cached.predictionCacheHits).toBe(1)
  })

  it('quantizes fractional input to the finite detents', () => {
    expect(quantizeReleaseSpeedScale(1.004)).toBe(1)
    expect(quantizeReleaseSpeedScale(1.006)).toBe(1.01)
    expect(quantizeReleaseSpeedScale(0.5)).toBe(0.97)
    expect(quantizeReleaseSpeedScale(2)).toBe(1.02)

    const controller = new MissionController(gameData)
    expect(controller.setConfig({ releaseSpeedScale: 1.006 })).toBe(true)
    expect(controller.getSnapshot().config.releaseSpeedScale).toBe(1.01)
  })

  it('bounds the prediction cache and evicts the oldest keys', () => {
    const controller = new MissionController(gameData)
    const combos: Partial<MissionConfig>[] = []
    for (const releaseSpeedScale of RELEASE_SPEED_SCALE_DETENTS) {
      for (const quantity of [1, 2, 3] as const) {
        for (const moduleId of ['small', 'large'] as const) {
          for (const protectionId of ['standard', 'reinforced'] as const) {
            if (
              releaseSpeedScale === 1 &&
              quantity === 2 &&
              moduleId === 'large' &&
              protectionId === 'reinforced'
            ) {
              continue
            }
            combos.push({ releaseSpeedScale, quantity, moduleId, protectionId })
          }
        }
      }
    }

    let applied = 0
    for (const combo of combos) {
      if (controller.setConfig(combo)) applied += 1
      if (applied >= 49) break
    }
    expect(applied).toBe(49)

    const beforeReturn = controller.getSnapshot()
    expect(
      controller.setConfig({
        releaseSpeedScale: 1,
        quantity: 2,
        moduleId: 'large',
        protectionId: 'reinforced',
      }),
    ).toBe(true)
    const afterReturn = controller.getSnapshot()
    // The original default key was inserted first and must have been evicted
    // by the 48-entry cap, so returning to it recomputes instead of hitting.
    expect(afterReturn.predictionComputeCount).toBe(beforeReturn.predictionComputeCount + 1)
    expect(afterReturn.predictionCacheHits).toBe(beforeReturn.predictionCacheHits)
  })

  it('matches preview and live flight at a non-default speed', () => {
    const controller = new MissionController(gameData, null, configure({ releaseSpeedScale: 0.98 }))
    const prediction = controller.getPrediction()
    expect(prediction).not.toBeNull()
    if (!prediction) return
    expect(prediction.outcome.kind).toBe('delivered')
    expect(controller.launch()).toBe(true)
    runToResult(controller)
    const result = controller.getSnapshot().result
    expect(result?.kind).toBe(prediction.outcome.kind)
    expect(result?.timeSeconds).toBeCloseTo(prediction.outcome.timeSeconds, 6)
    expect(result?.relativeSpeedKms ?? 0).toBeCloseTo(
      prediction.outcome.relativeSpeedKms ?? 0,
      9,
    )
  })

  it('matches preview and live flight for a speed-induced failure', () => {
    const controller = new MissionController(gameData, null, configure({ releaseSpeedScale: 1.01 }))
    const prediction = controller.getPrediction()
    expect(prediction?.outcome.kind).toBe('missed-moon')
    expect(controller.launch()).toBe(true)
    let sawApproach = false
    for (let index = 0; index < 3000; index += 1) {
      controller.tick(0.1)
      if (controller.getSnapshot().phase === 'APPROACH') sawApproach = true
      if (controller.getSnapshot().phase === 'RESULT') break
    }
    expect(sawApproach).toBe(false)
    expect(controller.getSnapshot().result?.kind).toBe('missed-moon')
  })

  it('retains the release speed across retry and resets resources', () => {
    const controller = new MissionController(gameData, null, configure({ releaseSpeedScale: 0.98 }))
    const initial = controller.getSnapshot()
    expect(controller.launch()).toBe(true)
    runToResult(controller)
    expect(controller.getSnapshot().result?.kind).toBe('delivered')
    expect(controller.retry()).toBe(true)
    const retried = controller.getSnapshot()
    expect(retried.phase).toBe('CONFIGURING')
    expect(retried.config.releaseSpeedScale).toBe(0.98)
    expect(retried.resources.credits).toBe(initial.resources.credits)
    expect(retried.resources.energyGj).toBe(initial.resources.energyGj)
    expect(retried.resources.stock).toBe(initial.resources.stock)
    expect(retried.prediction?.outcomeKind).toBe('delivered')
  })

  it('blocks unsupported release-speed values and keeps hard load limits', () => {
    const contract = gameData.contracts['first-delivery']!
    const cargo = gameData.cargo['construction-supplies']!
    const resources = initialResources(contract, cargo)

    const outOfRange = configure({ releaseSpeedScale: 1.5 })
    const outTotals = computeTotals(outOfRange, gameData)
    const outValidation = validateConfig(outOfRange, outTotals, resources, gameData)
    expect(outValidation.ok).toBe(false)
    expect(outValidation.blockers.join(' ')).toContain('release-speed')

    const fastStandard = configure({ releaseSpeedScale: 1.02, protectionId: 'standard' })
    const fastTotals = computeTotals(fastStandard, gameData)
    const fastValidation = validateConfig(fastStandard, fastTotals, resources, gameData)
    expect(fastValidation.ok).toBe(false)
    expect(fastValidation.blockers.join(' ')).toContain('Rotor load')
  })

  it('reports a speed-induced failure as flight risk without naming a direction to change', () => {
    const config = configure({ releaseSpeedScale: 1.01 })
    const contract = gameData.contracts['first-delivery']!
    const cargo = gameData.cargo['construction-supplies']!
    const resources = initialResources(contract, cargo)
    const totals = computeTotals(config, gameData)
    const validation = validateConfig(config, totals, resources, gameData)
    const prediction = predictMission(config, gameData, totals)
    const readiness = evaluateReadiness({
      validation,
      totals,
      prediction: {
        outcomeKind: prediction.outcome.kind,
        timeSeconds: prediction.outcome.timeSeconds,
        relativeSpeedKms: prediction.outcome.relativeSpeedKms,
        requiredBrakeKms: prediction.outcome.requiredBrakeKms,
        brakeRemainingKms: prediction.outcome.brakeRemainingKms,
        deliveredQuantity: prediction.outcome.deliveredQuantity,
        requiredQuantity: prediction.outcome.requiredQuantity,
        pointCount: prediction.points.length,
        computeMs: prediction.computeMs,
      },
      contract,
      quantity: config.quantity,
      energyAvailableGj: resources.energyGj,
      releaseSpeedScale: config.releaseSpeedScale,
    })
    expect(readiness.tone).toBe('bad')
    expect(readiness.title).toBe('Flight risk')
    expect(readiness.detail).toContain('101%')
    expect(readiness.detail.toLowerCase()).not.toContain('increase')
    expect(readiness.detail.toLowerCase()).not.toContain('decrease')
  })
})
