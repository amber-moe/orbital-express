import physicalConstantsJson from '../data/physicalConstants.json'
import assumptionsJson from '../data/modelAssumptions.json'
import cargoJson from '../data/cargo.json'
import equipmentJson from '../data/equipment.json'
import profilesJson from '../data/launchProfiles.json'
import contractsJson from '../data/contracts.json'
import type {
  CargoCatalog,
  ContractCatalog,
  EquipmentData,
  GameData,
  LaunchProfileCatalog,
  ModelAssumptionsData,
  PhysicalConstantsData,
  Vec2,
} from './types'

function fail(message: string): never {
  throw new Error(`Game data is invalid: ${message}`)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (!isRecord(value)) fail(`${path} must be an object`)
  return value
}

function number(value: unknown, path: string, min: number, max = Number.POSITIVE_INFINITY): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(`${path} must be a finite number`)
  if (value < min || value > max) fail(`${path} must be between ${min} and ${max}`)
  return value
}

function positive(value: unknown, path: string): number {
  return number(value, path, Number.MIN_VALUE)
}

function nonNegative(value: unknown, path: string): number {
  return number(value, path, 0)
}

function string(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) fail(`${path} must be a non-empty string`)
  return value
}

function vec2(value: unknown, path: string): Vec2 {
  const object = record(value, path)
  return {
    x: number(object.x, `${path}.x`, Number.NEGATIVE_INFINITY),
    y: number(object.y, `${path}.y`, Number.NEGATIVE_INFINITY),
  }
}

function validatePhysicalConstants(value: unknown): PhysicalConstantsData {
  const root = record(value, 'physicalConstants')
  const earth = record(root.earth, 'physicalConstants.earth')
  const moon = record(root.moon, 'physicalConstants.moon')
  const result: PhysicalConstantsData = {
    earth: {
      muKm3S2: positive(earth.muKm3S2, 'physicalConstants.earth.muKm3S2'),
      radiusKm: positive(earth.radiusKm, 'physicalConstants.earth.radiusKm'),
    },
    moon: {
      muKm3S2: positive(moon.muKm3S2, 'physicalConstants.moon.muKm3S2'),
      radiusKm: positive(moon.radiusKm, 'physicalConstants.moon.radiusKm'),
    },
    earthMoonMeanDistanceKm: positive(
      root.earthMoonMeanDistanceKm,
      'physicalConstants.earthMoonMeanDistanceKm',
    ),
    moonPositionKm: vec2(root.moonPositionKm, 'physicalConstants.moonPositionKm'),
  }
  const moonDistance = Math.hypot(result.moonPositionKm.x, result.moonPositionKm.y)
  if (Math.abs(moonDistance - result.earthMoonMeanDistanceKm) > 1e-6) {
    fail('physicalConstants.moonPositionKm must match the documented mean distance')
  }
  if (moonDistance <= result.earth.radiusKm + result.moon.radiusKm) {
    fail('moon position must lie outside both bodies')
  }
  return result
}

function validateAssumptions(value: unknown): ModelAssumptionsData {
  const root = record(value, 'assumptions')
  const simulation = record(root.simulation, 'assumptions.simulation')
  const launcher = record(root.launcher, 'assumptions.launcher')
  const model = record(root.model, 'assumptions.model')
  const omitted = model.omitted
  if (!Array.isArray(omitted) || omitted.some((item) => typeof item !== 'string')) {
    fail('assumptions.model.omitted must be an array of strings')
  }
  return {
    simulation: {
      fixedStepSeconds: positive(simulation.fixedStepSeconds, 'simulation.fixedStepSeconds'),
      maxMissionSeconds: positive(simulation.maxMissionSeconds, 'simulation.maxMissionSeconds'),
      receptionZoneRadiusKm: positive(
        simulation.receptionZoneRadiusKm,
        'simulation.receptionZoneRadiusKm',
      ),
      dockingSpeedKms: nonNegative(simulation.dockingSpeedKms, 'simulation.dockingSpeedKms'),
      playbackRate: positive(simulation.playbackRate, 'simulation.playbackRate'),
      maxPhysicsStepsPerFrame: Math.floor(
        positive(simulation.maxPhysicsStepsPerFrame, 'simulation.maxPhysicsStepsPerFrame'),
      ),
      spinUpSeconds: positive(simulation.spinUpSeconds, 'simulation.spinUpSeconds'),
      departureSeconds: positive(simulation.departureSeconds, 'simulation.departureSeconds'),
      approachSeconds: positive(simulation.approachSeconds, 'simulation.approachSeconds'),
    },
    launcher: {
      efficiency: number(launcher.efficiency, 'launcher.efficiency', 0.05, 1),
      fixedCycleLossGj: nonNegative(launcher.fixedCycleLossGj, 'launcher.fixedCycleLossGj'),
      referenceMassKg: positive(launcher.referenceMassKg, 'launcher.referenceMassKg'),
    },
    model: {
      staticMoon: model.staticMoon === true,
      omitted: [...omitted] as string[],
    },
  }
}

