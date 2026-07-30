import React from "react";
import type {
  CombatObservationRelationship,
  ProjectedCombatHistoryEvent,
  ProjectedCombatHistoryPhasePanel,
  ProjectedCombatHistorySnapshot,
} from "@glantri/domain";

import {
  PlayerCombatAttackLocationSelector,
  PlayerCombatAttackModeSelector,
  PlayerCombatAttackStatsTable,
  PlayerCombatAttackTargetSelector,
  PlayerCombatDefenseStatsTable,
  PlayerCombatHistoricalActionSelectorPanel,
  PlayerCombatHistoricalContextPanel,
  PlayerCombatModifierPanel,
  PlayerCombatObservationProgress,
  PlayerCombatParryContextPanel,
  PlayerCombatPhasePanel,
  playerCombatPanelCardStyle,
  playerCombatPanelRowStyle,
  playerCombatTopPanelRowStyle,
  type PlayerCombatDistancePreferenceOption,
} from "@/features/player-combat/PlayerCombatPanels";
import {
  createEmptyPlayerEncounterCombatContext,
  PLAYER_ENCOUNTER_ACTION_OPTIONS,
  PLAYER_ENCOUNTER_MOVEMENT_OPTIONS,
  PLAYER_ENCOUNTER_SECONDARY_ACTION_OPTIONS,
} from "@/lib/campaigns/playerEncounter";

import { CombatEventResultList } from "./CombatEventResultList";

const noop = () => undefined;
const historicalDataMissingMessage = "No information available for this panel.";

function historicalActionLabel(actionId?: string): string | undefined {
  if (!actionId) return undefined;
  return (
    [...PLAYER_ENCOUNTER_ACTION_OPTIONS, ...PLAYER_ENCOUNTER_SECONDARY_ACTION_OPTIONS].find(
      (option) => option.value === actionId,
    )?.label ?? actionId
  );
}

function MissingHistoricalPanel(input: { title: string }) {
  return (
    <section aria-label={input.title} style={playerCombatPanelCardStyle}>
      <strong>{input.title}</strong>
      <div style={{ color: "#5e5a50", fontSize: "0.85rem" }}>{historicalDataMissingMessage}</div>
    </section>
  );
}

function HistoricalPhasePanel(input: {
  actionId?: string;
  observationRelationships: readonly CombatObservationRelationship[];
  observationTargetLabels: Readonly<Record<string, string>>;
  panel: ProjectedCombatHistoryPhasePanel;
  phaseLabel: "Phase 1" | "Phase 2";
  secondaryActionId?: string;
}) {
  const recorded = Object.keys(input.panel).length > 0;
  if (!recorded) return <MissingHistoricalPanel title={input.phaseLabel} />;

  const context = input.panel.phaseContext ?? createEmptyPlayerEncounterCombatContext();
  const targets = (input.panel.targetOptions ?? []).map((target) => ({
    displayName: target.displayName,
    id: target.participantId,
  }));

  return (
    <PlayerCombatPhasePanel
      phaseCard={{ description: "", phaseLabel: input.phaseLabel, stats: [], title: "" }}
      sourceLabel="History"
    >
      {input.panel.attackSummary ? (
        <>
          <PlayerCombatAttackStatsTable stats={input.panel.attackSummary} />
          <PlayerCombatAttackTargetSelector
            combatContext={context}
            controlsDisabled
            distanceLabel={input.panel.distanceLabel}
            onCombatContextChange={noop}
            readOnly
            targetOptions={targets}
          />
          <PlayerCombatAttackLocationSelector
            combatContext={context}
            controlsDisabled
            onCombatContextChange={noop}
            readOnly
          />
          <PlayerCombatAttackModeSelector
            controlsDisabled
            onChange={noop}
            options={
              context.attackModeId
                ? [
                    {
                      id: context.attackModeId,
                      label: input.panel.attackModeLabel ?? context.attackModeId,
                    },
                  ]
                : []
            }
            selectedAttackModeId={context.attackModeId}
            readOnly
          />
        </>
      ) : null}
      <>
        {input.phaseLabel === "Phase 1" &&
        input.actionId === "parry" &&
        input.secondaryActionId === "observe_opponent" ? (
          <PlayerCombatObservationProgress
            relationships={input.observationRelationships}
            targetLabels={input.observationTargetLabels}
          />
        ) : null}
        {input.panel.defenseSummary ? (
          <PlayerCombatDefenseStatsTable stats={input.panel.defenseSummary} />
        ) : (
          <div style={{ color: "#5e5a50", fontSize: "0.85rem" }}>
            Defense information unavailable.
          </div>
        )}
        <PlayerCombatParryContextPanel
          combatContext={context}
          controlsDisabled
          mainHandItemLabel={input.panel.mainHandParryItemLabel}
          offHandItemLabel={input.panel.offHandParryItemLabel}
          onCombatContextChange={noop}
          readOnly
        />
      </>
    </PlayerCombatPhasePanel>
  );
}

