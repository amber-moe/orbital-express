<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { gameData } from '../game/data'
import { estimateOrderCosts } from '../game/rules/configRules'
import {
  companyNetProfit,
  companySuccessRate,
  formatCredits,
  type CompanyOwnership,
  type CompanyState,
  type GameMode,
} from '../game/company'
import type { CargoDefinition, ContractData } from '../game/types'

interface JobOrderView {
  contract: ContractData
  cargo: CargoDefinition
}

const props = defineProps<{
  open: boolean
  mode: GameMode
  company: CompanyState
  orders: JobOrderView[]
  selectedOrderId: string
  flightActive: boolean
  storageAvailable: boolean
  externalChange: boolean
  notice: string | null
  ownership: CompanyOwnership
  lockMessage: string | null
  canManageCompany: boolean
}>()

const emit = defineEmits<{
  close: []
  'set-mode': [mode: GameMode]
  accept: [contractId: string]
  restart: []
  reload: []
  'dismiss-notice': []
  'retry-ownership': []
}>()

const dialog = ref<HTMLDialogElement | null>(null)
const closeButton = ref<HTMLButtonElement | null>(null)

watch(
  () => props.open,
  async (open) => {
    await nextTick()
    const element = dialog.value
    if (!element) return
    if (open && !element.open) {
      element.showModal()
      closeButton.value?.focus()
    } else if (!open && element.open) {
      element.close()
    }
  },
  { immediate: true },
)

const displayOrders = computed(() => {
  if (!props.open) return []
  return props.orders.map((order) => ({
    ...order,
    costs: estimateOrderCosts(gameData, order.contract.id),
  }))
})

const netProfit = () => companyNetProfit(props.company)
const successRate = () => {
  const rate = companySuccessRate(props.company)
  return rate === null ? '—' : `${Math.round(rate * 100)}%`
}

const insufficient = (order: (typeof displayOrders.value)[number]): boolean =>
  props.mode === 'company' && props.company.balance < order.costs.launchFrom

const successUnaffordable = (order: (typeof displayOrders.value)[number]): boolean =>
  props.mode === 'company' &&
  (order.costs.successFrom === null || props.company.balance < order.costs.successFrom)

const paidBlocked = (): boolean =>
  props.mode === 'company' &&
  (!props.canManageCompany || props.externalChange || props.company.pending !== null)

const acceptDisabled = (order: (typeof displayOrders.value)[number]): boolean =>
  props.flightActive ||
  paidBlocked() ||
  order.costs.successFrom === null ||
  (props.mode === 'company' && props.company.balance < order.costs.launchFrom)

const money = (value: number): string => Math.round(value).toLocaleString('en-US')

const verifiedText = (order: (typeof displayOrders.value)[number]): string => {
  if (order.costs.successFrom === null) return 'No verified loadout'
  if (order.costs.successTo === null) return formatCredits(order.costs.successFrom)
  return order.costs.successFrom === order.costs.successTo
    ? formatCredits(order.costs.successFrom)
    : `${money(order.costs.successFrom)}–${money(order.costs.successTo)} cr`
}
</script>

