<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import type { CompanySettlement, GameMode } from '../game/company'
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
  loadedQuantity: number
  mode: GameMode
  settlement: CompanySettlement | null
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

function resultTone(kind: OutcomeKind | undefined): 'ok' | 'warn' | 'bad' {
  if (kind === 'delivered') return 'ok'
  if (kind === 'contract-shortfall') return 'warn'
  return 'bad'
}

function resultIcon(kind: OutcomeKind | undefined): string {
  if (kind === 'delivered') return '✓'
  if (kind === 'contract-shortfall') return '!'
  return '×'
}
</script>

<template>
  <dialog
    ref="dialog"
    class="result-dialog"
    aria-labelledby="result-title"
    @close="emit('close')"
  >
    <div v-if="result" class="result" :class="resultTone(result.kind)">
      <header class="result-head">
        <span class="icon" aria-hidden="true">{{ resultIcon(result.kind) }}</span>
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
          <dt>ACCEPTED</dt>
          <dd>{{ result.deliveredQuantity }} / {{ requiredQuantity }}</dd>
        </div>
        <div>
          <dt>LOADED</dt>
          <dd>{{ loadedQuantity }}</dd>
        </div>
        <div>
          <dt>CONTRACT</dt>
          <dd :class="{ accent: contractComplete }">
            {{ contractComplete ? `+${rewardCredits.toLocaleString('en-US')} cr` : 'Not settled' }}
          </dd>
        </div>
      </dl>

      <dl v-if="mode === 'company' && settlement" class="settlement">
        <div>
          <dt>FLIGHT COST</dt>
          <dd>{{ settlement.cost.toLocaleString('en-US') }} cr</dd>
        </div>
        <div>
          <dt>INCOME</dt>
          <dd :class="{ accent: settlement.income > 0 }">
            {{ settlement.income.toLocaleString('en-US') }} cr
          </dd>
        </div>
        <div>
          <dt>NET</dt>
          <dd :class="settlement.net >= 0 ? 'accent' : 'bad'">
            {{ settlement.net >= 0 ? '+' : '' }}{{ settlement.net.toLocaleString('en-US') }} cr
          </dd>
        </div>
        <div>
          <dt>BALANCE</dt>
          <dd>{{ settlement.balance.toLocaleString('en-US') }} cr</dd>
        </div>
      </dl>

      <p class="note">
        Planning checks and flight use the same mission model. The final descent is illustrative
        after reception acceptance; it is not a validated landing model.
        <template v-if="mode === 'company'"> Company result saved in this browser.</template>
      </p>

      <div class="buttons">
        <button ref="retryButton" type="button" class="primary" @click="emit('retry')">
          {{ mode === 'company' ? 'Back to jobs' : 'Retry attempt' }}
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
  max-width: min(600px, calc(100vw - 32px));
  width: 600px;
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

.result.warn {
  background:
    radial-gradient(500px 200px at 20% 0%, rgba(255, 180, 59, 0.08), transparent 70%),
    linear-gradient(180deg, #0e1c2b, #08121d);
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

.warn .icon {
  border-color: rgba(255, 180, 59, 0.45);
  color: var(--amber);
  background: var(--amber-soft);
}

.bad .icon {
  border-color: rgba(255, 107, 107, 0.4);
  color: var(--error);
  background: var(--error-soft);
}

.eyebrow {
  display: block;
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.16em;
  color: var(--muted-dim);
}

h2 {
  font-size: 27px;
  line-height: 1.1;
  font-weight: 600;
  margin-top: 2px;
}

.warn h2 {
  color: #ffdda8;
}

.bad h2 {
  color: #ffc0c0;
}

.detail {
  margin-top: 15px;
  font-size: 13.5px;
  line-height: 1.6;
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
  font-size: 9.5px;
  letter-spacing: 0.11em;
  color: var(--muted-dim);
}

.stats dd {
  margin: 3px 0 0;
  font-family: var(--font-mono);
  font-size: 13px;
  color: var(--ivory);
  font-variant-numeric: tabular-nums;
}

.stats dd.accent {
  color: var(--cyan);
}

.settlement {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  margin: 14px 0 0;
  padding: 10px 0;
  border-top: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
}

.settlement dt {
  font-family: var(--font-mono);
  font-size: 8px;
  letter-spacing: 0.1em;
  color: var(--muted-dim);
}

.settlement dd {
  margin: 2px 0 0;
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--ivory);
  font-variant-numeric: tabular-nums;
}

.settlement dd.accent {
  color: var(--cyan);
}

.settlement dd.bad {
  color: var(--error);
}

.note {
  margin-top: 13px;
  font-size: 11.5px;
  line-height: 1.55;
  color: var(--muted-dim);
}

.buttons {
  display: flex;
  gap: 8px;
  margin-top: 18px;
}

.primary,
.secondary {
  padding: 11px 18px;
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  font-size: 12px;
  letter-spacing: 0.09em;
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
