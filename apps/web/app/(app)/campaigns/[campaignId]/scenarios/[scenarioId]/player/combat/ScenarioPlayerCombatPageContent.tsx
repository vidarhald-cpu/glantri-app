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

const SYNTHETIC_PARTICIPANT_TIMESTAMP = new Date(0).toISOString();

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
          isGameMaster ? loadScenarioParticipants(scenarioId) : Promise.resolve([]),
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

    if (isGameMaster) {
      return selectableParticipants.filter((participant) => participant.isActive);
    }

    if (!projection.controlledParticipant) {
      return [];
    }

    return [
      {
        characterId: projection.controlledParticipant.characterId,
        controlledByUserId: currentUser?.id,
        createdAt: SYNTHETIC_PARTICIPANT_TIMESTAMP,
        displayOrder: 0,
        factionId: projection.controlledParticipant.factionId,
        id: projection.controlledParticipant.id,
        initiativeSlot: undefined,
        isActive: true,
        joinSource: "player_joined",
        position: undefined,
        role: projection.controlledParticipant.role,
        roleTag: undefined,
        scenarioId,
        snapshot: {
          build: projection.controlledParticipant.build,
          displayName: projection.controlledParticipant.displayName,
          equipmentState: projection.controlledParticipant.equipmentState
        },
        sourceType: projection.controlledParticipant.sourceType,
        state: {
          combat: {},
          conditions: Array.from(
            { length: projection.controlledParticipant.conditionCount },
            (_, index) => ({
              id: `condition-${index + 1}`,
              label: `Condition ${index + 1}`
            })
          ),
          equipment: {},
          health: {
            bleeding: 0,
            currentHp: projection.controlledParticipant.currentHp,
            dead: false,
            maxHp: projection.controlledParticipant.maxHp,
            unconscious: false,
            wounds: 0
          },
          modifiers: [],
          resources: {},
          snapshotVersion: 1
        },
        tacticalGroupId: undefined,
        updatedAt: SYNTHETIC_PARTICIPANT_TIMESTAMP,
        visibilityOverrides: undefined
      }
    ];
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
        <p style={{ margin: 0 }}>
          Player-facing combat shell for the currently controlled scenario participant.
        </p>
        {encounterTitle ? <div>Encounter: {encounterTitle}</div> : null}
        <label style={{ display: "grid", gap: "0.25rem", maxWidth: 360 }}>
          <span>Participant</span>
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
          display: "grid",
          gap: "1rem",
          gridTemplateColumns: "minmax(260px, 0.9fr) minmax(320px, 1.1fr)",
        }}
      >
        <div style={panelStyle}>
          <h2 style={{ margin: 0 }}>Combat context</h2>
          <div>Scenario: {projection.scenario.name}</div>
          <div>Status: {projection.scenario.status}</div>
          <div>Combat status: {projection.scenario.combatStatus}</div>
          <div>Round: {projection.scenario.roundNumber}</div>
          <div>Phase: {projection.scenario.phase}</div>
          <div>Visibility model: {projection.visibilityMode}</div>
        </div>

        <div style={panelStyle}>
          <h2 style={{ margin: 0 }}>Character state</h2>
          {displayedParticipant ? (
            <div style={{ display: "grid", gap: "0.5rem" }}>
              <strong>{displayedParticipant.displayName}</strong>
              <div>
                Role: {displayedParticipant.role} · {displayedParticipant.sourceType}
              </div>
              <div>
                HP: {displayedParticipant.currentHp}/{displayedParticipant.maxHp}
              </div>
              <div>Conditions: {displayedParticipant.conditionCount}</div>
              <div>Faction: {displayedParticipant.factionId ?? "Unassigned"}</div>
            </div>
          ) : (
            <div style={{ display: "grid", gap: "0.5rem" }}>
              <strong>No accessible participant</strong>
              <div>
                This account does not currently have an accessible participant to inspect in this
                scenario.
              </div>
            </div>
          )}
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
          title="Action selection"
          description="Attack, movement, skill use, speech, and other declared actions will be added here in a later phase."
        />
        <PlaceholderSection
          title="Details"
          description="Targeting, situational modifiers, and fine-grained reference details will expand into this area later."
        />
      </section>
    </section>
  );
}