<template>
  <dialog ref="dialog" class="jobs-dialog" aria-labelledby="jobs-title" @close="emit('close')">
    <article class="jobs">
      <header class="jobs-head">
        <div>
          <span class="eyebrow">OPERATIONS</span>
          <h2 id="jobs-title">Jobs &amp; Company</h2>
        </div>
        <button ref="closeButton" type="button" class="close" @click="emit('close')">Close</button>
      </header>

      <div class="mode-row" role="radiogroup" aria-label="Game mode">
        <button
          type="button"
          class="mode"
          :class="{ active: mode === 'practice' }"
          :disabled="flightActive"
          @click="emit('set-mode', 'practice')"
        >
          <strong>Practice</strong>
          <span>Free retries · company account untouched</span>
        </button>
        <button
          type="button"
          class="mode"
          :class="{ active: mode === 'company' }"
          :disabled="flightActive || externalChange || !canManageCompany"
          @click="emit('set-mode', 'company')"
        >
          <strong>Company Jobs</strong>
          <span>Paid flights · saved in this browser</span>
        </button>
      </div>

      <p v-if="lockMessage" class="banner bad">
        {{ lockMessage }}
        <button
          v-if="ownership === 'blocked'"
          type="button"
          class="inline"
          @click="emit('retry-ownership')"
        >
          Try to take over
        </button>
      </p>
      <p v-if="notice" class="banner warn">
        {{ notice }}
        <button type="button" class="inline" @click="emit('dismiss-notice')">Dismiss</button>
      </p>
      <p v-if="!storageAvailable" class="banner warn">
        Browser storage is unavailable. Company progress is in memory only and will not survive a
        reload.
      </p>
      <p v-if="externalChange" class="banner bad">
        Company data changed in another tab. Paid actions are locked until this page reloads.
        <button type="button" class="inline" @click="emit('reload')">Reload</button>
      </p>

      <section v-if="mode === 'company'" class="company-summary" aria-label="Company summary">
        <div>
          <span class="label">BALANCE</span>
          <strong>{{ formatCredits(company.balance) }}</strong>
        </div>
        <div>
          <span class="label">NET PROFIT</span>
          <strong :class="{ negative: netProfit() < 0 }">{{ formatCredits(netProfit()) }}</strong>
        </div>
        <div>
          <span class="label">COMPLETED</span>
          <strong>{{ company.completedJobs }}</strong>
        </div>
        <div>
          <span class="label">SUCCESS RATE</span>
          <strong>{{ successRate() }}</strong>
        </div>
        <div>
          <span class="label">RESOLVED FLIGHTS</span>
          <strong>{{ company.resolvedFlights }}</strong>
        </div>
        <div>
          <span class="label">DELIVERED</span>
          <strong>{{ company.deliveredCrates }}</strong>
        </div>
        <span class="saved">{{ storageAvailable ? 'Saved in this browser' : 'Not saved' }}</span>
      </section>
      <p v-else class="practice-note">
        Practice flights use the order's practice budget and never change the company account.
      </p>

      <section class="orders" aria-label="Available jobs">
        <p class="order-note">
          Verified delivery uses the full required quantity and a simulator-confirmed outcome.
          Launchable costs can be underfilled or risky and do not guarantee delivery.
        </p>
        <article
          v-for="order in displayOrders"
          :key="order.contract.id"
          class="order"
          :class="{ selected: order.contract.id === selectedOrderId }"
          :style="{ borderLeftColor: order.cargo.accentColor }"
          :title="`${order.cargo.name}: ${order.cargo.maxLaunchLoadG} g base tolerance; arrival ≤ ${order.cargo.maxArrivalSpeedKms.toFixed(2)} km/s`"
        >
          <div class="order-head">
            <div class="order-title">
              <span
                class="cargo-swatch"
                :class="order.cargo.visualForm"
                :style="{ background: order.cargo.accentColor }"
                aria-hidden="true"
              ></span>
              <div>
                <span class="eyebrow">{{ order.contract.client }}</span>
                <h3>{{ order.contract.orderLabel }}</h3>
              </div>
            </div>
            <span v-if="order.contract.id === selectedOrderId" class="tag">CURRENT</span>
          </div>
          <p class="order-brief" :title="order.contract.brief">{{ order.contract.brief }}</p>
          <dl class="order-stats">
            <div>
              <dt>CARGO</dt>
              <dd>{{ order.contract.requiredQuantity }} × {{ order.cargo.name }}</dd>
            </div>
            <div>
              <dt>REWARD</dt>
              <dd class="reward">{{ formatCredits(order.contract.rewardCredits) }}</dd>
            </div>
            <div>
              <dt>VERIFIED DELIVERY</dt>
              <dd>{{ verifiedText(order) }}</dd>
            </div>
            <div>
              <dt>LAUNCHABLE FROM</dt>
              <dd>{{ formatCredits(order.costs.launchFrom) }}</dd>
            </div>
          </dl>
          <div class="order-actions">
            <span v-if="insufficient(order)" class="insufficient">
              Insufficient company funds for any launchable loadout.
            </span>
            <span v-else-if="successUnaffordable(order)" class="warning">
              No verified full-delivery loadout fits this balance. Cheaper launchable loads may
              fail or underfill.
            </span>
            <span v-else-if="paidBlocked()" class="insufficient">
              Paid actions are locked.
            </span>
            <button
              type="button"
              class="accept"
              :disabled="acceptDisabled(order)"
              @click="emit('accept', order.contract.id)"
            >
              {{ mode === 'company' ? 'Accept paid job' : 'Accept practice job' }}
            </button>
          </div>
        </article>
      </section>

      <details v-if="company.history.length" class="history">
        <summary>Recent dispatches</summary>
        <table>
          <thead>
            <tr>
              <th>Job</th>
              <th>Cost</th>
              <th>Income</th>
              <th>Outcome</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="entry in company.history.slice(0, 5)" :key="entry.id">
              <td>{{ entry.orderLabel }}</td>
              <td>{{ formatCredits(entry.cost) }}</td>
              <td>{{ formatCredits(entry.income) }}</td>
              <td>{{ entry.deliveredCrates }}</td>
              <td>{{ entry.outcome }}</td>
            </tr>
          </tbody>
        </table>
      </details>

      <footer class="jobs-foot">
        <p>
          Company flights are saved in this browser immediately. Reloading during a paid flight
          interrupts it; the cost is retained and the flight is recorded as failed.
        </p>
        <div class="foot-actions">
          <button
            type="button"
            class="secondary"
            :disabled="flightActive || externalChange || !canManageCompany"
            @click="emit('restart')"
          >
            Restart Company
          </button>
          <button
            v-if="mode === 'company'"
            type="button"
            class="secondary"
            :disabled="flightActive"
            @click="emit('set-mode', 'practice')"
          >
            Play Practice instead
          </button>
        </div>
      </footer>
    </article>
  </dialog>
