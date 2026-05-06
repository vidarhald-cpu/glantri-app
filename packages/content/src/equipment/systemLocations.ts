import type { StorageLocation } from "@glantri/domain/equipment";

export function createDefaultEquipmentLocations(
  characterId: string,
): StorageLocation[] {
  return [
    {
      id: `${characterId}:loc-equipped`,
      characterId,
      name: "Equipped",
      type: "equipped_system",
      availabilityClass: "with_you",
      parentLocationId: null,
      isMobile: true,
      isAccessibleInEncounter: true,
      notes: null,
    },
    {
      id: `${characterId}:loc-person`,
      characterId,
      name: "On person",
      type: "person_system",
      availabilityClass: "with_you",
      parentLocationId: null,
      isMobile: true,
      isAccessibleInEncounter: true,
      notes: null,
    },
    {
      id: `${characterId}:loc-backpack`,
      characterId,
      name: "Backpack",
      type: "backpack_system",
      availabilityClass: "with_you",
      parentLocationId: null,
      isMobile: true,
      isAccessibleInEncounter: true,
      notes: "Reduced encumbrance, but slow retrieval.",
    },
    {
      id: `${characterId}:loc-mount`,
      characterId,
      name: "Mount",
      type: "mount_system",
      availabilityClass: "with_you",
      parentLocationId: null,
      isMobile: true,
      isAccessibleInEncounter: false,
      notes: null,
    },
  ];
}
