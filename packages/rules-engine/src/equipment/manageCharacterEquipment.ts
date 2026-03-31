import type {
  CharacterBuild,
  CharacterEquipmentItem,
  EquipmentItemType,
  EquipmentSlot,
  ProfessionFamilyDefinition,
  ProfessionDefinition,
  ProfessionSkillMap,
  SkillDefinition,
  SkillGroupDefinition,
  SkillSpecialization,
  SocietyLevelAccess
} from "@glantri/domain";

import { characterBuildSchema } from "@glantri/domain";

import { calculateBaseOB } from "../calculators/ob/calculateBaseOB";
import { calculateDB } from "../calculators/db/calculateDB";
import { calculateParryValue } from "../calculators/parry/calculateParryValue";
import { buildChargenDraftView } from "../chargen/primaryAllocation";

interface CanonicalContentShape {
  professionFamilies: ProfessionFamilyDefinition[];
  professions: ProfessionDefinition[];
  professionSkills: ProfessionSkillMap[];
  skillGroups: SkillGroupDefinition[];
  skills: SkillDefinition[];
  societyLevels: SocietyLevelAccess[];
  specializations: SkillSpecialization[];
}

export interface EquipmentItemDraftInput {
  armorLabel?: string;
  armorValue?: number;
  equipped?: boolean;
  itemType: EquipmentItemType;
  name: string;
  notes?: string;
  shieldBonus?: number;
  slot?: EquipmentSlot;
  weaponBonus?: number;
  weaponSkillId?: string;
}

export interface EquipmentWeaponSummary {
  baseOb: number;
  id: string;
  name: string;
  parryValue: number;
  skillName?: string;
  skillTotal?: number;
  slot: EquipmentSlot;
  specializationNames: string[];
  weaponBonus: number;
}

export interface EquipmentShieldSummary {
  id: string;
  name: string;
  shieldBonus: number;
  slot: EquipmentSlot;
}

export interface EquipmentArmorSummary {
  armorLabel?: string;
  armorValue: number;
  id: string;
  name: string;
  slot: EquipmentSlot;
}

export interface CharacterEquipmentLoadoutSummary {
  armorSummary: string;
  carriedItems: CharacterEquipmentItem[];
  equippedArmor: EquipmentArmorSummary[];
  equippedShields: EquipmentShieldSummary[];
  equippedWeapons: EquipmentWeaponSummary[];
  hasEquippedShield: boolean;
  readinessLabel: string;
  shieldBonus: number;
}

function createItemId(): string {
  if (globalThis.crypto && "randomUUID" in globalThis.crypto) {
    return globalThis.crypto.randomUUID();
  }

  return `equipment-${Date.now()}`;
}

function getDefaultSlot(itemType: EquipmentItemType): EquipmentSlot {
  switch (itemType) {
    case "weapon":
      return "main-hand";
    case "shield":
      return "off-hand";
    case "armor":
      return "body";
  }
}

function normalizeEquipmentItem(item: CharacterEquipmentItem): CharacterEquipmentItem {
  const normalizedSlot = item.equipped && item.slot === "pack" ? getDefaultSlot(item.itemType) : item.slot;

  return {
    ...item,
    armorLabel: item.armorLabel?.trim() || undefined,
    armorValue: item.armorValue ?? 0,
    equipped: item.equipped ?? false,
    name: item.name.trim(),
    notes: item.notes?.trim() || undefined,
    shieldBonus: item.shieldBonus ?? 0,
    slot: normalizedSlot ?? getDefaultSlot(item.itemType),
    weaponBonus: item.weaponBonus ?? 0,
    weaponSkillId: item.weaponSkillId?.trim() || undefined
  };
}

function normalizeBuild(build: CharacterBuild): CharacterBuild {
  const parsed = characterBuildSchema.parse(build);

  return {
    ...parsed,
    equipment: {
      items: parsed.equipment.items.map(normalizeEquipmentItem)
    }
  };
}

function applyExclusiveEquipRules(
  items: CharacterEquipmentItem[],
  activeItem: CharacterEquipmentItem
): CharacterEquipmentItem[] {
  if (!activeItem.equipped) {
    return items;
  }

  return items.map((item) => {
    if (item.id === activeItem.id) {
      return activeItem;
    }

    if (item.slot === activeItem.slot && activeItem.slot !== "pack") {
      return {
        ...item,
        equipped: false
      };
    }

    return item;
  });
}

export function createCharacterEquipmentItem(
  input: EquipmentItemDraftInput
): CharacterEquipmentItem {
  const itemType = input.itemType;

  return normalizeEquipmentItem({
    armorLabel: input.armorLabel,
    armorValue: input.armorValue ?? 0,
    equipped: input.equipped ?? false,
    id: createItemId(),
    itemType,
    name: input.name,
    notes: input.notes,
    shieldBonus: input.shieldBonus ?? 0,
    slot: input.slot ?? getDefaultSlot(itemType),
    weaponBonus: input.weaponBonus ?? 0,
    weaponSkillId: input.weaponSkillId
  });
}

