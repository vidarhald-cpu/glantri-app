import type {
  CombatAttackSourceRef,
  CombatAttackSourceSlot,
  CombatRoundPhaseContexts,
  EncounterSession,
  ScenarioParticipantCombatContext,
  ScenarioParticipantParryDirection,
} from "@glantri/domain";
import {
  buildCombatAttackWeaponSourceId,
  getCombatDeclarationAttackPhases,
  resolveCombatDeclarationParticipantIdentity,
  resolveCombatFeintWeaponSkillDefinition,
  resolvePreferredAttackMode,
  scenarioParticipantCombatContextSchema,
  type SkillSpecialization,
} from "@glantri/domain";

import { kickTemplate, punchTemplate } from "@glantri/content/equipment";

import type { DerivedCombatAttackMode } from "@/features/equipment/combatStateDerivation";
import type { EquipmentLoadoutModuleModel } from "@/features/equipment/loadoutModule";
import type { EquipmentFeatureState } from "@/features/equipment/types";
import type { PlayerEncounterActionId } from "@/lib/campaigns/playerEncounter";

import type {
  PlayerCombatAttackStatsView,
  PlayerCombatDefenseStatsView,
  PlayerCombatPhaseCardView,
} from "./PlayerCombatPanels";

export type PlayerCombatPhaseKey = "phase1" | "phase2";

export function resolveCombatFeintWeaponSkill(input: {
  equipmentState?: EquipmentFeatureState | null;
  skills: readonly { id: string; name: string }[];
  specializations?: readonly SkillSpecialization[];
  sourceTemplateId?: string;
}): { id: string; label: string } | undefined {
  const template = input.sourceTemplateId
    ? input.equipmentState?.templates.templatesById[input.sourceTemplateId]
    : undefined;
  if (!template || (template.category !== "weapon" && template.category !== "shield")) {
    return undefined;
  }
  const skill = resolveCombatFeintWeaponSkillDefinition({
    skills: input.skills as Parameters<typeof resolveCombatFeintWeaponSkillDefinition>[0]["skills"],
    specializations: input.specializations,
    weaponSkill: template.weaponSkill,
  });
  return skill ? { id: skill.id, label: skill.name } : undefined;
}

export type CombatFeintDeclarationTargetResolution =
  | {
      ok: true;
      phaseContexts: CombatRoundPhaseContexts;
      targetParticipantId: string;
    }
  | { message: string; ok: false };

export function buildCanonicalCombatTargetOptions(input: {
  encounterParticipants: EncounterSession["participants"];
  options: readonly { displayName: string; id: string }[];
}): Array<{ displayName: string; id: string }> {
  const byId = new Map<string, { displayName: string; id: string }>();
  for (const option of input.options) {
    const participant = input.encounterParticipants.find(
      (candidate) =>
        candidate.id === option.id ||
        candidate.scenarioParticipantId === option.id ||
        candidate.characterId === option.id,
    );
    if (participant) {
      byId.set(participant.id, { displayName: option.displayName, id: participant.id });
    }
  }
  return [...byId.values()];
}

export function resolveCanonicalCombatTargetIdentity(input: {
  encounterParticipants: EncounterSession["participants"];
  fallbackParticipantIds?: readonly string[];
  targetParticipantId?: string;
}):
  | {
      encounterParticipantId: string;
      scenarioParticipantId: string;
    }
  | undefined {
  if (!input.targetParticipantId) return undefined;
  const participant = resolveCombatDeclarationParticipantIdentity({
    participantId: input.targetParticipantId,
    participants: input.encounterParticipants,
  })?.participant;
  if (!participant && input.fallbackParticipantIds?.includes(input.targetParticipantId)) {
    return {
      encounterParticipantId: input.targetParticipantId,
      scenarioParticipantId: input.targetParticipantId,
    };
  }
  return participant?.scenarioParticipantId
    ? {
        encounterParticipantId: participant.id,
        scenarioParticipantId: participant.scenarioParticipantId,
      }
    : undefined;
}

/**
 * Combat commands identify actors by encounter-participant id. Phase controls may
 * begin with a committed scenario-participant alias, so normalize the current
 * draft once at the request boundary and write the same target into both phases.
 */
export function resolveCombatFeintDeclarationRequestTarget(input: {
  encounterParticipants: EncounterSession["participants"];
  phaseContexts: CombatRoundPhaseContexts;
  fallbackParticipantIds?: readonly string[];
}): CombatFeintDeclarationTargetResolution {
  const phase1Target = input.phaseContexts.phase1?.targetParticipantId;
  const phase2Target = input.phaseContexts.phase2?.targetParticipantId;
  const selectedTarget = phase1Target ?? phase2Target;
  if (!selectedTarget) {
    return { message: "Select a target for the Feint.", ok: false };
  }

  const resolveTarget = (targetId: string | undefined) =>
    targetId
      ? input.encounterParticipants.find(
          (participant) =>
            participant.id === targetId ||
            participant.scenarioParticipantId === targetId ||
            participant.characterId === targetId,
        )
      : undefined;
  const targetParticipant = resolveTarget(selectedTarget);
  if (!targetParticipant) {
    if (input.fallbackParticipantIds?.includes(selectedTarget)) {
      return {
        ok: true,
        phaseContexts: {
          ...input.phaseContexts,
          phase1: scenarioParticipantCombatContextSchema.parse({
            ...input.phaseContexts.phase1,
            targetParticipantId: selectedTarget,
          }),
          phase2: scenarioParticipantCombatContextSchema.parse({
            ...input.phaseContexts.phase2,
            targetParticipantId: selectedTarget,
          }),
        },
        targetParticipantId: selectedTarget,
      };
    }
    return {
      message: "The Feint target is no longer in this encounter.",
      ok: false,
    };
  }
  const targetParticipantId = targetParticipant.id;
  return {
    ok: true,
    phaseContexts: {
      ...input.phaseContexts,
      phase1: scenarioParticipantCombatContextSchema.parse({
        ...input.phaseContexts.phase1,
        targetParticipantId,
      }),
      phase2: scenarioParticipantCombatContextSchema.parse({
        ...input.phaseContexts.phase2,
        targetParticipantId,
      }),
    },
    targetParticipantId,
  };
}

export interface PlayerCombatLoadoutReference {
  am: string;
  am2: string;
  attackMode: string;
  attackMode2: string;
  combinedDb: string;
  combinedDm: string;
  combinedParry: string;
  combinedSourceName: string;
  crit: string;
  crit2: string;
  damageClass: string;
  damageClass2: string;
  db: string;
  dmb: string;
  dmb2: string;
  dm: string;
  initiative: string;
  ob: string;
  ob2: string;
  parry: string;
  provenance?: string;
  range?: string;
  secondCrit: string;
  selectedWeapon: string;
  sourceAttackModeId?: string;
  sourceItemId?: string;
  sourceSlot?: Exclude<CombatAttackSourceSlot, "virtual">;
  sourceTemplateId?: string;
}

