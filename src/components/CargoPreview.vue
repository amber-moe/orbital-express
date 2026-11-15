<script setup lang="ts">
import { computed } from 'vue'
import type {
  CargoDefinition,
  CrateQuantity,
  MissionTotals,
  ModuleId,
  ProtectionId,
} from '../game/types'

const props = defineProps<{
  quantity: CrateQuantity
  protectionId: ProtectionId
  moduleId: ModuleId
  totals: MissionTotals
  maxVolume: number
  maxMassKg: number
  protectionLabel: string
  moduleLabel: string
  cargo: CargoDefinition
}>()

const CRATE_WIDTH = 26
const CRATE_GAP = 6

const cratePositions = computed(() => {
  const count = props.quantity
  const total = count * CRATE_WIDTH + (count - 1) * CRATE_GAP
  const start = 75 - total / 2
  return Array.from({ length: count }, (_, index) => start + index * (CRATE_WIDTH + CRATE_GAP))
})

const reinforced = computed(() => props.protectionId === 'reinforced')
const largeModule = computed(() => props.moduleId === 'large')
const moduleWidth = computed(() => (largeModule.value ? 46 : 34))
const moduleHeight = computed(() => (largeModule.value ? 56 : 36))

const overVolume = computed(() => props.totals.totalVolume > props.maxVolume + 1e-9)
const overMass = computed(() => props.totals.totalMassKg > props.maxMassKg + 1e-9)

const description = computed(
  () =>
    `${props.quantity} crate${props.quantity === 1 ? '' : 's'} of ${props.cargo.name}, ${props.protectionLabel} protection, ${props.moduleLabel} braking module`,
)
</script>

<template>
  <section class="preview" role="img" :aria-label="description">
    <svg class="diagram" viewBox="0 0 210 96" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <g :transform="`translate(150 ${48 - moduleHeight / 2})`">
        <rect :width="moduleWidth" :height="moduleHeight" rx="4" class="engine" />
        <rect x="4" :y="moduleHeight - 10" :width="moduleWidth - 8" height="5" rx="2" class="engine-band" />
        <path
          :d="`M8 ${moduleHeight} L${moduleWidth - 8} ${moduleHeight} L${moduleWidth - 14} ${moduleHeight + 9} L14 ${moduleHeight + 9} Z`"
          class="nozzle"
        />
      </g>

      <rect x="10" y="14" width="130" height="68" rx="17" class="shell" />
      <path d="M10 48 H140" class="shell-line" />

      <g v-for="(x, index) in cratePositions" :key="index">
        <template v-if="cargo.visualForm === 'crate'">
          <rect :x="x" y="30" :width="CRATE_WIDTH" height="30" rx="3" class="crate" />
          <rect :x="x + 9" y="30" width="8" height="30" :fill="cargo.accentColor" />
          <path :d="`M${x} 42 H${x + CRATE_WIDTH} M${x} 50 H${x + CRATE_WIDTH}`" class="crate-line" />
        </template>

        <template v-else-if="cargo.visualForm === 'pack'">
          <rect
            :x="x"
            y="29"
            :width="CRATE_WIDTH"
            height="32"
            rx="10"
            :fill="cargo.accentColor"
            fill-opacity="0.22"
            :stroke="cargo.accentColor"
            stroke-width="1.2"
          />
          <path :d="`M${x + 3} 39 H${x + CRATE_WIDTH - 3}`" :stroke="cargo.accentColor" stroke-width="1" />
          <rect :x="x + 8" y="46" width="10" height="7" rx="2" fill="rgba(9,19,31,0.65)" :stroke="cargo.accentColor" stroke-width="0.6" />
        </template>

        <template v-else>
          <rect
            :x="x"
            y="30"
            :width="CRATE_WIDTH"
            height="30"
            rx="3"
            fill="rgba(34,28,58,0.9)"
            :stroke="cargo.accentColor"
            stroke-width="1.2"
          />
          <path :d="`M${x + 8} 30 V26 H${x + 18} V30`" fill="none" :stroke="cargo.accentColor" stroke-width="1.2" />
          <path :d="`M${x + 4} 43 H${x + CRATE_WIDTH - 4} M${x + 4} 49 H${x + CRATE_WIDTH - 4}`" :stroke="cargo.accentColor" stroke-width="0.8" opacity="0.7" />
          <circle :cx="x + 5" cy="46" r="1.2" :fill="cargo.accentColor" />
          <circle :cx="x + CRATE_WIDTH - 5" cy="46" r="1.2" :fill="cargo.accentColor" />
        </template>
      </g>

      <template v-if="reinforced">
        <rect x="4" y="8" width="142" height="80" rx="21" class="frame" />
        <circle cx="12" cy="16" r="2.4" class="bolt" />
        <circle cx="138" cy="16" r="2.4" class="bolt" />
        <circle cx="12" cy="80" r="2.4" class="bolt" />
        <circle cx="138" cy="80" r="2.4" class="bolt" />
      </template>
    </svg>

    <dl class="stats">
      <div>
        <dt>Crates</dt>
        <dd>{{ quantity }}</dd>
      </div>
      <div :class="{ bad: overMass }">
        <dt>Mass</dt>
        <dd>{{ totals.totalMassKg.toFixed(0) }} / {{ maxMassKg }} kg</dd>
      </div>
      <div :class="{ bad: overVolume }">
        <dt>Volume</dt>
        <dd>{{ totals.totalVolume.toFixed(2) }} / {{ maxVolume.toFixed(2) }}</dd>
      </div>
      <div>
        <dt>Brake</dt>
        <dd>{{ totals.brakeReserveKms.toFixed(2) }} km/s</dd>
      </div>
    </dl>
  </section>
