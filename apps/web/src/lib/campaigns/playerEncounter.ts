import type {
  ScenarioCombatModifierEntry,
  ScenarioParticipantCombatContext,
  ScenarioParticipantIncomingAttackSide,
  ScenarioParticipantParrySource,
} from "@glantri/domain";

export type PlayerEncounterActionId =
  | "attack_parry"
  | "parry_attack"
  | "double_attack"
  | "feint_attack"
  | "adjust_range_attack"
  | "counterattack"
  | "observe_opponent"
  | "offensive_parry"
  | "parry_disarm"
  | "disarm"
  | "break_off_engagement"
  | "other";

export type PlayerEncounterMovementId =
  | "hold"
  | "step"
  | "advance"
  | "withdraw"
  | "run"
  | "take-cover";

export interface PlayerEncounterOption<TValue extends string> {
  label: string;
  value: TValue;
}

export interface PlayerEncounterPhaseSummary {
  phaseOne: string;
  phaseTwo: string;
}

export interface PlayerEncounterCombatModifierTotals {
  attackTotal: number;
  defenseTotal: number;
  generalTotal: number;
  situationDbTotal: number;
  situationObSkillTotal: number;
}

export interface PlayerEncounterParryLegalityResult {
  reason: string;
  resolvedParrySource?: Exclude<ScenarioParticipantParrySource, "auto">;
  status: "incomplete" | "legal" | "not_legal";
}

export const PLAYER_ENCOUNTER_ACTION_OPTIONS: PlayerEncounterOption<PlayerEncounterActionId>[] = [
  { label: "Attack - Parry", value: "attack_parry" },
  { label: "Parry - Attack", value: "parry_attack" },
  { label: "Double Attack", value: "double_attack" },
  { label: "Feint - Attack", value: "feint_attack" },
  { label: "Adjust Range - Attack", value: "adjust_range_attack" },
  { label: "Counterattack", value: "counterattack" },
  { label: "Observe Opponent", value: "observe_opponent" },
  { label: "Offensive Parry", value: "offensive_parry" },
  { label: "Parry - Disarm", value: "parry_disarm" },
  { label: "Disarm", value: "disarm" },
  { label: "Break Off Engagement", value: "break_off_engagement" },
  { label: "Other", value: "other" },
];

export const PLAYER_ENCOUNTER_MOVEMENT_OPTIONS: PlayerEncounterOption<PlayerEncounterMovementId>[] =
  [
    { label: "Hold position", value: "hold" },
    { label: "Step", value: "step" },
    { label: "Advance", value: "advance" },
    { label: "Withdraw", value: "withdraw" },
    { label: "Run", value: "run" },
    { label: "Take cover", value: "take-cover" },
  ];

export const PLAYER_ENCOUNTER_INCOMING_ATTACK_SIDE_OPTIONS: PlayerEncounterOption<ScenarioParticipantIncomingAttackSide>[] =
  [
    { label: "Front", value: "front" },
    { label: "Left", value: "left" },
    { label: "Right", value: "right" },
    { label: "Rear", value: "rear" },
  ];

export const PLAYER_ENCOUNTER_PARRY_SOURCE_OPTIONS: PlayerEncounterOption<ScenarioParticipantParrySource>[] =
  [
    { label: "Auto", value: "auto" },
    { label: "Main hand", value: "mainHand" },
    { label: "Off hand", value: "offHand" },
    { label: "Shield", value: "shield" },
  ];

function sumModifierEntries(entries: ScenarioCombatModifierEntry[]): number {
  return entries.reduce((sum, entry) => sum + entry.value, 0);
}

export function createEmptyPlayerEncounterCombatContext(): ScenarioParticipantCombatContext {
  return {
    modifierBuckets: {
      general: [],
      situationDb: [],
      situationObSkill: [],
    },
  };
}

