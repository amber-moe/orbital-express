import type { GravityBody, Vec2 } from '../types'

/** Standard gravity used only to present rotor acceleration in g. */
export const STANDARD_GRAVITY_MPS2 = 9.80665

/**
 * Sum of inverse-square accelerations, in km/s^2, for a static two-body field.
 * Bodies are treated as point masses; collision handling happens in the simulator.
 */
export function gravityAcceleration(
  x: number,
  y: number,
  bodies: readonly GravityBody[],
  out: Vec2 = { x: 0, y: 0 },
): Vec2 {
  let ax = 0
  let ay = 0
  for (const body of bodies) {
    const dx = x - body.positionKm.x
    const dy = y - body.positionKm.y
    const r2 = dx * dx + dy * dy
    if (r2 === 0) {
      throw new Error(`Gravity is singular at ${body.id}`)
    }
    const inverseR3 = 1 / (r2 * Math.sqrt(r2))
    const factor = -body.muKm3S2 * inverseR3
    ax += factor * dx
    ay += factor * dy
  }
  out.x = ax
  out.y = ay
  return out
}

/** One fixed-step velocity-Verlet update, in km and km/s. Mutates the state. */
export function velocityVerletStep(
  positionKm: Vec2,
  velocityKms: Vec2,
  bodies: readonly GravityBody[],
  dtSeconds: number,
): void {
  const a0 = gravityAcceleration(positionKm.x, positionKm.y, bodies)
  const halfDt2 = 0.5 * dtSeconds * dtSeconds
  positionKm.x += velocityKms.x * dtSeconds + a0.x * halfDt2
  positionKm.y += velocityKms.y * dtSeconds + a0.y * halfDt2
  const a1 = gravityAcceleration(positionKm.x, positionKm.y, bodies)
  velocityKms.x += 0.5 * (a0.x + a1.x) * dtSeconds
  velocityKms.y += 0.5 * (a0.y + a1.y) * dtSeconds
}

/**
 * First intersection of the segment a -> b with a circle, as a fraction in [0, 1].
 * Returns 0 when the segment starts inside the circle. This prevents a fast step from
 * tunnelling through a body or the reception boundary.
 */
export function segmentCircleIntersection(
  a: Vec2,
  b: Vec2,
  center: Vec2,
  radiusKm: number,
): number | null {
  const fx = a.x - center.x
  const fy = a.y - center.y
  const c = fx * fx + fy * fy - radiusKm * radiusKm
  if (c <= 0) return 0
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared === 0) return null
  const bCoef = 2 * (fx * dx + fy * dy)
  const discriminant = bCoef * bCoef - 4 * lengthSquared * c
  if (discriminant < 0) return null
  const sqrtDiscriminant = Math.sqrt(discriminant)
  const t1 = (-bCoef - sqrtDiscriminant) / (2 * lengthSquared)
  const t2 = (-bCoef + sqrtDiscriminant) / (2 * lengthSquared)
  if (t1 >= 0 && t1 <= 1) return t1
  if (t2 >= 0 && t2 <= 1) return t2
  return null
}
