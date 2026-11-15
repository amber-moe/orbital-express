<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()

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
</script>

<template>
  <dialog
    ref="dialog"
    class="sources-dialog"
    aria-labelledby="sources-title"
    @close="emit('close')"
  >
    <article class="sources">
      <header>
        <span class="eyebrow">ATTRIBUTION · NOT IN-UNIVERSE</span>
        <h2 id="sources-title">Sources &amp; Model Notes</h2>
        <p>
          Orbital Express is a fictional centrifuge cargo company. No real agency, company or
          institution appears in the story, operates the depicted hardware, or endorses this game.
        </p>
      </header>

      <section>
        <h3>Real physical inputs</h3>
        <dl>
          <div><dt>Earth gravitational parameter</dt><dd>398,600.435507 km³/s² (DE440)</dd></div>
          <div><dt>Moon gravitational parameter</dt><dd>4,902.800118 km³/s² (DE440)</dd></div>
          <div><dt>Earth mean radius</dt><dd>6,371.0 km</dd></div>
          <div><dt>Moon mean radius</dt><dd>1,737.4 km</dd></div>
          <div><dt>Mean Earth–Moon distance</dt><dd>384,400 km</dd></div>
        </dl>
        <p class="links">
          <a href="https://ssd.jpl.nasa.gov/astro_par.html" target="_blank" rel="noreferrer">
            JPL Astrodynamic Parameters
          </a>
          ·
          <a href="https://ssd.jpl.nasa.gov/sats/phys_par/sep.html" target="_blank" rel="noreferrer">
            JPL Planetary Satellite Physical Parameters
          </a>
          ·
          <a href="https://science.nasa.gov/moon/by-the-numbers/" target="_blank" rel="noreferrer">
            NASA Moon: By the Numbers
          </a>
        </p>
      </section>

      <section>
        <h3>Fictional or game-modeled assumptions</h3>
        <ul>
          <li>A two-kilometre rotor releases cargo at 1.00 km/s; a fictional assisted-ascent stage adds a fixed 9.923817 km/s prograde.</li>
          <li>Cargo tolerances, equipment masses, brake-reserve scaling, prices, energy, inventory and rewards are game balance values, not engineering data.</li>
          <li>Terminal braking is one discrete retrograde burn at the 12,000 km reception boundary. Docking is an animation after acceptance.</li>
          <li>One verified <strong>Balanced</strong> profile is included. Economy and Fast profiles are future work.</li>
        </ul>
      </section>

      <section>
        <h3>Omitted physics</h3>
        <ul>
          <li>Earth atmosphere, drag, heating and detailed ascent dynamics.</li>
          <li>Lunar orbital motion, Earth rotation, solar and third-body gravity.</li>
          <li>Continuous-thrust guidance, navigation, landing dynamics and terrain.</li>
        </ul>
        <p class="note">
          The Moon is held fixed in an Earth-centred inertial frame. The overview is a schematic:
          Earth and the Moon are enlarged for legibility, and the simulated path is clipped where it
          would enter a visual body, with labelled dashed connectors. Physical radii, positions and
          outcomes are unchanged. See the project <code>README.md</code> for
          scope and limitations.
        </p>
      </section>

      <footer>
        <button ref="closeButton" type="button" class="close" @click="emit('close')">
          Close
        </button>
      </footer>
    </article>
  </dialog>
</template>

<style scoped>
.sources-dialog {
  border: 0;
  padding: 0;
  background: transparent;
  width: min(720px, calc(100vw - 32px));
  max-height: calc(100vh - 40px);
  color: var(--ivory);
}

.sources {
  max-height: calc(100vh - 40px);
  overflow-y: auto;
  padding: 24px 26px;
  border: 1px solid var(--line-strong);
  border-radius: 10px;
  background: linear-gradient(180deg, #0e1c2b, #08121d);
  box-shadow: 0 30px 90px rgba(0, 0, 0, 0.55);
}

.eyebrow {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.16em;
  color: var(--muted-dim);
}

h2 {
  margin-top: 4px;
  font-size: 27px;
  font-weight: 600;
}

header p {
  margin-top: 11px;
  font-size: 13px;
  line-height: 1.6;
  color: var(--muted);
}

section {
  margin-top: 18px;
  padding-top: 14px;
  border-top: 1px solid var(--line);
}

h3 {
  font-family: var(--font-mono);
  font-size: 10.5px;
  letter-spacing: 0.12em;
  color: var(--cyan);
  font-weight: 500;
  margin-bottom: 9px;
  text-transform: uppercase;
}

dl {
  display: grid;
  gap: 5px;
  margin: 0;
}

dl div {
  display: flex;
  justify-content: space-between;
  gap: 18px;
  font-size: 12px;
}

dt {
  color: var(--muted);
}

dd {
  margin: 0;
  font-family: var(--font-mono);
  font-size: 11.5px;
  color: var(--ivory);
  text-align: right;
}

ul {
  margin: 0;
  padding-left: 16px;
  display: grid;
  gap: 5px;
}

li {
  font-size: 12px;
  line-height: 1.55;
  color: var(--muted);
}

li strong {
  color: var(--ivory);
  font-weight: 500;
}

.links {
  margin-top: 10px;
  font-size: 11.5px;
  color: var(--muted-dim);
}

.note {
  margin-top: 10px;
  font-size: 11.5px;
  line-height: 1.55;
  color: var(--muted-dim);
}

code {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--muted);
}

footer {
  margin-top: 18px;
  display: flex;
  justify-content: flex-end;
}

.close {
  padding: 10px 18px;
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-sm);
  background: transparent;
  font-family: var(--font-mono);
  font-size: 11.5px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--muted);
}

.close:hover {
  color: var(--ivory);
  border-color: var(--muted);
}
</style>
