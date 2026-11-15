<script setup lang="ts">
import { computed } from 'vue'
import type { GameMode } from '../game/company'
import type { MissionPhase } from '../game/types'

const props = defineProps<{
  credits: number
  creditLabel: string
  energyGj: number
  phase: MissionPhase
  contractComplete: boolean
  mode: GameMode
  orderLabel: string
  jobsDisabled: boolean
}>()

const emit = defineEmits<{ jobs: [] }>()

const status = computed(() => {
  if (props.phase === 'RESULT' && props.contractComplete) return 'CONTRACT COMPLETE'
  switch (props.phase) {
    case 'CONFIGURING':
      return 'PLANNING'
    case 'RESULT':
      return 'MISSION REPORT'
    case 'APPROACH':
      return 'FINAL APPROACH'
    default:
      return 'IN FLIGHT'
  }
})

const statusClass = computed(() => {
  if (props.phase === 'RESULT') return props.contractComplete ? 'ok' : 'warn'
  return 'live'
})
</script>

<template>
  <header class="header">
    <div class="brand">
      <span class="mark" aria-hidden="true"><span class="mark-core"></span></span>
      <div class="brand-type">
        <span class="wordmark">ORBITAL EXPRESS</span>
        <span class="company">CENTRIFUGE CARGO · SOL</span>
      </div>
    </div>

    <div class="route" aria-label="Route: Earth to Moon">
      <span class="route-node">EARTH</span>
      <span class="route-line" aria-hidden="true"><span class="route-pulse"></span></span>
      <span class="route-node moon">MOON</span>
      <span class="route-label">{{ orderLabel }}</span>
    </div>

    <button
      type="button"
      class="jobs-button"
      :disabled="jobsDisabled"
      :title="jobsDisabled ? 'Jobs are locked during an active flight' : 'Open jobs and company'"
      @click="emit('jobs')"
    >
      <span class="mode-label">{{ mode === 'company' ? 'COMPANY' : 'PRACTICE' }}</span>
      <span class="jobs-label">JOBS &amp; COMPANY</span>
    </button>

    <div class="resources">
      <div class="resource">
        <span class="resource-label">{{ creditLabel }}</span>
        <span class="resource-value">{{ Math.round(credits).toLocaleString('en-US') }}<small> cr</small></span>
      </div>
      <div class="resource">
        <span class="resource-label">GRID ENERGY</span>
        <span class="resource-value">{{ energyGj.toFixed(2) }}<small> GJ</small></span>
      </div>
      <span class="status" :class="statusClass">
        <span class="status-dot" aria-hidden="true"></span>
        {{ status }}
      </span>
    </div>
  </header>
</template>

<style scoped>
.header {
  display: flex;
  align-items: center;
  gap: 28px;
  min-height: 72px;
  padding: 0 24px;
  border-bottom: 1px solid var(--line);
  background: rgba(6, 13, 24, 0.88);
  backdrop-filter: blur(12px);
  position: relative;
  z-index: 5;
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 244px;
}

.mark {
  width: 34px;
  height: 34px;
  border: 1px solid var(--cyan-line);
  border-radius: 50%;
  position: relative;
  display: inline-grid;
  place-items: center;
  transform: rotate(-24deg);
}

.mark::before {
  content: '';
  position: absolute;
  inset: -7px 2px;
  border: 1px solid rgba(255, 180, 59, 0.55);
  border-radius: 50%;
}

.mark-core {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--cyan);
  box-shadow: 0 0 14px rgba(76, 228, 209, 0.75);
}

.brand-type {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.wordmark {
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.17em;
}

.company {
  font-size: 10px;
  letter-spacing: 0.18em;
  color: var(--muted-dim);
}

.route {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
}

.route-node {
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.12em;
  color: var(--muted);
}

.route-node.moon {
  color: var(--cyan);
}

.route-line {
  width: clamp(40px, 9vw, 120px);
  height: 1px;
  background: linear-gradient(90deg, rgba(145, 164, 181, 0.35), var(--cyan));
  position: relative;
}

.route-pulse {
  position: absolute;
  right: 0;
  top: -2px;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--cyan);
  box-shadow: 0 0 10px rgba(76, 228, 209, 0.8);
}

.route-label {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.14em;
  color: var(--muted-dim);
  margin-left: 2px;
  white-space: nowrap;
}

.jobs-button {
  display: grid;
  gap: 1px;
  flex: 0 0 auto;
  min-width: 112px;
  padding: 6px 10px;
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  background: rgba(18, 34, 52, 0.45);
  text-align: left;
}

.jobs-button:hover:not(:disabled) {
  border-color: var(--cyan-line);
}

.jobs-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.mode-label {
  font-family: var(--font-mono);
  font-size: 8px;
  letter-spacing: 0.12em;
  color: var(--cyan);
}

.jobs-label {
  font-family: var(--font-mono);
  font-size: 9.5px;
  letter-spacing: 0.08em;
  color: var(--ivory);
  white-space: nowrap;
}

.resources {
  display: flex;
  align-items: center;
  gap: 22px;
}

.resource {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 74px;
}

.resource-label {
  font-size: 9.5px;
  letter-spacing: 0.14em;
  color: var(--muted-dim);
}

.resource-value {
  font-family: var(--font-mono);
  font-size: 16px;
  font-variant-numeric: tabular-nums;
  color: var(--ivory);
}

.resource-value small {
  font-size: 11px;
  color: var(--muted);
}

.status {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 6px 11px;
  border: 1px solid var(--line);
  border-radius: 999px;
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.12em;
  color: var(--muted);
  white-space: nowrap;
}

.status-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--muted);
}

.status.live {
  border-color: var(--cyan-line);
  color: var(--cyan);
}

.status.live .status-dot {
  background: var(--cyan);
  box-shadow: 0 0 8px rgba(76, 228, 209, 0.8);
  animation: blink 1.8s ease-in-out infinite;
}

.status.ok {
  border-color: rgba(76, 228, 209, 0.5);
  color: var(--cyan);
}

.status.ok .status-dot {
  background: var(--cyan);
}

.status.warn {
  border-color: rgba(255, 180, 59, 0.45);
  color: var(--amber);
}

.status.warn .status-dot {
  background: var(--amber);
}

@keyframes blink {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.35;
  }
}

@media (max-width: 1180px) {
  .route-label,
  .company {
    display: none;
  }
  .header {
    gap: 16px;
    padding: 0 16px;
  }
  .brand {
    min-width: 200px;
  }
  .resources {
    gap: 14px;
  }
}

@media (max-width: 860px) {
  .route {
    display: none;
  }
  .brand {
    min-width: 0;
  }
  .header {
    gap: 12px;
  }
}

@media (max-width: 640px) {
  .header {
    flex-wrap: wrap;
    gap: 8px 12px;
    min-height: 0;
    padding: 10px 14px;
  }
  .route {
    display: none;
  }
  .brand {
    flex: 1 1 auto;
    min-width: 0;
  }
  .wordmark {
    font-size: 13px;
    letter-spacing: 0.13em;
  }
  .company {
    display: none;
  }
  .resources {
    gap: 12px;
  }
  .resource {
    min-width: 0;
  }
  .status {
    display: none;
  }
}
</style>
