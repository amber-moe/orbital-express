<script setup lang="ts">
import { computed } from 'vue'
import CargoPreview from './CargoPreview.vue'
import { gameData } from '../game/data'
import type { GameMode } from '../game/company'
import { shortOutcomeLabel } from '../game/outcomeMessages'
import { evaluateReadiness } from '../game/readiness'
import {
  RELEASE_SPEED_SCALE_DETENTS,
  releaseSpeedScaleLabel,
} from '../game/releaseSpeed'
import type {
  CargoDefinition,
  ContractData,
  CrateQuantity,
  EquipmentData,
  LaunchProfileData,
  MissionConfig,
  MissionSnapshot,
  ModuleId,
  ProtectionId,
} from '../game/types'

const props = defineProps<{
  snapshot: MissionSnapshot
  contract: ContractData
  cargo: CargoDefinition
  profile: LaunchProfileData
  equipment: EquipmentData
  referenceMassKg: number
  mode: GameMode
  /** Extra blocker from persistence/multi-tab state, if any. */
  launchBlocker?: string | null
  /** Company balance for the pre-launch pricing summary. */
  companyBalance?: number
}>()

const emit = defineEmits<{
  'set-config': [patch: Partial<MissionConfig>]
  launch: []
  retry: []
  'open-result': []
  sources: []
}>()

const config = computed(() => props.snapshot.config)
const totals = computed(() => props.snapshot.totals)
const validation = computed(() => props.snapshot.validation)
const prediction = computed(() => props.snapshot.prediction)
const phase = computed(() => props.snapshot.phase)

const canLaunch = computed(
  () =>
    phase.value === 'CONFIGURING' &&
    validation.value.ok &&
    prediction.value !== null &&
    !props.launchBlocker,
)

const launchLabel = computed(() => {
  switch (phase.value) {
    case 'CONFIGURING':
      return 'Launch'
    case 'SPINNING_UP':
      return 'Spinning up…'
    case 'DEPARTURE':
      return 'Departing…'
    case 'TRANSFER':
      return 'In transit…'
    case 'APPROACH':
      return 'Braking…'
    case 'RESULT':
      return 'Mission ended'
  }
})

const phaseNote = computed(() => {
  switch (phase.value) {
    case 'SPINNING_UP':
      return 'Centrifuge accelerating — loadout locked.'
    case 'DEPARTURE':
      return 'Assisted ascent — transfer state locked.'
    case 'TRANSFER':
      return 'In transit to the Moon.'
    case 'APPROACH':
      return 'Final braking and reception check.'
    case 'RESULT':
      return props.mode === 'company'
        ? 'Return to jobs to take another contract.'
        : 'Review the report, then retry to reset the order.'
    default:
      return ''
  }
})

const readiness = computed(() =>
  evaluateReadiness({
    validation: validation.value,
    totals: totals.value,
    prediction: prediction.value,
    contract: props.contract,
    quantity: config.value.quantity,
    energyAvailableGj: props.snapshot.resources.energyGj,
    releaseSpeedScale: config.value.releaseSpeedScale,
  }),
)

const readinessBadge = computed(() => {
  if (readiness.value.blocked) return 'BLOCKED'
  if (readiness.value.tone === 'ok') return 'CLEAR'
  return readiness.value.tone === 'warn' ? 'REVIEW' : 'RISK'
})

const analysisLabel = computed(() =>
  prediction.value ? shortOutcomeLabel(prediction.value.outcomeKind) : 'No analysis',
)

