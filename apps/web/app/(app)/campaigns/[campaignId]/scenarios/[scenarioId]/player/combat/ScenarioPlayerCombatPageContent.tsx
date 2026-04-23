"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  characterBuildSchema,
  type ScenarioParticipant,
  type ScenarioPlayerProjection,
} from "@glantri/domain";

import {
  buildEquipmentLoadoutModuleModel,
  EquipmentLoadoutModule,
} from "../../../../../../../../src/features/equipment/loadoutModule";
import type { EquipmentFeatureState } from "../../../../../../../../src/features/equipment/types";
import { useSessionUser } from "../../../../../../../../src/lib/auth/SessionUserContext";
import {
  buildPlayerEncounterPhaseSummary,
  getPlayerEncounterMovementLabel,
  PLAYER_ENCOUNTER_ACTION_OPTIONS,
  PLAYER_ENCOUNTER_MOVEMENT_OPTIONS,
  type PlayerEncounterActionId,
  type PlayerEncounterMovementId,
} from "../../../../../../../../src/lib/campaigns/playerEncounter";
import { loadCanonicalContent } from "../../../../../../../../src/lib/content/loadCanonicalContent";
import {
  loadCharacterEquipmentState,
  loadScenarioParticipants,
  loadScenarioPlayerProjection,
  loadServerCharacterById,
  type ServerCharacterRecord,
} from "../../../../../../../../src/lib/api/localServiceClient";

interface ScenarioPlayerCombatPageContentProps {
  campaignId: string;
  embedded?: boolean;
  encounterTitle?: string;
  scenarioId: string;
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

function getCombatTableColumnIndex(input: {
  columns: string[];
  label: string;
}): number {
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
):
  | "missile"
  | "primary"
  | "secondary"
  | "throwing"
  | null {
  switch (actionId) {
    case "missile":
      return "missile";
    case "throw":
      return "throwing";
    case "attack":
    case "parry":
      return "primary";
    default:
      return null;
  }
}

function rollDie(sides: number): number {
  return Math.floor(Math.random() * sides) + 1;
}

function PlaceholderSection(input: {
  description: string;
  title: string;
}) {
  return (
    <section style={panelStyle}>
      <h2 style={{ margin: 0 }}>{input.title}</h2>
      <div style={{ color: "#5e5a50" }}>{input.description}</div>
    </section>
  );
}

export default function ScenarioPlayerCombatPageContent({
  campaignId,
  embedded = false,
  encounterTitle,
  scenarioId,
}: ScenarioPlayerCombatPageContentProps) {
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
  const [actionRollResult, setActionRollResult] = useState<{
    interpretedResult: string;
    phaseLabel?: string;
    value: number;
  } | null>(null);
  const isGameMaster = Boolean(
    currentUser?.roles.includes("game_master") || currentUser?.roles.includes("admin")
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
          loadScenarioParticipants(scenarioId),
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
            : "Unable to load the player combat screen."
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

    return selectableParticipants.filter((participant) => {
      if (!participant.isActive) {
        return false;
      }

      if (isGameMaster) {
        return true;
      }

      return participant.controlledByUserId === currentUser?.id;
    });
  }, [currentUser?.id, isGameMaster, projection, selectableParticipants]);

  useEffect(() => {
    if (accessibleParticipants.length === 0) {
      setSelectedParticipantId("");
      return;
    }

    const projectionControlledId = projection?.controlledParticipantId;
    const preferredId =
      accessibleParticipants.find((participant) => participant.id === projectionControlledId)?.id ??
      accessibleParticipants[0]?.id;

    setSelectedParticipantId((current) =>
      accessibleParticipants.some((participant) => participant.id === current)
        ? current
        : (preferredId ?? "")
    );
  }, [accessibleParticipants, projection]);

  useEffect(() => {
    setActionRollResult(null);
  }, [selectedParticipantId]);

