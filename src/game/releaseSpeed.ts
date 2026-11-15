import type { LaunchProfileData } from './types'

/**
 * Release-speed control for the verified Balanced profile.
 *
 * The simulator scan found a narrow delivered window at the
 * shipped 4 s step: 0.980×–1.002× of the verified 1.000 km/s release speed.
 * The control therefore exposes finite detents instead of pretending a broad
 * continuous range is usable. The release direction stays fixed.
 */
export const RELEASE_SPEED_SCALE_DETENTS = [0.97, 0.98, 0.99, 1, 1.01, 1.02] as const

export const RELEASE_SPEED_SCALE_MIN = 0.97
export const RELEASE_SPEED_SCALE_MAX = 1.02
export const DEFAULT_RELEASE_SPEED_SCALE = 1

export function quantizeReleaseSpeedScale(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_RELEASE_SPEED_SCALE
  const clamped = Math.min(
    RELEASE_SPEED_SCALE_MAX,
    Math.max(RELEASE_SPEED_SCALE_MIN, value),
  )
  let nearest: number = RELEASE_SPEED_SCALE_DETENTS[0]
  let nearestDistance = Math.abs(clamped - nearest)
  for (const detent of RELEASE_SPEED_SCALE_DETENTS) {
    const distance = Math.abs(clamped - detent)
    if (distance < nearestDistance) {
      nearest = detent
      nearestDistance = distance
    }
  }
  return nearest
}

export function isReleaseSpeedScaleInRange(value: number): boolean {
  return (
    Number.isFinite(value) &&
    value >= RELEASE_SPEED_SCALE_MIN - 1e-9 &&
    value <= RELEASE_SPEED_SCALE_MAX + 1e-9
  )
}

/**
 * Central effective-profile resolution. Both `computeCentrifuge` and
 * `buildDepartureState` receive this profile, so load, energy, release speed
 * and departure velocity stay consistent.
 */
export function resolveEffectiveProfile(
  profile: LaunchProfileData,
  releaseSpeedScale: number,
): LaunchProfileData {
  const scale = quantizeReleaseSpeedScale(releaseSpeedScale)
  return {
    ...profile,
    rotorAngularSpeedRadps: profile.rotorAngularSpeedRadps * scale,
  }
}

export function releaseSpeedScaleLabel(scale: number): string {
  return `${Math.round(quantizeReleaseSpeedScale(scale) * 100)}%`
}
