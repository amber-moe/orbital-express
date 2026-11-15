<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import type { MissionController } from '../game/missionController'
import {
  createSpaceScene,
  type BodyScreenPoint,
  type SpaceSceneHandle,
} from '../rendering/createSpaceScene'

const props = defineProps<{ controller: MissionController }>()

const host = ref<HTMLDivElement | null>(null)
const earthLabel = ref<HTMLDivElement | null>(null)
const moonLabel = ref<HTMLDivElement | null>(null)
const departureLabel = ref<HTMLDivElement | null>(null)
const approachLabel = ref<HTMLDivElement | null>(null)
const failed = ref(false)

let handle: SpaceSceneHandle | null = null

function clampLeft(element: HTMLDivElement, centerX: number): number {
  const halfWidth = (element.offsetWidth || 160) / 2
  const hostWidth = host.value?.clientWidth ?? 0
  return Math.min(
    Math.max(centerX, halfWidth + 8),
    Math.max(halfWidth + 8, hostWidth - halfWidth - 8),
  )
}

function hide(element: HTMLDivElement | null): void {
  if (element) element.dataset.visible = 'false'
}

function positionBodyLabel(
  element: HTMLDivElement | null,
  body: BodyScreenPoint | null,
  below: boolean,
): void {
  if (!element) return
  if (!body) {
    hide(element)
    return
  }
  const hostWidth = host.value?.clientWidth ?? 0
  const hostHeight = host.value?.clientHeight ?? 0
  if (body.x < 0 || body.x > hostWidth || body.y < 0 || body.y > hostHeight) {
    hide(element)
    return
  }
  element.style.left = `${clampLeft(element, body.x)}px`
  element.style.top = `${body.y + (below ? body.radiusPx + 10 : -body.radiusPx - 10)}px`
  element.dataset.visible = 'true'
}

function positionConnectorLabel(
  element: HTMLDivElement | null,
  kind: 'departure' | 'approach',
): void {
  if (!element) return
  const hostWidth = host.value?.clientWidth ?? 0
  const hostHeight = host.value?.clientHeight ?? 0
  const body = handle?.getBodyScreenPoint(kind === 'departure' ? 'earth' : 'moon') ?? null
  const bodyVisible =
    body !== null &&
    body.x >= 0 &&
    body.x <= hostWidth &&
    body.y >= 0 &&
    body.y <= hostHeight
  const point = handle?.getConnectorScreenPoint(kind) ?? null
  if (
    !bodyVisible ||
    !point ||
    point.x < 18 ||
    point.x > hostWidth - 18 ||
    point.y < 18 ||
    point.y > hostHeight - 18
  ) {
    hide(element)
    return
  }
  element.style.left = `${clampLeft(element, point.x)}px`
  element.style.top = `${point.y}px`
  element.dataset.visible = 'true'
}

function positionLabels(): void {
  if (!handle) return
  positionBodyLabel(earthLabel.value, handle.getBodyScreenPoint('earth'), false)
  positionBodyLabel(moonLabel.value, handle.getBodyScreenPoint('moon'), true)
  positionConnectorLabel(departureLabel.value, 'departure')
  positionConnectorLabel(approachLabel.value, 'approach')
}

onMounted(() => {
  if (!host.value) return
  try {
    handle = createSpaceScene(host.value, () => props.controller.getFrameState(), {
      onView: positionLabels,
    })
    handle.start()
    positionLabels()
  } catch (error) {
    failed.value = true
    console.error('WebGL scene failed to start', error)
  }
})

onBeforeUnmount(() => {
  handle?.dispose()
  handle = null
})
</script>

