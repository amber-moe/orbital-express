<script setup lang="ts">
import { computed } from 'vue'
import { shortOutcomeLabel } from '../game/outcomeMessages'
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
  () => phase.value === 'CONFIGURING' && validation.value.ok && prediction.value !== null,
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
      return 'Centrifuge ring accelerating. Configuration locked.'
    case 'DEPARTURE':
      return 'Fictional assisted-ascent phase. Transfer state locked.'
    case 'TRANSFER':
      return 'Fixed-step Earth–Moon flight in progress.'
    case 'APPROACH':
      return 'Finite braking burn and reception check.'
    case 'RESULT':
      return 'Review the report, then retry to reset the order.'
    default:
      return ''
  }
})

const predictionTone = computed(() => {
  if (validation.value.blockers.length > 0) return 'bad'
  const kind = prediction.value?.outcomeKind
  if (!kind) return 'neutral'
  if (kind === 'delivered') return 'ok'
  if (kind === 'contract-shortfall') return 'warn'
  return 'bad'
})

const predictionLabel = computed(() => {
  if (validation.value.blockers.length > 0) return 'Launch blocked'
  return prediction.value ? shortOutcomeLabel(prediction.value.outcomeKind) : 'No preview'
})

const predictionDetail = computed(() => {
  if (validation.value.blockers.length > 0) {
    return validation.value.blockers[0] ?? 'Resolve the highlighted blockers before launch.'
  }
  const item = prediction.value
  if (!item) return 'Configuration cannot be simulated.'
  const speed = item.relativeSpeedKms !== null ? `${item.relativeSpeedKms.toFixed(3)} km/s` : '—'
  switch (item.outcomeKind) {
    case 'delivered':
      return `Zone entry ${speed} · brake ${item.requiredBrakeKms?.toFixed(3) ?? '—'} km/s · ${item.brakeRemainingKms.toFixed(2)} km/s left`
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

const volumePercent = computed(() =>
  Math.min(100, (totals.value.totalVolume / totals.value.maxVolume) * 100),
)
const energyPercent = computed(() =>
  Math.min(
    100,
    (totals.value.rotorEnergyGj / Math.max(props.snapshot.resources.energyGj, 0.001)) * 100,
  ),
)

const moduleReserve = (id: ModuleId): number => {
  const module = props.equipment.modules[id]
  const baseMass = totals.value.totalMassKg - totals.value.moduleMassKg
  const mass = baseMass + module.massKg
  return module.baseBrakeReserveKms * Math.sqrt(props.referenceMassKg / mass)
}

const protectionLimit = (id: ProtectionId): number =>
  props.cargo.maxLaunchLoadG * props.equipment.protection[id].launchLoadMultiplier

const setQuantity = (quantity: CrateQuantity): void => {
  emit('set-config', { quantity })
}

const setProtection = (protectionId: ProtectionId): void => {
  emit('set-config', { protectionId })
}

const setModule = (moduleId: ModuleId): void => {
  emit('set-config', { moduleId })
}
</script>

<template>
  <aside class="panel" aria-labelledby="config-heading">
    <header class="panel-head">
      <div>
        <span class="eyebrow">MISSION CONFIG</span>
        <h2 id="config-heading">Loadout</h2>
      </div>
      <span class="attempt">ATTEMPT {{ snapshot.attempt || '—' }}</span>
    </header>

    <div class="scroll">
      <fieldset class="group">
        <legend>
          CARGO
          <span>{{ cargo.stock }} in stock</span>
        </legend>
        <div class="cargo-row">
          <span class="cargo-name">{{ cargo.name }}</span>
          <span class="cargo-mass">{{ cargo.unitMassKg }} kg / crate</span>
        </div>
        <div class="segmented" role="radiogroup" aria-label="Cargo quantity">
          <label v-for="quantity in contract.allowedQuantities" :key="quantity" class="seg">
            <input
              type="radio"
              name="cargo-quantity"
              :value="quantity"
              :checked="config.quantity === quantity"
              :disabled="phase !== 'CONFIGURING'"
              @change="setQuantity(quantity)"
            />
            <span>{{ quantity }}</span>
          </label>
        </div>
        <p class="hint">
          Contract requires {{ contract.requiredQuantity }} crate{{ contract.requiredQuantity === 1 ? '' : 's' }}.
          One cargo type per capsule.
        </p>
      </fieldset>

      <fieldset class="group">
        <legend>PROTECTION <span>{{ totals.loadLimitG.toFixed(0) }} g limit</span></legend>
        <div class="choices">
          <label
            v-for="protectionId in (['standard', 'reinforced'] as const)"
            :key="protectionId"
            class="choice"
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
            <span class="choice-title">{{ equipment.protection[protectionId].name }}</span>
            <span class="choice-meta">
              {{ protectionLimit(protectionId).toFixed(0) }} g · {{ equipment.protection[protectionId].massKg }} kg
            </span>
          </label>
        </div>
      </fieldset>

      <fieldset class="group">
        <legend>MANEUVER MODULE <span>brake reserve</span></legend>
        <div class="choices">
          <label
            v-for="moduleId in (['small', 'large'] as const)"
            :key="moduleId"
            class="choice"
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
            <span class="choice-title">{{ equipment.modules[moduleId].name }}</span>
            <span class="choice-meta">
              {{ moduleReserve(moduleId).toFixed(2) }} km/s · {{ equipment.modules[moduleId].massKg }} kg
            </span>
          </label>
        </div>
      </fieldset>

      <section class="profile">
        <div class="profile-head">
          <span class="eyebrow">LAUNCH PROFILE</span>
          <span class="verified">VERIFIED</span>
        </div>
        <div class="profile-title">{{ profile.name }}</div>
        <p>{{ profile.description }}</p>
        <p class="future">Economy and Fast profiles arrive in the next slice.</p>
      </section>

      <section class="estimate" aria-label="Mission estimate">
        <div class="estimate-head">
          <span class="eyebrow">MISSION ESTIMATE</span>
          <span class="mono">{{ totals.totalMassKg.toFixed(0) }} kg</span>
        </div>
        <div class="metric">
          <span>Volume</span>
          <div class="bar"><i :style="{ width: `${volumePercent}%` }"></i></div>
          <strong>{{ totals.totalVolume.toFixed(2) }} / {{ totals.maxVolume.toFixed(2) }}</strong>
        </div>
        <div class="metric">
          <span>Rotor energy</span>
          <div class="bar amber"><i :style="{ width: `${energyPercent}%` }"></i></div>
          <strong>{{ totals.rotorEnergyGj.toFixed(2) }} GJ</strong>
        </div>
        <dl class="stat-grid">
          <div>
            <dt>LAUNCH COST</dt>
            <dd>{{ Math.round(totals.launchCredits).toLocaleString('en-US') }} cr</dd>
          </div>
          <div>
            <dt>ROTOR LOAD</dt>
            <dd :class="{ bad: totals.launchLoadG > totals.loadLimitG }">
              {{ totals.launchLoadG.toFixed(1) }} / {{ totals.loadLimitG.toFixed(1) }} g
            </dd>
          </div>
          <div>
            <dt>BRAKE RESERVE</dt>
            <dd>{{ totals.brakeReserveKms.toFixed(2) }} km/s</dd>
          </div>
          <div>
            <dt>ASCENT Δv</dt>
            <dd>{{ totals.ascentRequiredKms.toFixed(3) }} / {{ totals.ascentCapacityKms.toFixed(1) }}</dd>
          </div>
        </dl>
      </section>
    </div>

    <footer class="actions">
      <section v-if="validation.blockers.length || validation.warnings.length" class="messages">
        <p v-for="blocker in validation.blockers" :key="blocker" class="message bad">
          <span aria-hidden="true">×</span>{{ blocker }}
        </p>
        <p v-for="warning in validation.warnings" :key="warning" class="message warn">
          <span aria-hidden="true">!</span>{{ warning }}
        </p>
      </section>

      <section class="prediction" :class="predictionTone" aria-label="Simulation preview">
        <div class="prediction-head">
          <span class="eyebrow">SIMULATION PREVIEW</span>
          <span class="mono">{{ snapshot.lastPredictionMs.toFixed(1) }} ms</span>
        </div>
        <div class="prediction-title">{{ predictionLabel }}</div>
        <p>{{ predictionDetail }}</p>
      </section>

      <p v-if="phaseNote" class="phase-note">{{ phaseNote }}</p>
      <button
        v-if="phase === 'RESULT'"
        type="button"
        class="primary"
        @click="emit('retry')"
      >
        Retry attempt
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
        <span class="perf">
          previews {{ snapshot.predictionComputeCount }} · cache {{ snapshot.predictionCacheHits }}
        </span>
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
  align-items: flex-start;
  justify-content: space-between;
  padding: 13px 16px 10px;
  border-bottom: 1px solid var(--line);
}

.eyebrow {
  display: block;
  font-family: var(--font-mono);
  font-size: 7px;
  letter-spacing: 0.18em;
  color: var(--muted-dim);
}

h2 {
  margin-top: 2px;
  font-size: 19px;
  font-weight: 600;
  letter-spacing: 0.01em;
}

.attempt {
  font-family: var(--font-mono);
  font-size: 7px;
  letter-spacing: 0.14em;
  color: var(--muted);
  padding-top: 3px;
}

.scroll {
  overflow-y: auto;
  padding: 13px 16px 4px;
  scrollbar-width: thin;
  scrollbar-color: rgba(145, 164, 181, 0.28) transparent;
}

.group {
  border: 0;
  padding: 0;
  margin: 0 0 11px;
  min-width: 0;
}

legend {
  display: flex;
  justify-content: space-between;
  width: 100%;
  padding: 0 0 7px;
  font-family: var(--font-mono);
  font-size: 8px;
  letter-spacing: 0.15em;
  color: var(--muted);
}

legend span {
  color: var(--muted-dim);
  letter-spacing: 0.05em;
  font-size: 7px;
}

.cargo-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  padding: 8px 10px;
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  background: rgba(18, 34, 52, 0.5);
}

.cargo-name {
  font-size: 12px;
  color: var(--ivory);
}

.cargo-mass {
  font-family: var(--font-mono);
  font-size: 8px;
  color: var(--muted);
}

.segmented {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 4px;
  margin-top: 6px;
}

.seg {
  position: relative;
  display: block;
}

.seg input,
.choice input {
  position: absolute;
  opacity: 0;
  width: 1px;
  height: 1px;
}

.seg span {
  display: block;
  padding: 7px 0;
  text-align: center;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--muted);
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  background: rgba(18, 34, 52, 0.35);
  transition: border-color 0.15s ease, color 0.15s ease, background 0.15s ease;
}