function validateCargo(value: unknown): CargoCatalog {
  const root = record(value, 'cargo')
  const result: CargoCatalog = {}
  for (const [id, raw] of Object.entries(root)) {
    const item = record(raw, `cargo.${id}`)
    if (string(item.id, `cargo.${id}.id`) !== id) fail(`cargo.${id}.id must match its key`)
    result[id] = {
      id,
      name: string(item.name, `cargo.${id}.name`),
      description: string(item.description, `cargo.${id}.description`),
      unitMassKg: positive(item.unitMassKg, `cargo.${id}.unitMassKg`),
      unitVolume: positive(item.unitVolume, `cargo.${id}.unitVolume`),
      unitCostCredits: nonNegative(item.unitCostCredits, `cargo.${id}.unitCostCredits`),
      stock: Math.floor(nonNegative(item.stock, `cargo.${id}.stock`)),
      maxLaunchLoadG: positive(item.maxLaunchLoadG, `cargo.${id}.maxLaunchLoadG`),
      maxArrivalSpeedKms: positive(item.maxArrivalSpeedKms, `cargo.${id}.maxArrivalSpeedKms`),
    }
  }
  if (Object.keys(result).length === 0) fail('cargo catalog is empty')
  return result
}

function validateEquipment(value: unknown, cargo: CargoCatalog): EquipmentData {
  const root = record(value, 'equipment')
  const capsule = record(root.capsule, 'equipment.capsule')
  const protectionRoot = record(root.protection, 'equipment.protection')
  const modulesRoot = record(root.modules, 'equipment.modules')
  const protection = {} as EquipmentData['protection']
  const modules = {} as EquipmentData['modules']

  for (const id of ['standard', 'reinforced'] as const) {
    const raw = record(protectionRoot[id], `equipment.protection.${id}`)
    if (string(raw.id, `equipment.protection.${id}.id`) !== id) fail(`protection ${id} id mismatch`)
    protection[id] = {
      id,
      name: string(raw.name, `equipment.protection.${id}.name`),
      description: string(raw.description, `equipment.protection.${id}.description`),
      massKg: positive(raw.massKg, `equipment.protection.${id}.massKg`),
      volume: nonNegative(raw.volume, `equipment.protection.${id}.volume`),
      costCredits: nonNegative(raw.costCredits, `equipment.protection.${id}.costCredits`),
      launchLoadMultiplier: positive(
        raw.launchLoadMultiplier,
        `equipment.protection.${id}.launchLoadMultiplier`,
      ),
    }
  }
  for (const id of ['small', 'large'] as const) {
    const raw = record(modulesRoot[id], `equipment.modules.${id}`)
    if (string(raw.id, `equipment.modules.${id}.id`) !== id) fail(`module ${id} id mismatch`)
    modules[id] = {
      id,
      name: string(raw.name, `equipment.modules.${id}.name`),
      description: string(raw.description, `equipment.modules.${id}.description`),
      massKg: positive(raw.massKg, `equipment.modules.${id}.massKg`),
      volume: nonNegative(raw.volume, `equipment.modules.${id}.volume`),
      costCredits: nonNegative(raw.costCredits, `equipment.modules.${id}.costCredits`),
      baseBrakeReserveKms: positive(
        raw.baseBrakeReserveKms,
        `equipment.modules.${id}.baseBrakeReserveKms`,
      ),
    }
  }

  const capsuleData: EquipmentData['capsule'] = {
    name: string(capsule.name, 'equipment.capsule.name'),
    dryMassKg: positive(capsule.dryMassKg, 'equipment.capsule.dryMassKg'),
    maxVolume: positive(capsule.maxVolume, 'equipment.capsule.maxVolume'),
    maxMassKg: positive(capsule.maxMassKg, 'equipment.capsule.maxMassKg'),
  }
  if (Object.keys(cargo).length === 0) fail('cargo catalog is empty')
  return { capsule: capsuleData, protection, modules }
}

