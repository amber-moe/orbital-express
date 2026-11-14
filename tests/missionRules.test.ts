import { describe, expect, it } from 'vitest'
import { gameData, loadGameData } from '../src/game/data'
import { MissionController } from '../src/game/missionController'
import {
  computeTotals,
  defaultConfig,
  initialResources,
  validateConfig,
} from '../src/game/rules/configRules'

function runToResult(controller: MissionController): void {
  for (let i = 0; i < 3000; i += 1) {
    controller.tick(0.1)
    if (controller.getSnapshot().phase === 'RESULT') return
  }
  throw new Error('mission did not finish')
}

describe('mission data', () => {
  it('loads and validates every supplied JSON file', () => {
    const data = loadGameData()
    expect(data.contracts['first-delivery']?.name).toBe('First Delivery')
    expect(data.cargo['construction-supplies']?.stock).toBe(3)
    expect(data.profiles['balanced']?.status).toBe('verified')
    expect(data.physicalConstants.earth.muKm3S2).toBeCloseTo(398600.435507, 6)
    expect(data.physicalConstants.moon.muKm3S2).toBeCloseTo(4902.800118, 6)
  })
})

describe('resource rules', () => {
  it('charges a launch exactly once even if Launch is clicked twice', () => {
    const controller = new MissionController(gameData)
    const before = controller.getSnapshot()
    expect(controller.launch()).toBe(true)
    const afterFirst = controller.getSnapshot()
    expect(controller.launch()).toBe(false)
    const afterSecond = controller.getSnapshot()
    expect(afterFirst.resources.credits).toBeCloseTo(
      before.resources.credits - before.totals.launchCredits,
      9,
    )
    expect(afterSecond.resources.credits).toBe(afterFirst.resources.credits)
    expect(afterFirst.resources.energyGj).toBeCloseTo(
      before.resources.energyGj - before.totals.rotorEnergyGj,
      9,
    )
    expect(afterFirst.resources.stock).toBe(1)
  })

  it('settles the reward once and then allows a retry with reset resources', () => {
    const controller = new MissionController(gameData)
    const initial = controller.getSnapshot()
    expect(controller.launch()).toBe(true)
    runToResult(controller)
    const finished = controller.getSnapshot()
    expect(finished.phase).toBe('RESULT')
    expect(finished.result?.kind).toBe('delivered')
    expect(finished.contractComplete).toBe(true)
    const expectedCredits =
      initial.resources.credits -
      initial.totals.launchCredits +
      (gameData.contracts['first-delivery']?.rewardCredits ?? 0)
    expect(finished.resources.credits).toBeCloseTo(expectedCredits, 6)

    controller.tick(0.1)
    expect(controller.getSnapshot().resources.credits).toBeCloseTo(expectedCredits, 6)

    expect(controller.retry()).toBe(true)
    const retried = controller.getSnapshot()
    expect(retried.phase).toBe('CONFIGURING')
    expect(retried.result).toBeNull()
    expect(retried.resources.credits).toBe(initial.resources.credits)
    expect(retried.resources.energyGj).toBe(initial.resources.energyGj)
    expect(retried.resources.stock).toBe(initial.resources.stock)
    expect(controller.getFrameState().trailPoints.length).toBe(0)
  })

  it('locks the configuration during flight', () => {
    const controller = new MissionController(gameData)
    expect(controller.launch()).toBe(true)
    expect(controller.setConfig({ quantity: 1 })).toBe(false)
  })

  it('caches predictions for discrete configurations', () => {
    const controller = new MissionController(gameData)
    const first = controller.getSnapshot()
    expect(first.predictionComputeCount).toBe(1)
    controller.setConfig({ quantity: 1 })
    expect(controller.getSnapshot().predictionComputeCount).toBe(2)
    controller.setConfig({ quantity: 2 })
    const cached = controller.getSnapshot()
    expect(cached.predictionCacheHits).toBe(1)
    expect(cached.predictionComputeCount).toBe(2)
  })
})

describe('validation rules', () => {
  it('blocks an over-volume load', () => {
    const config = { ...defaultConfig(gameData), moduleId: 'large' as const }
    const totals = computeTotals(config, gameData)
    const contract = gameData.contracts['first-delivery']
    expect(contract).toBeDefined()
    if (!contract) return
    const resources = initialResources(
      contract,
      gameData.cargo['construction-supplies']!,
    )
    const overfull = { ...totals, totalVolume: totals.maxVolume + 0.1 }
    const validation = validateConfig(config, overfull, resources, gameData)
    expect(validation.ok).toBe(false)
    expect(validation.blockers.join(' ')).toContain('Capsule volume')
  })

  it('blocks a launch that exceeds the remaining energy budget', () => {
    const config = defaultConfig(gameData)
    const totals = computeTotals(config, gameData)
    const contract = gameData.contracts['first-delivery']!
    const resources = initialResources(contract, gameData.cargo['construction-supplies']!)
    const validation = validateConfig(
      config,
      totals,
      { ...resources, energyGj: totals.rotorEnergyGj - 0.01 },
      gameData,
    )
    expect(validation.ok).toBe(false)
    expect(validation.blockers.join(' ')).toContain('GJ')
  })

  it('warns when the load is below the contract quantity', () => {
    const config = { ...defaultConfig(gameData), quantity: 1 as const }
    const totals = computeTotals(config, gameData)
    const contract = gameData.contracts['first-delivery']!
    const resources = initialResources(contract, gameData.cargo['construction-supplies']!)
    const validation = validateConfig(config, totals, resources, gameData)
    expect(validation.ok).toBe(true)
    expect(validation.warnings.join(' ')).toContain('required by the contract')
  })
})
