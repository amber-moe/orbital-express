import { describe, expect, it } from 'vitest'
import { gameData } from '../src/game/data'
import {
  computeTotals,
  configForContract,
  estimateOrderCosts,
  initialResources,
  predictMission,
  validateConfig,
} from '../src/game/rules/configRules'
import type { MissionConfig } from '../src/game/types'

const contracts = Object.values(gameData.contracts)

describe('commercial order catalog', () => {
  it('has three orders with distinct cargo constraints', () => {
    expect(contracts).toHaveLength(3)
    const cargo = contracts.map((contract) => gameData.cargo[contract.cargoId]!)
    expect(new Set(cargo.map((item) => item.id)).size).toBe(3)
    expect(new Set(cargo.map((item) => item.unitMassKg)).size).toBe(3)
    expect(new Set(cargo.map((item) => item.maxLaunchLoadG)).size).toBe(3)
    expect(new Set(cargo.map((item) => item.maxArrivalSpeedKms)).size).toBe(3)
    for (const item of cargo) {
      expect(item.unitMassKg).toBeGreaterThan(0)
      expect(item.unitVolume).toBeGreaterThan(0)
      expect(item.stock).toBeGreaterThan(0)
    }
  })

  it('gives every displayed order a validated successful configuration and positive net', () => {
    for (const contract of contracts) {
      const config = configForContract(gameData, contract.id)
      const totals = computeTotals(config, gameData)
      const resources = initialResources(contract, gameData.cargo[contract.cargoId]!)
      const validation = validateConfig(config, totals, resources, gameData)
      const prediction = predictMission(config, gameData, totals)
      const estimates = estimateOrderCosts(gameData, contract.id)

      expect(validation.ok, `${contract.orderLabel} recommended config blocked`).toBe(true)
      expect(prediction.outcome.kind, `${contract.orderLabel} recommended config`).toBe('delivered')
      expect(estimates.successFrom).not.toBeNull()
      expect(estimates.successTo).not.toBeNull()
      expect(totals.launchCredits).toBeGreaterThanOrEqual(estimates.successFrom ?? 0)
      expect(totals.launchCredits).toBeLessThanOrEqual(estimates.successTo ?? 0)
      expect(estimates.launchFrom).toBeLessThanOrEqual(estimates.successFrom ?? 0)
      expect(contract.rewardCredits).toBeGreaterThan(totals.launchCredits)
    }
  })

  it('makes protection and speed choices meaningful', () => {
    const construction = gameData.contracts['first-delivery']!
    const constructionConfig: MissionConfig = {
      ...configForContract(gameData, construction.id),
      protectionId: 'standard',
      releaseSpeedScale: 1,
    }
    const constructionResources = initialResources(
      construction,
      gameData.cargo[construction.cargoId]!,
    )
    const constructionTotals = computeTotals(constructionConfig, gameData)
    const constructionValidation = validateConfig(
      constructionConfig,
      constructionTotals,
      constructionResources,
      gameData,
    )
    expect(constructionValidation.ok).toBe(false)
    expect(constructionValidation.blockers.join(' ')).toContain('Rotor load')

    const supply = gameData.contracts['supply-delivery']!
    const supplyConfig: MissionConfig = {
      ...configForContract(gameData, supply.id),
      protectionId: 'standard',
      moduleId: 'large',
      releaseSpeedScale: 1,
    }
    const supplyTotals = computeTotals(supplyConfig, gameData)
    const supplyResources = initialResources(supply, gameData.cargo[supply.cargoId]!)
    expect(validateConfig(supplyConfig, supplyTotals, supplyResources, gameData).ok).toBe(true)
    expect(predictMission(supplyConfig, gameData, supplyTotals).outcome.kind).toBe('delivered')

    const precision = gameData.contracts['precision-cargo']!
    const fast: MissionConfig = {
      ...configForContract(gameData, precision.id),
      releaseSpeedScale: 1,
    }
    const fastTotals = computeTotals(fast, gameData)
    const precisionResources = initialResources(
      precision,
      gameData.cargo[precision.cargoId]!,
    )
    expect(validateConfig(fast, fastTotals, precisionResources, gameData).ok).toBe(false)
    const slow: MissionConfig = {
      ...configForContract(gameData, precision.id),
      releaseSpeedScale: 0.98,
    }
    const slowTotals = computeTotals(slow, gameData)
    expect(validateConfig(slow, slowTotals, precisionResources, gameData).ok).toBe(true)
    expect(predictMission(slow, gameData, slowTotals).outcome.kind).toBe('delivered')
  })

  it('keeps the original construction contract and route intact', () => {
    const construction = gameData.contracts['first-delivery']!
    expect(construction.name).toBe('First Delivery')
    expect(construction.orderLabel).toBe('Construction Run')
    expect(construction.rewardCredits).toBe(3200)
    expect(construction.cargoId).toBe('construction-supplies')
  })
})
