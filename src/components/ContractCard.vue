<script setup lang="ts">
import { computed } from 'vue'
import type { CargoDefinition, ContractData, MissionPhase, OutcomeKind } from '../game/types'
import { shortOutcomeLabel } from '../game/outcomeMessages'

const props = defineProps<{
  contract: ContractData
  cargo: CargoDefinition
  loadedQuantity: number
  phase: MissionPhase
  outcomeKind: OutcomeKind | null
}>()

const status = computed(() => {
  switch (props.phase) {
    case 'CONFIGURING':
      return { label: 'OPEN', tone: 'open' }
    case 'RESULT':
      return { label: 'REPORT', tone: 'closed' }
    default:
      return { label: 'IN FLIGHT', tone: 'live' }
  }
})

const deliveryLabel = computed(() => {
  if (props.phase === 'APPROACH') {
    return `${props.contract.requiredQuantity} crates · arriving`
  }
  if (!props.outcomeKind) {
    return `${props.loadedQuantity} / ${props.contract.requiredQuantity} crates`
  }
  return shortOutcomeLabel(props.outcomeKind)
})

const shortDestination = computed(() => {
  const tail = props.contract.destination.split('·').pop()?.trim()
  return (tail ?? props.contract.destination).replace('Receiving ', '')
})

const objective = computed(
  () =>
    `Deliver ${props.contract.requiredQuantity} × ${props.cargo.name} to ${shortDestination.value}.`,
)

const compact = computed(() => props.phase !== 'CONFIGURING')
</script>

<template>
  <article class="contract" :class="{ compact }" aria-labelledby="contract-title">
    <header class="contract-head">
      <span class="eyebrow">CONTRACT 01</span>
      <span class="chip" :class="status.tone">{{ status.label }}</span>
    </header>

    <h1 id="contract-title">{{ contract.name }}</h1>

    <p v-if="!compact" class="objective">{{ objective }}</p>

    <div class="summary">
      <span class="crate-icon" :style="{ color: cargo.accentColor }" aria-hidden="true">
        <svg viewBox="0 0 24 24" role="presentation">
          <rect x="3" y="5" width="18" height="15" rx="2" />
          <path d="M3 9h18M8 5v4M16 5v4M12 12v8" />
        </svg>
      </span>
      <span class="quantity">{{ deliveryLabel }}</span>
      <span class="reward">{{ contract.rewardCredits.toLocaleString('en-US') }} cr</span>
    </div>

    <details v-if="!compact" class="brief">
      <summary>Mission brief</summary>
      <p>{{ contract.brief }}</p>
      <dl>
        <div>
          <dt>CLIENT</dt>
          <dd>{{ contract.client }}</dd>
        </div>
        <div>
          <dt>DESTINATION</dt>
          <dd>{{ contract.destination }}</dd>
        </div>
        <div>
          <dt>MANIFEST</dt>
          <dd>{{ contract.requiredQuantity }} × {{ cargo.name }}</dd>
        </div>
      </dl>
    </details>
  </article>
</template>

<style scoped>
.contract {
  width: min(330px, 36vw);
  min-width: 258px;
  padding: 14px 16px 13px;
  background: linear-gradient(160deg, rgba(13, 25, 38, 0.94), rgba(8, 17, 28, 0.92));
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-panel);
  backdrop-filter: blur(10px);
}

.contract.compact {
  width: min(290px, 32vw);
  padding: 10px 13px;
}

.contract-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 5px;
}

.eyebrow {
  font-family: var(--font-mono);
  font-size: 9.5px;
  letter-spacing: 0.15em;
  color: var(--muted-dim);
}

.chip {
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.11em;
  padding: 2px 7px;
  border: 1px solid var(--line);
  border-radius: 999px;
  color: var(--muted);
}

.chip.open {
  border-color: var(--cyan-line);
  color: var(--cyan);
}

.chip.live {
  border-color: rgba(255, 180, 59, 0.5);
  color: var(--amber);
}

h1 {
  font-size: 24px;
  line-height: 1.1;
  letter-spacing: 0.01em;
  font-weight: 600;
}

.compact h1 {
  font-size: 18px;
}

.objective {
  margin-top: 5px;
  font-size: 12.5px;
  line-height: 1.45;
  color: var(--muted);
}

.summary {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
  padding-top: 9px;
  border-top: 1px solid var(--line);
  font-size: 12px;
}

.compact .summary {
  margin-top: 7px;
  padding-top: 7px;
}

.crate-icon {
  display: inline-flex;
  width: 20px;
  height: 20px;
  color: var(--cyan);
}

.crate-icon svg {
  width: 100%;
  height: 100%;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.4;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.quantity {
  color: var(--ivory);
}

.quantity::before {
  content: '·';
  margin-right: 8px;
  color: var(--muted-dim);
}

.reward {
  margin-left: auto;
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--amber);
}

.brief {
  margin-top: 10px;
  padding-top: 9px;
  border-top: 1px solid var(--line);
}

.brief summary {
  cursor: pointer;
  font-family: var(--font-mono);
  font-size: 9.5px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--muted);
  list-style: none;
}

.brief summary::-webkit-details-marker {
  display: none;
}

.brief summary::before {
  content: '▸ ';
  color: var(--cyan);
}

.brief[open] summary::before {
  content: '▾ ';
}

.brief summary:hover {
  color: var(--cyan);
}

.brief p {
  margin-top: 8px;
  font-size: 11.5px;
  line-height: 1.5;
  color: var(--muted);
}

.brief dl {
  display: grid;
  gap: 6px;
  margin: 9px 0 0;
}

.brief dl div {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  font-size: 11px;
}

.brief dt {
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.08em;
  color: var(--muted-dim);
}

.brief dd {
  margin: 0;
  color: var(--ivory);
  text-align: right;
}

@media (max-height: 760px) {
  .contract {
    padding: 11px 13px;
  }
}

@media (max-width: 560px) {
  .contract,
  .contract.compact {
    width: min(250px, calc(100vw - 48px));
    min-width: 0;
  }
  .objective {
    font-size: 11.5px;
  }
}
</style>