</template>

<style scoped>
.preview {
  display: grid;
  grid-template-columns: minmax(0, 0.78fr) minmax(0, 1.22fr);
  gap: 8px;
  align-items: center;
  padding: 5px 8px;
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  background: rgba(18, 34, 52, 0.38);
}

.diagram {
  width: 100%;
  height: 72px;
  overflow: visible;
}

.shell {
  fill: rgba(233, 240, 243, 0.06);
  stroke: rgba(233, 240, 243, 0.55);
  stroke-width: 1.6;
}

.shell-line {
  stroke: rgba(145, 164, 181, 0.25);
  stroke-width: 0.8;
  stroke-dasharray: 3 4;
}

.crate {
  fill: rgba(233, 240, 243, 0.9);
  stroke: rgba(255, 255, 255, 0.9);
  stroke-width: 0.6;
}

.crate-line {
  stroke: rgba(34, 22, 4, 0.35);
  stroke-width: 0.7;
}

.frame {
  fill: none;
  stroke: var(--cyan);
  stroke-width: 2.4;
  opacity: 0.9;
}

.bolt {
  fill: var(--cyan);
}

.engine {
  fill: #25313d;
  stroke: rgba(145, 164, 181, 0.5);
  stroke-width: 0.8;
}

.engine-band {
  fill: var(--amber);
}

.nozzle {
  fill: #151d25;
  stroke: rgba(145, 164, 181, 0.4);
  stroke-width: 0.8;
}

.stats {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 4px 8px;
  margin: 0;
}

.stats div {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.stats dt {
  font-family: var(--font-mono);
  font-size: 8.5px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--muted-dim);
}

.stats dd {
  margin: 0;
  font-family: var(--font-mono);
  font-size: 10.5px;
  color: var(--ivory);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.stats .bad dt,
.stats .bad dd {
  color: var(--error);
}

@media (max-width: 360px) {
  .preview {
    grid-template-columns: minmax(0, 1fr);
  }
  .stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-height: 820px) {
  .preview {
    padding: 4px 8px;
  }
  .diagram {
    height: 44px;
  }
  .stats {
    gap: 3px;
  }
}
</style>
