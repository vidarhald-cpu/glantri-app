import type {
  EncounterParticipant,
  Scenario,
  ScenarioParticipant,
  ScenarioParticipantCombatContext,
  ScenarioLiveState,
} from "@glantri/domain";
import { hasScenarioParticipantCombatDeclarationForEncounterRound } from "@glantri/domain";

import {
  buildPlayerEncounterPhaseSummary,
  getPlayerEncounterActionLabel,
  getPlayerEncounterCombatModifierTotals,
  isPlayerEncounterActionId,
} from "./playerEncounter";

export interface GmEncounterParticipantRow {
  displayName: string;
  encounterParticipantId: string;
  hasDeclaredAction: boolean;
  hasInitiative: boolean;
  phaseOneAction: string;
  phaseOneAdjustments: string;
  phaseOneInitiative: string;
  phaseOneResults: string;
  phaseTwoAction: string;
  phaseTwoAdjustments: string;
  phaseTwoInitiative: string;
  phaseTwoResults: string;
  scenarioParticipantId?: string;
  selectedAction: string;
  target: string;
}

export interface GmEncounterControlState {
  disabled: boolean;
  label: string;
}

function findScenarioParticipantForEncounterParticipant(input: {
  encounterParticipant: EncounterParticipant;
  scenarioParticipants: ScenarioParticipant[];
}): ScenarioParticipant | undefined {
  const activeParticipants = input.scenarioParticipants.filter(
    (participant) => participant.isActive,
  );

  if (input.encounterParticipant.characterId) {
    return activeParticipants.find(
      (participant) => participant.characterId === input.encounterParticipant.characterId,
    );
  }

  const encounterLabel = input.encounterParticipant.label.trim().toLowerCase();
  const adHocName = input.encounterParticipant.adHocName?.trim().toLowerCase();

  return activeParticipants.find((participant) => {
    const snapshotName = participant.snapshot.displayName.trim().toLowerCase();
    return snapshotName === encounterLabel || snapshotName === adHocName;
  });
}

function formatModifierSummary(
  combatContext: ScenarioParticipantCombatContext | undefined,
): string {
  const totals = getPlayerEncounterCombatModifierTotals(combatContext);

  if (totals.attackTotal === 0 && totals.defenseTotal === 0) {
    return "—";
  }

  return `ATK ${totals.attackTotal >= 0 ? "+" : ""}${totals.attackTotal} · DEF ${totals.defenseTotal >= 0 ? "+" : ""}${totals.defenseTotal}`;
}

function buildTargetNameById(scenarioParticipants: ScenarioParticipant[]): Map<string, string> {
  return new Map(
    scenarioParticipants.map((participant) => [participant.id, participant.snapshot.displayName]),
  );
}

export function buildGmEncounterParticipantRows(input: {
  encounterId?: string;
  encounterParticipants: EncounterParticipant[];
  roundNumber?: number;
  scenarioParticipants: ScenarioParticipant[];
}): GmEncounterParticipantRow[] {
  const targetNameById = buildTargetNameById(input.scenarioParticipants);

  return input.encounterParticipants.map((encounterParticipant) => {
    const scenarioParticipant = findScenarioParticipantForEncounterParticipant({
      encounterParticipant,
      scenarioParticipants: input.scenarioParticipants,
    });
    const scopedCombat = hasScenarioParticipantCombatDeclarationForEncounterRound({
      encounterId: input.encounterId,
      participant: scenarioParticipant,
      roundNumber: input.roundNumber,
    })
      ? scenarioParticipant?.state.combat
      : undefined;
    const actionId = isPlayerEncounterActionId(scopedCombat?.lastDeclaredActionId)
      ? scopedCombat.lastDeclaredActionId
      : undefined;
    const phaseSummary = buildPlayerEncounterPhaseSummary({
      actionId: actionId ?? "",
      secondaryActionId: "",
    });
    const selectedTargetId = scopedCombat?.combatContext.selectedOpponentId;
    const fallbackEncounterTargetId = encounterParticipant.declaration.targetParticipantId;

    return {
      displayName: encounterParticipant.label,
      encounterParticipantId: encounterParticipant.id,
      hasDeclaredAction: Boolean(actionId),
      hasInitiative: scenarioParticipant?.state.combat.initiativeRoll !== undefined,
      phaseOneAction: actionId ? phaseSummary.phaseOne : "—",
      phaseOneAdjustments: formatModifierSummary(scopedCombat?.combatContext),
      phaseOneInitiative:
        scenarioParticipant?.state.combat.initiativeRoll !== undefined
          ? String(scenarioParticipant.state.combat.initiativeRoll)
          : "—",
      phaseOneResults: "—",
      phaseTwoAction: actionId ? phaseSummary.phaseTwo : "—",
      phaseTwoAdjustments: "—",
      phaseTwoInitiative: "—",
      phaseTwoResults: "—",
      scenarioParticipantId: scenarioParticipant?.id,
      selectedAction: actionId ? getPlayerEncounterActionLabel(actionId) : "Waiting for action",
      target:
        (selectedTargetId ? targetNameById.get(selectedTargetId) : undefined) ??
        (fallbackEncounterTargetId
          ? input.encounterParticipants.find(
              (participant) => participant.id === fallbackEncounterTargetId,
            )?.label
          : undefined) ??
        "—",
    };
  });
}

export function deriveGmEncounterControlState(input: {
  rows: GmEncounterParticipantRow[];
  scenario?: Scenario | null;
  scenarioLiveState?: ScenarioLiveState;
}): GmEncounterControlState {
  if (input.rows.length === 0 || input.rows.some((row) => !row.hasDeclaredAction)) {
    return {
      disabled: true,
      label: "Waiting for action selections",
    };
  }

  if (input.rows.some((row) => !row.hasInitiative)) {
    return {
      disabled: false,
      label: "Resolve initiative",
    };
  }

  const activePhase = input.scenarioLiveState?.phase ?? input.scenario?.liveState?.phase ?? 1;

  return {
    disabled: false,
    label: activePhase === 2 ? "Resolve Phase 2" : "Resolve Phase 1",
  };
}
