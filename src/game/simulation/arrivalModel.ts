export interface ReceptionInput {
  relativeSpeedKms: number
  availableBrakeKms: number
  maxArrivalSpeedKms: number
  dockingSpeedKms: number
}

export type ReceptionDecision =
  | {
      accepted: true
      brakeUsedKms: number
      brakeRemainingKms: number
    }
  | {
      accepted: false
      kind: 'arrival-too-fast' | 'insufficient-braking'
      brakeUsedKms: number
      brakeRemainingKms: number
    }

/**
 * Discrete terminal-braking approximation. The capsule must already be inside the
 * reception zone. Braking is a single modeled retrograde burn that nulls relative
 * speed down to the docking threshold. Proximity alone never counts.
 */
export function evaluateReception(input: ReceptionInput): ReceptionDecision {
  const requiredBrakeKms = Math.max(0, input.relativeSpeedKms - input.dockingSpeedKms)
  if (input.relativeSpeedKms > input.maxArrivalSpeedKms) {
    return {
      accepted: false,
      kind: 'arrival-too-fast',
      brakeUsedKms: 0,
      brakeRemainingKms: input.availableBrakeKms,
    }
  }
  if (requiredBrakeKms > input.availableBrakeKms + 1e-9) {
    return {
      accepted: false,
      kind: 'insufficient-braking',
      brakeUsedKms: input.availableBrakeKms,
      brakeRemainingKms: 0,
    }
  }
  return {
    accepted: true,
    brakeUsedKms: requiredBrakeKms,
    brakeRemainingKms: input.availableBrakeKms - requiredBrakeKms,
  }
}
