import { describe, expect, it } from 'vitest'
import { gameData } from '../src/game/data'
import { evaluateReadiness } from '../src/game/readiness'
import {
  computeTotals,
  defaultConfig,
  initialResources,
  predictMission,
  validateConfig,
} from '../src/game/rules/configRules'
import type { MissionConfig } from '../src/game/types'

function readinessFor(overrides: Partial<MissionConfig>) {
  const config = { ...defaultConfig(gameData), ...overrides }
  const contract = gameData.contracts['first-delivery']!
  const cargo = gameData.cargo['construction-supplies']!
  const resources = initialResources(contract, cargo)
  const totals = computeTotals(config, gameData)
  const validation = validateConfig(config, totals, resources, gameData)
  const prediction = validation.ok ? predictMission(config, gameData, totals) : null
  const readiness = evaluateReadiness({
    validation,
    totals,
    prediction: prediction
      ? {
          outcomeKind: prediction.outcome.kind,
          timeSeconds: prediction.outcome.timeSeconds,
          relativeSpeedKms: prediction.outcome.relativeSpeedKms,
          requiredBrakeKms: prediction.outcome.requiredBrakeKms,
          brakeRemainingKms: prediction.outcome.brakeRemainingKms,
          deliveredQuantity: prediction.outcome.deliveredQuantity,
          requiredQuantity: prediction.outcome.requiredQuantity,
          pointCount: prediction.points.length,
          computeMs: prediction.computeMs,
        }
      : null,
    contract,
    quantity: config.quantity,
    energyAvailableGj: resources.energyGj,
    releaseSpeedScale: config.releaseSpeedScale,
  })
  return { readiness, totals }
}

describe('prelaunch readiness', () => {
  it('reports the validated default as ready without revealing the terminal delivery', () => {
    const { readiness } = readinessFor({})
    expect(readiness.tone).toBe('ok')
    expect(readiness.title).toBe('Ready for launch')
    expect(readiness.blocked).toBe(false)
    expect(readiness.predictedOutcome).toBe('delivered')
    expect(`${readiness.title} ${readiness.detail}`).not.toContain('Delivered')
    const trajectory = readiness.checks.find((check) => check.label === 'Trajectory')
    expect(trajectory?.state).toBe('ok')
    expect(trajectory?.value).toBe('zone reachable')
  })

  it('flags a doomed braking configuration instead of marking it safe', () => {
    const { readiness } = readinessFor({ moduleId: 'small' })
    expect(readiness.tone).toBe('bad')
    expect(readiness.title).toBe('Flight risk')
    expect(readiness.blocked).toBe(false)
    expect(readiness.detail.toLowerCase()).toContain('braking')
    expect(readiness.predictedOutcome).toBe('insufficient-braking')
    expect(readiness.checks.find((check) => check.label === 'Brake reserve')?.state).toBe('bad')
  })

  it('keeps hard launch blockers explicit', () => {
    const { readiness } = readinessFor({ protectionId: 'standard' })
    expect(readiness.blocked).toBe(true)
    expect(readiness.tone).toBe('bad')
    expect(readiness.title).toBe('Launch blocked')
    expect(readiness.detail).toContain('Rotor load')
  })

  it('warns about a contract shortfall while leaving launch possible', () => {
    const { readiness } = readinessFor({ quantity: 1 })
    expect(readiness.tone).toBe('warn')
    expect(readiness.title).toBe('Contract shortfall risk')
    expect(readiness.blocked).toBe(false)
    expect(readiness.checks.find((check) => check.label === 'Contract load')?.state).toBe('warn')
  })
})