const analysisDetail = computed(() => {
  const item = prediction.value
  if (!item) return 'The flight plan could not be simulated for this loadout.'
  const speed = item.relativeSpeedKms !== null ? `${item.relativeSpeedKms.toFixed(3)} km/s` : '—'
  switch (item.outcomeKind) {
    case 'delivered':
      return `Zone entry ${speed} · brake ${item.requiredBrakeKms?.toFixed(3) ?? '—'} km/s · ${item.brakeRemainingKms.toFixed(2)} km/s left. Final quantity and settlement are confirmed after flight.`
    case 'contract-shortfall':
      return `Reception valid at ${speed}, but ${item.deliveredQuantity}/${item.requiredQuantity} crates are required.`
    case 'insufficient-braking':
      return `Needs ${item.requiredBrakeKms?.toFixed(3) ?? '—'} km/s · only ${item.brakeRemainingKms.toFixed(3)} km/s available.`
    case 'arrival-too-fast':
      return `Entry ${speed} exceeds the cargo limit.`
    case 'missed-moon':
      return 'Trajectory does not enter the lunar reception zone.'
    case 'earth-impact':
      return 'Trajectory falls back to Earth.'
    case 'moon-impact':
      return 'Trajectory intersects the Moon without reception.'
  }
})

const checkIcon = (state: 'ok' | 'warn' | 'bad'): string => {
  if (state === 'ok') return '✓'
  if (state === 'warn') return '!'
  return '×'
}

const departureSpeedKms = computed(
  () => totals.value.releaseSpeedKms + totals.value.ascentRequiredKms,
)

const pricing = computed(() => {
  const dispatch = totals.value.launchCredits
  const reward = props.contract.rewardCredits
  return {
    dispatch,
    reward,
    net: reward - dispatch,
    balanceAfter: (props.companyBalance ?? 0) - dispatch,
  }
})

const moduleReserve = (id: ModuleId): number => {
  const module = props.equipment.modules[id]
  const baseMass = totals.value.totalMassKg - totals.value.moduleMassKg
  const mass = baseMass + module.massKg
  return module.baseBrakeReserveKms * Math.sqrt(props.referenceMassKg / mass)
}

const protectionLimit = (id: ProtectionId): number =>
  props.cargo.maxLaunchLoadG * props.equipment.protection[id].launchLoadMultiplier

const formatCredits = (value: number): string => Math.round(value).toLocaleString('en-US')

const setQuantity = (quantity: CrateQuantity): void => {
  emit('set-config', { quantity })
}

const setProtection = (protectionId: ProtectionId): void => {
  emit('set-config', { protectionId })
}

const setModule = (moduleId: ModuleId): void => {
  emit('set-config', { moduleId })
}

const setReleaseSpeed = (releaseSpeedScale: number): void => {
  emit('set-config', { releaseSpeedScale })
}
</script>