export interface PlayerCombatLoadoutSummary {
  attackModeUnavailableMessage?: string;
  attackModeOptions: PlayerCombatAttackModeOption[];
  attackSourceOptions: PlayerCombatAttackSourceOption[];
  attackStats: PlayerCombatAttackStatsView | null;
  mainHandParryItemLabel: string;
  offHandParryItemLabel: string;
  passiveInitiative: number;
  reference: PlayerCombatLoadoutReference | null;
  /**
   * Whether `reference` was resolved by the unarmed Double Attack execution fallback rather than
   * from a weapon the participant holds or a source the player chose (#575/#583). Execution reads
   * the reference regardless; the declaration path treats a reference so marked as no source at
   * all, so unarmed is never declared by default.
   */
  referenceUsedUnarmedExecutionFallback: boolean;
  selectedAttackModeId?: string;
  selectedAttackModeUsedFallback: boolean;
  selectedAttackSourceId?: string;
}

export interface PlayerCombatAttackModeOption {
  allowsRepeatedRoundAttack: boolean;
  id: string;
  label: string;
}

/**
 * One source a player may declare an attack from, for the explicit declaration-time control
 * (#575). `id` is the canonical weapon-source identity the domain and the API already use —
 * `unarmed:<templateId>` for a brawling row, and the committed scenario item id for a ready
 * weapon — so the control names sources in the existing vocabulary rather than a parallel one.
 */
export interface PlayerCombatAttackSourceOption {
  id: string;
  label: string;
  slot: CombatAttackSourceSlot;
  sourceKind: "unarmed" | "weapon";
  templateId?: string;
}

export interface CombatDeclarationAttackSelection {
  /** Attack phases the declaration needs a source for but could not resolve one for (#575). */
  missingSourcePhases: PlayerCombatPhaseKey[];
  phaseAttackSources: Partial<Record<PlayerCombatPhaseKey, CombatAttackSourceRef>>;
  phaseContexts: CombatRoundPhaseContexts;
}

export interface PlayerCombatPhasePanelModel {
  attackStats: PlayerCombatAttackStatsView | null;
  defenseStats: PlayerCombatDefenseStatsView | null;
  phaseCard: PlayerCombatPhaseCardView;
  phaseContext: ScenarioParticipantCombatContext;
  phaseKey: PlayerCombatPhaseKey;
  showAttackLocationSelector: boolean;
  showAttackStats: boolean;
  showDefenseContext: boolean;
}

export const DEFAULT_MAIN_HAND_PARRY_DIRECTION: ScenarioParticipantParryDirection = "left_forward";
export const DEFAULT_OFF_HAND_PARRY_DIRECTION: ScenarioParticipantParryDirection = "left";

function getCombatTableColumnIndex(input: { columns: string[]; label: string }): number {
  return input.columns.indexOf(input.label);
}

function getCombatTableCell(input: {
  columns: string[];
  label: string;
  row: Array<string | number>;
}): string {
  const index = getCombatTableColumnIndex({
    columns: input.columns,
    label: input.label,
  });

  if (index < 0) {
    return "—";
  }

  const value = input.row[index];
  return value == null ? "—" : String(value);
}

function getRelevantLoadoutFieldId(
  actionId: PlayerEncounterActionId | "",
): "missile" | "primary" | "secondary" | "throwing" | null {
  switch (actionId) {
    case "attack_parry":
    case "parry_attack":
    case "double_attack":
    case "feint_attack":
    case "adjust_range_attack":
    case "counterattack":
    case "offensive_parry":
    case "parry":
    case "parry_disarm":
    case "disarm":
    case "break_off_engagement":
    case "other":
      return "primary";
    default:
      return null;
  }
}

function getLoadoutFieldWeaponModeLabel(
  fieldId: "missile" | "primary" | "secondary" | "throwing",
): string {
  switch (fieldId) {
    case "missile":
      return "Missile";
    case "primary":
      return "Primary";
    case "secondary":
      return "Secondary";
    case "throwing":
      return "Thrown";
  }
}

const PLAYER_COMBAT_ATTACK_SOURCE_FIELD_IDS = [
  "primary",
  "secondary",
  "missile",
  "throwing",
] as const;

/**
 * The sources a player may explicitly declare an attack from: every ready weapon in a loadout slot
 * that can carry one, plus any brawling row that is actually declarable (#575). Options are built
 * only from the committed loadout and the canonical unarmed templates; nothing is invented, and no
 * slot or name fallback stands in for a missing item.
 *
 * A brawling row is offered only where the existing mode-legality rule accepts it; the exclusion
 * is computed, never hard-coded. The Punch and Kick templates author `canonicalMeleeMode: "strike"`
 * (#586/#590 ruling), so `resolvePreferredAttackMode` finds them a legal attack mode and both rows
 * are offered as explicit unarmed choices. A brawling row that carried no legal mode would still
 * be withheld, because offering it would put a choice on the surface that the rules reject. A ready
 * weapon stays listed even when its own modes are unavailable, because
 * `attackModeUnavailableMessage` already names that reason for the weapon the player is holding.
 */
function buildPlayerCombatAttackSourceOptions(input: {
  allowUnarmed: boolean;
  loadoutFieldDisplayMap: Map<string, { value?: string; valueLabel?: string }>;
  weaponRows?: readonly {
    attackModes?: readonly DerivedCombatAttackMode[];
    itemId?: string;
    templateId?: string;
  }[];
}): PlayerCombatAttackSourceOption[] {
  const weaponOptions = PLAYER_COMBAT_ATTACK_SOURCE_FIELD_IDS.flatMap((fieldId) => {
    const field = input.loadoutFieldDisplayMap.get(fieldId);
    const itemId = field?.value;
    if (!itemId || !field?.valueLabel || field.valueLabel === "None") return [];
    const id = buildCombatAttackWeaponSourceId({ itemId, sourceKind: "weapon" });
    if (!id) return [];
    return [
      {
        id,
        label: `${field.valueLabel} · ${getLoadoutFieldWeaponModeLabel(fieldId)}`,
        slot: fieldId === "missile" ? ("throwing" as const) : fieldId,
        sourceKind: "weapon" as const,
      },
    ];
  });

  if (!input.allowUnarmed) return weaponOptions;

  return [
    ...weaponOptions,
    ...PLAYER_COMBAT_UNARMED_ATTACK_SOURCES.flatMap((source) => {
      const id = buildCombatAttackWeaponSourceId({
        sourceKind: "unarmed",
        weaponTemplateId: source.templateId,
      });
      if (!id) return [];
      const brawlingRow = input.weaponRows?.find(
        (row) => !row.itemId && row.templateId === source.templateId,
      );
      const hasLegalMode =
        resolvePreferredAttackMode({
          allowThrownAttack: false,
          weapon: { attackModes: brawlingRow?.attackModes ?? [] },
        }).legalModes.length > 0;
      if (!hasLegalMode) return [];
      return [
        {
          id,
          label: `${source.label} · Unarmed`,
          slot: "virtual" as const,
          sourceKind: "unarmed" as const,
          templateId: source.templateId,
        },
      ];
    }),
  ];
}

function hasDisplayValue(value: string): boolean {
  return value.length > 0 && value !== "—";
}

function parsePassiveInitiative(value: string | undefined): number {
  const passiveInitiative = Number(value);
  return Number.isFinite(passiveInitiative) ? passiveInitiative : 0;
}

