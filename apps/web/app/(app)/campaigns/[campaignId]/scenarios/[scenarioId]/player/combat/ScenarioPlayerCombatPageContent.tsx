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
  loadScenarioParticipants,
  loadScenarioPlayerProjection,
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
  const [selectableParticipants, setSelectableParticipants] = useState<ScenarioParticipant[]>([]);
  const [selectedParticipantId, setSelectedParticipantId] = useState<string>("");
  const [selectedActionId, setSelectedActionId] = useState<PlayerEncounterActionId | "">("attack");
  const [selectedSecondaryActionId, setSelectedSecondaryActionId] = useState<
    PlayerEncounterActionId | ""
  >("parry");
  const [selectedMovementId, setSelectedMovementId] = useState<PlayerEncounterMovementId | "">(
    "hold",
  );
  const [additionalActionNotes, setAdditionalActionNotes] = useState("");
  const [rollResults, setRollResults] = useState<{
    attack?: number;
    crit?: number;
    hitLocation?: number;
    initiative?: number;
  }>({});
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
    setRollResults({});
  }, [selectedParticipantId]);

  const selectedParticipant = useMemo(
    () =>
      accessibleParticipants.find((participant) => participant.id === selectedParticipantId) ??
      null,
    [accessibleParticipants, selectedParticipantId]
  );

  const displayedParticipant = useMemo(() => {
    if (!selectedParticipant) {
      return projection?.controlledParticipant;
    }

    return {
      build: selectedParticipant.snapshot.build,
      characterId: selectedParticipant.characterId,
      conditionCount: selectedParticipant.state.conditions.length,
      currentHp: selectedParticipant.state.health.currentHp,
      displayName: selectedParticipant.snapshot.displayName,
      equipmentState: selectedParticipant.snapshot.equipmentState,
      factionId: selectedParticipant.factionId,
      id: selectedParticipant.id,
      maxHp: selectedParticipant.state.health.maxHp,
      role: selectedParticipant.role,
      sourceType: selectedParticipant.sourceType,
    };
  }, [projection, selectedParticipant]);

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
          gridTemplateColumns: "minmax(320px, 0.95fr) minmax(320px, 1.05fr)",
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
          <div style={{ display: "grid", gap: "0.5rem" }}>
            <h2 style={{ margin: 0 }}>Round face</h2>
            <div
              style={{
                display: "grid",
                gap: "0.75rem",
                gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              }}
            >
              <div
                style={{
                  background: "#fffdf8",
                  border: "1px solid #d9ddd8",
                  borderRadius: 10,
                  display: "grid",
                  gap: "0.25rem",
                  padding: "0.75rem",
                }}
              >
                <strong>Phase 1</strong>
                <div>{phaseSummary.phaseOne}</div>
              </div>
              <div
                style={{
                  background: "#fffdf8",
                  border: "1px solid #d9ddd8",
                  borderRadius: 10,
                  display: "grid",
                  gap: "0.25rem",
                  padding: "0.75rem",
                }}
              >
                <strong>Phase 2</strong>
                <div>{phaseSummary.phaseTwo}</div>
              </div>
            </div>
            <div style={{ color: "#5e5a50" }}>
              Movement: {getPlayerEncounterMovementLabel(selectedMovementId)}
            </div>
            {additionalActionNotes.trim().length > 0 ? (
              <div style={{ color: "#5e5a50" }}>Additional: {additionalActionNotes.trim()}</div>
            ) : null}
          </div>

          <div style={{ display: "grid", gap: "0.5rem" }}>
            <h2 style={{ margin: 0 }}>Combat detail</h2>
            {displayedParticipant ? (
              <div
                style={{
                  display: "grid",
                  gap: "0.65rem",
                  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                }}
              >
                <div>Character: {displayedParticipant.displayName}</div>
                <div>Faction: {displayedParticipant.factionId ?? "Unassigned"}</div>
                <div>
                  HP: {displayedParticipant.currentHp}/{displayedParticipant.maxHp}
                </div>
                <div>Conditions: {displayedParticipant.conditionCount}</div>
                <div>
                  Round: {projection.scenario.roundNumber} · {projection.scenario.phase}
                </div>
                <div>Status: {projection.scenario.combatStatus}</div>
                <div>Selected weapon: {selectedCombatReference?.selectedWeapon ?? "—"}</div>
                <div>Attack mode: {selectedCombatReference?.attackMode ?? "—"}</div>
                <div>Initiative: {selectedCombatReference?.initiative ?? "—"}</div>
                <div>OB: {selectedCombatReference?.ob ?? "—"}</div>
                <div>DB: {selectedCombatReference?.db ?? "—"}</div>
                <div>Parry: {selectedCombatReference?.parry ?? "—"}</div>
                <div>Movement: {selectedCombatReference?.movement ?? "—"}</div>
                <div>Encumbrance: {selectedCombatReference?.encumbrance ?? "—"}</div>
              </div>
            ) : (
              <div style={{ color: "#5e5a50" }}>Combat detail will appear once a participant is selected.</div>
            )}
          </div>

          <div style={{ display: "grid", gap: "0.5rem" }}>
            <h2 style={{ margin: 0 }}>Player rolls</h2>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "0.75rem",
              }}
            >
              <button
                onClick={() =>
                  setRollResults((current) => ({ ...current, initiative: rollDie(10) }))
                }
                style={{ cursor: "pointer" }}
                type="button"
              >
                Initiative
              </button>
              <button
                onClick={() => setRollResults((current) => ({ ...current, attack: rollDie(100) }))}
                style={{ cursor: "pointer" }}
                type="button"
              >
                Attack roll
              </button>
              <button
                onClick={() =>
                  setRollResults((current) => ({ ...current, hitLocation: rollDie(100) }))
                }
                style={{ cursor: "pointer" }}
                type="button"
              >
                Hit location roll
              </button>
              <button
                onClick={() => setRollResults((current) => ({ ...current, crit: rollDie(100) }))}
                style={{ cursor: "pointer" }}
                type="button"
              >
                Crit roll
              </button>
            </div>
            <div
              style={{
                display: "grid",
                gap: "0.75rem",
                gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
              }}
            >
              <div
                style={{
                  background: "#fffdf8",
                  border: "1px solid #d9ddd8",
                  borderRadius: 10,
                  padding: "0.75rem",
                }}
              >
                <strong>Initiative</strong>
                <div>{rollResults.initiative ?? "—"}</div>
              </div>
              <div
                style={{
                  background: "#fffdf8",
                  border: "1px solid #d9ddd8",
                  borderRadius: 10,
                  padding: "0.75rem",
                }}
              >
                <strong>Attack</strong>
                <div>{rollResults.attack ?? "—"}</div>
              </div>
              <div
                style={{
                  background: "#fffdf8",
                  border: "1px solid #d9ddd8",
                  borderRadius: 10,
                  padding: "0.75rem",
                }}
              >
                <strong>Hit location</strong>
                <div>{rollResults.hitLocation ?? "—"}</div>
              </div>
              <div
                style={{
                  background: "#fffdf8",
                  border: "1px solid #d9ddd8",
                  borderRadius: 10,
                  padding: "0.75rem",
                }}
              >
                <strong>Crit</strong>
                <div>{rollResults.crit ?? "—"}</div>
              </div>
            </div>
          </div>
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
