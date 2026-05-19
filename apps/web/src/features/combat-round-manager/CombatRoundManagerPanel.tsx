"use client";

import { useEffect, useMemo, useState } from "react";

import type { CombatRoundStep, EncounterSession } from "@glantri/domain";
import {
  COMBAT_ROUND_STEP_ABBREVIATIONS,
  COMBAT_ROUND_STEP_LABELS,
  COMBAT_ROUND_STEPS,
  advanceCombatRoundStep,
  buildCombatRoundInspector,
  initializeCombatRoundState,
  setCombatRoundActiveParticipant,
  setCombatRoundSelection,
  sortCombatRoundParticipantsByInitiative,
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
  border: "1px solid #e3e1dc",
  borderRadius: 10,
  overflowX: "auto",
} as const;

const stickyParticipantCellStyle = {
  background: "#fbfaf7",
  boxShadow: "1px 0 0 #e3e1dc",
  left: 0,
  minWidth: "13rem",
  position: "sticky",
  zIndex: 2,
} as const;

const stepCellStyle = {
  height: "2.35rem",
  minWidth: "3rem",
  padding: "0.2rem",
  textAlign: "center",
} as const;

const inspectorNavStyle = {
  display: "flex",
  flexWrap: "wrap",
  gap: "0.5rem",
} as const;

const timelineRounds = 1;

function getNextStepLabel(step: CombatRoundStep): string {
  const currentIndex = COMBAT_ROUND_STEPS.indexOf(step);
  const nextStep = COMBAT_ROUND_STEPS[currentIndex + 1] ?? "select_actions";

  return COMBAT_ROUND_STEP_ABBREVIATIONS[nextStep];
}

function getAdvanceButtonLabel(step: CombatRoundStep): string {
  return `Commit ${COMBAT_ROUND_STEP_ABBREVIATIONS[step]} and advance to ${getNextStepLabel(step)}`;
}

function formatInitiative(value: number | undefined): string {
  return value === undefined ? "init --" : `init ${value}`;
}

function getStatusMarker(input: { current: boolean; status: string | undefined }): string {
  if (input.current) {
    return "▶";
  }

  switch (input.status) {
    case "complete":
      return "✓";
    case "ready":
      return "R";
    case "skipped":
      return "–";
    case "pending":
    default:
      return "·";
  }
}

function shouldSortByInitiative(step: CombatRoundStep): "phase1" | "phase2" | undefined {
  if (step === "phase_1_actions" || step === "review_phase_2_actions") {
    return "phase1";
  }

  if (step === "phase_2_actions" || step === "review_phase_2_damage") {
    return "phase2";
  }

  return undefined;
}

