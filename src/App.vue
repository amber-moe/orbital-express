<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import ConfigPanel from './components/ConfigPanel.vue'
import ContractCard from './components/ContractCard.vue'
import DebugDrawer from './components/DebugDrawer.vue'
import JobsPanel from './components/JobsPanel.vue'
import LauncherInset from './components/LauncherInset.vue'
import MissionHeader from './components/MissionHeader.vue'
import MissionProgress from './components/MissionProgress.vue'
import ResultDialog from './components/ResultDialog.vue'
import SourcesDialog from './components/SourcesDialog.vue'
import SpaceViewport from './components/SpaceViewport.vue'
import { useCompany } from './composables/useCompany'
import { useMission } from './composables/useMission'
import {
  createDispatchId,
  type CompanySettlement,
  type GameMode,
} from './game/company'
import { gameData } from './game/data'
import {
  configForContract,
  estimateOrderCosts,
  getCargo,
  getContract,
  getProfile,
  initialResources,
} from './game/rules/configRules'
import type { CargoDefinition, ContractData, Resources } from './game/types'

interface OrderView {
  contract: ContractData
  cargo: CargoDefinition
}

const { snapshot, controller, setConfig, launch, retry, startSession } = useMission()
const company = useCompany()
const companyState = company.state
const companyNotice = company.notice
const externalChange = company.externalChange
const storageAvailable = company.storageAvailable
const companyOwnership = company.ownership
const companyLockMessage = company.lockMessage
const companyCanManage = company.canWrite
const retryCompanyOwnership = company.retryOwnership

const isDev = import.meta.env.DEV
const mode = ref<GameMode>('practice')
const selectedContractId = ref('first-delivery')
const jobsOpen = ref(false)
const resultVisible = ref(false)
const sourcesOpen = ref(false)
const lastSettlement = ref<CompanySettlement | null>(null)
const sessionDispatchId = ref<string | null>(null)

const contract = computed(() => getContract(gameData, selectedContractId.value))
const cargo = computed(() => getCargo(gameData, contract.value.cargoId))
const profile = computed(() => getProfile(gameData, snapshot.value.config.profileId))

const orders = computed<OrderView[]>(() =>
  Object.values(gameData.contracts).map((item) => ({
    contract: item,
    cargo: getCargo(gameData, item.cargoId),
  })),
)

const outcomeKind = computed(() => snapshot.value.result?.kind ?? null)
const flightActive = computed(
  () => snapshot.value.phase !== 'CONFIGURING' && snapshot.value.phase !== 'RESULT',
)
const jobsDisabled = flightActive

const creditLabel = computed(() =>
  mode.value === 'company' ? 'COMPANY BALANCE' : 'PRACTICE BUDGET',
)

const launchBlocker = computed(() => {
  if (mode.value !== 'company' || snapshot.value.phase !== 'CONFIGURING') return null
  if (!companyCanManage.value) {
    return companyLockMessage.value ?? 'Company Jobs are locked in this tab.'
  }
  if (externalChange.value) {
    return 'Company data changed in another tab. Reload before a paid launch.'
  }
  if (companyState.value.pending) {
    return 'A paid dispatch is already pending.'
  }
  return null
})

watch(
  () => companyOwnership.value,
  (value) => {
    if (value === 'blocked' || value === 'unsupported' || value === 'error') {
      jobsOpen.value = true
    }
  },
)

watch(
  () => companyNotice.value,
  (value) => {
    if (value) jobsOpen.value = true
  },
)

// Keep the practice header spoiler-free during the approach animation. Company
// balance is already debited at dispatch and only credited after settlement.
const displayCredits = computed(() => {
  if (mode.value === 'company') return companyState.value.balance
  const state = snapshot.value
  if (state.phase === 'APPROACH' && state.contractComplete) {
    return state.resources.credits - contract.value.rewardCredits
  }
  return state.resources.credits
})

const getPhaseProgress = (): number => controller.value.getFrameState().phaseProgress

