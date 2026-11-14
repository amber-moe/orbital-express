import type {
  DepartureState,
  GravityBody,
  Outcome,
  OutcomeKind,
  Vec2,
  ZoneEntry,
} from '../types'
import { evaluateReception } from './arrivalModel'
import { segmentCircleIntersection, velocityVerletStep } from './physics'

export interface TransferContext {
  bodies: readonly GravityBody[]
  earth: GravityBody
  moon: GravityBody
  zoneRadiusKm: number
  maxMissionSeconds: number
  dockingSpeedKms: number
  maxArrivalSpeedKms: number
  initialBrakeReserveKms: number
  deliveredQuantity: number
  requiredQuantity: number
}

export interface SimState {
  timeSeconds: number
  positionKm: Vec2
  velocityKms: Vec2
  brakeRemainingKms: number
  closestMoonDistanceKm: number
  zoneEntered: boolean
  finished: boolean
}

export interface StepResult {
  done: boolean
  outcome: Outcome | null
  entry: ZoneEntry | null
}

export interface RunResult {
  state: SimState
  outcome: Outcome
  entry: ZoneEntry | null
  points: Vec2[]
  steps: number
}

export function createTransferState(
  departure: DepartureState,
  context: TransferContext,
): SimState {
  return {
    timeSeconds: 0,
    positionKm: { ...departure.positionKm },
    velocityKms: { ...departure.velocityKms },
    brakeRemainingKms: context.initialBrakeReserveKms,
    closestMoonDistanceKm: Math.hypot(
      departure.positionKm.x - context.moon.positionKm.x,
      departure.positionKm.y - context.moon.positionKm.y,
    ),
    zoneEntered: false,
    finished: false,
  }
}

function outcomeAt(
  state: SimState,
  context: TransferContext,
  kind: OutcomeKind,
  extras: Partial<
    Pick<Outcome, 'relativeSpeedKms' | 'requiredBrakeKms' | 'impactSpeedKms'>
  > = {},
): Outcome {
  return {
    kind,
    timeSeconds: state.timeSeconds,
    positionKm: { ...state.positionKm },
    relativeSpeedKms: extras.relativeSpeedKms ?? null,
    requiredBrakeKms: extras.requiredBrakeKms ?? null,
    brakeRemainingKms: state.brakeRemainingKms,
    maxArrivalSpeedKms: context.maxArrivalSpeedKms,
    deliveredQuantity: context.deliveredQuantity,
    requiredQuantity: context.requiredQuantity,
    closestApproachKm: state.closestMoonDistanceKm,
    impactSpeedKms: extras.impactSpeedKms ?? null,
  }
}

function finish(state: SimState, outcome: Outcome, entry: ZoneEntry | null): StepResult {
  state.finished = true
  return { done: true, outcome, entry }
}

/**
 * Advance the transfer by exactly one fixed step and evaluate terminal events.
 * Prediction and live flight both call this function; there is no second copy
 * of the physics or arrival logic.
 */