<template>
  <aside class="panel" aria-labelledby="config-heading">
    <header class="panel-head">
      <div class="head-title">
        <span class="eyebrow">MISSION CONFIG</span>
        <h2 id="config-heading">Loadout</h2>
      </div>
      <span class="attempt">ATTEMPT {{ snapshot.attempt || '—' }}</span>
    </header>

    <div class="scroll">
      <CargoPreview
        :quantity="config.quantity"
        :protection-id="config.protectionId"
        :module-id="config.moduleId"
        :totals="totals"
        :max-volume="equipment.capsule.maxVolume"
        :max-mass-kg="equipment.capsule.maxMassKg"
        :protection-label="equipment.protection[config.protectionId].name"
        :module-label="equipment.modules[config.moduleId].name"
        :cargo="cargo"
      />

      <div class="rows">
        <div class="row cargo-row">
          <span class="row-label">Cargo</span>
          <div class="cargo-name-wrap">
            <span class="cargo-name">{{ cargo.name }}</span>
            <span class="fixed-tag">fixed</span>
          </div>
        </div>

        <div class="row quantity-row">
          <span class="row-label">Quantity</span>
          <div class="quantity-controls" role="radiogroup" aria-label="Cargo quantity">
            <label v-for="quantity in contract.allowedQuantities" :key="quantity" class="chip quantity-chip">
              <input
                type="radio"
                name="cargo-quantity"
                :value="quantity"
                :checked="config.quantity === quantity"
                :disabled="phase !== 'CONFIGURING'"
                :aria-label="`${quantity} crate${quantity === 1 ? '' : 's'}`"
                @change="setQuantity(quantity)"
              />
              <span>{{ quantity }}</span>
            </label>
          </div>
        </div>

        <div class="row">
          <span class="row-label">Protection</span>
          <div class="chips two" role="radiogroup" aria-label="Protection">
            <label
              v-for="protectionId in (['standard', 'reinforced'] as const)"
              :key="protectionId"
              class="chip two"
              :class="{ selected: config.protectionId === protectionId }"
              :title="equipment.protection[protectionId].description"
            >
              <input
                type="radio"
                name="protection"
                :value="protectionId"
                :checked="config.protectionId === protectionId"
                :disabled="phase !== 'CONFIGURING'"
                @change="setProtection(protectionId)"
              />
              <span class="chip-title">{{ equipment.protection[protectionId].name }}</span>
              <span class="chip-meta">{{ protectionLimit(protectionId).toFixed(0) }} g</span>
            </label>
          </div>
        </div>

        <div class="row">
          <span class="row-label">Braking</span>
          <div class="chips two" role="radiogroup" aria-label="Braking module">
            <label
              v-for="moduleId in (['small', 'large'] as const)"
              :key="moduleId"
              class="chip two"
              :class="{ selected: config.moduleId === moduleId }"
              :title="equipment.modules[moduleId].description"
            >
              <input
                type="radio"
                name="module"
                :value="moduleId"
                :checked="config.moduleId === moduleId"
                :disabled="phase !== 'CONFIGURING'"
                @change="setModule(moduleId)"
              />
              <span class="chip-title">{{ equipment.modules[moduleId].name }}</span>
              <span class="chip-meta">{{ moduleReserve(moduleId).toFixed(2) }} km/s</span>
            </label>
          </div>
        </div>

        <div class="row">
          <span class="row-label">Release</span>
          <div class="chips six" role="radiogroup" aria-label="Release speed">
            <label
              v-for="detent in RELEASE_SPEED_SCALE_DETENTS"
              :key="detent"
              class="chip speed"
              :class="{ selected: config.releaseSpeedScale === detent }"
            >
              <input
                type="radio"
                name="release-speed"
                :value="detent"
                :checked="config.releaseSpeedScale === detent"
                :disabled="phase !== 'CONFIGURING'"
                :aria-label="`Release speed ${Math.round(detent * 100)} percent`"
                @change="setReleaseSpeed(detent)"
              />
              <span>{{ Math.round(detent * 100) }}%</span>
            </label>
          </div>
        </div>
      </div>

      <details class="more">
        <summary>Flight details &amp; analysis</summary>
        <ul class="checks">
          <li v-for="check in readiness.checks" :key="check.label" :class="check.state">
            <span class="check-icon" aria-hidden="true">{{ checkIcon(check.state) }}</span>
            <span class="check-label">{{ check.label }}</span>
            <b>{{ check.value }}</b>
          </li>
        </ul>
        <dl class="detail-grid">
          <div>
            <dt>Profile</dt>
            <dd>{{ profile.name }} · fixed</dd>
          </div>
          <div>
            <dt>Launch cost</dt>
            <dd>{{ formatCredits(totals.launchCredits) }} cr</dd>
          </div>
          <div>
            <dt>Total mass</dt>
            <dd>{{ totals.totalMassKg.toFixed(0) }} kg</dd>
          </div>
          <div>
            <dt>Cargo volume</dt>
            <dd>{{ totals.totalVolume.toFixed(2) }} / {{ totals.maxVolume.toFixed(2) }}</dd>
          </div>
          <div>
            <dt>Rotor energy</dt>
            <dd>{{ totals.rotorEnergyGj.toFixed(2) }} GJ</dd>
          </div>
          <div>
            <dt>Rotor load</dt>
            <dd :class="{ bad: totals.launchLoadG > totals.loadLimitG }">
              {{ totals.launchLoadG.toFixed(1) }} / {{ totals.loadLimitG.toFixed(1) }} g
            </dd>
          </div>
          <div>
            <dt>Release speed</dt>
            <dd>{{ totals.releaseSpeedKms.toFixed(2) }} km/s · {{ releaseSpeedScaleLabel(totals.releaseSpeedScale) }}</dd>
          </div>
          <div>
            <dt>Departure speed</dt>
            <dd>{{ departureSpeedKms.toFixed(3) }} km/s</dd>
          </div>
          <div>
            <dt>Brake reserve</dt>
            <dd>{{ totals.brakeReserveKms.toFixed(2) }} km/s</dd>
          </div>
          <div>
            <dt>Ascent Δv</dt>
            <dd>{{ totals.ascentRequiredKms.toFixed(3) }} / {{ totals.ascentCapacityKms.toFixed(1) }}</dd>
          </div>
          <div>
            <dt>Insertion radius</dt>
            <dd>{{ profile.insertionRadiusKm.toLocaleString('en-US') }} km</dd>
          </div>
          <div>
            <dt>Reception radius</dt>
            <dd>{{ gameData.assumptions.simulation.receptionZoneRadiusKm.toLocaleString('en-US') }} km</dd>
          </div>
        </dl>
        <p class="model-note">
          Balanced is the only verified profile; release direction is fixed across detents.
        </p>

        <details class="analysis">
          <summary>Predicted terminal analysis</summary>
          <p class="spoiler-note">Spoiler: the model's expected terminal event for this loadout.</p>
          <p class="analysis-title">{{ analysisLabel }}</p>
          <p class="analysis-detail">{{ analysisDetail }}</p>
        </details>
      </details>
    </div>

    <footer class="actions">
      <section v-if="validation.blockers.length || launchBlocker" class="messages">
        <p v-if="launchBlocker" class="message bad">
          <span aria-hidden="true">×</span>{{ launchBlocker }}
        </p>
        <p v-for="blocker in validation.blockers" :key="blocker" class="message bad">
          <span aria-hidden="true">×</span>{{ blocker }}
        </p>
      </section>

      <section
        v-if="phase === 'CONFIGURING'"
        class="readiness"
        :class="readiness.tone"
        aria-label="Mission readiness"
      >
        <div class="readiness-head">
          <span class="eyebrow">READINESS</span>
          <span class="readiness-badge">{{ readinessBadge }}</span>
        </div>
        <div class="readiness-title">{{ readiness.title }}</div>
        <p>{{ readiness.detail }}</p>
      </section>

      <p v-if="phase !== 'CONFIGURING' && phaseNote" class="phase-note">{{ phaseNote }}</p>

      <section
        v-if="mode === 'company' && phase === 'CONFIGURING'"
        class="pricing"
        aria-label="Company pricing"
      >
        <div>
          <span>Dispatch cost</span>
          <b>{{ formatCredits(pricing.dispatch) }}</b>
        </div>
        <div>
          <span>Reward on success</span>
          <b class="reward">+{{ formatCredits(pricing.reward) }}</b>
        </div>
        <div>
          <span>Net on success</span>
          <b :class="pricing.net >= 0 ? 'gain' : 'loss'">
            {{ pricing.net >= 0 ? '+' : '' }}{{ formatCredits(pricing.net) }}
          </b>
        </div>
        <div>
          <span>Balance after dispatch</span>
          <b :class="{ loss: pricing.balanceAfter < 0 }">
            {{ formatCredits(pricing.balanceAfter) }}
          </b>
        </div>
      </section>

      <button
        v-if="phase === 'RESULT'"
        type="button"
        class="primary"
        @click="emit('retry')"
      >
        {{ mode === 'company' ? 'Back to jobs' : 'Retry attempt' }}
      </button>
      <button
        v-else
        type="button"
        class="primary"
        :disabled="!canLaunch"
        @click="emit('launch')"
      >
        {{ launchLabel }}
      </button>

      <div class="secondary">
        <button
          v-if="snapshot.result && phase === 'RESULT'"
          type="button"
          class="link"
          @click="emit('open-result')"
        >
          Mission report
        </button>
        <button type="button" class="link" @click="emit('sources')">
          Sources &amp; model notes
        </button>
      </div>
    </footer>
  </aside>
