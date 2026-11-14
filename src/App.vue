<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import ConfigPanel from './components/ConfigPanel.vue'
import ContractCard from './components/ContractCard.vue'
import LauncherInset from './components/LauncherInset.vue'
import MissionHeader from './components/MissionHeader.vue'
import MissionProgress from './components/MissionProgress.vue'
import ResultDialog from './components/ResultDialog.vue'
import SourcesDialog from './components/SourcesDialog.vue'
import SpaceViewport from './components/SpaceViewport.vue'
import { useMission } from './composables/useMission'
import { gameData } from './game/data'
import { firstContract, getCargo, getProfile } from './game/rules/configRules'

const { snapshot, controller, setConfig, launch, retry } = useMission()

const contract = firstContract(gameData)
const cargo = getCargo(gameData, contract.cargoId)
const profile = computed(() => getProfile(gameData, snapshot.value.config.profileId))

const resultVisible = ref(false)
const sourcesOpen = ref(false)

watch(
  () => snapshot.value.phase,
  (phase) => {
    if (phase === 'RESULT' && snapshot.value.result) {
      resultVisible.value = true
    }
  },
)

const outcomeKind = computed(() => snapshot.value.result?.kind ?? null)

function handleLaunch(): void {
  launch()
  resultVisible.value = false
}

function handleRetry(): void {
  retry()
  resultVisible.value = false
}

function openResult(): void {
  if (snapshot.value.result) resultVisible.value = true
}
</script>

<template>
  <div class="app">
    <MissionHeader
      :credits="snapshot.resources.credits"
      :energy-gj="snapshot.resources.energyGj"
      :phase="snapshot.phase"
      :contract-complete="snapshot.contractComplete"
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
        <LauncherInset :phase="snapshot.phase" :profile="profile" :totals="snapshot.totals" />
      </section>

      <ConfigPanel
        :snapshot="snapshot"
        :contract="contract"
        :cargo="cargo"
        :profile="profile"
        :equipment="gameData.equipment"
        :reference-mass-kg="gameData.assumptions.launcher.referenceMassKg"
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
      @close="resultVisible = false"
      @retry="handleRetry"
    />

    <SourcesDialog :open="sourcesOpen" @close="sourcesOpen = false" />
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
  grid-template-columns: minmax(0, 1fr) 384px;
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
    grid-template-columns: minmax(0, 1fr) 344px;
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

:global(body) {
  overflow: hidden;
}

@media (max-width: 980px) {
  :global(body) {
    overflow: auto;
  }
}
</style>
