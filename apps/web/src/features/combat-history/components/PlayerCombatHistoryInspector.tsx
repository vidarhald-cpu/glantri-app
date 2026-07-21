import React from "react";
import type {
  ProjectedCombatHistoryEvent,
  ProjectedCombatHistoryPhasePanel,
  ProjectedCombatHistorySnapshot,
} from "@glantri/domain";

import {
  PlayerCombatActionSelectorPanel,
  PlayerCombatActionButtonPanel,
  PlayerCombatAttackLocationSelector,
  PlayerCombatAttackModeSelector,
  PlayerCombatAttackStatsTable,
  PlayerCombatAttackTargetSelector,
  PlayerCombatDefenseStatsTable,
  PlayerCombatModifierPanel,
  PlayerCombatParryContextPanel,
  PlayerCombatPhasePanel,
  playerCombatPanelCardStyle,
  playerCombatPanelRowStyle,
  playerCombatTopPanelRowStyle,
  type PlayerCombatDistancePreferenceOption,
} from "@/features/player-combat/PlayerCombatPanels";
import {
  createEmptyPlayerEncounterCombatContext,
  type PlayerEncounterActionId,
  type PlayerEncounterMovementId,
} from "@/lib/campaigns/playerEncounter";

import { CombatEventResultList } from "./CombatEventResultList";

const noop = () => undefined;
const historicalDataMissingMessage = "No information available for this panel.";

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
  panel: ProjectedCombatHistoryPhasePanel;
  phaseLabel: "Phase 1" | "Phase 2";
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
            readOnly={input.actionId === "feint_attack" && input.phaseLabel === "Phase 2"}
            targetOptions={targets}
          />
          <PlayerCombatAttackLocationSelector
            combatContext={context}
            controlsDisabled
            onCombatContextChange={noop}
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
          />
        </>
      ) : null}
      <>
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
        />
      </>
    </PlayerCombatPhasePanel>
  );
}

export function PlayerCombatHistoryInspector(input: {
  events: readonly ProjectedCombatHistoryEvent[];
  snapshot?: ProjectedCombatHistorySnapshot;
}) {
  const selector = input.snapshot?.panels.actionSelector;
  const selectorRecorded = Boolean(selector && Object.keys(selector).length > 0);
  const actionOptions = selector
    ? [
        selector.actionId
          ? {
              label: selector.actionLabel ?? selector.actionId,
              value: selector.actionId as PlayerEncounterActionId,
            }
          : undefined,
        selector.secondaryActionId && selector.secondaryActionId !== selector.actionId
          ? {
              label: selector.secondaryActionLabel ?? selector.secondaryActionId,
              value: selector.secondaryActionId as PlayerEncounterActionId,
            }
          : undefined,
      ].filter((option): option is NonNullable<typeof option> => Boolean(option))
    : [];
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
          <PlayerCombatActionSelectorPanel
            actionId={(selector.actionId ?? "") as PlayerEncounterActionId | ""}
            actionOptions={actionOptions}
            additionalActionNotes={selector.additionalActionNotes ?? ""}
            controlsDisabled
            distancePreferenceOptions={distancePreferenceOptions}
            movementId={(selector.movementId ?? "") as PlayerEncounterMovementId | ""}
            movementIntent={selector.movementIntent}
            onActionChange={noop}
            onAdditionalActionNotesChange={noop}
            onMovementChange={noop}
            onMovementIntentChange={noop}
            onSecondaryActionChange={noop}
            roundNumber={input.snapshot?.roundNumber}
            secondaryActionId={(selector.secondaryActionId ?? "") as PlayerEncounterActionId | ""}
            sourceLabel="History"
          />
        ) : (
          <MissingHistoricalPanel title="Action selector" />
        )}
        <HistoricalPhasePanel
          actionId={selector?.actionId}
          panel={input.snapshot?.panels.phase1 ?? {}}
          phaseLabel="Phase 1"
        />
        <HistoricalPhasePanel
          actionId={selector?.actionId}
          panel={input.snapshot?.panels.phase2 ?? {}}
          phaseLabel="Phase 2"
        />
      </div>
      <div style={playerCombatPanelRowStyle}>
        {modifierRows ? (
          <PlayerCombatModifierPanel
            controlsDisabled
            readOnly
            rows={modifierRows}
            sourceLabel="History"
          />
        ) : (
          <MissingHistoricalPanel title="Combat modifiers" />
        )}
        <PlayerCombatActionButtonPanel
          buttonLabel="Historical inspection"
          disabled
          statusText="No historical action control recorded."
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
