import type { Outcome, OutcomeKind } from './types'

export interface OutcomeCopy {
  title: string
  detail: string
  tone: 'success' | 'warning' | 'failure'
}

/** Presentation-only context; the simulation never reads this. */
export interface OutcomeCopyContext {
  cargoName: string
  orderLabel: string
  destination: string
}

function speed(value: number | null): string {
  return value === null ? 'unknown' : `${value.toFixed(3)} km/s`
}

export function formatDuration(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds)) return '—'
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  if (days > 0) return `${days}d ${hours}h ${minutes}m`
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

export function describeOutcome(
  outcome: Outcome,
  context?: OutcomeCopyContext,
): OutcomeCopy {
  const destination = context?.destination ?? 'The receiving depot'
  const cargoName = context?.cargoName ?? 'the cargo'
  const orderLabel = context?.orderLabel ?? 'this contract'
  switch (outcome.kind) {
    case 'delivered':
      return {
        title: 'Delivered',
        detail: `${destination} accepted ${outcome.deliveredQuantity} crate${
          outcome.deliveredQuantity === 1 ? '' : 's'
        } of ${cargoName}. Terminal relative speed was ${speed(
          outcome.relativeSpeedKms,
        )}; the finite brake used ${outcome.requiredBrakeKms?.toFixed(3) ?? '—'} km/s.`,
        tone: 'success',
      }
    case 'contract-shortfall':
      return {
        title: 'Partial delivery',
        detail: `${destination} accepted ${outcome.deliveredQuantity} crate${
          outcome.deliveredQuantity === 1 ? '' : 's'
        } of ${cargoName}, but ${orderLabel} requires ${outcome.requiredQuantity}. Reception succeeded; the contract did not.`,
        tone: 'warning',
      }
    case 'insufficient-braking':
      return {
        title: 'Insufficient braking reserve',
        detail: `The capsule reached the reception zone at ${speed(
          outcome.relativeSpeedKms,
        )}. Nulling that approach needed ${outcome.requiredBrakeKms?.toFixed(
          3,
        )} km/s, but only ${outcome.brakeRemainingKms.toFixed(
          3,
        )} km/s remained. Choose a larger maneuver module.`,
        tone: 'failure',
      }
    case 'arrival-too-fast':
      return {
        title: 'Arrival too fast',
        detail: `The capsule crossed the reception boundary at ${speed(
          outcome.relativeSpeedKms,
        )}, above the cargo’s modeled ${
          outcome.maxArrivalSpeedKms?.toFixed(2) ?? '—'
        } km/s arrival limit. Automatic braking cannot repair a high-speed encounter.`,
        tone: 'failure',
      }
    case 'missed-moon':
      return {
        title: 'Missed the Moon',
        detail:
          'The capsule never entered the lunar reception zone inside the mission horizon. The trajectory is integrated from the selected profile; this attempt does not reach Selene Depot.',
        tone: 'failure',
      }
    case 'earth-impact':
      return {
        title: 'Re-entered Earth',
        detail: `The transfer fell back into Earth’s surface at ${
          outcome.impactSpeedKms?.toFixed(3) ?? '—'
        } km/s. The assisted ascent did not impart enough energy to reach the Moon.`,
        tone: 'failure',
      }
    case 'moon-impact':
      return {
        title: 'Lunar impact',
        detail: `The capsule struck the lunar surface at ${
          outcome.impactSpeedKms?.toFixed(3) ?? '—'
        } km/s without a valid reception. Proximity or collision is not delivery.`,
        tone: 'failure',
      }
  }
}

export function shortOutcomeLabel(kind: OutcomeKind): string {
  switch (kind) {
    case 'delivered':
      return 'Delivered'
    case 'contract-shortfall':
      return 'Reception OK · shortfall'
    case 'insufficient-braking':
      return 'Braking reserve short'
    case 'arrival-too-fast':
      return 'Arrival too fast'
    case 'missed-moon':
      return 'Missed the Moon'
    case 'earth-impact':
      return 'Re-enters Earth'
    case 'moon-impact':
      return 'Lunar impact'
  }
}
