import type {
  CharacterLoadout,
  EquipmentItem,
} from "./types";
import { isStoredCarryMode } from "./derived";

export function validateEquipmentItem(item: EquipmentItem): string[] {
  const errors: string[] = [];

  if (!item.characterId) {
    errors.push("characterId is required");
  }

  if (!item.templateId) {
    errors.push("templateId is required");
  }

  if (!item.storageAssignment.locationId) {
    errors.push("storageAssignment.locationId is required");
  }

  if (item.quantity <= 0) {
    errors.push("quantity must be greater than zero");
  }

  if (
    item.isEquipped != null &&
    item.isEquipped !== (item.storageAssignment.carryMode === "equipped")
  ) {
    errors.push("isEquipped must match storageAssignment.carryMode");
  }

  if (
    item.conditionState === "broken" &&
    item.storageAssignment.carryMode === "equipped"
  ) {
    errors.push("broken items cannot be equipped");
  }

  if (
    item.conditionState === "lost" &&
    item.storageAssignment.carryMode !== "stored"
  ) {
    errors.push("lost items cannot remain in an active carry mode");
  }

  if (item.specificityType === "specific" && item.quantity !== 1) {
    errors.push("specific items should have quantity 1");
  }

  if (!item.isStackable && item.quantity !== 1) {
    errors.push("non-stackable items must have quantity 1");
  }

  return errors;
}

export interface LoadoutValidationContext {
  itemsById: Record<string, EquipmentItem>;
}

export function validateLoadout(
  loadout: CharacterLoadout,
  ctx: LoadoutValidationContext,
): string[] {
  const errors: string[] = [];

  const slotEntries = [
    {
      category: "armor",
      itemId: loadout.wornArmorItemId,
      label: "wornArmorItemId",
    },
    {
      category: "shield",
      itemId: loadout.readyShieldItemId,
      label: "readyShieldItemId",
    },
    {
      category: "weapon",
      itemId: loadout.activePrimaryWeaponItemId,
      label: "activePrimaryWeaponItemId",
    },
    {
      category: "weapon",
      itemId: loadout.activeSecondaryWeaponItemId,
      label: "activeSecondaryWeaponItemId",
    },
    {
      category: "weapon",
      itemId: loadout.activeMissileWeaponItemId,
      label: "activeMissileWeaponItemId",
    },
  ] as const;

  for (const { category, itemId, label } of slotEntries) {
    if (!itemId) {
      continue;
    }

    const item = ctx.itemsById[itemId];

    if (!item) {
      errors.push(`Referenced item not found: ${itemId}`);
      continue;
    }

    if (isStoredCarryMode(item.storageAssignment.carryMode)) {
      errors.push(`Stored item cannot be part of active loadout: ${itemId}`);
    }

    if (item.conditionState === "broken" || item.conditionState === "lost") {
      errors.push(
        `Broken or lost item cannot be part of active loadout: ${itemId}`,
      );
    }

    if (item.category !== category) {
      errors.push(
        `${label} must reference a ${category} item: ${itemId}`,
      );
    }
  }

  const ancillaryItemIds = [
    ...loadout.activeAmmoItemIds,
    ...loadout.quickAccessItemIds,
  ];

  for (const itemId of ancillaryItemIds) {
    const item = ctx.itemsById[itemId];

    if (!item) {
      errors.push(`Referenced item not found: ${itemId}`);
      continue;
    }

    if (isStoredCarryMode(item.storageAssignment.carryMode)) {
      errors.push(`Stored item cannot be part of active loadout: ${itemId}`);
    }

    if (item.conditionState === "broken" || item.conditionState === "lost") {
      errors.push(
        `Broken or lost item cannot be part of active loadout: ${itemId}`,
      );
    }
  }

  return errors;
}
