import * as THREE from 'three'
import { gameData } from '../game/data'
import type { FrameState } from '../game/missionController'
import {
  computeSceneBounds,
  fitBoundsToAspect,
  toScene,
  type Bounds,
} from './coordinateTransform'

export interface SpaceSceneOptions {
  onLayout?: () => void
}

export interface ScreenPoint {
  x: number
  y: number
}

export interface SpaceSceneHandle {
  start(): void
  stop(): void
  resize(): void
  dispose(): void
  getScreenPoint(x: number, y: number): ScreenPoint | null
}

const MAX_TRAIL_POINTS = 12000

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
    gradient.addColorStop(0, 'rgba(255,255,255,0.95)')
    gradient.addColorStop(0.28, 'rgba(255,255,255,0.34)')
    gradient.addColorStop(0.62, 'rgba(255,255,255,0.07)')
    gradient.addColorStop(1, 'rgba(255,255,255,0)')
    context.fillStyle = gradient
    context.fillRect(0, 0, size, size)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

function ringGeometry(
  centerX: number,
  centerY: number,
  radius: number,
  segments = 160,
): THREE.BufferGeometry {
  const points: THREE.Vector3[] = []
  for (let index = 0; index < segments; index += 1) {
    const angle = (index / segments) * Math.PI * 2
    points.push(
      new THREE.Vector3(
        centerX + Math.cos(angle) * radius,
        centerY + Math.sin(angle) * radius,
        0,
      ),
    )
  }
  return new THREE.BufferGeometry().setFromPoints(points)
}

