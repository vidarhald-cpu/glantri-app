import { defaultCanonicalContent, equipmentTemplatesById } from "@glantri/content";
import {
  AnyEquipmentTemplateSchema,
  CharacterLoadoutSchema,
  EquipmentItemSchema,
  StorageLocationSchema,
  characterBuildSchema,
  type CombatModifierResolution,
  type EquipmentItem,
  type EquipmentTemplate,
  type ScenarioParticipant,
  type ShieldTemplate,
  type StorageLocation,
  type WeaponTemplate,
} from "@glantri/domain";
import {
  buildCharacterSheetSummary,
  buildCombatStateCharacterInputs,
  resolveCombatDefenseCalculation,
  resolveCombatMovementBurden,
  type CompleteCombatDefenseCalculation,
} from "@glantri/rules-engine";

export interface CanonicalScenarioParticipantDefenseCalculation
  extends CompleteCombatDefenseCalculation {
  authority: "canonical_scenario_state";
  equipmentLoadoutRevision?: string;
  participantId: string;
  sourceSnapshotId: string;
}

export interface IncompleteScenarioParticipantDefenseCalculation {
  authority: "canonical_scenario_state";
  completeness: "partial";
  missingFacts: string[];
  participantId: string;
  sourceSnapshotId: string;
}

export type ScenarioParticipantDefenseCalculation =
  | CanonicalScenarioParticipantDefenseCalculation
  | IncompleteScenarioParticipantDefenseCalculation;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function equipmentState(participant: ScenarioParticipant): Record<string, unknown> | undefined {
  const snapshot = isRecord(participant.snapshot) ? participant.snapshot : undefined;
  return isRecord(snapshot?.["equipmentState"])
    ? (snapshot["equipmentState"] as Record<string, unknown>)
    : undefined;
}

function templatesById(state: Record<string, unknown> | undefined): Record<string, unknown> {
  const nested = isRecord(state?.["templates"]) ? state?.["templates"] : undefined;
  const snapshotTemplates = isRecord(nested?.["templatesById"])
    ? nested?.["templatesById"]
    : isRecord(state?.["templatesById"])
      ? state?.["templatesById"]
      : {};
  return { ...equipmentTemplatesById, ...snapshotTemplates };
}

function parseRecordValues<T>(input: {
  parse: (value: unknown) => { data?: T; success: boolean };
  values: Record<string, unknown> | undefined;
}): { complete: boolean; values: T[] } {
  if (!input.values) return { complete: false, values: [] };
  const parsed = Object.values(input.values).map(input.parse);
  return {
    complete: parsed.every((result) => result.success),
    values: parsed.flatMap((result) => (result.success && result.data ? [result.data] : [])),
  };
}

function getItemTemplate(input: {
  itemId?: string | null;
  itemsById: ReadonlyMap<string, EquipmentItem>;
  templatesById: ReadonlyMap<string, EquipmentTemplate>;
}): EquipmentTemplate | null | undefined {
  if (!input.itemId) return null;
  const item = input.itemsById.get(input.itemId);
  return item ? input.templatesById.get(item.templateId) : undefined;
}

/**
 * Resolves private defender DB/DM inputs from one bounded scenario participant snapshot. This is
 * a live server calculation adapter, not a presentation snapshot and not a persisted baseline.
 */