</template>

<style scoped>
.jobs-dialog {
  border: 0;
  padding: 0;
  background: transparent;
  width: min(760px, calc(100vw - 32px));
  color: var(--ivory);
}

.jobs {
  max-height: calc(100vh - 40px);
  overflow-y: auto;
  padding: 20px 22px 18px;
  border: 1px solid var(--line-strong);
  border-radius: 10px;
  background:
    radial-gradient(500px 200px at 15% 0%, rgba(76, 228, 209, 0.07), transparent 70%),
    linear-gradient(180deg, #0e1c2b, #08121d);
  box-shadow: 0 30px 90px rgba(0, 0, 0, 0.55);
}

.jobs-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.eyebrow {
  display: block;
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.14em;
  color: var(--muted-dim);
}

h2 {
  margin-top: 2px;
  font-size: 24px;
  font-weight: 600;
}

.close {
  padding: 7px 12px;
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  background: transparent;
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--muted);
}

.close:hover {
  color: var(--ivory);
  border-color: var(--muted);
}

.mode-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-top: 10px;
}

.mode {
  display: grid;
  gap: 2px;
  padding: 9px 11px;
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  background: rgba(18, 34, 52, 0.35);
  text-align: left;
  color: var(--muted);
}

.mode strong {
  font-size: 13px;
  color: var(--ivory);
}

.mode span {
  font-size: 11px;
  color: var(--muted-dim);
}

.mode.active {
  border-color: var(--cyan);
  background: var(--cyan-soft);
}

.mode.active strong {
  color: var(--cyan);
}

.mode:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.banner {
  margin-top: 10px;
  padding: 7px 10px;
  border-radius: var(--radius-sm);
  font-size: 11px;
  line-height: 1.45;
}

.banner.warn {
  color: #ffdda8;
  background: var(--amber-soft);
  border: 1px solid rgba(255, 180, 59, 0.26);
}

.banner.bad {
  color: #ffc2c2;
  background: var(--error-soft);
  border: 1px solid rgba(255, 107, 107, 0.28);
}

.inline {
  margin-left: 6px;
  padding: 0;
  border: 0;
  background: none;
  color: currentColor;
  text-decoration: underline;
  font-size: 10.5px;
}

.company-summary {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr)) auto;
  gap: 8px;
  align-items: end;
  margin-top: 12px;
  padding: 10px 12px;
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  background: rgba(18, 34, 52, 0.4);
}

.company-summary .label,
.order-stats dt {
  display: block;
  font-family: var(--font-mono);
  font-size: 8px;
  letter-spacing: 0.08em;
  color: var(--muted-dim);
}