</template>

<style scoped>
.panel {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  min-height: 0;
  background: linear-gradient(180deg, rgba(13, 25, 38, 0.98), rgba(8, 17, 28, 0.98));
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-panel);
  overflow: hidden;
}

.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 9px 14px 8px;
  border-bottom: 1px solid var(--line);
}

.head-title {
  display: flex;
  align-items: baseline;
  gap: 9px;
  min-width: 0;
}

.eyebrow {
  display: block;
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.14em;
  color: var(--muted-dim);
}

h2 {
  margin: 0;
  font-size: 19px;
  font-weight: 600;
  letter-spacing: 0.01em;
}

.attempt {
  flex: 0 0 auto;
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.1em;
  color: var(--muted);
  white-space: nowrap;
}

.scroll {
  overflow-y: auto;
  padding: 8px 14px 6px;
  scroll-padding-bottom: 8px;
  scrollbar-gutter: stable;
}

.scroll::-webkit-scrollbar {
  width: 9px;
}

.scroll::-webkit-scrollbar-track {
  background: rgba(145, 164, 181, 0.06);
}

.scroll::-webkit-scrollbar-thumb {
  background: rgba(145, 164, 181, 0.42);
  border-radius: 999px;
  border: 2px solid transparent;
  background-clip: content-box;
}

