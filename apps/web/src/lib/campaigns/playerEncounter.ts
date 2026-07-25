import {
  getCombatDeclarationActionLabel,
  type ScenarioCombatModifierEntry,
  type ScenarioParticipantCombatContext,
  type ScenarioParticipantIncomingAttackSide,
  type ScenarioParticipantParryDirection,
  type ScenarioParticipantParrySource,
  type ScenarioParticipant,
  type ScenarioPlayerVisibleParticipant,
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
  | "parry"
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
  situationInitiativeTotal: number;
  situationDbTotal: number;
  situationObSkillTotal: number;
}

export interface PlayerEncounterParryLegalityResult {
  reason: string;
  resolvedParrySource?: Exclude<ScenarioParticipantParrySource, "auto">;
  status: "incomplete" | "legal" | "not_legal";
}

export interface PlayerEncounterParticipantAccessInput {
  allowedParticipantIds?: readonly string[];
  currentUserId?: string;
  isGameMaster: boolean;
  participants: ScenarioParticipant[];
  projectionVisibleParticipants?: ScenarioPlayerVisibleParticipant[];
  selectedParticipantId?: string;
}

export interface PlayerEncounterOpponentOption {
  displayName: string;
  id: string;
}

export const PLAYER_ENCOUNTER_ACTION_OPTIONS: PlayerEncounterOption<PlayerEncounterActionId>[] = [
  { label: getCombatDeclarationActionLabel("attack_parry"), value: "attack_parry" },
  { label: getCombatDeclarationActionLabel("parry_attack"), value: "parry_attack" },
  { label: "Double Attack", value: "double_attack" },
  { label: "Feint - Attack", value: "feint_attack" },
  { label: "Adjust Distance-Attack", value: "adjust_range_attack" },
  { label: "Counterattack", value: "counterattack" },
  { label: "Offensive Parry", value: "offensive_parry" },
  { label: getCombatDeclarationActionLabel("parry"), value: "parry" },
  { label: "Parry - Disarm", value: "parry_disarm" },
  { label: "Disarm", value: "disarm" },
  { label: "Break Off Engagement", value: "break_off_engagement" },
  { label: "Other", value: "other" },
];

export const PLAYER_ENCOUNTER_SECONDARY_ACTION_OPTIONS: PlayerEncounterOption<PlayerEncounterActionId>[] =
  [
    { label: getCombatDeclarationActionLabel("attack_parry"), value: "attack_parry" },
    { label: getCombatDeclarationActionLabel("parry_attack"), value: "parry_attack" },
    { label: "Double Attack", value: "double_attack" },
    { label: "Feint - Attack", value: "feint_attack" },
    { label: "Adjust Distance-Attack", value: "adjust_range_attack" },
    { label: "Counterattack", value: "counterattack" },
    { label: getCombatDeclarationActionLabel("observe_opponent"), value: "observe_opponent" },
    { label: "Offensive Parry", value: "offensive_parry" },
    { label: "Parry - Disarm", value: "parry_disarm" },
    { label: "Disarm", value: "disarm" },
    { label: "Break Off Engagement", value: "break_off_engagement" },
    { label: "Other", value: "other" },
  ];

export function isPlayerEncounterActionId(value: unknown): value is PlayerEncounterActionId {
  if (typeof value !== "string") {
    return false;
  }

  return [...PLAYER_ENCOUNTER_ACTION_OPTIONS, ...PLAYER_ENCOUNTER_SECONDARY_ACTION_OPTIONS].some(
    (option) => option.value === value,
  );
}

