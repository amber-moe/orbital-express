import * as THREE from 'three'
import { gameData } from '../game/data'
import type { FrameState } from '../game/missionController'
import {
  buildSchematicPath,
  createSchematicLayout,
  distance,
  toSchematic,
  type SchematicPath,
  type Vec2Like,
} from './coordinateTransform'
import {
  OVERVIEW_CAMERA,
  cameraBounds,
  smoothCameraView,
  targetCameraView,
  type CameraView,
} from './cameraDirector'

export interface SpaceSceneOptions {
  /** Called after the camera or layout changes so DOM labels can follow. */
  onView?: () => void
}

export interface ScreenPoint {
  x: number
  y: number
}

export interface BodyScreenPoint extends ScreenPoint {
  radiusPx: number
}

export interface SpaceSceneHandle {
  start(): void
  stop(): void
  resize(): void
  dispose(): void
  getScreenPoint(x: number, y: number): ScreenPoint | null
  getBodyScreenPoint(body: 'earth' | 'moon'): BodyScreenPoint | null
  getConnectorScreenPoint(kind: 'departure' | 'approach'): ScreenPoint | null
}

const MAX_TRAIL_POINTS = 12000
const STAR_COUNT = 460
const CAPSULE_PX = 22
const CAPSULE_GLOW_PX = 48
const DEPOT_PX = 24

function seededRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function glowTexture(): THREE.CanvasTexture {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d')
  if (context) {
    const gradient = context.createRadialGradient(
      size / 2,
      size / 2,
      0,
      size / 2,
      size / 2,
      size / 2,
    )
    gradient.addColorStop(0, 'rgba(255,255,255,0.9)')
    gradient.addColorStop(0.3, 'rgba(255,255,255,0.3)')
    gradient.addColorStop(0.65, 'rgba(255,255,255,0.06)')
    gradient.addColorStop(1, 'rgba(255,255,255,0)')
    context.fillStyle = gradient
    context.fillRect(0, 0, size, size)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

/**
 * Original procedural Earth texture (1024×512, equirectangular). Continuous
 * continent silhouettes, deep oceans, restrained clouds and ice caps.
 * No external imagery is used; this is also the fallback if canvas creation
 * fails.
 */
function earthTexture(): THREE.CanvasTexture {
  const width = 1024
  const height = 512
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (context) {
    const ocean = context.createLinearGradient(0, 0, 0, height)
    ocean.addColorStop(0, '#071f33')
    ocean.addColorStop(0.3, '#0a3852')
    ocean.addColorStop(0.62, '#0c4766')
    ocean.addColorStop(1, '#082a42')
    context.fillStyle = ocean
    context.fillRect(0, 0, width, height)

    for (let band = 0; band < 9; band += 1) {
      context.fillStyle = `rgba(110,170,200,${0.012 + (band % 3) * 0.005})`
      context.fillRect(0, (height / 9) * band, width, 2)
    }

    const random = seededRandom(0x0ea27)

    type Point = [number, number]
    const drawLandmass = (points: Point[], color: string): void => {
      const first = points[0]
      if (!first) return
      const trace = (): void => {
        const last = points[points.length - 1]
        if (!last) return
        context.beginPath()
        context.moveTo((last[0] + first[0]) / 2, (last[1] + first[1]) / 2)
        for (let index = 0; index < points.length; index += 1) {
          const point = points[index]
          const next = points[(index + 1) % points.length]
          if (!point || !next) continue
          context.quadraticCurveTo(
            point[0],
            point[1],
            (point[0] + next[0]) / 2,
            (point[1] + next[1]) / 2,
          )
        }
        context.closePath()
      }
      trace()
      context.fillStyle = color
      context.fill()

      // Subtle interior variation, clipped to the continuous silhouette.
      const xs = points.map((point) => point[0])
      const ys = points.map((point) => point[1])
      const minX = Math.min(...xs)
      const maxX = Math.max(...xs)
      const minY = Math.min(...ys)
      const maxY = Math.max(...ys)
      context.save()
      trace()
      context.clip()
      for (let patch = 0; patch < 14; patch += 1) {
        const x = minX + random() * (maxX - minX)
        const y = minY + random() * (maxY - minY)
        const rx = 8 + random() * 36
        const ry = 5 + random() * 18
        context.beginPath()
        context.ellipse(x, y, rx, ry, random() * Math.PI, 0, Math.PI * 2)
        context.fillStyle = random() > 0.5 ? 'rgba(210,220,180,0.10)' : 'rgba(20,45,35,0.14)'
        context.fill()
      }
      context.restore()
      trace()
      context.strokeStyle = 'rgba(214,230,220,0.32)'
      context.lineWidth = 1.2
      context.stroke()
    }

    const at = (lon: number, lat: number): Point => [
      ((lon + 180) / 360) * width,
      ((90 - lat) / 180) * height,
    ]

    drawLandmass(
      [
        at(-168, 66), at(-150, 70), at(-130, 68), at(-115, 72), at(-95, 73),
        at(-80, 70), at(-62, 60), at(-55, 48), at(-67, 45), at(-70, 30),
        at(-82, 25), at(-97, 18), at(-105, 20), at(-115, 30), at(-125, 40),
        at(-135, 57),
      ],
      '#376f57',
    )
    drawLandmass(
      [at(-100, 17), at(-88, 15), at(-77, 8), at(-83, 17)],
      '#447a56',
    )
    drawLandmass(
      [
        at(-80, 10), at(-65, 12), at(-50, 5), at(-35, -5), at(-38, -18),
        at(-48, -28), at(-58, -38), at(-68, -55), at(-75, -48), at(-72, -30),
        at(-78, -15),
      ],
      '#3f7958',
    )
    drawLandmass(
      [at(-10, 60), at(0, 70), at(20, 70), at(40, 60), at(32, 46), at(20, 38), at(0, 37), at(-10, 45)],
      '#55774d',
    )
    drawLandmass(
      [
        at(-17, 35), at(10, 37), at(33, 31), at(50, 12), at(42, -10),
        at(30, -30), at(18, -35), at(8, -25), at(-5, -5), at(-16, 12),
      ],
      '#6e7249',
    )
    drawLandmass(
      [
        at(40, 70), at(70, 76), at(105, 76), at(140, 72), at(175, 66),
        at(170, 55), at(158, 45), at(140, 35), at(122, 28), at(108, 12),
        at(98, 5), at(82, 20), at(62, 25), at(48, 40), at(40, 56),
      ],
      '#3d7255',
    )
    drawLandmass(
      [at(68, 25), at(78, 28), at(88, 22), at(80, 8), at(72, 8)],
      '#5d7649',
    )
    drawLandmass(
      [
        at(113, -10), at(130, -12), at(145, -15), at(153, -28),
        at(150, -38), at(135, -35), at(120, -33), at(113, -22),
      ],
      '#6d6c47',
    )
    drawLandmass(
      [at(-55, 83), at(-40, 80), at(-22, 70), at(-28, 60), at(-45, 60), at(-55, 70)],
      '#5b7650',
    )

    // Islands and smaller features.
    drawLandmass([at(-6, 50), at(2, 58), at(3, 54), at(-4, 50)], '#4d7650')
    drawLandmass([at(130, 31), at(140, 36), at(145, 43), at(140, 44), at(132, 34)], '#4d7650')
    drawLandmass([at(44, -16), at(50, -15), at(49, -25), at(44, -23)], '#5d7249')
    drawLandmass([at(166, -34), at(178, -38), at(174, -46), at(168, -44)], '#5d7249')
    drawLandmass([at(100, 5), at(120, 2), at(130, -4), at(112, -8)], '#4d7650')
    drawLandmass([at(-72, 18), at(-62, 18), at(-60, 12), at(-70, 12)], '#5d7249')

    // Polar caps, softened into the ocean.
    const north = context.createLinearGradient(0, 0, 0, 74)
    north.addColorStop(0, 'rgba(235,246,251,0.96)')
    north.addColorStop(1, 'rgba(235,246,251,0)')
    context.fillStyle = north
    context.fillRect(0, 0, width, 74)
    const south = context.createLinearGradient(0, height, 0, height - 62)
    south.addColorStop(0, 'rgba(235,246,251,0.92)')
    south.addColorStop(1, 'rgba(235,246,251,0)')
    context.fillStyle = south
    context.fillRect(0, height - 62, width, 62)

    // Restrained cloud bands.
    const drawWrapped = (x: number, radius: number, draw: (offset: number) => void): void => {
      draw(x)
      if (x - radius < 0) draw(x + width)
      if (x + radius > width) draw(x - width)
    }
    for (let index = 0; index < 34; index += 1) {
      const x = random() * width
      const y = 42 + random() * (height - 84)
      const rx = 26 + random() * 72
      const ry = 3 + random() * 8
      drawWrapped(x, rx, (px) => {
        context.beginPath()
        context.ellipse(px, y, rx, ry, (random() - 0.5) * 0.22, 0, Math.PI * 2)
        context.fillStyle = 'rgba(236,247,252,0.10)'
        context.fill()
      })
    }
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  return texture
}

/** Original procedural lunar texture (1024×512): maria, varied small craters, faint rays. */
function moonTexture(): THREE.CanvasTexture {
  const width = 1024
  const height = 512
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (context) {
    const base = context.createLinearGradient(0, 0, width, height)
    base.addColorStop(0, '#b9c0c7')
    base.addColorStop(0.48, '#9da5ae')
    base.addColorStop(1, '#7f8791')
    context.fillStyle = base
    context.fillRect(0, 0, width, height)

    const random = seededRandom(0x51ee7)
    for (let index = 0; index < 3200; index += 1) {
      const tone = 84 + Math.floor(random() * 100)
      context.fillStyle = `rgba(${tone},${tone + 4},${tone + 9},0.14)`
      context.fillRect(random() * width, random() * height, 1, 1)
    }

    const drawWrapped = (x: number, radius: number, draw: (offset: number) => void): void => {
      draw(x)
      if (x - radius < 0) draw(x + width)
      if (x + radius > width) draw(x - width)
    }

    // Broad, low-contrast maria.
    for (let index = 0; index < 9; index += 1) {
      const x = 60 + random() * (width - 120)
      const y = 60 + random() * (height - 120)
      const rx = 48 + random() * 102
      const ry = 22 + random() * 48
      drawWrapped(x, rx, (px) => {
        context.beginPath()
        context.ellipse(px, y, rx, ry, (random() - 0.5) * 0.5, 0, Math.PI * 2)
        context.fillStyle = 'rgba(66,73,82,0.22)'
        context.fill()
      })
    }

    // Many small, varied craters with subtle rims.
    for (let index = 0; index < 250; index += 1) {
      const x = 8 + random() * (width - 16)
      const y = 8 + random() * (height - 16)
      const radius = 1 + random() * 8 + (random() > 0.94 ? random() * 8 : 0)
      drawWrapped(x, radius + 2, (px) => {
        context.beginPath()
        context.arc(px, y, radius, 0, Math.PI * 2)
        context.fillStyle = 'rgba(62,68,77,0.26)'
        context.fill()
        context.beginPath()
        context.arc(px - radius * 0.1, y - radius * 0.1, radius, 0, Math.PI * 2)
        context.strokeStyle = 'rgba(228,233,238,0.22)'
        context.lineWidth = Math.max(0.6, radius * 0.07)
        context.stroke()
      })
    }

    // Faint ejecta rays around a few larger craters.
    for (let index = 0; index < 5; index += 1) {
      const x = 90 + random() * (width - 180)
      const y = 70 + random() * (height - 140)
      context.strokeStyle = 'rgba(225,231,236,0.10)'
      context.lineWidth = 1
      for (let ray = 0; ray < 7; ray += 1) {
        const angle = random() * Math.PI * 2
        context.beginPath()
        context.moveTo(x, y)
        context.lineTo(x + Math.cos(angle) * (14 + random() * 34), y + Math.sin(angle) * (14 + random() * 34))
        context.stroke()
      }
    }
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  return texture
}

/** Original procedural capsule marker: white body, orange band, dark engine. */
function capsuleTexture(): THREE.CanvasTexture {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d')
  if (context) {
    context.clearRect(0, 0, size, size)

    // antenna
    context.strokeStyle = '#a9c4d4'
    context.lineWidth = 3
    context.beginPath()
    context.moveTo(64, 16)
    context.lineTo(64, 30)
    context.stroke()

    // body
    context.beginPath()
    context.moveTo(52, 30)
    context.lineTo(76, 30)
    context.lineTo(84, 48)
    context.lineTo(80, 92)
    context.lineTo(48, 92)
    context.lineTo(44, 48)
    context.closePath()
    context.fillStyle = '#e9f2f5'
    context.fill()
    context.strokeStyle = '#ffffff'
    context.lineWidth = 3
    context.stroke()

    // orange cargo strap
    context.fillStyle = '#ffb43b'
    context.fillRect(47, 54, 34, 12)
    context.fillStyle = 'rgba(34,22,4,0.35)'
    context.fillRect(47, 63, 34, 2)

    // window
    context.beginPath()
    context.arc(64, 42, 5, 0, Math.PI * 2)
    context.fillStyle = '#4ce4d1'
    context.fill()

    // engine block + nozzle
    context.fillStyle = '#25313d'
    context.fillRect(52, 88, 24, 12)
    context.beginPath()
    context.moveTo(56, 100)
    context.lineTo(72, 100)
    context.lineTo(68, 110)
    context.lineTo(60, 110)
    context.closePath()
    context.fillStyle = '#151d25'
    context.fill()

    // fins
    context.fillStyle = '#b7c6d0'
    context.beginPath()
    context.moveTo(48, 80)
    context.lineTo(38, 94)
    context.lineTo(48, 90)
    context.closePath()
    context.fill()
    context.beginPath()
    context.moveTo(80, 80)
    context.lineTo(90, 94)
    context.lineTo(80, 90)
    context.closePath()
    context.fill()
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

/**
 * Original procedural receiving-depot glyph: a landing pad, a low warehouse,
 * side tanks, an antenna and a beacon. Not a house icon.
 */
function depotTexture(): THREE.CanvasTexture {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d')
  if (context) {
    context.clearRect(0, 0, size, size)

    // Landing pad.
    context.beginPath()
    context.arc(64, 72, 46, 0, Math.PI * 2)
    context.strokeStyle = 'rgba(76,228,209,0.5)'
    context.lineWidth = 2
    context.setLineDash([4, 6])
    context.stroke()
    context.setLineDash([])
    for (let tick = 0; tick < 8; tick += 1) {
      const angle = (tick / 8) * Math.PI * 2
      context.beginPath()
      context.moveTo(64 + Math.cos(angle) * 42, 72 + Math.sin(angle) * 42)
      context.lineTo(64 + Math.cos(angle) * 47, 72 + Math.sin(angle) * 47)
      context.strokeStyle = 'rgba(76,228,209,0.45)'
      context.stroke()
    }

    // Warehouse base and roof.
    context.fillStyle = 'rgba(9,19,31,0.92)'
    context.strokeStyle = 'rgba(233,240,243,0.75)'
    context.lineWidth = 2
    context.beginPath()
    context.roundRect(32, 54, 64, 30, 3)
    context.fill()
    context.stroke()
    context.beginPath()
    context.moveTo(28, 56)
    context.lineTo(64, 38)
    context.lineTo(100, 56)
    context.closePath()
    context.fillStyle = 'rgba(35,52,68,0.95)'
    context.fill()
    context.stroke()

    // Door and warm interior light.
    context.fillStyle = 'rgba(255,180,59,0.9)'
    context.fillRect(56, 64, 16, 20)
    context.fillStyle = 'rgba(255,220,150,0.35)'
    context.fillRect(56, 64, 16, 4)

    // Side tanks.
    context.beginPath()
    context.arc(24, 78, 6, 0, Math.PI * 2)
    context.arc(104, 78, 6, 0, Math.PI * 2)
    context.fillStyle = 'rgba(145,164,181,0.55)'
    context.fill()
    context.strokeStyle = 'rgba(233,240,243,0.5)'
    context.stroke()

    // Antenna and beacon.
    context.strokeStyle = 'rgba(233,240,243,0.7)'
    context.lineWidth = 1.5
    context.beginPath()
    context.moveTo(64, 38)
    context.lineTo(64, 22)
    context.stroke()
    context.beginPath()
    context.arc(64, 20, 3, 0, Math.PI * 2)
    context.fillStyle = '#4ce4d1'
    context.fill()
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

function safeTexture(
  factory: () => THREE.CanvasTexture,
  label: string,
): THREE.CanvasTexture | null {
  try {
    return factory()
  } catch (error) {
    console.warn(`Procedural ${label} texture failed; using flat-colour fallback.`, error)
    return null
  }
}

function ringGeometry(radius: number, segments = 160): THREE.BufferGeometry {
  const points: THREE.Vector3[] = []
  for (let index = 0; index < segments; index += 1) {
    const angle = (index / segments) * Math.PI * 2
    points.push(new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius, 0))
  }
  return new THREE.BufferGeometry().setFromPoints(points)
}

function starField(): THREE.BufferGeometry {
  const random = seededRandom(0x57a25)
  const positions = new Float32Array(STAR_COUNT * 3)
  for (let index = 0; index < STAR_COUNT; index += 1) {
    positions[index * 3] = (random() - 0.5) * 4
    positions[index * 3 + 1] = (random() - 0.5) * 4
    positions[index * 3 + 2] = -20
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  return geometry
}

function normalize(point: Vec2Like): Vec2Like {
  const length = Math.hypot(point.x, point.y) || 1
  return { x: point.x / length, y: point.y / length }
}

function lerpPoint(a: Vec2Like, b: Vec2Like, t: number): Vec2Like {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
}

function easeInOut(value: number): number {
  const t = Math.min(1, Math.max(0, value))
  return t * t * (3 - 2 * t)
}

export function createSpaceScene(
  container: HTMLElement,
  getFrame: () => FrameState,
  options: SpaceSceneOptions = {},
): SpaceSceneHandle {
  const width = () => Math.max(1, container.clientWidth)
  const height = () => Math.max(1, container.clientHeight)

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
  })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
  renderer.setSize(width(), height(), false)
  renderer.setClearColor(0x060d18, 1)
  renderer.domElement.className = 'space-canvas'
  container.appendChild(renderer.domElement)

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x060d18)
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100)
  camera.position.set(0, 0, 10)

  const disposables: { dispose: () => void }[] = []
  const share = safeTexture(glowTexture, 'glow')
  if (share) disposables.push(share)

  let layout = createSchematicLayout(width(), height(), {
    earthRadiusKm: gameData.physicalConstants.earth.radiusKm,
    moonRadiusKm: gameData.physicalConstants.moon.radiusKm,
    moonPositionKm: gameData.physicalConstants.moonPositionKm,
  })

  scene.add(new THREE.AmbientLight(0xa9c7dd, 0.95))
  const keyLight = new THREE.DirectionalLight(0xfff0d2, 2.75)
  keyLight.position.set(-1, -0.6, 2)
  scene.add(keyLight)
  const rimLight = new THREE.DirectionalLight(0xb8d4e4, 0.5)
  rimLight.position.set(1, 0.8, 1)
  scene.add(rimLight)

  const earthMap = safeTexture(earthTexture, 'Earth')
  const moonMap = safeTexture(moonTexture, 'lunar')
  const capsuleMap = safeTexture(capsuleTexture, 'capsule')
  const depotMap = safeTexture(depotTexture, 'depot')
  for (const texture of [earthMap, moonMap, capsuleMap, depotMap]) {
    if (texture) disposables.push(texture)
  }

  const earthMaterial = new THREE.MeshStandardMaterial({
    map: earthMap,
    color: earthMap ? 0xffffff : 0x1f5f7d,
    emissive: 0x06141e,
    roughness: 0.9,
    metalness: 0,
  })
  const earthGeometry = new THREE.SphereGeometry(1, 64, 40)
  const earth = new THREE.Mesh(earthGeometry, earthMaterial)
  earth.rotation.z = -0.12
  earth.rotation.y = -Math.PI / 2
  scene.add(earth)
  disposables.push(earthGeometry, earthMaterial)

  const earthRimGeometry = new THREE.RingGeometry(0.975, 1.035, 128)
  const earthRimMaterial = new THREE.MeshBasicMaterial({
    color: 0x5ab4dc,
    transparent: true,
    opacity: 0.18,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
  const earthRim = new THREE.Mesh(earthRimGeometry, earthRimMaterial)
  earthRim.renderOrder = 4
  scene.add(earthRim)
  disposables.push(earthRimGeometry, earthRimMaterial)

  const moonMaterial = new THREE.MeshStandardMaterial({
    map: moonMap,
    color: moonMap ? 0xffffff : 0x8d949d,
    emissive: 0x0a1017,
    roughness: 1,
    metalness: 0,
  })
  const moonGeometry = new THREE.SphereGeometry(1, 56, 36)
  const moon = new THREE.Mesh(moonGeometry, moonMaterial)
  scene.add(moon)
  disposables.push(moonGeometry, moonMaterial)

  const earthGlowMaterial = new THREE.SpriteMaterial({
    map: share,
    color: 0x3d96c4,
    transparent: true,
    opacity: 0.26,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
  const earthGlow = new THREE.Sprite(earthGlowMaterial)
  earthGlow.visible = share !== null
  scene.add(earthGlow)
  disposables.push(earthGlowMaterial)

  const moonGlowMaterial = new THREE.SpriteMaterial({
    map: share,
    color: 0xcfd8e0,
    transparent: true,
    opacity: 0.16,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
  const moonGlow = new THREE.Sprite(moonGlowMaterial)
  moonGlow.visible = share !== null
  scene.add(moonGlow)
  disposables.push(moonGlowMaterial)

  const starGeometry = starField()
  const starMaterial = new THREE.PointsMaterial({
    color: 0x9fb4c7,
    size: 1.25,
    sizeAttenuation: false,
    transparent: true,
    opacity: 0.4,
    depthWrite: false,
  })
  const stars = new THREE.Points(starGeometry, starMaterial)
  scene.add(stars)
  disposables.push(starGeometry, starMaterial)

  const releaseMaterial = new THREE.LineDashedMaterial({
    color: 0xffb43b,
    dashSize: 0.012,
    gapSize: 0.02,
    transparent: true,
    opacity: 0.4,
    depthWrite: false,
  })
  let releaseRing = new THREE.LineLoop(ringGeometry(layout.earth.ringRadius), releaseMaterial)
  releaseRing.computeLineDistances()
  scene.add(releaseRing)
  disposables.push(releaseMaterial)

  const receptionMaterial = new THREE.LineDashedMaterial({
    color: 0x4ce4d1,
    dashSize: 0.012,
    gapSize: 0.02,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  })
  let receptionRing = new THREE.LineLoop(ringGeometry(layout.moon.ringRadius), receptionMaterial)
  receptionRing.computeLineDistances()
  scene.add(receptionRing)
  disposables.push(receptionMaterial)

  const depotMaterial = new THREE.SpriteMaterial({
    map: depotMap ?? share,
    color: depotMap ? 0xffffff : 0x4ce4d1,
    transparent: true,
    depthWrite: false,
    depthTest: false,
  })
  const depot = new THREE.Sprite(depotMaterial)
  depot.visible = Boolean(depotMap ?? share)
  depot.renderOrder = 8
  scene.add(depot)
  disposables.push(depotMaterial)

  const predictionGeometry = new THREE.BufferGeometry()
  const predictionMaterial = new THREE.LineDashedMaterial({
    color: 0x4ce4d1,
    dashSize: 0.022,
    gapSize: 0.018,
    transparent: true,
    opacity: 0.8,
    depthWrite: false,
  })
  const predictionLines = new THREE.LineSegments(predictionGeometry, predictionMaterial)
  predictionLines.visible = false
  scene.add(predictionLines)
  disposables.push(predictionGeometry, predictionMaterial)

  const trailGeometry = new THREE.BufferGeometry()
  const trailMaterial = new THREE.LineBasicMaterial({
    color: 0x4ce4d1,
    transparent: true,
    opacity: 0.95,
  })
  const trailLines = new THREE.LineSegments(trailGeometry, trailMaterial)
  trailLines.visible = false
  scene.add(trailLines)
  disposables.push(trailGeometry, trailMaterial)

  const departureMaterial = new THREE.LineDashedMaterial({
    color: 0xffb43b,
    dashSize: 0.012,
    gapSize: 0.016,
    transparent: true,
    opacity: 0.7,
    depthWrite: false,
  })
  const departureConnector = new THREE.Line(new THREE.BufferGeometry(), departureMaterial)
  departureConnector.visible = false
  scene.add(departureConnector)
  disposables.push(departureConnector.geometry, departureMaterial)

  const approachMaterial = new THREE.LineDashedMaterial({
    color: 0xffb43b,
    dashSize: 0.012,
    gapSize: 0.016,
    transparent: true,
    opacity: 0.7,
    depthWrite: false,
  })
  const approachConnector = new THREE.Line(new THREE.BufferGeometry(), approachMaterial)
  approachConnector.visible = false
  scene.add(approachConnector)
  disposables.push(approachConnector.geometry, approachMaterial)

  const cargoMaterial = new THREE.SpriteMaterial({
    map: capsuleMap ?? share,
    color: capsuleMap ? 0xffffff : 0xffb43b,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  })
  const cargo = new THREE.Sprite(cargoMaterial)
  cargo.renderOrder = 20
  scene.add(cargo)
  disposables.push(cargoMaterial)

  const cargoGlowMaterial = new THREE.SpriteMaterial({
    map: share,
    color: 0xffb43b,
    transparent: true,
    opacity: 0.4,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
  const cargoGlow = new THREE.Sprite(cargoGlowMaterial)
  cargoGlow.visible = share !== null
  cargoGlow.renderOrder = 19
  scene.add(cargoGlow)
  disposables.push(cargoGlowMaterial)

  let currentPredictionVersion = -1
  let currentTrailRevision = -1
  let schematicPath: SchematicPath | null = null
  let view: CameraView = { ...OVERVIEW_CAMERA }
  let lastCapsule: Vec2Like | null = null
  let lastFrameTime = 0

  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  let reducedMotion = motionQuery.matches
  const onMotionChange = (): void => {
    reducedMotion = motionQuery.matches
  }
  motionQuery.addEventListener('change', onMotionChange)

  function setBodyLayout(): void {
    earth.position.set(layout.earth.center.x, layout.earth.center.y, 0)
    earth.scale.setScalar(layout.earth.radius)
    earthRim.position.set(layout.earth.center.x, layout.earth.center.y, 0.4)
    earthRim.scale.setScalar(layout.earth.radius)
    moon.position.set(layout.moon.center.x, layout.moon.center.y, 0)
    moon.scale.setScalar(layout.moon.radius)
    earthGlow.position.set(layout.earth.center.x, layout.earth.center.y, -1)
    earthGlow.scale.setScalar(layout.earth.radius * 3.6)
    moonGlow.position.set(layout.moon.center.x, layout.moon.center.y, -1)
    moonGlow.scale.setScalar(layout.moon.radius * 4.4)

    scene.remove(releaseRing)
    releaseRing.geometry.dispose()
    releaseRing = new THREE.LineLoop(ringGeometry(layout.earth.ringRadius), releaseMaterial)
    releaseRing.position.set(layout.earth.center.x, layout.earth.center.y, 0)
    releaseRing.computeLineDistances()
    scene.add(releaseRing)

    scene.remove(receptionRing)
    receptionRing.geometry.dispose()
    receptionRing = new THREE.LineLoop(ringGeometry(layout.moon.ringRadius), receptionMaterial)
    receptionRing.position.set(layout.moon.center.x, layout.moon.center.y, 0)
    receptionRing.computeLineDistances()
    scene.add(receptionRing)

    const towardEarth = normalize({
      x: layout.earth.center.x - layout.moon.center.x,
      y: layout.earth.center.y - layout.moon.center.y,
    })
    depot.position.set(
      layout.moon.center.x + towardEarth.x * layout.moon.radius * 0.92,
      layout.moon.center.y + towardEarth.y * layout.moon.radius * 0.92,
      2,
    )
    depot.scale.setScalar(DEPOT_PX * layout.pxToUnits)

    const capsuleSize = CAPSULE_PX * layout.pxToUnits
    cargo.scale.set(capsuleSize, capsuleSize, 1)
    cargoGlow.scale.set(CAPSULE_GLOW_PX * layout.pxToUnits, CAPSULE_GLOW_PX * layout.pxToUnits, 1)
  }

  function applyCamera(): void {
    const bounds = cameraBounds(view, layout)
    camera.left = bounds.minX
    camera.right = bounds.maxX
    camera.bottom = bounds.minY
    camera.top = bounds.maxY
    camera.updateProjectionMatrix()
  }

  function toScreen(point: Vec2Like): ScreenPoint {
    const bounds = cameraBounds(view, layout)
    const spanX = bounds.maxX - bounds.minX
    const spanY = bounds.maxY - bounds.minY
    return {
      x: ((point.x - bounds.minX) / spanX) * width(),
      y: (1 - (point.y - bounds.minY) / spanY) * height(),
    }
  }

  function updatePath(points: FrameState['predictionPoints']): void {
    schematicPath = points.length >= 2 ? buildSchematicPath(points, layout) : null

    const positions: number[] = []
    if (schematicPath) {
      for (const run of schematicPath.runs) {
        for (let index = 0; index < run.length - 1; index += 1) {
          const a = run[index]
          const b = run[index + 1]
          if (!a || !b) continue
          positions.push(a.x, a.y, 0, b.x, b.y, 0)
        }
      }
    }
    const array = new Float32Array(positions)
    predictionGeometry.setAttribute('position', new THREE.BufferAttribute(array, 3))
    predictionGeometry.setDrawRange(0, array.length / 3)
    predictionGeometry.computeBoundingSphere()
    if (array.length >= 6) predictionLines.computeLineDistances()
    predictionLines.visible = array.length >= 6

    const departure = schematicPath?.departure ?? null
    departureConnector.visible = departure !== null
    if (departure) {
      departureConnector.geometry.dispose()
      departureConnector.geometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(departure.from.x, departure.from.y, 0),
        new THREE.Vector3(departure.to.x, departure.to.y, 0),
      ])
      departureConnector.computeLineDistances()
    }

    const approach = schematicPath?.approach ?? null
    approachConnector.visible = approach !== null
    if (approach) {
      approachConnector.geometry.dispose()
      approachConnector.geometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(approach.from.x, approach.from.y, 0),
        new THREE.Vector3(approach.to.x, approach.to.y, 0),
      ])
      approachConnector.computeLineDistances()
    }

    if (!schematicPath) {
      cargo.visible = false
      cargoGlow.visible = false
    }
  }

  function updateTrail(frame: FrameState): void {
    if (frame.trailRevision === currentTrailRevision) return
    currentTrailRevision = frame.trailRevision
    const positions: number[] = []
    let previous: Vec2Like | null = null
    const count = Math.min(frame.trailPoints.length, MAX_TRAIL_POINTS)
    for (let index = 0; index < count; index += 1) {
      const point = frame.trailPoints[index]
      if (!point) continue
      const mapped = toSchematic(layout, point)
      const insideEarth = distance(mapped, layout.earth.center) < layout.earth.radius + 0.02
      const insideMoon = distance(mapped, layout.moon.center) < layout.moon.radius + 0.02
      if (previous && !insideEarth && !insideMoon) {
        positions.push(previous.x, previous.y, 0, mapped.x, mapped.y, 0)
      }
      previous = insideEarth || insideMoon ? null : mapped
    }
    const array = new Float32Array(positions)
    trailGeometry.setAttribute('position', new THREE.BufferAttribute(array, 3))
    trailGeometry.setDrawRange(0, array.length / 3)
    trailGeometry.computeBoundingSphere()
    trailLines.visible = array.length >= 6
  }

  function clampOutsideBodies(point: Vec2Like): Vec2Like {
    for (const body of [layout.earth, layout.moon]) {
      if (distance(point, body.center) < body.radius + 0.025) {
        const direction = normalize({
          x: point.x - body.center.x || layout.moon.center.x - layout.earth.center.x,
          y: point.y - body.center.y || layout.moon.center.y - layout.earth.center.y,
        })
        return {
          x: body.center.x + direction.x * (body.radius + 0.03),
          y: body.center.y + direction.y * (body.radius + 0.03),
        }
      }
    }
    return point
  }

  function capsuleDisplayPosition(frame: FrameState): Vec2Like | null {
    if (!frame.cargoPositionKm) return null
    const mapped = toSchematic(layout, frame.cargoPositionKm)

    // The launcher close-up owns the cargo before release. The main scene
    // takes over after the release hand-off so two copies are not shown.
    if (frame.phase === 'CONFIGURING' || frame.phase === 'SPINNING_UP') {
      return null
    }
    if (frame.phase === 'DEPARTURE' && schematicPath?.departure) {
      const handoff = 0.45
      if (frame.phaseProgress < handoff) return null
      const t = (frame.phaseProgress - handoff) / (1 - handoff)
      return lerpPoint(
        schematicPath.departure.from,
        schematicPath.departure.to,
        easeInOut(t),
      )
    }
    if (frame.phase === 'APPROACH' && schematicPath?.approach) {
      return lerpPoint(
        schematicPath.approach.from,
        schematicPath.approach.to,
        easeInOut(frame.phaseProgress),
      )
    }
    return clampOutsideBodies(mapped)
  }

  function updateCargo(frame: FrameState, time: number): void {
    const position = capsuleDisplayPosition(frame)
    if (!position) {
      cargo.visible = false
      cargoGlow.visible = false
      lastCapsule = null
      return
    }
    cargo.position.set(position.x, position.y, 6)
    cargoGlow.position.set(position.x, position.y, 5)
    const pulse = reducedMotion ? 1 : 1 + Math.sin(time * 0.004) * 0.05
    const baseScale = CAPSULE_PX * layout.pxToUnits
    cargo.scale.setScalar(baseScale * pulse)
    cargoGlow.scale.setScalar(CAPSULE_GLOW_PX * layout.pxToUnits * pulse)
    cargo.visible = true
    cargoGlow.visible = share !== null

    if (lastCapsule) {
      const dx = position.x - lastCapsule.x
      const dy = position.y - lastCapsule.y
      if (Math.hypot(dx, dy) > 1e-6) {
        cargoMaterial.rotation = Math.atan2(dy, dx) - Math.PI / 2
      }
    }
    lastCapsule = { ...position }
  }

  function resize(): void {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
    renderer.setSize(width(), height(), false)
    layout = createSchematicLayout(width(), height(), {
      earthRadiusKm: gameData.physicalConstants.earth.radiusKm,
      moonRadiusKm: gameData.physicalConstants.moon.radiusKm,
      moonPositionKm: gameData.physicalConstants.moonPositionKm,
    })
    setBodyLayout()
    applyCamera()
    updateTrail(getFrame())
    if (currentPredictionVersion >= 0) {
      updatePath(getFrame().predictionPoints)
    }
    options.onView?.()
  }

  const observer = new ResizeObserver(() => resize())
  observer.observe(container)

  function animate(time: number): void {
    if (!running) return
    const dt = lastFrameTime === 0 ? 0.016 : Math.min((time - lastFrameTime) / 1000, 0.1)
    lastFrameTime = time
    const frame = getFrame()

    if (frame.predictionVersion !== currentPredictionVersion) {
      currentPredictionVersion = frame.predictionVersion
      updatePath(frame.predictionPoints)
    }
    updateTrail(frame)

    const displayPosition = capsuleDisplayPosition(frame)
    const target = targetCameraView({
      phase: frame.phase,
      phaseProgress: frame.phaseProgress,
      resultKind: frame.resultKind,
      layout,
      cargo: displayPosition,
      reducedMotion,
    })
    view = smoothCameraView(view, target, dt, reducedMotion)
    applyCamera()

    updateCargo(frame, time)
    earth.rotation.y += reducedMotion ? 0 : dt * 0.02
    options.onView?.()
    renderer.render(scene, camera)
    raf = requestAnimationFrame(animate)
  }

  let raf = 0
  let running = false

  function start(): void {
    if (running) return
    running = true
    lastFrameTime = 0
    resize()
    raf = requestAnimationFrame(animate)
  }

  function stop(): void {
    running = false
    cancelAnimationFrame(raf)
  }

  function getScreenPoint(x: number, y: number): ScreenPoint | null {
    return toScreen(toSchematic(layout, { x, y }))
  }

  function getBodyScreenPoint(body: 'earth' | 'moon'): BodyScreenPoint | null {
    const target = body === 'earth' ? layout.earth : layout.moon
    const bounds = cameraBounds(view, layout)
    const spanX = bounds.maxX - bounds.minX
    if (spanX <= 0) return null
    const screen = toScreen(target.center)
    return {
      ...screen,
      radiusPx: (target.radius / spanX) * width(),
    }
  }

  function getConnectorScreenPoint(kind: 'departure' | 'approach'): ScreenPoint | null {
    const connector =
      kind === 'departure' ? schematicPath?.departure : schematicPath?.approach
    if (!connector) return null
    const dx = connector.to.x - connector.from.x
    const dy = connector.to.y - connector.from.y
    const length = Math.hypot(dx, dy) || 1
    const offset = 0.03
    const middle = lerpPoint(connector.from, connector.to, 0.5)
    return toScreen({
      x: middle.x + (-dy / length) * offset,
      y: middle.y + (dx / length) * offset,
    })
  }

  function dispose(): void {
    stop()
    observer.disconnect()
    motionQuery.removeEventListener('change', onMotionChange)
    for (const item of disposables) item.dispose()
    releaseRing.geometry.dispose()
    receptionRing.geometry.dispose()
    predictionGeometry.dispose()
    trailGeometry.dispose()
    departureConnector.geometry.dispose()
    approachConnector.geometry.dispose()
    renderer.dispose()
    renderer.domElement.remove()
    scene.clear()
  }

  return {
    start,
    stop,
    resize,
    dispose,
    getScreenPoint,
    getBodyScreenPoint,
    getConnectorScreenPoint,
  }
}