.scroll:hover::-webkit-scrollbar-thumb {
  background: rgba(145, 164, 181, 0.62);
  background-clip: content-box;
}

.rows {
  display: grid;
  gap: 6px;
  margin-top: 8px;
}

.row {
  display: grid;
  grid-template-columns: 66px minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  min-height: 36px;
}

.row-label {
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--muted-dim);
}

.cargo-name-wrap {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 4px 7px;
  min-width: 0;
}

.cargo-name {
  min-width: 0;
  font-size: 14px;
  line-height: 1.35;
  color: var(--ivory);
  white-space: normal;
  overflow-wrap: anywhere;
}

.fixed-tag {
  flex: 0 0 auto;
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--muted-dim);
}

.chips {
  display: flex;
  gap: 4px;
  min-width: 0;
}

.chip {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  min-height: 32px;
  padding: 3px 7px;
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  background: rgba(18, 34, 52, 0.35);
  color: var(--muted);
  font-size: 13px;
  cursor: pointer;
  transition: border-color 0.15s ease, color 0.15s ease, background 0.15s ease;
}

.chip input {
  position: absolute;
  opacity: 0;
  width: 1px;
  height: 1px;
}

.quantity-controls {
  display: flex;
  gap: 6px;
}

.quantity-controls .chip {
  flex: 0 0 48px;
  width: 48px;
  min-width: 48px;
  padding: 3px 0;
  font-family: var(--font-mono);
  font-size: 14px;
}

.chips.two .chip {
  flex: 1;
  justify-content: space-between;
  padding: 3px 8px;
}

.chip-title {
  font-size: 14px;
  color: var(--ivory);
  white-space: nowrap;
}

.chip-meta {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--cyan);
  white-space: nowrap;
}

.chip.speed {
  flex: 1;
  padding: 3px 0;
  font-family: var(--font-mono);
  font-size: 12px;
}

.chip.selected {
  border-color: var(--cyan);
  background: var(--cyan-soft);
}

.chip.selected .chip-title {
  color: var(--cyan);
}

