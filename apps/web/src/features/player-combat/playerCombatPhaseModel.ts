import type { ScenarioParticipantCombatContext } from "@glantri/domain";

import type { EquipmentLoadoutModuleModel } from "@/features/equipment/loadoutModule";
import type { EquipmentFeatureState } from "@/features/equipment/types";
import {
  isPlayerEncounterAttackAction,
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
  attackMode: string;
  combinedDb: string;
  combinedDm: string;
  crit: string;
  db: string;
  dmb: string;
  dm: string;
  initiative: string;
  ob: string;
  parry: string;
  secondCrit: string;
  selectedWeapon: string;
}

export interface PlayerCombatLoadoutSummary {
  attackStats: PlayerCombatAttackStatsView | null;
  mainHandParryItemLabel: string;
  offHandParryItemLabel: string;
  passiveInitiative: number;
  reference: PlayerCombatLoadoutReference | null;
}

export interface PlayerCombatPhasePanelModel {
  attackStats: PlayerCombatAttackStatsView | null;
  defenseStats: PlayerCombatDefenseStatsView | null;
  phaseCard: PlayerCombatPhaseCardView;
  phaseContext: ScenarioParticipantCombatContext;
  phaseKey: PlayerCombatPhaseKey;
  showAttackStats: boolean;
  showDefenseContext: boolean;
}

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
      mainHandParryItemLabel,
      offHandParryItemLabel,
      passiveInitiative: 0,
      reference: null,
    };
  }

  const preferredFieldIds = [
    getRelevantLoadoutFieldId(input.actionId),
    getRelevantLoadoutFieldId(input.secondaryActionId),
  ].filter((value): value is "missile" | "primary" | "secondary" | "throwing" => value !== null);
  const preferredWeaponLabels = preferredFieldIds
    .map((fieldId) => loadoutFieldDisplayMap.get(fieldId)?.valueLabel)
    .filter((value): value is string => Boolean(value) && value !== "None");
  const referenceRow =
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
      attackMode: "—",
      combinedDb: "—",
      combinedDm: "—",
      crit: "—",
      db: "—",
      dmb: "—",
      dm: "—",
      initiative: "—",
      ob: "—",
      parry: "—",
      secondCrit: "—",
      selectedWeapon: "No ready weapon",
    };

    return {
      attackStats: buildPlayerCombatAttackStats(reference),
      mainHandParryItemLabel,
      offHandParryItemLabel,
      passiveInitiative: 0,
      reference,
    };
  }

  const reference = {
    am: getCombatTableCell({
      columns: combatPanelModel.weaponModeTable.columns,
      label: "AM",
      row: referenceRow,
    }),
    attackMode: getCombatTableCell({
      columns: combatPanelModel.weaponModeTable.columns,
      label: "Attack 1",
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
    crit: getCombatTableCell({
      columns: combatPanelModel.weaponModeTable.columns,
      label: "Crit 1",
      row: referenceRow,
    }),
    db: getCombatTableCell({
      columns: combatPanelModel.weaponModeTable.columns,
      label: "DB",
      row: referenceRow,
    }),
    dmb: getCombatTableCell({
      columns: combatPanelModel.weaponModeTable.columns,
      label: "DMB",
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
    ob: getCombatTableCell({
      columns: combatPanelModel.weaponModeTable.columns,
      label: "OB",
      row: referenceRow,
    }),
    parry: getCombatTableCell({
      columns: combatPanelModel.weaponModeTable.columns,
      label: "Parry",
      row: referenceRow,
    }),
    secondCrit: getCombatTableCell({
      columns: combatPanelModel.weaponModeTable.columns,
      label: "Sec",
      row: referenceRow,
    }),
    selectedWeapon: getCombatTableCell({
      columns: combatPanelModel.weaponModeTable.columns,
      label: "Weapon",
      row: referenceRow,
    }),
  };

  return {
    attackStats: buildPlayerCombatAttackStats(reference),
    mainHandParryItemLabel,
    offHandParryItemLabel,
    passiveInitiative: parsePassiveInitiative(reference.initiative),
    reference,
  };
}

export function buildPlayerCombatAttackStats(
  reference: PlayerCombatLoadoutReference | null,
): PlayerCombatAttackStatsView | null {
  if (!reference) {
    return null;
  }

  return {
    attackMode: reference.am,
    dmb: reference.dmb,
    initiative: reference.initiative,
    maxCrits: `${reference.crit}${hasDisplayValue(reference.secondCrit) ? ` / ${reference.secondCrit}` : ""}`,
    ob: reference.ob,
    weaponName: reference.selectedWeapon,
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

  const hasPhaseParryDirection = Boolean(
    input.phaseContext.mainHandParryDirection || input.phaseContext.offHandParryDirection,
  );

  return {
    db: hasDisplayValue(input.reference.combinedDb)
      ? input.reference.combinedDb
      : input.reference.db,
    dm: hasDisplayValue(input.reference.combinedDm)
      ? input.reference.combinedDm
      : input.reference.dm,
    parry: hasPhaseParryDirection ? input.reference.parry : "incomplete",
    sourceName:
      input.offHandParryItemLabel !== "Unarmed"
        ? input.offHandParryItemLabel
        : input.mainHandParryItemLabel,
  };
}

function getPhaseContentFlags(input: {
  actionId: PlayerEncounterActionId | "";
  phaseKey: PlayerCombatPhaseKey;
  secondaryActionId: PlayerEncounterActionId | "";
}): { attack: boolean; defense: boolean } {
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

  const phaseActionId = input.phaseKey === "phase1" ? input.actionId : input.secondaryActionId;

  return {
    attack: isPlayerEncounterAttackAction(phaseActionId),
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

  return {
    attackStats: input.attackStats,
    defenseStats: input.defenseStats,
    phaseCard: input.phaseCard,
    phaseContext: input.phaseContext,
    phaseKey: input.phaseKey,
    showAttackStats: Boolean(input.attackStats && flags.attack),
    showDefenseContext: Boolean(input.defenseStats && flags.defense),
  };
}
