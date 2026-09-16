import type {
  CombatAttackSourceRef,
  CombatAttackSourceSlot,
  CombatRoundPhaseContexts,
  EncounterSession,
  ScenarioParticipantCombatContext,
  ScenarioParticipantParryDirection,
} from "@glantri/domain";
import {
  getCombatDeclarationAttackPhases,
  resolveCombatDeclarationParticipantIdentity,
  resolveCombatFeintWeaponSkillDefinition,
  resolvePreferredAttackMode,
  scenarioParticipantCombatContextSchema,
  type SkillSpecialization,
} from "@glantri/domain";

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
  attackStats: PlayerCombatAttackStatsView | null;
  mainHandParryItemLabel: string;
  offHandParryItemLabel: string;
  passiveInitiative: number;
  reference: PlayerCombatLoadoutReference | null;
  selectedAttackModeId?: string;
  selectedAttackModeUsedFallback: boolean;
}

export interface PlayerCombatAttackModeOption {
  allowsRepeatedRoundAttack: boolean;
  id: string;
  label: string;
}

export interface CombatDeclarationAttackSelection {
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

export function formatScenarioCombatEquipmentDiagnostic(input: {
  isGameMaster: boolean;
  participantName?: string;
  status: ScenarioCombatEquipmentStatus;
}): string | undefined {
  if (!input.status.message) return undefined;
  const participantName = input.participantName?.trim() || "This participant";
  const possessive =
    participantName === "This participant" ? "This participant’s" : `${participantName}’s`;
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

/** Diagnoses scenario-owned equipment without substituting mutable character item identities. */
export function getScenarioCombatEquipmentStatus(input: {
  characterId?: string;
  resolvedEquipmentState?: unknown;
  scenarioEquipmentState?: unknown;
}): ScenarioCombatEquipmentStatus {
  const scenarioState = normalizeCombatEquipmentFeatureState(input.scenarioEquipmentState);
  if (!scenarioState) {
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
 * Combat declarations use the committed scenario participant's item and loadout IDs.
 * Current equipment data may only enrich matching template definitions (for example,
 * attack-mode capabilities added after an older scenario snapshot was recorded).
 */
export function resolveScenarioCombatEquipmentState(input: {
  resolvedEquipmentState?: unknown;
  scenarioEquipmentState?: unknown;
}): EquipmentFeatureState | null {
  const scenarioState = normalizeCombatEquipmentFeatureState(input.scenarioEquipmentState);
  const resolvedState = normalizeCombatEquipmentFeatureState(input.resolvedEquipmentState);

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

export function buildCombatAttackSourceRef(input: {
  phaseKey: PlayerCombatPhaseKey;
  reference: PlayerCombatLoadoutReference | null;
  unarmedTemplateId: string;
}): CombatAttackSourceRef | undefined {
  const opportunitySlot = input.phaseKey === "phase1" ? "attack_1" : "attack_2";
  const isExplicitUnarmedSelection =
    !input.reference?.sourceItemId &&
    (input.reference?.selectedWeapon === "Punch" || input.reference?.selectedWeapon === "Kick");
  if (isExplicitUnarmedSelection) {
    return {
      attackModeId: input.reference?.sourceAttackModeId ?? "mode-1",
      opportunitySlot,
      slot: "virtual",
      sourceKind: "unarmed",
      templateId: input.unarmedTemplateId,
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
    Pick<PlayerCombatLoadoutSummary, "reference" | "selectedAttackModeId">
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
  for (const phaseKey of attackPhases) {
    const source = buildCombatAttackSourceRef({
      phaseKey,
      reference: input.phaseLoadoutSummaries[phaseKey].reference,
      unarmedTemplateId:
        phaseKey === "phase1" ? "virtual-weapon-template-punch" : "virtual-weapon-template-kick",
    });
    if (!source) continue;

    phaseAttackSources[phaseKey] = source;
    phaseContexts[phaseKey] = scenarioParticipantCombatContextSchema.parse({
      ...phaseContexts[phaseKey],
      attackModeId:
        input.phaseLoadoutSummaries[phaseKey].selectedAttackModeId ?? source.attackModeId,
    });
  }

  return { phaseAttackSources, phaseContexts };
}

export function buildPlayerCombatLoadoutSummary(input: {
  actionId: PlayerEncounterActionId | "";
  allowUnarmedFallback?: boolean;
  loadoutModel: EquipmentLoadoutModuleModel;
  phaseKey?: PlayerCombatPhaseKey;
  selectedAttackModeId?: string;
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

  if (!combatPanelModel) {
    return {
      attackStats: null,
      attackModeOptions: [],
      mainHandParryItemLabel,
      offHandParryItemLabel,
      passiveInitiative: 0,
      reference: null,
      selectedAttackModeUsedFallback: false,
    };
  }

  const doubleAttackFieldId =
    input.actionId === "double_attack" && input.phaseKey === "phase2"
      ? secondaryLoadoutLabel && secondaryLoadoutLabel !== "None"
        ? ("secondary" as const)
        : ("primary" as const)
      : undefined;
  const preferredFieldIds = [
    doubleAttackFieldId ?? getRelevantLoadoutFieldId(input.actionId),
    getRelevantLoadoutFieldId(input.secondaryActionId),
  ].filter((value): value is "missile" | "primary" | "secondary" | "throwing" => value !== null);
  const preferredItemSources = preferredFieldIds.flatMap((fieldId) => {
    const itemId = loadoutFieldDisplayMap.get(fieldId)?.value;
    return itemId ? [{ fieldId, itemId }] : [];
  });
  const preferredItemIds = preferredItemSources.map(({ itemId }) => itemId);
  const preferredWeaponLabels = preferredFieldIds
    .map((fieldId) => loadoutFieldDisplayMap.get(fieldId)?.valueLabel)
    .filter((value): value is string => Boolean(value) && value !== "None");
  if (
    input.actionId === "double_attack" &&
    input.allowUnarmedFallback !== false &&
    preferredWeaponLabels.length === 0
  ) {
    preferredWeaponLabels.push(input.phaseKey === "phase2" ? "Kick" : "Punch");
  }
  if (input.allowUnarmedFallback === false && preferredItemIds.length === 0) {
    return {
      attackStats: null,
      attackModeOptions: [],
      mainHandParryItemLabel,
      offHandParryItemLabel,
      passiveInitiative: 0,
      reference: null,
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
        mainHandParryItemLabel,
        offHandParryItemLabel,
        passiveInitiative: 0,
        reference: null,
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
      mainHandParryItemLabel,
      offHandParryItemLabel,
      passiveInitiative: 0,
      reference: null,
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
    provenance: sourceMetadata
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
    attackStats: buildPlayerCombatAttackStats(reference, {
      actionId: input.actionId,
      phaseKey: input.phaseKey,
    }),
    mainHandParryItemLabel,
    offHandParryItemLabel,
    passiveInitiative: parsePassiveInitiative(reference.initiative),
    reference,
    selectedAttackModeId: modeResolution.mode?.id,
    selectedAttackModeUsedFallback: modeResolution.usedFallback,
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
