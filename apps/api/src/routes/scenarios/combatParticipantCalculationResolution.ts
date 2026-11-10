import {
  defaultCanonicalContent,
  equipmentTemplatesById,
  kickTemplate,
  punchTemplate,
} from "@glantri/content";
import {
  AnyEquipmentTemplateSchema,
  resolveEffectiveItemTemplate,
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

/**
 * Which equipment provenance a resolved calculation context was built from (#694).
 *
 * `character_equipment_aggregate` is the only provenance the scenario equipment projection has:
 * `scenarioParticipantSnapshotSchema` types it `source: z.literal("character_equipment_aggregate")`
 * and #666 settled that deliberately, so the projection exists only for a participant that has a
 * Character. `absent` is the other legitimate state — a Template-derived temporary actor has no
 * Character, therefore no Character equipment aggregate, and by that schema never can have one.
 * The absence is recorded as absence; nothing is substituted, defaulted or synthesised for it.
 */
export type CanonicalParticipantEquipmentProvenance = "absent" | "character_equipment_aggregate";

export interface CompleteCanonicalParticipantCalculationContext {
  armorTemplate: ArmorTemplate | null;
  authority: "canonical_scenario_state";
  /**
   * The Character whose equipment aggregate this context was resolved from, or `null` when
   * `equipmentProvenance` is `absent`. Never a synthesised identifier.
   */
  characterId: string | null;
  characterInputs: CombatStateCharacterInputs;
  completeness: "complete";
  equipmentLoadoutRevision?: string;
  equipmentProvenance: CanonicalParticipantEquipmentProvenance;
  /** The Character-sourced aggregate, or `null` when `equipmentProvenance` is `absent`. */
  equipmentState: Record<string, unknown> | null;
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
  return item
    ? resolveEffectiveItemTemplate(item, Object.fromEntries(input.templatesById))
    : undefined;
}

/**
 * #1103. Items of a participant without a Character (for example a generated NPC) have no
 * persistent Item record, so nothing supplies the `revision` that persistent Item authority writes
 * for Character Items. For such a participant, an Item without a `revision` is read with the
 * participant snapshot's own version (`snapshot.sourceUpdatedAt`, else `createdAt`) as an ISO
 * datetime. That value is stable for the fielded snapshot, so a defence snapshot committed from
 * this context and its later verification read the same revision. Character participants are not
 * touched: their Items keep failing closed on a missing revision.
 */
function withNonCharacterItemRevisions(
  participant: ScenarioParticipant,
  itemsValue: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!itemsValue || participant.characterId) return itemsValue;
  const derivedRevision = [participant.snapshot.sourceUpdatedAt, participant.createdAt]
    .filter((value): value is string => typeof value === "string")
    .map((value) => Date.parse(value))
    .find((time) => Number.isFinite(time));
  if (derivedRevision === undefined) return itemsValue;
  const revision = new Date(derivedRevision).toISOString();
  return Object.fromEntries(
    Object.entries(itemsValue).map(([itemId, item]) => [
      itemId,
      isRecord(item) && (item["revision"] === undefined || item["revision"] === null)
        ? { ...item, revision }
        : item,
    ]),
  );
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
  // #694. A Template-derived temporary actor carries neither a Character nor a Character-sourced
  // equipment aggregate, and by `scenarioParticipantSnapshotSchema`'s provenance literal it never
  // can. For such a participant those two are not facts this resolver is missing — they are facts
  // that do not exist, and the aggregate is recorded as absent. Reachability is deliberately the
  // exact complement of every context that could previously resolve `complete`: that required both
  // a `characterId` and an `equipmentState` record, so a participant carrying neither could only
  // ever resolve `partial`. A Character participant whose aggregate is missing or stale still has
  // one, so it keeps failing closed on `equipment_state` exactly as before.
  const equipmentProvenance: CanonicalParticipantEquipmentProvenance =
    !participant.characterId && !state ? "absent" : "character_equipment_aggregate";
  const equipmentAggregateAbsent = equipmentProvenance === "absent";
  if (!state && !equipmentAggregateAbsent) missingFacts.add("equipment_state");
  // An absent aggregate contributes an empty, complete set of Items: there are none, which is a
  // different statement from "the Item set could not be read". No Item, template or loadout value
  // is invented for it, so every equipment-derived slot below resolves to `null` on its own.
  const itemsValue = isRecord(state?.["itemsById"])
    ? (state?.["itemsById"] as Record<string, unknown>)
    : equipmentAggregateAbsent
      ? {}
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
    values: withNonCharacterItemRevisions(participant, itemsValue),
  });
  const parsedLocations = parseRecordValues<StorageLocation>({
    parse: (value) => StorageLocationSchema.safeParse(value),
    values: locationsValue,
  });
  const requiredTemplateIds = new Set(
    parsedItems.values.flatMap((item) => (item.templateId === null ? [] : [item.templateId])),
  );
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
  // A participant with an aggregate must name the Character it belongs to. A participant with no
  // aggregate has no Character to name, so the identifier is absent rather than missing.
  if (!characterId && !equipmentAggregateAbsent) missingFacts.add("character_id");
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
  // The build is load-bearing for every calculation this context feeds, so a participant without
  // one is still refused. The Character identifier and the aggregate are load-bearing only where
  // an aggregate exists to be read; when it is absent they are not required, because nothing
  // below reads them. The remaining `missingFacts` all describe equipment that is present but
  // unreadable, which stays a refusal for every participant shape.
  if (
    !characterInputs ||
    (!equipmentAggregateAbsent && (!characterId || !state)) ||
    missingFacts.size > 0
  ) {
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
    characterId: characterId ?? null,
    characterInputs,
    completeness: "complete",
    equipmentLoadoutRevision: participant.updatedAt,
    equipmentProvenance,
    equipmentState: state ?? null,
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
