<script setup lang="ts">
import { gameData } from '../game/data'
import { configKey } from '../game/rules/configRules'
import type { MissionSnapshot } from '../game/types'

const props = defineProps<{ snapshot: MissionSnapshot }>()

const simulation = gameData.assumptions.simulation
</script>

<template>
  <details class="debug">
    <summary>Debug</summary>
    <dl>
      <div>
        <dt>Phase</dt>
        <dd>{{ props.snapshot.phase }}</dd>
      </div>
      <div>
        <dt>Config key</dt>
        <dd>{{ configKey(props.snapshot.config) }}</dd>
      </div>
      <div>
        <dt>Prediction compute</dt>
        <dd>{{ props.snapshot.lastPredictionMs.toFixed(2) }} ms</dd>
      </div>
      <div>
        <dt>Computes / cache hits</dt>
        <dd>{{ props.snapshot.predictionComputeCount }} / {{ props.snapshot.predictionCacheHits }}</dd>
      </div>
      <div>
        <dt>Release scale</dt>
        <dd>{{ props.snapshot.config.releaseSpeedScale.toFixed(2) }}</dd>
      </div>
      <div>
        <dt>Release speed</dt>
        <dd>{{ props.snapshot.totals.releaseSpeedKms.toFixed(3) }} km/s</dd>
      </div>
      <div>
        <dt>Prediction points</dt>
        <dd>{{ props.snapshot.prediction?.pointCount ?? 0 }}</dd>
      </div>
      <div>
        <dt>Physics step</dt>
        <dd>{{ simulation.fixedStepSeconds }} s</dd>
      </div>
      <div>
        <dt>Playback rate</dt>
        <dd>{{ simulation.playbackRate }}×</dd>
      </div>
      <div>
        <dt>Step cap / frame</dt>
        <dd>{{ simulation.maxPhysicsStepsPerFrame }}</dd>
      </div>
    </dl>
  </details>
</template>

<style scoped>
.debug {
  position: fixed;
  right: 12px;
  bottom: 8px;
  z-index: 30;
  width: min(320px, calc(100vw - 24px));
  padding: 7px 10px;
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  background: rgba(6, 13, 24, 0.95);
  font-family: var(--font-mono);
  font-size: 9.5px;
  color: var(--muted);
  box-shadow: var(--shadow-panel);
}

.debug summary {
  cursor: pointer;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--muted-dim);
}

.debug dl {
  display: grid;
  gap: 3px;
  margin: 7px 0 0;
}

.debug dl div {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.debug dt {
  color: var(--muted-dim);
}

.debug dd {
  margin: 0;
  color: var(--ivory);
  text-align: right;
  overflow-wrap: anywhere;
}

@media (max-width: 700px) {
  .debug {
    display: none;
  }
}
</style>
