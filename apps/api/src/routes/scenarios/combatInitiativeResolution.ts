import {
  defaultCanonicalContent,
  equipmentTemplatesById,
  kickTemplate,
  punchTemplate,
} from "@glantri/content";
import {
  AnyEquipmentTemplateSchema,
  characterBuildSchema,
  type CombatRoundAttackOpportunity,
  type ScenarioParticipant,
  type WeaponTemplate,
} from "@glantri/domain";
import {
  buildCharacterSheetSummary,
  buildCombatStateCharacterInputs,
  getDerivedInitiativeValue,
} from "@glantri/rules-engine";

export type CanonicalCombatInitiativeBaseResolution =
  | { completeness: "complete"; initiativeBase: number }
  | { completeness: "partial"; missingFacts: string[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/** Resolves the declared phase weapon and workbook initiative base from server-owned facts. */
export function resolveCanonicalCombatInitiativeBase(input: {
  opportunity?: CombatRoundAttackOpportunity;
  participant: ScenarioParticipant;
}): CanonicalCombatInitiativeBaseResolution {
  const missingFacts = new Set<string>();
  const build = characterBuildSchema.safeParse(input.participant.snapshot.build);
  if (!build.success) missingFacts.add("character_build");
  const characterInputs = build.success
    ? buildCombatStateCharacterInputs(
        buildCharacterSheetSummary({ build: build.data, content: defaultCanonicalContent }),
      )
    : undefined;
  const opportunity = input.opportunity;
  if (!opportunity?.weaponTemplateId) missingFacts.add("initiative_weapon");

  const equipmentState = isRecord(input.participant.snapshot)
    ? input.participant.snapshot["equipmentState"]
    : undefined;
  const state = isRecord(equipmentState) ? equipmentState : undefined;
  const nestedTemplates = isRecord(state?.["templates"]) ? state["templates"] : undefined;
  const snapshotTemplates = isRecord(nestedTemplates?.["templatesById"])
    ? nestedTemplates["templatesById"]
    : isRecord(state?.["templatesById"])
      ? state["templatesById"]
      : {};
  const templateValue = opportunity?.weaponTemplateId
    ? (
        {
          ...equipmentTemplatesById,
          ...snapshotTemplates,
          [punchTemplate.id]: punchTemplate,
          [kickTemplate.id]: kickTemplate,
        } as Record<string, unknown>
      )[opportunity.weaponTemplateId]
    : undefined;
  const parsedTemplate = AnyEquipmentTemplateSchema.safeParse(templateValue);
  const template =
    parsedTemplate.success && parsedTemplate.data.category === "weapon"
      ? (parsedTemplate.data as WeaponTemplate)
      : undefined;
  if (!template) missingFacts.add("initiative_weapon_template");

  if (missingFacts.size > 0 || !template) {
    return { completeness: "partial", missingFacts: [...missingFacts].sort() };
  }
  const initiative = getDerivedInitiativeValue({
    characterInputs,
    template,
    treatAsThrownUse: opportunity?.weaponSourceSlot === "throwing",
  });
  if (typeof initiative !== "number" || !Number.isInteger(initiative)) {
    return { completeness: "partial", missingFacts: ["initiative_calculation"] };
  }
  return { completeness: "complete", initiativeBase: initiative };
}
