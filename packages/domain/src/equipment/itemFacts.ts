import type { EquipmentItemFactsV1, EquipmentSpecialProperties } from "./types";

export function createEmptyEquipmentItemFacts(): EquipmentItemFactsV1 {
  return {
    activeMechanics: [],
    descriptiveTraits: [],
    templateOverrides: [],
    unsupportedCapabilities: [],
    version: 1,
  };
}

function cleanLegacyStrings(values: string[] | undefined): string[] {
  return (values ?? []).map((value) => value.trim()).filter(Boolean);
}

/**
 * Converts the former untyped bag without granting any legacy string active
 * mechanical meaning. IDs are deterministic so repeated parsing is stable.
 */
export function migrateLegacySpecialProperties(
  legacy: EquipmentSpecialProperties | null | undefined,
): EquipmentItemFactsV1 {
  if (!legacy) {
    return createEmptyEquipmentItemFacts();
  }

  const unsupportedGroups = [
    ["magic", "Legacy magic effect", cleanLegacyStrings(legacy.magicEffects)],
    ["damage", "Legacy damage effect", cleanLegacyStrings(legacy.damageEffects)],
    ["protective", "Legacy protective effect", cleanLegacyStrings(legacy.protectiveEffects)],
    ["utility", "Legacy utility effect", cleanLegacyStrings(legacy.utilityEffects)],
  ] as const;

  return {
    ...createEmptyEquipmentItemFacts(),
    descriptiveTraits: cleanLegacyStrings(legacy.roleplayTraits).map((text, index) => ({
      category: "other" as const,
      id: `legacy-roleplay-trait-${index + 1}`,
      text,
      visibility: "revealed" as const,
    })),
    unsupportedCapabilities: unsupportedGroups.flatMap(([key, name, values]) =>
      values.map((rulesText, index) => ({
        id: `legacy-${key}-capability-${index + 1}`,
        name,
        rulesText,
        usageText: null,
        visibility: "revealed" as const,
      })),
    ),
  };
}

export function revealableEquipmentItemFacts(facts: EquipmentItemFactsV1): EquipmentItemFactsV1 {
  return {
    activeMechanics: facts.activeMechanics.filter((fact) => fact.visibility === "revealed"),
    descriptiveTraits: facts.descriptiveTraits.filter((fact) => fact.visibility === "revealed"),
    templateOverrides: facts.templateOverrides.filter((fact) => fact.visibility === "revealed"),
    unsupportedCapabilities: facts.unsupportedCapabilities.filter(
      (fact) => fact.visibility === "revealed",
    ),
    version: 1,
  };
}