.chip:has(input:checked) {
  border-color: var(--cyan);
  background: var(--cyan-soft);
  color: var(--ivory);
}

.quantity-controls .chip:has(input:checked) {
  background: var(--cyan);
  color: var(--ink);
  font-weight: 700;
}

.chip:has(input:focus-visible) {
  outline: 2px solid var(--amber);
  outline-offset: 2px;
}

.chip:has(input:disabled) {
  cursor: not-allowed;
  opacity: 0.55;
}

.more {
  margin-top: 9px;
  padding-top: 8px;
  border-top: 1px solid var(--line);
}

.more summary,
.analysis summary {
  cursor: pointer;
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--muted);
  list-style: none;
}

.more summary::-webkit-details-marker,
.analysis summary::-webkit-details-marker {
  display: none;
}

.more summary::before,
.analysis summary::before {
  content: '▸ ';
  color: var(--cyan);
}

.more[open] > summary::before,
.analysis[open] > summary::before {
  content: '▾ ';
}

.more summary:hover,
.analysis summary:hover {
  color: var(--cyan);
}

.checks {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 3px 10px;
  margin: 8px 0 0;
  padding: 0;
  list-style: none;
}

.checks li {
  display: flex;
  align-items: baseline;
  gap: 4px;
  min-width: 0;
  font-size: 10px;
  color: var(--muted);
}

.checks li b {
  margin-left: auto;
  font-family: var(--font-mono);
  font-weight: 400;
  font-size: 9.5px;
  color: var(--ivory);
  white-space: nowrap;
}

.check-label {
  white-space: nowrap;
}

.check-icon {
  flex: 0 0 auto;
  font-family: var(--font-mono);
  font-weight: 700;
  color: var(--cyan);
}

.checks li.warn .check-icon {
  color: var(--amber);
}

.checks li.bad .check-icon {
  color: var(--error);
}

.detail-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px 12px;
  margin: 9px 0 0;
}

.detail-grid dt {
  font-family: var(--font-mono);
  font-size: 8.5px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--muted-dim);
}

.detail-grid dd {
  margin: 1px 0 0;
  font-family: var(--font-mono);
  font-size: 10.5px;
  color: var(--ivory);
  font-variant-numeric: tabular-nums;
}

.detail-grid dd.bad {
  color: var(--error);
}

.model-note {
  margin-top: 8px;
  font-size: 10px;
  color: var(--muted-dim);
}

.analysis {
  margin-top: 9px;
  padding-top: 7px;
  border-top: 1px solid var(--line);
}

.spoiler-note {
  margin-top: 7px;
  font-size: 10px;
  color: var(--muted-dim);
}

.analysis-title {
  margin-top: 4px;
  font-size: 12px;
  color: var(--ivory);
}

.analysis-detail {
  margin-top: 2px;
  font-size: 10.5px;
  line-height: 1.45;
  color: var(--muted);
}

.actions {
  padding: 8px 14px 9px;
  border-top: 1px solid var(--line);
  background: rgba(6, 13, 24, 0.55);
}

.messages {
  display: grid;
  gap: 5px;
  margin-bottom: 7px;
}

.message {
  display: flex;
  gap: 7px;
  font-size: 10.5px;
  line-height: 1.4;
  padding: 6px 8px;
  border-radius: var(--radius-sm);
}

.message span {
  font-family: var(--font-mono);
  font-weight: 700;
}

.message.bad {
  color: #ffc2c2;
  background: var(--error-soft);
  border: 1px solid rgba(255, 107, 107, 0.28);
}

.readiness {
  margin-bottom: 7px;
  padding: 6px 9px;
  border: 1px solid var(--line);
  border-left: 3px solid var(--muted-dim);
  border-radius: var(--radius-sm);
  background: rgba(18, 34, 52, 0.35);
}

.readiness.ok {
  border-left-color: var(--cyan);
}

