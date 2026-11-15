import { describe, expect, it } from 'vitest'
import { gameData } from '../src/game/data'
import {
  PAYLOAD_LOCAL_ANGLE,
  coastAngle,
  coastAngularVelocity,
  coastDisplacement,
  orbitEndpoint,
  orbitTangent,
  releaseRotationRadians,
  screenReleaseTangentAngle,
  spinAngle,
  spinAngularVelocity,
} from '../src/game/centrifugeAnimation'

const profile = gameData.profiles['balanced']!
const HUB = { x: 120, y: 68 }
const POD_RADIUS = 54
const SPIN_SECONDS = gameData.assumptions.simulation.spinUpSeconds
const DEPARTURE_SECONDS = gameData.assumptions.simulation.departureSeconds

describe('centrifuge animation math', () => {
  it('accelerates monotonically and still has angular velocity at release', () => {
    const release = releaseRotationRadians(profile)
    let previousAngle = -1
    let previousVelocity = -1
    for (let index = 0; index <= 20; index += 1) {
      const p = index / 20
      const angle = spinAngle(p, release)
      const velocity = spinAngularVelocity(p, release, SPIN_SECONDS)
      expect(angle).toBeGreaterThanOrEqual(previousAngle)
      expect(velocity).toBeGreaterThan(previousVelocity)
      previousAngle = angle
      previousVelocity = velocity
    }
    expect(spinAngle(0, release)).toBe(0)
    expect(spinAngle(1, release)).toBeCloseTo(release, 9)
    expect(spinAngularVelocity(1, release, SPIN_SECONDS)).toBeGreaterThan(0)
  })

  it('derives the endpoint and tangent from the physical release direction', () => {
    const release = releaseRotationRadians(profile)
    const endpoint = orbitEndpoint(HUB, POD_RADIUS, PAYLOAD_LOCAL_ANGLE, release)
    const tangent = orbitTangent(PAYLOAD_LOCAL_ANGLE, release)
    const physicalAngle = screenReleaseTangentAngle(profile)

    expect(endpoint.x).toBeCloseTo(174, 6)
    expect(endpoint.y).toBeCloseTo(68, 6)
    expect(Math.atan2(tangent.y, tangent.x)).toBeCloseTo(physicalAngle, 9)
    expect(tangent.x).toBeCloseTo(0, 6)
    expect(tangent.y).toBeCloseTo(1, 6)
  })

  it('keeps angle and velocity continuous when the loaded arm becomes empty', () => {
    const release = releaseRotationRadians(profile)
    const releaseVelocity = spinAngularVelocity(1, release, SPIN_SECONDS)
    const coast = coastDisplacement(release, SPIN_SECONDS, DEPARTURE_SECONDS)
    const startCoast = coastAngle(0, release, coast)
    const startVelocity = coastAngularVelocity(0, releaseVelocity)

    expect(startCoast).toBeCloseTo(spinAngle(1, release), 9)
    expect(startVelocity).toBeCloseTo(releaseVelocity, 9)
    expect(coastAngle(1, release, coast)).toBeCloseTo(release + coast, 9)
    expect(coastAngularVelocity(1, releaseVelocity)).toBe(0)
  })

  it('decelerates the empty rotor monotonically without reversing', () => {
    const release = releaseRotationRadians(profile)
    const releaseVelocity = spinAngularVelocity(1, release, SPIN_SECONDS)
    const coast = coastDisplacement(release, SPIN_SECONDS, DEPARTURE_SECONDS)
    let previousAngle = -Infinity
    let previousVelocity = Infinity
    for (let index = 0; index <= 20; index += 1) {
      const p = index / 20
      const angle = coastAngle(p, release, coast)
      const velocity = coastAngularVelocity(p, releaseVelocity)
      expect(angle).toBeGreaterThanOrEqual(previousAngle)
      expect(velocity).toBeLessThanOrEqual(previousVelocity)
      previousAngle = angle
      previousVelocity = velocity
    }
  })
})
