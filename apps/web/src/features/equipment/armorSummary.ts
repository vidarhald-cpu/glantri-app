import type { ArmorTemplate, CharacterBuild, EquipmentItem } from "@glantri/domain";

export type ArmorLocationKey =
  | "head"
  | "frontArm"
  | "chest"
  | "backArm"
  | "abdomen"
  | "frontThigh"
  | "frontFoot"
  | "backThigh"
  | "backFoot";

export interface ArmorLocationSummary {
  key: ArmorLocationKey;
  label: string;
  type: string | null;
  value: number | null;
  valueWithType: string;
}

export interface CharacterArmorSummary {
  aaModifier: number | null;
  actualEncumbrance: number | null;
  encumbranceFactor: number | null;
  generalArmor: number | null;
  generalArmorRounded: number | null;
  generalArmorWithType: string;
  locations: ArmorLocationSummary[];
  perceptionModifier: number | null;
}

const ARMOR_LOCATIONS: Array<{ key: ArmorLocationKey; label: string }> = [
  { key: "head", label: "Head" },
  { key: "frontArm", label: "Front Arm" },
  { key: "chest", label: "Chest" },
  { key: "backArm", label: "Back Arm" },
  { key: "abdomen", label: "Abdomen" },
  { key: "frontThigh", label: "Front Thigh" },
  { key: "frontFoot", label: "Front Foot" },
  { key: "backThigh", label: "Back Thigh" },
  { key: "backFoot", label: "Back Foot" },
];

export function getWorkbookCharacterSize(build: CharacterBuild | undefined): number | null {
  return build?.profile.rolledStats.siz ?? null;
}

function formatWorkbookLocationValueWithType(value: number | null, type: string | null | undefined): string {
  if (value === null || value === undefined) {
    return "—";
  }

  return `${Math.round(value)}${type?.trim() ?? ""}`;
}

export function calculateWorkbookArmorEncumbrance(input: {
  characterSize: number | null;
  item?: Pick<EquipmentItem, "quantity"> | null;
  template: Pick<ArmorTemplate, "baseEncumbrance" | "encumbranceFactor">;
}): number | null {
  if (input.characterSize === null || input.characterSize === undefined) {
    return null;
  }

  const encumbranceFactor = input.template.encumbranceFactor ?? input.template.baseEncumbrance;
  if (encumbranceFactor === null || encumbranceFactor === undefined) {
    return null;
  }

  return encumbranceFactor * (input.item?.quantity ?? 1) * input.characterSize;
}

export function buildCharacterArmorSummary(input: {
  characterSize: number | null;
  item?: Pick<EquipmentItem, "quantity"> | null;
  template: ArmorTemplate | null;
}): CharacterArmorSummary | null {
  if (!input.template) {
    return null;
  }

  const locations = ARMOR_LOCATIONS.map(({ key, label }) => {
    const value = input.template?.locationValues?.[key] ?? null;
    const type = input.template?.locationTypes?.[key] ?? null;

    return {
      key,
      label,
      type,
      value,
      valueWithType: formatWorkbookLocationValueWithType(value, type),
    };
  });

  const generalArmorRounded =
    input.template.generalArmorRounded ??
    (input.template.armorRating === null || input.template.armorRating === undefined
      ? null
      : Math.round(input.template.armorRating));

  return {
    aaModifier: input.template.armorActivityModifier ?? null,
    actualEncumbrance: calculateWorkbookArmorEncumbrance({
      characterSize: input.characterSize,
      item: input.item,
      template: input.template,
    }),
    encumbranceFactor: input.template.encumbranceFactor ?? input.template.baseEncumbrance ?? null,
    generalArmor: input.template.armorRating ?? null,
    generalArmorRounded,
    generalArmorWithType: formatWorkbookLocationValueWithType(
      generalArmorRounded,
      input.template.locationTypes?.generalArmor,
    ),
    locations,
    perceptionModifier: input.template.perceptionModifier ?? null,
  };
}
