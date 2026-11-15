import type { OutcomeKind } from './types'

export type GameMode = 'practice' | 'company'
export type CompanyOwnership = 'acquiring' | 'owner' | 'blocked' | 'unsupported' | 'error'

/**
 * Single-writer policy for Company Jobs. Read-only tabs may inspect the saved
 * company state but must never dispatch, settle, roll back or restart it.
 */
export function canWriteCompany(
  ownership: CompanyOwnership,
  externalChange: boolean,
): boolean {
  return ownership === 'owner' && !externalChange
}

export const COMPANY_STORAGE_KEY = 'orbital-express.company.v1'
export const COMPANY_STATE_VERSION = 1
export const COMPANY_INITIAL_CAPITAL = 6000
export const COMPANY_HISTORY_LIMIT = 10

export interface PendingDispatch {
  id: string
  contractId: string
  orderLabel: string
  cargoId: string
  requiredQuantity: number
  cost: number
  startedAt: number
}

export type CompanyOutcome = OutcomeKind | 'interrupted'

export interface DispatchRecord {
  id: string
  contractId: string
  orderLabel: string
  cost: number
  income: number
  outcome: CompanyOutcome
  deliveredCrates: number
  at: number
}

export interface CompanyState {
  version: number
  balance: number
  totalIncome: number
  totalSpend: number
  completedJobs: number
  resolvedFlights: number
  failures: number
  deliveredCrates: number
  launches: number
  pending: PendingDispatch | null
  history: DispatchRecord[]
}

export interface CompanySettlement {
  dispatchId: string
  orderLabel: string
  cost: number
  income: number
  net: number
  balance: number
  outcome: CompanyOutcome
  deliveredCrates: number
}

export type DispatchResult =
  | { ok: true; state: CompanyState; dispatchId: string }
  | { ok: false; reason: 'pending' | 'funds' | 'invalid' | 'locked'; state: CompanyState }

export type SettleResult =
  | { applied: false; state: CompanyState }
  | { applied: true; state: CompanyState; settlement: CompanySettlement }

export function createCompanyState(capital = COMPANY_INITIAL_CAPITAL): CompanyState {
  return {
    version: COMPANY_STATE_VERSION,
    balance: Math.max(0, capital),
    totalIncome: 0,
    totalSpend: 0,
    completedJobs: 0,
    resolvedFlights: 0,
    failures: 0,
    deliveredCrates: 0,
    launches: 0,
    pending: null,
    history: [],
  }
}

export function companyNetProfit(state: CompanyState): number {
  return state.totalIncome - state.totalSpend
}

export function companySuccessRate(state: CompanyState): number | null {
  if (state.resolvedFlights <= 0) return null
  return state.completedJobs / state.resolvedFlights
}

export function createDispatchId(now = Date.now(), random = Math.random()): string {
  return `dispatch-${now.toString(36)}-${Math.floor(random * 1_000_000).toString(36)}`
}

export function dispatchCompany(
  state: CompanyState,
  input: {
    id: string
    contractId: string
    orderLabel: string
    cargoId: string
    requiredQuantity: number
    cost: number
    at: number
  },
): DispatchResult {
  if (state.pending) return { ok: false, reason: 'pending', state }
  if (
    !Number.isFinite(input.cost) ||
    input.cost < 0 ||
    !Number.isFinite(input.requiredQuantity) ||
    input.requiredQuantity <= 0
  ) {
    return { ok: false, reason: 'invalid', state }
  }
  if (input.cost > state.balance) return { ok: false, reason: 'funds', state }

  const next: CompanyState = {
    ...state,
    balance: state.balance - input.cost,
    totalSpend: state.totalSpend + input.cost,
    launches: state.launches + 1,
    pending: {
      id: input.id,
      contractId: input.contractId,
      orderLabel: input.orderLabel,
      cargoId: input.cargoId,
      requiredQuantity: input.requiredQuantity,
      cost: input.cost,
      startedAt: input.at,
    },
  }
  return { ok: true, state: next, dispatchId: input.id }
}

/** Undo a dispatch that never actually started a flight. */
export function rollbackDispatch(state: CompanyState, dispatchId: string): CompanyState {
  if (!state.pending || state.pending.id !== dispatchId) return state
  return {
    ...state,
    balance: state.balance + state.pending.cost,
    totalSpend: Math.max(0, state.totalSpend - state.pending.cost),
    launches: Math.max(0, state.launches - 1),
    pending: null,
  }
}

export function settleCompanyDispatch(
  state: CompanyState,
  input: {
    dispatchId: string
    outcome: OutcomeKind
    reward: number
    deliveredQuantity: number
    at: number
  },
): SettleResult {
  const pending = state.pending
  if (!pending || pending.id !== input.dispatchId) return { applied: false, state }
  const success = input.outcome === 'delivered'
  const income = success ? Math.max(0, input.reward) : 0
  const acceptedCargo =
    input.outcome === 'delivered' || input.outcome === 'contract-shortfall'
  const deliveredCrates = acceptedCargo
    ? Math.max(0, Math.floor(input.deliveredQuantity))
    : 0
  const settlement: CompanySettlement = {
    dispatchId: pending.id,
    orderLabel: pending.orderLabel,
    cost: pending.cost,
    income,
    net: income - pending.cost,
    balance: state.balance + income,
    outcome: input.outcome,
    deliveredCrates,
  }
  const record: DispatchRecord = {
    id: pending.id,
    contractId: pending.contractId,
    orderLabel: pending.orderLabel,
    cost: pending.cost,
    income,
    outcome: input.outcome,
    deliveredCrates,
    at: input.at,
  }
  const next: CompanyState = {
    ...state,
    balance: settlement.balance,
    totalIncome: state.totalIncome + income,
    completedJobs: state.completedJobs + (success ? 1 : 0),
    resolvedFlights: state.resolvedFlights + 1,
    failures: state.failures + (success ? 0 : 1),
    deliveredCrates: state.deliveredCrates + deliveredCrates,
    pending: null,
    history: [record, ...state.history].slice(0, COMPANY_HISTORY_LIMIT),
  }
  return { applied: true, state: next, settlement }
}

