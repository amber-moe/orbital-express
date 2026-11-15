/**
 * Rendering-only schematic mapping.
 *
 * The simulation is Earth-centred, in kilometres, with the Moon at its real
 * position. This module produces a separate, fixed layout for the overview:
 * Earth and the Moon become legible focal points and the simulated path is
 * mapped with one uniform similarity transform (rotation + scale + translation).
 *
 * Nothing here changes physical radii, gravity, positions, collision tests,
 * event timing or outcomes. The view is explicitly labelled as a schematic and
 * the simulated path is clipped where it would enter a visually enlarged body.
 */
export type { Vec2 } from '../game/types'

export interface Vec2Like {
  x: number
  y: number
}

export interface Bounds {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

export interface BodyLayout {
  /** Schematic centre in layout units. */
  center: Vec2Like
  /** Visual radius in layout units (not the physical radius). */
  radius: number
  /** Visual guide-ring radius, also schematic. */
  ringRadius: number
  /** Physical radius, preserved for provenance and labels. */
  physicalRadiusKm: number
}

export interface SchematicLayout {
  bounds: Bounds
  width: number
  height: number
  earth: BodyLayout
  moon: BodyLayout
  /** km → layout units. */
  scale: number
  /** Extra rotation applied to the physical frame. */
  rotationRad: number
  earthMoonDistanceKm: number
  /** Layout units per CSS pixel. */
  pxToUnits: number
  /** CSS pixels per layout unit. */
  unitToPx: number
}

export interface PhysicalViewInput {
  earthRadiusKm: number
  moonRadiusKm: number
  moonPositionKm: Vec2Like
}

/** Earth visual diameter as a fraction of the playfield width. */
export const EARTH_DIAMETER_FRACTION = 0.34
/** Moon visual diameter as a fraction of the playfield width. */
export const MOON_DIAMETER_FRACTION = 0.15

export const EARTH_ANCHOR_X = -0.55
export const MOON_ANCHOR_X = 0.62
/** Vertical anchor positions as a fraction of the half-height. */
export const EARTH_ANCHOR_Y_FRACTION = -0.46
export const MOON_ANCHOR_Y_FRACTION = 0.44

const MIN_VIEWPORT = 1

function rotate(point: Vec2Like, angle: number): Vec2Like {
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  return {
    x: point.x * cos - point.y * sin,
    y: point.x * sin + point.y * cos,
  }
}

export function createSchematicLayout(
  viewportWidthPx: number,
  viewportHeightPx: number,
  physical: PhysicalViewInput,
): SchematicLayout {
  const widthPx = Math.max(MIN_VIEWPORT, viewportWidthPx)
  const heightPx = Math.max(MIN_VIEWPORT, viewportHeightPx)
  const aspect = widthPx / heightPx

  // Fixed two-unit-wide layout; the height follows the viewport aspect.
  const width = 2
  const height = 2 / aspect
  const halfHeight = height / 2
  const bounds: Bounds = { minX: -1, maxX: 1, minY: -halfHeight, maxY: halfHeight }

  const earthCenter = {
    x: EARTH_ANCHOR_X,
    y: EARTH_ANCHOR_Y_FRACTION * halfHeight,
  }
  const moonCenter = {
    x: MOON_ANCHOR_X,
    y: MOON_ANCHOR_Y_FRACTION * halfHeight,
  }

  const moonPhysical = physical.moonPositionKm
  const earthMoonDistanceKm = Math.hypot(moonPhysical.x, moonPhysical.y) || 1
  const anchorDistance = Math.hypot(
    moonCenter.x - earthCenter.x,
    moonCenter.y - earthCenter.y,
  )
  const scale = anchorDistance / earthMoonDistanceKm
  const rotationRad =
    Math.atan2(moonCenter.y - earthCenter.y, moonCenter.x - earthCenter.x) -
    Math.atan2(moonPhysical.y, moonPhysical.x)

  const earthRadius = (EARTH_DIAMETER_FRACTION * width) / 2
  const moonRadius = (MOON_DIAMETER_FRACTION * width) / 2

  return {
    bounds,
    width,
    height,
    earth: {
      center: earthCenter,
      radius: earthRadius,
      ringRadius: earthRadius * 1.18,
      physicalRadiusKm: physical.earthRadiusKm,
    },
    moon: {
      center: moonCenter,
      radius: moonRadius,
      ringRadius: moonRadius * 1.42,
      physicalRadiusKm: physical.moonRadiusKm,
    },
    scale,
    rotationRad,
    earthMoonDistanceKm,
    pxToUnits: width / widthPx,
    unitToPx: widthPx / width,
  }
}

/** Physical kilometres → schematic layout units. */
export function toSchematic(layout: SchematicLayout, point: Vec2Like): Vec2Like {
  const rotated = rotate(
    { x: point.x * layout.scale, y: point.y * layout.scale },
    layout.rotationRad,
  )
  return {
    x: layout.earth.center.x + rotated.x,
    y: layout.earth.center.y + rotated.y,
  }
}

export function distance(a: Vec2Like, b: Vec2Like): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

export function isInsideVisualBody(
  layout: SchematicLayout,
  point: Vec2Like,
  margin = 0,
): boolean {
  return (
    distance(point, layout.earth.center) < layout.earth.radius + margin ||
    distance(point, layout.moon.center) < layout.moon.radius + margin
  )
}

export interface SchematicConnector {
  from: Vec2Like
  to: Vec2Like
}

export interface SchematicPath {
  /** Consecutive visible path runs, already in layout units. */
  runs: Vec2Like[][]
  departure: SchematicConnector | null
  approach: SchematicConnector | null
  firstVisible: Vec2Like | null
  lastVisible: Vec2Like | null
  /** True when the physical path actually enters the Moon's visual disc. */
  entersMoonVisual: boolean
}

/**
 * Map a physical path into the schematic layout and remove the parts that
 * would cross a visually enlarged body. The removed ends are replaced by
 * explicitly schematic connectors; they never pass through the simulation.
 */
export function buildSchematicPath(
  points: readonly Vec2Like[],
  layout: SchematicLayout,
  margin = 0.02,
): SchematicPath {
  const runs: Vec2Like[][] = []
  let currentRun: Vec2Like[] = []
  let firstVisible: Vec2Like | null = null
  let lastVisible: Vec2Like | null = null
  let lastMapped: Vec2Like | null = null
  let lastWasVisible = false
  let entersMoonVisual = false

  for (const point of points) {
    const mapped = toSchematic(layout, point)
    lastMapped = mapped
    const insideMoon = distance(mapped, layout.moon.center) < layout.moon.radius + margin
    if (insideMoon) entersMoonVisual = true
    const visible =
      distance(mapped, layout.earth.center) >= layout.earth.radius + margin &&
      !insideMoon
    if (visible) {
      if (!lastWasVisible) {
        currentRun = []
        runs.push(currentRun)
      }
      currentRun.push(mapped)
      firstVisible ??= mapped
      lastVisible = mapped
    }
    lastWasVisible = visible
  }

  const departure =
    firstVisible && lastMapped
      ? {
          from: pointOnBodyEdge(layout.earth, firstVisible, margin * 0.5),
          to: firstVisible,
        }
      : null
  const approach =
    lastVisible && entersMoonVisual
      ? {
          from: lastVisible,
          to: pointOnBodyEdge(layout.moon, lastVisible, margin * 0.5),
        }
      : null

  return {
    runs: runs.filter((run) => run.length >= 2),
    departure,
    approach,
    firstVisible,
    lastVisible,
    entersMoonVisual,
  }
}

/** A point on a body's visual edge in the direction of `toward`. */
export function pointOnBodyEdge(
  body: BodyLayout,
  toward: Vec2Like,
  extra = 0,
): Vec2Like {
  const dx = toward.x - body.center.x
  const dy = toward.y - body.center.y
  const length = Math.hypot(dx, dy) || 1
  const radius = body.radius + extra
  return {
    x: body.center.x + (dx / length) * radius,
    y: body.center.y + (dy / length) * radius,
  }
}

/** Small helper for camera tests and labels. */
export function clampToBounds(point: Vec2Like, bounds: Bounds): Vec2Like {
  return {
    x: Math.min(bounds.maxX, Math.max(bounds.minX, point.x)),
    y: Math.min(bounds.maxY, Math.max(bounds.minY, point.y)),
  }
}
