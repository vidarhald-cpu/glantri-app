"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  type CombatRoundDeclaration,
  characterBuildSchema,
  getCombatRoundInitiativePositions,
  getCombatRoundInitiativeTotal,
  initializeCombatRoundState,
  type EncounterSession,
  type ScenarioCombatModifierBucket,
  type ScenarioCombatModifierEntry,
  type ScenarioParticipantCombatContext,
  type ScenarioParticipant,
  type ScenarioPlayerProjection,
} from "@glantri/domain";

import {
  buildEquipmentLoadoutModuleModel,
  EquipmentLoadoutModule,
} from "@/features/equipment/loadoutModule";
import {
  buildPlayerCombatModifierRows,
  getPlayerCombatActionButtonLabel,
  getPlayerCombatStepLabel,
  formatCombatInitiativeFormula,
  formatCombatInitiativeRoll,
  PlayerCombatAttackStatsTable,
  PlayerCombatActionButtonPanel,
  PlayerCombatActionResultPanel,
  PlayerCombatActionSelectorPanel,
  PlayerCombatDefenseStatsTable,
  PlayerCombatModifierPanel,
  PlayerCombatParryContextPanel,
  PlayerCombatPhasePanel,
  playerCombatPanelRowStyle,
  playerCombatTopPanelRowStyle,
} from "@/features/player-combat/PlayerCombatPanels";
import {
  applyDefaultPlayerCombatPhaseContext,
  buildPlayerCombatDefenseStats,
  buildPlayerCombatLoadoutSummary,
  buildPlayerCombatPhasePanelModel,
  isEquipmentFeatureState,
  type PlayerCombatPhaseKey,
} from "@/features/player-combat/playerCombatPhaseModel";
import type { EquipmentFeatureState } from "@/features/equipment/types";
import { useSessionUser } from "@/lib/auth/SessionUserContext";
import type { CombatAllocationState } from "@glantri/rules-engine";
import {
  createEmptyPlayerEncounterCombatContext,
  evaluatePlayerEncounterParryLegality,
  getPlayerEncounterAccessibleParticipants,
  isPlayerEncounterActionId,
  type PlayerEncounterActionId,
  type PlayerEncounterMovementId,
} from "@/lib/campaigns/playerEncounter";
import { loadCanonicalContent } from "@/lib/content/loadCanonicalContent";
import {
  loadCharacterEquipmentState,
  loadEncounterById,
  loadScenarioMyParticipant,
  loadScenarioParticipants,
  loadScenarioPlayerProjection,
  loadServerCharacterById,
  rollCombatInitiativeOnServer,
  submitCombatDeclarationOnServer,
  type ServerCharacterRecord,
} from "@/lib/api/localServiceClient";
import {
  buildRememberedScopedSelectionKey,
  REMEMBERED_SELECTION_KEYS,
  useRememberedSelection,
} from "@/lib/browser/rememberedSelection";
import RememberedCampaignWorkspaceEffect from "@/lib/campaigns/RememberedCampaignWorkspaceEffect";
import { buildCampaignWorkspaceHref, type CampaignWorkspaceTabId } from "@/lib/campaigns/workspace";
import { buildEncounterLiveCombatModifierSummary } from "@/lib/campaigns/liveCombatModifiers";

interface ScenarioPlayerCombatPageContentProps {
  campaignId: string;
  encounterId?: string;
  embedded?: boolean;
  encounterTitle?: string;
  participantId?: string;
  readOnlyInspection?: boolean;
  scenarioId: string;
  showParticipantSelector?: boolean;
  showWorkspaceHeader?: boolean;
  workspaceTab?: Extract<CampaignWorkspaceTabId, "combat" | "player-combat" | "player-encounter">;
}

const panelStyle = {
  background: "#f6f5ef",
  border: "1px solid #d9ddd8",
  borderRadius: 12,
  display: "grid",
  gap: "0.75rem",
  padding: "1rem",
} as const;

