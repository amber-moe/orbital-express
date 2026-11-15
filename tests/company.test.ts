import { describe, expect, it } from 'vitest'
import { gameData } from '../src/game/data'
import {
  computeTotals,
  configForContract,
  predictMission,
} from '../src/game/rules/configRules'
import {
  COMPANY_INITIAL_CAPITAL,
  canWriteCompany,
  COMPANY_STATE_VERSION,
  companyNetProfit,
  companySuccessRate,
  createCompanyState,
  dispatchCompany,
  interruptPendingCompany,
  parseCompanyState,
  restartCompanyState,
  rollbackDispatch,
  serializeCompanyState,
  settleCompanyDispatch,
  type CompanyState,
} from '../src/game/company'

const base = createCompanyState()

function dispatched(cost = 2200): CompanyState {
  const result = dispatchCompany(base, {
    id: 'dispatch-1',
    contractId: 'first-delivery',
    orderLabel: 'Construction Run',
    cargoId: 'construction-supplies',
    requiredQuantity: 2,
    cost,
    at: 1000,
  })
  if (!result.ok) throw new Error(result.reason)
  return result.state
}

describe('company account', () => {
  it('allows company writes only for the live owner tab', () => {
    expect(canWriteCompany('owner', false)).toBe(true)
    expect(canWriteCompany('owner', true)).toBe(false)
    expect(canWriteCompany('acquiring', false)).toBe(false)
    expect(canWriteCompany('blocked', false)).toBe(false)
    expect(canWriteCompany('unsupported', false)).toBe(false)
    expect(canWriteCompany('error', false)).toBe(false)
  })

  it('starts with capital that is not counted as profit', () => {
    expect(base.balance).toBe(COMPANY_INITIAL_CAPITAL)
    expect(companyNetProfit(base)).toBe(0)
    expect(companySuccessRate(base)).toBeNull()
    expect(base.version).toBe(COMPANY_STATE_VERSION)
  })

  it('deducts a paid dispatch exactly once and rejects a second pending dispatch', () => {
    const state = dispatched()
    expect(state.balance).toBe(COMPANY_INITIAL_CAPITAL - 2200)
    expect(state.totalSpend).toBe(2200)
    expect(state.launches).toBe(1)
    expect(state.pending?.id).toBe('dispatch-1')

    const duplicate = dispatchCompany(state, {
      id: 'dispatch-2',
      contractId: 'first-delivery',
      orderLabel: 'Construction Run',
      cargoId: 'construction-supplies',
      requiredQuantity: 2,
      cost: 100,
      at: 2000,
    })
    expect(duplicate.ok).toBe(false)
    expect(duplicate.state.balance).toBe(state.balance)
  })

  it('refuses a dispatch that the balance cannot cover', () => {
    const poor = { ...base, balance: 100 }
    const result = dispatchCompany(poor, {
      id: 'dispatch-poor',
      contractId: 'first-delivery',
      orderLabel: 'Construction Run',
      cargoId: 'construction-supplies',
      requiredQuantity: 2,
      cost: 2200,
      at: 1000,
    })
    expect(result.ok).toBe(false)
    expect(result.state).toEqual(poor)
  })

  it('settles a delivered flight once and excludes capital from profit', () => {
    const state = dispatched()
    const settled = settleCompanyDispatch(state, {
      dispatchId: 'dispatch-1',
      outcome: 'delivered',
      reward: 3200,
      deliveredQuantity: 2,
      at: 2000,
    })
    expect(settled.applied).toBe(true)
    if (!settled.applied) return
    expect(settled.state.balance).toBe(COMPANY_INITIAL_CAPITAL + 1000)
    expect(settled.state.totalIncome).toBe(3200)
    expect(settled.state.totalSpend).toBe(2200)
    expect(companyNetProfit(settled.state)).toBe(1000)
    expect(settled.state.completedJobs).toBe(1)
    expect(settled.state.resolvedFlights).toBe(1)
    expect(settled.state.failures).toBe(0)
    expect(settled.settlement.net).toBe(1000)
    expect(settled.state.history[0]?.outcome).toBe('delivered')

    const duplicate = settleCompanyDispatch(settled.state, {
      dispatchId: 'dispatch-1',
      outcome: 'delivered',
      reward: 3200,
      deliveredQuantity: 2,
      at: 3000,
    })
    expect(duplicate.applied).toBe(false)
    expect(duplicate.state.balance).toBe(settled.state.balance)
    expect(duplicate.state.totalIncome).toBe(settled.state.totalIncome)
  })

  it('keeps the loss on failure and pays nothing', () => {
    const state = dispatched()
    const settled = settleCompanyDispatch(state, {
      dispatchId: 'dispatch-1',
      outcome: 'insufficient-braking',
      reward: 3200,
      deliveredQuantity: 0,
      at: 2000,
    })
    expect(settled.applied).toBe(true)
    if (!settled.applied) return
    expect(settled.state.balance).toBe(COMPANY_INITIAL_CAPITAL - 2200)
    expect(settled.state.totalIncome).toBe(0)
    expect(settled.state.completedJobs).toBe(0)
    expect(settled.state.failures).toBe(1)
    expect(settled.state.resolvedFlights).toBe(1)
    expect(settled.settlement.income).toBe(0)
    expect(settled.settlement.net).toBe(-2200)
  })

  it('uses the simulator-accepted quantity for a failed outcome', () => {
    const config = {
      ...configForContract(gameData, 'first-delivery'),
      releaseSpeedScale: 0.97,
    }
    const totals = computeTotals(config, gameData)
    const prediction = predictMission(config, gameData, totals)
    expect(prediction.outcome.kind).toBe('earth-impact')
    expect(prediction.outcome.deliveredQuantity).toBe(0)

    const state = dispatched()
    const settled = settleCompanyDispatch(state, {
      dispatchId: 'dispatch-1',
      outcome: prediction.outcome.kind,
      reward: 3200,
      deliveredQuantity: prediction.outcome.deliveredQuantity,
      at: 2000,
    })
    expect(settled.applied).toBe(true)
    if (!settled.applied) return
    expect(settled.state.deliveredCrates).toBe(0)
    expect(settled.state.history[0]?.deliveredCrates).toBe(0)
    expect(settled.state.totalIncome).toBe(0)
    expect(settled.state.failures).toBe(1)
  })

  it('treats a contract shortfall as a failed payout and still records delivered crates', () => {
    const state = dispatched()
    const settled = settleCompanyDispatch(state, {
      dispatchId: 'dispatch-1',
      outcome: 'contract-shortfall',
      reward: 3200,
      deliveredQuantity: 1,
      at: 2000,
    })
    expect(settled.applied).toBe(true)
    if (!settled.applied) return
    expect(settled.state.totalIncome).toBe(0)
    expect(settled.state.deliveredCrates).toBe(1)
    expect(settled.state.failures).toBe(1)
    expect(settled.state.completedJobs).toBe(0)
  })

  it('rejects a stale dispatch id and recovers an interrupted flight only once', () => {
    const stale = settleCompanyDispatch(dispatched(), {
      dispatchId: 'dispatch-from-another-tab',
      outcome: 'delivered',
      reward: 3200,
      deliveredQuantity: 2,
      at: 2000,
    })
    expect(stale.applied).toBe(false)
    expect(stale.state).toEqual(dispatched())

    const first = interruptPendingCompany(dispatched(), 2000)
    expect(first.interrupted).toBe(true)
    const second = interruptPendingCompany(first.state, 3000)
    expect(second.interrupted).toBe(false)
    expect(second.state).toEqual(first.state)
    expect(second.state.history).toHaveLength(1)
  })

  it('rolls back a dispatch that did not launch', () => {
    const state = dispatched()
    const rolled = rollbackDispatch(state, 'dispatch-1')
    expect(rolled.balance).toBe(COMPANY_INITIAL_CAPITAL)
    expect(rolled.totalSpend).toBe(0)
    expect(rolled.launches).toBe(0)
    expect(rolled.pending).toBeNull()
  })

  it('records a reload interruption as a failure with the cost retained', () => {
    const state = dispatched()
    const interrupted = interruptPendingCompany(state, 2000)
    expect(interrupted.interrupted).toBe(true)
    expect(interrupted.state.pending).toBeNull()
    expect(interrupted.state.balance).toBe(COMPANY_INITIAL_CAPITAL - 2200)
    expect(interrupted.state.failures).toBe(1)
    expect(interrupted.state.resolvedFlights).toBe(1)
    expect(interrupted.state.history[0]?.outcome).toBe('interrupted')
    expect(interrupted.state.totalIncome).toBe(0)
  })

  it('restart clears account history and restores capital', () => {
    const state = dispatched()
    const restarted = restartCompanyState()
    expect(restarted.balance).toBe(COMPANY_INITIAL_CAPITAL)
    expect(restarted.totalIncome).toBe(0)
    expect(restarted.totalSpend).toBe(0)
    expect(restarted.history).toEqual([])
    expect(state.balance).not.toBe(restarted.balance)
  })

  it('parses a valid save and rejects malformed or old saves', () => {
    const state = dispatched()
    const parsed = parseCompanyState(serializeCompanyState(state))
    expect(parsed).not.toBeNull()
    expect(parsed?.balance).toBe(state.balance)
    expect(parsed?.pending?.id).toBe('dispatch-1')

    expect(parseCompanyState('{bad json')).toBeNull()
    expect(parseCompanyState(JSON.stringify({ ...state, version: 0 }))).toBeNull()
    expect(parseCompanyState(JSON.stringify({ ...state, balance: -1 }))).toBeNull()
    expect(
      parseCompanyState(JSON.stringify({ ...state, pending: { ...state.pending!, cost: -2 } })),
    ).toBeNull()
  })
})
