"use client";

import { type KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";

import type {
  CombatRoundDeclaration,
  CombatRoundStep,
  CombatRoundStepStatus,
  CombatRoundInitiativeRank,
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
  characterBuildSchema,
  getCombatRoundInitiativeRanks,
  getCombatRoundInitiativeTotal,
  initializeCombatRoundState,
  setCombatRoundSelection,
  sortCombatRoundParticipantsByInitiative,
} from "@glantri/domain";

import { buildEquipmentLoadoutModuleModel } from "@/features/equipment/loadoutModule";
import type { EquipmentFeatureState } from "@/features/equipment/types";
import {
  clearCurrentCombatRoundStepOnServer,
  rollCombatInitiativeOnServer,
  submitCombatDeclarationOnServer,
  updateEncounterOnServer,
} from "@/lib/api/encounterClient";
import {
  loadCharacterEquipmentState,
  loadServerCharacterById,
  type ServerCharacterRecord,
} from "@/lib/api/localServiceClient";
import {
  buildPlayerCombatModifierRows,
  formatCombatInitiativeFormula,
  getGmCombatStepActionLabel,
  getPlayerCombatStepLabel,
  PlayerCombatActionButtonPanel,
  PlayerCombatActionResultPanel,
  PlayerCombatActionSelectorPanel,
  PlayerCombatAttackLocationSelector,
  PlayerCombatAttackStatsTable,
  PlayerCombatDefenseStatsTable,
  PlayerCombatModifierPanel,
  PlayerCombatParryContextPanel,
  PlayerCombatPhasePanel,
  playerCombatPanelRowStyle,
  playerCombatTopPanelRowStyle,
  type PlayerCombatPhaseCardView,
} from "@/features/player-combat/PlayerCombatPanels";
import {
  applyDefaultPlayerCombatPhaseContext,
  buildPlayerCombatDefenseStats,
  buildPlayerCombatLoadoutSummary,
  buildPlayerCombatPhasePanelModel,
  isEquipmentFeatureState,
  type PlayerCombatPhaseKey,
} from "@/features/player-combat/playerCombatPhaseModel";
import {
  buildEncounterInitiativeModifierCalculation,
  buildEncounterLiveCombatModifierSummary,
} from "@/lib/campaigns/liveCombatModifiers";
import {
  createEmptyPlayerEncounterCombatContext,
  isPlayerEncounterActionId,
  mergeCombatContextWithCurrentModifierBuckets,
  type PlayerEncounterActionId,
  type PlayerEncounterMovementId,
} from "@/lib/campaigns/playerEncounter";
import { loadCanonicalContent } from "@/lib/content/loadCanonicalContent";

interface CombatRoundManagerPanelProps {
  encounter: EncounterSession;
  onEncounterUpdated?: (encounter: EncounterSession) => void;
  onScenarioParticipantsUpdated?: (participants: ScenarioParticipant[]) => void;
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
  phaseContexts: CombatInspectorPhaseContextDrafts;
  secondaryActionId: PlayerEncounterActionId | "";
}

interface CombatInspectorPhaseContextDrafts {
  phase1: ScenarioParticipantCombatContext;
  phase2: ScenarioParticipantCombatContext;
}

function buildInspectorPhaseContexts(
  participant?: ScenarioParticipant,
  declaration?: CombatRoundDeclaration,
): CombatInspectorPhaseContextDrafts {
  const fallbackContext = mergeCombatContextWithCurrentModifierBuckets({
    baseContext:
      declaration?.combatContext ??
      participant?.state.combat.combatContext ??
      createEmptyPlayerEncounterCombatContext(),
    currentContext: participant?.state.combat.combatContext,
  });

  return {
    phase1: applyDefaultPlayerCombatPhaseContext(
      declaration?.phaseContexts?.phase1 ?? fallbackContext,
    ),
    phase2: applyDefaultPlayerCombatPhaseContext(
      declaration?.phaseContexts?.phase2 ?? fallbackContext,
    ),
  };
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
  declaration?: CombatRoundDeclaration,
): CombatInspectorDeclarationDraft {
  return {
    actionId: isPlayerEncounterActionId(declaration?.actionId)
      ? declaration.actionId
      : isPlayerEncounterActionId(participant?.state.combat.lastDeclaredActionId)
        ? participant.state.combat.lastDeclaredActionId
        : "",
    additionalActionNotes:
      declaration?.additionalActionNotes ?? participant?.state.combat.lastDeclarationNotes ?? "",
    combatContext: mergeCombatContextWithCurrentModifierBuckets({
      baseContext:
        declaration?.combatContext ??
        participant?.state.combat.combatContext ??
        createEmptyPlayerEncounterCombatContext(),
      currentContext: participant?.state.combat.combatContext,
    }),
    movementId: (declaration?.movementId ??
      participant?.state.combat.lastDeclaredMovementId ??
      "hold") as PlayerEncounterMovementId,
    phaseContexts: buildInspectorPhaseContexts(participant, declaration),
    secondaryActionId: isPlayerEncounterActionId(declaration?.secondaryActionId)
      ? declaration.secondaryActionId
      : isPlayerEncounterActionId(participant?.state.combat.lastDeclaredSecondaryActionId)
        ? participant.state.combat.lastDeclaredSecondaryActionId
        : "",
  };
}

function buildInspectorDraftKey(input: {
  declaration?: CombatRoundDeclaration;
  participantId?: string;
}): string | undefined {
  if (!input.participantId) {
    return undefined;
  }

  return [
    input.participantId,
    input.declaration?.roundNumber ?? "no-round-declaration",
    input.declaration?.submittedAt ?? "no-submission-time",
  ].join(":");
}

function getModifierBucketContextKey(
  bucket: ScenarioCombatModifierBucket,
): keyof ScenarioParticipantCombatContext["modifierBuckets"] {
  switch (bucket) {
    case "general":
      return "general";
    case "situation_db":
      return "situationDb";
    case "situation_initiative":
      return "situationInitiative";
    case "situation_ob_skill":
      return "situationObSkill";
  }
}

function hasCombatRoundDeclarationAction(declaration?: CombatRoundDeclaration): boolean {
  return Boolean(
    declaration?.actionId ||
    declaration?.secondaryActionId ||
    declaration?.movementId ||
    declaration?.additionalActionNotes ||
    declaration?.combatContext ||
    declaration?.phaseContexts,
  );
}

function formatInitiativeRankLabel(input: {
  participantId?: string;
  ranks: Record<string, CombatRoundInitiativeRank>;
  value: number | undefined;
}): string | undefined {
  if (!input.participantId || input.value === undefined) {
    return undefined;
  }

  const rank = input.ranks[input.participantId];

  if (!rank) {
    return undefined;
  }

  const tieLabel = rank.tiedCount > 1 ? ` (tied with ${rank.tiedCount})` : "";

  return `Rank: ${rank.rank} of ${rank.rankTotal}${tieLabel}`;
}

function isGridArrowTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return ["BUTTON", "INPUT", "SELECT", "TEXTAREA"].includes(target.tagName);
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
  void input.current;

  switch (input.status) {
    case "submitted":
    case "gmEdited":
    case "complete":
    case "ready":
      return "✓";
    case "locked":
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
  onScenarioParticipantsUpdated,
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
  const [content, setContent] = useState<Awaited<ReturnType<typeof loadCanonicalContent>>>();
  const [resolvedCharacterStateByParticipantId, setResolvedCharacterStateByParticipantId] =
    useState<
      Record<
        string,
        {
          equipmentState: EquipmentFeatureState;
          serverRecord: ServerCharacterRecord;
        }
      >
    >({});
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const selectedRoundNumber = roundState.roundNumber;
  const effectiveScenarioParticipants = useMemo(
    () =>
      scenarioParticipants.map(
        (participant) => scenarioParticipantOverrides[participant.id] ?? participant,
      ),
    [scenarioParticipantOverrides, scenarioParticipants],
  );
  const initiativeSortPhase = shouldSortByInitiative(roundState.currentStep);
  const phase1Ranks = useMemo(
    () => getCombatRoundInitiativeRanks({ phase: "phase1", state: roundState }),
    [roundState],
  );
  const phase2Ranks = useMemo(
    () => getCombatRoundInitiativeRanks({ phase: "phase2", state: roundState }),
    [roundState],
  );
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
  const selectedRoundDeclaration = hasCombatRoundDeclarationAction(
    inspector.participant?.declaration,
  )
    ? inspector.participant?.declaration
    : undefined;
  const inspectorDraftKey = buildInspectorDraftKey({
    declaration: selectedRoundDeclaration,
    participantId: selectedScenarioParticipant?.id,
  });
  const inspectorDraft =
    inspectorDraftKey && inspectorDrafts[inspectorDraftKey]
      ? inspectorDrafts[inspectorDraftKey]
      : buildDeclarationDraft(selectedScenarioParticipant, selectedRoundDeclaration);
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
  const resolvedInspectorCharacterState = selectedScenarioParticipant
    ? resolvedCharacterStateByParticipantId[selectedScenarioParticipant.id]
    : undefined;
  const inspectorBuild = useMemo(() => {
    const result = characterBuildSchema.safeParse(
      resolvedInspectorCharacterState?.serverRecord.build ??
        selectedScenarioParticipant?.snapshot.build,
    );
    return result.success ? result.data : null;
  }, [
    resolvedInspectorCharacterState?.serverRecord.build,
    selectedScenarioParticipant?.snapshot.build,
  ]);
  const inspectorEquipmentState = useMemo(() => {
    const candidate =
      resolvedInspectorCharacterState?.equipmentState ??
      selectedScenarioParticipant?.snapshot.equipmentState;
    return isEquipmentFeatureState(candidate) ? candidate : null;
  }, [
    resolvedInspectorCharacterState?.equipmentState,
    selectedScenarioParticipant?.snapshot.equipmentState,
  ]);
  const inspectorLoadoutModel = useMemo(
    () =>
      buildEquipmentLoadoutModuleModel({
        characterContext:
          content && inspectorBuild
            ? {
                content,
                record: {
                  build: inspectorBuild,
                },
              }
            : null,
        characterId: selectedScenarioParticipant?.characterId ?? "",
        liveCombatModifiers: inspectorLiveModifiers,
        state: inspectorEquipmentState,
        throwingWeaponItemId: null,
      }),
    [
      content,
      inspectorBuild,
      inspectorEquipmentState,
      inspectorLiveModifiers,
      selectedScenarioParticipant?.characterId,
    ],
  );
  const inspectorLoadoutSummary = useMemo(
    () =>
      buildPlayerCombatLoadoutSummary({
        actionId: inspectorDraft.actionId,
        loadoutModel: inspectorLoadoutModel,
        secondaryActionId: inspectorDraft.secondaryActionId,
      }),
    [inspectorDraft.actionId, inspectorDraft.secondaryActionId, inspectorLoadoutModel],
  );
  const inspectorPhaseLoadoutSummaries = useMemo(() => {
    const buildPhaseSummary = (phaseKey: PlayerCombatPhaseKey) => {
      const phaseLiveModifiers = buildEncounterLiveCombatModifierSummary({
        combatContext: inspectorDraft.combatContext,
        combatEffects: selectedScenarioParticipant?.state.combatEffects,
        phaseKey,
      });
      const phaseLoadoutModel = buildEquipmentLoadoutModuleModel({
        characterContext:
          content && inspectorBuild
            ? {
                content,
                record: {
                  build: inspectorBuild,
                },
              }
            : null,
        characterId: selectedScenarioParticipant?.characterId ?? "",
        liveCombatModifiers: phaseLiveModifiers,
        state: inspectorEquipmentState,
        throwingWeaponItemId: null,
      });

      return buildPlayerCombatLoadoutSummary({
        actionId: inspectorDraft.actionId,
        loadoutModel: phaseLoadoutModel,
        secondaryActionId: inspectorDraft.secondaryActionId,
      });
    };

    return {
      phase1: buildPhaseSummary("phase1"),
      phase2: buildPhaseSummary("phase2"),
    };
  }, [
    content,
    inspectorBuild,
    inspectorDraft.actionId,
    inspectorDraft.combatContext,
    inspectorDraft.secondaryActionId,
    inspectorEquipmentState,
    selectedScenarioParticipant?.characterId,
    selectedScenarioParticipant?.state.combatEffects,
  ]);
  const inspectorCurrentInitiativePhase =
    roundState.currentStep === "initiative_phase_1"
      ? "phase1"
      : roundState.currentStep === "initiative_phase_2"
        ? "phase2"
        : undefined;
  const inspectorCurrentInitiative = inspectorCurrentInitiativePhase
    ? inspector.participant?.initiatives[inspectorCurrentInitiativePhase]
    : undefined;
  const inspectorCurrentStepStatus = inspector.participant?.stepStatuses[roundState.currentStep];
  const inspectorParticipantHasDeclared = Boolean(selectedRoundDeclaration);
  const inspectorStatusSuffix = inspectorCurrentInitiative
    ? " Initiative rolled."
    : roundState.currentStep === "review_action_modifiers" &&
        (inspectorCurrentStepStatus === "complete" || inspectorCurrentStepStatus === "gmEdited")
      ? " Modifiers declared."
      : roundState.currentStep === "review_phase_2_modifiers" &&
          (inspectorCurrentStepStatus === "complete" || inspectorCurrentStepStatus === "gmEdited")
        ? " Phase 2 modifiers declared."
        : inspectorParticipantHasDeclared
          ? " Declared."
          : "";
  const inspectorPhaseCards = useMemo<readonly PlayerCombatPhaseCardView[]>(() => {
    if (!inspector.participant) {
      return [];
    }

    return [
      {
        description: "",
        phaseLabel: "Phase 1",
        stats: [],
        title: "",
      },
      {
        description: "",
        phaseLabel: "Phase 2",
        stats: [],
        title: "",
      },
    ];
  }, [inspector.participant]);
  const inspectorInitiativeCalculation = buildEncounterInitiativeModifierCalculation({
    baseInitiative: inspectorLoadoutSummary.passiveInitiative,
    liveModifiers: inspectorLiveModifiers,
  });
  useEffect(() => {
    setRoundState(initialRoundState);
  }, [initialRoundState]);

  useEffect(() => {
    let cancelled = false;

    async function loadContent() {
      try {
        const nextContent = await loadCanonicalContent();

        if (!cancelled) {
          setContent(nextContent);
        }
      } catch (caughtError) {
        if (!cancelled) {
          setSaveError(
            caughtError instanceof Error ? caughtError.message : "Unable to load combat content.",
          );
        }
      }
    }

    void loadContent();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const participantId = selectedScenarioParticipant?.id;
    const characterId = selectedScenarioParticipant?.characterId;

    if (!participantId || !characterId || resolvedCharacterStateByParticipantId[participantId]) {
      return;
    }

    const stableParticipantId = participantId;
    const stableCharacterId = characterId;
    let cancelled = false;

    async function hydrateInspectorCharacterState() {
      try {
        const [serverRecord, equipmentState] = await Promise.all([
          loadServerCharacterById(stableCharacterId),
          loadCharacterEquipmentState(stableCharacterId),
        ]);

        if (cancelled) {
          return;
        }

        setResolvedCharacterStateByParticipantId((current) => ({
          ...current,
          [stableParticipantId]: {
            equipmentState,
            serverRecord,
          },
        }));
      } catch (caughtError) {
        if (!cancelled) {
          setSaveError(
            caughtError instanceof Error
              ? caughtError.message
              : "Unable to load inspector combat loadout.",
          );
        }
      }
    }

    void hydrateInspectorCharacterState();

    return () => {
      cancelled = true;
    };
  }, [
    resolvedCharacterStateByParticipantId,
    selectedScenarioParticipant?.characterId,
    selectedScenarioParticipant?.id,
  ]);

  function focusRoundTable() {
    tableContainerRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
    tableContainerRef.current?.focus({ preventScroll: true });
    tableContainerRef.current?.scrollTo({ left: 0, top: 0 });
  }

  function moveSelectedParticipantDown() {
    setRoundState((current) => {
      const participantIndex = displayParticipants.findIndex(
        (participant) => participant.participantId === current.selectedParticipantId,
      );

      if (participantIndex < 0 || participantIndex >= displayParticipants.length - 1) {
        return current;
      }

      return setCombatRoundSelection({
        participantId: displayParticipants[participantIndex + 1]?.participantId,
        state: current,
        step: current.selectedStep,
      });
    });
  }

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
      focusRoundTable();
      setSaveError(undefined);
    } catch (caughtError) {
      setSaveError(
        caughtError instanceof Error ? caughtError.message : "Unable to save combat round state.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function clearCurrentStep() {
    setSaving(true);

    try {
      const { encounter: nextEncounter, participants } = await clearCurrentCombatRoundStepOnServer({
        encounterId: encounter.id,
      });
      const nextRoundState = initializeCombatRoundState({ encounter: nextEncounter });

      setRoundState(nextRoundState);
      setSaveError(undefined);
      onEncounterUpdated?.(nextEncounter);
      focusRoundTable();

      if (participants.length > 0) {
        setScenarioParticipantOverrides((current) => ({
          ...current,
          ...Object.fromEntries(participants.map((participant) => [participant.id, participant])),
        }));
        setInspectorDrafts((current) => {
          const nextDrafts = { ...current };

          for (const participant of participants) {
            for (const draftKey of Object.keys(nextDrafts)) {
              if (draftKey.startsWith(`${participant.id}:`)) {
                delete nextDrafts[draftKey];
              }
            }
          }

          return nextDrafts;
        });
        onScenarioParticipantsUpdated?.(participants);
      }
    } catch (caughtError) {
      setSaveError(
        caughtError instanceof Error ? caughtError.message : "Unable to clear combat round step.",
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

  function handleTimelineKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (isGridArrowTarget(event.target)) {
      return;
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      moveSelection({ stepOffset: 1 });
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      moveSelection({ stepOffset: -1 });
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      moveSelection({ participantOffset: 1 });
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      moveSelection({ participantOffset: -1 });
    }
  }

  function updateInspectorDraft(patch: Partial<CombatInspectorDeclarationDraft>) {
    if (!inspectorDraftKey) {
      return;
    }

    setInspectorDrafts((current) => ({
      ...current,
      [inspectorDraftKey]: {
        ...inspectorDraft,
        ...patch,
      },
    }));
  }

  function updateInspectorModifierBucket(
    bucket: ScenarioCombatModifierBucket,
    updater: (entries: ScenarioCombatModifierEntry[]) => ScenarioCombatModifierEntry[],
  ) {
    const bucketKey = getModifierBucketContextKey(bucket);

    updateInspectorDraft({
      combatContext: {
        ...inspectorDraft.combatContext,
        modifierBuckets: {
          ...inspectorDraft.combatContext.modifierBuckets,
          [bucketKey]: updater(inspectorDraft.combatContext.modifierBuckets[bucketKey]),
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
            (participant.characterId &&
              participant.characterId === encounterParticipant.characterId),
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
        phaseContexts: inspectorDraft.phaseContexts,
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
      onScenarioParticipantsUpdated?.([participant]);
      moveSelectedParticipantDown();
      setSaveError(undefined);
    } catch (caughtError) {
      setSaveError(
        caughtError instanceof Error ? caughtError.message : "Unable to save combat declaration.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function rollInspectorInitiative() {
    if (!selectedScenarioParticipant || !selectedEncounterParticipant) {
      return;
    }

    setSaving(true);

    try {
      const { encounter: nextEncounter } = await rollCombatInitiativeOnServer({
        encounterId: encounter.id,
        initiativeBase: inspectorInitiativeCalculation.baseInitiative,
        initiativeModifierAdjustment: inspectorInitiativeCalculation.modifierAdjustment,
        scenarioParticipantId: selectedScenarioParticipant.id,
      });
      const nextRoundState = initializeCombatRoundState({ encounter: nextEncounter });

      setRoundState(nextRoundState);
      onEncounterUpdated?.(nextEncounter);
      moveSelectedParticipantDown();
      setSaveError(undefined);
    } catch (caughtError) {
      setSaveError(
        caughtError instanceof Error ? caughtError.message : "Unable to roll combat initiative.",
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
          <button disabled={saving} onClick={() => void clearCurrentStep()} type="button">
            Clear current step
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

      <div
        aria-label="Combat round timeline grid"
        onKeyDown={handleTimelineKeyDown}
        ref={tableContainerRef}
        style={tableWrapStyle}
        tabIndex={0}
      >
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
                          ? participant.initiatives.phase1
                          : step === "initiative_phase_2"
                            ? participant.initiatives.phase2
                            : undefined;
                      const initiativeTotal = getCombatRoundInitiativeTotal(initiative);
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
                            title={
                              initiativeTotal !== undefined
                                ? `${title}, initiative ${initiativeTotal}`
                                : title
                            }
                            type="button"
                          >
                            <span
                              aria-hidden="true"
                              style={{
                                color: initiativeTotal !== undefined ? "#1f7a4d" : undefined,
                                fontWeight: initiativeTotal !== undefined ? 800 : undefined,
                              }}
                            >
                              {initiativeTotal ?? marker}
                            </span>
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
                  {COMBAT_ROUND_STEP_LABELS[inspector.step]}
                </h3>
                <div style={{ color: "#5e5a50", fontSize: "0.92rem" }}>
                  {COMBAT_ROUND_STEP_LABELS[inspector.step]} · {formatStepStatus(inspector.status)}
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
                <div style={playerCombatTopPanelRowStyle}>
                  <PlayerCombatActionSelectorPanel
                    actionId={inspectorDraft.actionId}
                    additionalActionNotes={inspectorDraft.additionalActionNotes}
                    movementId={inspectorDraft.movementId}
                    onActionChange={(actionId) => updateInspectorDraft({ actionId })}
                    onAdditionalActionNotesChange={(additionalActionNotes) =>
                      updateInspectorDraft({ additionalActionNotes })
                    }
                    onMovementChange={(movementId) => updateInspectorDraft({ movementId })}
                    onSecondaryActionChange={(secondaryActionId) =>
                      updateInspectorDraft({ secondaryActionId })
                    }
                    roundNumber={roundState.roundNumber}
                    secondaryActionId={inspectorDraft.secondaryActionId}
                  />
                  {inspectorPhaseCards.map((phaseCard, index) => {
                    const phaseKey: PlayerCombatPhaseKey = index === 0 ? "phase1" : "phase2";
                    const phaseCombatContext = inspectorDraft.phaseContexts[phaseKey];
                    const phaseLoadoutSummary = inspectorPhaseLoadoutSummaries[phaseKey];
                    const phaseModel = buildPlayerCombatPhasePanelModel({
                      actionId: inspectorDraft.actionId,
                      attackStats: phaseLoadoutSummary.attackStats,
                      defenseStats: buildPlayerCombatDefenseStats({
                        mainHandParryItemLabel: phaseLoadoutSummary.mainHandParryItemLabel,
                        offHandParryItemLabel: phaseLoadoutSummary.offHandParryItemLabel,
                        phaseContext: phaseCombatContext,
                        reference: phaseLoadoutSummary.reference,
                      }),
                      phaseCard,
                      phaseContext: phaseCombatContext,
                      phaseKey,
                      secondaryActionId: inspectorDraft.secondaryActionId,
                    });

                    return (
                      <PlayerCombatPhasePanel
                        key={phaseModel.phaseCard.phaseLabel}
                        phaseCard={phaseCard}
                      >
                        {phaseModel.showAttackStats && phaseModel.attackStats ? (
                          <PlayerCombatAttackStatsTable stats={phaseModel.attackStats} />
                        ) : null}
                        {phaseModel.showAttackLocationSelector ? (
                          <PlayerCombatAttackLocationSelector
                            combatContext={phaseModel.phaseContext}
                            controlsDisabled={saving}
                            onCombatContextChange={(combatContext) =>
                              updateInspectorDraft({
                                phaseContexts: {
                                  ...inspectorDraft.phaseContexts,
                                  [phaseKey]: combatContext,
                                },
                              })
                            }
                          />
                        ) : null}
                        {phaseModel.showDefenseContext && phaseModel.defenseStats ? (
                          <>
                            <PlayerCombatDefenseStatsTable stats={phaseModel.defenseStats} />
                            <PlayerCombatParryContextPanel
                              combatContext={phaseModel.phaseContext}
                              controlsDisabled={saving}
                              mainHandItemLabel={phaseLoadoutSummary.mainHandParryItemLabel}
                              offHandItemLabel={phaseLoadoutSummary.offHandParryItemLabel}
                              onCombatContextChange={(combatContext) =>
                                updateInspectorDraft({
                                  phaseContexts: {
                                    ...inspectorDraft.phaseContexts,
                                    [phaseKey]: combatContext,
                                  },
                                })
                              }
                            />
                          </>
                        ) : null}
                      </PlayerCombatPhasePanel>
                    );
                  })}
                </div>

                <div style={playerCombatPanelRowStyle}>
                  <PlayerCombatModifierPanel
                    controlsDisabled={saving}
                    onAddEntry={(bucketKey, entry) =>
                      updateInspectorModifierBucket(bucketKey, (current) => [
                        ...current,
                        entry ?? createModifierEntryDraft(),
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
                    buttonLabel={getGmCombatStepActionLabel(roundState.currentStep)}
                    disabled={saving}
                    onDeclareAction={() =>
                      void (roundState.currentStep === "initiative_phase_1" ||
                      roundState.currentStep === "initiative_phase_2"
                        ? rollInspectorInitiative()
                        : saveInspectorDeclaration())
                    }
                    saving={saving}
                    statusText={`Current step: ${getPlayerCombatStepLabel(
                      roundState.currentStep,
                    )}.${inspectorStatusSuffix}`}
                  />
                  <PlayerCombatActionResultPanel
                    result={
                      inspectorCurrentInitiative
                        ? {
                            interpretedResult: formatCombatInitiativeFormula(
                              inspectorCurrentInitiative,
                            ),
                            rankLabel: formatInitiativeRankLabel({
                              participantId: inspector.participant?.participantId,
                              ranks:
                                inspectorCurrentInitiativePhase === "phase2"
                                  ? phase2Ranks
                                  : phase1Ranks,
                              value: getCombatRoundInitiativeTotal(inspectorCurrentInitiative),
                            }),
                          }
                        : null
                    }
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
