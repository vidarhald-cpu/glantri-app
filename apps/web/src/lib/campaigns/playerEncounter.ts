export type PlayerEncounterActionId =
  | "attack"
  | "parry"
  | "missile"
  | "throw"
  | "dodge"
  | "ready"
  | "observe"
  | "speak"
  | "hold";

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

export const PLAYER_ENCOUNTER_ACTION_OPTIONS: PlayerEncounterOption<PlayerEncounterActionId>[] = [
  { label: "Attack", value: "attack" },
  { label: "Parry", value: "parry" },
  { label: "Missile attack", value: "missile" },
  { label: "Throwing attack", value: "throw" },
  { label: "Dodge", value: "dodge" },
  { label: "Ready / change grip", value: "ready" },
  { label: "Observe", value: "observe" },
  { label: "Speak", value: "speak" },
  { label: "Hold / wait", value: "hold" },
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

export function buildPlayerEncounterPhaseSummary(input: {
  actionId: PlayerEncounterActionId | "";
  secondaryActionId: PlayerEncounterActionId | "";
}): PlayerEncounterPhaseSummary {
  return {
    phaseOne: getPlayerEncounterActionLabel(input.actionId),
    phaseTwo: getPlayerEncounterActionLabel(input.secondaryActionId),
  };
}