<template>
  <div ref="host" class="viewport">
    <template v-if="!failed">
      <div ref="earthLabel" class="body-label earth">
        <strong>EARTH TERMINAL</strong>
        <span>Launch facility</span>
      </div>
      <div ref="moonLabel" class="body-label moon">
        <strong>SELENE DEPOT</strong>
        <span>Reception facility</span>
      </div>
      <div
        ref="departureLabel"
        class="connector-label departure"
        title="Schematic connector, not the simulated path"
      >
        Departure
      </div>
      <div
        ref="approachLabel"
        class="connector-label approach"
        title="Schematic connector, not the simulated path"
      >
        Approach
      </div>
      <div class="schematic-badge">SCHEMATIC VIEW · NOT TO SCALE</div>
    </template>

    <div class="legend" aria-hidden="true">
      <span><i class="swatch flown"></i>Flown</span>
      <span><i class="swatch predicted"></i>Planned</span>
    </div>

    <div v-if="failed" class="fallback" role="status">
      <span class="fallback-eye">VISUAL UNAVAILABLE</span>
      <h3>WebGL could not start</h3>
      <p>
        The mission planner and flight simulation still work. Enable WebGL 2 or open the build in
        a supported browser to see the Earth–Moon route.
      </p>
    </div>
  </div>
</template>

<style scoped>
.viewport {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background:
    radial-gradient(900px 520px at 22% 28%, rgba(28, 74, 102, 0.12), transparent 62%),
    radial-gradient(700px 460px at 82% 68%, rgba(24, 54, 72, 0.1), transparent 62%),
    var(--ink-deep);
}

.viewport :deep(.space-canvas) {
  position: absolute;
  inset: 0;
  display: block;
  width: 100% !important;
  height: 100% !important;
  z-index: 0;
}

.body-label {
  position: absolute;
  z-index: 2;
  transform: translateX(-50%);
  padding: 3px 6px;
  border-radius: 3px;
  background: rgba(6, 13, 24, 0.55);
  text-align: center;
  font-family: var(--font-mono);
  pointer-events: none;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.3s ease;
  white-space: nowrap;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8);
}

.body-label[data-visible='true'],
.connector-label[data-visible='true'] {
  opacity: 1;
  visibility: visible;
}

.body-label strong {
  display: block;
  font-size: 10px;
  letter-spacing: 0.15em;
  font-weight: 500;
}

.body-label span {
  display: block;
  margin-top: 2px;
  font-size: 8.5px;
  letter-spacing: 0.07em;
  color: var(--muted-dim);
}

.body-label.earth strong {
  color: var(--ivory);
}

.body-label.moon strong {
  color: var(--cyan);
}

.connector-label {
  position: absolute;
  z-index: 2;
  transform: translate(-50%, -50%);
  padding: 2px 7px;
  border: 1px solid rgba(255, 180, 59, 0.4);
  border-radius: 999px;
  background: rgba(6, 13, 24, 0.72);
  font-family: var(--font-mono);
  font-size: 8.5px;
  letter-spacing: 0.1em;
  color: var(--amber);
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.25s ease;
  white-space: nowrap;
  pointer-events: none;
}

.connector-label[data-visible='true'] {
  visibility: visible;
}

.schematic-badge {
  position: absolute;
  top: 14px;
  right: 16px;
  z-index: 2;
  padding: 4px 8px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: rgba(9, 19, 31, 0.72);
  font-family: var(--font-mono);
  font-size: 8.5px;
  letter-spacing: 0.1em;
  color: var(--muted);
  pointer-events: none;
}

.legend {
  position: absolute;
  right: 16px;
  bottom: 16px;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 7px 10px;
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  background: rgba(9, 19, 31, 0.78);
  backdrop-filter: blur(8px);
  font-family: var(--font-mono);
  font-size: 9.5px;
  letter-spacing: 0.05em;
  color: var(--muted);
  pointer-events: none;
}

.legend span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.swatch {
  width: 14px;
  height: 0;
  border-top: 1px solid var(--cyan);
}

.swatch.predicted {
  border-top-style: dashed;
  opacity: 0.7;
}

.fallback {
  position: absolute;
  inset: 0;
  z-index: 4;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 32px;
  text-align: center;
  background: radial-gradient(circle at center, rgba(13, 25, 38, 0.92), rgba(6, 13, 24, 0.98));
}

.fallback-eye {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.16em;
  color: var(--amber);
}

.fallback h3 {
  font-size: 20px;
  font-weight: 600;
}

.fallback p {
  max-width: 460px;
  font-size: 13px;
  line-height: 1.6;
  color: var(--muted);
}

@media (max-height: 720px) {
  .legend {
    display: none;
  }
}

@media (max-width: 560px) {
  .legend,
  .body-label,
  .connector-label,
  .schematic-badge {
    display: none;
  }
}
</style>
