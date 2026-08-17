import {
  EquipmentItemFactsV1Schema,
  type CanonicalEquipmentItem,
  type DescriptiveItemTraitCategory,
  type EquipmentTemplate,
  type ItemFactProvenance,
  type ItemFactVisibility,
} from "@glantri/domain";

export interface ProjectedWeaponInitiative {
  characteristic: "weapon_initiative";
  effectiveValue: number;
  provenance: ItemFactProvenance & {
    origin: "item_override" | "template";
  };
  scope: "all_attack_modes";
  templateValue: number;
  unit: "initiative_points";
  visibility: ItemFactVisibility;
}

export interface ProjectedFinalAttackObContribution {
  calculationStage: "final_attack_ob";
  kind: "final_attack_ob_delta";
  provenance: ItemFactProvenance;
  scope: "all_attack_modes";
  unit: "ob_points";
  value: number;
  visibility: ItemFactVisibility;
}

export interface ProjectedDescriptiveItemTrait {
  category: DescriptiveItemTraitCategory;
  provenance: ItemFactProvenance;
  supportState: "descriptive_only";
  text: string;
  visibility: ItemFactVisibility;
}

export interface ProjectedUnsupportedItemCapability {
  name: string;
  provenance: ItemFactProvenance;
  rulesText: string;
  supportState: "not_calculated_by_app";
  usageText: string | null;
  visibility: ItemFactVisibility;
}

export interface EquipmentItemProjectionV1 {
  activeContributions: ProjectedFinalAttackObContribution[];
  descriptiveTraits: ProjectedDescriptiveItemTrait[];
  itemId: string;
  schemaVersion: 1;
  templateCharacteristics: ProjectedWeaponInitiative[];
  templateId: string;
  unsupportedCapabilities: ProjectedUnsupportedItemCapability[];
}

function compareFactId(
  left: { provenance: ItemFactProvenance },
  right: { provenance: ItemFactProvenance },
): number {
  return left.provenance.factId.localeCompare(right.provenance.factId);
}

export function projectEquipmentItem(
  item: CanonicalEquipmentItem,
  template: EquipmentTemplate,
): EquipmentItemProjectionV1 {
  if (item.templateId !== template.id) {
    throw new Error("Item template does not match the requested projection template.");
  }

  const facts = EquipmentItemFactsV1Schema.parse(item.itemFacts);
  const initiativeOverride = facts.templateOverrides.find(
    (override) => override.kind === "weapon_initiative_override",
  );

  if (initiativeOverride && (item.category !== "weapon" || template.category !== "weapon")) {
    throw new Error("weapon_initiative_override requires a weapon item and template.");
  }

  if (
    initiativeOverride &&
    (template.category !== "weapon" || typeof template.initiative !== "number")
  ) {
    throw new Error("weapon_initiative_override requires a numeric template initiative.");
  }

  const templateCharacteristics: ProjectedWeaponInitiative[] = [];
  if (template.category === "weapon" && typeof template.initiative === "number") {
    templateCharacteristics.push({
      characteristic: "weapon_initiative",
      effectiveValue: initiativeOverride?.value ?? template.initiative,
      provenance: {
        factId: initiativeOverride?.id ?? "template:weapon_initiative",
        itemId: item.id,
        origin: initiativeOverride ? "item_override" : "template",
      },
      scope: "all_attack_modes",
      templateValue: template.initiative,
      unit: "initiative_points",
      visibility: initiativeOverride?.visibility ?? "revealed",
    });
  }

  return {
    activeContributions: facts.activeMechanics
      .map((fact) => ({
        calculationStage: fact.calculationStage,
        kind: fact.kind,
        provenance: { factId: fact.id, itemId: item.id },
        scope: fact.scope,
        unit: fact.unit,
        value: fact.value,
        visibility: fact.visibility,
      }))
      .sort(compareFactId),
    descriptiveTraits: facts.descriptiveTraits
      .map((fact) => ({
        category: fact.category,
        provenance: { factId: fact.id, itemId: item.id },
        supportState: "descriptive_only" as const,
        text: fact.text,
        visibility: fact.visibility,
      }))
      .sort(compareFactId),
    itemId: item.id,
    schemaVersion: 1,
    templateCharacteristics,
    templateId: template.id,
    unsupportedCapabilities: facts.unsupportedCapabilities
      .map((fact) => ({
        name: fact.name,
        provenance: { factId: fact.id, itemId: item.id },
        rulesText: fact.rulesText,
        supportState: "not_calculated_by_app" as const,
        usageText: fact.usageText ?? null,
        visibility: fact.visibility,
      }))
      .sort(compareFactId),
  };
}
