"use client";

import { useEffect, useMemo, useState } from "react";

import type { CombatRoundStep, EncounterSession } from "@glantri/domain";
import {
  COMBAT_ROUND_STEPS,
  advanceCombatRoundStep,
  buildCombatRoundInspector,
  initializeCombatRoundState,
  setCombatRoundActiveParticipant,
  setCombatRoundSelection,
} from "@glantri/domain";

import { updateEncounterOnServer } from "@/lib/api/encounterClient";

interface CombatRoundManagerPanelProps {
  encounter: EncounterSession;
  onEncounterUpdated?: (encounter: EncounterSession) => void;
}

const panelStyle = {
  background: "#fbfaf7",
  border: "1px solid #d9ddd8",
  borderRadius: 12,
  display: "grid",
  gap: "1rem",
  padding: "1rem",
} as const;

const tableWrapStyle = {
  overflowX: "auto",
} as const;

const stepLabels: Record<CombatRoundStep, string> = {
  initiative_phase_1: "Init P1",
  initiative_phase_2: "Init P2",
  phase_1_actions: "Phase 1",
  phase_2_actions: "Phase 2",
  review_action_modifiers: "Review mods",
  review_phase_2_actions: "Review P2",
  review_phase_2_modifiers: "P2 mods",
  round_summary: "Summary",
  select_actions: "Select",
};

function getNextStepLabel(step: CombatRoundStep): string {
  const currentIndex = COMBAT_ROUND_STEPS.indexOf(step);
  const nextStep = COMBAT_ROUND_STEPS[currentIndex + 1] ?? "select_actions";

  return stepLabels[nextStep];
}

function getAdvanceButtonLabel(step: CombatRoundStep): string {
  return `Commit ${stepLabels[step]} and advance to ${getNextStepLabel(step)}`;
}

function formatInitiative(value: number | undefined): string {
  return value === undefined ? "init --" : `init ${value}`;
}

