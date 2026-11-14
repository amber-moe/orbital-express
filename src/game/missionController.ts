import type {
  DepartureState,
  GameData,
  MissionConfig,
  MissionPhase,
  MissionSnapshot,
  MissionTotals,
  Outcome,
  Prediction,
  PredictionSummary,
  Resources,
  ValidationResult,
  Vec2,
} from './types'
import {
  buildTransferContext,
  configKey,
  defaultConfig,
  getCargo,
  getContract,
  getProfile,
  initialResources,
  predictMission,
  computeTotals,
  validateConfig,
} from './rules/configRules'
import { buildDepartureState, surfaceReleasePoint } from './simulation/departureModel'
import {
  createTransferState,
  stepTransfer,
  type SimState,
  type StepResult,
  type TransferContext,
} from './simulation/transferSimulator'
import { describeOutcome } from './outcomeMessages'

export interface FrameState {
  phase: MissionPhase
  phaseProgress: number
  cargoPositionKm: Vec2 | null
  trailPoints: Vec2[]
  trailRevision: number
  predictionPoints: Vec2[]
  predictionVersion: number
  simTimeSeconds: number
}

export type SnapshotListener = (snapshot: MissionSnapshot) => void

const LIVE_TRAIL_SAMPLE_SECONDS = 60
const MAX_LIVE_TRAIL_POINTS = 12000

export class MissionController {
  private readonly data: GameData
  private listener: SnapshotListener | null
  private config: MissionConfig
  private resources: Resources
  private totals: MissionTotals
  private validation: ValidationResult
  private phase: MissionPhase = 'CONFIGURING'
  private phaseTimer = 0
  private phaseProgress = 0
  private attempt = 0
  private result: Outcome | null = null
  private contractComplete = false
  private settled = false

  private currentPrediction: Prediction | null = null
  private readonly predictionCache = new Map<string, Prediction>()
  private predictionGeneration = 0
  private predictionCacheHits = 0
  private predictionComputeCount = 0
  private lastPredictionMs = 0

  private departure: DepartureState | null = null
  private context: TransferContext | null = null
  private simState: SimState | null = null
  private simAccumulator = 0
  private trail: Vec2[] = []
  private trailRevision = 0
  private nextTrailSampleSeconds = LIVE_TRAIL_SAMPLE_SECONDS

  private approachFrom: Vec2 | null = null
  private approachTo: Vec2 | null = null

  private readonly frame: FrameState = {
    phase: 'CONFIGURING',
    phaseProgress: 0,
    cargoPositionKm: null,
    trailPoints: [],
    trailRevision: 0,
    predictionPoints: [],
    predictionVersion: 0,
    simTimeSeconds: 0,
  }

  constructor(data: GameData, listener: SnapshotListener | null = null, config?: MissionConfig) {
    this.data = data
    this.listener = listener
    this.config = config ? { ...config } : defaultConfig(data)
    const contract = getContract(data, this.config.contractId)
    const cargo = getCargo(data, contract.cargoId)
    this.resources = initialResources(contract, cargo)
    this.totals = computeTotals(this.config, data)
    this.validation = validateConfig(this.config, this.totals, this.resources, data)
    this.refreshPrediction()
    this.frame.cargoPositionKm = this.currentPrediction
      ? { ...this.currentPrediction.departure.positionKm }
      : null
  }

  subscribe(listener: SnapshotListener): void {
    this.listener = listener
  }

  getSnapshot(): MissionSnapshot {
    const copy = this.currentPrediction ? this.toSummary(this.currentPrediction) : null
    const copyOfResult = this.result
    const outcomeCopy = copyOfResult ? describeOutcome(copyOfResult) : null
    return {      phase: this.phase,
      config: { ...this.config },
      resources: { ...this.resources },
      totals: { ...this.totals },
      validation: {
        ok: this.validation.ok,
        blockers: [...this.validation.blockers],
        warnings: [...this.validation.warnings],
      },
      prediction: copy,
      result: copyOfResult ? { ...copyOfResult, positionKm: { ...copyOfResult.positionKm } } : null,
      resultTitle: outcomeCopy?.title ?? '',
      resultDetail: outcomeCopy?.detail ?? '',
      contractComplete: this.contractComplete,
      attempt: this.attempt,
      predictionCacheHits: this.predictionCacheHits,
      predictionComputeCount: this.predictionComputeCount,
      lastPredictionMs: this.lastPredictionMs,
    }
  }