export function stepTransfer(
  state: SimState,
  context: TransferContext,
  dtSeconds: number,
): StepResult {
  if (state.finished) {
    throw new Error('Cannot step a finished transfer')
  }
  if (!(dtSeconds > 0)) {
    throw new Error('Transfer timestep must be positive')
  }

  const from: Vec2 = { x: state.positionKm.x, y: state.positionKm.y }
  velocityVerletStep(state.positionKm, state.velocityKms, context.bodies, dtSeconds)
  state.timeSeconds += dtSeconds

  const moonDistance = Math.hypot(
    state.positionKm.x - context.moon.positionKm.x,
    state.positionKm.y - context.moon.positionKm.y,
  )
  state.closestMoonDistanceKm = Math.min(state.closestMoonDistanceKm, moonDistance)

  const zoneHit = state.zoneEntered
    ? null
    : segmentCircleIntersection(
        from,
        state.positionKm,
        context.moon.positionKm,
        context.zoneRadiusKm,
      )
  const moonHit = segmentCircleIntersection(
    from,
    state.positionKm,
    context.moon.positionKm,
    context.moon.radiusKm,
  )
  const earthHit = segmentCircleIntersection(
    from,
    state.positionKm,
    context.earth.positionKm,
    context.earth.radiusKm,
  )

  // Pick the earliest event along this step. The reception zone is deliberately
  // checked before a lunar-surface impact even when both occur in one large step.
  let earliest: { type: 'zone' | 'moon' | 'earth'; u: number } | null = null
  if (zoneHit !== null) earliest = { type: 'zone', u: zoneHit }
  if (moonHit !== null && (earliest === null || moonHit < earliest.u)) {
    earliest = { type: 'moon', u: moonHit }
  }
  if (earthHit !== null && (earliest === null || earthHit < earliest.u)) {
    earliest = { type: 'earth', u: earthHit }
  }

  if (earliest !== null) {
    const u = earliest.u
    const px = from.x + (state.positionKm.x - from.x) * u
    const py = from.y + (state.positionKm.y - from.y) * u
    const vx = state.velocityKms.x
    const vy = state.velocityKms.y
    state.positionKm.x = px
    state.positionKm.y = py
    state.timeSeconds -= dtSeconds * (1 - u)

    if (earliest.type === 'zone') {
      state.zoneEntered = true
      const speedKms = Math.hypot(vx, vy)
      const entry: ZoneEntry = {
        timeSeconds: state.timeSeconds,
        positionKm: { x: px, y: py },
        velocityKms: { x: vx, y: vy },
        relativeSpeedKms: speedKms,
      }
      const decision = evaluateReception({
        relativeSpeedKms: speedKms,
        availableBrakeKms: state.brakeRemainingKms,
        maxArrivalSpeedKms: context.maxArrivalSpeedKms,
        dockingSpeedKms: context.dockingSpeedKms,
      })
      if (!decision.accepted) {
        return finish(
          state,
          outcomeAt(state, context, decision.kind, {
            relativeSpeedKms: speedKms,
            requiredBrakeKms: Math.max(0, speedKms - context.dockingSpeedKms),
          }),
          entry,
        )
      }
      state.brakeRemainingKms = decision.brakeRemainingKms
      const kind: OutcomeKind =
        context.deliveredQuantity >= context.requiredQuantity
          ? 'delivered'
          : 'contract-shortfall'
      return finish(
        state,
        outcomeAt(state, context, kind, {
          relativeSpeedKms: speedKms,
          requiredBrakeKms: decision.brakeUsedKms,
        }),
        entry,
      )
    }

    if (earliest.type === 'moon') {
      return finish(
        state,
        outcomeAt(state, context, 'moon-impact', {
          impactSpeedKms: Math.hypot(vx, vy),
        }),
        null,
      )
    }

    return finish(
      state,
      outcomeAt(state, context, 'earth-impact', {
        impactSpeedKms: Math.hypot(vx, vy),
      }),
      null,
    )
  }

  if (state.timeSeconds >= context.maxMissionSeconds) {
    return finish(state, outcomeAt(state, context, 'missed-moon'), null)
  }

  return { done: false, outcome: null, entry: null }
}

export function runTransfer(
  departure: DepartureState,
  context: TransferContext,
  dtSeconds: number,
  sampleSeconds = 60,
): RunResult {
  const state = createTransferState(departure, context)
  const points: Vec2[] = [{ ...state.positionKm }]
  const maxSteps = Math.ceil(context.maxMissionSeconds / dtSeconds) + 2
  let nextSample = sampleSeconds
  let steps = 0
  let outcome: Outcome | null = null
  let entry: ZoneEntry | null = null

  while (!state.finished && steps < maxSteps) {
    const result = stepTransfer(state, context, dtSeconds)
    steps += 1
    if (state.timeSeconds >= nextSample) {
      points.push({ ...state.positionKm })
      nextSample += sampleSeconds
    }
    if (result.done) {
      outcome = result.outcome
      entry = result.entry
      break
    }
  }

  if (!state.finished) {
    state.finished = true
    outcome = outcomeAt(state, context, 'missed-moon')
  }
  if (outcome === null) {
    throw new Error('Transfer ended without an outcome')
  }
  const last = points[points.length - 1]
  if (
    last === undefined ||
    last.x !== state.positionKm.x ||
    last.y !== state.positionKm.y
  ) {
    points.push({ ...state.positionKm })
  }
  return { state, outcome, entry, points, steps }
}
