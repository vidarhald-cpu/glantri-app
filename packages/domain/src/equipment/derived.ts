import type {
  AccessTier,
  CanonicalMeleeMode,
  CarryMode,
  EquipmentItem,
  EquipmentTemplate,
  ItemStorageAssignment,
  LocationAvailabilityClass,
  MaterialType,
  QualityType,
  StorageLocation,
  StorageLocationType,
  WeaponAttackMode,
} from "./types";

const SYSTEM_LOCATION_TYPES: StorageLocationType[] = [
  "equipped_system",
  "person_system",
  "backpack_system",
  "mount_system",
];

export function isSystemLocation(
  location: Pick<StorageLocation, "type">,
): boolean {
  return SYSTEM_LOCATION_TYPES.includes(location.type);
}

export function isWithYouLocation(
  location: Pick<StorageLocation, "availabilityClass">,
): boolean {
  return location.availabilityClass === "with_you";
}

export function isElsewhereLocation(
  location: Pick<StorageLocation, "availabilityClass">,
): boolean {
  return location.availabilityClass === "elsewhere";
}

export function isRemoteStorage(
  location: Pick<StorageLocation, "availabilityClass" | "type" | "isAccessibleInEncounter">,
): boolean {
  return isElsewhereLocation(location) || (!isSystemLocation(location) && !location.isAccessibleInEncounter);
}

export function isEncounterAccessible(
  location: Pick<StorageLocation, "isAccessibleInEncounter">,
): boolean {
  return location.isAccessibleInEncounter;
}

export function isPersonalCarryMode(carryMode: CarryMode): boolean {
  return (
    carryMode === "equipped" ||
    carryMode === "on_person" ||
    carryMode === "backpack"
  );
}

export function isStoredCarryMode(carryMode: CarryMode): boolean {
  return carryMode === "stored";
}

export function isReadyCarryMode(carryMode: CarryMode): boolean {
  return carryMode === "equipped" || carryMode === "on_person";
}

export function getLocationSortOrder(
  location: Pick<StorageLocation, "availabilityClass" | "type">,
): number {
  if (location.availabilityClass === "elsewhere") {
    return 100 + getLocationSortOrderWithinAvailability(location);
  }

  return getLocationSortOrderWithinAvailability(location);
}

function getLocationSortOrderWithinAvailability(
  location: Pick<StorageLocation, "type">,
): number {
  switch (location.type) {
    case "equipped_system":
      return 0;
    case "person_system":
      return 1;
    case "backpack_system":
      return 2;
    case "mount_system":
      return 3;
    default:
      return 4;
  }
}

export function getLocationAvailabilitySortOrder(
  availabilityClass: LocationAvailabilityClass,
): number {
  return availabilityClass === "with_you" ? 0 : 1;
}

export function getStorageAssignmentForLocation(
  location: Pick<StorageLocation, "id" | "type">,
): ItemStorageAssignment {
  switch (location.type) {
    case "equipped_system":
      return { carryMode: "equipped", locationId: location.id };
    case "person_system":
      return { carryMode: "on_person", locationId: location.id };
    case "backpack_system":
      return { carryMode: "backpack", locationId: location.id };
    case "mount_system":
      return { carryMode: "mount", locationId: location.id };
    default:
      return { carryMode: "stored", locationId: location.id };
  }
}

export function getMaterialFactor(material: MaterialType): number {
  switch (material) {
    case "bronze":
      return 1.1;
    default:
      return 1.0;
  }
}

export function getQualityFactor(quality: QualityType): number {
  switch (quality) {
    case "extraordinary":
      return 0.9;
    default:
      return 1.0;
  }
}

export function getCarryFactor(carryMode: CarryMode): number {
  switch (carryMode) {
    case "backpack":
      return 0.75;
    case "mount":
      return 0.0;
    default:
      return isStoredCarryMode(carryMode) ? 0.0 : 1.0;
  }
}

export function getEffectiveEncumbrance(
  item: EquipmentItem,
  template: EquipmentTemplate,
): number {
  if (item.encumbranceOverride != null) {
    return item.encumbranceOverride;
  }

  return (
    template.baseEncumbrance *
    item.quantity *
    getMaterialFactor(item.material) *
    getQualityFactor(item.quality) *
    getCarryFactor(item.storageAssignment.carryMode)
  );
}

export function getAccessTier(carryMode: CarryMode): AccessTier {
  if (isReadyCarryMode(carryMode)) {
    return carryMode === "equipped" ? "immediate" : "fast";
  }

  switch (carryMode) {
    case "backpack":
      return "slow";
    case "mount":
      return "situational";
    default:
      return "unavailable";
  }
}

export function getCanonicalMeleeModeFromAttackLabel(
  label: string | null | undefined,
): CanonicalMeleeMode | null {
  switch (label?.trim().toLowerCase()) {
    case "slash":
      return "slash";
    case "strike":
    case "crush":
      return "strike";
    case "thrust":
    case "puncture":
      return "thrust";
    default:
      return null;
  }
}

export function getCanonicalMeleeModeFromCrit(
  crit: string | null | undefined,
): CanonicalMeleeMode | null {
  const normalized = crit?.trim().toUpperCase();
  if (!normalized) {
    return null;
  }

  const familyLetter = /^[A-Z]([SCP])/.exec(normalized)?.[1] ?? null;

  switch (familyLetter) {
    case "S":
      return "slash";
    case "C":
      return "strike";
    case "P":
      return "thrust";
    default:
      return null;
  }
}

export function getCanonicalMeleeModeLabel(
  mode: CanonicalMeleeMode | null | undefined,
): string | null {
  switch (mode) {
    case "slash":
      return "Slash";
    case "strike":
      return "Strike";
    case "thrust":
      return "Thrust";
    default:
      return null;
  }
}

export function getCanonicalMeleeModeForAttackMode(
  mode: Pick<WeaponAttackMode, "canonicalMeleeMode" | "label" | "crit">,
): CanonicalMeleeMode | null {
  return (
    mode.canonicalMeleeMode ??
    getCanonicalMeleeModeFromAttackLabel(mode.label) ??
    getCanonicalMeleeModeFromCrit(mode.crit)
  );
}

export function getPrimaryAttackMode(
  attackModes: WeaponAttackMode[] | null | undefined,
): WeaponAttackMode | null {
  if (!attackModes?.length) {
    return null;
  }

  return attackModes.find((mode) => mode.isPrimaryAttack) ?? attackModes[0] ?? null;
}

export function getItemAccessTier(
  carryMode: CarryMode,
  location?: Pick<StorageLocation, "availabilityClass">,
): AccessTier {
  if (!isStoredCarryMode(carryMode)) {
    return getAccessTier(carryMode);
  }

  if (location && isWithYouLocation(location)) {
    return "situational";
  }

  return "unavailable";
}

export function getRetrievalRounds(carryMode: CarryMode): number | null {
  if (isReadyCarryMode(carryMode)) {
    return carryMode === "equipped" ? 0 : 1;
  }

  switch (carryMode) {
    case "backpack":
      return 10;
    default:
      return null;
  }
}