  getFrameState(): FrameState {
    return this.frame
  }

  getConfig(): MissionConfig {
    return { ...this.config }
  }

  getPrediction(): Prediction | null {
    return this.currentPrediction
  }

  setConfig(patch: Partial<MissionConfig>): boolean {
    if (this.phase !== 'CONFIGURING') return false
    const next: MissionConfig = { ...this.config, ...patch }
    if (configKey(next) === configKey(this.config)) return false
    this.config = next
    this.totals = computeTotals(this.config, this.data)
    this.validation = validateConfig(this.config, this.totals, this.resources, this.data)
    this.refreshPrediction()
    this.frame.cargoPositionKm = this.currentPrediction
      ? { ...this.currentPrediction.departure.positionKm }
      : null
    this.emit()
    return true
  }

  launch(): boolean {
    if (this.phase !== 'CONFIGURING' || !this.validation.ok) return false
    if (!this.currentPrediction) return false

    this.resources.credits -= this.totals.launchCredits
    this.resources.energyGj -= this.totals.rotorEnergyGj
    this.resources.stock -= this.config.quantity

    this.attempt += 1
    this.result = null
    this.contractComplete = false
    this.settled = false
    this.phase = 'SPINNING_UP'
    this.phaseTimer = 0
    this.phaseProgress = 0
    this.frame.phase = this.phase
    this.frame.phaseProgress = 0
    this.frame.simTimeSeconds = 0
    this.trail = []
    this.trailRevision += 1
    this.frame.trailPoints = this.trail
    this.frame.trailRevision = this.trailRevision
    this.simState = null
    this.simAccumulator = 0
    this.approachFrom = null
    this.approachTo = null

    const profile = getProfile(this.data, this.config.profileId)
    this.departure = buildDepartureState(
      profile,
      this.totals.totalMassKg,
      this.data.physicalConstants.earth.radiusKm,
      this.data.assumptions,
    )
    this.context = buildTransferContext(this.config, this.data, this.totals)
    this.frame.cargoPositionKm = surfaceReleasePoint(
      profile,
      this.data.physicalConstants.earth.radiusKm,
    )
    this.emit()
    return true
  }

  tick(realSeconds: number): void {
    const dt = Math.min(Math.max(realSeconds, 0), 0.1)
    if (dt <= 0) return

    switch (this.phase) {
      case 'SPINNING_UP': {
        this.phaseTimer += dt
        this.phaseProgress = Math.min(
          1,
          this.phaseTimer / this.data.assumptions.simulation.spinUpSeconds,
        )
        this.frame.phaseProgress = this.phaseProgress
        if (this.phaseTimer >= this.data.assumptions.simulation.spinUpSeconds) {
          this.beginDeparture()
          this.emit()
        }
        break
      }
      case 'DEPARTURE': {
        this.phaseTimer += dt
        this.phaseProgress = Math.min(
          1,
          this.phaseTimer / this.data.assumptions.simulation.departureSeconds,
        )
        this.frame.phaseProgress = this.phaseProgress
        this.updateDepartureVisual(this.phaseProgress)
        if (this.phaseTimer >= this.data.assumptions.simulation.departureSeconds) {
          this.beginTransfer()
          this.emit()
        }
        break
      }
      case 'TRANSFER': {
        this.advanceTransfer(dt)
        break
      }
      case 'APPROACH': {
        this.phaseTimer += dt
        this.phaseProgress = Math.min(
          1,
          this.phaseTimer / this.data.assumptions.simulation.approachSeconds,
        )
        this.frame.phaseProgress = this.phaseProgress
        this.updateApproachVisual(this.phaseProgress)
        if (this.phaseTimer >= this.data.assumptions.simulation.approachSeconds) {
          this.phase = 'RESULT'
          this.frame.phase = this.phase
          this.phaseProgress = 1
          this.frame.phaseProgress = 1
          this.emit()
        }
        break
      }
      case 'CONFIGURING':
      case 'RESULT':
        break
    }
  }

