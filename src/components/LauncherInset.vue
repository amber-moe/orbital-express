<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { gameData } from '../game/data'
import {
  PAYLOAD_LOCAL_ANGLE,
  clamp01,
  coastAngle,
  coastDisplacement,
  orbitEndpoint,
  orbitTangent,
  payloadOpacity,
  releaseRotationRadians,
  spinAngle,
} from '../game/centrifugeAnimation'
import type { LaunchProfileData, MissionPhase, MissionTotals } from '../game/types'

const props = defineProps<{
  phase: MissionPhase
  profile: LaunchProfileData
  totals: MissionTotals
  /** Read-only accessor into the mission frame; no deep reactive scene graph. */
  getProgress: () => number
}>()

const HUB_X = 120
const HUB_Y = 68
const POD_X = 66
const COUNTERWEIGHT_X = 174
const POD_RADIUS = HUB_X - POD_X
const RELEASE_DISTANCE = 52

const simulation = gameData.assumptions.simulation
const releaseRotation = releaseRotationRadians(props.profile)
const coastTotal = coastDisplacement(
  releaseRotation,
  simulation.spinUpSeconds,
  simulation.departureSeconds,
)

const progress = ref(0)
const angle = ref(0)
const released = ref(false)
const releaseProgress = ref(0)
const reducedMotion = ref(
  typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches,
)

const motionQuery =
  typeof window !== 'undefined'
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : null

const onMotionChange = (): void => {
  reducedMotion.value = motionQuery?.matches ?? false
}

const spinning = computed(() => props.phase === 'SPINNING_UP')
const expanded = computed(
  () => props.phase === 'SPINNING_UP' || props.phase === 'DEPARTURE',
)
const inFlight = computed(
  () =>
    props.phase === 'DEPARTURE' ||
    props.phase === 'TRANSFER' ||
    props.phase === 'APPROACH' ||
    props.phase === 'RESULT',
)

const statusLabel = computed(() => {
  if (props.phase === 'SPINNING_UP') return 'SPINNING UP'
  if (props.phase === 'DEPARTURE') return 'RELEASED'
  if (props.phase === 'TRANSFER') return 'IN TRANSIT'
  if (props.phase === 'APPROACH') return 'BRAKING'
  if (props.phase === 'RESULT') return 'CYCLE COMPLETE'
  return 'READY'
})

const spinProgress = computed(() =>
  props.phase === 'SPINNING_UP' ? progress.value : released.value ? 1 : 0,
)

const angleDegrees = computed(() => (angle.value * 180) / Math.PI)

const releaseEndpoint = orbitEndpoint(
  { x: HUB_X, y: HUB_Y },
  POD_RADIUS,
  PAYLOAD_LOCAL_ANGLE,
  releaseRotation,
)
const releaseTangent = orbitTangent(PAYLOAD_LOCAL_ANGLE, releaseRotation)
const releaseTangentDegrees = (Math.atan2(releaseTangent.y, releaseTangent.x) * 180) / Math.PI

const releasedTransform = computed(() => {
  const distance = RELEASE_DISTANCE * releaseProgress.value
  const x = releaseEndpoint.x + releaseTangent.x * distance
  const y = releaseEndpoint.y + releaseTangent.y * distance
  return `translate(${x} ${y}) rotate(${releaseTangentDegrees})`
})

const releasedOpacity = computed(() => payloadOpacity(releaseProgress.value))
const showReleasedPod = computed(
  () =>
    released.value &&
    props.phase === 'DEPARTURE' &&
    !reducedMotion.value &&
    releasedOpacity.value > 0.01,
)

function reset(): void {
  progress.value = 0
  angle.value = 0
  released.value = false
  releaseProgress.value = 0
}

watch(
  () => props.phase,
  (phase, previous) => {
    if (phase === 'CONFIGURING') {
      reset()
      return
    }
    if (phase === 'SPINNING_UP') {
      released.value = false
      releaseProgress.value = 0
      progress.value = 0
      angle.value = 0
      return
    }
    if (phase === 'DEPARTURE' && previous === 'SPINNING_UP') {
      released.value = true
      releaseProgress.value = 0
      angle.value = releaseRotation
      return
    }
    if (phase === 'DEPARTURE') {
      released.value = true
      angle.value = releaseRotation
      return
    }
    if (phase === 'TRANSFER' || phase === 'APPROACH' || phase === 'RESULT') {
      released.value = true
      releaseProgress.value = 1
      angle.value = releaseRotation + coastTotal
    }
  },
)