export function upsertCharacterEquipmentItem(input: {
  build: CharacterBuild;
  item: CharacterEquipmentItem;
}): CharacterBuild {
  const build = normalizeBuild(structuredClone(input.build));
  const item = normalizeEquipmentItem(input.item);
  const nextItems = [...build.equipment.items];
  const existingIndex = nextItems.findIndex((existing) => existing.id === item.id);

  if (existingIndex >= 0) {
    nextItems[existingIndex] = item;
  } else {
    nextItems.push(item);
  }

  build.equipment.items = applyExclusiveEquipRules(nextItems, item);
  return build;
}

export function removeCharacterEquipmentItem(input: {
  build: CharacterBuild;
  itemId: string;
}): CharacterBuild {
  const build = normalizeBuild(structuredClone(input.build));
  build.equipment.items = build.equipment.items.filter((item) => item.id !== input.itemId);
  return build;
}

export function setCharacterEquipmentEquipped(input: {
  build: CharacterBuild;
  equipped: boolean;
  itemId: string;
}): CharacterBuild {
  const build = normalizeBuild(structuredClone(input.build));
  const target = build.equipment.items.find((item) => item.id === input.itemId);

  if (!target) {
    return build;
  }

  const updatedTarget: CharacterEquipmentItem = {
    ...target,
    equipped: input.equipped,
    slot:
      input.equipped && target.slot === "pack"
        ? getDefaultSlot(target.itemType)
        : (target.slot ?? getDefaultSlot(target.itemType))
  };
  build.equipment.items = applyExclusiveEquipRules(
    build.equipment.items.map((item) => (item.id === input.itemId ? updatedTarget : item)),
    updatedTarget
  );

  return build;
}

export function buildCharacterEquipmentLoadoutSummary(input: {
  build: CharacterBuild;
  content: CanonicalContentShape;
}): CharacterEquipmentLoadoutSummary {
  const build = normalizeBuild(input.build);
  const draftView = buildChargenDraftView({
    content: input.content,
    professionId: build.professionId,
    profile: build.profile,
    progression: build.progression,
    societyId: build.societyId,
    societyLevel: build.societyLevel
  });
  const equippedItems = build.equipment.items.filter((item) => item.equipped);
  const carriedItems = build.equipment.items.filter((item) => !item.equipped);
  const equippedShields = equippedItems
    .filter((item): item is CharacterEquipmentItem => item.itemType === "shield")
    .map((item) => ({
      id: item.id,
      name: item.name,
      shieldBonus: item.shieldBonus,
      slot: item.slot
    }));
  const shieldBonus = equippedShields.reduce((sum, shield) => sum + shield.shieldBonus, 0);
  const equippedArmor = equippedItems
    .filter((item): item is CharacterEquipmentItem => item.itemType === "armor")
    .map((item) => ({
      armorLabel: item.armorLabel,
      armorValue: item.armorValue ?? 0,
      id: item.id,
      name: item.name,
      slot: item.slot
    }));
  const equippedWeapons = equippedItems
    .filter((item): item is CharacterEquipmentItem => item.itemType === "weapon")
    .map((item) => {
      const skill = item.weaponSkillId
        ? draftView.skills.find((candidate) => candidate.skillId === item.weaponSkillId)
        : undefined;
      const specializationNames = draftView.specializations
        .filter((specialization) => specialization.parentSkillName === skill?.name)
        .map((specialization) => specialization.name);
      const baseOb = calculateBaseOB({
        skill: skill?.totalSkill ?? 0,
        weaponBonus: item.weaponBonus
      });

      return {
        baseOb,
        id: item.id,
        name: item.name,
        parryValue: calculateParryValue({
          allocatedOb: baseOb
        }),
        skillName: skill?.name,
        skillTotal: skill?.totalSkill,
        slot: item.slot,
        specializationNames,
        weaponBonus: item.weaponBonus
      };
    });

  const readyCount = equippedWeapons.length + equippedShields.length + equippedArmor.length;

  return {
    armorSummary:
      equippedArmor.length > 0
        ? equippedArmor
            .map((item) => item.armorLabel ?? item.name)
            .join(", ")
        : "No armor equipped",
    carriedItems,
    equippedArmor,
    equippedShields,
    equippedWeapons,
    hasEquippedShield: equippedShields.length > 0,
    readinessLabel:
      readyCount > 0 ? `${readyCount} equipped item${readyCount === 1 ? "" : "s"} ready` : "No active loadout",
    shieldBonus
  };
}

export function calculateEquipmentDrivenDodge(input: {
  dex: number;
  shieldBonus: number;
}): number {
  return calculateDB({
    dex: input.dex,
    shieldBonus: input.shieldBonus
  });
}
