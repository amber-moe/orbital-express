<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { formatDuration } from '../game/outcomeMessages'
import type { Outcome, OutcomeKind } from '../game/types'

const props = defineProps<{
  open: boolean
  result: Outcome | null
  title: string
  detail: string
  contractComplete: boolean
  rewardCredits: number
  requiredQuantity: number
}>()

const emit = defineEmits<{
  close: []
  retry: []
}>()

const dialog = ref<HTMLDialogElement | null>(null)
const retryButton = ref<HTMLButtonElement | null>(null)

watch(
  () => props.open,
  async (open) => {
    await nextTick()
    const element = dialog.value
    if (!element) return
    if (open && !element.open) {
      element.showModal()
      retryButton.value?.focus()
    } else if (!open && element.open) {
      element.close()
    }
  },
  { immediate: true },
)

function successKind(kind: OutcomeKind | undefined): boolean {
  return kind === 'delivered' || kind === 'contract-shortfall'
}
</script>

<template>
  <dialog
    ref="dialog"
    class="result-dialog"
    aria-labelledby="result-title"
    @close="emit('close')"
  >
    <div v-if="result" class="result" :class="successKind(result.kind) ? 'ok' : 'bad'">
      <header class="result-head">
        <span class="icon" aria-hidden="true">
          {{ successKind(result.kind) ? '✓' : '×' }}
        </span>
        <div>
          <span class="eyebrow">MISSION REPORT</span>
          <h2 id="result-title">{{ title }}</h2>
        </div>
      </header>

      <p class="detail">{{ detail }}</p>

      <dl class="stats">
        <div>
          <dt>FLIGHT TIME</dt>
          <dd>{{ formatDuration(result.timeSeconds) }}</dd>
        </div>
        <div>
          <dt>ENTRY SPEED</dt>
          <dd>
            {{ result.relativeSpeedKms !== null ? `${result.relativeSpeedKms.toFixed(3)} km/s` : '—' }}
          </dd>
        </div>
        <div>
          <dt>BRAKE USED</dt>
          <dd>{{ result.requiredBrakeKms !== null ? `${result.requiredBrakeKms.toFixed(3)} km/s` : '—' }}</dd>
        </div>
        <div>
          <dt>BRAKE LEFT</dt>
          <dd>{{ result.brakeRemainingKms.toFixed(3) }} km/s</dd>
        </div>
        <div>
          <dt>CRATES</dt>
          <dd>{{ result.deliveredQuantity }} / {{ requiredQuantity }}</dd>
        </div>
        <div>
          <dt>CONTRACT</dt>
          <dd :class="{ accent: contractComplete }">
            {{ contractComplete ? `+${rewardCredits.toLocaleString('en-US')} cr` : 'Not settled' }}
          </dd>
        </div>
      </dl>

      <p class="note">
        Preview and flight share the same fixed-step simulation and terminal-event rules. The final
        descent is an animation after reception acceptance; it is not a validated landing model.
      </p>

      <div class="buttons">
        <button ref="retryButton" type="button" class="primary" @click="emit('retry')">
          Retry attempt
        </button>
        <button type="button" class="secondary" @click="emit('close')">
          Review trajectory
        </button>
      </div>
    </div>
  </dialog>
</template>

<style scoped>
.result-dialog {
  border: 0;
  padding: 0;
  background: transparent;
  max-width: min(560px, calc(100vw - 32px));
  width: 560px;
  color: var(--ivory);
}

.result {
  padding: 22px 24px 20px;
  border: 1px solid var(--line-strong);
  border-radius: 10px;
  background:
    radial-gradient(500px 200px at 20% 0%, rgba(76, 228, 209, 0.08), transparent 70%),
    linear-gradient(180deg, #0e1c2b, #08121d);
  box-shadow: 0 30px 90px rgba(0, 0, 0, 0.55);
}

.result.bad {
  background:
    radial-gradient(500px 200px at 20% 0%, rgba(255, 107, 107, 0.07), transparent 70%),
    linear-gradient(180deg, #0e1c2b, #08121d);
}

.result-head {
  display: flex;
  align-items: center;
  gap: 13px;
}

.icon {
  width: 42px;
  height: 42px;
  display: grid;
  place-items: center;
  border: 1px solid var(--cyan-line);
  border-radius: 50%;
  color: var(--cyan);
  font-size: 20px;
  background: rgba(76, 228, 209, 0.08);
}

.bad .icon {
  border-color: rgba(255, 107, 107, 0.4);
  color: var(--error);
  background: var(--error-soft);
}

.eyebrow {
  display: block;
  font-family: var(--font-mono);
  font-size: 7px;
  letter-spacing: 0.18em;
  color: var(--muted-dim);
}

h2 {
  font-size: 24px;
  line-height: 1.1;
  font-weight: 600;
  margin-top: 2px;
}

.bad h2 {
  color: #ffc0c0;
}

.detail {
  margin-top: 14px;
  font-size: 12px;
  line-height: 1.55;
  color: var(--muted);
}

.stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin: 18px 0 0;
  padding: 13px 0;
  border-top: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
}

.stats dt {
  font-family: var(--font-mono);
  font-size: 6px;
  letter-spacing: 0.13em;
  color: var(--muted-dim);
}

.stats dd {
  margin: 2px 0 0;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--ivory);
  font-variant-numeric: tabular-nums;
}

.stats dd.accent {
  color: var(--cyan);
}

.note {
  margin-top: 12px;
  font-size: 9px;
  line-height: 1.5;
  color: var(--muted-dim);
}

.buttons {
  display: flex;
  gap: 8px;
  margin-top: 18px;
}

.primary,
.secondary {
  padding: 10px 16px;
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.primary {
  flex: 1;
  border: 1px solid var(--amber);
  background: var(--amber);
  color: #221604;
  font-weight: 700;
}

.primary:hover {
  filter: brightness(1.08);
}

.secondary {
  border: 1px solid var(--line-strong);
  background: transparent;
  color: var(--muted);
}

.secondary:hover {
  color: var(--ivory);
  border-color: var(--muted);
}

@media (max-width: 560px) {
  .stats {
    grid-template-columns: 1fr 1fr;
  }
  .buttons {
    flex-direction: column;
  }
}
</style>
