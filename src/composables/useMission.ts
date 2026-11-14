import { markRaw, onMounted, onUnmounted, shallowRef, type ShallowRef } from 'vue'
import { gameData } from '../game/data'
import { MissionController } from '../game/missionController'
import type { MissionConfig, MissionSnapshot } from '../game/types'

export interface UseMission {
  snapshot: ShallowRef<MissionSnapshot>
  controller: MissionController
  setConfig: (patch: Partial<MissionConfig>) => void
  launch: () => void
  retry: () => void
}

export function useMission(): UseMission {
  const controller = markRaw(new MissionController(gameData))
  const snapshot = shallowRef<MissionSnapshot>(controller.getSnapshot())
  controller.subscribe((next) => {
    snapshot.value = next
  })

  let raf = 0
  let lastTime = 0

  function frame(time: number): void {
    if (lastTime === 0 || time < lastTime) lastTime = time
    const elapsed = (time - lastTime) / 1000
    lastTime = time
    controller.tick(elapsed)
    raf = requestAnimationFrame(frame)
  }

  function onVisibility(): void {
    // Discard the large wall-clock delta accumulated while the tab was hidden.
    if (!document.hidden) lastTime = 0
  }

  onMounted(() => {
    document.addEventListener('visibilitychange', onVisibility)
    raf = requestAnimationFrame(frame)
  })

  onUnmounted(() => {
    cancelAnimationFrame(raf)
    document.removeEventListener('visibilitychange', onVisibility)
  })

  return {
    snapshot,
    controller,
    setConfig: (patch) => {
      controller.setConfig(patch)
    },
    launch: () => {
      controller.launch()
    },
    retry: () => {
      controller.retry()
    },
  }
}
