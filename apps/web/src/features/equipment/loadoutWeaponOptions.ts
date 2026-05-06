import { getAccessTier, isWithYouLocation, type EquipmentItem, type EquipmentTemplate } from "@glantri/domain";

import type { EquipmentFeatureState } from "./types";

const PISTOL_TEMPLATE_IDS = new Set([
  "weapon-template-pistol",
  "weapon-template-cartridge-pistol",
]);

function getItemName(input: {
  displayName?: string | null;
  templateId?: string;
  templateName?: string;
}): string {
  if (!input.templateId) {
    return "None";
  }

  return input.displayName ?? input.templateName ?? "Unknown item";
}

function buildOptionLabel(input: {
  item: EquipmentItem;
  state: EquipmentFeatureState;
}): string {
  const template = input.state.templates.templatesById[input.item.templateId];

  return `${getItemName({
    displayName: input.item.displayName,
    templateId: input.item.templateId,
    templateName: template?.name,
  })}${getAccessTier(input.item.storageAssignment.carryMode) === "slow" ? " (Backpack / slow)" : ""}`;
}

function isSelectableWeaponItem(
  item: EquipmentItem,
  state: EquipmentFeatureState,
): boolean {
  if (item.category !== "weapon") {
    return false;
  }

  if (item.conditionState === "broken" || item.conditionState === "lost") {
    return false;
  }

  const location = state.locationsById[item.storageAssignment.locationId];
  return location ? isWithYouLocation(location) : false;
}

function isWeaponTemplate(
  template: EquipmentTemplate | undefined,
): template is Extract<EquipmentTemplate, { category: "weapon" }> {
  return template?.category === "weapon";
}

function hasDerivedThrownAttackMode(
  template: Extract<EquipmentTemplate, { category: "weapon" }>,
): boolean {
  return template.attackModes?.some((mode) => mode.id === "mode-3") === true;
}

export function isLoadoutMeleeWeaponTemplate(
  template: EquipmentTemplate | undefined,
): boolean {
  return (
    isWeaponTemplate(template) &&
    template.handlingClass !== "missile" &&
    template.handlingClass !== "thrown"
  );
}

export function isLoadoutMissileWeaponTemplate(
  template: EquipmentTemplate | undefined,
): boolean {
  if (!isWeaponTemplate(template) || template.handlingClass !== "missile") {
    return false;
  }

  return template.weaponClass === "bow" || PISTOL_TEMPLATE_IDS.has(template.id);
}

export function hasLoadoutThrownWeaponStats(
  template: EquipmentTemplate | undefined,
): boolean {
  return (
    isWeaponTemplate(template) &&
    (
      template.handlingClass === "thrown" ||
      hasDerivedThrownAttackMode(template)
    )
  );
}

export function isValidLoadoutThrowingWeaponItem(input: {
  item: EquipmentItem | undefined;
  state: EquipmentFeatureState;
}): boolean {
  if (!input.item) {
    return false;
  }

  return (
    isSelectableWeaponItem(input.item, input.state) &&
    hasLoadoutThrownWeaponStats(input.state.templates.templatesById[input.item.templateId])
  );
}

function buildFilteredWeaponOptions(input: {
  characterId: string;
  predicate: (template: EquipmentTemplate | undefined) => boolean;
  state: EquipmentFeatureState;
}): Array<{ id: string; label: string }> {
  return Object.values(input.state.itemsById)
    .filter((item) => item.characterId === input.characterId && item.category === "weapon")
    .filter((item) => isSelectableWeaponItem(item, input.state))
    .filter((item) => input.predicate(input.state.templates.templatesById[item.templateId]))
    .map((item) => ({
      id: item.id,
      label: buildOptionLabel({
        item,
        state: input.state,
      }),
    }))
    .sort((left, right) => left.label.localeCompare(right.label));
}

export function buildLoadoutMeleeWeaponOptions(input: {
  characterId: string;
  state: EquipmentFeatureState;
}): Array<{ id: string; label: string }> {
  return buildFilteredWeaponOptions({
    characterId: input.characterId,
    predicate: isLoadoutMeleeWeaponTemplate,
    state: input.state,
  });
}

export function buildLoadoutMissileWeaponOptions(input: {
  characterId: string;
  state: EquipmentFeatureState;
}): Array<{ id: string; label: string }> {
  return buildFilteredWeaponOptions({
    characterId: input.characterId,
    predicate: isLoadoutMissileWeaponTemplate,
    state: input.state,
  });
}

export function buildLoadoutThrowingWeaponOptions(input: {
  characterId: string;
  state: EquipmentFeatureState;
}): Array<{ id: string; label: string }> {
  return buildFilteredWeaponOptions({
    characterId: input.characterId,
    predicate: hasLoadoutThrownWeaponStats,
    state: input.state,
  });
}
