import { describe, expect, it } from 'vitest'
import { gameData } from '../src/game/data'
import { describeOutcome } from '../src/game/outcomeMessages'
import type { Outcome, OutcomeKind } from '../src/game/types'

const contracts = Object.values(gameData.contracts)

function outcome(kind: OutcomeKind, deliveredQuantity: number, requiredQuantity: number): Outcome {
  return {
    kind,
    timeSeconds: 311000,
    positionKm: { x: 372000, y: 0 },
    relativeSpeedKms: 0.927,
    requiredBrakeKms: 0.777,
    brakeRemainingKms: 1.5,
    maxArrivalSpeedKms: 1.5,
    deliveredQuantity,
    requiredQuantity,
    closestApproachKm: 12000,
    impactSpeedKms: null,
  }
}

function context(contractId: string) {
  const contract = gameData.contracts[contractId]!
  const cargo = gameData.cargo[contract.cargoId]!
  return {
    cargoName: cargo.name,
    orderLabel: contract.orderLabel,
    destination: contract.destination.split('·').pop()!.trim(),
  }
}

describe('outcome copy', () => {
  it('uses the selected cargo, order and destination for every success', () => {
    for (const contract of contracts) {
      const ctx = context(contract.id)
      const copy = describeOutcome(
        outcome('delivered', contract.requiredQuantity, contract.requiredQuantity),
        ctx,
      )
      expect(copy.title).toBe('Delivered')
      expect(copy.detail).toContain(ctx.cargoName)
      expect(copy.detail).toContain(ctx.destination)
      expect(copy.tone).toBe('success')
    }
  })

  it('uses the selected cargo, order and destination for every shortfall', () => {
    for (const contract of contracts) {
      const ctx = context(contract.id)
      const copy = describeOutcome(outcome('contract-shortfall', 1, contract.requiredQuantity), ctx)
      expect(copy.title).toBe('Partial delivery')
      expect(copy.detail).toContain(ctx.cargoName)
      expect(copy.detail).toContain(ctx.orderLabel)
      expect(copy.detail).toContain(ctx.destination)
      expect(copy.detail).not.toContain('First Delivery')
      expect(copy.detail).not.toContain('construction supplies')
      expect(copy.tone).toBe('warning')
    }
  })

  it('keeps the physics outcome copy independent of presentation context', () => {
    const copy = describeOutcome(outcome('delivered', 2, 2))
    expect(copy.detail).toContain('the cargo')
    expect(copy.detail).toContain('The receiving depot')
  })
})
