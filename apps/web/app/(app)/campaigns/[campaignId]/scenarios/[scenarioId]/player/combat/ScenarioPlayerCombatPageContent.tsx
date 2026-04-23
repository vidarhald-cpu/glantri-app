"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { characterBuildSchema, type ScenarioPlayerProjection } from "@glantri/domain";

import {
  buildEquipmentLoadoutModuleModel,
  EquipmentLoadoutModule,
} from "../../../../../../../../src/features/equipment/loadoutModule";
import type { EquipmentFeatureState } from "../../../../../../../../src/features/equipment/types";
import { useSessionUser } from "../../../../../../../../src/lib/auth/SessionUserContext";
import { loadCanonicalContent } from "../../../../../../../../src/lib/content/loadCanonicalContent";
import { loadScenarioPlayerProjection } from "../../../../../../../../src/lib/api/localServiceClient";

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
        const [nextProjection, nextContent] = await Promise.all([
          loadScenarioPlayerProjection(scenarioId),
          loadCanonicalContent(),
        ]);

        if (cancelled) {
          return;
        }

        setProjection(nextProjection);
        setContent(nextContent);
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
  }, [currentUser, scenarioId, sessionLoading]);

  const controlledBuild = useMemo(() => {
    const result = characterBuildSchema.safeParse(projection?.controlledParticipant?.build);
    return result.success ? result.data : null;
  }, [projection]);

  const controlledEquipmentState = useMemo(() => {
    const candidate = projection?.controlledParticipant?.equipmentState;
    return isEquipmentFeatureState(candidate) ? candidate : null;
  }, [projection]);

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
        characterId: projection?.controlledParticipant?.characterId ?? "",
        state: controlledEquipmentState,
        throwingWeaponItemId: null,
      }),
    [content, controlledBuild, controlledEquipmentState, projection]
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
    Boolean(projection.controlledParticipant?.characterId);

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
          {projection.hasControlledParticipant && projection.controlledParticipant ? (
            <div style={{ display: "grid", gap: "0.5rem" }}>
              <strong>{projection.controlledParticipant.displayName}</strong>
              <div>
                Role: {projection.controlledParticipant.role} ·{" "}
                {projection.controlledParticipant.sourceType}
              </div>
              <div>
                HP: {projection.controlledParticipant.currentHp}/
                {projection.controlledParticipant.maxHp}
              </div>
              <div>Conditions: {projection.controlledParticipant.conditionCount}</div>
              <div>Faction: {projection.controlledParticipant.factionId ?? "Unassigned"}</div>
            </div>
          ) : (
            <div style={{ display: "grid", gap: "0.5rem" }}>
              <strong>No active character assigned</strong>
              <div>
                This account does not currently control an active player character in this
                scenario. Ask the GM to assign one before using the combat screen.
              </div>
            </div>
          )}
        </div>
      </section>

      <PlaceholderSection
        title="Situation"
        description="Current scene context, threats, range, and immediate tactical summary will appear here in the next phase."
      />

      <section style={{ display: "grid", gap: "1rem" }}>
        <h2 style={{ margin: 0 }}>Loadout and combat state</h2>
        {projection.hasControlledParticipant ? (
          hasMountedLoadout ? (
            <EquipmentLoadoutModule mode="readonly" model={loadoutModel} />
          ) : (
            <div style={panelStyle}>
              Character loadout snapshot is not available for this participant yet.
            </div>
          )
        ) : (
          <div style={panelStyle}>
            The readonly combat/loadout panel will appear here once a controlled character is
            assigned.
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
