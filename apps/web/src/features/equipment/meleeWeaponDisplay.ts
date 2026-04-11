import type {
  EquipmentItem,
  MaterialType,
  QualityType,
  WeaponAttackMode,
  WeaponTemplate
} from "@glantri/domain";
import { getEffectiveEncumbrance } from "@glantri/domain/equipment";

export type CanonicalMeleeModeSlot = "slash" | "strike" | "thrust";

export interface CanonicalMeleeModeDisplay {
  armorModifier: string;
  crit: string;
  dmb: string;
  ob: string;
}

export function formatOptionalDisplayValue(value: number | string | null | undefined): string {
  return value === null || value === undefined || value === "" ? "—" : String(value);
}

export function formatWeaponModeDmb(mode: WeaponAttackMode): string {
  if (mode.dmb !== null && mode.dmb !== undefined) {
    return String(mode.dmb);
  }

  if (mode.dmbFormula) {
    return mode.dmbFormula.raw;
  }

  return "—";
}

export function getCanonicalMeleeModeSlot(
  label: string | null | undefined
): CanonicalMeleeModeSlot | null {
  switch (label?.trim().toLowerCase()) {
    case "slash":
      return "slash";
    case "strike":
      return "strike";
    case "thrust":
      return "thrust";
    default:
      return null;
  }
}

function getEmptyMeleeModeDisplay(): CanonicalMeleeModeDisplay {
  return {
    armorModifier: "—",
    crit: "—",
    dmb: "—",
    ob: "—"
  };
}

export function getCanonicalMeleeModeDisplay(
  attackModes: WeaponAttackMode[] | null | undefined
): Record<CanonicalMeleeModeSlot, CanonicalMeleeModeDisplay> {
  const result: Record<CanonicalMeleeModeSlot, CanonicalMeleeModeDisplay> = {
    slash: getEmptyMeleeModeDisplay(),
    strike: getEmptyMeleeModeDisplay(),
    thrust: getEmptyMeleeModeDisplay()
  };

  for (const mode of attackModes ?? []) {
    const slot = getCanonicalMeleeModeSlot(mode.label);
    if (!slot) {
      continue;
    }

    result[slot] = {
      armorModifier: formatOptionalDisplayValue(mode.armorModifier),
      crit: formatOptionalDisplayValue(mode.crit),
      dmb: formatWeaponModeDmb(mode),
      ob: formatOptionalDisplayValue(mode.ob)
    };
  }

  return result;
}

export function formatNonMeleeModes(
  attackModes: WeaponAttackMode[] | null | undefined
): string {
  const otherModes = (attackModes ?? []).filter(
    (mode) => getCanonicalMeleeModeSlot(mode.label) === null
  );

  if (otherModes.length === 0) {
    return "—";
  }

  return otherModes
    .map((mode) => {
      const parts = [
        mode.label ?? mode.id,
        mode.ob !== null && mode.ob !== undefined ? `OB ${mode.ob}` : null,
        formatWeaponModeDmb(mode) !== "—" ? `DMB ${formatWeaponModeDmb(mode)}` : null,
        mode.crit ? `Crit ${mode.crit}` : null,
        mode.armorModifier ? `Armor ${mode.armorModifier}` : null
      ].filter(Boolean);

      return parts.join(" | ");
    })
    .join("; ");
}

export function isMeleeWeaponTemplate(template: WeaponTemplate): boolean {
  if (template.handlingClass === "missile" || template.handlingClass === "thrown") {
    return false;
  }

  return (template.attackModes ?? []).some((mode) => getCanonicalMeleeModeSlot(mode.label) !== null);
}

export function getTemplateEncumbranceForDisplay(input: {
  material: MaterialType;
  quality: QualityType;
  template: WeaponTemplate;
}): number {
  const syntheticItem: EquipmentItem = {
    category: "weapon",
    characterId: "admin-catalog",
    conditionState: "intact",
    id: `admin-preview-${input.template.id}`,
    isStackable: false,
    material: input.material,
    quality: input.quality,
    quantity: 1,
    specificityType: input.template.specificityTypeDefault,
    storageAssignment: {
      carryMode: "equipped",
      locationId: "admin-preview"
    },
    templateId: input.template.id
  };

  return getEffectiveEncumbrance(syntheticItem, input.template);
}