/** A reload interrupted a paid flight: cost stays spent, flight is failed. */
export function interruptPendingCompany(
  state: CompanyState,
  at: number,
): { state: CompanyState; interrupted: boolean } {
  const pending = state.pending
  if (!pending) return { state, interrupted: false }
  const record: DispatchRecord = {
    id: pending.id,
    contractId: pending.contractId,
    orderLabel: pending.orderLabel,
    cost: pending.cost,
    income: 0,
    outcome: 'interrupted',
    deliveredCrates: 0,
    at,
  }
  const next: CompanyState = {
    ...state,
    resolvedFlights: state.resolvedFlights + 1,
    failures: state.failures + 1,
    pending: null,
    history: [record, ...state.history].slice(0, COMPANY_HISTORY_LIMIT),
  }
  return { state: next, interrupted: true }
}

export function restartCompanyState(capital = COMPANY_INITIAL_CAPITAL): CompanyState {
  return createCompanyState(capital)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function finiteNonNegative(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null
  return value
}

function parsePending(value: unknown): PendingDispatch | null | undefined {
  if (value === null) return null
  if (!isRecord(value)) return undefined
  const cost = finiteNonNegative(value.cost)
  const requiredQuantity = finiteNonNegative(value.requiredQuantity)
  if (
    typeof value.id !== 'string' ||
    typeof value.contractId !== 'string' ||
    typeof value.orderLabel !== 'string' ||
    typeof value.cargoId !== 'string' ||
    cost === null ||
    requiredQuantity === null ||
    typeof value.startedAt !== 'number' ||
    !Number.isFinite(value.startedAt)
  ) {
    return undefined
  }
  return {
    id: value.id,
    contractId: value.contractId,
    orderLabel: value.orderLabel,
    cargoId: value.cargoId,
    requiredQuantity,
    cost,
    startedAt: value.startedAt,
  }
}

function parseRecord(value: unknown): DispatchRecord | null {
  if (!isRecord(value)) return null
  const cost = finiteNonNegative(value.cost)
  const income = finiteNonNegative(value.income)
  const deliveredCrates = finiteNonNegative(value.deliveredCrates)
  if (
    typeof value.id !== 'string' ||
    typeof value.contractId !== 'string' ||
    typeof value.orderLabel !== 'string' ||
    typeof value.outcome !== 'string' ||
    cost === null ||
    income === null ||
    deliveredCrates === null ||
    typeof value.at !== 'number' ||
    !Number.isFinite(value.at)
  ) {
    return null
  }
  return {
    id: value.id,
    contractId: value.contractId,
    orderLabel: value.orderLabel,
    cost,
    income,
    outcome: value.outcome as CompanyOutcome,
    deliveredCrates,
    at: value.at,
  }
}

/** Strict parse for versioned saves; malformed data is rejected, not repaired. */
export function parseCompanyState(raw: string): CompanyState | null {
  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    return null
  }
  if (!isRecord(value) || value.version !== COMPANY_STATE_VERSION) return null
  const balance = finiteNonNegative(value.balance)
  const totalIncome = finiteNonNegative(value.totalIncome)
  const totalSpend = finiteNonNegative(value.totalSpend)
  const completedJobs = finiteNonNegative(value.completedJobs)
  const resolvedFlights = finiteNonNegative(value.resolvedFlights)
  const failures = finiteNonNegative(value.failures)
  const deliveredCrates = finiteNonNegative(value.deliveredCrates)
  const launches = finiteNonNegative(value.launches)
  if (
    balance === null ||
    totalIncome === null ||
    totalSpend === null ||
    completedJobs === null ||
    resolvedFlights === null ||
    failures === null ||
    deliveredCrates === null ||
    launches === null
  ) {
    return null
  }
  const pending = parsePending(value.pending)
  if (pending === undefined) return null
  if (!Array.isArray(value.history)) return null
  const history: DispatchRecord[] = []
  for (const item of value.history.slice(0, COMPANY_HISTORY_LIMIT)) {
    const record = parseRecord(item)
    if (!record) return null
    history.push(record)
  }
  return {
    version: COMPANY_STATE_VERSION,
    balance,
    totalIncome,
    totalSpend,
    completedJobs,
    resolvedFlights,
    failures,
    deliveredCrates,
    launches,
    pending,
    history,
  }
}

export function serializeCompanyState(state: CompanyState): string {
  return JSON.stringify(state)
}

export function formatCredits(value: number): string {
  return `${Math.round(value).toLocaleString('en-US')} cr`
}
