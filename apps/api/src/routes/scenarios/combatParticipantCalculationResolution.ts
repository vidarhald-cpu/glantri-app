import {
  defaultCanonicalContent,
  equipmentTemplatesById,
  kickTemplate,
  punchTemplate,
} from "@glantri/content";
import {
  AnyEquipmentTemplateSchema,
  CharacterLoadoutSchema,
  EquipmentItemSchema,
  StorageLocationSchema,
  characterBuildSchema,
  type ArmorTemplate,
  type CharacterLoadout,
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
  type CombatStateCharacterInputs,
} from "@glantri/rules-engine";

export interface CompleteCanonicalParticipantCalculationContext {
  armorTemplate: ArmorTemplate | null;
  authority: "canonical_scenario_state";
  characterId: string;
  characterInputs: CombatStateCharacterInputs;
  completeness: "complete";
  equipmentLoadoutRevision?: string;
  equipmentState: Record<string, unknown>;
  itemsById: ReadonlyMap<string, EquipmentItem>;
  loadout?: CharacterLoadout;
  locations: StorageLocation[];
  locationsComplete: boolean;
  participantId: string;
  primaryWeaponTemplate: WeaponTemplate | null;
  readyShieldTemplate: ShieldTemplate | null;
  secondaryWeaponTemplate: WeaponTemplate | null;
  sourceSnapshotId: string;
  templateValues: Readonly<Record<string, unknown>>;
  templatesById: ReadonlyMap<string, EquipmentTemplate>;
}

export interface IncompleteCanonicalParticipantCalculationContext {
  authority: "canonical_scenario_state";
  completeness: "partial";
  missingFacts: string[];
  participantId: string;
  sourceSnapshotId: string;
}

export type CanonicalParticipantCalculationContext =
  | CompleteCanonicalParticipantCalculationContext
  | IncompleteCanonicalParticipantCalculationContext;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
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
 * Parses the bounded canonical build/loadout snapshot shared by live server combat resolvers.
 * It deliberately returns calculation inputs, never a web presentation summary.
 */
export function resolveCanonicalParticipantCalculationContext(
  participant: ScenarioParticipant,
): CanonicalParticipantCalculationContext {
  const sourceSnapshotId = `scenario-participant:${participant.id}:snapshot:${
    participant.snapshot.sourceUpdatedAt ?? participant.updatedAt ?? "unversioned"
  }`;
  const missingFacts = new Set<string>();
  const build = characterBuildSchema.safeParse(participant.snapshot.build);
  if (!build.success) missingFacts.add("character_build");
  const characterInputs = build.success
    ? buildCombatStateCharacterInputs(
        buildCharacterSheetSummary({ build: build.data, content: defaultCanonicalContent }),
      )
    : undefined;
  const snapshot = isRecord(participant.snapshot) ? participant.snapshot : undefined;
  const state = isRecord(snapshot?.["equipmentState"])
    ? (snapshot["equipmentState"] as Record<string, unknown>)
    : undefined;
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
  const nested = isRecord(state?.["templates"])
    ? (state?.["templates"] as Record<string, unknown>)
    : undefined;
  const snapshotTemplates = isRecord(nested?.["templatesById"])
    ? (nested?.["templatesById"] as Record<string, unknown>)
    : isRecord(state?.["templatesById"])
      ? (state?.["templatesById"] as Record<string, unknown>)
      : {};
  const templateValues = {
    ...equipmentTemplatesById,
    ...snapshotTemplates,
    [kickTemplate.id]: kickTemplate,
    [punchTemplate.id]: punchTemplate,
  };
  const parsedItems = parseRecordValues<EquipmentItem>({
    parse: (value) => EquipmentItemSchema.safeParse(value),
    values: itemsValue,
  });
  const parsedLocations = parseRecordValues<StorageLocation>({
    parse: (value) => StorageLocationSchema.safeParse(value),
    values: locationsValue,
  });
  const requiredTemplateIds = new Set(parsedItems.values.map((item) => item.templateId));
  const requiredTemplateValues = Object.fromEntries(
    [...requiredTemplateIds].flatMap((templateId) =>
      templateValues[templateId] === undefined ? [] : [[templateId, templateValues[templateId]]],
    ),
  );
  const parsedTemplates = parseRecordValues<EquipmentTemplate>({
    parse: (value) => AnyEquipmentTemplateSchema.safeParse(value),
    values: requiredTemplateValues,
  });
  if (!parsedItems.complete) missingFacts.add("equipment_items");
  if (
    !parsedTemplates.complete ||
    Object.keys(requiredTemplateValues).length !== requiredTemplateIds.size
  ) {
    missingFacts.add("equipment_templates");
  }
  const characterId =
    participant.characterId ??
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
  const armor = getItemTemplate({
    itemId: loadout?.wornArmorItemId,
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
  if (armor === undefined || (armor && armor.category !== "armor")) {
    missingFacts.add("worn_armor");
  }
  if (!characterInputs || !characterId || !state || missingFacts.size > 0) {
    return {
      authority: "canonical_scenario_state",
      completeness: "partial",
      missingFacts: [...missingFacts].sort(),
      participantId: participant.id,
      sourceSnapshotId,
    };
  }

  return {
    armorTemplate: armor as ArmorTemplate | null,
    authority: "canonical_scenario_state",
    characterId,
    characterInputs,
    completeness: "complete",
    equipmentLoadoutRevision: participant.updatedAt,
    equipmentState: state,
    itemsById: itemMap,
    loadout,
    locations: parsedLocations.values,
    locationsComplete: parsedLocations.complete,
    participantId: participant.id,
    primaryWeaponTemplate: primary as WeaponTemplate | null,
    readyShieldTemplate: shield as ShieldTemplate | null,
    secondaryWeaponTemplate: secondary as WeaponTemplate | null,
    sourceSnapshotId,
    templateValues,
    templatesById: templateMap,
  };
}