.readiness.warn {
  border-left-color: var(--amber);
  background: var(--amber-soft);
}

.readiness.bad {
  border-left-color: var(--error);
  background: var(--error-soft);
}

.readiness-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}

.readiness-badge {
  font-family: var(--font-mono);
  font-size: 8.5px;
  letter-spacing: 0.08em;
  color: var(--muted);
}

.readiness.ok .readiness-badge {
  color: var(--cyan);
}

.readiness.warn .readiness-badge {
  color: var(--amber);
}

.readiness.bad .readiness-badge {
  color: var(--error);
}

.readiness-title {
  font-size: 17px;
  color: var(--ivory);
}

.readiness.ok .readiness-title {
  color: var(--cyan);
}

.readiness.warn .readiness-title {
  color: var(--amber);
}

.readiness.bad .readiness-title {
  color: var(--error);
}

.readiness p {
  margin-top: 1px;
  font-size: 11.5px;
  line-height: 1.4;
  color: var(--muted);
}

.phase-note {
  font-size: 10.5px;
  color: var(--muted);
  margin-bottom: 7px;
  line-height: 1.4;
}

.pricing {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 3px 10px;
  margin-bottom: 6px;
  padding: 5px 8px;
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  background: rgba(18, 34, 52, 0.4);
}

.pricing div {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: baseline;
  gap: 6px;
  min-width: 0;
}

.pricing span {
  font-family: var(--font-mono);
  font-size: 8.5px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--muted-dim);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.pricing b {
  font-family: var(--font-mono);
  font-size: 10.5px;
  font-weight: 400;
  color: var(--ivory);
  white-space: nowrap;
}

.pricing b.reward {
  color: var(--amber);
}

.pricing b.gain {
  color: var(--cyan);
}

.pricing b.loss {
  color: var(--error);
}

.primary {
  width: 100%;
  padding: 9px 16px;
  border: 1px solid var(--amber);
  border-radius: var(--radius-sm);
  background: var(--amber);
  color: #221604;
  font-family: var(--font-mono);
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.11em;
  text-transform: uppercase;
  transition: filter 0.15s ease, transform 0.1s ease;
}

.primary:hover:not(:disabled) {
  filter: brightness(1.08);
}

.primary:active:not(:disabled) {
  transform: translateY(1px);
}

.primary:disabled {
  border-color: var(--line);
  background: rgba(145, 164, 181, 0.12);
  color: var(--muted-dim);
}

.secondary {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px 12px;
  margin-top: 6px;
}

.link {
  padding: 0;
  border: 0;
  background: none;
  font-size: 10.5px;
  color: var(--muted);
  text-decoration: underline;
  text-decoration-color: rgba(145, 164, 181, 0.4);
  text-underline-offset: 3px;
}

.link:hover {
  color: var(--cyan);
}

@media (max-width: 480px) {
  .row {
    grid-template-columns: 54px minmax(0, 1fr);
  }
  .row-label {
    font-size: 9px;
  }
  .cargo-name {
    display: none;
  }
  .checks {
    grid-template-columns: 1fr;
  }
}

/* Short viewports (e.g. 1280×720): keep cargo preview, the four config rows,
   the six speed detents, readiness and Launch reachable without scrolling the
   core controls. Flight details stay in the collapsed section below. */
@media (max-height: 820px) {
  .scroll {
    padding-top: 4px;
  }
  .rows {
    gap: 3px;
    margin-top: 4px;
  }
  .row {
    min-height: 27px;
  }
  .chip {
    min-height: 26px;
  }
  .more {
    margin-top: 6px;
    padding-top: 5px;
  }
  .actions {
    padding: 6px 14px 7px;
  }
  .readiness {
    margin-bottom: 6px;
    padding: 5px 9px;
  }
  .readiness-title {
    font-size: 15px;
  }
  .readiness p {
    font-size: 11px;
  }
  .primary {
    padding: 8px 16px;
  }
}
</style>