export default function CombatRoundManagerPanel({
  encounter,
  onEncounterUpdated,
}: CombatRoundManagerPanelProps) {
  const initialRoundState = useMemo(
    () => initializeCombatRoundState({ encounter }),
    [encounter],
  );
  const [roundState, setRoundState] = useState(initialRoundState);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string>();
  const inspector = buildCombatRoundInspector({
    participantId: roundState.selectedParticipantId,
    state: roundState,
    step: roundState.selectedStep,
  });

  useEffect(() => {
    setRoundState(initialRoundState);
  }, [initialRoundState]);

  async function persistRoundState(nextRoundState: typeof roundState) {
    setRoundState(nextRoundState);
    setSaving(true);

    try {
      const nextEncounter = await updateEncounterOnServer({
        encounterId: encounter.id,
        session: {
          ...encounter,
          combatRoundState: nextRoundState,
          currentRound: nextRoundState.roundNumber,
        },
      });

      onEncounterUpdated?.(nextEncounter);
      setSaveError(undefined);
    } catch (caughtError) {
      setSaveError(
        caughtError instanceof Error ? caughtError.message : "Unable to save combat round state.",
      );
    } finally {
      setSaving(false);
    }
  }

  function selectInspector(participantId: string, step: CombatRoundStep) {
    setRoundState((current) =>
      setCombatRoundSelection({
        participantId,
        state: current,
        step,
      }),
    );
  }

  return (
    <section style={panelStyle}>
      <div
        style={{
          alignItems: "start",
          display: "flex",
          flexWrap: "wrap",
          gap: "1rem",
          justifyContent: "space-between",
        }}
      >
        <div>
          <h2 style={{ margin: 0 }}>Combat Round Manager</h2>
          <div>
            Round {roundState.roundNumber} · Current step: {stepLabels[roundState.currentStep]}
          </div>
          <div style={{ color: "#5e5a50" }}>
            Rows are participants. Columns are the round timeline. Select a cell to inspect it.
          </div>
        </div>
        <section
          aria-label="Step controller"
          style={{
            alignItems: "center",
            display: "flex",
            flexWrap: "wrap",
            gap: "0.5rem",
          }}
        >
          <button
            disabled={saving}
            onClick={() => void persistRoundState(advanceCombatRoundStep(roundState))}
            type="button"
          >
            {saving ? "Saving..." : getAdvanceButtonLabel(roundState.currentStep)}
          </button>
        </section>
      </div>

      {saveError ? (
        <div
          style={{
            background: "#fdf0ea",
            border: "1px solid #e4b9a7",
            borderRadius: 10,
            color: "#8b3a1a",
            padding: "0.75rem",
          }}
        >
          {saveError}
        </div>
      ) : null}

      <div style={tableWrapStyle}>
        <table style={{ borderCollapse: "collapse", minWidth: 980, width: "100%" }}>
          <thead>
            <tr>
              <th style={{ padding: "0.45rem", textAlign: "left" }}>Participant</th>
              {COMBAT_ROUND_STEPS.map((step) => (
                <th key={step} style={{ padding: "0.45rem", textAlign: "left" }}>
                  {stepLabels[step]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {roundState.participants.map((participant) => (
              <tr key={participant.participantId}>
                <td style={{ borderTop: "1px solid #e3e1dc", padding: "0.45rem" }}>
                  <div style={{ display: "grid", gap: "0.25rem" }}>
                    <strong>{participant.label}</strong>
                    {roundState.activeParticipantId === participant.participantId ? (
                      <span>Active participant</span>
                    ) : (
                      <button
                        disabled={saving}
                        onClick={() =>
                          void persistRoundState(
                            setCombatRoundActiveParticipant(roundState, participant.participantId),
                          )
                        }
                        type="button"
                      >
                        Set active
                      </button>
                    )}
                  </div>
                </td>
                {COMBAT_ROUND_STEPS.map((step) => {
                  const selected =
                    roundState.selectedParticipantId === participant.participantId &&
                    roundState.selectedStep === step;
                  const currentStepCell = step === roundState.currentStep;
                  const initiative =
                    step === "initiative_phase_1"
                      ? formatInitiative(participant.initiatives.phase1)
                      : step === "initiative_phase_2"
                        ? formatInitiative(participant.initiatives.phase2)
                        : undefined;

                  return (
                    <td
                      key={step}
                      style={{
                        background: selected ? "#efe7d3" : currentStepCell ? "#f6f0dd" : undefined,
                        borderTop: "1px solid #e3e1dc",
                        padding: "0.45rem",
                      }}
                    >
                      <button
                        onClick={() => selectInspector(participant.participantId, step)}
                        style={{
                          background: "transparent",
                          border: "none",
                          color: "#2f5d62",
                          cursor: "pointer",
                          fontWeight: currentStepCell ? 700 : 400,
                          padding: 0,
                          textAlign: "left",
                        }}
                        type="button"
                      >
                        {participant.stepStatuses[step]}
                        {initiative ? ` · ${initiative}` : ""}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section
        aria-label="Combat round inspector"
        style={{
          border: "1px solid #e3e1dc",
          borderRadius: 10,
          display: "grid",
          gap: "0.5rem",
          padding: "0.75rem",
        }}
      >
        <h3 style={{ margin: 0 }}>Inspector</h3>
        {inspector.participant ? (
          <>
            <div>
              Selected cell: <strong>{inspector.participant.label}</strong> · {stepLabels[inspector.step]}
            </div>
            <div>Status: {inspector.status ?? "pending"}</div>
            <div>
              {inspector.step === roundState.currentStep
                ? "This is in the current step. Advance commits this step for the round timeline."
                : "This is a timeline cell for review or preparation."}
            </div>
            <div>
              Phase 1 initiative: {formatInitiative(inspector.participant.initiatives.phase1)}
            </div>
            <div>
              Phase 2 initiative: {formatInitiative(inspector.participant.initiatives.phase2)}
            </div>
          </>
        ) : (
          <div>No participant selected.</div>
        )}
      </section>
    </section>
  );
}
