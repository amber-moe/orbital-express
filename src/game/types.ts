export interface Vec2 {
  x: number
  y: number
}

export interface GravityBody {
  id: 'earth' | 'moon'
  muKm3S2: number
  positionKm: Vec2
  radiusKm: number
}

export interface PhysicalConstantsData {
  earth: {
    muKm3S2: number
    radiusKm: number
  }
  moon: {
    muKm3S2: number
    radiusKm: number
  }
  earthMoonMeanDistanceKm: number
  moonPositionKm: Vec2
}

export interface ModelAssumptionsData {
  simulation: {
    fixedStepSeconds: number
    maxMissionSeconds: number
    receptionZoneRadiusKm: number
    dockingSpeedKms: number
    playbackRate: number
    maxPhysicsStepsPerFrame: number
    spinUpSeconds: number
    departureSeconds: number
    approachSeconds: number
  }
  launcher: {
    efficiency: number
    fixedCycleLossGj: number
    referenceMassKg: number
  }
  model: {
    staticMoon: boolean
    omitted: string[]
  }
}

export interface CargoDefinition {
  id: string
  name: string
  description: string
  unitMassKg: number
  unitVolume: number
  unitCostCredits: number
  stock: number
  maxLaunchLoadG: number
  maxArrivalSpeedKms: number
}

export type CargoCatalog = Record<string, CargoDefinition>

export interface CapsuleDefinition {
  name: string
  dryMassKg: number
  maxVolume: number
  maxMassKg: number
}

export interface ProtectionDefinition {
  id: ProtectionId
  name: string
  description: string
  massKg: number
  volume: number
  costCredits: number
  launchLoadMultiplier: number
}

export interface ModuleDefinition {
  id: ModuleId
  name: string
  description: string
  massKg: number
  volume: number
  costCredits: number
  baseBrakeReserveKms: number
}

export interface EquipmentData {
  capsule: CapsuleDefinition
  protection: Record<ProtectionId, ProtectionDefinition>
  modules: Record<ModuleId, ModuleDefinition>
}

export type ProtectionId = 'standard' | 'reinforced'
export type ModuleId = 'small' | 'large'
export type CrateQuantity = 1 | 2 | 3

export interface LaunchProfileData {
  id: string
  name: string
  description: string
  status: 'verified' | 'unverified'
  rotorRadiusM: number
  rotorAngularSpeedRadps: number
  releaseAngleDeg: number
  insertionRadiusKm: number
  assistedAscentDeltaVKms: number
  ascentStageCapacityKms: number
  direction: 'prograde' | 'retrograde'
  verificationNote: string
}

export type LaunchProfileCatalog = Record<string, LaunchProfileData>

export interface ContractData {
  id: string
  name: string
  client: string
  brief: string
  cargoId: string
  requiredQuantity: number
  allowedQuantities: CrateQuantity[]
  startingCredits: number
  startingEnergyGj: number
  launchFeeCredits: number
  rewardCredits: number
  destination: string
}

export type ContractCatalog = Record<string, ContractData>

export interface GameData {
  physicalConstants: PhysicalConstantsData
  assumptions: ModelAssumptionsData
  cargo: CargoCatalog
  equipment: EquipmentData
  profiles: LaunchProfileCatalog
  contracts: ContractCatalog
}

export interface MissionConfig {
  contractId: string
  cargoId: string
  quantity: CrateQuantity
  protectionId: ProtectionId
  moduleId: ModuleId
  profileId: string
}

export interface MissionTotals {
  capsuleMassKg: number
  cargoMassKg: number
  protectionMassKg: number
  moduleMassKg: number
  totalMassKg: number
  cargoVolume: number
  protectionVolume: number
  moduleVolume: number
  totalVolume: number
  maxVolume: number
  launchLoadG: number
  loadLimitG: number
  releaseSpeedKms: number
  rotorEnergyGj: number
  launchCredits: number
  brakeReserveKms: number
  ascentRequiredKms: number
  ascentCapacityKms: number
}

export interface Resources {
  credits: number
  energyGj: number
  stock: number
}

export interface ValidationResult {
  ok: boolean
  blockers: string[]
  warnings: string[]
}

export interface DepartureState {
  positionKm: Vec2
  velocityKms: Vec2
  releaseSpeedKms: number
  launchLoadG: number
  rotorEnergyGj: number
  ascentDeltaVKms: number
  ascentCapacityKms: number
}

export type OutcomeKind =
  | 'delivered'
  | 'contract-shortfall'
  | 'insufficient-braking'
  | 'arrival-too-fast'
  | 'missed-moon'
  | 'earth-impact'
  | 'moon-impact'

export interface Outcome {
  kind: OutcomeKind
  timeSeconds: number
  positionKm: Vec2
  relativeSpeedKms: number | null
  requiredBrakeKms: number | null
  brakeRemainingKms: number
  maxArrivalSpeedKms: number | null
  deliveredQuantity: number
  requiredQuantity: number
  closestApproachKm: number
  impactSpeedKms: number | null
}

export interface ZoneEntry {
  timeSeconds: number
  positionKm: Vec2
  velocityKms: Vec2
  relativeSpeedKms: number
}

export interface Prediction {
  configKey: string
  outcome: Outcome
  points: Vec2[]
  departure: DepartureState
  entry: ZoneEntry | null
  steps: number
  computeMs: number
}

export type MissionPhase =
  | 'CONFIGURING'
  | 'SPINNING_UP'
  | 'DEPARTURE'
  | 'TRANSFER'
  | 'APPROACH'
  | 'RESULT'

export interface PredictionSummary {
  outcomeKind: OutcomeKind
  timeSeconds: number
  relativeSpeedKms: number | null
  requiredBrakeKms: number | null
  brakeRemainingKms: number
  deliveredQuantity: number
  requiredQuantity: number
  pointCount: number
  computeMs: number
}

export interface MissionSnapshot {
  phase: MissionPhase
  config: MissionConfig
  resources: Resources
  totals: MissionTotals
  validation: ValidationResult
  prediction: PredictionSummary | null
  result: Outcome | null
  resultTitle: string
  resultDetail: string
  contractComplete: boolean
  attempt: number
  predictionCacheHits: number
  predictionComputeCount: number
  lastPredictionMs: number
}
