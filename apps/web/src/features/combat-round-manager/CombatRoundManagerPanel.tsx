"use client";

import { useEffect, useMemo, useState } from "react";

import type {
  CombatRoundStep,
  CombatRoundStepStatus,
  EncounterSession,
  ScenarioCombatModifierBucket,
  ScenarioCombatModifierEntry,
  ScenarioParticipant,
  ScenarioParticipantCombatContext,
} from "@glantri/domain";
import {
  COMBAT_ROUND_STEP_ABBREVIATIONS,
  COMBAT_ROUND_STEP_LABELS,
  COMBAT_ROUND_STEPS,
  advanceCombatRoundStep,
  buildCombatRoundInspector,
  initializeCombatRoundState,
  setCombatRoundSelection,
  sortCombatRoundParticipantsByInitiative,
} from "@glantri/domain";

import {
  submitCombatDeclarationOnServer,
  updateEncounterOnServer,
} from "@/lib/api/encounterClient";
import {
  buildPlayerCombatModifierRows,
  PlayerCombatActionButtonPanel,
  PlayerCombatActionResultPanel,
  PlayerCombatActionSelectorPanel,
  PlayerCombatModifierPanel,
  PlayerCombatPhasePanel,
  playerCombatPanelRowStyle,
  type PlayerCombatPhaseCardView,
} from "@/features/player-combat/PlayerCombatPanels";
import { buildEncounterLiveCombatModifierSummary } from "@/lib/campaigns/liveCombatModifiers";
import {
  createEmptyPlayerEncounterCombatContext,
  evaluatePlayerEncounterParryLegality,
  getPlayerEncounterMovementLabel,
  isPlayerEncounterActionId,
  type PlayerEncounterActionId,
  type PlayerEncounterMovementId,
} from "@/lib/campaigns/playerEncounter";