function starField(): THREE.BufferGeometry {
  const count = 780
  const positions = new Float32Array(count * 3)
  for (let index = 0; index < count; index += 1) {
    positions[index * 3] = (Math.random() - 0.5) * 1_600_000
    positions[index * 3 + 1] = (Math.random() - 0.5) * 1_000_000
    positions[index * 3 + 2] = -400 - Math.random() * 200
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  return geometry
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
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 5000)
  camera.position.set(0, 0, 100)

  const disposables: { dispose: () => void }[] = []
  const earthRadius = gameData.physicalConstants.earth.radiusKm
  const moonRadius = gameData.physicalConstants.moon.radiusKm
  const zoneRadius = gameData.assumptions.simulation.receptionZoneRadiusKm
  const moonWorld = gameData.physicalConstants.moonPositionKm
  const moonScene = toScene(moonWorld.x, moonWorld.y)

  const share = glowTexture()
  disposables.push(share)

  scene.add(new THREE.AmbientLight(0x9cc5e2, 1.35))
  const keyLight = new THREE.DirectionalLight(0xfff0d2, 2.4)
  keyLight.position.set(-1, -0.6, 2)
  scene.add(keyLight)
  const rimLight = new THREE.DirectionalLight(0x4ce4d1, 0.6)
  rimLight.position.set(1, 0.8, -1)
  scene.add(rimLight)

  const earthMaterial = new THREE.MeshStandardMaterial({
    color: 0x1f5f7d,
    emissive: 0x04121c,
    roughness: 0.95,
    metalness: 0,
  })
  const earthGeometry = new THREE.SphereGeometry(earthRadius, 48, 32)
  const earth = new THREE.Mesh(earthGeometry, earthMaterial)
  scene.add(earth)
  disposables.push(earthGeometry, earthMaterial)

  const moonMaterial = new THREE.MeshStandardMaterial({
    color: 0x9aa6b2,
    emissive: 0x0a1017,
    roughness: 1,
    metalness: 0,
  })
  const moonGeometry = new THREE.SphereGeometry(moonRadius, 40, 28)
  const moon = new THREE.Mesh(moonGeometry, moonMaterial)
  moon.position.set(moonScene.x, moonScene.y, 0)
  scene.add(moon)
  disposables.push(moonGeometry, moonMaterial)

  const earthGlowMaterial = new THREE.SpriteMaterial({
    map: share,
    color: 0x4a9ec4,
    transparent: true,
    opacity: 0.34,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
  const earthGlow = new THREE.Sprite(earthGlowMaterial)
  earthGlow.scale.set(earthRadius * 4.2, earthRadius * 4.2, 1)
  scene.add(earthGlow)
  disposables.push(earthGlowMaterial)

  const moonGlowMaterial = new THREE.SpriteMaterial({
    map: share,
    color: 0xb8c7d6,
    transparent: true,
    opacity: 0.3,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
  const moonGlow = new THREE.Sprite(moonGlowMaterial)
  moonGlow.position.set(moonScene.x, moonScene.y, 0)
  moonGlow.scale.set(moonRadius * 5.4, moonRadius * 5.4, 1)
  scene.add(moonGlow)
  disposables.push(moonGlowMaterial)

  const zoneGeometry = ringGeometry(moonScene.x, moonScene.y, zoneRadius)
  const zoneMaterial = new THREE.LineDashedMaterial({
    color: 0x4ce4d1,
    dashSize: 1500,
    gapSize: 2300,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
  })
  const zoneRing = new THREE.LineLoop(zoneGeometry, zoneMaterial)
  zoneRing.computeLineDistances()
  scene.add(zoneRing)
  disposables.push(zoneGeometry, zoneMaterial)

  const insertionRadius = gameData.profiles['balanced']?.insertionRadiusKm ?? 6571
  const departureGeometry = ringGeometry(0, 0, insertionRadius)
  const departureMaterial = new THREE.LineDashedMaterial({
    color: 0xffb43b,
    dashSize: 900,
    gapSize: 1600,
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
  })
  const departureRing = new THREE.LineLoop(departureGeometry, departureMaterial)
  departureRing.computeLineDistances()
  scene.add(departureRing)
  disposables.push(departureGeometry, departureMaterial)

  const starGeometry = starField()
  const starMaterial = new THREE.PointsMaterial({
    color: 0x9fb4c7,
    size: 1.5,
    sizeAttenuation: false,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  })
  const stars = new THREE.Points(starGeometry, starMaterial)
  scene.add(stars)
  disposables.push(starGeometry, starMaterial)

  const predictionGeometry = new THREE.BufferGeometry()
  const predictionMaterial = new THREE.LineDashedMaterial({
    color: 0x4ce4d1,
    dashSize: 5200,
    gapSize: 6400,
    transparent: true,
    opacity: 0.68,
    depthWrite: false,
  })
  const predictionLine = new THREE.Line(predictionGeometry, predictionMaterial)
  predictionLine.visible = false
  scene.add(predictionLine)
  disposables.push(predictionGeometry, predictionMaterial)

  const trailGeometry = new THREE.BufferGeometry()
  const trailPositions = new Float32Array(MAX_TRAIL_POINTS * 3)
  const trailAttribute = new THREE.BufferAttribute(trailPositions, 3)
  trailAttribute.setUsage(THREE.DynamicDrawUsage)
  trailGeometry.setAttribute('position', trailAttribute)
  trailGeometry.setDrawRange(0, 0)
  const trailMaterial = new THREE.LineBasicMaterial({
    color: 0x4ce4d1,
    transparent: true,
    opacity: 0.95,
  })
  const trailLine = new THREE.Line(trailGeometry, trailMaterial)
  trailLine.visible = false
  scene.add(trailLine)
  disposables.push(trailGeometry, trailMaterial)

  const cargoGroup = new THREE.Group()
  const cargoGeometry = new THREE.BoxGeometry(2600, 2600, 2600)
  const cargoMaterial = new THREE.MeshBasicMaterial({ color: 0xffb43b })
  const cargo = new THREE.Mesh(cargoGeometry, cargoMaterial)
  cargo.rotation.z = Math.PI / 4
  cargoGroup.add(cargo)
  const cargoGlowMaterial = new THREE.SpriteMaterial({
    map: share,
    color: 0xffb43b,
    transparent: true,
    opacity: 0.42,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
  const cargoGlow = new THREE.Sprite(cargoGlowMaterial)
  cargoGlow.scale.set(13000, 13000, 1)
  cargoGroup.add(cargoGlow)
  cargoGroup.visible = false
  scene.add(cargoGroup)
  disposables.push(cargoGeometry, cargoMaterial, cargoGlowMaterial)

  let currentPredictionVersion = -1
  let currentTrailRevision = -1
  let cameraBounds: Bounds = { minX: -1, maxX: 1, minY: -1, maxY: 1 }

  function fitCamera(predictionPoints: FrameState['predictionPoints']): void {
    const viewWidth = width()
    const viewHeight = height()
    const aspect = viewWidth / viewHeight
    const circles = [
      { center: { x: 0, y: 0 }, radiusKm: earthRadius },
      { center: moonWorld, radiusKm: Math.max(moonRadius, zoneRadius) },
    ]
    const raw = computeSceneBounds(predictionPoints, circles, 0.02)
    // Asymmetric safe area: keep the lower-left free for the rotor inset and
    // give the upper-right Moon label breathing room.
    const spanX = raw.maxX - raw.minX
    const spanY = raw.maxY - raw.minY
    const padded = {
      minX: raw.minX - spanX * 0.05,
      maxX: raw.maxX + spanX * 0.05,
      minY: raw.minY - spanY * 0.16,
      maxY: raw.maxY + spanY * 0.09,
    }
    cameraBounds = fitBoundsToAspect(padded, aspect)
    camera.left = cameraBounds.minX
    camera.right = cameraBounds.maxX
    camera.bottom = cameraBounds.minY
    camera.top = cameraBounds.maxY
    camera.updateProjectionMatrix()
    options.onLayout?.()
  }

  function resize(): void {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
    renderer.setSize(width(), height(), false)
    fitCamera(getFrame().predictionPoints)
  }

  const observer = new ResizeObserver(() => resize())
  observer.observe(container)

  function rebuildPrediction(points: FrameState['predictionPoints']): void {
    if (points.length < 2) {
      predictionLine.visible = false
      return
    }
    const positions = new Float32Array(points.length * 3)
    for (let index = 0; index < points.length; index += 1) {
      const point = points[index]
      if (!point) continue
      const scenePoint = toScene(point.x, point.y)
      positions[index * 3] = scenePoint.x
      positions[index * 3 + 1] = scenePoint.y
      positions[index * 3 + 2] = 0
    }
    predictionGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    predictionGeometry.setDrawRange(0, points.length)
    predictionGeometry.computeBoundingSphere()
    predictionLine.computeLineDistances()
    predictionLine.visible = true
  }

  function updateTrail(frame: FrameState): void {
    if (frame.trailRevision === currentTrailRevision) return
    currentTrailRevision = frame.trailRevision
    const count = Math.min(frame.trailPoints.length, MAX_TRAIL_POINTS)
    for (let index = 0; index < count; index += 1) {
      const point = frame.trailPoints[index]
      if (!point) continue
      const scenePoint = toScene(point.x, point.y)
      trailPositions[index * 3] = scenePoint.x
      trailPositions[index * 3 + 1] = scenePoint.y
      trailPositions[index * 3 + 2] = 0
    }
    trailAttribute.needsUpdate = true
    trailGeometry.setDrawRange(0, count)
    trailLine.visible = count > 1
    if (count > 1) trailGeometry.computeBoundingSphere()
  }

  function updateCargo(frame: FrameState, time: number): void {
    if (!frame.cargoPositionKm) {
      cargoGroup.visible = false
      return
    }
    const scenePoint = toScene(frame.cargoPositionKm.x, frame.cargoPositionKm.y)
    cargoGroup.position.set(scenePoint.x, scenePoint.y, 0)
    const pulse = 1 + Math.sin(time * 0.004) * 0.07
    cargoGroup.scale.setScalar(pulse)
    cargoGroup.visible = true
  }

  let raf = 0
  let running = false

  function animate(time: number): void {
    if (!running) return
    const frame = getFrame()
    if (frame.predictionVersion !== currentPredictionVersion) {
      currentPredictionVersion = frame.predictionVersion
      rebuildPrediction(frame.predictionPoints)
      fitCamera(frame.predictionPoints)
    }
    updateTrail(frame)
    updateCargo(frame, time)
    renderer.render(scene, camera)
    raf = requestAnimationFrame(animate)
  }

  function start(): void {
    if (running) return
    running = true
    resize()
    raf = requestAnimationFrame(animate)
  }

  function stop(): void {
    running = false
    cancelAnimationFrame(raf)
  }

  function getScreenPoint(x: number, y: number): ScreenPoint | null {
    const scenePoint = toScene(x, y)
    const spanX = cameraBounds.maxX - cameraBounds.minX
    const spanY = cameraBounds.maxY - cameraBounds.minY
    if (spanX <= 0 || spanY <= 0) return null
    return {
      x: ((scenePoint.x - cameraBounds.minX) / spanX) * width(),
      y: (1 - (scenePoint.y - cameraBounds.minY) / spanY) * height(),
    }
  }

  function dispose(): void {
    stop()
    observer.disconnect()
    for (const item of disposables) item.dispose()
    predictionLine.geometry.dispose()
    renderer.dispose()
    renderer.domElement.remove()
    scene.clear()
  }

  return { start, stop, resize, dispose, getScreenPoint }
}