.company-summary strong {
  display: block;
  margin-top: 2px;
  font-family: var(--font-mono);
  font-size: 13px;
  font-weight: 500;
  color: var(--ivory);
  font-variant-numeric: tabular-nums;
}

.company-summary strong.negative {
  color: var(--error);
}

.saved {
  font-family: var(--font-mono);
  font-size: 8.5px;
  color: var(--muted-dim);
  white-space: nowrap;
}

.practice-note {
  margin-top: 10px;
  font-size: 11px;
  color: var(--muted);
}

.orders {
  display: grid;
  gap: 6px;
  margin-top: 10px;
}

.order {
  padding: 8px 10px;
  border: 1px solid var(--line);
  border-left: 3px solid var(--line);
  border-radius: var(--radius-sm);
  background: rgba(18, 34, 52, 0.3);
}

.order-title {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.cargo-swatch {
  flex: 0 0 auto;
  width: 14px;
  height: 14px;
  margin-top: 3px;
  border-radius: 3px;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.22);
}

.cargo-swatch.pack {
  border-radius: 8px;
}

.cargo-swatch.case {
  border-radius: 2px;
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.28),
    inset 0 -4px 0 rgba(0, 0, 0, 0.22);
}

.order.selected {
  border-color: var(--cyan-line);
}

.order-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.order h3 {
  margin: 1px 0 0;
  font-size: 16px;
  font-weight: 600;
}

.tag {
  padding: 2px 7px;
  border: 1px solid var(--cyan-line);
  border-radius: 999px;
  font-family: var(--font-mono);
  font-size: 8px;
  letter-spacing: 0.08em;
  color: var(--cyan);
}

.order-brief {
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin-top: 3px;
  font-size: 11px;
  line-height: 1.4;
  color: var(--muted);
}

.order-stats {
  display: grid;
  grid-template-columns: 1.2fr 0.8fr 1.15fr 1.15fr;
  gap: 8px;
  margin: 6px 0 0;
}

.order-stats dd {
  margin: 2px 0 0;
  font-size: 10.5px;
  color: var(--ivory);
  line-height: 1.3;
}

.order-stats dd.reward {
  color: var(--amber);
  font-family: var(--font-mono);
}

.order-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 6px;
}

.insufficient {
  font-size: 10px;
  color: var(--error);
}

.warning {
  font-size: 10px;
  line-height: 1.35;
  color: var(--amber);
}

.order-note {
  margin: 0 0 2px;
  font-size: 10.5px;
  line-height: 1.4;
  color: var(--muted-dim);
}

.accept {
  padding: 7px 12px;
  border: 1px solid var(--amber);
  border-radius: var(--radius-sm);
  background: var(--amber);
  color: #221604;
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.accept:disabled {
  border-color: var(--line);
  background: rgba(145, 164, 181, 0.12);
  color: var(--muted-dim);
  cursor: not-allowed;
}

.history {
  margin-top: 12px;
  padding-top: 9px;
  border-top: 1px solid var(--line);
}

.history summary {
  cursor: pointer;
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--muted);
}

.history table {
  width: 100%;
  margin-top: 7px;
  border-collapse: collapse;
  font-size: 10px;
}

.history th {
  text-align: left;
  font-family: var(--font-mono);
  font-size: 8px;
  letter-spacing: 0.06em;
  color: var(--muted-dim);
  padding: 3px 4px;
}

.history td {
  padding: 3px 4px;
  border-top: 1px solid var(--line);
  color: var(--ivory);
}

.jobs-foot {
  margin-top: 14px;
  padding-top: 10px;
  border-top: 1px solid var(--line);
}

.jobs-foot p {
  font-size: 10.5px;
  line-height: 1.45;
  color: var(--muted-dim);
}

.foot-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 8px;
}

.secondary {
  padding: 7px 12px;
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  background: transparent;
  font-family: var(--font-mono);
  font-size: 9.5px;
  color: var(--muted);
}

.secondary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.secondary:hover:not(:disabled) {
  color: var(--ivory);
  border-color: var(--muted);
}

@media (max-width: 700px) {
  .company-summary {
    grid-template-columns: 1fr 1fr;
  }
  .saved {
    grid-column: 1 / -1;
  }
  .order-stats {
    grid-template-columns: 1fr 1fr;
  }
  .mode-row {
    grid-template-columns: 1fr;
  }
}
</style>