  retry(): boolean {
    if (this.phase !== 'RESULT') return false
    const contract = getContract(this.data, this.config.contractId)
    const cargo = getCargo(this.data, contract.cargoId)
    this.resources = initialResources(contract, cargo)
    this.phase = 'CONFIGURING'
    this.phaseTimer = 0
    this.phaseProgress = 0
    this.result = null
    this.contractComplete = false
    this.settled = false
    this.simState = null
    this.simAccumulator = 0
    this.departure = null
    this.context = null
    this.approachFrom = null
    this.approachTo = null
    this.trail = []
    this.trailRevision += 1
    this.frame.phase = this.phase
    this.frame.phaseProgress = 0
    this.frame.simTimeSeconds = 0
    this.frame.trailPoints = this.trail
    this.frame.trailRevision = this.trailRevision
    this.frame.cargoPositionKm = this.currentPrediction
      ? { ...this.currentPrediction.departure.positionKm }
      : null
    this.totals = computeTotals(this.config, this.data)
    this.validation = validateConfig(this.config, this.totals, this.resources, this.data)
    this.refreshPrediction()
    this.emit()
    return true
  }

  private beginDeparture(): void {
    this.phase = 'DEPARTURE'
    this.phaseTimer = 0
    this.phaseProgress = 0
    this.frame.phase = this.phase
    this.frame.phaseProgress = 0
    const profile = getProfile(this.data, this.config.profileId)
    this.frame.cargoPositionKm = surfaceReleasePoint(
      profile,
      this.data.physicalConstants.earth.radiusKm,
    )
  }

  private updateDepartureVisual(progress: number): void {
    if (!this.departure) return
    const profile = getProfile(this.data, this.config.profileId)
    const angle = (profile.releaseAngleDeg * Math.PI) / 180
    const eased = progress * progress * (3 - 2 * progress)
    const insertionRadius = Math.hypot(
      this.departure.positionKm.x,
      this.departure.positionKm.y,
    )
    const radius =
      this.data.physicalConstants.earth.radiusKm +
      (insertionRadius - this.data.physicalConstants.earth.radiusKm) * eased
    if (!this.frame.cargoPositionKm) this.frame.cargoPositionKm = { x: 0, y: 0 }
    this.frame.cargoPositionKm.x = radius * Math.cos(angle)
    this.frame.cargoPositionKm.y = radius * Math.sin(angle)
  }

  private beginTransfer(): void {
    if (!this.departure || !this.context) {
      throw new Error('Launch state is missing')
    }
    this.phase = 'TRANSFER'
    this.phaseTimer = 0
    this.phaseProgress = 0
    this.frame.phase = this.phase
    this.frame.phaseProgress = 0
    this.simState = createTransferState(this.departure, this.context)
    this.simAccumulator = 0
    this.nextTrailSampleSeconds = LIVE_TRAIL_SAMPLE_SECONDS
    this.trail = [{ ...this.simState.positionKm }]
    this.trailRevision += 1
    this.frame.trailPoints = this.trail
    this.frame.trailRevision = this.trailRevision
    this.frame.cargoPositionKm = { ...this.simState.positionKm }
    this.frame.simTimeSeconds = 0
  }

  private advanceTransfer(realDt: number): void {
    if (!this.simState || !this.context) return
    this.simAccumulator += realDt * this.data.assumptions.simulation.playbackRate
    const fixedStep = this.data.assumptions.simulation.fixedStepSeconds
    const maxSteps = this.data.assumptions.simulation.maxPhysicsStepsPerFrame
    let steps = 0
    let terminal: StepResult | null = null

    while (
      this.simAccumulator >= fixedStep &&
      steps < maxSteps &&
      !this.simState.finished
    ) {
      const result = stepTransfer(this.simState, this.context, fixedStep)
      this.simAccumulator -= fixedStep
      steps += 1
      if (this.simState.timeSeconds >= this.nextTrailSampleSeconds) {
        this.pushTrailPoint()
        this.nextTrailSampleSeconds += LIVE_TRAIL_SAMPLE_SECONDS
      }
      if (result.done) {
        terminal = result
        break
      }
    }
    if (steps >= maxSteps) {
      // Drop the playback backlog instead of growing the physics timestep or
      // stalling the page. Slow machines see a slower presentation, not changed physics.
      this.simAccumulator = 0
    }

    this.frame.simTimeSeconds = this.simState.timeSeconds
    this.frame.cargoPositionKm = { ...this.simState.positionKm }

    if (terminal) {
      this.pushTrailPoint()
      this.handleTerminal(terminal)
    }
  }