.seg input:checked + span {
  color: var(--ink);
  background: var(--cyan);
  border-color: var(--cyan);
  font-weight: 700;
}

.seg input:focus-visible + span,
.choice input:focus-visible ~ .choice-title {
  outline: 2px solid var(--amber);
  outline-offset: 2px;
}

.seg input:disabled + span {
  opacity: 0.55;
  cursor: not-allowed;
}

.hint {
  margin-top: 5px;
  font-size: 9px;
  color: var(--muted-dim);
  line-height: 1.4;
}

.choices {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}

.choice {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 7px 9px;
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  background: rgba(18, 34, 52, 0.35);
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease;
}

.choice.selected {
  border-color: var(--cyan-line);
  background: var(--cyan-soft);
}

.choice-title {
  font-size: 11px;
  color: var(--ivory);
}

.choice-meta {
  font-family: var(--font-mono);
  font-size: 8px;
  color: var(--cyan);
}

.choice:has(input:disabled) {
  cursor: not-allowed;
  opacity: 0.6;
}

.profile {
  margin-bottom: 11px;
  padding: 9px 11px;
  border: 1px solid var(--cyan-line);
  border-radius: var(--radius-sm);
  background: linear-gradient(135deg, rgba(76, 228, 209, 0.09), rgba(76, 228, 209, 0.02));
}

