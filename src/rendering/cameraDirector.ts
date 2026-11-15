/**
 * Rendering-only camera direction.
 *
 * Reads the mission's existing phase/progress and returns a camera target for
 * the schematic overview. It never mutates mission state, event timing or
 * outcomes. The scene owns the smooth interpolation so the director stays a
 * pure function that is easy to test.
 */
import type { MissionPhase, OutcomeKind } from '../game/types'
import type { Bounds, SchematicLayout, Vec2Like } from './coordinateTransform'

export interface CameraView {
  centerX: number
  centerY: number
  zoom: number
}

export interface CameraInput {
  phase: MissionPhase
  phaseProgress: number
  resultKind: OutcomeKind | null
  layout: SchematicLayout
  /** Capsule position in schematic layout units, for failure framing. */
  cargo: Vec2Like | null
  reducedMotion: boolean
}

export const OVERVIEW_CAMERA: CameraView = { centerX: 0, centerY: 0, zoom: 1 }

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

function easeInOut(value: number): number {
  const t = clamp01(value)
  return t * t * (3 - 2 * t)
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function mixView(a: CameraView, b: CameraView, t: number): CameraView {
  return {
    centerX: lerp(a.centerX, b.centerX, t),
    centerY: lerp(a.centerY, b.centerY, t),
    zoom: lerp(a.zoom, b.zoom, t),
  }
}

function focusOn(point: Vec2Like, zoom: number): CameraView {
  return { centerX: point.x, centerY: point.y, zoom }
}

function isSuccess(kind: OutcomeKind | null): boolean {
  return kind === 'delivered' || kind === 'contract-shortfall'
}

function isMissedTrajectory(kind: OutcomeKind | null): boolean {
  return kind === 'missed-moon'
}

export function targetCameraView(input: CameraInput): CameraView {
  const { phase, phaseProgress, resultKind, layout, cargo, reducedMotion } = input
  // Reduced motion keeps one stable framing per phase instead of following the
  // phase progress with a slow zoom.
  const progress = reducedMotion ? 0 : clamp01(phaseProgress)

  switch (phase) {
    case 'CONFIGURING':
      return { ...OVERVIEW_CAMERA }

    case 'SPINNING_UP': {
      const zoom = 1.3 + 0.06 * progress
      return focusOn(layout.earth.center, zoom)
    }

    case 'DEPARTURE': {
      // Start close to the rotor, then ease back to the overview so the
      // transfer does not snap to a distant wide shot.
      const t = easeInOut(progress)
      const start = focusOn(layout.earth.center, 1.48)
      const end = { ...OVERVIEW_CAMERA }
      return mixView(start, end, t)
    }

    case 'TRANSFER':
      return { ...OVERVIEW_CAMERA }

    case 'APPROACH': {
      const t = easeInOut(progress)
      const start = focusOn(layout.moon.center, 1.55)
      const end = focusOn(layout.moon.center, 1.38)
      return mixView(start, end, t)
    }

    case 'RESULT': {
      if (isSuccess(resultKind)) {
        return focusOn(layout.moon.center, 1.42)
      }
      if (isMissedTrajectory(resultKind) || !cargo) {
        return { ...OVERVIEW_CAMERA }
      }
      return focusOn(cargo, 1.35)
    }
  }
}

/** Exponential smoothing; reduced motion snaps to the target. */
export function smoothCameraView(
  current: CameraView,
  target: CameraView,
  dtSeconds: number,
  reducedMotion: boolean,
): CameraView {
  if (reducedMotion) return { ...target }
  const dt = Math.min(Math.max(dtSeconds, 0), 0.1)
  const t = 1 - Math.exp(-dt * 3.4)
  return {
    centerX: lerp(current.centerX, target.centerX, t),
    centerY: lerp(current.centerY, target.centerY, t),
    zoom: lerp(current.zoom, target.zoom, t),
  }
}

/** Convert a camera view into orthographic bounds for the schematic layout. */
export function cameraBounds(view: CameraView, layout: SchematicLayout): Bounds {
  const zoom = Math.max(0.2, view.zoom)
  const halfWidth = (layout.bounds.maxX - layout.bounds.minX) / 2 / zoom
  const halfHeight = (layout.bounds.maxY - layout.bounds.minY) / 2 / zoom
  return {
    minX: view.centerX - halfWidth,
    maxX: view.centerX + halfWidth,
    minY: view.centerY - halfHeight,
    maxY: view.centerY + halfHeight,
  }
}
