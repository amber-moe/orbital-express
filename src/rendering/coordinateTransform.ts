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

/**
 * A rendering-only rotation. The simulation is Earth-centred with the Moon on +X;
 * the view turns the system so Earth sits lower-left and the Moon upper-right.
 * Distances remain true; no physical value is changed here.
 */
export const VIEW_ROTATION_RAD = (14 * Math.PI) / 180

export function toScene(x: number, y: number): { x: number; y: number } {
  const cos = Math.cos(VIEW_ROTATION_RAD)
  const sin = Math.sin(VIEW_ROTATION_RAD)
  return {
    x: x * cos - y * sin,
    y: x * sin + y * cos,
  }
}

export function computeSceneBounds(
  points: readonly Vec2Like[],
  circles: readonly { center: Vec2Like; radiusKm: number }[],
  paddingRatio = 0.06,
): Bounds {
  let minX = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY

  for (const point of points) {
    const scene = toScene(point.x, point.y)
    minX = Math.min(minX, scene.x)
    maxX = Math.max(maxX, scene.x)
    minY = Math.min(minY, scene.y)
    maxY = Math.max(maxY, scene.y)
  }
  for (const circle of circles) {
    const scene = toScene(circle.center.x, circle.center.y)
    minX = Math.min(minX, scene.x - circle.radiusKm)
    maxX = Math.max(maxX, scene.x + circle.radiusKm)
    minY = Math.min(minY, scene.y - circle.radiusKm)
    maxY = Math.max(maxY, scene.y + circle.radiusKm)
  }
  if (!Number.isFinite(minX)) {
    return { minX: -1, maxX: 1, minY: -1, maxY: 1 }
  }
  const span = Math.max(maxX - minX, maxY - minY, 1)
  const padding = span * paddingRatio
  return {
    minX: minX - padding,
    maxX: maxX + padding,
    minY: minY - padding,
    maxY: maxY + padding,
  }
}

/** Expand one axis so the bounds match the viewport aspect without cropping. */
export function fitBoundsToAspect(bounds: Bounds, aspect: number): Bounds {
  const width = bounds.maxX - bounds.minX
  const height = bounds.maxY - bounds.minY
  if (!(aspect > 0) || !(width > 0) || !(height > 0)) return bounds
  const centerX = (bounds.minX + bounds.maxX) / 2
  const centerY = (bounds.minY + bounds.maxY) / 2
  if (width / height < aspect) {
    const nextWidth = height * aspect
    return {
      minX: centerX - nextWidth / 2,
      maxX: centerX + nextWidth / 2,
      minY: bounds.minY,
      maxY: bounds.maxY,
    }
  }
  const nextHeight = width / aspect
  return {
    minX: bounds.minX,
    maxX: bounds.maxX,
    minY: centerY - nextHeight / 2,
    maxY: centerY + nextHeight / 2,
  }
}