.profile-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 3px;
}

.verified {
  font-family: var(--font-mono);
  font-size: 7px;
  letter-spacing: 0.14em;
  color: var(--cyan);
  border: 1px solid var(--cyan-line);
  border-radius: 999px;
  padding: 2px 6px;
}

.profile-title {
  font-size: 14px;
  color: var(--ivory);
}

.profile p {
  margin-top: 4px;
  font-size: 9px;
  line-height: 1.45;
  color: var(--muted);
}

.profile p.future {
  color: var(--muted-dim);
  font-style: italic;
}

.estimate {
  margin-bottom: 14px;
}

.estimate-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 7px;
}

.mono {
  font-family: var(--font-mono);
  font-size: 8px;
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}

.metric {
  display: grid;
  grid-template-columns: 74px 1fr auto;
  align-items: center;
  gap: 8px;
  margin-bottom: 5px;
  font-size: 9px;
  color: var(--muted);
}

.metric strong {
  font-family: var(--font-mono);
  font-weight: 400;
  font-size: 8px;
  color: var(--ivory);
  font-variant-numeric: tabular-nums;
}

.bar {
  height: 3px;
  border-radius: 999px;
  background: rgba(145, 164, 181, 0.14);
  overflow: hidden;
}

.bar i {
  display: block;
  height: 100%;
  background: var(--cyan);
  border-radius: inherit;
}

