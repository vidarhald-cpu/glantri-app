import type {
  ScenarioParticipantCombatContext,
  ScenarioParticipantParryDirection,
} from "@glantri/domain";
import { getCombatDeclarationAttackPhases, resolvePreferredAttackMode } from "@glantri/domain";

import type { EquipmentLoadoutModuleModel } from "@/features/equipment/loadoutModule";
import type { EquipmentFeatureState } from "@/features/equipment/types";
import {
  isPlayerEncounterDefenseAction,
  type PlayerEncounterActionId,
} from "@/lib/campaigns/playerEncounter";

import type {
  PlayerCombatAttackStatsView,
  PlayerCombatDefenseStatsView,
  PlayerCombatPhaseCardView,
} from "./PlayerCombatPanels";

export type PlayerCombatPhaseKey = "phase1" | "phase2";

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
  secondCrit: string;
  selectedWeapon: string;
  sourceAttackModeId?: string;
  sourceItemId?: string;
  sourceTemplateId?: string;
}

export interface PlayerCombatLoadoutSummary {
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
    case "parry_disarm":
    case "disarm":
    case "observe_opponent":
    case "break_off_engagement":
    case "other":
      return "primary";
    default:
      return null;
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

export function buildPlayerCombatLoadoutSummary(input: {
  actionId: PlayerEncounterActionId | "";
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
  const preferredItemIds = preferredFieldIds
    .map((fieldId) => loadoutFieldDisplayMap.get(fieldId)?.value)
    .filter((value): value is string => Boolean(value));
  const preferredWeaponLabels = preferredFieldIds
    .map((fieldId) => loadoutFieldDisplayMap.get(fieldId)?.valueLabel)
    .filter((value): value is string => Boolean(value) && value !== "None");
  if (input.actionId === "double_attack" && preferredWeaponLabels.length === 0) {
    preferredWeaponLabels.push(input.phaseKey === "phase2" ? "Kick" : "Punch");
  }
  const referenceRow =
    preferredItemIds
      .map(
        (itemId) =>
          combatPanelModel.weaponRows?.find((row) => row.itemId === itemId) ?? null,
      )
      .map((rawRow) =>
        rawRow
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
                weaponLabel === rawRow.currentItemLabel && modeLabel === rawRow.modeLabel
              );
            }) ?? null)
          : null,
      )
      .find((row) => row !== null) ??
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
    combatPanelModel.weaponModeTable.rows[0] ??
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
  const rawReferenceRow = combatPanelModel.weaponRows?.find(
    (row) =>
      row.currentItemLabel === referenceWeaponLabel && row.modeLabel === referenceModeLabel,
  );
  const primaryItemId = loadoutFieldDisplayMap.get("primary")?.value;
  const selectedSourceItemId = rawReferenceRow?.itemId;
  const requireRepeatedRoundAttack = Boolean(
    input.actionId === "double_attack" &&
      input.phaseKey === "phase2" &&
      primaryItemId &&
      selectedSourceItemId === primaryItemId,
  );
  const modeResolution = resolvePreferredAttackMode({
    requireRepeatedRoundAttack,
    selectedModeId: input.selectedAttackModeId,
    weapon: {
      attackModes: rawReferenceRow?.attackModes ?? [],
    },
  });
  const selectedDerivedMode = modeResolution.mode;
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
    initiative: getCombatTableCell({
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
    secondCrit: selectedDerivedMode
      ? String(selectedDerivedMode.secondCrit)
      : getCombatTableCell({
      columns: combatPanelModel.weaponModeTable.columns,
      label: "Sec",
      row: referenceRow,
        }),
    selectedWeapon: referenceWeaponLabel,
    sourceAttackModeId: modeResolution.mode?.id ?? rawReferenceRow?.attackMode1Id,
    sourceItemId: rawReferenceRow?.itemId,
    sourceTemplateId: rawReferenceRow?.templateId,
  };

  return {
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
}): { attack: boolean; defense: boolean } {
  const attackPhases = getCombatDeclarationAttackPhases({
    actionId: input.actionId,
    secondaryActionId: input.secondaryActionId,
  });

  if (input.actionId === "attack_parry") {
    return input.phaseKey === "phase1"
      ? { attack: true, defense: true }
      : { attack: false, defense: true };
  }

  if (input.actionId === "parry_attack") {
    return input.phaseKey === "phase1"
      ? { attack: false, defense: true }
      : { attack: true, defense: true };
  }

  if (input.actionId === "adjust_range_attack") {
    return input.phaseKey === "phase1"
      ? { attack: false, defense: false }
      : { attack: true, defense: false };
  }

  if (input.actionId === "double_attack") {
    return { attack: true, defense: true };
  }

  const phaseActionId = input.phaseKey === "phase1" ? input.actionId : input.secondaryActionId;

  return {
    attack: attackPhases.includes(input.phaseKey),
    defense: isPlayerEncounterDefenseAction(phaseActionId),
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
    showDefenseContext: Boolean(input.defenseStats && flags.defense),
  };
}
