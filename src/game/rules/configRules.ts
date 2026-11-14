import type {
  CargoDefinition,
  ContractData,
  GameData,
  GravityBody,
  LaunchProfileData,
  MissionConfig,
  MissionTotals,
  Prediction,
  Resources,
  ValidationResult,
} from '../types'
import { computeCentrifuge, buildDepartureState } from '../simulation/departureModel'
import { runTransfer, type TransferContext } from '../simulation/transferSimulator'

const EPSILON = 1e-9

export function configKey(config: MissionConfig): string {
  return [
    config.contractId,
    config.cargoId,
    config.quantity,
    config.protectionId,
    config.moduleId,
    config.profileId,
  ].join('|')
}

export function defaultConfig(data: GameData): MissionConfig {
  const contract = firstContract(data)
  const profile = firstVerifiedProfile(data)
  return {
    contractId: contract.id,
    cargoId: contract.cargoId,
    quantity: 2,
    protectionId: 'reinforced',
    moduleId: 'large',
    profileId: profile.id,
  }
}

export function firstContract(data: GameData): ContractData {
  const contract = Object.values(data.contracts)[0]
  if (!contract) throw new Error('No contract data')
  return contract
}

export function firstVerifiedProfile(data: GameData): LaunchProfileData {
  const profile = Object.values(data.profiles).find((item) => item.status === 'verified')
  if (!profile) throw new Error('No verified launch profile')
  return profile
}

export function getContract(data: GameData, id: string): ContractData {
  const contract = data.contracts[id]
  if (!contract) throw new Error(`Unknown contract ${id}`)
  return contract
}

export function getCargo(data: GameData, id: string): CargoDefinition {
  const cargo = data.cargo[id]
  if (!cargo) throw new Error(`Unknown cargo ${id}`)
  return cargo
}

export function getProfile(data: GameData, id: string): LaunchProfileData {
  const profile = data.profiles[id]
  if (!profile) throw new Error(`Unknown launch profile ${id}`)
  return profile
}

export function initialResources(contract: ContractData, cargo: CargoDefinition): Resources {
  return {
    credits: contract.startingCredits,
    energyGj: contract.startingEnergyGj,
    stock: cargo.stock,
  }
}

export function computeTotals(config: MissionConfig, data: GameData): MissionTotals {
  const contract = getContract(data, config.contractId)
  const cargo = getCargo(data, config.cargoId)
  const profile = getProfile(data, config.profileId)
  const protection = data.equipment.protection[config.protectionId]
  const module = data.equipment.modules[config.moduleId]
  const capsule = data.equipment.capsule
  const quantity = config.quantity

  const cargoMassKg = cargo.unitMassKg * quantity
  const cargoVolume = cargo.unitVolume * quantity
  const totalMassKg =
    capsule.dryMassKg + cargoMassKg + protection.massKg + module.massKg
  const totalVolume = cargoVolume + protection.volume + module.volume
  const centrifuge = computeCentrifuge(profile, totalMassKg, data.assumptions)
  const brakeReserveKms =
    module.baseBrakeReserveKms *
    Math.sqrt(data.assumptions.launcher.referenceMassKg / totalMassKg)
  const loadLimitG = cargo.maxLaunchLoadG * protection.launchLoadMultiplier

  return {
    capsuleMassKg: capsule.dryMassKg,
    cargoMassKg,
    protectionMassKg: protection.massKg,
    moduleMassKg: module.massKg,
    totalMassKg,
    cargoVolume,
    protectionVolume: protection.volume,
    moduleVolume: module.volume,
    totalVolume,
    maxVolume: capsule.maxVolume,
    launchLoadG: centrifuge.launchLoadG,
    loadLimitG,
    releaseSpeedKms: centrifuge.releaseSpeedKms,
    rotorEnergyGj: centrifuge.rotorEnergyGj,
    launchCredits:
      cargo.unitCostCredits * quantity +
      protection.costCredits +
      module.costCredits +
      contract.launchFeeCredits,
    brakeReserveKms,
    ascentRequiredKms: profile.assistedAscentDeltaVKms,
    ascentCapacityKms: profile.ascentStageCapacityKms,
  }
}