  const selectedParticipant = useMemo(
    () =>
      accessibleParticipants.find((participant) => participant.id === selectedParticipantId) ??
      null,
    [accessibleParticipants, selectedParticipantId]
  );

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
        state: controlledEquipmentState,
        throwingWeaponItemId: null,
      }),
    [content, controlledBuild, controlledEquipmentState, displayedParticipant]
  );

  const phaseSummary = useMemo(
    () =>
      buildPlayerEncounterPhaseSummary({
        actionId: selectedActionId,
        secondaryActionId: selectedSecondaryActionId,
      }),
    [selectedActionId, selectedSecondaryActionId],
  );

  const combatPanelModel = loadoutModel.combatStatePanelModel;
  const loadoutFieldMap = useMemo(
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
      .map((fieldId) => loadoutFieldMap.get(fieldId)?.valueLabel)
      .filter((value): value is string => Boolean(value) && value !== "None");

    const referenceRow =
      preferredWeaponLabels
        .map((weaponLabel) =>
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

    if (!referenceRow) {
      return {
        attackMode: "—",
        db: "—",
        encumbrance: String(encumbranceSummary),
        initiative: "—",
        movement: String(movementSummary),
        ob: "—",
        parry: "—",
        selectedWeapon: "No ready weapon",
      };
    }

    return {
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
      selectedWeapon: getCombatTableCell({
        columns: combatPanelModel.weaponModeTable.columns,
        label: "Weapon",
        row: referenceRow,
      }),
    };
  }, [
    combatPanelModel,
    loadoutFieldMap,
    selectedActionId,
    selectedSecondaryActionId,
  ]);

  const currentPhaseNumber = projection?.scenario.phase === 2 ? 2 : 1;
  const phaseCards = [
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
      description:
        selectedSecondaryActionId
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
      <div style={{ display: "grid", gap: "0.5rem" }}>
        {!embedded ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
            <Link href={`/campaigns/${campaignId}/scenarios/${scenarioId}/player`}>
              Back to scenario view
            </Link>
          </div>
        ) : null}
        <h1 style={{ margin: 0 }}>{projection.scenario.name} combat</h1>
        {encounterTitle ? <div>Encounter: {encounterTitle}</div> : null}
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
                  onChange={(event) =>
                    setSelectedSecondaryActionId(
                      event.target.value as PlayerEncounterActionId | "",
                    )
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
                  onChange={(event) => setAdditionalActionNotes(event.target.value)}
                  placeholder="Free text for intent, target, or table notes"
                  type="text"
                  value={additionalActionNotes}
                />
              </label>
            </>
          ) : (
            <div style={{ color: "#5e5a50" }}>
              This account does not currently have an accessible participant to act for in this
              scenario.
            </div>
          )}
        </div>

        <div style={{ display: "grid", gap: "0.9rem" }}>
          <div style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: "1fr 1fr" }}>
            {phaseCards.map((phaseCard) => (
              <section
                key={phaseCard.phaseLabel}
                style={{
                  background: "#fffdf8",
                  border: "1px solid #d9ddd8",
                  borderRadius: 10,
                  display: "grid",
                  gap: "0.5rem",
                  minHeight: 210,
                  padding: "0.85rem",
                }}
              >
                <strong>{phaseCard.phaseLabel}</strong>
                <div style={{ fontSize: "1.05rem", fontWeight: 600 }}>{phaseCard.title}</div>
                <div style={{ color: "#5e5a50" }}>{phaseCard.description}</div>
                {phaseCard.stats.length > 0 ? (
                  <div style={{ display: "grid", gap: "0.25rem", fontSize: "0.95rem" }}>
                    {phaseCard.stats.map((stat) => (
                      <div key={stat}>{stat}</div>
                    ))}
                  </div>
                ) : null}
              </section>
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
                disabled={!activeActionButton.enabled}
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
          <div style={panelStyle}>
            The readonly combat/loadout panel will appear here once an accessible participant is
            available.
          </div>
        )}
      </section>

      <section
        style={{
          display: "grid",
          gap: "1rem",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
        }}
      >
        <PlaceholderSection
          title="Situation"
          description="Current scene context, threats, range, and immediate tactical summary will appear here in the next phase."
        />
        <PlaceholderSection
          title="Targets"
          description="Target selection, target visibility, and action-specific combat detail will expand into this area in the next phase."
        />
        <PlaceholderSection
          title="Details"
          description="Targeting, situational modifiers, and fine-grained reference details will expand into this area later."
        />
      </section>
    </section>
  );
}