export function isEquipmentFeatureState(value: unknown): value is EquipmentFeatureState {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.itemsById === "object" &&
    candidate.itemsById !== null &&
    typeof candidate.locationsById === "object" &&
    candidate.locationsById !== null &&
    typeof candidate.activeLoadoutByCharacterId === "object" &&
    candidate.activeLoadoutByCharacterId !== null &&
    typeof candidate.templates === "object" &&
    candidate.templates !== null &&
    "templatesById" in (candidate.templates as Record<string, unknown>)
  );
}

export function normalizeCombatEquipmentFeatureState(value: unknown): EquipmentFeatureState | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  const nestedTemplates =
    candidate.templates && typeof candidate.templates === "object"
      ? (candidate.templates as Record<string, unknown>).templatesById
      : undefined;
  const templatesById = nestedTemplates ?? candidate.templatesById;
  if (
    !candidate.itemsById ||
    typeof candidate.itemsById !== "object" ||
    !candidate.activeLoadoutByCharacterId ||
    typeof candidate.activeLoadoutByCharacterId !== "object" ||
    !templatesById ||
    typeof templatesById !== "object"
  ) {
    return null;
  }

  return {
    activeLoadoutByCharacterId:
      candidate.activeLoadoutByCharacterId as EquipmentFeatureState["activeLoadoutByCharacterId"],
    itemsById: candidate.itemsById as EquipmentFeatureState["itemsById"],
    locationsById:
      candidate.locationsById && typeof candidate.locationsById === "object"
        ? (candidate.locationsById as EquipmentFeatureState["locationsById"])
        : {},
    templates: {
      templatesById: templatesById as EquipmentFeatureState["templates"]["templatesById"],
    },
  };
}

export function resolveCombatEquipmentCharacterId(input: {
  characterId?: string;
  state: EquipmentFeatureState | null;
}): string | undefined {
  if (!input.state) return undefined;
  if (input.characterId && input.state.activeLoadoutByCharacterId[input.characterId]) {
    return input.characterId;
  }
  const loadoutOwnerIds = Object.keys(input.state.activeLoadoutByCharacterId);
  return loadoutOwnerIds.length === 1 ? loadoutOwnerIds[0] : undefined;
}

export interface ScenarioCombatEquipmentStatus {
  kind: "ready" | "unarmed" | "stale" | "incomplete";
  message?: string;
}

/**
 * Names the remedy for a committed-equipment fault — and only ever a remedy that exists for the
 * participant it is shown for (Forgejo #666).
 *
 * The participant assignment grid renders `Update Scenario equipment` only where
 * `sourceType === "character" && characterId`, because the operation behind it reconciles a
 * Character equipment aggregate. Sending the GM there for a Template-derived temporary actor
 * pointed at a control that is not on the page; telling a GM to use a control that is not there
 * costs more confidence than a plain failure. A temporary actor is instead pointed at the Template
 * sources control that genuinely does act on it.
 */
export function formatScenarioCombatEquipmentDiagnostic(input: {
  isGameMaster: boolean;
  participantName?: string;
  participantSourceType?: "character" | "entity";
  status: ScenarioCombatEquipmentStatus;
}): string | undefined {
  if (!input.status.message) return undefined;
  const participantName = input.participantName?.trim() || "This participant";
  const possessive =
    participantName === "This participant" ? "This participant’s" : `${participantName}’s`;
  if (input.participantSourceType === "entity") {
    return input.isGameMaster
      ? `${possessive} committed scenario equipment is incomplete or out of date. Recreate this temporary actor from its Template source on the scenario page.`
      : `${possessive} committed scenario equipment is incomplete or out of date. Ask the GM to recreate this temporary actor from its Template source.`;
  }
  return input.isGameMaster
    ? `${possessive} scenario equipment is incomplete or out of date. Refresh it from the participant assignment grid on the scenario page.`
    : `${possessive} scenario equipment is incomplete or out of date. Ask the GM to refresh it from the participant assignment grid on the scenario page.`;
}

function getReadyEquipmentItemIds(state: EquipmentFeatureState, characterId: string): string[] {
  const loadout = state.activeLoadoutByCharacterId[characterId];
  if (!loadout) return [];
  return [
    loadout.activePrimaryWeaponItemId,
    loadout.activeSecondaryWeaponItemId,
    loadout.activeMissileWeaponItemId,
    loadout.readyShieldItemId,
    loadout.wornArmorItemId,
  ].filter((itemId): itemId is string => Boolean(itemId));
}

/**
 * Diagnoses scenario-owned equipment without substituting mutable character item identities.
 *
 * `participantSourceType` decides what a *missing* projection means, and that distinction is the
 * whole of Forgejo #666. A scenario-equipment projection is Character-sourced by construction —
 * `scenarioParticipantSnapshotSchema.equipmentProjection.provenance.source` is the literal
 * `"character_equipment_aggregate"`, and the only operation that writes one is the Character-only
 * `refresh-character-equipment` reconcile. A Template-derived temporary actor (`sourceType:
 * "entity"`) therefore **never has one, and never can**.
 *
 * Reading that structural absence as `incomplete` reported a repairable Character data fault where
 * none existed. It named a refresh control the participant assignment grid correctly does not
 * render for a temporary actor, and — because `incomplete` also clears `allowUnarmedFallback` — it
 * withheld the intrinsic Punch and Kick sources that are such an actor's only legal attack
 * sources, leaving `Declare action` disabled and the round unable to leave Declaration.
 *
 * So a non-Character participant carrying no committed equipment is `unarmed`: a legitimate state
 * with no diagnostic, not a fault. Nothing is synthesised to reach it — no pseudo-Character, and no
 * equipment records a template does not have. A template that *does* author an `equipmentState` is
 * still diagnosed exactly as before, because then there is real committed equipment to judge.
 */
export function getScenarioCombatEquipmentStatus(input: {
  characterId?: string;
  participantSourceType?: "character" | "entity";
  resolvedEquipmentState?: unknown;
  scenarioEquipmentState?: unknown;
}): ScenarioCombatEquipmentStatus {
  const hasCharacterEquipmentSource = input.participantSourceType !== "entity";
  const scenarioState = normalizeCombatEquipmentFeatureState(input.scenarioEquipmentState);
  if (!scenarioState) {
    if (!hasCharacterEquipmentSource) return { kind: "unarmed" };
    return {
      kind: "incomplete",
      message: "Committed equipment data is unavailable. Ask the GM to refresh it.",
    };
  }
  const scenarioCharacterId = resolveCombatEquipmentCharacterId({
    characterId: input.characterId,
    state: scenarioState,
  });
  if (!scenarioCharacterId) {
    // A template may author an `equipmentState` that carries no loadout owner at all. There is
    // still nothing a Character refresh could reconcile, so the actor is unarmed rather than faulty.
    if (!hasCharacterEquipmentSource) return { kind: "unarmed" };
    return {
      kind: "incomplete",
      message: "Committed equipment loadout is unavailable. Ask the GM to refresh it.",
    };
  }
  const scenarioReadyIds = getReadyEquipmentItemIds(scenarioState, scenarioCharacterId);
  const missingMetadata = scenarioReadyIds.some((itemId) => {
    const item = scenarioState.itemsById[itemId];
    return (
      !item || (item.templateId !== null && !scenarioState.templates.templatesById[item.templateId])
    );
  });
  if (missingMetadata) {
    return {
      kind: "incomplete",
      message: "Committed equipment metadata is incomplete. Ask the GM to refresh it.",
    };
  }
  if (scenarioReadyIds.length > 0) return { kind: "ready" };

  const resolvedState = normalizeCombatEquipmentFeatureState(input.resolvedEquipmentState);
  const resolvedCharacterId = resolveCombatEquipmentCharacterId({
    characterId: input.characterId,
    state: resolvedState,
  });
  if (
    resolvedState &&
    resolvedCharacterId &&
    getReadyEquipmentItemIds(resolvedState, resolvedCharacterId).length > 0
  ) {
    return {
      kind: "stale",
      message: "Committed equipment is out of date. Ask the GM to refresh it.",
    };
  }
  return { kind: "unarmed" };
}