let raf = 0

function tick(): void {
  if (props.phase === 'CONFIGURING') {
    if (angle.value !== 0) angle.value = 0
    if (released.value) released.value = false
  } else if (props.phase === 'SPINNING_UP') {
    const p = clamp01(props.getProgress())
    progress.value = p
    angle.value = reducedMotion.value ? releaseRotation : spinAngle(p, releaseRotation)
  } else if (props.phase === 'DEPARTURE') {
    const p = clamp01(props.getProgress())
    releaseProgress.value = reducedMotion.value ? 1 : p
    angle.value = reducedMotion.value
      ? releaseRotation
      : coastAngle(p, releaseRotation, coastTotal)
  } else if (inFlight.value) {
    angle.value = releaseRotation + coastTotal
  }

  raf = requestAnimationFrame(tick)
}

onMounted(() => {
  motionQuery?.addEventListener('change', onMotionChange)
  raf = requestAnimationFrame(tick)
})

onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  motionQuery?.removeEventListener('change', onMotionChange)
})
</script>

<template>
  <aside
    class="launcher"
    :class="{ compact: !expanded, expanded }"
    aria-label="Centrifuge launcher close-up"
  >
    <header class="launcher-head">
      <span class="eyebrow">LAUNCH RING</span>
      <span class="phase" :class="{ active: spinning || inFlight }">{{ statusLabel }}</span>
    </header>

    <p class="compact-readout">
      RELEASE <b>{{ totals.releaseSpeedKms.toFixed(2) }}</b> km/s ·
      LOAD <b>{{ totals.launchLoadG.toFixed(1) }}</b> g ·
      SPIN <b>×{{ totals.releaseSpeedScale.toFixed(2) }}</b>
    </p>

    <div class="expanded-content">
    <svg class="rotor" viewBox="0 0 240 128" role="img" aria-label="Centrifuge arm, counterweight and cargo pod">
      <circle :cx="HUB_X" :cy="HUB_Y" r="62" class="rotor-halo" />
      <circle :cx="HUB_X" :cy="HUB_Y" r="54" class="rotor-track" />
      <circle
        :cx="HUB_X"
        :cy="HUB_Y"
        r="54"
        class="rotor-progress"
        :style="{ strokeDashoffset: 339.3 * (1 - spinProgress) }"
      />

      <g :transform="`rotate(${angleDegrees} ${HUB_X} ${HUB_Y})`">
        <line :x1="HUB_X" :y1="HUB_Y" :x2="POD_X" :y2="HUB_Y" class="arm" />
        <line :x1="HUB_X" :y1="HUB_Y" :x2="COUNTERWEIGHT_X" :y2="HUB_Y" class="arm faint" />
        <circle :cx="COUNTERWEIGHT_X" :cy="HUB_Y" r="6.5" class="counterweight" />

        <g v-if="!released" class="pod">
          <rect :x="POD_X - 10" :y="HUB_Y - 8" width="20" height="16" rx="4" class="pod-body" />
          <rect :x="POD_X - 10" :y="HUB_Y - 1" width="20" height="4" class="pod-band" />
          <rect :x="POD_X - 7" :y="HUB_Y - 5" width="14" height="3" rx="1" class="pod-window" />
          <path
            :d="`M${POD_X - 4} ${HUB_Y + 8} L${POD_X + 4} ${HUB_Y + 8} L${POD_X + 6} ${HUB_Y + 14} L${POD_X - 6} ${HUB_Y + 14} Z`"
            class="pod-engine"
          />
        </g>
      </g>

      <g
        v-if="showReleasedPod"
        :transform="releasedTransform"
        :opacity="releasedOpacity"
        class="pod released-pod"
      >
        <rect x="-10" y="-8" width="20" height="16" rx="4" class="pod-body" />
        <rect x="-10" y="-1" width="20" height="4" class="pod-band" />
        <rect x="-7" y="-5" width="14" height="3" rx="1" class="pod-window" />
        <path d="M-4 8 L4 8 L6 14 L-6 14 Z" class="pod-engine" />
      </g>

      <circle :cx="HUB_X" :cy="HUB_Y" r="7" class="hub" />
      <circle :cx="HUB_X" :cy="HUB_Y" r="2.4" class="hub-core" />

      <text :x="HUB_X" :y="118" class="svg-label">RELEASE</text>
    </svg>

    <dl class="readouts">
      <div>
        <dt>RELEASE</dt>
        <dd>{{ totals.releaseSpeedKms.toFixed(2) }} km/s</dd>
      </div>
      <div>
        <dt>LOAD</dt>
        <dd>{{ totals.launchLoadG.toFixed(1) }} g</dd>
      </div>
      <div>
        <dt>SPIN</dt>
        <dd>×{{ totals.releaseSpeedScale.toFixed(2) }}</dd>
      </div>
    </dl>
    </div>
  </aside>
