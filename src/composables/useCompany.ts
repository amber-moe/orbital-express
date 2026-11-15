import { computed, onMounted, onUnmounted, ref, shallowRef, type ComputedRef, type Ref, type ShallowRef } from 'vue'
import {
  COMPANY_STORAGE_KEY,
  canWriteCompany,
  createCompanyState,
  dispatchCompany,
  interruptPendingCompany,
  parseCompanyState,
  restartCompanyState,
  rollbackDispatch,
  serializeCompanyState,
  settleCompanyDispatch,
  type CompanyOwnership,
  type CompanyState,
  type DispatchResult,
  type SettleResult,
} from '../game/company'

export interface UseCompany {
  state: ShallowRef<CompanyState>
  ownership: Ref<CompanyOwnership>
  canWrite: ComputedRef<boolean>
  lockMessage: ComputedRef<string | null>
  storageAvailable: Ref<boolean>
  externalChange: Ref<boolean>
  notice: Ref<string | null>
  clearNotice: () => void
  retryOwnership: () => void
  dispatch: (input: Parameters<typeof dispatchCompany>[1]) => DispatchResult
  settle: (input: Parameters<typeof settleCompanyDispatch>[1]) => SettleResult
  rollback: (dispatchId: string) => void
  restart: () => void
  reload: () => void
}

const COMPANY_LOCK_NAME = 'orbital-express.company-writer'

/**
 * Company Jobs use a conservative single-writer policy:
 * - one tab holds the Web Locks exclusive lock and is the only writer;
 * - other tabs are read-only observers and cannot interrupt a live flight;
 * - recovery of a pending flight runs only after ownership is acquired, which
 *   means the previous owner is gone (reload/close/crash).
 */
export function useCompany(): UseCompany {
  const state = shallowRef<CompanyState>(createCompanyState())
  const ownership = ref<CompanyOwnership>('acquiring')
  const storageAvailable = ref(true)
  const externalChange = ref(false)
  const notice = ref<string | null>(null)
  const canWrite = computed(() => canWriteCompany(ownership.value, externalChange.value))
  const lockMessage = computed(() => {
    switch (ownership.value) {
      case 'acquiring':
        return 'Checking exclusive company ownership…'
      case 'blocked':
        return 'Another tab is currently running Company Jobs. This tab is read-only; Practice remains available.'
      case 'unsupported':
        return 'This browser does not provide the exclusive company lock. Company Jobs are disabled; Practice remains available.'
      case 'error':
        return 'Company ownership could not be established. Company Jobs are disabled; Practice remains available.'
      default:
        return null
    }
  })

  let storage: Storage | null = null
  let releaseLock: (() => void) | null = null
  let acquiring = false

  function disableStorage(message: string): void {
    storage = null
    storageAvailable.value = false
    if (!notice.value) notice.value = message
  }

  function persist(next: CompanyState): void {
    if (ownership.value !== 'owner') return
    state.value = next
    if (!storage) return
    try {
      storage.setItem(COMPANY_STORAGE_KEY, serializeCompanyState(next))
    } catch {
      disableStorage(
        'Browser storage is unavailable. This company session is in memory only and will not survive a reload.',
      )
    }
  }

  function loadFromStorage(recover: boolean): void {
    if (!storage) return
    let raw: string | null = null
    try {
      raw = storage.getItem(COMPANY_STORAGE_KEY)
    } catch {
      disableStorage(
        'Browser storage could not be read. This company session is in memory only.',
      )
      return
    }
    if (!raw) return
    const parsed = parseCompanyState(raw)
    if (!parsed) {
      if (recover) {
        notice.value =
          'Saved company data was invalid or from an old version. A fresh company account was created.'
        persist(createCompanyState())
      } else {
        state.value = createCompanyState()
        notice.value =
          'Saved company data is invalid. The owning tab must recover it before Company Jobs can continue.'
      }
      return
    }
    if (parsed.pending && recover) {
      const interrupted = interruptPendingCompany(parsed, Date.now())
      state.value = interrupted.state
      notice.value =
        'A paid flight was interrupted by a reload or closed tab. Its cost was retained and the flight is recorded as failed.'
      persist(interrupted.state)
      return
    }
    state.value = parsed
  }

  function acquireOwnership(): void {
    if (acquiring || ownership.value === 'owner') return
    if (typeof navigator === 'undefined' || !navigator.locks?.request) {
      ownership.value = 'unsupported'
      notice.value =
        'This browser cannot provide an exclusive company writer. Company Jobs are locked; Practice remains available.'
      loadFromStorage(false)
      return
    }
    acquiring = true
    ownership.value = 'acquiring'
    void navigator.locks
      .request(COMPANY_LOCK_NAME, { mode: 'exclusive', ifAvailable: true }, async (lock) => {
        acquiring = false
        if (!lock) {
          ownership.value = 'blocked'
          loadFromStorage(false)
          return
        }
        ownership.value = 'owner'
        loadFromStorage(true)
        await new Promise<void>((resolve) => {
          releaseLock = resolve
        })
      })
      .catch((error: unknown) => {
        acquiring = false
        ownership.value = 'error'
        notice.value =
          'Company ownership could not be established. Company Jobs are locked; Practice remains available.'
        console.error('Company lock failed', error)
        loadFromStorage(false)
      })
  }

  function bootStorage(): void {
    try {
      storage = window.localStorage
    } catch {
      disableStorage(
        'Browser storage is unavailable. This company session is in memory only and will not survive a reload.',
      )
    }
  }

  const onStorage = (event: StorageEvent): void => {
    if (event.key !== COMPANY_STORAGE_KEY) return
    if (ownership.value === 'owner') {
      // A legacy/stale writer changed the account. Stop paid actions rather
      // than writing over it.
      externalChange.value = true
      return
    }
    if (event.newValue) {
      const parsed = parseCompanyState(event.newValue)
      if (parsed) state.value = parsed
    }
  }

  onMounted(() => {
    bootStorage()
    window.addEventListener('storage', onStorage)
    acquireOwnership()
  })

  onUnmounted(() => {
    window.removeEventListener('storage', onStorage)
    releaseLock?.()
    releaseLock = null
    ownership.value = 'blocked'
  })

  return {
    state,
    ownership,
    canWrite,
    lockMessage,
    storageAvailable,
    externalChange,
    notice,
    clearNotice: () => {
      notice.value = null
    },
    retryOwnership: () => {
      if (ownership.value === 'blocked' || ownership.value === 'error') {
        acquireOwnership()
      }
    },
    dispatch: (input) => {
      if (!canWrite.value) {
        return { ok: false, reason: 'locked', state: state.value }
      }
      const result = dispatchCompany(state.value, input)
      if (result.ok) persist(result.state)
      return result
    },
    settle: (input) => {
      if (!canWrite.value) return { applied: false, state: state.value }
      const result = settleCompanyDispatch(state.value, input)
      if (result.applied) persist(result.state)
      return result
    },
    rollback: (dispatchId) => {
      if (!canWrite.value) return
      persist(rollbackDispatch(state.value, dispatchId))
    },
    restart: () => {
      if (!canWrite.value) return
      persist(restartCompanyState())
    },
    reload: () => {
      window.location.reload()
    },
  }
}