function startSessionFor(contractId: string, nextMode: GameMode, keepJobsOpen = false): void {
  if (nextMode === 'company' && !companyCanManage.value) return
  const nextContract = getContract(gameData, contractId)
  const nextCargo = getCargo(gameData, nextContract.cargoId)
  const config = configForContract(gameData, contractId)
  let resources: Resources
  if (nextMode === 'company') {
    resources = {
      credits: companyState.value.balance,
      energyGj: nextContract.startingEnergyGj,
      stock: nextCargo.stock,
    }
  } else {
    resources = initialResources(nextContract, nextCargo)
  }
  startSession(config, resources)
  selectedContractId.value = contractId
  mode.value = nextMode
  lastSettlement.value = null
  sessionDispatchId.value = null
  resultVisible.value = false
  jobsOpen.value = keepJobsOpen
}

function changeMode(nextMode: GameMode): void {
  if (nextMode === mode.value || flightActive.value) return
  if (
    nextMode === 'company' &&
    (!companyCanManage.value || externalChange.value || companyState.value.pending)
  ) {
    return
  }
  startSessionFor(selectedContractId.value, nextMode, true)
}

function acceptOrder(contractId: string): void {
  if (flightActive.value) return
  if (mode.value === 'company') {
    if (!companyCanManage.value || externalChange.value || companyState.value.pending) return
    const costs = estimateOrderCosts(gameData, contractId)
    if (costs.successFrom === null || companyState.value.balance < costs.launchFrom) return
  }
  startSessionFor(contractId, mode.value)
}

function handleLaunch(): void {
  if (snapshot.value.phase !== 'CONFIGURING') return
  if (!snapshot.value.validation.ok || !snapshot.value.prediction) return
  if (mode.value === 'company') {
    if (!companyCanManage.value || launchBlocker.value) return
    const cost = snapshot.value.totals.launchCredits
    if (cost > companyState.value.balance) return
    const id = createDispatchId()
    const dispatched = company.dispatch({
      id,
      contractId: snapshot.value.config.contractId,
      orderLabel: contract.value.orderLabel,
      cargoId: snapshot.value.config.cargoId,
      requiredQuantity: contract.value.requiredQuantity,
      cost,
      at: Date.now(),
    })
    if (!dispatched.ok) return
    sessionDispatchId.value = id
    if (!launch()) {
      company.rollback(id)
      sessionDispatchId.value = null
      return
    }
  } else {
    launch()
  }
  resultVisible.value = false
  jobsOpen.value = false
}

function settleCompanyIfNeeded(): void {
  if (mode.value !== 'company' || !companyCanManage.value) return
  const dispatchId = sessionDispatchId.value
  const result = snapshot.value.result
  if (!dispatchId || !result || snapshot.value.phase !== 'RESULT') return
  const pending = companyState.value.pending
  if (!pending || pending.id !== dispatchId) return
  const settled = company.settle({
    dispatchId,
    outcome: result.kind,
    reward: contract.value.rewardCredits,
    deliveredQuantity: result.deliveredQuantity,
    at: Date.now(),
  })
  if (settled.applied) {
    lastSettlement.value = settled.settlement
    sessionDispatchId.value = null
  }
}

watch(
  () => snapshot.value.phase,
  (phase) => {
    if (phase === 'RESULT') {
      settleCompanyIfNeeded()
      if (snapshot.value.result) resultVisible.value = true
    }
  },
)

function handleRetry(): void {
  resultVisible.value = false
  if (mode.value === 'company') {
    jobsOpen.value = true
    return
  }
  retry()
}

function openJobs(): void {
  if (flightActive.value) return
  resultVisible.value = false
  jobsOpen.value = true
}

function openResult(): void {
  if (snapshot.value.result) resultVisible.value = true
}

function confirmRestart(): void {
  if (
    !companyCanManage.value ||
    flightActive.value ||
    companyState.value.pending ||
    externalChange.value
  ) {
    return
  }
  const confirmed = window.confirm(
    'Restart Company? This clears company balance, history and statistics. It is not a money-making action.',
  )
  if (!confirmed) return
  company.restart()
  if (mode.value === 'company') {
    startSessionFor(selectedContractId.value, 'company')
    jobsOpen.value = true
  }
}
</script>

