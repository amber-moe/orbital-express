import { markRaw, onMounted, onUnmounted, shallowRef, type ShallowRef } from 'vue'
import { gameData } from '../game/data'
import { MissionController } from '../game/missionController'
import type { MissionConfig, MissionSnapshot, Resources } from '../game/types'

export interface UseMission {
  snapshot: ShallowRef<MissionSnapshot>
  controller: ShallowRef<MissionController>
  setConfig: (patch: Partial<MissionConfig>) => void
  launch: () => boolean
  retry: () => boolean
  startSession: (config: MissionConfig, resources?: Resources) => void
}

export function useMission(): UseMission {
  const controller = shallowRef<MissionController>(markRaw(new MissionController(gameData)))
  const snapshot = shallowRef<MissionSnapshot>(controller.value.getSnapshot())

  function attach(next: MissionController): void {
    next.subscribe((value) => {
      if (controller.value === next) snapshot.value = value
    })
  }
  attach(controller.value)

  let raf = 0
  let lastTime = 0

  function frame(time: number): void {
    if (lastTime === 0 || time < lastTime) lastTime = time
    const elapsed = (time - lastTime) / 1000
    lastTime = time
    controller.value.tick(elapsed)
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
      controller.value.setConfig(patch)
    },
    launch: () => controller.value.launch(),
    retry: () => controller.value.retry(),
    startSession: (config, resources) => {
      const next = markRaw(new MissionController(gameData, null, config, resources))
      controller.value = next
      attach(next)
      snapshot.value = next.getSnapshot()
    },
  }
}
