import type { LaunchProfileData } from './types'
import { releaseUnitVector } from './simulation/departureModel'

export interface Vec2 {
  x: number
  y: number
}

export const FULL_TURN = Math.PI * 2
/** The loaded pod sits to the left of the hub in the SVG. */
export const PAYLOAD_LOCAL_ANGLE = Math.PI

export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

export function normalizeAngle(angle: number): number {
  const turn = FULL_TURN
  return ((angle % turn) + turn) % turn
}

export function orbitEndpoint(
  center: Vec2,
  radius: number,
  localAngle: number,
  rotation: number,
): Vec2 {
  const angle = localAngle + rotation
  return {
    x: center.x + Math.cos(angle) * radius,
    y: center.y + Math.sin(angle) * radius,
  }
}

/** Tangent for increasing SVG rotation (visually clockwise). */
export function orbitTangent(localAngle: number, rotation: number): Vec2 {
  const angle = localAngle + rotation + Math.PI / 2
  return { x: Math.cos(angle), y: Math.sin(angle) }
}

/** Physical +Y is up; SVG +Y is down. */
export function screenReleaseTangentAngle(profile: LaunchProfileData): number {
  const tangent = releaseUnitVector(profile)
  return Math.atan2(-tangent.y, tangent.x)
}

/**
 * Rotation that puts the payload endpoint's tangent on the profile's release
 * tangent. `turns` only adds complete revolutions for slow-motion illustration;
 * it cannot change the endpoint direction or tangent.
 */
export function releaseRotationRadians(
  profile: LaunchProfileData,
  localAngle = PAYLOAD_LOCAL_ANGLE,
  turns = 2,
): number {
  const tangentAngle = screenReleaseTangentAngle(profile)
  const base = tangentAngle - localAngle - Math.PI / 2
  return normalizeAngle(base) + FULL_TURN * Math.max(0, Math.floor(turns))
}

/**
 * Monotonically accelerating spin-up. θ(0)=0, θ(1)=releaseRotation.
 * Angular velocity is 2·K·p/T: increasing and nonzero at release.
 */
export function spinAngle(progress: number, releaseRotation: number): number {
  const p = clamp01(progress)
  return releaseRotation * p * p
}

export function spinAngularVelocity(
  progress: number,
  releaseRotation: number,
  durationSeconds: number,
): number {
  const p = clamp01(progress)
  return (2 * releaseRotation * p) / Math.max(durationSeconds, 0.001)
}

/**
 * Total coast displacement for a linear deceleration from the release angular
 * velocity to zero over the departure window.
 */
export function coastDisplacement(
  releaseRotation: number,
  spinDurationSeconds: number,
  departureDurationSeconds: number,
): number {
  const releaseVelocity = spinAngularVelocity(1, releaseRotation, spinDurationSeconds)
  return 0.5 * releaseVelocity * Math.max(departureDurationSeconds, 0.001)
}

/**
 * Empty-rotor deceleration over DEPARTURE. θ(0)=releaseRotation, θ(1)=release+coast.
 * The initial velocity equals the spin-up release velocity for continuity.
 */
export function coastAngle(
  progress: number,
  releaseRotation: number,
  totalCoast: number,
): number {
  const p = clamp01(progress)
  return releaseRotation + totalCoast * (2 * p - p * p)
}

export function coastAngularVelocity(
  progress: number,
  releaseVelocity: number,
): number {
  return releaseVelocity * (1 - clamp01(progress))
}

export function payloadOpacity(progress: number): number {
  const p = clamp01(progress)
  if (p <= 0.15) return 1
  return Math.max(0, 1 - (p - 0.15) / 0.3)
}
