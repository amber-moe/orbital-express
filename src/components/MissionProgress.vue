<script setup lang="ts">
import { computed } from 'vue'
import type { MissionPhase, OutcomeKind } from '../game/types'

const props = defineProps<{
  phase: MissionPhase
  outcomeKind: OutcomeKind | null
}>()

const steps = [
  { label: 'CONFIGURE', sub: 'Loadout' },
  { label: 'LAUNCH', sub: 'Spin + ascent' },
  { label: 'TRANSFER', sub: 'Earth → Moon' },
  { label: 'DELIVER', sub: 'Reception' },
] as const

const activeIndex = computed(() => {
  switch (props.phase) {
    case 'CONFIGURING':
      return 0
    case 'SPINNING_UP':
    case 'DEPARTURE':
      return 1
    case 'TRANSFER':
    case 'APPROACH':
      return 2
    case 'RESULT':
      return 3
  }
})

const failed = computed(
  () =>
    props.phase === 'RESULT' &&
    props.outcomeKind !== null &&
    props.outcomeKind !== 'delivered' &&
    props.outcomeKind !== 'contract-shortfall',
)

const delivered = computed(
  () =>
    props.phase === 'RESULT' &&
    (props.outcomeKind === 'delivered' || props.outcomeKind === 'contract-shortfall'),
)
</script>

<template>
  <footer class="progress" aria-label="Mission progress">
    <ol>
      <li
        v-for="(step, index) in steps"
        :key="step.label"
        :class="{
          done: index < activeIndex || (index === activeIndex && phase === 'RESULT' && !failed),
          active: index === activeIndex && phase !== 'RESULT',
          error: failed && index === activeIndex,
          success: delivered && index === activeIndex,
        }"
        :aria-current="index === activeIndex ? 'step' : undefined"
      >
        <span class="num" aria-hidden="true">{{ index + 1 }}</span>
        <span class="label">
          <strong>{{ step.label }}</strong>
          <small>{{ step.sub }}</small>
        </span>
      </li>
    </ol>
    <div class="meta">
      <span class="dot" aria-hidden="true"></span>
      DETERMINISTIC PREVIEW · FIXED 4 s STEP
    </div>
  </footer>
</template>

<style scoped>
.progress {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  min-height: 68px;
  padding: 0 24px;
  border-top: 1px solid var(--line);
  background: rgba(6, 13, 24, 0.9);
}

ol {
  display: flex;
  align-items: center;
  gap: 0;
  list-style: none;
  margin: 0;
  padding: 0;
  flex: 1;
  max-width: 760px;
}

li {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
  position: relative;
}

li:not(:last-child)::after {
  content: '';
  flex: 1;
  height: 1px;
  margin: 0 14px;
  background: var(--line);
}

li:not(:last-child).done::after {
  background: var(--cyan-line);
}

.num {
  flex: 0 0 auto;
  width: 22px;
  height: 22px;
  display: grid;
  place-items: center;
  border: 1px solid var(--line);
  border-radius: 50%;
  font-family: var(--font-mono);
  font-size: 8px;
  color: var(--muted-dim);
}

.label {
  display: flex;
  flex-direction: column;
  line-height: 1.15;
  min-width: 0;
}

.label strong {
  font-family: var(--font-mono);
  font-size: 8px;
  font-weight: 500;
  letter-spacing: 0.12em;
  color: var(--muted-dim);
}

.label small {
  font-size: 8px;
  color: var(--muted-dim);
  display: none;
}

li.active .num {
  border-color: var(--amber);
  color: var(--amber);
  box-shadow: 0 0 0 3px rgba(255, 180, 59, 0.08);
}

li.active .label strong {
  color: var(--amber);
}

li.done .num {
  border-color: var(--cyan-line);
  color: var(--cyan);
}

li.done .label strong {
  color: var(--muted);
}

li.success .num {
  border-color: var(--cyan);
  background: var(--cyan);
  color: var(--ink);
}

li.success .label strong {
  color: var(--cyan);
}

li.error .num {
  border-color: var(--error);
  background: var(--error-soft);
  color: var(--error);
}

li.error .label strong {
  color: var(--error);
}

.meta {
  display: flex;
  align-items: center;
  gap: 7px;
  font-family: var(--font-mono);
  font-size: 7px;
  letter-spacing: 0.12em;
  color: var(--muted-dim);
  white-space: nowrap;
}

.dot {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--cyan);
}

@media (max-width: 980px) {
  .meta {
    display: none;
  }
  .label small {
    display: none;
  }
}
</style>