export default function CombatRoundManagerPanel({
  encounter,
  onEncounterUpdated,
}: CombatRoundManagerPanelProps) {
  const initialRoundState = useMemo(() => initializeCombatRoundState({ encounter }), [encounter]);
  const [roundState, setRoundState] = useState(initialRoundState);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string>();
  const selectedRoundNumber = roundState.roundNumber;
  const initiativeSortPhase = shouldSortByInitiative(roundState.currentStep);
  const displayParticipants = useMemo(() => {
    if (!initiativeSortPhase) {
      return roundState.participants;
    }

    const hasInitiative = roundState.participants.some(
      (participant) => participant.initiatives[initiativeSortPhase] !== undefined,
    );

    return hasInitiative
      ? sortCombatRoundParticipantsByInitiative({
          phase: initiativeSortPhase,
          state: roundState,
        })
      : roundState.participants;
  }, [initiativeSortPhase, roundState]);
  const timelineRoundNumbers = Array.from(
    { length: timelineRounds },
    (_, index) => roundState.roundNumber + index,
  );
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

  function moveSelection(input: { participantOffset?: number; stepOffset?: number }) {
    setRoundState((current) => {
      const participantIndex = displayParticipants.findIndex(
        (participant) => participant.participantId === current.selectedParticipantId,
      );
      const stepIndex = COMBAT_ROUND_STEPS.indexOf(current.selectedStep ?? current.currentStep);
      const nextParticipant =
        displayParticipants[
          Math.min(
            Math.max(
              (participantIndex === -1 ? 0 : participantIndex) + (input.participantOffset ?? 0),
              0,
            ),
            Math.max(displayParticipants.length - 1, 0),
          )
        ];
      const nextStep =
        COMBAT_ROUND_STEPS[
          Math.min(
            Math.max((stepIndex === -1 ? 0 : stepIndex) + (input.stepOffset ?? 0), 0),
            COMBAT_ROUND_STEPS.length - 1,
          )
        ];

      return setCombatRoundSelection({
        participantId: nextParticipant?.participantId,
        state: current,
        step: nextStep,
      });
    });
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
            Round {roundState.roundNumber} · Current step:{" "}
            {COMBAT_ROUND_STEP_ABBREVIATIONS[roundState.currentStep]}
          </div>
          <div style={{ color: "#5e5a50" }}>
            Rows are participants. Columns are round timeline cells. Select a cell to inspect it.
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

      <div aria-label="Combat round timeline grid" style={tableWrapStyle}>
        <table
          style={{
            borderCollapse: "separate",
            borderSpacing: 0,
            minWidth: 620,
            width: "max-content",
          }}
        >
          <thead>
            <tr>
              <th
                rowSpan={2}
                style={{
                  ...stickyParticipantCellStyle,
                  padding: "0.45rem",
                  textAlign: "left",
                  top: 0,
                }}
              >
                Participant
              </th>
              {timelineRoundNumbers.map((roundNumber) => (
                <th
                  colSpan={COMBAT_ROUND_STEPS.length}
                  key={roundNumber}
                  style={{
                    background: "#efe7d3",
                    borderBottom: "1px solid #d1c7aa",
                    borderLeft: "1px solid #e3e1dc",
                    padding: "0.35rem",
                    textAlign: "center",
                  }}
                >
                  Round {roundNumber}
                </th>
              ))}
            </tr>
            <tr>
              {timelineRoundNumbers.flatMap((roundNumber) =>
                COMBAT_ROUND_STEPS.map((step) => (
                  <th
                    key={`${roundNumber}-${step}`}
                    style={{
                      ...stepCellStyle,
                      background: step === roundState.currentStep ? "#f6f0dd" : "#fbfaf7",
                      borderBottom: "1px solid #e3e1dc",
                      borderLeft: "1px solid #e3e1dc",
                      fontWeight: step === roundState.currentStep ? 800 : 700,
                    }}
                    title={COMBAT_ROUND_STEP_LABELS[step]}
                  >
                    {COMBAT_ROUND_STEP_ABBREVIATIONS[step]}
                  </th>
                )),
              )}
            </tr>
          </thead>
          <tbody>
            {displayParticipants.map((participant) => {
              const selectedRow = roundState.selectedParticipantId === participant.participantId;

              return (
                <tr
                  key={participant.participantId}
                  style={{ background: selectedRow ? "#fff8e8" : undefined }}
                >
                  <td
                    style={{
                      ...stickyParticipantCellStyle,
                      borderTop: "1px solid #e3e1dc",
                      padding: "0.45rem",
                    }}
                  >
                    <div style={{ display: "grid", gap: "0.25rem" }}>
                      <strong>{participant.label}</strong>
                      {roundState.activeParticipantId === participant.participantId ? (
                        <span aria-label={`${participant.label} is active`}>▶ Active</span>
                      ) : (
                        <button
                          disabled={saving}
                          onClick={() =>
                            void persistRoundState(
                              setCombatRoundActiveParticipant(
                                roundState,
                                participant.participantId,
                              ),
                            )
                          }
                          type="button"
                        >
                          Set active
                        </button>
                      )}
                    </div>
                  </td>
                  {timelineRoundNumbers.flatMap((roundNumber) =>
                    COMBAT_ROUND_STEPS.map((step) => {
                      const selected =
                        roundNumber === selectedRoundNumber &&
                        roundState.selectedParticipantId === participant.participantId &&
                        roundState.selectedStep === step;
                      const currentStepCell =
                        roundNumber === roundState.roundNumber && step === roundState.currentStep;
                      const marker = getStatusMarker({
                        current: currentStepCell,
                        status: participant.stepStatuses[step],
                      });
                      const initiative =
                        step === "initiative_phase_1"
                          ? formatInitiative(participant.initiatives.phase1)
                          : step === "initiative_phase_2"
                            ? formatInitiative(participant.initiatives.phase2)
                            : undefined;
                      const title = `${participant.label}, round ${roundNumber}, ${COMBAT_ROUND_STEP_LABELS[step]}, status ${participant.stepStatuses[step]}`;

                      return (
                        <td
                          key={`${roundNumber}-${step}`}
                          style={{
                            ...stepCellStyle,
                            background: selected
                              ? "#efe7d3"
                              : currentStepCell
                                ? "#f6f0dd"
                                : undefined,
                            borderLeft: "1px solid #e3e1dc",
                            borderTop: "1px solid #e3e1dc",
                            outline: selected ? "2px solid #2f5d62" : undefined,
                            outlineOffset: "-2px",
                          }}
                        >
                          <button
                            aria-label={title}
                            onClick={() => selectInspector(participant.participantId, step)}
                            style={{
                              alignItems: "center",
                              background: "transparent",
                              border: "none",
                              color: "#2f5d62",
                              cursor: "pointer",
                              display: "grid",
                              fontSize: "0.85rem",
                              fontWeight: currentStepCell ? 800 : 600,
                              justifyItems: "center",
                              lineHeight: 1.1,
                              minHeight: "1.8rem",
                              padding: 0,
                              width: "100%",
                            }}
                            title={initiative ? `${title}, ${initiative}` : title}
                            type="button"
                          >
                            <span aria-hidden="true">{marker}</span>
                          </button>
                        </td>
                      );
                    }),
                  )}
                </tr>
              );
            })}
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
        <h3 style={{ margin: 0 }}>Combat inspector</h3>
        {inspector.participant ? (
          <>
            <div>
              Selected cell: <strong>{inspector.participant.label}</strong> · Round{" "}
              {selectedRoundNumber} · {COMBAT_ROUND_STEP_ABBREVIATIONS[inspector.step]} (
              {COMBAT_ROUND_STEP_LABELS[inspector.step]})
            </div>
            <div>Status: {inspector.status ?? "pending"}</div>
            <div>
              {inspector.step === roundState.currentStep
                ? "This is the current step. Advance commits this step and moves the process forward."
                : "This is a timeline cell for review or preparation."}
            </div>
            <div>
              Phase 1 initiative: {formatInitiative(inspector.participant.initiatives.phase1)}
            </div>
            <div>
              Phase 2 initiative: {formatInitiative(inspector.participant.initiatives.phase2)}
            </div>
            <div>No data recorded for this step.</div>
            <div style={inspectorNavStyle}>
              <button onClick={() => moveSelection({ participantOffset: -1 })} type="button">
                Previous participant
              </button>
              <button onClick={() => moveSelection({ participantOffset: 1 })} type="button">
                Next participant
              </button>
              <button onClick={() => moveSelection({ stepOffset: -1 })} type="button">
                Previous step
              </button>
              <button onClick={() => moveSelection({ stepOffset: 1 })} type="button">
                Next step
              </button>
            </div>
          </>
        ) : (
          <div>No participant selected.</div>
        )}
      </section>
    </section>
  );
}
