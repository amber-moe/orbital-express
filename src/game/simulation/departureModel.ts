import type { DepartureState, LaunchProfileData, ModelAssumptionsData } from '../types'
import { STANDARD_GRAVITY_MPS2 } from './physics'

export interface CentrifugeResult {
  releaseSpeedKms: number
  launchLoadG: number
  rotorEnergyGj: number
  rotorRpm: number
}

/**
 * Fictional launcher model:
 *   v = omega * r          (m/s)
 *   a = v^2 / r            (m/s^2)
 *   E = m * v^2 / (2 * eff) + fixed cycle loss
 * The rotor radius and angular speed are game assumptions, not a real launch system.
 */
export function computeCentrifuge(
  profile: LaunchProfileData,
  totalMassKg: number,
  assumptions: ModelAssumptionsData,
): CentrifugeResult {
  const speedMps = profile.rotorAngularSpeedRadps * profile.rotorRadiusM
  const loadMps2 = (speedMps * speedMps) / profile.rotorRadiusM
  const rotorEnergyJ =
    (totalMassKg * speedMps * speedMps) / (2 * assumptions.launcher.efficiency)
  const rotorEnergyGj = rotorEnergyJ / 1e9 + assumptions.launcher.fixedCycleLossGj
  return {
    releaseSpeedKms: speedMps / 1000,
    launchLoadG: loadMps2 / STANDARD_GRAVITY_MPS2,
    rotorEnergyGj,
    rotorRpm: (profile.rotorAngularSpeedRadps * 60) / (2 * Math.PI),
  }
}

export function releaseUnitVector(profile: LaunchProfileData): { x: number; y: number } {
  const angle = (profile.releaseAngleDeg * Math.PI) / 180
  if (profile.direction === 'prograde') {
    return { x: -Math.sin(angle), y: Math.cos(angle) }
  }
  return { x: Math.sin(angle), y: -Math.cos(angle) }
}

export function surfaceReleasePoint(
  profile: LaunchProfileData,
  earthRadiusKm: number,
): { x: number; y: number } {
  const angle = (profile.releaseAngleDeg * Math.PI) / 180
  return {
    x: earthRadiusKm * Math.cos(angle),
    y: earthRadiusKm * Math.sin(angle),
  }
}

/**
 * The fictional assisted-ascent mapping. The rotor supplies a prograde surface
 * release speed; the ascent stage adds a fixed profile delta-v and places the
 * capsule at the insertion radius. The mapping is deterministic, consumes the
 * finite ascent-stage budget, and makes no attempt to correct a bad trajectory.
 */
export function buildDepartureState(
  profile: LaunchProfileData,
  totalMassKg: number,
  earthRadiusKm: number,
  assumptions: ModelAssumptionsData,
): DepartureState {
  if (profile.insertionRadiusKm <= earthRadiusKm) {
    throw new Error('Launch profile insertion radius must be above Earth’s mean radius')
  }
  const centrifuge = computeCentrifuge(profile, totalMassKg, assumptions)
  const angle = (profile.releaseAngleDeg * Math.PI) / 180
  const tangent = releaseUnitVector(profile)
  const speedKms = centrifuge.releaseSpeedKms + profile.assistedAscentDeltaVKms
  return {
    positionKm: {
      x: profile.insertionRadiusKm * Math.cos(angle),
      y: profile.insertionRadiusKm * Math.sin(angle),
    },
    velocityKms: { x: tangent.x * speedKms, y: tangent.y * speedKms },
    releaseSpeedKms: centrifuge.releaseSpeedKms,
    launchLoadG: centrifuge.launchLoadG,
    rotorEnergyGj: centrifuge.rotorEnergyGj,
    ascentDeltaVKms: profile.assistedAscentDeltaVKms,
    ascentCapacityKms: profile.ascentStageCapacityKms,
  }
}
