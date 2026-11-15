import { describe, expect, it } from 'vitest'
import { gameData } from '../src/game/data'
import {
  EARTH_DIAMETER_FRACTION,
  MOON_DIAMETER_FRACTION,
  buildSchematicPath,
  createSchematicLayout,
  distance,
  isInsideVisualBody,
  toSchematic,
  type SchematicLayout,
} from '../src/rendering/coordinateTransform'
import {
  OVERVIEW_CAMERA,
  cameraBounds,
  smoothCameraView,
  targetCameraView,
} from '../src/rendering/cameraDirector'
import { computeTotals, defaultConfig, predictMission } from '../src/game/rules/configRules'

const physical = {
  earthRadiusKm: gameData.physicalConstants.earth.radiusKm,
  moonRadiusKm: gameData.physicalConstants.moon.radiusKm,
  moonPositionKm: gameData.physicalConstants.moonPositionKm,
}

function layout(width = 1600, height = 1000): SchematicLayout {
  return createSchematicLayout(width, height, physical)
}

describe('schematic layout', () => {
  it('keeps Earth and the Moon at the requested visual diameters', () => {
    const view = layout()
    expect((view.earth.radius * 2) / view.width).toBeCloseTo(EARTH_DIAMETER_FRACTION, 6)
    expect((view.moon.radius * 2) / view.width).toBeCloseTo(MOON_DIAMETER_FRACTION, 6)
    expect(view.earth.radius).toBeGreaterThan(view.moon.radius * 2)
  })

  it('maps physical Earth and Moon centres onto their schematic anchors', () => {
    const view = layout()
    const earth = toSchematic(view, { x: 0, y: 0 })
    const moon = toSchematic(view, gameData.physicalConstants.moonPositionKm)
    expect(earth.x).toBeCloseTo(view.earth.center.x, 9)
    expect(earth.y).toBeCloseTo(view.earth.center.y, 9)
    expect(moon.x).toBeCloseTo(view.moon.center.x, 6)
    expect(moon.y).toBeCloseTo(view.moon.center.y, 6)
    expect(view.earth.center.x).toBeLessThan(view.moon.center.x)
    expect(view.earth.center.y).toBeLessThan(view.moon.center.y)
  })

  it('preserves relative distances with one uniform scale', () => {
    const view = layout()
    const a = { x: 100_000, y: 20_000 }
    const b = { x: 240_000, y: 70_000 }
    const physicalDistance = distance(a, b)
    const mappedDistance = distance(toSchematic(view, a), toSchematic(view, b))
    expect(mappedDistance / physicalDistance).toBeCloseTo(view.scale, 9)
  })

  it('adapts the vertical layout to tall viewports without changing the width fractions', () => {
    const wide = layout(1600, 900)
    const tall = layout(700, 1000)
    expect(wide.earth.radius).toBeCloseTo(tall.earth.radius, 9)
    expect(Math.abs(tall.moon.center.y - tall.earth.center.y)).toBeGreaterThan(
      Math.abs(wide.moon.center.y - wide.earth.center.y),
    )
  })
})

describe('schematic path clipping', () => {
  const config = defaultConfig(gameData)
  const totals = computeTotals(config, gameData)
  const prediction = predictMission(config, gameData, totals)

  it('clips the simulated path outside the enlarged visual bodies', () => {
    const view = layout()
    const path = buildSchematicPath(prediction.points, view)
    expect(path.runs.length).toBeGreaterThan(0)
    expect(path.departure).not.toBeNull()
    expect(path.approach).not.toBeNull()
    for (const run of path.runs) {
      for (const point of run) {
        expect(isInsideVisualBody(view, point, 0.019)).toBe(false)
      }
    }
    const visiblePoints = path.runs.reduce((sum, run) => sum + run.length, 0)
    expect(visiblePoints).toBeGreaterThan(100)
  })

  it('does not draw a lunar approach connector for a trajectory that stays away', () => {
    const view = layout()
    const points = [
      { x: 6_571, y: 0 },
      { x: 100_000, y: 80_000 },
      { x: 180_000, y: 130_000 },
    ]
    const path = buildSchematicPath(points, view)
    expect(path.entersMoonVisual).toBe(false)
    expect(path.approach).toBeNull()
  })
})

describe('camera director', () => {
  const view = layout()
  const base = {
    layout: view,
    cargo: view.moon.center,
    reducedMotion: false,
    phaseProgress: 0,
    resultKind: null,
  } as const

  it('uses the overview while configuring and transferring', () => {
    expect(targetCameraView({ ...base, phase: 'CONFIGURING' })).toEqual(OVERVIEW_CAMERA)
    expect(targetCameraView({ ...base, phase: 'TRANSFER' })).toEqual(OVERVIEW_CAMERA)
  })

  it('focuses the launch site and the Moon in the appropriate phases', () => {
    const spin = targetCameraView({ ...base, phase: 'SPINNING_UP' })
    expect(spin.centerX).toBeCloseTo(view.earth.center.x, 6)
    expect(spin.centerY).toBeCloseTo(view.earth.center.y, 6)
    expect(spin.zoom).toBeGreaterThan(1)

    const approach = targetCameraView({ ...base, phase: 'APPROACH' })
    expect(approach.centerX).toBeCloseTo(view.moon.center.x, 6)
    expect(approach.centerY).toBeCloseTo(view.moon.center.y, 6)
  })

  it('never frames a successful Moon arrival after a failed result', () => {
    const missed = targetCameraView({
      ...base,
      phase: 'RESULT',
      resultKind: 'missed-moon',
    })
    expect(missed).toEqual(OVERVIEW_CAMERA)

    const impact = targetCameraView({
      ...base,
      phase: 'RESULT',
      resultKind: 'moon-impact',
      cargo: { x: 0.8, y: 0.5 },
    })
    expect(impact.centerX).toBeCloseTo(0.8, 6)
    expect(impact.centerX).not.toBeCloseTo(view.moon.center.x, 6)

    const delivered = targetCameraView({
      ...base,
      phase: 'RESULT',
      resultKind: 'delivered',
    })
    expect(delivered.centerX).toBeCloseTo(view.moon.center.x, 6)
  })

  it('snaps instantly when reduced motion is requested', () => {
    const current = { centerX: 0, centerY: 0, zoom: 1 }
    const target = { centerX: 0.5, centerY: 0.2, zoom: 1.4 }
    expect(smoothCameraView(current, target, 0.016, true)).toEqual(target)
    expect(smoothCameraView(current, target, 0.016, false).zoom).toBeGreaterThan(1)
  })

  it('keeps the orthographic aspect ratio when narrowing the view', () => {
    const bounds = cameraBounds({ centerX: 0.1, centerY: -0.1, zoom: 1.5 }, view)
    const width = bounds.maxX - bounds.minX
    const height = bounds.maxY - bounds.minY
    expect((view.bounds.maxX - view.bounds.minX) / (view.bounds.maxY - view.bounds.minY)).toBeCloseTo(
      width / height,
      9,
    )
  })
})