/**
 * An actor that carries nothing, stated explicitly.
 *
 * This is the absence of equipment, not invented equipment: no items, no templates, no loadout
 * owner, nothing ready. It exists because `null` and "carries nothing" had been the same value, and
 * the combat loadout derivation treats `null` as *no data to work from* and returns an empty model
 * — which withholds the intrinsic Punch and Kick rows that `combatStateDerivation` otherwise always
 * derives, for an actor whose equipment is genuinely and correctly empty (Forgejo #666).
 */
export const EMPTY_SCENARIO_COMBAT_EQUIPMENT_STATE: EquipmentFeatureState = {
  activeLoadoutByCharacterId: {},
  itemsById: {},
  locationsById: {},
  templates: { templatesById: {} },
};

/**
 * Combat declarations use the committed scenario participant's item and loadout IDs.
 * Current equipment data may only enrich matching template definitions (for example,
 * attack-mode capabilities added after an older scenario snapshot was recorded).
 *
 * `participantSourceType` distinguishes *no equipment data* from *carries nothing*, for the reason
 * given on `getScenarioCombatEquipmentStatus`: a Template-derived temporary actor never has a
 * Character equipment projection, so its missing state is not a fault to be diagnosed but an empty
 * loadout to be derived from. A Character keeps returning `null`, so a genuinely stale or missing
 * Character projection stays diagnosable exactly as before.
 */
export function resolveScenarioCombatEquipmentState(input: {
  participantSourceType?: "character" | "entity";
  resolvedEquipmentState?: unknown;
  scenarioEquipmentState?: unknown;
}): EquipmentFeatureState | null {
  const scenarioState = normalizeCombatEquipmentFeatureState(input.scenarioEquipmentState);
  const resolvedState = normalizeCombatEquipmentFeatureState(input.resolvedEquipmentState);

  if (!scenarioState && !resolvedState && input.participantSourceType === "entity") {
    return EMPTY_SCENARIO_COMBAT_EQUIPMENT_STATE;
  }
  if (!scenarioState) return resolvedState;
  if (!resolvedState) return scenarioState;

  const templatesById = { ...scenarioState.templates.templatesById };
  for (const item of Object.values(scenarioState.itemsById)) {
    if (item.templateId === null) continue;
    const resolvedTemplate = resolvedState.templates.templatesById[item.templateId];
    if (resolvedTemplate) {
      templatesById[item.templateId] = resolvedTemplate;
    }
  }

  return {
    ...scenarioState,
    templates: {
      ...scenarioState.templates,
      templatesById,
    },
  };
}

/**
 * The brawling rows the combat rules keep available to every character: `combatStateDerivation`
 * always derives a Punch and a Kick row, and the API accepts exactly these two template ids as an
 * unarmed phase attack source. Nothing else is a legal unarmed declaration.
 */
export const PLAYER_COMBAT_UNARMED_ATTACK_SOURCES: readonly {
  label: string;
  templateId: string;
}[] = [
  { label: punchTemplate.name, templateId: punchTemplate.id },
  { label: kickTemplate.name, templateId: kickTemplate.id },
];

const unarmedAttackSourceTemplateIds = new Set(
  PLAYER_COMBAT_UNARMED_ATTACK_SOURCES.map((source) => source.templateId),
);

export function buildCombatAttackSourceRef(input: {
  phaseKey: PlayerCombatPhaseKey;
  reference: PlayerCombatLoadoutReference | null;
  /**
   * Whether `reference` came from the unarmed Double Attack execution fallback (#575/#583). That
   * fallback exists so an already-declared unarmed attack stays rollable; it is not a choice the
   * player made, so a declaration is never built from it. The phase is reported as missing a
   * source instead, and the player is asked to pick one.
   */
  referenceUsedUnarmedExecutionFallback?: boolean;
  unarmedTemplateId: string;
}): CombatAttackSourceRef | undefined {
  if (input.referenceUsedUnarmedExecutionFallback) return undefined;
  const opportunitySlot = input.phaseKey === "phase1" ? "attack_1" : "attack_2";
  const isExplicitUnarmedSelection =
    !input.reference?.sourceItemId &&
    (input.reference?.selectedWeapon === "Punch" || input.reference?.selectedWeapon === "Kick");
  if (isExplicitUnarmedSelection) {
    // An explicitly chosen brawling row carries its own template; the phase default only applies
    // when the reference names no legal unarmed template of its own.
    const selectedUnarmedTemplateId =
      input.reference?.sourceTemplateId &&
      unarmedAttackSourceTemplateIds.has(input.reference.sourceTemplateId)
        ? input.reference.sourceTemplateId
        : input.unarmedTemplateId;
    return {
      attackModeId: input.reference?.sourceAttackModeId ?? "mode-1",
      opportunitySlot,
      slot: "virtual",
      sourceKind: "unarmed",
      templateId: selectedUnarmedTemplateId,
    };
  }

  if (
    input.reference?.sourceItemId &&
    input.reference.sourceTemplateId &&
    input.reference.sourceAttackModeId &&
    input.reference.sourceSlot
  ) {
    return {
      attackModeId: input.reference.sourceAttackModeId,
      opportunitySlot,
      scenarioItemId: input.reference.sourceItemId,
      slot: input.reference.sourceSlot,
      sourceKind: "weapon",
      templateId: input.reference.sourceTemplateId,
    };
  }

  if (
    !input.reference ||
    input.reference?.sourceItemId ||
    input.reference?.sourceTemplateId ||
    input.reference?.sourceAttackModeId
  ) {
    return undefined;
  }

  return undefined;
}

/**
 * Converts the explicit declaration-editor selections into canonical source references.
 * This is the only pre-commit normalization boundary: live combat execution consumes the
 * persisted opportunity identity and never calls this helper.
 */
