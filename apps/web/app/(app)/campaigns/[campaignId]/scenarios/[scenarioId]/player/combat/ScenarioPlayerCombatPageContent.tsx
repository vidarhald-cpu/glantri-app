"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  characterBuildSchema,
  type ScenarioCombatModifierBucket,
  type ScenarioCombatModifierEntry,
  type ScenarioParticipantCombatContext,
  type ScenarioParticipantIncomingAttackSide,
  type ScenarioParticipantParrySource,
  type ScenarioParticipant,
  type ScenarioPlayerProjection,
} from "@glantri/domain";

import {
  buildEquipmentLoadoutModuleModel,
  EquipmentLoadoutModule,
} from "@/features/equipment/loadoutModule";
import {
  buildPlayerCombatModifierRows,
  PlayerCombatModifierPanel,
  PlayerCombatPhasePanel,
  playerCombatPanelsGridStyle,
} from "@/features/player-combat/PlayerCombatPanels";
import type { EquipmentFeatureState } from "@/features/equipment/types";
import { useSessionUser } from "@/lib/auth/SessionUserContext";
import type { CombatAllocationState } from "@glantri/rules-engine";
import {
  buildPlayerEncounterPhaseSummary,
  createEmptyPlayerEncounterCombatContext,
  evaluatePlayerEncounterParryLegality,
  getPlayerEncounterAccessibleParticipants,
  getPlayerEncounterCombatModifierTotals,
  getPlayerEncounterMovementLabel,
  getPlayerEncounterParrySourceLabel,
  isPlayerEncounterActionId,
  PLAYER_ENCOUNTER_INCOMING_ATTACK_SIDE_OPTIONS,
  PLAYER_ENCOUNTER_ACTION_OPTIONS,
  PLAYER_ENCOUNTER_MOVEMENT_OPTIONS,
  PLAYER_ENCOUNTER_PARRY_SOURCE_OPTIONS,
  type PlayerEncounterActionId,
  type PlayerEncounterMovementId,
} from "@/lib/campaigns/playerEncounter";
import { loadCanonicalContent } from "@/lib/content/loadCanonicalContent";
import {
  loadCharacterEquipmentState,
  loadScenarioMyParticipant,
  loadScenarioParticipants,
  loadScenarioPlayerProjection,
  loadServerCharacterById,
  updateScenarioParticipantStateOnServer,
  type ServerCharacterRecord,
} from "@/lib/api/localServiceClient";
import {
  buildRememberedScopedSelectionKey,
  REMEMBERED_SELECTION_KEYS,
  useRememberedSelection,
} from "@/lib/browser/rememberedSelection";
import RememberedCampaignWorkspaceEffect from "@/lib/campaigns/RememberedCampaignWorkspaceEffect";
import { buildCampaignWorkspaceHref, type CampaignWorkspaceTabId } from "@/lib/campaigns/workspace";

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

function isEquipmentFeatureState(value: unknown): value is EquipmentFeatureState {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.itemsById === "object" &&
    candidate.itemsById !== null &&
    typeof candidate.locationsById === "object" &&
    candidate.locationsById !== null &&
    typeof candidate.activeLoadoutByCharacterId === "object" &&
    candidate.activeLoadoutByCharacterId !== null &&
    typeof candidate.templates === "object" &&
    candidate.templates !== null &&
    "templatesById" in (candidate.templates as Record<string, unknown>)
  );
}

function getCombatTableColumnIndex(input: { columns: string[]; label: string }): number {
  return input.columns.indexOf(input.label);
}

function getCombatTableCell(input: {
  columns: string[];
  label: string;
  row: Array<string | number>;
}): string {
  const index = getCombatTableColumnIndex({
    columns: input.columns,
    label: input.label,
  });

  if (index < 0) {
    return "—";
  }

  const value = input.row[index];
  return value == null ? "—" : String(value);
}

