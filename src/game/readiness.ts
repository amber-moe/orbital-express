import { releaseSpeedScaleLabel } from './releaseSpeed'
import type {
  ContractData,
  MissionTotals,
  OutcomeKind,
  PredictionSummary,
  ValidationResult,
} from './types'

export type ReadinessTone = 'ok' | 'warn' | 'bad'
export type ReadinessCheckState = 'ok' | 'warn' | 'bad'

export interface ReadinessCheck {
  label: string
  value: string
  state: ReadinessCheckState
}

export interface Readiness {
  tone: ReadinessTone
  title: string
  detail: string
  checks: ReadinessCheck[]
  /** Exact prediction kind, kept for the collapsed analysis view only. */
  predictedOutcome: OutcomeKind | null
  blocked: boolean
}

export interface ReadinessInput {
  validation: ValidationResult
  totals: MissionTotals
  prediction: PredictionSummary | null
  contract: ContractData
  quantity: number
  energyAvailableGj: number
  releaseSpeedScale: number
}

const HARD_BLOCKER_LIMIT = 1.0

function isTrajectoryFailure(kind: OutcomeKind | null): boolean {
  return (
    kind === 'insufficient-braking' ||
    kind === 'arrival-too-fast' ||
    kind === 'missed-moon' ||
    kind === 'earth-impact' ||
    kind === 'moon-impact'
  )
}

function trajectoryCheck(kind: OutcomeKind | null): ReadinessCheck {
  if (kind === 'delivered') {
    return { label: 'Trajectory', value: 'zone reachable', state: 'ok' }
  }
  if (kind === 'contract-shortfall') {
    return { label: 'Trajectory', value: 'shortfall risk', state: 'warn' }
  }
  if (kind === 'insufficient-braking') {
    return { label: 'Trajectory', value: 'reserve short', state: 'bad' }
  }
  if (kind === 'arrival-too-fast') {
    return { label: 'Trajectory', value: 'too fast', state: 'bad' }
  }
  if (kind === 'missed-moon') {
    return { label: 'Trajectory', value: 'misses zone', state: 'bad' }
  }
  if (kind === 'earth-impact') {
    return { label: 'Trajectory', value: 'Earth impact', state: 'bad' }
  }
  if (kind === 'moon-impact') {
    return { label: 'Trajectory', value: 'lunar impact', state: 'bad' }
  }
  return { label: 'Trajectory', value: 'pending', state: 'warn' }
}

export function evaluateReadiness(input: ReadinessInput): Readiness {
  const {
    validation,
    totals,
    prediction,
    contract,
    quantity,
    energyAvailableGj,
    releaseSpeedScale,
  } = input
  const kind = prediction?.outcomeKind ?? null
  const speedLabel = releaseSpeedScaleLabel(releaseSpeedScale)

  const loadState: ReadinessCheckState =
    totals.launchLoadG > totals.loadLimitG ? 'bad' : 'ok'
  const energyState: ReadinessCheckState =
    totals.rotorEnergyGj > energyAvailableGj ? 'bad' : 'ok'
  const brakeState: ReadinessCheckState =
    kind === 'insufficient-braking'
      ? 'bad'
      : totals.brakeReserveKms < HARD_BLOCKER_LIMIT
        ? 'warn'
        : 'ok'
  const contractState: ReadinessCheckState =
    quantity < contract.requiredQuantity ? 'warn' : 'ok'

  const checks: ReadinessCheck[] = [
    {
      label: 'Payload load',
      value: `${totals.launchLoadG.toFixed(1)} / ${totals.loadLimitG.toFixed(1)} g`,
      state: loadState,
    },
    {
      label: 'Rotor energy',
      value: `${totals.rotorEnergyGj.toFixed(2)} / ${energyAvailableGj.toFixed(2)} GJ`,
      state: energyState,
    },
    {
      label: 'Brake reserve',
      value: `${totals.brakeReserveKms.toFixed(2)} km/s`,
      state: brakeState,
    },
    trajectoryCheck(kind),
    {
      label: 'Contract load',
      value: `${quantity} / ${contract.requiredQuantity} crates`,
      state: contractState,
    },
  ]

  if (validation.blockers.length > 0) {
    return {
      tone: 'bad',
      title: 'Launch blocked',
      detail:
        validation.blockers[0] ?? 'Resolve the highlighted blockers before launch.',
      checks,
      predictedOutcome: kind,
      blocked: true,
    }
  }

  if (!prediction) {
    return {
      tone: 'bad',
      title: 'Check configuration',
      detail: 'The flight plan could not be simulated for this loadout.',
      checks,
      predictedOutcome: null,
      blocked: false,
    }
  }

  if (isTrajectoryFailure(kind)) {
    return {
      tone: 'bad',
      title: 'Flight risk',
      detail:
        kind === 'insufficient-braking'
          ? 'The lunar approach needs more braking than this module can provide. Choose a larger module or reduce the load.'
          : kind === 'missed-moon'
            ? `At ${speedLabel} release speed, the trajectory does not enter the lunar reception zone. Try another detent or loadout.`
            : kind === 'earth-impact'
              ? `At ${speedLabel} release speed, the transfer falls back toward Earth. Try another detent.`
              : kind === 'moon-impact'
                ? `At ${speedLabel} release speed, the planned path intersects the lunar surface without a valid reception.`
                : 'The arrival speed is above the cargo limit for this encounter.',
      checks,
      predictedOutcome: kind,
      blocked: false,
    }
  }

  if (kind === 'contract-shortfall') {
    return {
      tone: 'warn',
      title: 'Contract shortfall risk',
      detail: `Reception may succeed, but only ${quantity} of ${contract.requiredQuantity} required crates are loaded.`,
      checks,
      predictedOutcome: kind,
      blocked: false,
    }
  }

  if (validation.warnings.length > 0) {
    return {
      tone: 'warn',
      title: 'Check configuration',
      detail: validation.warnings[0] ?? 'Review the mission warnings before launch.',
      checks,
      predictedOutcome: kind,
      blocked: false,
    }
  }

  return {
    tone: 'ok',
    title: 'Ready for launch',
    detail: 'Payload, energy and braking margins check out.',
    checks,
    predictedOutcome: kind,
    blocked: false,
  }
}