export function buildCombatDeclarationAttackSelection(input: {
  actionId?: string;
  disarmPhase?: PlayerCombatPhaseKey;
  feintMethod?: "movement" | "weapon";
  phaseContexts: CombatRoundPhaseContexts;
  phaseLoadoutSummaries: Record<
    PlayerCombatPhaseKey,
    Pick<PlayerCombatLoadoutSummary, "reference" | "selectedAttackModeId"> &
      Partial<Pick<PlayerCombatLoadoutSummary, "referenceUsedUnarmedExecutionFallback">>
  >;
  secondaryActionId?: string;
}): CombatDeclarationAttackSelection {
  const attackPhases = new Set<PlayerCombatPhaseKey>(
    getCombatDeclarationAttackPhases({
      actionId: input.actionId,
      disarmPhase: input.disarmPhase,
      secondaryActionId: input.secondaryActionId,
    }),
  );
  if (input.actionId === "feint_attack" && input.feintMethod === "weapon") {
    attackPhases.add("phase1");
  }

  const phaseAttackSources: Partial<Record<PlayerCombatPhaseKey, CombatAttackSourceRef>> = {};
  const phaseContexts: CombatRoundPhaseContexts = { ...input.phaseContexts };
  const missingSourcePhases: PlayerCombatPhaseKey[] = [];
  for (const phaseKey of attackPhases) {
    const source = buildCombatAttackSourceRef({
      phaseKey,
      reference: input.phaseLoadoutSummaries[phaseKey].reference,
      referenceUsedUnarmedExecutionFallback:
        input.phaseLoadoutSummaries[phaseKey].referenceUsedUnarmedExecutionFallback,
      unarmedTemplateId:
        phaseKey === "phase1" ? "virtual-weapon-template-punch" : "virtual-weapon-template-kick",
    });
    if (!source) {
      // #575: an attack phase without a resolvable source used to be dropped here, so the
      // declaration was submitted incomplete and rejected with nothing shown. Report it instead.
      missingSourcePhases.push(phaseKey);
      continue;
    }

    phaseAttackSources[phaseKey] = source;
    phaseContexts[phaseKey] = scenarioParticipantCombatContextSchema.parse({
      ...phaseContexts[phaseKey],
      attackModeId:
        input.phaseLoadoutSummaries[phaseKey].selectedAttackModeId ?? source.attackModeId,
    });
  }

  return { missingSourcePhases, phaseAttackSources, phaseContexts };
}

export function getPlayerCombatPhaseLabel(phaseKey: PlayerCombatPhaseKey): string {
  return phaseKey === "phase1" ? "Phase 1" : "Phase 2";
}

/**
 * The reason a declaration cannot be built because an attack phase has no attack source (#575).
 * The caller shows this and keeps the declaration unsubmittable, rather than sending a request the
 * API is certain to reject.
 */
export function getCombatDeclarationAttackSourceRequiredMessage(
  missingSourcePhases: readonly PlayerCombatPhaseKey[],
  input: { selectableSourceCount?: number } = {},
): string | undefined {
  if (missingSourcePhases.length === 0) return undefined;
  const phaseLabels = missingSourcePhases.map(getPlayerCombatPhaseLabel).join(" and ");
  if (input.selectableSourceCount === 0) {
    // Nothing the player could pick, so asking them to pick would be misleading.
    return `No attack source is available for ${phaseLabels}. Ready a weapon, or ask the GM to refresh your scenario equipment.`;
  }
  return `Select an attack source for ${phaseLabels}.`;
}

export function getCombatDeclarationAttackModeUnavailableMessage(input: {
  actionId?: string;
  disarmPhase?: PlayerCombatPhaseKey;
  feintMethod?: "movement" | "weapon";
  phaseLoadoutSummaries: Record<
    PlayerCombatPhaseKey,
    Pick<PlayerCombatLoadoutSummary, "attackModeUnavailableMessage">
  >;
  secondaryActionId?: string;
}): string | undefined {
  const attackPhases = new Set<PlayerCombatPhaseKey>(
    getCombatDeclarationAttackPhases({
      actionId: input.actionId,
      disarmPhase: input.disarmPhase,
      secondaryActionId: input.secondaryActionId,
    }),
  );
  if (input.actionId === "feint_attack" && input.feintMethod === "weapon") {
    attackPhases.add("phase1");
  }

  for (const phaseKey of attackPhases) {
    const message = input.phaseLoadoutSummaries[phaseKey].attackModeUnavailableMessage;
    if (message) return message;
  }
  return undefined;
}

