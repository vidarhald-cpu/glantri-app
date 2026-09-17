import {
  defaultCanonicalContent,
  equipmentTemplatesById,
  kickTemplate,
  punchTemplate,
} from "@glantri/content";
import {
  AnyEquipmentTemplateSchema,
  EquipmentItemSchema,
  resolveEffectiveItemTemplate,
  characterBuildSchema,
  type CombatRoundAttackOpportunity,
  type CombatRoundPhase,
  type CombatRoundState,
  type ScenarioParticipant,
  type WeaponTemplate,
} from "@glantri/domain";
import {
  buildCharacterSheetSummary,
  buildCombatStateCharacterInputs,
  getDerivedInitiativeValue,
} from "@glantri/rules-engine";

import { resolveCanonicalParticipantCalculationContext } from "./combatParticipantCalculationResolution";

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
  const baseTemplate =
    parsedTemplate.success && parsedTemplate.data.category === "weapon"
      ? (parsedTemplate.data as WeaponTemplate)
      : undefined;
  const sourceItemId = opportunity?.weaponInstanceId ?? opportunity?.weaponSourceId;
  const rawItems = isRecord(state?.itemsById) ? state.itemsById : {};
  const sourceItem = EquipmentItemSchema.safeParse(
    sourceItemId ? rawItems[sourceItemId] : undefined,
  );
  const effective =
    baseTemplate && sourceItem.success
      ? resolveEffectiveItemTemplate(sourceItem.data, { [baseTemplate.id]: baseTemplate })
      : baseTemplate;
  const template = effective?.category === "weapon" ? effective : undefined;
  if (!template) missingFacts.add("initiative_weapon_template");

  if (missingFacts.size > 0 || !template) {
    return { completeness: "partial", missingFacts: [...missingFacts].sort() };
  }
  const initiative = getDerivedInitiativeValue({
    attackMode: template.attackModes?.find((mode) => mode.id === opportunity?.attackModeId),
    characterInputs,
    template,
    treatAsThrownUse: opportunity?.weaponSourceSlot === "throwing",
  });
  if (typeof initiative !== "number" || !Number.isInteger(initiative)) {
    return { completeness: "partial", missingFacts: ["initiative_calculation"] };
  }
  return { completeness: "complete", initiativeBase: initiative };
}

/** Selects the one exact declared phase opportunity before deriving its initiative base. */
export function resolveCanonicalCombatInitiativeBaseForTask(input: {
  encounterParticipantId: string;
  participant: ScenarioParticipant;
  phase: CombatRoundPhase;
  state: CombatRoundState;
}): CanonicalCombatInitiativeBaseResolution {
  const roundParticipant = input.state.participants.find(
    (participant) => participant.participantId === input.encounterParticipantId,
  );
  const opportunities = (roundParticipant?.declaration?.attackOpportunities ?? []).filter(
    (opportunity) => opportunity.phase === input.phase && opportunity.status === "committed",
  );
  if (opportunities.length > 1) {
    return { completeness: "partial", missingFacts: ["initiative_opportunity"] };
  }
  if (opportunities.length === 1) {
    const opportunity = opportunities[0];
    if (opportunity.weaponSourceSlot !== "virtual") {
      const context = resolveCanonicalParticipantCalculationContext(input.participant);
      const sourceItemId = opportunity.weaponInstanceId ?? opportunity.weaponSourceId;
      const sourceItem =
        context.completeness === "complete" && sourceItemId
          ? context.itemsById.get(sourceItemId)
          : undefined;
      if (
        context.completeness !== "complete" ||
        !sourceItem ||
        sourceItem.templateId !== opportunity.weaponTemplateId
      ) {
        return { completeness: "partial", missingFacts: ["initiative_weapon_source"] };
      }
    }
    return resolveCanonicalCombatInitiativeBase({
      opportunity,
      participant: input.participant,
    });
  }
  const context = resolveCanonicalParticipantCalculationContext(input.participant);
  if (context.completeness !== "complete" || !context.primaryWeaponTemplate) {
    return {
      completeness: "partial",
      missingFacts:
        context.completeness === "complete"
          ? ["initiative_weapon"]
          : [...context.missingFacts, "initiative_opportunity"].sort(),
    };
  }
  const initiativeBase = getDerivedInitiativeValue({
    characterInputs: context.characterInputs,
    template: context.primaryWeaponTemplate,
  });
  return typeof initiativeBase === "number" && Number.isInteger(initiativeBase)
    ? { completeness: "complete", initiativeBase }
    : { completeness: "partial", missingFacts: ["initiative_calculation"] };
}
