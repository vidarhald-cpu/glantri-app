"use client";

import { useMemo, useState } from "react";

import type { EncounterSession, ScenarioParticipant } from "@glantri/domain";

import {
  buildGmCharacterWorkspaceCandidates,
  resolvePlayerCharacterWorkspaceCandidate,
} from "@/lib/campaigns/characterWorkspace";
import {
  refreshScenarioParticipantEquipmentOnServer,
  updateScenarioParticipantStateOnServer,
} from "@/lib/api/scenarioClient";
import CharacterLoadoutView from "../../characters/[id]/components/CharacterLoadoutView";
import WorkspaceParticipantInspectionHeader from "./WorkspaceParticipantInspectionHeader";

interface CharacterWorkspacePanelProps {
  activeEncounter?: EncounterSession;
  currentRoundNumber?: number;
  currentUserId?: string | null;
  isGameMaster: boolean;
  onScenarioParticipantUpdated?: (participant: ScenarioParticipant) => void;
  onSelectParticipantId?: (participantId: string) => void;
  scenarioId?: string;
  scenarioParticipants: ScenarioParticipant[];
  selectedParticipantId?: string | null;
}

const panelStyle = {
  border: "1px solid #d9ddd8",
  borderRadius: 12,
  display: "grid",
  gap: "0.75rem",
  padding: "1rem",
} as const;

export default function CharacterWorkspacePanel({
  activeEncounter,
  currentRoundNumber,
  currentUserId,
  isGameMaster,
  onScenarioParticipantUpdated,
  onSelectParticipantId,
  scenarioId,
  scenarioParticipants,
  selectedParticipantId,
}: CharacterWorkspacePanelProps) {
  const gmCandidates = useMemo(
    () =>
      buildGmCharacterWorkspaceCandidates({
        activeEncounter,
        scenarioId,
        scenarioParticipants,
      }),
    [activeEncounter, scenarioId, scenarioParticipants],
  );
  const playerCandidate = useMemo(
    () =>
      resolvePlayerCharacterWorkspaceCandidate({
        activeEncounter,
        scenarioId,
        scenarioParticipants,
        userId: currentUserId,
      }),
    [activeEncounter, currentUserId, scenarioId, scenarioParticipants],
  );
  const selectedGmCandidate =
    gmCandidates.find((candidate) => candidate.id === selectedParticipantId) ?? gmCandidates[0];
  const selectedCandidate = isGameMaster ? selectedGmCandidate : playerCandidate;
  const [saveError, setSaveError] = useState<string>();
  const [saveFeedback, setSaveFeedback] = useState<string>();

  async function refreshSelectedScenarioEquipment() {
    if (!isGameMaster || !scenarioId || !selectedCandidate) {
      return;
    }

    try {
      const participant = await refreshScenarioParticipantEquipmentOnServer({
        participantId: selectedCandidate.scenarioParticipant.id,
        scenarioId,
      });
      onScenarioParticipantUpdated?.(participant);
      setSaveError(undefined);
      setSaveFeedback(`${participant.snapshot.displayName}’s scenario equipment was refreshed.`);
    } catch (caughtError) {
      setSaveFeedback(undefined);
      setSaveError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to refresh scenario equipment for Combat.",
      );
      throw caughtError;
    }
  }

  async function updateSelectedCombatEffects(
    nextCombatEffects: NonNullable<ScenarioParticipant["state"]["combatEffects"]>,
  ) {
    if (!isGameMaster || !scenarioId || !selectedCandidate) {
      return;
    }

    try {
      const participant = await updateScenarioParticipantStateOnServer({
        participantId: selectedCandidate.scenarioParticipant.id,
        scenarioId,
        state: {
          ...selectedCandidate.scenarioParticipant.state,
          combatEffects: nextCombatEffects,
        },
      });

      onScenarioParticipantUpdated?.(participant);
      setSaveError(undefined);
      setSaveFeedback(undefined);
    } catch (caughtError) {
      setSaveError(
        caughtError instanceof Error ? caughtError.message : "Unable to save combat effects.",
      );
      throw caughtError;
    }
  }

  if (!scenarioId) {
    return (
      <section style={panelStyle}>
        <strong>No active scenario is currently available.</strong>
      </section>
    );
  }

  if (!isGameMaster && !selectedCandidate) {
    return (
      <section style={panelStyle}>
        <strong>You are not currently assigned to a character in this scenario.</strong>
      </section>
    );
  }

  if (isGameMaster && gmCandidates.length === 0) {
    return (
      <section style={panelStyle}>
        <strong>No character sheet is available for this participant.</strong>
      </section>
    );
  }

  return (
    <section style={{ display: "grid", gap: "1rem" }}>
      <WorkspaceParticipantInspectionHeader
        candidates={gmCandidates}
        isGameMaster={isGameMaster}
        onSelectParticipantId={onSelectParticipantId}
        screenName="Character"
        selectedCandidate={selectedCandidate}
      />

      {selectedCandidate ? (
        <>
          {saveError ? (
            <section
              style={{
                background: "#fdf0ea",
                border: "1px solid #e4b9a7",
                borderRadius: 12,
                color: "#8b3a1a",
                padding: "1rem",
              }}
            >
              {saveError}
            </section>
          ) : null}
          {saveFeedback ? (
            <section
              style={{
                background: "#eef7ed",
                border: "1px solid #b8d7b5",
                borderRadius: 12,
                color: "#315b2d",
                padding: "1rem",
              }}
            >
              {saveFeedback}
            </section>
          ) : null}
          <CharacterLoadoutView
            canEditCombatEffects={isGameMaster}
            characterId={selectedCandidate.characterId}
            onCombatEffectsChange={isGameMaster ? updateSelectedCombatEffects : undefined}
            onEquipmentStateChange={isGameMaster ? refreshSelectedScenarioEquipment : undefined}
            physicalStateCombatContext={
              selectedCandidate.scenarioParticipant.state.combat.combatContext
            }
            physicalStateCombatEffects={selectedCandidate.scenarioParticipant.state.combatEffects}
            physicalStateCurrentRoundNumber={currentRoundNumber}
            physicalStateEncounterId={activeEncounter?.id}
            physicalStateGeneralHitpoints={selectedCandidate.scenarioParticipant.state.health.maxHp}
            physicalStateScenarioId={scenarioId}
            physicalStateTargetParticipantId={selectedCandidate.scenarioParticipant.id}
            preferCurrentCharacterRecord
            showPhysicalState
          />
        </>
      ) : null}
    </section>
  );
}