export function buildPlayerCombatLoadoutSummary(input: {
  actionId: PlayerEncounterActionId | "";
  allowUnarmedFallback?: boolean;
  /**
   * Whether the attack stats name the selected mode's workbook import coordinates (sheet, row and
   * range). Only the GM's Combat Round Manager passes `true`: workbook import provenance is not
   * player-facing (#517, ruling E2). Without it the stats name only the provenance kind.
   */
  includeSourceProvenance?: boolean;
  loadoutModel: EquipmentLoadoutModuleModel;
  phaseKey?: PlayerCombatPhaseKey;
  selectedAttackModeId?: string;
  /**
   * The attack source the declaring player chose explicitly, as a
   * `PlayerCombatAttackSourceOption.id` (#575). Without it the summary keeps deriving the source
   * from the action's relevant loadout slot, so a held weapon stays preselected.
   */
  selectedAttackSourceId?: string;
  secondaryActionId: PlayerEncounterActionId | "";
}): PlayerCombatLoadoutSummary {
  const loadoutFieldDisplayMap = new Map(
    input.loadoutModel.fields.map((field) => [field.id, field]),
  );
  const primaryLoadoutLabel = loadoutFieldDisplayMap.get("primary")?.valueLabel;
  const shieldLoadoutLabel = loadoutFieldDisplayMap.get("shield")?.valueLabel;
  const secondaryLoadoutLabel = loadoutFieldDisplayMap.get("secondary")?.valueLabel;
  const mainHandParryItemLabel =
    primaryLoadoutLabel && primaryLoadoutLabel !== "None" ? primaryLoadoutLabel : "Unarmed";
  const offHandParryItemLabel =
    shieldLoadoutLabel && shieldLoadoutLabel !== "None"
      ? shieldLoadoutLabel
      : secondaryLoadoutLabel && secondaryLoadoutLabel !== "None"
        ? secondaryLoadoutLabel
        : "Unarmed";
  const combatPanelModel = input.loadoutModel.combatStatePanelModel;

  const attackSourceOptions = buildPlayerCombatAttackSourceOptions({
    allowUnarmed: input.allowUnarmedFallback !== false,
    loadoutFieldDisplayMap,
    weaponRows: combatPanelModel?.weaponRows,
  });

  if (!combatPanelModel) {
    return {
      attackStats: null,
      attackModeOptions: [],
      attackSourceOptions,
      mainHandParryItemLabel,
      offHandParryItemLabel,
      passiveInitiative: 0,
      reference: null,
      referenceUsedUnarmedExecutionFallback: false,
      selectedAttackModeUsedFallback: false,
    };
  }

  const selectedAttackSource = input.selectedAttackSourceId
    ? attackSourceOptions.find((option) => option.id === input.selectedAttackSourceId)
    : undefined;
  const doubleAttackFieldId =
    input.actionId === "double_attack" && input.phaseKey === "phase2"
      ? secondaryLoadoutLabel && secondaryLoadoutLabel !== "None"
        ? ("secondary" as const)
        : ("primary" as const)
      : undefined;
  // An explicit source selection replaces the action's derived loadout slot. Without one, the
  // derivation is unchanged, so a held weapon is still what the declaration starts from.
  const preferredFieldIds = (
    selectedAttackSource
      ? selectedAttackSource.sourceKind === "weapon" && selectedAttackSource.slot !== "virtual"
        ? [selectedAttackSource.slot === "other" ? null : selectedAttackSource.slot]
        : []
      : [
          doubleAttackFieldId ?? getRelevantLoadoutFieldId(input.actionId),
          getRelevantLoadoutFieldId(input.secondaryActionId),
        ]
  ).filter((value): value is "missile" | "primary" | "secondary" | "throwing" => value !== null);
  const preferredItemSources = preferredFieldIds.flatMap((fieldId) => {
    const itemId = loadoutFieldDisplayMap.get(fieldId)?.value;
    return itemId ? [{ fieldId, itemId }] : [];
  });
  const preferredItemIds = preferredItemSources.map(({ itemId }) => itemId);
  const explicitWeaponLabels =
    selectedAttackSource?.sourceKind === "unarmed"
      ? PLAYER_COMBAT_UNARMED_ATTACK_SOURCES.filter(
          (source) => source.templateId === selectedAttackSource.templateId,
        ).map((source) => source.label)
      : preferredFieldIds
          .map((fieldId) => loadoutFieldDisplayMap.get(fieldId)?.valueLabel)
          .filter((value): value is string => Boolean(value) && value !== "None");
  // The unarmed Double Attack reference is resolved for EXECUTION only. An unequipped participant
  // can hold a Double Attack declaration the domain itself built with unarmed opportunities
  // (`buildCombatRoundDeclaredAttackOpportunities`), and that already-declared attack must stay
  // rollable: with no reference row there are no attack stats, and the roll gate on both the
  // player and the GM surface closes permanently. #586 defers the unarmed-rules question rather
  // than authorising the removal of unarmed execution, so this keeps the pre-#575 reference
  // resolution exactly as it was.
  //
  // It is NOT a declaration-time default. The summary reports it through
  // `referenceUsedUnarmedExecutionFallback`, and `buildCombatAttackSourceRef` refuses to build a
  // source from a reference so marked, so the phase lands in `missingSourcePhases` and the
  // declaration stays blocked with a visible message instead of quietly declaring unarmed.
  const referenceUsedUnarmedExecutionFallback =
    input.actionId === "double_attack" &&
    input.allowUnarmedFallback !== false &&
    !selectedAttackSource &&
    explicitWeaponLabels.length === 0;
  const preferredWeaponLabels = referenceUsedUnarmedExecutionFallback
    ? [input.phaseKey === "phase2" ? "Kick" : "Punch"]
    : explicitWeaponLabels;
  if (input.allowUnarmedFallback === false && preferredItemIds.length === 0) {
    return {
      attackStats: null,
      attackModeOptions: [],
      attackSourceOptions,
      mainHandParryItemLabel,
      offHandParryItemLabel,
      passiveInitiative: 0,
      reference: null,
      referenceUsedUnarmedExecutionFallback,
      selectedAttackModeUsedFallback: false,
    };
  }
  const preferredRawReferenceRow = preferredItemSources
    .map(({ fieldId, itemId }) => {
      const candidateRows =
        combatPanelModel.weaponRows?.filter((row) => row.itemId === itemId) ?? [];
      const selectedModeRow = input.selectedAttackModeId
        ? candidateRows.find((row) =>
            row.attackModes?.some((mode) => mode.id === input.selectedAttackModeId),
          )
        : undefined;
      return (
        selectedModeRow ??
        candidateRows.find((row) => row.modeLabel === getLoadoutFieldWeaponModeLabel(fieldId)) ??
        candidateRows[0] ??
        null
      );
    })
    .find((row) => row !== null);
  const referenceRow =
    (preferredRawReferenceRow
      ? (combatPanelModel.weaponModeTable.rows.find((row) => {
          const weaponLabel = getCombatTableCell({
            columns: combatPanelModel.weaponModeTable.columns,
            label: "Weapon",
            row,
          });
          const modeLabel = getCombatTableCell({
            columns: combatPanelModel.weaponModeTable.columns,
            label: "Mode",
            row,
          });
          return (
            weaponLabel === preferredRawReferenceRow.currentItemLabel &&
            modeLabel === preferredRawReferenceRow.modeLabel
          );
        }) ?? null)
      : null) ??
    preferredWeaponLabels
      .map(
        (weaponLabel) =>
          combatPanelModel.weaponModeTable.rows.find(
            (row) =>
              getCombatTableCell({
                columns: combatPanelModel.weaponModeTable.columns,
                label: "Weapon",
                row,
              }) === weaponLabel,
          ) ?? null,
      )
      .find((row) => row !== null) ??
    (preferredFieldIds.length === 0 ? combatPanelModel.weaponModeTable.rows[0] : undefined) ??
    null;
  const combinedRow =
    combatPanelModel.weaponModeTable.rows.find(
      (row) =>
        getCombatTableCell({
          columns: combatPanelModel.weaponModeTable.columns,
          label: "Mode",
          row,
        }) === "Combined",
    ) ?? null;

  if (!referenceRow) {
    if (input.allowUnarmedFallback === false) {
      return {
        attackStats: null,
        attackModeOptions: [],
        attackSourceOptions,
        mainHandParryItemLabel,
        offHandParryItemLabel,
        passiveInitiative: 0,
        reference: null,
        referenceUsedUnarmedExecutionFallback,
        selectedAttackModeUsedFallback: false,
      };
    }
    const reference = {
      am: "—",
      am2: "—",
      attackMode: "—",
      attackMode2: "—",
      combinedDb: "—",
      combinedDm: "—",
      combinedParry: "—",
      combinedSourceName: "—",
      crit: "—",
      crit2: "—",
      damageClass: "—",
      damageClass2: "—",
      db: "—",
      dmb: "—",
      dmb2: "—",
      dm: "—",
      initiative: "—",
      ob: "—",
      ob2: "—",
      parry: "—",
      secondCrit: "—",
      selectedWeapon: "No ready weapon",
    };

    return {
      attackStats: buildPlayerCombatAttackStats(reference, {
        actionId: input.actionId,
        phaseKey: input.phaseKey,
      }),
      mainHandParryItemLabel,
      offHandParryItemLabel,
      passiveInitiative: 0,
      reference,
      attackModeOptions: [],
      attackSourceOptions,
      referenceUsedUnarmedExecutionFallback,
      selectedAttackModeUsedFallback: false,
    };
  }

  const referenceWeaponLabel = getCombatTableCell({
    columns: combatPanelModel.weaponModeTable.columns,
    label: "Weapon",
    row: referenceRow,
  });
  const referenceModeLabel = getCombatTableCell({
    columns: combatPanelModel.weaponModeTable.columns,
    label: "Mode",
    row: referenceRow,
  });
  const rawReferenceRow =
    preferredRawReferenceRow ??
    combatPanelModel.weaponRows?.find(
      (row) =>
        row.currentItemLabel === referenceWeaponLabel && row.modeLabel === referenceModeLabel,
    );
  if (input.allowUnarmedFallback === false && !rawReferenceRow?.itemId) {
    return {
      attackStats: null,
      attackModeOptions: [],
      attackSourceOptions,
      mainHandParryItemLabel,
      offHandParryItemLabel,
      passiveInitiative: 0,
      reference: null,
      referenceUsedUnarmedExecutionFallback,
      selectedAttackModeUsedFallback: false,
    };
  }
  const primaryItemId = loadoutFieldDisplayMap.get("primary")?.value;
  const sourceSlot = (["primary", "secondary", "missile", "throwing"] as const).find((fieldId) => {
    const field = loadoutFieldDisplayMap.get(fieldId);
    if (!field?.value) return false;
    if (field.value === rawReferenceRow?.itemId) return true;
    const matchingRows = combatPanelModel.weaponRows?.filter(
      (row) => row.currentItemLabel === field.valueLabel,
    );
    return (
      field.valueLabel === referenceWeaponLabel &&
      matchingRows?.length === 1 &&
      matchingRows[0] === rawReferenceRow
    );
  });
  const selectedSourceItemId =
    (sourceSlot ? loadoutFieldDisplayMap.get(sourceSlot)?.value : undefined) ??
    rawReferenceRow?.itemId;
  const availableAttackModes = Array.from(
    new Map(
      (selectedSourceItemId
        ? (combatPanelModel.weaponRows ?? [])
            .filter((row) => row.itemId === selectedSourceItemId)
            .flatMap((row) => row.attackModes ?? [])
        : (rawReferenceRow?.attackModes ?? [])
      ).map((mode) => [mode.id, mode]),
    ).values(),
  );
  const requireRepeatedRoundAttack = Boolean(
    input.actionId === "double_attack" &&
    input.phaseKey === "phase2" &&
    primaryItemId &&
    selectedSourceItemId === primaryItemId,
  );
  const modeResolution = resolvePreferredAttackMode({
    allowThrownAttack: Boolean(rawReferenceRow?.itemId),
    requireRepeatedRoundAttack,
    selectedModeId: input.selectedAttackModeId,
    weapon: {
      attackModes: availableAttackModes,
    },
  });
  const selectedDerivedMode = modeResolution.mode;
  const selectedIsThrownMode = selectedDerivedMode?.attackType === "thrown";
  const sourceMetadata = selectedDerivedMode?.sourceMetadata;
  const reference = {
    am: selectedDerivedMode
      ? String(selectedDerivedMode.armorModifier)
      : getCombatTableCell({
          columns: combatPanelModel.weaponModeTable.columns,
          label: "AM",
          row: referenceRow,
        }),
    am2: getCombatTableCell({
      columns: combatPanelModel.weaponModeTable.columns,
      label: "AM 2",
      row: referenceRow,
    }),
    attackMode: selectedDerivedMode
      ? selectedDerivedMode.label
      : getCombatTableCell({
          columns: combatPanelModel.weaponModeTable.columns,
          label: "Attack 1",
          row: referenceRow,
        }),
    attackMode2: getCombatTableCell({
      columns: combatPanelModel.weaponModeTable.columns,
      label: "Attack 2",
      row: referenceRow,
    }),
    combinedDb: combinedRow
      ? getCombatTableCell({
          columns: combatPanelModel.weaponModeTable.columns,
          label: "DB",
          row: combinedRow,
        })
      : "—",
    combinedDm: combinedRow
      ? getCombatTableCell({
          columns: combatPanelModel.weaponModeTable.columns,
          label: "DM",
          row: combinedRow,
        })
      : "—",
    combinedParry: combinedRow
      ? getCombatTableCell({
          columns: combatPanelModel.weaponModeTable.columns,
          label: "Parry",
          row: combinedRow,
        })
      : "—",
    combinedSourceName: combinedRow
      ? getCombatTableCell({
          columns: combatPanelModel.weaponModeTable.columns,
          label: "Weapon",
          row: combinedRow,
        })
      : "—",
    crit: selectedDerivedMode
      ? String(selectedDerivedMode.crit)
      : getCombatTableCell({
          columns: combatPanelModel.weaponModeTable.columns,
          label: "Crit 1",
          row: referenceRow,
        }),
    crit2: getCombatTableCell({
      columns: combatPanelModel.weaponModeTable.columns,
      label: "Crit 2",
      row: referenceRow,
    }),
    damageClass: selectedDerivedMode?.damageClass ?? rawReferenceRow?.damageClass1 ?? "—",
    damageClass2: rawReferenceRow?.damageClass2 ?? "—",
    db: getCombatTableCell({
      columns: combatPanelModel.weaponModeTable.columns,
      label: "DB",
      row: referenceRow,
    }),
    dmb: selectedDerivedMode
      ? String(selectedDerivedMode.dmb)
      : getCombatTableCell({
          columns: combatPanelModel.weaponModeTable.columns,
          label: "DMB",
          row: referenceRow,
        }),
    dmb2: getCombatTableCell({
      columns: combatPanelModel.weaponModeTable.columns,
      label: "DMB2",
      row: referenceRow,
    }),
    dm: getCombatTableCell({
      columns: combatPanelModel.weaponModeTable.columns,
      label: "DM",
      row: referenceRow,
    }),
    initiative:
      selectedDerivedMode?.initiative != null
        ? String(selectedDerivedMode.initiative)
        : getCombatTableCell({
            columns: combatPanelModel.weaponModeTable.columns,
            label: "I",
            row: referenceRow,
          }),
    ob: selectedDerivedMode
      ? String(selectedDerivedMode.ob)
      : getCombatTableCell({
          columns: combatPanelModel.weaponModeTable.columns,
          label: "OB",
          row: referenceRow,
        }),
    ob2: getCombatTableCell({
      columns: combatPanelModel.weaponModeTable.columns,
      label: "OB2",
      row: referenceRow,
    }),
    parry: getCombatTableCell({
      columns: combatPanelModel.weaponModeTable.columns,
      label: "Parry",
      row: referenceRow,
    }),
    provenance:
      input.includeSourceProvenance === true && sourceMetadata
        ? `${sourceMetadata.sheet} row ${sourceMetadata.row} · ${sourceMetadata.sourceRange}`
        : selectedDerivedMode?.provenance,
    range: selectedDerivedMode?.range ?? "—",
    secondCrit: selectedDerivedMode
      ? String(selectedDerivedMode.secondCrit ?? "—")
      : getCombatTableCell({
          columns: combatPanelModel.weaponModeTable.columns,
          label: "Sec",
          row: referenceRow,
        }),
    selectedWeapon: referenceWeaponLabel,
    sourceAttackModeId:
      modeResolution.mode?.id ??
      input.selectedAttackModeId ??
      (requireRepeatedRoundAttack ? undefined : rawReferenceRow?.attackMode1Id),
    sourceItemId: selectedSourceItemId,
    sourceSlot: selectedIsThrownMode || sourceSlot === "missile" ? "throwing" : sourceSlot,
    sourceTemplateId: rawReferenceRow?.templateId,
  };

  return {
    attackModeUnavailableMessage:
      modeResolution.reason === "no_legal_modes"
        ? requireRepeatedRoundAttack
          ? `The selected Phase 2 attack mode for ${referenceWeaponLabel} is not eligible for same-weapon Double Attack.`
          : `${referenceWeaponLabel} has no legal attack mode.`
        : undefined,
    attackModeOptions: modeResolution.legalModes.map((mode) => ({
      allowsRepeatedRoundAttack: mode.allowsRepeatedRoundAttack === true,
      id: mode.id,
      label: mode.label ?? mode.id,
    })),
    attackSourceOptions,
    attackStats: buildPlayerCombatAttackStats(reference, {
      actionId: input.actionId,
      phaseKey: input.phaseKey,
    }),
    mainHandParryItemLabel,
    offHandParryItemLabel,
    passiveInitiative: parsePassiveInitiative(reference.initiative),
    reference,
    referenceUsedUnarmedExecutionFallback,
    selectedAttackModeId: modeResolution.mode?.id,
    selectedAttackModeUsedFallback: modeResolution.usedFallback,
    // What the declaration will actually use, whether the player chose it or it came from the
    // held weapon. The control renders this, so a preselection is never invisible (#575).
    //
    // The unarmed execution fallback is deliberately not reported here: it resolved a reference so
    // an already-declared unarmed attack stays rollable, not because anyone chose unarmed. Showing
    // it as the selected source would put a silent unarmed default back on the declaration
    // control, which is exactly what #575 ruled out (#583).
    selectedAttackSourceId: referenceUsedUnarmedExecutionFallback
      ? undefined
      : buildCombatAttackWeaponSourceId({
          itemId: reference.sourceItemId,
          sourceKind: reference.sourceItemId ? "weapon" : "unarmed",
          weaponTemplateId: reference.sourceTemplateId,
        }),
  };
}