interface CombatRoundManagerPanelProps {
  encounter: EncounterSession;
  onEncounterUpdated?: (encounter: EncounterSession) => void;
  scenarioParticipants?: ScenarioParticipant[];
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

interface CombatInspectorDeclarationDraft {
  actionId: PlayerEncounterActionId | "";
  additionalActionNotes: string;
  combatContext: ScenarioParticipantCombatContext;
  movementId: PlayerEncounterMovementId | "";
  secondaryActionId: PlayerEncounterActionId | "";
}

function getNextStepLabel(step: CombatRoundStep): string {
  const currentIndex = COMBAT_ROUND_STEPS.indexOf(step);
  const nextStep = COMBAT_ROUND_STEPS[currentIndex + 1] ?? "select_actions";

  return COMBAT_ROUND_STEP_ABBREVIATIONS[nextStep];
}

function getAdvanceButtonLabel(step: CombatRoundStep): string {
  return `Commit ${COMBAT_ROUND_STEP_ABBREVIATIONS[step]} and advance to ${getNextStepLabel(step)}`;
}

function createModifierEntryDraft(): ScenarioCombatModifierEntry {
  return {
    id: `modifier-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    notes: "",
    scope: "until",
    value: 0,
  };
}

function buildDeclarationDraft(
  participant?: ScenarioParticipant,
): CombatInspectorDeclarationDraft {
  return {
    actionId: isPlayerEncounterActionId(participant?.state.combat.lastDeclaredActionId)
      ? participant.state.combat.lastDeclaredActionId
      : "",
    additionalActionNotes: participant?.state.combat.lastDeclarationNotes ?? "",
    combatContext:
      participant?.state.combat.combatContext ?? createEmptyPlayerEncounterCombatContext(),
    movementId: (participant?.state.combat.lastDeclaredMovementId as PlayerEncounterMovementId) ?? "hold",
    secondaryActionId: isPlayerEncounterActionId(
      participant?.state.combat.lastDeclaredSecondaryActionId,
    )
      ? participant.state.combat.lastDeclaredSecondaryActionId
      : "",
  };
}

function formatInitiative(value: number | undefined): string {
  return value === undefined ? "init --" : `init ${value}`;
}

function formatStepStatus(status: string | undefined): string {
  switch (status) {
    case "complete":
      return "Complete";
    case "submitted":
      return "Submitted";
    case "gmEdited":
      return "GM edited";
    case "locked":
      return "Locked";
    case "ready":
      return "Ready";
    case "skipped":
      return "Skipped";
    case "pending":
    default:
      return "Pending";
  }
}

function getStatusMarker(input: { current: boolean; status: string | undefined }): string {
  switch (input.status) {
    case "submitted":
    case "gmEdited":
      return "▶";
    case "complete":
      return "✓";
    case "locked":
      return "L";
    case "ready":
      return "R";
    case "skipped":
      return "–";
    case "pending":
    default:
      return input.current ? "O" : "·";
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
  scenarioParticipants = [],
}: CombatRoundManagerPanelProps) {
  const initialRoundState = useMemo(() => initializeCombatRoundState({ encounter }), [encounter]);
  const [roundState, setRoundState] = useState(initialRoundState);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string>();
  const [scenarioParticipantOverrides, setScenarioParticipantOverrides] = useState<
    Record<string, ScenarioParticipant>
  >({});
  const [inspectorDrafts, setInspectorDrafts] = useState<
    Record<string, CombatInspectorDeclarationDraft>
  >({});
  const selectedRoundNumber = roundState.roundNumber;
  const effectiveScenarioParticipants = useMemo(
    () =>
      scenarioParticipants.map(
        (participant) => scenarioParticipantOverrides[participant.id] ?? participant,
      ),
    [scenarioParticipantOverrides, scenarioParticipants],
  );
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
  const selectedEncounterParticipant = encounter.participants.find(
    (participant) => participant.id === inspector.participant?.participantId,
  );
  const selectedScenarioParticipant = selectedEncounterParticipant
    ? effectiveScenarioParticipants.find(
        (participant) =>
          participant.id === selectedEncounterParticipant.scenarioParticipantId ||
          participant.id === selectedEncounterParticipant.id ||
          (participant.characterId &&
            participant.characterId === selectedEncounterParticipant.characterId),
      )
    : undefined;
  const inspectorDraft =
    selectedScenarioParticipant && inspectorDrafts[selectedScenarioParticipant.id]
      ? inspectorDrafts[selectedScenarioParticipant.id]
      : buildDeclarationDraft(selectedScenarioParticipant);
  const inspectorLiveModifiers = useMemo(
    () =>
      buildEncounterLiveCombatModifierSummary({
        combatContext: inspectorDraft.combatContext,
        combatEffects: selectedScenarioParticipant?.state.combatEffects,
      }),
    [inspectorDraft.combatContext, selectedScenarioParticipant],
  );
  const inspectorModifierRows = useMemo(
    () =>
      buildPlayerCombatModifierRows({
        combatContext: inspectorDraft.combatContext,
        liveModifiers: inspectorLiveModifiers,
      }),
    [inspectorDraft.combatContext, inspectorLiveModifiers],
  );
  const inspectorPhaseCards = useMemo<readonly PlayerCombatPhaseCardView[]>(() => {
    if (!inspector.participant) {
      return [];
    }

    return [
      {
        description: "Current phase 1 action context for the selected participant.",
        phaseLabel: "Phase 1",
        stats: [
          `Initiative: ${formatInitiative(inspector.participant.initiatives.phase1)}`,
          `Action status: ${formatStepStatus(inspector.participant.stepStatuses.phase_1_actions)}`,
          `Damage review: ${formatStepStatus(
            inspector.participant.stepStatuses.review_phase_2_actions,
          )}`,
        ],
        title: "Phase 1 action",
      },
      {
        description: "Current phase 2 action context for the selected participant.",
        phaseLabel: "Phase 2",
        stats: [
          `Initiative: ${formatInitiative(inspector.participant.initiatives.phase2)}`,
          `Action status: ${formatStepStatus(inspector.participant.stepStatuses.phase_2_actions)}`,
          `Damage review: ${formatStepStatus(
            inspector.participant.stepStatuses.review_phase_2_damage,
          )}`,
        ],
        title: "Phase 2 action",
      },
    ];
  }, [inspector.participant]);
  const inspectorOpponentOptions = useMemo(
    () =>
      effectiveScenarioParticipants
        .filter(
          (participant) =>
            participant.isActive && participant.id !== selectedScenarioParticipant?.id,
        )
        .map((participant) => ({
          displayName: participant.snapshot.displayName,
          id: participant.id,
        })),
    [effectiveScenarioParticipants, selectedScenarioParticipant?.id],
  );
  const inspectorParryLegality = useMemo(
    () =>
      evaluatePlayerEncounterParryLegality({
        actionId: inspectorDraft.actionId,
        attackSource: inspectorDraft.actionId === "attack_parry" ? "mainHand" : undefined,
        hasOffHandWeapon: true,
        hasShield: true,
        hasSelectedOpponent: Boolean(inspectorDraft.combatContext.selectedOpponentId),
        incomingAttackSide: inspectorDraft.combatContext.incomingAttackSide,
        parrySource: inspectorDraft.combatContext.parrySource,
      }),
    [inspectorDraft],
  );

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

  function updateInspectorDraft(patch: Partial<CombatInspectorDeclarationDraft>) {
    if (!selectedScenarioParticipant) {
      return;
    }

    setInspectorDrafts((current) => ({
      ...current,
      [selectedScenarioParticipant.id]: {
        ...inspectorDraft,
        ...patch,
      },
    }));
  }

  function updateInspectorModifierBucket(
    bucket: ScenarioCombatModifierBucket,
    updater: (entries: ScenarioCombatModifierEntry[]) => ScenarioCombatModifierEntry[],
  ) {
    updateInspectorDraft({
      combatContext: {
        ...inspectorDraft.combatContext,
        modifierBuckets: {
          ...inspectorDraft.combatContext.modifierBuckets,
          [bucket === "general"
            ? "general"
            : bucket === "situation_ob_skill"
              ? "situationObSkill"
              : "situationDb"]: updater(
            bucket === "general"
              ? inspectorDraft.combatContext.modifierBuckets.general
              : bucket === "situation_ob_skill"
                ? inspectorDraft.combatContext.modifierBuckets.situationObSkill
                : inspectorDraft.combatContext.modifierBuckets.situationDb,
          ),
        },
      },
    });
  }

  function getParticipantDeclarationStatus(input: {
    participantId: string;
    step: CombatRoundStep;
    status: CombatRoundStepStatus;
  }): CombatRoundStepStatus {
    if (input.step !== "select_actions") {
      return input.status;
    }

    const encounterParticipant = encounter.participants.find(
      (participant) => participant.id === input.participantId,
    );
    const scenarioParticipant = encounterParticipant
      ? effectiveScenarioParticipants.find(
          (participant) =>
            participant.id === encounterParticipant.scenarioParticipantId ||
            participant.id === encounterParticipant.id ||
            (participant.characterId && participant.characterId === encounterParticipant.characterId),
        )
      : undefined;
    const declaredThisRound = Boolean(
      scenarioParticipant?.state.combat.lastDeclaredActionId &&
        scenarioParticipant.state.combat.lastDeclaredRoundNumber === roundState.roundNumber,
    );

    return declaredThisRound && input.status === "pending" ? "submitted" : input.status;
  }

  async function saveInspectorDeclaration() {
    if (!encounter.scenarioId || !selectedScenarioParticipant || !selectedEncounterParticipant) {
      return;
    }

    setSaving(true);

    try {
      const { encounter: nextEncounter, participant } = await submitCombatDeclarationOnServer({
        actionId: inspectorDraft.actionId || undefined,
        additionalActionNotes: inspectorDraft.additionalActionNotes,
        combatContext: inspectorDraft.combatContext,
        encounterId: encounter.id,
        movementId: inspectorDraft.movementId || undefined,
        scenarioParticipantId: selectedScenarioParticipant.id,
        secondaryActionId: inspectorDraft.secondaryActionId || undefined,
      });
      const nextRoundState = initializeCombatRoundState({ encounter: nextEncounter });

      setScenarioParticipantOverrides((current) => ({
        ...current,
        [participant.id]: participant,
      }));
      setRoundState(nextRoundState);
      onEncounterUpdated?.(nextEncounter);
      setSaveError(undefined);
    } catch (caughtError) {
      setSaveError(
        caughtError instanceof Error ? caughtError.message : "Unable to save combat declaration.",
      );
    } finally {
      setSaving(false);
    }
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
                      const stepStatus = getParticipantDeclarationStatus({
                        participantId: participant.participantId,
                        status: participant.stepStatuses[step] ?? "pending",
                        step,
                      });
                      const marker = getStatusMarker({
                        current: currentStepCell,
                        status: stepStatus,
                      });
                      const initiative =
                        step === "initiative_phase_1"
                          ? formatInitiative(participant.initiatives.phase1)
                          : step === "initiative_phase_2"
                            ? formatInitiative(participant.initiatives.phase2)
                            : undefined;
                      const title = `${participant.label}, round ${roundNumber}, ${COMBAT_ROUND_STEP_LABELS[step]}, status ${stepStatus}`;

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
          gap: "0.75rem",
          padding: "0.75rem",
        }}
      >
        {inspector.participant ? (
          <>
            <div
              style={{
                alignItems: "center",
                display: "flex",
                flexWrap: "wrap",
                gap: "0.75rem",
                justifyContent: "space-between",
              }}
            >
              <div>
                <h3 style={{ margin: 0 }}>
                  Combat inspector — {inspector.participant.label} · Round {selectedRoundNumber} ·{" "}
                  {COMBAT_ROUND_STEP_ABBREVIATIONS[inspector.step]}
                </h3>
                <div style={{ color: "#5e5a50", fontSize: "0.92rem" }}>
                  {COMBAT_ROUND_STEP_LABELS[inspector.step]} ·{" "}
                  {formatStepStatus(inspector.status)}
                </div>
              </div>
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
            </div>

            {selectedScenarioParticipant ? (
              <>
                <div style={playerCombatPanelRowStyle}>
                  <PlayerCombatActionSelectorPanel
                    actionId={inspectorDraft.actionId}
                    additionalActionNotes={inspectorDraft.additionalActionNotes}
                    combatContext={inspectorDraft.combatContext}
                    movementId={inspectorDraft.movementId}
                    onActionChange={(actionId) => updateInspectorDraft({ actionId })}
                    onAdditionalActionNotesChange={(additionalActionNotes) =>
                      updateInspectorDraft({ additionalActionNotes })
                    }
                    onCombatContextChange={(combatContext) =>
                      updateInspectorDraft({ combatContext })
                    }
                    onMovementChange={(movementId) => updateInspectorDraft({ movementId })}
                    onSecondaryActionChange={(secondaryActionId) =>
                      updateInspectorDraft({ secondaryActionId })
                    }
                    parryLegality={inspectorParryLegality}
                    secondaryActionId={inspectorDraft.secondaryActionId}
                    visibleOpponentOptions={inspectorOpponentOptions}
                  />
                  {inspectorPhaseCards.map((phaseCard) => (
                    <PlayerCombatPhasePanel key={phaseCard.phaseLabel} phaseCard={phaseCard} />
                  ))}
                </div>

                <div style={playerCombatPanelRowStyle}>
                  <PlayerCombatModifierPanel
                    controlsDisabled={saving}
                    onAddEntry={(bucketKey) =>
                      updateInspectorModifierBucket(bucketKey, (current) => [
                        ...current,
                        createModifierEntryDraft(),
                      ])
                    }
                    onRemoveEntry={(bucketKey, entryId) =>
                      updateInspectorModifierBucket(bucketKey, (current) =>
                        current.filter((entry) => entry.id !== entryId),
                      )
                    }
                    onUpdateEntry={(bucketKey, entryId, patch) =>
                      updateInspectorModifierBucket(bucketKey, (current) =>
                        current.map((entry) =>
                          entry.id === entryId
                            ? {
                                ...entry,
                                ...patch,
                              }
                            : entry,
                        ),
                      )
                    }
                    rows={inspectorModifierRows}
                  />
                  <PlayerCombatActionButtonPanel
                    disabled={!inspectorDraft.actionId}
                    onDeclareAction={() => void saveInspectorDeclaration()}
                    saving={saving}
                    statusText="GM can save or revise this declaration at any round step."
                  />
                  <PlayerCombatActionResultPanel
                    additionalActionNotes={inspectorDraft.additionalActionNotes}
                    movementLabel={getPlayerEncounterMovementLabel(inspectorDraft.movementId)}
                    result={null}
                  />
                </div>
              </>
            ) : (
              <div>No scenario participant state is available for this inspector row.</div>
            )}
          </>
        ) : (
          <div>Select a participant step to inspect combat details.</div>
        )}
      </section>
    </section>
  );
}