export function PlayerCombatHistoryInspector(input: {
  events: readonly ProjectedCombatHistoryEvent[];
  observationRelationships?: readonly CombatObservationRelationship[];
  observationTargetLabels?: Readonly<Record<string, string>>;
  snapshot?: ProjectedCombatHistorySnapshot;
}) {
  const selector = input.snapshot?.panels.actionSelector;
  const selectorRecorded = Boolean(selector && Object.keys(selector).length > 0);
  const distancePreferenceOptions: PlayerCombatDistancePreferenceOption[] = (
    selector?.movementPreferenceTargets ?? []
  ).map((target) => ({
    defaultDistance: selector?.movementIntent?.distancePreferences.find(
      (preference) => preference.targetParticipantId === target.participantId,
    )?.desiredDistance,
    displayName: target.displayName,
    id: target.participantId,
  }));
  const modifierRows =
    "rows" in (input.snapshot?.panels.modifiers ?? {})
      ? input.snapshot?.panels.modifiers.rows
      : undefined;

  return (
    <section
      aria-label="Player combat historical inspector"
      style={{ display: "grid", gap: "0.75rem" }}
    >
      <div style={playerCombatTopPanelRowStyle}>
        {selectorRecorded && selector ? (
          <PlayerCombatHistoricalActionSelectorPanel
            actionLabel={
              selector.actionLabel ??
              historicalActionLabel(selector.actionId)
            }
            additionalActionNotes={selector.additionalActionNotes ?? ""}
            declarationRecorded
            distancePreferences={distancePreferenceOptions.map((preference) => ({
              desiredDistance: preference.defaultDistance,
              displayName: preference.displayName,
            }))}
            movementLabel={
              selector.movementLabel ??
              PLAYER_ENCOUNTER_MOVEMENT_OPTIONS.find(
                (option) => option.value === selector.movementId,
              )?.label ??
              selector.movementId
            }
            roundNumber={input.snapshot?.roundNumber}
            secondaryActionLabel={
              selector.secondaryActionLabel ??
              historicalActionLabel(selector.secondaryActionId)
            }
          />
        ) : (
          <MissingHistoricalPanel title="Action selector" />
        )}
        <HistoricalPhasePanel
          actionId={selector?.actionId}
          observationRelationships={input.observationRelationships ?? []}
          observationTargetLabels={input.observationTargetLabels ?? {}}
          panel={input.snapshot?.panels.phase1 ?? {}}
          phaseLabel="Phase 1"
          secondaryActionId={selector?.secondaryActionId}
        />
        <HistoricalPhasePanel
          actionId={selector?.actionId}
          observationRelationships={input.observationRelationships ?? []}
          observationTargetLabels={input.observationTargetLabels ?? {}}
          panel={input.snapshot?.panels.phase2 ?? {}}
          phaseLabel="Phase 2"
          secondaryActionId={selector?.secondaryActionId}
        />
      </div>
      <div style={playerCombatPanelRowStyle}>
        {modifierRows ? (
          <PlayerCombatModifierPanel
            controlsDisabled
            readOnly
            rows={modifierRows}
            sourceLabel="History"
            observationRelationships={input.observationRelationships ?? []}
            observationTargetLabels={input.observationTargetLabels ?? {}}
          />
        ) : (
          <MissingHistoricalPanel title="Combat modifiers" />
        )}
        <PlayerCombatHistoricalContextPanel
          roundNumber={input.snapshot?.roundNumber}
          stepLabel={input.snapshot?.step.replaceAll("_", " ")}
        />
        <CombatEventResultList
          emptyMessage={input.snapshot?.stepOutcome?.message ?? historicalDataMissingMessage}
          events={input.events}
          title={
            input.snapshot
              ? `Historical result — Round ${input.snapshot.roundNumber} · ${input.snapshot.step.replaceAll("_", " ")}`
              : "Historical result"
          }
        />
      </div>
    </section>
  );
}