  private pushTrailPoint(): void {
    if (!this.simState) return
    if (this.trail.length >= MAX_LIVE_TRAIL_POINTS) return
    const last = this.trail[this.trail.length - 1]
    if (last && last.x === this.simState.positionKm.x && last.y === this.simState.positionKm.y) {
      return
    }
    this.trail.push({ ...this.simState.positionKm })
    this.trailRevision += 1
    this.frame.trailRevision = this.trailRevision
  }

  private handleTerminal(result: StepResult): void {
    if (!result.outcome) return
    const outcome = result.outcome
    this.result = outcome

    if (outcome.kind === 'delivered' || outcome.kind === 'contract-shortfall') {
      this.phase = 'APPROACH'
      this.phaseTimer = 0
      this.phaseProgress = 0
      this.frame.phase = this.phase
      this.frame.phaseProgress = 0
      this.approachFrom = { ...outcome.positionKm }
      this.approachTo = this.dockingTarget(outcome.positionKm)
      this.frame.cargoPositionKm = { ...outcome.positionKm }
      if (outcome.kind === 'delivered' && !this.settled) {
        this.resources.credits += getContract(this.data, this.config.contractId).rewardCredits
        this.contractComplete = true
        this.settled = true
      }
    } else {
      this.phase = 'RESULT'
      this.phaseTimer = 0
      this.phaseProgress = 1
      this.frame.phase = this.phase
      this.frame.phaseProgress = 1
      this.frame.cargoPositionKm = { ...outcome.positionKm }
    }
    this.emit()
  }

  private updateApproachVisual(progress: number): void {
    if (!this.approachFrom || !this.approachTo) return
    const eased = progress * progress * (3 - 2 * progress)
    if (!this.frame.cargoPositionKm) this.frame.cargoPositionKm = { x: 0, y: 0 }
    this.frame.cargoPositionKm.x =
      this.approachFrom.x + (this.approachTo.x - this.approachFrom.x) * eased
    this.frame.cargoPositionKm.y =
      this.approachFrom.y + (this.approachTo.y - this.approachFrom.y) * eased
  }

  private dockingTarget(entry: Vec2): Vec2 {
    const moon = this.data.physicalConstants.moonPositionKm
    const dx = entry.x - moon.x
    const dy = entry.y - moon.y
    const length = Math.hypot(dx, dy) || 1
    const distance = this.data.physicalConstants.moon.radiusKm + 1600
    return {
      x: moon.x + (dx / length) * distance,
      y: moon.y + (dy / length) * distance,
    }
  }

  private refreshPrediction(): void {
    this.predictionGeneration += 1
    const generation = this.predictionGeneration
    const key = configKey(this.config)
    const cached = this.predictionCache.get(key)
    if (cached) {
      this.predictionCacheHits += 1
      this.applyPrediction(cached)
      return
    }
    try {
      const prediction = predictMission(this.config, this.data, this.totals)
      if (generation !== this.predictionGeneration) return
      this.predictionCache.set(key, prediction)
      this.predictionComputeCount += 1
      this.lastPredictionMs = prediction.computeMs
      this.applyPrediction(prediction)
    } catch (error) {
      console.error('Prediction failed', error)
      this.currentPrediction = null
      this.frame.predictionPoints = []
      this.frame.predictionVersion += 1
    }
  }

  private applyPrediction(prediction: Prediction): void {
    const previousKey = this.currentPrediction?.configKey ?? null
    this.currentPrediction = prediction
    this.frame.predictionPoints = prediction.points
    if (previousKey !== prediction.configKey) {
      this.frame.predictionVersion += 1
    }
  }

  private toSummary(prediction: Prediction): PredictionSummary {
    return {
      outcomeKind: prediction.outcome.kind,
      timeSeconds: prediction.outcome.timeSeconds,
      relativeSpeedKms: prediction.outcome.relativeSpeedKms,
      requiredBrakeKms: prediction.outcome.requiredBrakeKms,
      brakeRemainingKms: prediction.outcome.brakeRemainingKms,
      deliveredQuantity: prediction.outcome.deliveredQuantity,
      requiredQuantity: prediction.outcome.requiredQuantity,
      pointCount: prediction.points.length,
      computeMs: prediction.computeMs,
    }
  }

  private emit(): void {
    this.listener?.(this.getSnapshot())
  }
}
