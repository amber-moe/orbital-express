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
  if (!props.outcomeKind) return `${props.loadedQuantity} / ${props.contract.requiredQuantity} loaded`
  return shortOutcomeLabel(props.outcomeKind)
})
</script>

<template>
  <article class="contract" aria-labelledby="contract-title">
    <header class="contract-head">
      <span class="eyebrow">CONTRACT 01</span>
      <span class="chip" :class="status.tone">{{ status.label }}</span>
    </header>
    <h1 id="contract-title">{{ contract.name }}</h1>
    <p class="client">{{ contract.client }}</p>
    <p class="brief">{{ contract.brief }}</p>

    <dl class="facts">
      <div>
        <dt>DESTINATION</dt>
        <dd>{{ contract.destination }}</dd>
      </div>
      <div>
        <dt>MANIFEST</dt>
        <dd>{{ contract.requiredQuantity }} × {{ cargo.name }}</dd>
      </div>
      <div>
        <dt>LOADED</dt>
        <dd class="cyan">{{ deliveryLabel }}</dd>
      </div>
      <div>
        <dt>REWARD</dt>
        <dd class="amber">{{ contract.rewardCredits.toLocaleString('en-US') }} cr</dd>
      </div>
    </dl>
  </article>
</template>

<style scoped>
.contract {
  width: min(310px, 33%);
  min-width: 246px;
  padding: 15px 16px 14px;
  background: linear-gradient(160deg, rgba(13, 25, 38, 0.93), rgba(8, 17, 28, 0.9));
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-panel);
  backdrop-filter: blur(10px);
}

.contract-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}

.eyebrow {
  font-family: var(--font-mono);
  font-size: 8px;
  letter-spacing: 0.18em;
  color: var(--muted-dim);
}

.chip {
  font-family: var(--font-mono);
  font-size: 7px;
  letter-spacing: 0.14em;
  padding: 3px 7px;
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
  font-size: 22px;
  line-height: 1.1;
  letter-spacing: 0.01em;
  font-weight: 600;
}

.client {
  margin-top: 3px;
  font-size: 10px;
  color: var(--muted);
  letter-spacing: 0.04em;
}

.brief {
  margin-top: 9px;
  font-size: 11px;
  line-height: 1.5;
  color: var(--muted);
}

.facts {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 9px 14px;
  margin: 13px 0 0;
  padding-top: 11px;
  border-top: 1px solid var(--line);
}

.facts dt {
  font-family: var(--font-mono);
  font-size: 7px;
  letter-spacing: 0.14em;
  color: var(--muted-dim);
  margin-bottom: 2px;
}

.facts dd {
  margin: 0;
  font-size: 10px;
  color: var(--ivory);
  line-height: 1.35;
}

.facts dd.cyan {
  color: var(--cyan);
}

.facts dd.amber {
  color: var(--amber);
  font-family: var(--font-mono);
}

@media (max-height: 760px) {
  .brief {
    display: none;
  }
  .contract {
    padding: 12px 14px;
  }
}
</style>