export function buildPlayerCombatAttackStats(
  reference: PlayerCombatLoadoutReference | null,
  _input: {
    actionId?: PlayerEncounterActionId | "";
    phaseKey?: PlayerCombatPhaseKey;
  } = {},
): PlayerCombatAttackStatsView | null {
  if (!reference) {
    return null;
  }

  // Double Attack's second attack is a separate source/opportunity, not a template's
  // optional "Attack 2" alternate mode. Same-source repetition remains mode 1 and is
  // validated from explicit weapon capability by the API/domain boundary.
  const useSecondAttack = false;
  const attackMode = useSecondAttack ? reference.am2 : reference.am;
  const crit = useSecondAttack ? reference.crit2 : reference.crit;
  const damageClass = useSecondAttack ? reference.damageClass2 : reference.damageClass;
  const dmb = useSecondAttack ? reference.dmb2 : reference.dmb;
  const ob = useSecondAttack ? reference.ob2 : reference.ob;
  const combinedFirstCriticalCode =
    !useSecondAttack && hasDisplayValue(reference.secondCrit)
      ? `${crit}${reference.secondCrit}`
      : crit;

  if (!hasDisplayValue(reference.selectedWeapon) || !hasDisplayValue(ob)) {
    return null;
  }

  return {
    attackMode,
    dmb,
    initiative: reference.initiative,
    maxCrits: `${crit}${!useSecondAttack && hasDisplayValue(reference.secondCrit) ? ` / ${reference.secondCrit}` : ""}`,
    ob,
    provenance: reference.provenance,
    range: reference.range ?? "—",
    weaponArmorClass: hasDisplayValue(attackMode) ? attackMode : undefined,
    weaponCriticalCode: hasDisplayValue(combinedFirstCriticalCode)
      ? combinedFirstCriticalCode
      : undefined,
    weaponDamageClass: hasDisplayValue(damageClass) ? damageClass : undefined,
    weaponName: reference.selectedWeapon,
  };
}