function getRelevantLoadoutFieldId(
  actionId: PlayerEncounterActionId | "",
): "missile" | "primary" | "secondary" | "throwing" | null {
  switch (actionId) {
    case "attack_parry":
    case "parry_attack":
    case "double_attack":
    case "feint_attack":
    case "adjust_range_attack":
    case "counterattack":
    case "offensive_parry":
    case "parry_disarm":
    case "disarm":
      return "primary";
    case "observe_opponent":
    case "break_off_engagement":
    case "other":
      return "primary";
    default:
      return null;
  }
}

function hasDisplayValue(value: string): boolean {
  return value.length > 0 && value !== "—";
}

function createModifierEntryDraft(): ScenarioCombatModifierEntry {
  return {
    id: `modifier-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    notes: "",
    scope: "until",
    value: 0,
  };
}

function rollDie(sides: number): number {
  return Math.floor(Math.random() * sides) + 1;
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

    async function refreshCombatView() {
      setLoading(true);

      try {
        const [nextProjection, nextContent, nextParticipants] = await Promise.all([
          loadScenarioPlayerProjection(scenarioId),
          loadCanonicalContent(),
          isGameMaster
            ? loadScenarioParticipants(scenarioId)
            : loadScenarioMyParticipant(scenarioId).then((p) => (p ? [p] : [])),
        ]);

        if (cancelled) {
          return;
        }

        setProjection(nextProjection);
        setContent(nextContent);
        setSelectableParticipants(nextParticipants);
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

    void refreshCombatView();

    return () => {
      cancelled = true;
    };
  }, [currentUser, isGameMaster, scenarioId, sessionLoading]);

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
    const preferredId =
      accessibleParticipants.find((participant) => participant.id === explicitParticipantId)?.id ??
      accessibleParticipants.find((participant) => participant.id === rememberedParticipantId)
        ?.id ??
      accessibleParticipants.find((participant) => participant.id === projectionControlledId)?.id ??
      accessibleParticipants[0]?.id;

    setSelectedParticipantId((current) =>
      accessibleParticipants.some((participant) => participant.id === current)
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

  const visibleOpponentOptions: { displayName: string; id: string }[] = useMemo(() => {
    if (isGameMaster) {
      return selectableParticipants
        .filter((p) => p.isActive && p.id !== selectedParticipantId)
        .map((p) => ({ displayName: p.snapshot.displayName, id: p.id }));
    }
    return (projection?.visibleParticipants ?? [])
      .filter((p) => p.isActive && !p.isControlledByPlayer && p.id !== selectedParticipantId)
      .map((p) => ({ displayName: p.displayName, id: p.id }));
  }, [
    isGameMaster,
    projection?.visibleParticipants,
    selectableParticipants,
    selectedParticipantId,
  ]);

  useEffect(() => {
    setSelectedActionId(
      isPlayerEncounterActionId(selectedParticipant?.state.combat.lastDeclaredActionId)
        ? selectedParticipant.state.combat.lastDeclaredActionId
        : "",
    );
    setSelectedSecondaryActionId("");
    setSelectedMovementId("hold");
    setAdditionalActionNotes("");
    setCombatContextDraft(
      selectedParticipant?.state.combat.combatContext ?? createEmptyPlayerEncounterCombatContext(),
    );
  }, [selectedParticipant]);

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

  const modifierTotals = useMemo(
    () => getPlayerEncounterCombatModifierTotals(combatContextDraft),
    [combatContextDraft],
  );
  const modifierRows = useMemo(
    () => buildPlayerCombatModifierRows({ combatContext: combatContextDraft }),
    [combatContextDraft],
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
        hasSelectedOpponent: Boolean(combatContextDraft.selectedOpponentId),
        incomingAttackSide: combatContextDraft.incomingAttackSide,
        parrySource: combatContextDraft.parrySource,
      }),
    [
      combatContextDraft.incomingAttackSide,
      combatContextDraft.selectedOpponentId,
      combatContextDraft.parrySource,
      loadoutFieldValueMap,
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
        attack: modifierTotals.attackTotal,
        defense: modifierTotals.defenseTotal,
        movement: 0,
        perception: 0,
      },
    }),
    [modifierTotals.attackTotal, modifierTotals.defenseTotal, parryLegality, selectedActionId],
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
        state: controlledEquipmentState,
        throwingWeaponItemId: null,
      }),
    [
      combatAllocationInputs,
      content,
      controlledBuild,
      controlledEquipmentState,
      displayedParticipant,
    ],
  );

  const phaseSummary = useMemo(
    () =>
      buildPlayerEncounterPhaseSummary({
        actionId: selectedActionId,
        secondaryActionId: selectedSecondaryActionId,
      }),
    [selectedActionId, selectedSecondaryActionId],
  );

  function updateModifierBucket(
    bucket: ScenarioCombatModifierBucket,
    updater: (entries: ScenarioCombatModifierEntry[]) => ScenarioCombatModifierEntry[],
  ) {
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
      const participant = await updateScenarioParticipantStateOnServer({
        participantId: selectedParticipant.id,
        scenarioId,
        state: {
          ...selectedParticipant.state,
          combat: {
            ...selectedParticipant.state.combat,
            combatContext: combatContextDraft,
            lastDeclaredActionId: selectedActionId || undefined,
          },
        },
      });

      setSelectableParticipants((current) =>
        current.map((entry) => (entry.id === participant.id ? participant : entry)),
      );
      setError(undefined);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : "Unable to save combat context.",
      );
    } finally {
      setSavingCombatContext(false);
    }
  }

  const combatPanelModel = loadoutModel.combatStatePanelModel;
  const loadoutFieldDisplayMap = useMemo(
    () => new Map(loadoutModel.fields.map((field) => [field.id, field])),
    [loadoutModel.fields],
  );

  const selectedCombatReference = useMemo(() => {
    if (!combatPanelModel) {
      return null;
    }

    const preferredFieldIds = [
      getRelevantLoadoutFieldId(selectedActionId),
      getRelevantLoadoutFieldId(selectedSecondaryActionId),
    ].filter((value): value is "missile" | "primary" | "secondary" | "throwing" => value !== null);

    const preferredWeaponLabels = preferredFieldIds
      .map((fieldId) => loadoutFieldDisplayMap.get(fieldId)?.valueLabel)
      .filter((value): value is string => Boolean(value) && value !== "None");

    const referenceRow =
      preferredWeaponLabels
        .map(
          (weaponLabel) =>
            combatPanelModel.weaponModeTable.rows.find(
              (row) =>
                getCombatTableCell({
                  columns: combatPanelModel.weaponModeTable.columns,
                  label: "Weapon",
                  row,
                }) === weaponLabel,
            ) ?? null,
        )
        .find((row) => row !== null) ??
      combatPanelModel.weaponModeTable.rows[0] ??
      null;

    const movementSummary =
      combatPanelModel.capabilityRows.find((row) => row.label === "Mov/mod")?.value ?? "—";
    const encumbranceSummary =
      combatPanelModel.capabilityRows.find((row) => row.label === "Enc/count/lvl")?.value ?? "—";
    const combinedRow =
      combatPanelModel.weaponModeTable.rows.find(
        (row) =>
          getCombatTableCell({
            columns: combatPanelModel.weaponModeTable.columns,
            label: "Mode",
            row,
          }) === "Combined",
      ) ?? null;

    if (!referenceRow) {
      return {
        am: "—",
        attackMode: "—",
        db: "—",
        combinedDb: "—",
        combinedDm: "—",
        crit: "—",
        dmb: "—",
        dm: "—",
        encumbrance: String(encumbranceSummary),
        initiative: "—",
        movement: String(movementSummary),
        ob: "—",
        parry: "—",
        secondCrit: "—",
        selectedWeapon: "No ready weapon",
      };
    }

    return {
      am: getCombatTableCell({
        columns: combatPanelModel.weaponModeTable.columns,
        label: "AM",
        row: referenceRow,
      }),
      attackMode: getCombatTableCell({
        columns: combatPanelModel.weaponModeTable.columns,
        label: "Attack 1",
        row: referenceRow,
      }),
      db: getCombatTableCell({
        columns: combatPanelModel.weaponModeTable.columns,
        label: "DB",
        row: referenceRow,
      }),
      combinedDb: combinedRow
        ? getCombatTableCell({
            columns: combatPanelModel.weaponModeTable.columns,
            label: "DB",
            row: combinedRow,
          })
        : "—",
      combinedDm: combinedRow
        ? getCombatTableCell({
            columns: combatPanelModel.weaponModeTable.columns,
            label: "DM",
            row: combinedRow,
          })
        : "—",
      crit: getCombatTableCell({
        columns: combatPanelModel.weaponModeTable.columns,
        label: "Crit 1",
        row: referenceRow,
      }),
      dmb: getCombatTableCell({
        columns: combatPanelModel.weaponModeTable.columns,
        label: "DMB",
        row: referenceRow,
      }),
      dm: getCombatTableCell({
        columns: combatPanelModel.weaponModeTable.columns,
        label: "DM",
        row: referenceRow,
      }),
      encumbrance: String(encumbranceSummary),
      initiative: getCombatTableCell({
        columns: combatPanelModel.weaponModeTable.columns,
        label: "I",
        row: referenceRow,
      }),
      movement: String(movementSummary),
      ob: getCombatTableCell({
        columns: combatPanelModel.weaponModeTable.columns,
        label: "OB",
        row: referenceRow,
      }),
      parry: getCombatTableCell({
        columns: combatPanelModel.weaponModeTable.columns,
        label: "Parry",
        row: referenceRow,
      }),
      secondCrit: getCombatTableCell({
        columns: combatPanelModel.weaponModeTable.columns,
        label: "Sec",
        row: referenceRow,
      }),
      selectedWeapon: getCombatTableCell({
        columns: combatPanelModel.weaponModeTable.columns,
        label: "Weapon",
        row: referenceRow,
      }),
    };
  }, [combatPanelModel, loadoutFieldDisplayMap, selectedActionId, selectedSecondaryActionId]);

  const currentPhaseNumber = projection?.scenario.phase === 2 ? 2 : 1;
  const phaseCards = useMemo(() => {
    if (selectedActionId === "attack_parry" && selectedCombatReference) {
      const phaseTwoDb = hasDisplayValue(selectedCombatReference.combinedDb)
        ? selectedCombatReference.combinedDb
        : selectedCombatReference.db;
      const phaseTwoDm = hasDisplayValue(selectedCombatReference.combinedDm)
        ? selectedCombatReference.combinedDm
        : selectedCombatReference.dm;
      const combinedDefenseNote =
        hasDisplayValue(selectedCombatReference.combinedDb) &&
        selectedCombatReference.combinedDb !== selectedCombatReference.db
          ? `Base DB ${selectedCombatReference.db}, Combined DB ${selectedCombatReference.combinedDb}`
          : null;

      return [
        {
          description: selectedCombatReference.selectedWeapon,
          phaseLabel: "Phase 1",
          stats: [
            `I: ${selectedCombatReference.initiative}`,
            `OB: ${selectedCombatReference.ob}`,
            `DMB: ${selectedCombatReference.dmb}`,
            `AM: ${selectedCombatReference.am}`,
            `Max Crits: ${selectedCombatReference.crit}${
              hasDisplayValue(selectedCombatReference.secondCrit)
                ? ` / ${selectedCombatReference.secondCrit}`
                : ""
            }`,
          ],
          title: "Attack",
        },
        {
          description:
            parryLegality.status === "legal"
              ? `${selectedCombatReference.selectedWeapon} defence via ${getPlayerEncounterParrySourceLabel(
                  parryLegality.resolvedParrySource ?? "auto",
                )}`
              : `Parry status: ${parryLegality.reason}`,
          phaseLabel: "Phase 2",
          stats: [
            `DB: ${phaseTwoDb}`,
            `DM: ${phaseTwoDm}`,
            `P: ${
              parryLegality.status === "legal"
                ? selectedCombatReference.parry
                : parryLegality.status === "incomplete"
                  ? "Incomplete context"
                  : "Not legal"
            }`,
            ...(combinedDefenseNote ? [combinedDefenseNote] : []),
          ],
          title: "Parry",
        },
      ] as const;
    }

    return [
      {
        description:
          selectedActionId || selectedSecondaryActionId
            ? `${phaseSummary.phaseOne} · ${getPlayerEncounterMovementLabel(selectedMovementId)}`
            : "No action selected yet.",
        phaseLabel: "Phase 1",
        stats:
          selectedActionId && selectedCombatReference
            ? [
                `Weapon: ${selectedCombatReference.selectedWeapon}`,
                `Attack: ${selectedCombatReference.attackMode}`,
                `OB: ${selectedCombatReference.ob}`,
                `DB: ${selectedCombatReference.db}`,
              ]
            : [],
        title: phaseSummary.phaseOne,
      },
      {
        description: selectedSecondaryActionId
          ? `${phaseSummary.phaseTwo} · ${getPlayerEncounterMovementLabel(selectedMovementId)}`
          : "Open",
        phaseLabel: "Phase 2",
        stats:
          selectedSecondaryActionId && selectedCombatReference
            ? [
                `Weapon: ${selectedCombatReference.selectedWeapon}`,
                `Parry: ${selectedCombatReference.parry}`,
                `Movement: ${selectedCombatReference.movement}`,
                `Enc: ${selectedCombatReference.encumbrance}`,
              ]
            : [],
        title: phaseSummary.phaseTwo,
      },
    ] as const;
  }, [
    phaseSummary.phaseOne,
    phaseSummary.phaseTwo,
    parryLegality,
    selectedActionId,
    selectedCombatReference,
    selectedMovementId,
    selectedSecondaryActionId,
  ]);

  const activeActionButton = useMemo(() => {
    if (!displayedParticipant || !selectedActionId) {
      return {
        enabled: false,
        label: "Action",
        phaseLabel: undefined,
      };
    }

    return {
      enabled: true,
      label: "Initiative",
      phaseLabel: `Phase ${currentPhaseNumber}`,
    };
  }, [currentPhaseNumber, displayedParticipant, selectedActionId]);

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

      <section
        style={{
          ...panelStyle,
          alignItems: "start",
          gridTemplateColumns: "minmax(240px, 0.7fr) minmax(420px, 1.3fr)",
        }}
      >
        <div style={{ display: "grid", gap: "0.9rem" }}>
          <h2 style={{ margin: 0 }}>Action selector</h2>
          {displayedParticipant ? (
            <>
              <label style={{ display: "grid", gap: "0.25rem" }}>
                <span>Action</span>
                <select
                  disabled={controlsDisabled}
                  onChange={(event) =>
                    setSelectedActionId(event.target.value as PlayerEncounterActionId | "")
                  }
                  value={selectedActionId}
                >
                  <option value="">Choose action</option>
                  {PLAYER_ENCOUNTER_ACTION_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label style={{ display: "grid", gap: "0.25rem" }}>
                <span>Secondary action</span>
                <select
                  disabled={controlsDisabled}
                  onChange={(event) =>
                    setSelectedSecondaryActionId(event.target.value as PlayerEncounterActionId | "")
                  }
                  value={selectedSecondaryActionId}
                >
                  <option value="">Open</option>
                  {PLAYER_ENCOUNTER_ACTION_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label style={{ display: "grid", gap: "0.25rem" }}>
                <span>Movement</span>
                <select
                  disabled={controlsDisabled}
                  onChange={(event) =>
                    setSelectedMovementId(event.target.value as PlayerEncounterMovementId | "")
                  }
                  value={selectedMovementId}
                >
                  {PLAYER_ENCOUNTER_MOVEMENT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label style={{ display: "grid", gap: "0.25rem" }}>
                <span>Additional</span>
                <input
                  disabled={controlsDisabled}
                  onChange={(event) => setAdditionalActionNotes(event.target.value)}
                  placeholder="Free text for intent, target, or table notes"
                  type="text"
                  value={additionalActionNotes}
                />
              </label>

              <PlayerCombatModifierPanel
                controlsDisabled={controlsDisabled}
                onAddEntry={(bucketKey) =>
                  updateModifierBucket(bucketKey, (current) => [
                    ...current,
                    createModifierEntryDraft(),
                  ])
                }
                onRemoveEntry={(bucketKey, entryId) =>
                  updateModifierBucket(bucketKey, (current) =>
                    current.filter((currentEntry) => currentEntry.id !== entryId),
                  )
                }
                onUpdateEntry={(bucketKey, entryId, patch) =>
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
                }
                rows={modifierRows}
              />

              {selectedActionId === "attack_parry" ? (
                <section
                  style={{
                    background: "#fffdf8",
                    border: "1px solid #d9ddd8",
                    borderRadius: 10,
                    display: "grid",
                    gap: "0.6rem",
                    padding: "0.75rem",
                  }}
                >
                  <strong>Parry context</strong>
                  <label style={{ display: "grid", gap: "0.25rem" }}>
                    <span>Incoming attack side</span>
                    <select
                      disabled={controlsDisabled}
                      onChange={(event) =>
                        setCombatContextDraft((current) => ({
                          ...current,
                          incomingAttackSide:
                            (event.target.value as ScenarioParticipantIncomingAttackSide) ||
                            undefined,
                        }))
                      }
                      value={combatContextDraft.incomingAttackSide ?? ""}
                    >
                      <option value="">Choose side</option>
                      {PLAYER_ENCOUNTER_INCOMING_ATTACK_SIDE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label style={{ display: "grid", gap: "0.25rem" }}>
                    <span>Parry source</span>
                    <select
                      disabled={controlsDisabled}
                      onChange={(event) =>
                        setCombatContextDraft((current) => ({
                          ...current,
                          parrySource:
                            (event.target.value as ScenarioParticipantParrySource) || undefined,
                        }))
                      }
                      value={combatContextDraft.parrySource ?? ""}
                    >
                      <option value="">Choose source</option>
                      {PLAYER_ENCOUNTER_PARRY_SOURCE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div style={{ color: "#5e5a50", fontSize: "0.92rem" }}>
                    Parry status:{" "}
                    {parryLegality.status === "legal"
                      ? `Legal (${getPlayerEncounterParrySourceLabel(
                          parryLegality.resolvedParrySource ?? "auto",
                        )})`
                      : parryLegality.status === "not_legal"
                        ? `Not legal — ${parryLegality.reason}`
                        : `Incomplete context (${parryLegality.reason})`}
                  </div>
                </section>
              ) : null}

              <div style={{ display: "flex", gap: "0.5rem", justifyContent: "space-between" }}>
                <div style={{ color: "#5e5a50", fontSize: "0.9rem" }}>
                  Saved on the selected participant combat state.
                </div>
                <button
                  disabled={controlsDisabled || savingCombatContext}
                  onClick={() => void saveCombatContext()}
                  type="button"
                >
                  {savingCombatContext ? "Saving..." : "Save combat context"}
                </button>
              </div>
            </>
          ) : (
            <div style={{ color: "#5e5a50" }}>
              This account does not currently have an accessible participant to act for in this
              scenario.
            </div>
          )}
        </div>

        <div style={{ display: "grid", gap: "0.9rem" }}>
          <div style={playerCombatPanelsGridStyle}>
            {phaseCards.map((phaseCard) => (
              <PlayerCombatPhasePanel key={phaseCard.phaseLabel} phaseCard={phaseCard}>
                {selectedActionId === "attack_parry" &&
                phaseCard.phaseLabel === "Phase 1" &&
                selectedCombatReference ? (
                  <label style={{ display: "grid", gap: "0.25rem" }}>
                    <span>Opponent</span>
                    <select
                      disabled={controlsDisabled}
                      onChange={(event) =>
                        setCombatContextDraft((current) => ({
                          ...current,
                          selectedOpponentId: event.target.value || undefined,
                        }))
                      }
                      value={combatContextDraft.selectedOpponentId ?? ""}
                    >
                      <option value="">Choose opponent</option>
                      {visibleOpponentOptions.map((participant) => (
                        <option key={participant.id} value={participant.id}>
                          {participant.displayName}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
              </PlayerCombatPhasePanel>
            ))}
          </div>

          <section
            style={{
              background: "#fffdf8",
              border: "1px solid #d9ddd8",
              borderRadius: 10,
              display: "grid",
              gap: "0.75rem",
              gridTemplateColumns: "minmax(180px, 0.65fr) minmax(260px, 1.35fr)",
              padding: "0.85rem",
            }}
          >
            <div>
              <button
                disabled={controlsDisabled || !activeActionButton.enabled}
                onClick={() =>
                  setActionRollResult({
                    interpretedResult: selectedCombatReference
                      ? `${phaseSummary.phaseOne} with ${selectedCombatReference.selectedWeapon}`
                      : phaseSummary.phaseOne,
                    phaseLabel: activeActionButton.phaseLabel,
                    value: rollDie(10),
                  })
                }
                style={{
                  background: activeActionButton.enabled ? "#ded4b1" : "#e4e0d6",
                  border: "1px solid #bdb39a",
                  borderRadius: 10,
                  color: activeActionButton.enabled ? "#2f2415" : "#8a8477",
                  cursor: activeActionButton.enabled ? "pointer" : "not-allowed",
                  display: "grid",
                  gap: "0.15rem",
                  minHeight: 88,
                  padding: "0.75rem 0.9rem",
                  textAlign: "left",
                  width: "100%",
                }}
                type="button"
              >
                <strong>{activeActionButton.label}</strong>
                {activeActionButton.phaseLabel ? (
                  <span style={{ fontSize: "0.9rem" }}>{activeActionButton.phaseLabel}</span>
                ) : null}
              </button>
            </div>

            <div style={{ display: "grid", gap: "0.45rem" }}>
              <strong>Roll result</strong>
              <div
                style={{
                  display: "grid",
                  gap: "0.35rem",
                  gridTemplateColumns: "minmax(100px, 0.35fr) minmax(180px, 1fr)",
                }}
              >
                <div
                  style={{
                    alignItems: "center",
                    background: "#f6f5ef",
                    border: "1px solid #d9ddd8",
                    borderRadius: 8,
                    display: "flex",
                    fontSize: "1.3rem",
                    fontWeight: 700,
                    justifyContent: "center",
                    minHeight: 72,
                  }}
                >
                  {actionRollResult?.value ?? "—"}
                </div>
                <div
                  style={{
                    background: "#f6f5ef",
                    border: "1px solid #d9ddd8",
                    borderRadius: 8,
                    display: "grid",
                    gap: "0.25rem",
                    minHeight: 72,
                    padding: "0.65rem 0.75rem",
                  }}
                >
                  <div>{actionRollResult?.phaseLabel ?? "No active phase yet."}</div>
                  <div style={{ color: "#5e5a50" }}>
                    {actionRollResult?.interpretedResult ??
                      "Select an action to activate the button and roll a result."}
                  </div>
                </div>
              </div>
              <div style={{ color: "#5e5a50", fontSize: "0.95rem" }}>
                Movement: {getPlayerEncounterMovementLabel(selectedMovementId)}
                {additionalActionNotes.trim().length > 0
                  ? ` · ${additionalActionNotes.trim()}`
                  : ""}
              </div>
            </div>
          </section>
        </div>
      </section>

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