export function getPlayerEncounterCombatModifierTotals(
  combatContext?: ScenarioParticipantCombatContext,
): PlayerEncounterCombatModifierTotals {
  const generalTotal = sumModifierEntries(combatContext?.modifierBuckets.general ?? []);
  const situationObSkillTotal = sumModifierEntries(
    combatContext?.modifierBuckets.situationObSkill ?? [],
  );
  const situationDbTotal = sumModifierEntries(combatContext?.modifierBuckets.situationDb ?? []);

  return {
    attackTotal: generalTotal + situationObSkillTotal,
    defenseTotal: generalTotal + situationDbTotal,
    generalTotal,
    situationDbTotal,
    situationObSkillTotal,
  };
}

export function evaluatePlayerEncounterParryLegality(input: {
  actionId: PlayerEncounterActionId | "";
  attackSource?: Exclude<ScenarioParticipantParrySource, "auto">;
  hasOffHandWeapon: boolean;
  hasShield: boolean;
  hasSelectedOpponent?: boolean;
  incomingAttackSide?: ScenarioParticipantIncomingAttackSide;
  parrySource?: ScenarioParticipantParrySource;
}): PlayerEncounterParryLegalityResult {
  if (input.actionId !== "attack_parry") {
    return {
      reason: "Parry context applies to Attack - Parry in this first pass.",
      status: "incomplete",
    };
  }

  if (!input.hasSelectedOpponent || !input.parrySource) {
    return {
      reason: "Choose opponent and parry source.",
      status: "incomplete",
    };
  }

  const availableResolvedSources: Array<Exclude<ScenarioParticipantParrySource, "auto">> = [];
  if (input.hasShield) {
    availableResolvedSources.push("shield");
  }
  if (input.hasOffHandWeapon) {
    availableResolvedSources.push("offHand");
  }
  availableResolvedSources.push("mainHand");

  const requestedSource =
    input.parrySource === "auto"
      ? availableResolvedSources.find((source) => source !== input.attackSource)
      : input.parrySource;

  if (!requestedSource) {
    return {
      reason: "No available parry source is free from the current attack source.",
      status: "not_legal",
    };
  }

  if (requestedSource === "shield" && !input.hasShield) {
    return {
      reason: "No ready shield is available for parry.",
      status: "not_legal",
    };
  }

  if (requestedSource === "offHand" && !input.hasOffHandWeapon) {
    return {
      reason: "No off-hand weapon is available for parry.",
      status: "not_legal",
    };
  }

  if (input.attackSource && requestedSource === input.attackSource) {
    return {
      reason: "The same item/source cannot be used for both attack and parry in the same phase.",
      resolvedParrySource: requestedSource,
      status: "not_legal",
    };
  }

  return {
    reason: `${getPlayerEncounterParrySourceLabel(requestedSource)} is available for parry.`,
    resolvedParrySource: requestedSource,
    status: "legal",
  };
}

export function getPlayerEncounterActionLabel(
  actionId: PlayerEncounterActionId | "",
): string {
  if (!actionId) {
    return "Open";
  }

  return (
    PLAYER_ENCOUNTER_ACTION_OPTIONS.find((option) => option.value === actionId)?.label ?? "Open"
  );
}

export function getPlayerEncounterMovementLabel(
  movementId: PlayerEncounterMovementId | "",
): string {
  if (!movementId) {
    return "Hold position";
  }

  return (
    PLAYER_ENCOUNTER_MOVEMENT_OPTIONS.find((option) => option.value === movementId)?.label ??
    "Hold position"
  );
}

export function getPlayerEncounterParrySourceLabel(
  parrySource: ScenarioParticipantParrySource | Exclude<ScenarioParticipantParrySource, "auto">,
): string {
  return (
    PLAYER_ENCOUNTER_PARRY_SOURCE_OPTIONS.find((option) => option.value === parrySource)?.label ??
    "Parry source"
  );
}

export function buildPlayerEncounterPhaseSummary(input: {
  actionId: PlayerEncounterActionId | "";
  secondaryActionId: PlayerEncounterActionId | "";
}): PlayerEncounterPhaseSummary {
  return {
    phaseOne: getPlayerEncounterActionLabel(input.actionId),
    phaseTwo: getPlayerEncounterActionLabel(input.secondaryActionId),
  };
}