function validateProfiles(value: unknown): LaunchProfileCatalog {
  const root = record(value, 'profiles')
  const result: LaunchProfileCatalog = {}
  for (const [id, raw] of Object.entries(root)) {
    const profile = record(raw, `profiles.${id}`)
    if (string(profile.id, `profiles.${id}.id`) !== id) fail(`profiles.${id}.id must match its key`)
    const direction = profile.direction
    if (direction !== 'prograde' && direction !== 'retrograde') {
      fail(`profiles.${id}.direction must be prograde or retrograde`)
    }
    const status = profile.status
    if (status !== 'verified' && status !== 'unverified') {
      fail(`profiles.${id}.status must be verified or unverified`)
    }
    const profileData: LaunchProfileCatalog[string] = {
      id,
      name: string(profile.name, `profiles.${id}.name`),
      description: string(profile.description, `profiles.${id}.description`),
      status,
      rotorRadiusM: positive(profile.rotorRadiusM, `profiles.${id}.rotorRadiusM`),
      rotorAngularSpeedRadps: positive(
        profile.rotorAngularSpeedRadps,
        `profiles.${id}.rotorAngularSpeedRadps`,
      ),
      releaseAngleDeg: number(profile.releaseAngleDeg, `profiles.${id}.releaseAngleDeg`, 0, 360),
      insertionRadiusKm: positive(
        profile.insertionRadiusKm,
        `profiles.${id}.insertionRadiusKm`,
      ),
      assistedAscentDeltaVKms: nonNegative(
        profile.assistedAscentDeltaVKms,
        `profiles.${id}.assistedAscentDeltaVKms`,
      ),
      ascentStageCapacityKms: positive(
        profile.ascentStageCapacityKms,
        `profiles.${id}.ascentStageCapacityKms`,
      ),
      direction,
      verificationNote: string(profile.verificationNote, `profiles.${id}.verificationNote`),
    }
    if (profileData.assistedAscentDeltaVKms > profileData.ascentStageCapacityKms) {
      fail(`profiles.${id} requires more ascent delta-v than its stage capacity`)
    }
    result[id] = profileData
  }
  if (Object.keys(result).length === 0) fail('launch profile catalog is empty')
  return result
}

function validateContracts(
  value: unknown,
  cargo: CargoCatalog,
  profiles: LaunchProfileCatalog,
): ContractCatalog {
  const root = record(value, 'contracts')
  const result: ContractCatalog = {}
  for (const [id, raw] of Object.entries(root)) {
    const contract = record(raw, `contracts.${id}`)
    if (string(contract.id, `contracts.${id}.id`) !== id) {
      fail(`contracts.${id}.id must match its key`)
    }
    const cargoId = string(contract.cargoId, `contracts.${id}.cargoId`)
    if (!cargo[cargoId]) fail(`contracts.${id} refers to unknown cargo ${cargoId}`)
    const allowed = contract.allowedQuantities
    if (
      !Array.isArray(allowed) ||
      allowed.length === 0 ||
      allowed.some((quantity) => quantity !== 1 && quantity !== 2 && quantity !== 3)
    ) {
      fail(`contracts.${id}.allowedQuantities must contain 1, 2 or 3`)
    }
    const requiredQuantity = Math.floor(
      positive(contract.requiredQuantity, `contracts.${id}.requiredQuantity`),
    )
    result[id] = {
      id,
      name: string(contract.name, `contracts.${id}.name`),
      client: string(contract.client, `contracts.${id}.client`),
      brief: string(contract.brief, `contracts.${id}.brief`),
      cargoId,
      requiredQuantity,
      allowedQuantities: [...allowed] as ContractCatalog[string]['allowedQuantities'],
      startingCredits: nonNegative(contract.startingCredits, `contracts.${id}.startingCredits`),
      startingEnergyGj: positive(contract.startingEnergyGj, `contracts.${id}.startingEnergyGj`),
      launchFeeCredits: nonNegative(contract.launchFeeCredits, `contracts.${id}.launchFeeCredits`),
      rewardCredits: nonNegative(contract.rewardCredits, `contracts.${id}.rewardCredits`),
      destination: string(contract.destination, `contracts.${id}.destination`),
    }
  }
  if (Object.keys(result).length === 0) fail('contract catalog is empty')
  if (Object.keys(profiles).length === 0) fail('launch profile catalog is empty')
  return result
}

export function loadGameData(): GameData {
  const physicalConstants = validatePhysicalConstants(physicalConstantsJson)
  const assumptions = validateAssumptions(assumptionsJson)
  const cargo = validateCargo(cargoJson)
  const equipment = validateEquipment(equipmentJson, cargo)
  const profiles = validateProfiles(profilesJson)
  const contracts = validateContracts(contractsJson, cargo, profiles)
  return { physicalConstants, assumptions, cargo, equipment, profiles, contracts }
}

export const gameData: GameData = loadGameData()