.bar.amber i {
  background: var(--amber);
}

.stat-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 7px 12px;
  margin: 9px 0 0;
  padding-top: 9px;
  border-top: 1px solid var(--line);
}

.stat-grid dt {
  font-family: var(--font-mono);
  font-size: 6px;
  letter-spacing: 0.13em;
  color: var(--muted-dim);
}

.stat-grid dd {
  margin: 1px 0 0;
  font-family: var(--font-mono);
  font-size: 9px;
  color: var(--ivory);
  font-variant-numeric: tabular-nums;
}

.stat-grid dd.bad {
  color: var(--error);
}

.prediction {
  margin-bottom: 8px;
  padding: 8px 10px;
  border: 1px solid var(--line);
  border-left: 2px solid var(--muted-dim);
  border-radius: var(--radius-sm);
  background: rgba(18, 34, 52, 0.35);
}

.prediction-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 2px;
}

.prediction-title {
  font-size: 13px;
  color: var(--ivory);
}

.prediction p {
  margin-top: 2px;
  font-size: 9px;
  line-height: 1.45;
  color: var(--muted);
}

.prediction.ok {
  border-left-color: var(--cyan);
}

.prediction.ok .prediction-title {
  color: var(--cyan);
}

.prediction.warn {
  border-left-color: var(--amber);
  background: var(--amber-soft);
}

.prediction.warn .prediction-title {
  color: var(--amber);
}

.prediction.bad {
  border-left-color: var(--error);
  background: var(--error-soft);
}

.prediction.bad .prediction-title {
  color: var(--error);
}

.messages {
  display: grid;
  gap: 5px;
  margin-bottom: 8px;
}

.message {
  display: flex;
  gap: 7px;
  font-size: 9px;
  line-height: 1.4;
  padding: 6px 8px;
  border-radius: var(--radius-sm);
}

.message span {
  font-family: var(--font-mono);
  font-weight: 700;
}

.message.bad {
  color: #ffb4b4;
  background: var(--error-soft);
  border: 1px solid rgba(255, 107, 107, 0.24);
}

.message.warn {
  color: #ffd79a;
  background: var(--amber-soft);
  border: 1px solid rgba(255, 180, 59, 0.22);
}

.actions {
  padding: 10px 16px 12px;
  border-top: 1px solid var(--line);
  background: rgba(6, 13, 24, 0.55);
}

.phase-note {
  font-size: 8px;
  color: var(--muted-dim);
  margin-bottom: 7px;
  line-height: 1.4;
}

.primary {
  width: 100%;
  padding: 11px 16px;
  border: 1px solid var(--amber);
  border-radius: var(--radius-sm);
  background: var(--amber);
  color: #221604;
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.13em;
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
  background: rgba(145, 164, 181, 0.1);
  color: var(--muted-dim);
}

.secondary {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px 13px;
  margin-top: 9px;
}

.link {
  padding: 0;
  border: 0;
  background: none;
  font-size: 8px;
  color: var(--muted);
  text-decoration: underline;
  text-decoration-color: rgba(145, 164, 181, 0.35);
  text-underline-offset: 3px;
}

.link:hover {
  color: var(--cyan);
}

.perf {
  margin-left: auto;
  font-family: var(--font-mono);
  font-size: 7px;
  color: var(--muted-dim);
  letter-spacing: 0.03em;
}
</style>