export function resolveCanonicalScenarioParticipantDefense(input: {
  defenderResolution: CombatModifierResolution;
  flatDbResolution?: CombatModifierResolution;
  participant: ScenarioParticipant;
}): ScenarioParticipantDefenseCalculation {
  const sourceSnapshotId = `scenario-participant:${input.participant.id}:snapshot:${
    input.participant.snapshot.sourceUpdatedAt ?? input.participant.updatedAt ?? "unversioned"
  }`;
  const missingFacts = new Set<string>();
  const build = characterBuildSchema.safeParse(input.participant.snapshot.build);
  if (!build.success) missingFacts.add("character_build");
  const characterInputs = build.success
    ? buildCombatStateCharacterInputs(
        buildCharacterSheetSummary({ build: build.data, content: defaultCanonicalContent }),
      )
    : undefined;
  const state = equipmentState(input.participant);
  if (!state) missingFacts.add("equipment_state");
  const itemsValue = isRecord(state?.["itemsById"])
    ? (state?.["itemsById"] as Record<string, unknown>)
    : undefined;
  const locationsValue = isRecord(state?.["locationsById"])
    ? (state?.["locationsById"] as Record<string, unknown>)
    : undefined;
  const loadoutsValue = isRecord(state?.["activeLoadoutByCharacterId"])
    ? (state?.["activeLoadoutByCharacterId"] as Record<string, unknown>)
    : undefined;
  const parsedItems = parseRecordValues<EquipmentItem>({
    parse: (value) => EquipmentItemSchema.safeParse(value),
    values: itemsValue,
  });
  const parsedLocations = parseRecordValues<StorageLocation>({
    parse: (value) => StorageLocationSchema.safeParse(value),
    values: locationsValue,
  });
  const templateValues = templatesById(state);
  const requiredTemplateIds = new Set(parsedItems.values.map((item) => item.templateId));
  const requiredTemplateValues = Object.fromEntries(
    [...requiredTemplateIds].flatMap((templateId) =>
      templateValues[templateId] === undefined
        ? []
        : [[templateId, templateValues[templateId]]],
    ),
  );
  const parsedTemplates = parseRecordValues<EquipmentTemplate>({
    parse: (value) => AnyEquipmentTemplateSchema.safeParse(value),
    values: requiredTemplateValues,
  });
  if (!parsedItems.complete) missingFacts.add("equipment_items");
  if (!parsedLocations.complete) missingFacts.add("storage_locations");
  if (
    !parsedTemplates.complete ||
    Object.keys(requiredTemplateValues).length !== requiredTemplateIds.size
  ) {
    missingFacts.add("equipment_templates");
  }
  const characterId =
    input.participant.characterId ??
    (loadoutsValue ? Object.keys(loadoutsValue).find((id) => id.trim().length > 0) : undefined);
  if (!characterId) missingFacts.add("character_id");
  const loadoutValue = characterId ? loadoutsValue?.[characterId] : undefined;
  const parsedLoadout =
    loadoutValue === undefined ? undefined : CharacterLoadoutSchema.safeParse(loadoutValue);
  if (parsedLoadout && !parsedLoadout.success) missingFacts.add("active_loadout");
  const loadout = parsedLoadout?.success ? parsedLoadout.data : undefined;
  const itemMap = new Map(parsedItems.values.map((item) => [item.id, item] as const));
  const templateMap = new Map(
    parsedTemplates.values.map((template) => [template.id, template] as const),
  );
  const primary = getItemTemplate({
    itemId: loadout?.activePrimaryWeaponItemId,
    itemsById: itemMap,
    templatesById: templateMap,
  });
  const secondary = getItemTemplate({
    itemId: loadout?.activeSecondaryWeaponItemId,
    itemsById: itemMap,
    templatesById: templateMap,
  });
  const shield = getItemTemplate({
    itemId: loadout?.readyShieldItemId,
    itemsById: itemMap,
    templatesById: templateMap,
  });
  if (primary === undefined || (primary && primary.category !== "weapon")) {
    missingFacts.add("primary_weapon");
  }
  if (secondary === undefined || (secondary && secondary.category !== "weapon")) {
    missingFacts.add("secondary_weapon");
  }
  if (shield === undefined || (shield && shield.category !== "shield")) {
    missingFacts.add("ready_shield");
  }
  const locationsById = Object.fromEntries(
    parsedLocations.values.map((location) => [location.id, location] as const),
  );
  const movement = resolveCombatMovementBurden({
    characterId,
    characteristics: characterInputs
      ? {
          constitution: characterInputs.constitution,
          size: characterInputs.size,
          strength: characterInputs.strength,
        }
      : undefined,
    equipmentLoadoutRevision: input.participant.updatedAt,
    equipmentState:
      state && parsedItems.complete && parsedLocations.complete && parsedTemplates.complete
        ? {
            activeLoadout: loadout,
            items: parsedItems.values,
            locationsById,
            templatesById: Object.fromEntries(templateMap),
          }
        : undefined,
    participantId: input.participant.id,
    sourceSnapshotId,
  });
  if (movement.completeness !== "complete") {
    for (const fact of movement.missingFacts) missingFacts.add(`movement:${fact}`);
  }
  if (missingFacts.size > 0 || movement.completeness !== "complete") {
    return {
      authority: "canonical_scenario_state",
      completeness: "partial",
      missingFacts: [...missingFacts].sort(),
      participantId: input.participant.id,
      sourceSnapshotId,
    };
  }

  const calculation = resolveCombatDefenseCalculation({
    characterInputs,
    dynamicRawModifiers: input.defenderResolution.rows.map((row) => ({
      label: row.label,
      value: row.value,
    })),
    encumbranceLevel: movement.encumbranceLevel,
    flatDbAdjustment: input.flatDbResolution?.total ?? 0,
    primaryWeaponTemplate: primary as WeaponTemplate | null,
    readyShieldTemplate: shield as ShieldTemplate | null,
    secondaryWeaponTemplate: secondary as WeaponTemplate | null,
  });
  if (calculation.completeness !== "complete") {
    return {
      authority: "canonical_scenario_state",
      completeness: "partial",
      missingFacts: calculation.missingFacts,
      participantId: input.participant.id,
      sourceSnapshotId,
    };
  }

  return {
    ...calculation,
    authority: "canonical_scenario_state",
    equipmentLoadoutRevision: input.participant.updatedAt,
    participantId: input.participant.id,
    sourceSnapshotId,
  };
}