export function validateConfig(
  config: MissionConfig,
  totals: MissionTotals,
  resources: Resources,
  data: GameData,
): ValidationResult {
  const blockers: string[] = []
  const warnings: string[] = []
  const contract = getContract(data, config.contractId)
  const cargo = getCargo(data, config.cargoId)
  const profile = getProfile(data, config.profileId)

  if (config.cargoId !== contract.cargoId) {
    blockers.push(`This contract carries ${cargo.name}, not the selected cargo.`)
  }
  if (!contract.allowedQuantities.includes(config.quantity)) {
    blockers.push(`Quantity ${config.quantity} is not permitted for this contract.`)
  }
  if (config.quantity > resources.stock) {
    blockers.push(
      `Only ${resources.stock} crate${resources.stock === 1 ? '' : 's'} of ${cargo.name} remain in inventory.`,
    )
  }
  if (totals.totalVolume > totals.maxVolume + EPSILON) {
    blockers.push(
      `Capsule volume ${totals.totalVolume.toFixed(2)} exceeds the ${totals.maxVolume.toFixed(2)} capacity.`,
    )
  }
  if (totals.totalMassKg > data.equipment.capsule.maxMassKg + EPSILON) {
    blockers.push(
      `Loaded mass ${Math.round(totals.totalMassKg)} kg exceeds the ${data.equipment.capsule.maxMassKg} kg capsule limit.`,
    )
  }
  if (profile.insertionRadiusKm <= data.physicalConstants.earth.radiusKm) {
    blockers.push('Launch profile insertion point lies inside Earth.')
  }
  if (totals.ascentRequiredKms > totals.ascentCapacityKms + EPSILON) {
    blockers.push('The assisted-ascent stage cannot supply the profile’s required delta-v.')
  }
  if (totals.launchLoadG > totals.loadLimitG + EPSILON) {
    blockers.push(
      `Rotor load ${totals.launchLoadG.toFixed(1)} g exceeds the cargo limit of ${totals.loadLimitG.toFixed(1)} g. Choose Reinforced protection.`,
    )
  }
  if (totals.rotorEnergyGj > resources.energyGj + EPSILON) {
    blockers.push(
      `Launch needs ${totals.rotorEnergyGj.toFixed(2)} GJ but only ${resources.energyGj.toFixed(2)} GJ remains.`,
    )
  }
  if (totals.launchCredits > resources.credits + EPSILON) {
    blockers.push(
      `Launch needs ${Math.round(totals.launchCredits)} credits but only ${Math.round(resources.credits)} remain.`,
    )
  }
  if (config.quantity < contract.requiredQuantity) {
    warnings.push(
      `This load carries ${config.quantity} of the ${contract.requiredQuantity} crates required by the contract.`,
    )
  }
  if (totals.brakeReserveKms < 1.0) {
    warnings.push(
      `Braking reserve is only ${totals.brakeReserveKms.toFixed(2)} km/s. The validated lunar encounter needs about 0.78 km/s.`,
    )
  }

  return { ok: blockers.length === 0, blockers, warnings }
}

export function buildBodies(data: GameData): GravityBody[] {
  return [
    {
      id: 'earth',
      muKm3S2: data.physicalConstants.earth.muKm3S2,
      positionKm: { x: 0, y: 0 },
      radiusKm: data.physicalConstants.earth.radiusKm,
    },
    {
      id: 'moon',
      muKm3S2: data.physicalConstants.moon.muKm3S2,
      positionKm: { ...data.physicalConstants.moonPositionKm },
      radiusKm: data.physicalConstants.moon.radiusKm,
    },
  ]
}

export function buildTransferContext(
  config: MissionConfig,
  data: GameData,
  totals: MissionTotals,
): TransferContext {
  const bodies = buildBodies(data)
  const earth = bodies[0]
  const moon = bodies[1]
  if (!earth || !moon) throw new Error('Missing body data')
  const contract = getContract(data, config.contractId)
  const cargo = getCargo(data, config.cargoId)
  return {
    bodies,
    earth,
    moon,
    zoneRadiusKm: data.assumptions.simulation.receptionZoneRadiusKm,
    maxMissionSeconds: data.assumptions.simulation.maxMissionSeconds,
    dockingSpeedKms: data.assumptions.simulation.dockingSpeedKms,
    maxArrivalSpeedKms: cargo.maxArrivalSpeedKms,
    initialBrakeReserveKms: totals.brakeReserveKms,
    deliveredQuantity: config.quantity,
    requiredQuantity: contract.requiredQuantity,
  }
}

function nowMs(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now()
}

export function predictMission(
  config: MissionConfig,
  data: GameData,
  totals: MissionTotals,
): Prediction {
  const profile = getProfile(data, config.profileId)
  const departure = buildDepartureState(
    profile,
    totals.totalMassKg,
    data.physicalConstants.earth.radiusKm,
    data.assumptions,
  )
  const context = buildTransferContext(config, data, totals)
  const started = nowMs()
  const run = runTransfer(
    departure,
    context,
    data.assumptions.simulation.fixedStepSeconds,
    60,
  )
  const computeMs = nowMs() - started
  return {
    configKey: configKey(config),
    outcome: run.outcome,
    points: run.points,
    departure,
    entry: run.entry,
    steps: run.steps,
    computeMs,
  }
}