export const PLAYER_ENCOUNTER_MOVEMENT_OPTIONS: PlayerEncounterOption<PlayerEncounterMovementId>[] =
  [
    { label: "Maintain distance to opponent", value: "hold" },
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

export const PLAYER_ENCOUNTER_PARRY_DIRECTION_OPTIONS: PlayerEncounterOption<ScenarioParticipantParryDirection>[] =
  [
    { label: "Left/backward", value: "left_backward" },
    { label: "Left", value: "left" },
    { label: "Left/forward", value: "left_forward" },
    { label: "Forward", value: "forward" },
    { label: "Right/forward", value: "right_forward" },
    { label: "Right", value: "right" },
    { label: "Right/backward", value: "right_backward" },
  ];

export function getPlayerEncounterParryDirectionLabel(
  direction: ScenarioParticipantParryDirection,
): string {
  return (
    PLAYER_ENCOUNTER_PARRY_DIRECTION_OPTIONS.find((option) => option.value === direction)?.label ??
    direction
  );
}

export function getPlayerEncounterParryCoverageDirection(
  direction: ScenarioParticipantParryDirection,
): ScenarioParticipantParryDirection {
  const directionIndex = PLAYER_ENCOUNTER_PARRY_DIRECTION_OPTIONS.findIndex(
    (option) => option.value === direction,
  );
  const nextIndex = Math.min(
    directionIndex + 2,
    PLAYER_ENCOUNTER_PARRY_DIRECTION_OPTIONS.length - 1,
  );

  // The workbook notes provided for this pass do not approve wrapping past right/backward.
  // Clamp at the edge so the recorded coverage stays inside the explicit direction wheel.
  return PLAYER_ENCOUNTER_PARRY_DIRECTION_OPTIONS[Math.max(nextIndex, 0)]?.value ?? direction;
}

function sumModifierEntries(entries: ScenarioCombatModifierEntry[]): number {
  return entries.reduce((sum, entry) => sum + entry.value, 0);
}

export function createEmptyPlayerEncounterCombatContext(): ScenarioParticipantCombatContext {
  return {
    modifierBuckets: {
      general: [],
      situationDb: [],
      situationInitiative: [],
      situationObSkill: [],
    },
  };
}

export function mergeCombatContextWithCurrentModifierBuckets(input: {
  baseContext?: ScenarioParticipantCombatContext;
  currentContext?: ScenarioParticipantCombatContext;
}): ScenarioParticipantCombatContext {
  const baseContext = input.baseContext ?? createEmptyPlayerEncounterCombatContext();
  const currentContext = input.currentContext;

  if (!currentContext) {
    return baseContext;
  }

  return {
    ...baseContext,
    modifierBuckets: currentContext.modifierBuckets,
  };
}

export function getPlayerEncounterCombatModifierTotals(
  combatContext?: ScenarioParticipantCombatContext,
): PlayerEncounterCombatModifierTotals {
  const generalTotal = sumModifierEntries(combatContext?.modifierBuckets.general ?? []);
  const situationObSkillTotal = sumModifierEntries(
    combatContext?.modifierBuckets.situationObSkill ?? [],
  );
  // situationDb is the backward-compatible storage key for the DB/Parry bucket.
  const situationDbTotal = sumModifierEntries(combatContext?.modifierBuckets.situationDb ?? []);
  const situationInitiativeTotal = sumModifierEntries(
    combatContext?.modifierBuckets.situationInitiative ?? [],
  );

  return {
    attackTotal: generalTotal + situationObSkillTotal,
    defenseTotal: generalTotal + situationDbTotal,
    generalTotal,
    situationDbTotal,
    situationInitiativeTotal,
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
      reason: "Parry context applies to Single attack in this first pass.",
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

export function getPlayerEncounterActionLabel(actionId: PlayerEncounterActionId | ""): string {
  if (!actionId) {
    return "Open";
  }

  return (
    [...PLAYER_ENCOUNTER_ACTION_OPTIONS, ...PLAYER_ENCOUNTER_SECONDARY_ACTION_OPTIONS].find(
      (option) => option.value === actionId,
    )?.label ?? "Open"
  );
}

export function getPlayerEncounterMovementLabel(
  movementId: PlayerEncounterMovementId | "",
): string {
  if (!movementId) {
    return "Maintain distance to opponent";
  }

  return (
    PLAYER_ENCOUNTER_MOVEMENT_OPTIONS.find((option) => option.value === movementId)?.label ??
    "Maintain distance to opponent"
  );
}

export function isPlayerEncounterAttackAction(actionId: PlayerEncounterActionId | ""): boolean {
  return (
    actionId === "attack_parry" ||
    actionId === "parry_attack" ||
    actionId === "double_attack" ||
    actionId === "feint_attack" ||
    actionId === "adjust_range_attack" ||
    actionId === "counterattack" ||
    actionId === "disarm"
  );
}

export function isPlayerEncounterDefenseAction(actionId: PlayerEncounterActionId | ""): boolean {
  return (
    actionId === "attack_parry" ||
    actionId === "parry_attack" ||
    actionId === "offensive_parry" ||
    actionId === "parry" ||
    actionId === "parry_disarm"
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

export function getPlayerEncounterAccessibleParticipants(
  input: Omit<PlayerEncounterParticipantAccessInput, "selectedParticipantId">,
): ScenarioParticipant[] {
  return input.participants.filter((participant) => {
    if (!participant.isActive) {
      return false;
    }

    if (input.isGameMaster) {
      return true;
    }

    return participant.controlledByUserId === input.currentUserId;
  });
}

export function getPlayerEncounterOpponentParticipants(
  input: PlayerEncounterParticipantAccessInput,
): PlayerEncounterOpponentOption[] {
  const allowedParticipantIds = input.allowedParticipantIds
    ? new Set(input.allowedParticipantIds)
    : undefined;

  if (!input.isGameMaster) {
    return (input.projectionVisibleParticipants ?? [])
      .filter(
        (participant) =>
          participant.isActive &&
          participant.id !== input.selectedParticipantId &&
          !participant.isControlledByPlayer &&
          (!allowedParticipantIds || allowedParticipantIds.has(participant.id)),
      )
      .map((participant) => ({
        displayName: participant.displayName,
        id: participant.id,
      }));
  }

  return input.participants
    .filter((participant) => {
      if (!participant.isActive || participant.id === input.selectedParticipantId) {
        return false;
      }

      return !allowedParticipantIds || allowedParticipantIds.has(participant.id);
    })
    .map((participant) => ({
      displayName: participant.snapshot.displayName,
      id: participant.id,
    }));
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