<template>
  <div class="app">
    <MissionHeader
      :credits="displayCredits"
      :credit-label="creditLabel"
      :energy-gj="snapshot.resources.energyGj"
      :phase="snapshot.phase"
      :contract-complete="snapshot.contractComplete"
      :mode="mode"
      :order-label="contract.orderLabel"
      :jobs-disabled="jobsDisabled"
      @jobs="openJobs"
    />

    <main class="main">
      <section class="field" aria-label="Earth–Moon flight view">
        <SpaceViewport :controller="controller" />
        <div class="field-overlay">
          <ContractCard
            :contract="contract"
            :cargo="cargo"
            :loaded-quantity="snapshot.config.quantity"
            :phase="snapshot.phase"
            :outcome-kind="outcomeKind"
          />
        </div>
        <LauncherInset
          :phase="snapshot.phase"
          :profile="profile"
          :totals="snapshot.totals"
          :get-progress="getPhaseProgress"
        />
      </section>

      <ConfigPanel
        :snapshot="snapshot"
        :contract="contract"
        :cargo="cargo"
        :profile="profile"
        :equipment="gameData.equipment"
        :reference-mass-kg="gameData.assumptions.launcher.referenceMassKg"
        :mode="mode"
        :launch-blocker="launchBlocker"
        :company-balance="companyState.balance"
        @set-config="setConfig"
        @launch="handleLaunch"
        @retry="handleRetry"
        @open-result="openResult"
        @sources="sourcesOpen = true"
      />
    </main>

    <MissionProgress :phase="snapshot.phase" :outcome-kind="outcomeKind" />

    <ResultDialog
      :open="resultVisible"
      :result="snapshot.result"
      :title="snapshot.resultTitle"
      :detail="snapshot.resultDetail"
      :contract-complete="snapshot.contractComplete"
      :reward-credits="contract.rewardCredits"
      :required-quantity="contract.requiredQuantity"
      :loaded-quantity="snapshot.config.quantity"
      :mode="mode"
      :settlement="lastSettlement"
      @close="resultVisible = false"
      @retry="handleRetry"
    />

    <JobsPanel
      :open="jobsOpen"
      :mode="mode"
      :company="companyState"
      :orders="orders"
      :selected-order-id="selectedContractId"
      :flight-active="flightActive"
      :storage-available="storageAvailable"
      :external-change="externalChange"
      :notice="companyNotice"
      :ownership="companyOwnership"
      :lock-message="companyLockMessage"
      :can-manage-company="companyCanManage"
      @retry-ownership="retryCompanyOwnership"
      @close="jobsOpen = false"
      @set-mode="changeMode"
      @accept="acceptOrder"
      @restart="confirmRestart"
      @reload="company.reload"
      @dismiss-notice="company.clearNotice"
    />

    <SourcesDialog :open="sourcesOpen" @close="sourcesOpen = false" />

    <DebugDrawer v-if="isDev" :snapshot="snapshot" />
  </div>
</template>

<style scoped>
.app {
  height: 100%;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  min-height: 0;
}

.main {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 416px;
  gap: 14px;
  padding: 14px 16px;
  min-height: 0;
}

.field {
  position: relative;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  background: var(--ink-deep);
}

.field-overlay {
  position: absolute;
  top: 14px;
  left: 14px;
  z-index: 3;
  pointer-events: none;
}

.field-overlay :deep(.contract) {
  pointer-events: auto;
}

@media (max-width: 1180px) {
  .main {
    grid-template-columns: minmax(0, 1fr) 384px;
    gap: 10px;
    padding: 10px;
  }
}

@media (max-width: 980px) {
  .app {
    height: auto;
    min-height: 100%;
  }
  .main {
    grid-template-columns: 1fr;
    grid-template-rows: minmax(430px, 58vh) auto;
    overflow-y: auto;
  }
  .field {
    min-height: 430px;
  }
}
</style>
