"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import type { ScenarioSessionView } from "@glantri/domain";

import {
  ArtifactInspectionDialog,
  type InspectedArtifact,
} from "@/features/artifacts/ArtifactInspectionDialog";
import { buildCampaignWorkspaceHref } from "@/lib/campaigns/workspace";

import { SituationActivity } from "./SituationActivity";
import { SituationInspector, type SituationSelection } from "./SituationInspector";
import { SituationRail, type SituationRailRow } from "./SituationRail";
import { loadSituationArtifacts, type SituationArtifact } from "./playerArtifactSource";

type PeopleFilterId = "all" | "pcs" | "npcs";

const peopleFilters = [
  { id: "all", label: "All" },
  { id: "pcs", label: "PCs" },
  { id: "npcs", label: "NPCs" },
] as const;

const cardStyle = {
  background: "#fff",
  border: "1px solid #ddd7c9",
  borderRadius: 10,
  display: "grid",
  gap: "0.35rem",
  padding: "0.75rem",
} as const;

/**
 * The player Situation body: three narrow People/Items/Artifacts selector
 * rails, a dominant Inspector, and full-width Activity below (Player Play V1
 * §8).
 *
 * It re-presents material the player can already access. It discloses nothing
 * new: every rail reads an existing projection, and the Items rail's pickup
 * runs the same canonical route with the same `expectedRevision`/`requestId`
 * contract the previous body used.
 */
export function ScenarioSituationView({
  campaignId,
  onPickUp,
  onReconcileEquipment,
  session,
}: {
  campaignId?: string;
  onPickUp?: (availabilityId: string, targetParticipantId: string) => void;
  onReconcileEquipment?: (participantId: string) => void;
  session: ScenarioSessionView;
}) {
  const [artifacts, setArtifacts] = useState<SituationArtifact[]>([]);
  const [artifactsError, setArtifactsError] = useState<string>();
  const [peopleFilter, setPeopleFilter] = useState<PeopleFilterId>("all");
  const [selection, setSelection] = useState<SituationSelection>();
  const [inspected, setInspected] = useState<InspectedArtifact>();

  useEffect(() => {
    if (!campaignId) return;
    let cancelled = false;
    void loadSituationArtifacts(campaignId)
      .then((loaded) => {
        if (!cancelled) {
          setArtifacts(loaded);
          setArtifactsError(undefined);
        }
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setArtifactsError(caught instanceof Error ? caught.message : "Unable to load Artifacts.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [campaignId]);

  const peopleRows = useMemo<SituationRailRow[]>(
    () =>
      session.participants
        .filter((participant) =>
          peopleFilter === "all"
            ? true
            : peopleFilter === "pcs"
              ? participant.role === "player_character"
              : participant.role !== "player_character",
        )
        .map((participant) => ({
          cue:
            participant.presence.kind === "encounter"
              ? `Encounter · ${participant.presence.encounterName}`
              : "Scenario",
          id: participant.id,
          label: `${participant.displayName}${participant.isControlledByViewer ? " (you)" : ""}`,
          searchText: participant.role,
        })),
    [peopleFilter, session.participants],
  );

  const itemRows = useMemo<SituationRailRow[]>(
    () =>
      session.availableObjects.map((object) => ({
        cue: object.referenceType,
        id: object.id,
        label: object.name,
        ...(object.description ? { searchText: object.description } : {}),
      })),
    [session.availableObjects],
  );

  const artifactRows = useMemo<SituationRailRow[]>(
    () =>
      artifacts.map((artifact) => ({
        cue: artifact.artifactKind,
        id: artifact.id,
        label: artifact.title,
        ...(artifact.description ? { searchText: artifact.description } : {}),
      })),
    [artifacts],
  );

  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      {session.encounters.length ? (
        <section aria-labelledby="situation-encounters-heading" style={cardStyle}>
          <h2 id="situation-encounters-heading" style={{ fontSize: "1rem", margin: 0 }}>
            Encounters
          </h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
            {session.encounters.map((encounter) => (
              <span key={encounter.id} style={{ display: "flex", gap: "0.35rem" }}>
                <span>
                  {encounter.title} · {encounter.kind === "roleplay" ? "Roleplaying" : "Combat"} ·{" "}
                  {encounter.status === "completed"
                    ? "Closed"
                    : encounter.status.charAt(0).toUpperCase() + encounter.status.slice(1)}
                  {encounter.outcome ? ` · ${encounter.outcome}` : ""}
                </span>
                {campaignId ? (
                  <Link
                    href={buildCampaignWorkspaceHref({
                      campaignId,
                      encounterId: encounter.id,
                      scenarioId: session.scenario.id,
                      tab: "encounter",
                    })}
                  >
                    Open encounter
                  </Link>
                ) : null}
              </span>
            ))}
          </div>
        </section>
      ) : (
        <section aria-labelledby="situation-encounters-heading" style={cardStyle}>
          <h2 id="situation-encounters-heading" style={{ fontSize: "1rem", margin: 0 }}>
            Encounters
          </h2>
          <p style={{ margin: 0 }}>No Encounter is available to you right now.</p>
        </section>
      )}

      <div
        style={{
          alignItems: "start",
          display: "grid",
          gap: "1rem",
          gridTemplateColumns: "minmax(13rem, 17rem) minmax(0, 3fr)",
        }}
      >
        <div style={{ display: "grid", gap: "0.75rem" }}>
          <SituationRail<PeopleFilterId>
            emptyMessage="No visible participants are present."
            filters={{
              activeId: peopleFilter,
              label: "Filter People",
              onChange: setPeopleFilter,
              options: [...peopleFilters],
            }}
            onSelect={(id) => setSelection({ id, kind: "person" })}
            rows={peopleRows}
            searchLabel="Search People"
            selectedId={selection?.kind === "person" ? selection.id : undefined}
            title="People"
          />
          <SituationRail
            emptyMessage="No Items are available to you right now."
            onSelect={(id) => setSelection({ id, kind: "item" })}
            rows={itemRows}
            searchLabel="Search Items"
            selectedId={selection?.kind === "item" ? selection.id : undefined}
            title="Items"
          />
          <SituationRail
            emptyMessage={artifactsError ?? "No Artifacts are available to you right now."}
            onSelect={(id) => setSelection({ id, kind: "artifact" })}
            rows={artifactRows}
            searchLabel="Search Artifacts"
            selectedId={selection?.kind === "artifact" ? selection.id : undefined}
            title="Artifacts"
          />
        </div>
        <SituationInspector
          artifacts={artifacts}
          campaignId={campaignId}
          onOpenArtifactFullView={(artifact) =>
            setInspected({
              alt: artifact.altText ?? artifact.title,
              artifactKind: artifact.artifactKind,
              kind: "image",
              src: artifact.contentSrc,
              title: artifact.title,
            })
          }
          onPickUp={onPickUp}
          onReconcileEquipment={onReconcileEquipment}
          selection={selection}
          session={session}
        />
      </div>

      <SituationActivity session={session} />

      {inspected ? (
        <ArtifactInspectionDialog artifact={inspected} onExit={() => setInspected(undefined)} />
      ) : null}
    </div>
  );
}