export function applyDefaultPlayerCombatPhaseContext(
  combatContext: ScenarioParticipantCombatContext,
): ScenarioParticipantCombatContext {
  return {
    ...combatContext,
    mainHandParryDirection:
      combatContext.mainHandParryDirection ?? DEFAULT_MAIN_HAND_PARRY_DIRECTION,
    offHandParryDirection: combatContext.offHandParryDirection ?? DEFAULT_OFF_HAND_PARRY_DIRECTION,
  };
}

export function buildPlayerCombatDefenseStats(input: {
  mainHandParryItemLabel: string;
  offHandParryItemLabel: string;
  phaseContext: ScenarioParticipantCombatContext;
  reference: PlayerCombatLoadoutReference | null;
}): PlayerCombatDefenseStatsView | null {
  if (!input.reference) {
    return null;
  }

  const phaseContext = applyDefaultPlayerCombatPhaseContext(input.phaseContext);
  const hasPhaseParryDirection = Boolean(
    phaseContext.mainHandParryDirection || phaseContext.offHandParryDirection,
  );
  const hasCombinedParry = hasDisplayValue(input.reference.combinedParry);
  const fallbackSourceName =
    input.offHandParryItemLabel !== "Unarmed"
      ? input.offHandParryItemLabel
      : input.mainHandParryItemLabel;

  return {
    db: hasDisplayValue(input.reference.combinedDb)
      ? input.reference.combinedDb
      : input.reference.db,
    dm: hasDisplayValue(input.reference.combinedDm)
      ? input.reference.combinedDm
      : input.reference.dm,
    parry: hasPhaseParryDirection
      ? hasCombinedParry
        ? input.reference.combinedParry
        : input.reference.parry
      : "incomplete",
    sourceName:
      hasCombinedParry && hasDisplayValue(input.reference.combinedSourceName)
        ? input.reference.combinedSourceName
        : fallbackSourceName,
  };
}

function getPhaseContentFlags(input: {
  actionId: PlayerEncounterActionId | "";
  phaseKey: PlayerCombatPhaseKey;
  secondaryActionId: PlayerEncounterActionId | "";
}): { attack: boolean } {
  const attackPhases = getCombatDeclarationAttackPhases({
    actionId: input.actionId,
    secondaryActionId: input.secondaryActionId,
  });

  if (input.actionId === "attack_parry") {
    return { attack: input.phaseKey === "phase1" };
  }

  if (input.actionId === "parry_attack") {
    return { attack: input.phaseKey === "phase2" };
  }

  if (input.actionId === "adjust_range_attack") {
    return { attack: input.phaseKey === "phase2" };
  }

  if (input.actionId === "double_attack") {
    return { attack: true };
  }

  return {
    attack: attackPhases.includes(input.phaseKey),
  };
}

export function buildPlayerCombatPhasePanelModel(input: {
  actionId: PlayerEncounterActionId | "";
  attackStats: PlayerCombatAttackStatsView | null;
  defenseStats: PlayerCombatDefenseStatsView | null;
  phaseCard: PlayerCombatPhaseCardView;
  phaseContext: ScenarioParticipantCombatContext;
  phaseKey: PlayerCombatPhaseKey;
  secondaryActionId: PlayerEncounterActionId | "";
}): PlayerCombatPhasePanelModel {
  const flags = getPhaseContentFlags({
    actionId: input.actionId,
    phaseKey: input.phaseKey,
    secondaryActionId: input.secondaryActionId,
  });
  const isAdjustRangePhase =
    input.actionId === "adjust_range_attack" && input.phaseKey === "phase1";
  const isFeintContestPhase = input.actionId === "feint_attack" && input.phaseKey === "phase1";

  return {
    attackStats: input.attackStats,
    defenseStats: input.defenseStats,
    phaseCard: isAdjustRangePhase
      ? {
          ...input.phaseCard,
          title: input.phaseCard.title || "Adjust range",
        }
      : input.phaseCard,
    phaseContext: input.phaseContext,
    phaseKey: input.phaseKey,
    showAttackLocationSelector: flags.attack,
    showAttackStats: Boolean(input.attackStats && flags.attack),
    // Phase 1 Feint is a Skill Contest, not a weapon attack or defensive exchange. Its
    // declaration preview is limited to the canonical contest profile. Phase 2 remains the
    // ordinary committed attack and keeps the existing attack/defense context.
    showDefenseContext: !isFeintContestPhase,
  };
}
