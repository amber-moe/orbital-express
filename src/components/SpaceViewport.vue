<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { gameData } from '../game/data'
import type { MissionController } from '../game/missionController'
import {
  createSpaceScene,
  type SpaceSceneHandle,
} from '../rendering/createSpaceScene'

const props = defineProps<{ controller: MissionController }>()

const host = ref<HTMLDivElement | null>(null)
const earthLabel = ref<HTMLDivElement | null>(null)
const moonLabel = ref<HTMLDivElement | null>(null)
const failed = ref(false)

let handle: SpaceSceneHandle | null = null

function positionLabel(
  element: HTMLDivElement | null,
  x: number,
  y: number,
  radiusKm: number,
  below = true,
): void {
  if (!handle || !element) return
  const center = handle.getScreenPoint(x, y)
  const edge = handle.getScreenPoint(x, y + radiusKm)
  if (!center || !edge) return
  const radiusPx = Math.hypot(edge.x - center.x, edge.y - center.y)
  element.style.left = `${center.x}px`
  element.style.top = `${center.y + (below ? radiusPx + 10 : -radiusPx - 10)}px`
  element.dataset.visible = 'true'
}

function positionLabels(): void {
  positionLabel(
    earthLabel.value,
    0,
    0,
    gameData.physicalConstants.earth.radiusKm,
    false,
  )
  positionLabel(
    moonLabel.value,
    gameData.physicalConstants.moonPositionKm.x,
    gameData.physicalConstants.moonPositionKm.y,
    gameData.assumptions.simulation.receptionZoneRadiusKm,
  )
}

onMounted(() => {
  if (!host.value) return
  try {
    handle = createSpaceScene(host.value, () => props.controller.getFrameState(), {
      onLayout: positionLabels,
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
        <strong>EARTH</strong>
        <span>LAUNCH FACILITY · 6,571 km RING</span>
      </div>
      <div ref="moonLabel" class="body-label moon">
        <strong>MOON</strong>
        <span>SELENE DEPOT · 12,000 km ZONE</span>
      </div>
    </template>

    <div class="legend" aria-hidden="true">
      <span><i class="swatch predicted"></i>Predicted</span>
      <span><i class="swatch flown"></i>Flown</span>
      <span><i class="swatch zone"></i>Reception</span>
      <span class="scale">1:1 distance · bodies true radius · cargo marker enlarged</span>
    </div>

    <div v-if="failed" class="fallback" role="status">
      <span class="fallback-eye">VISUAL UNAVAILABLE</span>
      <h3>WebGL could not start</h3>
      <p>
        The mission planner and deterministic simulation still work. Enable WebGL 2 or open the
        build in a supported browser to see the Earth–Moon trajectory.
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
  transition: opacity 0.3s ease;
  white-space: nowrap;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8);
}

.body-label[data-visible='true'] {
  opacity: 1;
}

.body-label strong {
  display: block;
  font-size: 8px;
  letter-spacing: 0.18em;
  font-weight: 500;
}

.body-label span {
  display: block;
  margin-top: 2px;
  font-size: 6px;
  letter-spacing: 0.09em;
  color: var(--muted-dim);
}

.body-label.earth strong {
  color: var(--ivory);
}

.body-label.moon strong {
  color: var(--cyan);
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
  font-size: 7px;
  letter-spacing: 0.06em;
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

.swatch.zone {
  width: 8px;
  height: 8px;
  border: 1px dashed var(--cyan);
  border-radius: 50%;
  opacity: 0.7;
}

.legend .scale {
  color: var(--muted-dim);
  border-left: 1px solid var(--line);
  padding-left: 12px;
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
  font-size: 8px;
  letter-spacing: 0.18em;
  color: var(--amber);
}

.fallback h3 {
  font-size: 20px;
  font-weight: 600;
}

.fallback p {
  max-width: 420px;
  font-size: 11px;
  line-height: 1.6;
  color: var(--muted);
}

@media (max-height: 720px) {
  .legend {
    display: none;
  }
}
</style>