</template>

<style scoped>
.launcher {
  position: absolute;
  left: 16px;
  bottom: 16px;
  width: 276px;
  padding: 11px 13px 10px;
  background: rgba(9, 19, 31, 0.9);
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  backdrop-filter: blur(10px);
  box-shadow: var(--shadow-panel);
  pointer-events: none;
  transition: width 0.24s ease, padding 0.24s ease;
}

.launcher.compact {
  width: 272px;
  padding: 7px 10px 8px;
}

.compact-readout {
  max-height: 0;
  margin: 0;
  overflow: hidden;
  opacity: 0;
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.02em;
  color: var(--muted);
  white-space: nowrap;
  transition: max-height 0.24s ease, opacity 0.18s ease, margin 0.24s ease;
}

.launcher.compact .compact-readout {
  max-height: 20px;
  margin-top: 4px;
  opacity: 1;
}

.compact-readout b {
  font-weight: 400;
  color: var(--ivory);
}

.expanded-content {
  max-height: 220px;
  overflow: hidden;
  opacity: 1;
  transition: max-height 0.28s ease, opacity 0.2s ease;
}

.launcher.compact .expanded-content {
  max-height: 0;
  opacity: 0;
}

.launcher-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.eyebrow {
  font-family: var(--font-mono);
  font-size: 9.5px;
  letter-spacing: 0.15em;
  color: var(--muted-dim);
}

.phase {
  font-family: var(--font-mono);
  font-size: 9.5px;
  letter-spacing: 0.1em;
  color: var(--muted);
}

.phase.active {
  color: var(--cyan);
}

.rotor {
  display: block;
  width: 100%;
  height: 108px;
  margin: 2px 0 0;
}

.rotor-halo {
  fill: none;
  stroke: rgba(76, 228, 209, 0.05);
  stroke-width: 26;
}

.rotor-track {
  fill: none;
  stroke: rgba(145, 164, 181, 0.15);
  stroke-width: 1;
}

.rotor-progress {
  fill: none;
  stroke: var(--cyan);
  stroke-width: 2;
  stroke-linecap: round;
  stroke-dasharray: 339.3;
  stroke-dashoffset: 339.3;
  transform: rotate(-90deg);
  transform-origin: 120px 68px;
  opacity: 0.75;
}

.arm {
  stroke: var(--muted);
  stroke-width: 2;
  stroke-linecap: round;
}

.arm.faint {
  stroke: rgba(145, 164, 181, 0.28);
  stroke-width: 1.2;
}

.counterweight {
  fill: rgba(145, 164, 181, 0.3);
  stroke: rgba(145, 164, 181, 0.6);
  stroke-width: 1;
}

.pod-body {
  fill: var(--ivory);
  stroke: rgba(255, 255, 255, 0.8);
  stroke-width: 1;
}

.pod-band {
  fill: var(--amber);
}

.pod-window {
  fill: var(--cyan);
}

.pod-engine {
  fill: #25313d;
  stroke: rgba(255, 255, 255, 0.15);
  stroke-width: 0.6;
}

.hub {
  fill: rgba(76, 228, 209, 0.1);
  stroke: var(--cyan);
  stroke-width: 1;
}

.hub-core {
  fill: var(--cyan);
}

.svg-label {
  font-family: var(--font-mono);
  font-size: 8px;
  letter-spacing: 0.12em;
  fill: var(--muted);
  text-anchor: middle;
}

.svg-label.dim {
  fill: var(--muted-dim);
}

.readouts {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 4px;
  margin: 0;
  padding-top: 8px;
  border-top: 1px solid var(--line);
}

.readouts dt {
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.08em;
  color: var(--muted-dim);
}

.readouts dd {
  margin: 2px 0 0;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--ivory);
  font-variant-numeric: tabular-nums;
}

@media (max-height: 720px) {
  .launcher {
    width: 246px;
  }
  .rotor {
    height: 86px;
  }
}

@media (max-width: 980px) {
  .launcher {
    display: none;
  }
}
</style>
