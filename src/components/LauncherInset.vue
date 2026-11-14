<script setup lang="ts">
import { computed } from 'vue'
import type { LaunchProfileData, MissionPhase, MissionTotals } from '../game/types'

const props = defineProps<{
  phase: MissionPhase
  profile: LaunchProfileData
  totals: MissionTotals
}>()

const spinning = computed(() => props.phase === 'SPINNING_UP')
const released = computed(
  () => props.phase === 'DEPARTURE' || props.phase === 'TRANSFER' || props.phase === 'APPROACH' || props.phase === 'RESULT',
)
const statusLabel = computed(() => {
  if (props.phase === 'SPINNING_UP') return 'SPINNING UP'
  if (props.phase === 'DEPARTURE') return 'RELEASED'
  if (props.phase === 'TRANSFER') return 'IN TRANSIT'
  if (props.phase === 'APPROACH') return 'BRAKING'
  if (props.phase === 'RESULT') return 'CYCLE COMPLETE'
  return 'READY'
})
</script>

<template>
  <aside class="launcher" aria-label="Centrifuge launcher close-up">
    <header class="launcher-head">
      <span class="eyebrow">LAUNCH RING</span>
      <span class="phase" :class="{ active: spinning || released }">{{ statusLabel }}</span>
    </header>

    <svg class="rotor" viewBox="0 0 240 128" role="img" aria-label="Rotating centrifuge arm with cargo pod">
      <circle cx="120" cy="68" r="62" class="rotor-halo" />
      <circle cx="120" cy="68" r="54" class="rotor-track" />
      <circle cx="120" cy="68" r="54" class="rotor-ring" :class="{ spinning }" />
      <line x1="120" y1="68" x2="66" y2="68" class="arm" />
      <line x1="120" y1="68" x2="120" y2="30" class="arm faint" />
      <circle cx="120" cy="68" r="7" class="hub" />
      <circle cx="120" cy="68" r="2.4" class="hub-core" />
      <rect x="58" y="61" width="16" height="14" rx="2" class="pod" :class="{ released }" />
      <path d="M66 80 L66 98 M61.5 92.5 L66 98 L70.5 92.5" class="release-arrow" />
      <text x="66" y="116" class="svg-label">RELEASE</text>
      <text x="168" y="24" class="svg-label dim">PROGRADE</text>
    </svg>

    <dl class="readouts">
      <div>
        <dt>ROTOR</dt>
        <dd>{{ (profile.rotorRadiusM / 1000).toFixed(1) }} km</dd>
      </div>
      <div>
        <dt>RELEASE</dt>
        <dd>{{ totals.releaseSpeedKms.toFixed(2) }} km/s</dd>
      </div>
      <div>
        <dt>LOAD</dt>
        <dd>{{ totals.launchLoadG.toFixed(1) }} g</dd>
      </div>
      <div>
        <dt>ASSIST</dt>
        <dd>+{{ profile.assistedAscentDeltaVKms.toFixed(3) }}</dd>
      </div>
    </dl>
  </aside>
</template>

<style scoped>
.launcher {
  position: absolute;
  left: 16px;
  bottom: 16px;
  width: 252px;
  padding: 10px 12px 9px;
  background: rgba(9, 19, 31, 0.9);
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  backdrop-filter: blur(10px);
  box-shadow: var(--shadow-panel);
  pointer-events: none;
}

.launcher-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.eyebrow {
  font-family: var(--font-mono);
  font-size: 7px;
  letter-spacing: 0.17em;
  color: var(--muted-dim);
}

.phase {
  font-family: var(--font-mono);
  font-size: 7px;
  letter-spacing: 0.12em;
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

.rotor-ring {
  fill: none;
  stroke: rgba(76, 228, 209, 0.55);
  stroke-width: 1;
  stroke-dasharray: 3 7;
  transform-origin: 120px 68px;
}

.rotor-ring.spinning {
  animation: rotor-spin 1.2s linear infinite;
}

.arm {
  stroke: var(--muted);
  stroke-width: 1.4;
}

.arm.faint {
  stroke: rgba(145, 164, 181, 0.22);
  stroke-width: 1;
}

.hub {
  fill: rgba(76, 228, 209, 0.1);
  stroke: var(--cyan);
  stroke-width: 1;
}

.hub-core {
  fill: var(--cyan);
}

.pod {
  fill: var(--amber);
  stroke: rgba(255, 180, 59, 0.6);
  stroke-width: 1;
  transition: transform 0.4s ease;
}

.pod.released {
  transform: translate(0, -2px);
}

.release-arrow {
  fill: none;
  stroke: var(--cyan);
  stroke-width: 1.2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.svg-label {
  font-family: var(--font-mono);
  font-size: 6px;
  letter-spacing: 0.14em;
  fill: var(--muted);
  text-anchor: middle;
}

.svg-label.dim {
  fill: var(--muted-dim);
}

.readouts {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 4px;
  margin: 0;
  padding-top: 8px;
  border-top: 1px solid var(--line);
}

.readouts dt {
  font-family: var(--font-mono);
  font-size: 6px;
  letter-spacing: 0.1em;
  color: var(--muted-dim);
}

.readouts dd {
  margin: 1px 0 0;
  font-family: var(--font-mono);
  font-size: 9px;
  color: var(--ivory);
  font-variant-numeric: tabular-nums;
}

@keyframes rotor-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-height: 720px) {
  .launcher {
    width: 226px;
  }
  .rotor {
    height: 92px;
  }
}
</style>
