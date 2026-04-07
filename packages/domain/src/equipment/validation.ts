import type {
  CharacterLoadout,
  EquipmentItem,
} from "./types";

export function validateEquipmentItem(item: EquipmentItem): string[] {
  const errors: string[] = [];

  if (!item.characterId) {
    errors.push("characterId is required");
  }

  if (!item.templateId) {
    errors.push("templateId is required");
  }

  if (!item.locationId) {
    errors.push("locationId is required");
  }

  if (item.quantity <= 0) {
    errors.push("quantity must be greater than zero");
  }

  if (item.isEquipped && item.carryMode !== "equipped") {
    errors.push("equipped items must use carryMode 'equipped'");
  }

  if (item.conditionState === "broken" && item.isEquipped) {
    errors.push("broken items cannot be equipped");
  }

  if (item.conditionState === "lost" && item.carryMode !== "stored") {
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

    if (item.carryMode === "stored") {
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

    if (item.carryMode === "stored") {
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