function createModifierEntryDraft(): ScenarioCombatModifierEntry {
  return {
    id: `modifier-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    notes: "",
    scope: "until",
    value: 0,
  };
}

interface PlayerCombatDeclarationDraft {
  actionId: PlayerEncounterActionId | "";
  additionalActionNotes: string;
  combatContext: ScenarioParticipantCombatContext;
  movementId: PlayerEncounterMovementId | "";
  phaseContexts: PlayerCombatPhaseContextDrafts;
  secondaryActionId: PlayerEncounterActionId | "";
}

interface PlayerCombatPhaseContextDrafts {
  phase1: ScenarioParticipantCombatContext;
  phase2: ScenarioParticipantCombatContext;
}

function buildPlayerCombatPhaseContexts(input: {
  declaration?: CombatRoundDeclaration;
  participant?: ScenarioParticipant | null;
}): PlayerCombatPhaseContextDrafts {
  const fallbackContext =
    input.declaration?.combatContext ??
    input.participant?.state.combat.combatContext ??
    createEmptyPlayerEncounterCombatContext();

  return {
    phase1: applyDefaultPlayerCombatPhaseContext(
      input.declaration?.phaseContexts?.phase1 ?? fallbackContext,
    ),
    phase2: applyDefaultPlayerCombatPhaseContext(
      input.declaration?.phaseContexts?.phase2 ?? fallbackContext,
    ),
  };
}

function hasCombatRoundDeclarationAction(
  declaration?: CombatRoundDeclaration,
): declaration is CombatRoundDeclaration {
  return Boolean(
    declaration?.actionId ||
    declaration?.secondaryActionId ||
    declaration?.movementId ||
    declaration?.additionalActionNotes ||
    declaration?.combatContext ||
    declaration?.phaseContexts,
  );
}

function buildPlayerCombatDeclarationDraft(input: {
  declaration?: CombatRoundDeclaration;
  participant?: ScenarioParticipant | null;
}): PlayerCombatDeclarationDraft {
  const { declaration, participant } = input;

  return {
    actionId: isPlayerEncounterActionId(declaration?.actionId)
      ? declaration.actionId
      : isPlayerEncounterActionId(participant?.state.combat.lastDeclaredActionId)
        ? participant.state.combat.lastDeclaredActionId
        : "",
    additionalActionNotes:
      declaration?.additionalActionNotes ?? participant?.state.combat.lastDeclarationNotes ?? "",
    combatContext:
      declaration?.combatContext ??
      participant?.state.combat.combatContext ??
      createEmptyPlayerEncounterCombatContext(),
    movementId: (declaration?.movementId ??
      participant?.state.combat.lastDeclaredMovementId ??
      "hold") as PlayerEncounterMovementId,
    phaseContexts: buildPlayerCombatPhaseContexts(input),
    secondaryActionId: isPlayerEncounterActionId(declaration?.secondaryActionId)
      ? declaration.secondaryActionId
      : isPlayerEncounterActionId(participant?.state.combat.lastDeclaredSecondaryActionId)
        ? participant.state.combat.lastDeclaredSecondaryActionId
        : "",
  };
}

function buildPlayerCombatDeclarationDraftKey(input: {
  currentStep?: string;
  declaration?: CombatRoundDeclaration;
  encounterId?: string;
  participantId?: string;
  roundNumber?: number;
  stepStatus?: string;
}): string {
  return [
    input.encounterId ?? "no-encounter",
    input.participantId ?? "no-participant",
    input.roundNumber ?? "no-round",
    input.currentStep ?? "no-step",
    input.stepStatus ?? "no-status",
    input.declaration?.submittedAt ?? "no-submission-time",
  ].join(":");
}

function formatPlayerCombatInitiativeRank(input: {
  participantId?: string;
  positions: Record<string, number>;
  value: number | undefined;
}): string | undefined {
  if (!input.participantId || input.value === undefined) {
    return undefined;
  }

  const position = input.positions[input.participantId];
  const rankedCount = Object.keys(input.positions).length;

  return position && rankedCount > 0 ? `Rank: ${position} of ${rankedCount}` : undefined;
}

export default function ScenarioPlayerCombatPageContent({
  campaignId,
  encounterId,
  embedded = false,
  encounterTitle,
  participantId,
  readOnlyInspection = false,
  scenarioId,
  showParticipantSelector = true,
  showWorkspaceHeader = true,
  workspaceTab = "player-encounter",
}: ScenarioPlayerCombatPageContentProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentUser, loading: sessionLoading } = useSessionUser();
  const [content, setContent] = useState<Awaited<ReturnType<typeof loadCanonicalContent>>>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [projection, setProjection] = useState<ScenarioPlayerProjection>();
  const [encounterSession, setEncounterSession] = useState<EncounterSession>();
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
  const [selectableParticipants, setSelectableParticipants] = useState<ScenarioParticipant[]>([]);
  const [selectedParticipantId, setSelectedParticipantId] = useState<string>("");
  const [selectedActionId, setSelectedActionId] = useState<PlayerEncounterActionId | "">("");
  const [selectedSecondaryActionId, setSelectedSecondaryActionId] = useState<
    PlayerEncounterActionId | ""
  >("");
  const [selectedMovementId, setSelectedMovementId] = useState<PlayerEncounterMovementId | "">(
    "hold",
  );
  const [additionalActionNotes, setAdditionalActionNotes] = useState("");
  const [combatContextDraft, setCombatContextDraft] = useState<ScenarioParticipantCombatContext>(
    createEmptyPlayerEncounterCombatContext(),
  );
  const [phaseCombatContextDrafts, setPhaseCombatContextDrafts] =
    useState<PlayerCombatPhaseContextDrafts>({
      phase1: createEmptyPlayerEncounterCombatContext(),
      phase2: createEmptyPlayerEncounterCombatContext(),
    });
  const [combatDeclarationDraftDirty, setCombatDeclarationDraftDirty] = useState(false);
  const [combatDeclarationDraftKey, setCombatDeclarationDraftKey] = useState("");
  const [savingCombatContext, setSavingCombatContext] = useState(false);
  const [actionRollResult, setActionRollResult] = useState<{
    interpretedResult: string;
    phaseLabel?: string;
    value: number;
  } | null>(null);
  const isGameMaster = Boolean(
    currentUser?.roles.includes("game_master") || currentUser?.roles.includes("admin"),
  );
  const controlsDisabled = readOnlyInspection;
  const rememberedParticipantSelection = useRememberedSelection(
    buildRememberedScopedSelectionKey({
      baseKey: REMEMBERED_SELECTION_KEYS.playerEncounterParticipantId,
      scopeParts: [campaignId, scenarioId],
    }),
  );

  useEffect(() => {
    if (sessionLoading) {
      return;
    }

    if (!currentUser) {
      setProjection(undefined);
      setContent(undefined);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function refreshCombatView(input: { showLoading?: boolean } = {}) {
      if (input.showLoading ?? false) {
        setLoading(true);
      }

      try {
        const [nextProjection, nextContent, nextParticipants, nextEncounter] = await Promise.all([
          loadScenarioPlayerProjection(scenarioId),
          loadCanonicalContent(),
          isGameMaster
            ? loadScenarioParticipants(scenarioId)
            : loadScenarioMyParticipant(scenarioId).then((p) => (p ? [p] : [])),
          encounterId ? loadEncounterById(encounterId) : Promise.resolve(undefined),
        ]);

        if (cancelled) {
          return;
        }

        setProjection(nextProjection);
        setContent(nextContent);
        setSelectableParticipants(nextParticipants);
        setEncounterSession(nextEncounter);
        setError(undefined);
      } catch (caughtError) {
        if (cancelled) {
          return;
        }

        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to load the player combat screen.",
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void refreshCombatView({ showLoading: true });

    const intervalId = window.setInterval(() => {
      if (cancelled) {
        return;
      }

      void refreshCombatView();
    }, 5000);

    function refreshOnFocus() {
      if (cancelled || document.visibilityState === "hidden") {
        return;
      }

      void refreshCombatView();
    }

    window.addEventListener("focus", refreshOnFocus);
    document.addEventListener("visibilitychange", refreshOnFocus);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refreshOnFocus);
      document.removeEventListener("visibilitychange", refreshOnFocus);
    };
  }, [currentUser, encounterId, isGameMaster, scenarioId, sessionLoading]);

  const accessibleParticipants = useMemo(() => {
    if (!projection) {
      return [];
    }

    return getPlayerEncounterAccessibleParticipants({
      currentUserId: currentUser?.id,
      isGameMaster,
      participants: selectableParticipants,
      projectionVisibleParticipants: projection.visibleParticipants,
    });
  }, [currentUser?.id, isGameMaster, projection, selectableParticipants]);

  useEffect(() => {
    if (accessibleParticipants.length === 0 || !rememberedParticipantSelection.hydrated) {
      setSelectedParticipantId("");
      return;
    }

    const projectionControlledId = projection?.controlledParticipantId;
    const explicitParticipantId = participantId;
    const rememberedParticipantId = rememberedParticipantSelection.value;
    const explicitAccessibleParticipant = accessibleParticipants.find(
      (participant) => participant.id === explicitParticipantId,
    );
    const preferredId =
      explicitAccessibleParticipant?.id ??
      accessibleParticipants.find((participant) => participant.id === rememberedParticipantId)
        ?.id ??
      accessibleParticipants.find((participant) => participant.id === projectionControlledId)?.id ??
      accessibleParticipants[0]?.id;

    setSelectedParticipantId((current) =>
      explicitAccessibleParticipant
        ? explicitAccessibleParticipant.id
        : accessibleParticipants.some((participant) => participant.id === current)
          ? current
          : (preferredId ?? ""),
    );
  }, [
    accessibleParticipants,
    participantId,
    projection,
    rememberedParticipantSelection.hydrated,
    rememberedParticipantSelection.value,
  ]);

  useEffect(() => {
    if (!rememberedParticipantSelection.hydrated) {
      return;
    }

    rememberedParticipantSelection.setValue(selectedParticipantId || undefined);
  }, [rememberedParticipantSelection, selectedParticipantId]);

  useEffect(() => {
    const currentParticipantId = searchParams.get("participantId");
    const nextParams = new URLSearchParams(searchParams.toString());

    if (selectedParticipantId) {
      nextParams.set("participantId", selectedParticipantId);
    } else {
      nextParams.delete("participantId");
    }

    const currentHref = searchParams.toString()
      ? `${pathname}?${searchParams.toString()}`
      : pathname;
    const nextQuery = nextParams.toString();
    const nextHref = nextQuery ? `${pathname}?${nextQuery}` : pathname;

    if (currentParticipantId !== selectedParticipantId && currentHref !== nextHref) {
      router.replace(nextHref);
    }
  }, [pathname, router, searchParams, selectedParticipantId]);

  useEffect(() => {
    setActionRollResult(null);
  }, [selectedParticipantId]);

  const selectedParticipant = useMemo(
    () =>
      accessibleParticipants.find((participant) => participant.id === selectedParticipantId) ??
      null,
    [accessibleParticipants, selectedParticipantId],
  );
  const combatRoundState = useMemo(
    () => (encounterSession ? initializeCombatRoundState({ encounter: encounterSession }) : null),
    [encounterSession],
  );
  const declarationRoundNumber =
    combatRoundState?.roundNumber ?? encounterSession?.currentRound ?? undefined;
  const selectedEncounterParticipant = useMemo(
    () =>
      encounterSession?.participants.find(
        (participant) =>
          participant.scenarioParticipantId === selectedParticipant?.id ||
          participant.id === selectedParticipant?.id ||
          (participant.characterId && participant.characterId === selectedParticipant?.characterId),
      ),
    [encounterSession?.participants, selectedParticipant],
  );
  const selectedRoundParticipant = useMemo(
    () =>
      selectedEncounterParticipant && combatRoundState
        ? combatRoundState.participants.find(
            (participant) => participant.participantId === selectedEncounterParticipant.id,
          )
        : undefined,
    [combatRoundState, selectedEncounterParticipant],
  );
  const selectedDeclarationStepStatus =
    selectedRoundParticipant?.stepStatuses.select_actions ?? "pending";
  const selectedRoundDeclaration = hasCombatRoundDeclarationAction(
    selectedRoundParticipant?.declaration,
  )
    ? selectedRoundParticipant.declaration
    : undefined;
  const selectedCombatDeclarationDraftKey = buildPlayerCombatDeclarationDraftKey({
    currentStep: combatRoundState?.currentStep,
    declaration: selectedRoundDeclaration,
    encounterId,
    participantId: selectedParticipant?.id,
    roundNumber: declarationRoundNumber,
    stepStatus: selectedDeclarationStepStatus,
  });
  const selectedParticipantDeclaredThisRound = Boolean(
    selectedRoundDeclaration ??
    (declarationRoundNumber &&
      selectedParticipant?.state.combat.lastDeclaredActionId &&
      selectedParticipant.state.combat.lastDeclaredRoundNumber === declarationRoundNumber),
  );
  const declarationStepOpen =
    !combatRoundState || combatRoundState.currentStep === "select_actions";

  useEffect(() => {
    if (!selectedParticipant) {
      setSelectedActionId("");
      setSelectedSecondaryActionId("");
      setSelectedMovementId("hold");
      setAdditionalActionNotes("");
      setCombatContextDraft(createEmptyPlayerEncounterCombatContext());
      setPhaseCombatContextDrafts({
        phase1: createEmptyPlayerEncounterCombatContext(),
        phase2: createEmptyPlayerEncounterCombatContext(),
      });
      setCombatDeclarationDraftDirty(false);
      setCombatDeclarationDraftKey(selectedCombatDeclarationDraftKey);
      return;
    }

    if (
      combatDeclarationDraftDirty &&
      combatDeclarationDraftKey === selectedCombatDeclarationDraftKey &&
      (isGameMaster || declarationStepOpen)
    ) {
      return;
    }

    const nextDraft = buildPlayerCombatDeclarationDraft({
      declaration: selectedRoundDeclaration,
      participant: selectedParticipant,
    });

    setSelectedActionId(nextDraft.actionId);
    setSelectedSecondaryActionId(nextDraft.secondaryActionId);
    setSelectedMovementId(nextDraft.movementId);
    setAdditionalActionNotes(nextDraft.additionalActionNotes);
    setCombatContextDraft(nextDraft.combatContext);
    setPhaseCombatContextDrafts(nextDraft.phaseContexts);
    setCombatDeclarationDraftDirty(false);
    setCombatDeclarationDraftKey(selectedCombatDeclarationDraftKey);
  }, [
    combatDeclarationDraftDirty,
    combatDeclarationDraftKey,
    declarationStepOpen,
    isGameMaster,
    selectedCombatDeclarationDraftKey,
    selectedParticipant,
    selectedRoundDeclaration,
  ]);

  useEffect(() => {
    const participantId = selectedParticipant?.id;
    const selectedCharacterId = selectedParticipant?.characterId;

    if (!selectedParticipant || !participantId || !selectedCharacterId) {
      return;
    }

    const stableParticipantId: string = participantId;
    const characterId: string = selectedCharacterId;

    if (resolvedCharacterStateByParticipantId[stableParticipantId]) {
      return;
    }

    let cancelled = false;

    async function hydrateSelectedCharacterParticipant() {
      try {
        const [serverRecord, equipmentState] = await Promise.all([
          loadServerCharacterById(characterId),
          loadCharacterEquipmentState(characterId),
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
        if (cancelled) {
          return;
        }

        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to load the selected participant character snapshot.",
        );
      }
    }

    void hydrateSelectedCharacterParticipant();

    return () => {
      cancelled = true;
    };
  }, [resolvedCharacterStateByParticipantId, selectedParticipant]);

  const displayedParticipant = useMemo(() => {
    if (!selectedParticipant) {
      return projection?.controlledParticipant;
    }

    const resolvedCharacterState = resolvedCharacterStateByParticipantId[selectedParticipant.id];

    return {
      build: resolvedCharacterState?.serverRecord.build ?? selectedParticipant.snapshot.build,
      characterId: selectedParticipant.characterId,
      conditionCount: selectedParticipant.state.conditions.length,
      currentHp: selectedParticipant.state.health.currentHp,
      displayName: selectedParticipant.snapshot.displayName,
      equipmentState:
        resolvedCharacterState?.equipmentState ?? selectedParticipant.snapshot.equipmentState,
      factionId: selectedParticipant.factionId,
      id: selectedParticipant.id,
      maxHp: selectedParticipant.state.health.maxHp,
      role: selectedParticipant.role,
      sourceType: selectedParticipant.sourceType,
    };
  }, [projection, resolvedCharacterStateByParticipantId, selectedParticipant]);

  const controlledBuild = useMemo(() => {
    const result = characterBuildSchema.safeParse(displayedParticipant?.build);
    return result.success ? result.data : null;
  }, [displayedParticipant]);

  const controlledEquipmentState = useMemo(() => {
    const candidate = displayedParticipant?.equipmentState;
    return isEquipmentFeatureState(candidate) ? candidate : null;
  }, [displayedParticipant]);

  const liveCombatModifiers = useMemo(
    () =>
      buildEncounterLiveCombatModifierSummary({
        combatContext: combatContextDraft,
        combatEffects: selectedParticipant?.state.combatEffects,
      }),
    [combatContextDraft, selectedParticipant?.state.combatEffects],
  );
  const modifierRows = useMemo(
    () =>
      buildPlayerCombatModifierRows({
        combatContext: combatContextDraft,
        liveModifiers: liveCombatModifiers,
      }),
    [combatContextDraft, liveCombatModifiers],
  );

  const loadoutFieldValueMap = useMemo(
    () =>
      new Map<string, string>(
        buildEquipmentLoadoutModuleModel({
          characterContext:
            content && controlledBuild
              ? {
                  content,
                  record: {
                    build: controlledBuild,
                  },
                }
              : null,
          characterId: displayedParticipant?.characterId ?? "",
          state: controlledEquipmentState,
          throwingWeaponItemId: null,
        }).fields.map((field) => [field.id, field.value]),
      ),
    [content, controlledBuild, controlledEquipmentState, displayedParticipant],
  );

  const parryLegality = useMemo(
    () =>
      evaluatePlayerEncounterParryLegality({
        actionId: selectedActionId,
        attackSource: selectedActionId === "attack_parry" ? "mainHand" : undefined,
        hasOffHandWeapon: Boolean(loadoutFieldValueMap.get("secondary")),
        hasShield: Boolean(loadoutFieldValueMap.get("shield")),
        hasSelectedOpponent: true,
        incomingAttackSide: phaseCombatContextDrafts.phase1.incomingAttackSide,
        parrySource: phaseCombatContextDrafts.phase1.parrySource,
      }),
    [
      loadoutFieldValueMap,
      phaseCombatContextDrafts.phase1.incomingAttackSide,
      phaseCombatContextDrafts.phase1.parrySource,
      selectedActionId,
    ],
  );

  const combatAllocationInputs = useMemo<CombatAllocationState>(
    () => ({
      defensePosture:
        selectedActionId === "attack_parry" && parryLegality.status === "legal" ? "parry" : "none",
      parry: {
        allocatedOb: null,
        source:
          parryLegality.resolvedParrySource === "shield"
            ? "shield"
            : parryLegality.resolvedParrySource === "offHand"
              ? "secondary"
              : parryLegality.resolvedParrySource === "mainHand"
                ? "primary"
                : "none",
      },
      situationalModifiers: {
        attack: 0,
        defense: 0,
        movement: 0,
        perception: 0,
      },
    }),
    [parryLegality, selectedActionId],
  );

  const loadoutModel = useMemo(
    () =>
      buildEquipmentLoadoutModuleModel({
        characterContext:
          content && controlledBuild
            ? {
                content,
                record: {
                  build: controlledBuild,
                },
              }
            : null,
        characterId: displayedParticipant?.characterId ?? "",
        combatAllocationInputs,
        liveCombatModifiers,
        state: controlledEquipmentState,
        throwingWeaponItemId: null,
      }),
    [
      combatAllocationInputs,
      content,
      controlledBuild,
      controlledEquipmentState,
      displayedParticipant,
      liveCombatModifiers,
    ],
  );

  function markCombatDeclarationDraftDirty() {
    setCombatDeclarationDraftDirty(true);
    setCombatDeclarationDraftKey(selectedCombatDeclarationDraftKey);
  }

  function updateModifierBucket(
    bucket: ScenarioCombatModifierBucket,
    updater: (entries: ScenarioCombatModifierEntry[]) => ScenarioCombatModifierEntry[],
  ) {
    markCombatDeclarationDraftDirty();
    setCombatContextDraft((current) => ({
      ...current,
      modifierBuckets: {
        ...current.modifierBuckets,
        [bucket === "general"
          ? "general"
          : bucket === "situation_ob_skill"
            ? "situationObSkill"
            : "situationDb"]: updater(
          bucket === "general"
            ? current.modifierBuckets.general
            : bucket === "situation_ob_skill"
              ? current.modifierBuckets.situationObSkill
              : current.modifierBuckets.situationDb,
        ),
      },
    }));
  }

  async function saveCombatContext() {
    if (readOnlyInspection) {
      return;
    }

    if (!selectedParticipant) {
      return;
    }

    setSavingCombatContext(true);

    try {
      if (!encounterId) {
        throw new Error("Select an encounter before declaring a combat action.");
      }

      const { encounter, participant } = await submitCombatDeclarationOnServer({
        actionId: selectedActionId || undefined,
        additionalActionNotes,
        combatContext: combatContextDraft,
        encounterId,
        movementId: selectedMovementId || undefined,
        phaseContexts: phaseCombatContextDrafts,
        scenarioParticipantId: selectedParticipant.id,
        secondaryActionId: selectedSecondaryActionId || undefined,
      });

      setSelectableParticipants((current) =>
        current.map((entry) => (entry.id === participant.id ? participant : entry)),
      );
      setEncounterSession(encounter);
      setCombatDeclarationDraftDirty(false);
      setError(undefined);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : "Unable to save combat context.",
      );
    } finally {
      setSavingCombatContext(false);
    }
  }

  async function rollInitiative() {
    if (readOnlyInspection) {
      return;
    }

    if (!selectedParticipant || !encounterId) {
      return;
    }

    setSavingCombatContext(true);

    try {
      const { encounter } = await rollCombatInitiativeOnServer({
        encounterId,
        initiativeBase,
        scenarioParticipantId: selectedParticipant.id,
      });

      setEncounterSession(encounter);
      setError(undefined);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : "Unable to roll combat initiative.",
      );
    } finally {
      setSavingCombatContext(false);
    }
  }

  const combatLoadoutSummary = useMemo(
    () =>
      buildPlayerCombatLoadoutSummary({
        actionId: selectedActionId,
        loadoutModel,
        secondaryActionId: selectedSecondaryActionId,
      }),
    [loadoutModel, selectedActionId, selectedSecondaryActionId],
  );
  const initiativeBase = useMemo(() => {
    // Initiative uses direct raw additions for this workflow pass; no percentage table is applied.
    return (
      combatLoadoutSummary.passiveInitiative +
      (liveCombatModifiers?.generalFatigueRaw ?? 0) +
      (liveCombatModifiers?.obSkillRaw ?? 0)
    );
  }, [
    combatLoadoutSummary.passiveInitiative,
    liveCombatModifiers?.generalFatigueRaw,
    liveCombatModifiers?.obSkillRaw,
  ]);

  const phaseCards = useMemo(() => {
    return [
      {
        description: selectedActionId ? "" : "No action selected yet.",
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
    ] as const;
  }, [selectedActionId]);

  const hasMeaningfulDeclaration =
    Boolean(selectedActionId) ||
    Boolean(selectedSecondaryActionId) ||
    additionalActionNotes.trim().length > 0;
  const currentCombatStep = combatRoundState?.currentStep ?? "select_actions";
  const currentCombatStepLabel = getPlayerCombatStepLabel(currentCombatStep);
  const currentInitiativePhase =
    currentCombatStep === "initiative_phase_1"
      ? "phase1"
      : currentCombatStep === "initiative_phase_2"
        ? "phase2"
        : undefined;
  const selectedCurrentInitiative = currentInitiativePhase
    ? selectedRoundParticipant?.initiatives[currentInitiativePhase]
    : undefined;
  const phase1InitiativePositions = useMemo(
    () =>
      combatRoundState
        ? getCombatRoundInitiativePositions({ phase: "phase1", state: combatRoundState })
        : {},
    [combatRoundState],
  );
  const phase2InitiativePositions = useMemo(
    () =>
      combatRoundState
        ? getCombatRoundInitiativePositions({ phase: "phase2", state: combatRoundState })
        : {},
    [combatRoundState],
  );
  const selectedCurrentInitiativeRankLabel = currentInitiativePhase
    ? formatPlayerCombatInitiativeRank({
        participantId: selectedRoundParticipant?.participantId,
        positions:
          currentInitiativePhase === "phase2"
            ? phase2InitiativePositions
            : phase1InitiativePositions,
        value: getCombatRoundInitiativeTotal(selectedCurrentInitiative),
      })
    : undefined;
  const playerDeclarationLocked =
    !isGameMaster &&
    (!declarationStepOpen ||
      selectedParticipantDeclaredThisRound ||
      selectedDeclarationStepStatus !== "pending");
  const declarationControlsDisabled = controlsDisabled || playerDeclarationLocked;
  const initiativeStepStatus =
    currentCombatStep === "initiative_phase_1"
      ? (selectedRoundParticipant?.stepStatuses.initiative_phase_1 ?? "pending")
      : currentCombatStep === "initiative_phase_2"
        ? (selectedRoundParticipant?.stepStatuses.initiative_phase_2 ?? "pending")
        : undefined;
  const selectedParticipantRolledCurrentInitiative = Boolean(
    currentInitiativePhase && selectedCurrentInitiative !== undefined,
  );
  const canUseInitiativeButton =
    Boolean(currentInitiativePhase) &&
    Boolean(displayedParticipant) &&
    Boolean(selectedRoundParticipant) &&
    (isGameMaster ||
      (initiativeStepStatus === "pending" && !selectedParticipantRolledCurrentInitiative));
  const declareActionDisabled =
    controlsDisabled ||
    savingCombatContext ||
    !displayedParticipant ||
    (currentInitiativePhase
      ? !canUseInitiativeButton
      : !isGameMaster && (playerDeclarationLocked || !hasMeaningfulDeclaration));
  const declarationButtonLabel = getPlayerCombatActionButtonLabel({
    currentStep: currentCombatStep,
    disabled: declareActionDisabled,
    isGameMaster,
  });
  const declarationStatusText = isGameMaster
    ? `Current step: ${currentCombatStepLabel}. GM can save or revise this participant declaration.`
    : currentInitiativePhase
      ? selectedParticipantRolledCurrentInitiative
        ? `Current step: ${currentCombatStepLabel}. Initiative rolled.`
        : initiativeStepStatus === "pending"
          ? `Current step: ${currentCombatStepLabel}.`
          : `Current step: ${currentCombatStepLabel}. Waiting for GM.`
      : selectedParticipantDeclaredThisRound ||
          selectedDeclarationStepStatus === "submitted" ||
          selectedDeclarationStepStatus === "gmEdited"
        ? `Current step: ${currentCombatStepLabel}. Declared.`
        : declarationStepOpen && selectedDeclarationStepStatus === "pending"
          ? `Current step: ${currentCombatStepLabel}.`
          : `Current step: ${currentCombatStepLabel}. Declaration closed.`;

  if (sessionLoading || loading) {
    return <section>Loading player combat screen...</section>;
  }

  if (!currentUser) {
    return (
      <section style={{ display: "grid", gap: "1rem", maxWidth: 1200 }}>
        <h1 style={{ marginBottom: "0.5rem" }}>Player combat screen</h1>
        <div style={panelStyle}>Sign in to open the player combat screen.</div>
      </section>
    );
  }

  if (error) {
    return (
      <section style={{ display: "grid", gap: "1rem", maxWidth: 1200 }}>
        <h1 style={{ marginBottom: "0.5rem" }}>Player combat screen</h1>
        <div style={panelStyle}>{error}</div>
      </section>
    );
  }

  if (!projection) {
    return (
      <section style={{ display: "grid", gap: "1rem", maxWidth: 1200 }}>
        <h1 style={{ marginBottom: "0.5rem" }}>Player combat screen</h1>
        <div style={panelStyle}>Scenario combat projection unavailable.</div>
      </section>
    );
  }

  const hasMountedLoadout =
    Boolean(controlledBuild) &&
    Boolean(controlledEquipmentState) &&
    Boolean(displayedParticipant?.characterId);

  return (
    <section style={{ display: "grid", gap: "1rem", maxWidth: 1200 }}>
      <RememberedCampaignWorkspaceEffect
        campaignId={campaignId}
        encounterId={encounterId}
        scenarioId={scenarioId}
        tab={workspaceTab}
      />
      <div style={{ display: "grid", gap: "0.5rem" }}>
        {!embedded ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
            <Link
              href={buildCampaignWorkspaceHref({
                campaignId,
                scenarioId,
                tab: "scenario",
              })}
            >
              Back to scenario workspace
            </Link>
          </div>
        ) : null}
        {showWorkspaceHeader ? (
          <h1 style={{ margin: 0 }}>
            Combat
            {displayedParticipant?.displayName ? ` — ${displayedParticipant.displayName}` : ""}
          </h1>
        ) : null}
        {encounterTitle ? <div>Encounter: {encounterTitle}</div> : null}
        {showParticipantSelector ? (
          <label style={{ display: "grid", gap: "0.25rem", maxWidth: 360 }}>
            <span>Character</span>
            <select
              onChange={(event) => setSelectedParticipantId(event.target.value)}
              value={selectedParticipantId}
            >
              {accessibleParticipants.length === 0 ? (
                <option value="">No accessible participant</option>
              ) : null}
              {accessibleParticipants.map((participant) => (
                <option key={participant.id} value={participant.id}>
                  {participant.snapshot.displayName} ({participant.role})
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      {displayedParticipant ? (
        <section style={panelStyle}>
          <div style={playerCombatTopPanelRowStyle}>
            <PlayerCombatActionSelectorPanel
              actionId={selectedActionId}
              additionalActionNotes={additionalActionNotes}
              controlsDisabled={declarationControlsDisabled}
              movementId={selectedMovementId}
              onActionChange={(actionId) => {
                markCombatDeclarationDraftDirty();
                setSelectedActionId(actionId);
              }}
              onAdditionalActionNotesChange={(notes) => {
                markCombatDeclarationDraftDirty();
                setAdditionalActionNotes(notes);
              }}
              onMovementChange={(movementId) => {
                markCombatDeclarationDraftDirty();
                setSelectedMovementId(movementId);
              }}
              onSecondaryActionChange={(actionId) => {
                markCombatDeclarationDraftDirty();
                setSelectedSecondaryActionId(actionId);
              }}
              roundNumber={combatRoundState?.roundNumber}
              secondaryActionId={selectedSecondaryActionId}
            />
            {phaseCards.map((phaseCard, index) => {
              const phaseKey: PlayerCombatPhaseKey = index === 0 ? "phase1" : "phase2";
              const phaseCombatContext = phaseCombatContextDrafts[phaseKey];
              const phaseModel = buildPlayerCombatPhasePanelModel({
                actionId: selectedActionId,
                attackStats: combatLoadoutSummary.attackStats,
                defenseStats: buildPlayerCombatDefenseStats({
                  mainHandParryItemLabel: combatLoadoutSummary.mainHandParryItemLabel,
                  offHandParryItemLabel: combatLoadoutSummary.offHandParryItemLabel,
                  phaseContext: phaseCombatContext,
                  reference: combatLoadoutSummary.reference,
                }),
                phaseCard,
                phaseContext: phaseCombatContext,
                phaseKey,
                secondaryActionId: selectedSecondaryActionId,
              });

              return (
                <PlayerCombatPhasePanel key={phaseModel.phaseCard.phaseLabel} phaseCard={phaseCard}>
                  {phaseModel.showAttackStats && phaseModel.attackStats ? (
                    <PlayerCombatAttackStatsTable stats={phaseModel.attackStats} />
                  ) : null}
                  {phaseModel.showDefenseContext && phaseModel.defenseStats ? (
                    <>
                      <PlayerCombatDefenseStatsTable stats={phaseModel.defenseStats} />
                      <PlayerCombatParryContextPanel
                        combatContext={phaseModel.phaseContext}
                        controlsDisabled={declarationControlsDisabled}
                        mainHandItemLabel={combatLoadoutSummary.mainHandParryItemLabel}
                        offHandItemLabel={combatLoadoutSummary.offHandParryItemLabel}
                        onCombatContextChange={(combatContext) => {
                          markCombatDeclarationDraftDirty();
                          setPhaseCombatContextDrafts((current) => ({
                            ...current,
                            [phaseKey]: combatContext,
                          }));
                        }}
                      />
                    </>
                  ) : null}
                </PlayerCombatPhasePanel>
              );
            })}
          </div>

          <div style={playerCombatPanelRowStyle}>
            <PlayerCombatModifierPanel
              controlsDisabled={declarationControlsDisabled}
              onAddEntry={
                isGameMaster
                  ? (bucketKey) =>
                      updateModifierBucket(bucketKey, (current) => [
                        ...current,
                        createModifierEntryDraft(),
                      ])
                  : undefined
              }
              onRemoveEntry={
                isGameMaster
                  ? (bucketKey, entryId) =>
                      updateModifierBucket(bucketKey, (current) =>
                        current.filter((currentEntry) => currentEntry.id !== entryId),
                      )
                  : undefined
              }
              onUpdateEntry={
                isGameMaster
                  ? (bucketKey, entryId, patch) =>
                      updateModifierBucket(bucketKey, (current) =>
                        current.map((currentEntry) =>
                          currentEntry.id === entryId
                            ? {
                                ...currentEntry,
                                ...patch,
                              }
                            : currentEntry,
                        ),
                      )
                  : undefined
              }
              readOnly={!isGameMaster}
              rows={modifierRows}
            />
            <PlayerCombatActionButtonPanel
              buttonLabel={declarationButtonLabel}
              disabled={declareActionDisabled}
              onDeclareAction={() =>
                void (currentInitiativePhase ? rollInitiative() : saveCombatContext())
              }
              saving={savingCombatContext}
              statusText={declarationStatusText}
            />
            <PlayerCombatActionResultPanel
              additionalActionNotes={additionalActionNotes}
              result={
                selectedCurrentInitiative
                  ? {
                      interpretedResult: formatCombatInitiativeFormula(selectedCurrentInitiative),
                      phaseLabel: formatCombatInitiativeRoll(selectedCurrentInitiative),
                      rankLabel: selectedCurrentInitiativeRankLabel,
                      value: selectedCurrentInitiative.total,
                    }
                  : actionRollResult
              }
            />
          </div>
        </section>
      ) : (
        <div style={panelStyle}>
          This account does not currently have an accessible participant to act for in this
          scenario.
        </div>
      )}

      <section style={{ display: "grid", gap: "1rem" }}>
        {displayedParticipant ? (
          hasMountedLoadout ? (
            <EquipmentLoadoutModule mode="readonly" model={loadoutModel} />
          ) : (
            <div style={panelStyle}>
              Character loadout snapshot is not available for this participant yet.
            </div>
          )
        ) : (
          <div style={panelStyle}>No accessible participant is available.</div>
        )}
      </section>
    </section>
  );
}
