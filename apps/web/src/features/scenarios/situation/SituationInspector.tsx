"use client";

import Link from "next/link";

import type { ScenarioSessionView } from "@glantri/domain";

import { buildCampaignWorkspaceHref } from "@/lib/campaigns/workspace";

import type { SituationArtifact } from "./playerArtifactSource";

export type SituationSelection =
  | { id: string; kind: "artifact" }
  | { id: string; kind: "item" }
  | { id: string; kind: "person" };

const previewStyle = {
  background: "var(--glantri-surface-muted)",
  border: "var(--glantri-border-subtle)",
  borderRadius: "var(--glantri-radius-inner)",
  display: "block",
  maxHeight: "32rem",
  maxWidth: "100%",
  objectFit: "contain",
  width: "100%",
} as const;

function InspectorFrame({
  children,
  subtitle,
  title,
}: {
  children?: React.ReactNode;
  subtitle?: string;
  title: string;
}) {
  return (
    <section aria-label="Inspector" className="glantri-panel" style={{ minHeight: "22rem" }}>
      <div>
        <h3 style={{ margin: 0 }}>{title}</h3>
        {subtitle ? <div className="glantri-helper-text">{subtitle}</div> : null}
      </div>
      {children}
    </section>
  );
}

/**
 * The dominant Situation Inspector: a generic visual/detail area over the
 * material the rails already present (Player Play V1 §8.2). It introduces no
 * domain model of its own, and it routes to an existing canonical full view
 * rather than reimplementing one (§13).
 */
export function SituationInspector({
  artifacts,
  campaignId,
  onOpenArtifactFullView,
  onPickUp,
  onReconcileEquipment,
  selection,
  session,
}: {
  artifacts: SituationArtifact[];
  campaignId?: string;
  onOpenArtifactFullView?: (artifact: SituationArtifact) => void;
  onPickUp?: (availabilityId: string, targetParticipantId: string) => void;
  onReconcileEquipment?: (participantId: string) => void;
  selection?: SituationSelection;
  session: ScenarioSessionView;
}) {
  if (!selection) {
    return (
      <InspectorFrame title="Nothing selected">
        <p style={{ margin: 0 }}>Select a person, an Item or an Artifact to inspect it here.</p>
      </InspectorFrame>
    );
  }

  if (selection.kind === "person") {
    const participant = session.participants.find((entry) => entry.id === selection.id);
    if (!participant) {
      return (
        <InspectorFrame title="No longer available">
          <p style={{ margin: 0 }}>This person is no longer part of the Scenario view.</p>
        </InspectorFrame>
      );
    }
    const presence =
      participant.presence.kind === "encounter"
        ? `Encounter: ${participant.presence.encounterName}`
        : "Present in the Scenario";

    return (
      <InspectorFrame
        subtitle={`${participant.role.replace(/_/g, " ")} · ${presence}`}
        title={`${participant.displayName}${participant.isControlledByViewer ? " (you)" : ""}`}
      >
        {participant.equipment ? (
          <div
            className="glantri-panel glantri-panel--muted glantri-panel--inner"
            style={{ justifyItems: "start" }}
          >
            <strong>Equipment prepared for this Scenario</strong>
            <span>{participant.equipment.message}</span>
            {participant.equipment.canReconcile && onReconcileEquipment ? (
              <button onClick={() => onReconcileEquipment(participant.id)} type="button">
                Update Scenario equipment
              </button>
            ) : null}
          </div>
        ) : null}
        {campaignId && participant.presence.kind === "encounter" ? (
          <Link
            href={buildCampaignWorkspaceHref({
              campaignId,
              encounterId: participant.presence.encounterId,
              scenarioId: session.scenario.id,
              tab: "encounter",
            })}
          >
            Open encounter
          </Link>
        ) : null}
      </InspectorFrame>
    );
  }

  if (selection.kind === "item") {
    const object = session.availableObjects.find((entry) => entry.id === selection.id);
    if (!object) {
      return (
        <InspectorFrame title="No longer available">
          <p style={{ margin: 0 }}>This Item is no longer available in this Scenario.</p>
        </InspectorFrame>
      );
    }
    const controlledParticipants = session.participants.filter(
      (participant) => participant.isControlledByViewer,
    );

    return (
      <InspectorFrame subtitle={object.referenceType} title={object.name}>
        {object.description ? <p style={{ margin: 0 }}>{object.description}</p> : null}
        {object.canPickUp && onPickUp && controlledParticipants.length ? (
          <div className="glantri-actions">
            {controlledParticipants.map((participant) => (
              <button
                key={participant.id}
                onClick={() => onPickUp(object.id, participant.id)}
                type="button"
              >
                Pick up as {participant.displayName}
              </button>
            ))}
          </div>
        ) : null}
      </InspectorFrame>
    );
  }

  const artifact = artifacts.find((entry) => entry.id === selection.id);
  if (!artifact) {
    return (
      <InspectorFrame title="No longer available">
        <p style={{ margin: 0 }}>This Artifact is no longer available to you.</p>
      </InspectorFrame>
    );
  }

  return (
    <InspectorFrame subtitle={artifact.artifactKind} title={artifact.title}>
      {artifact.isImage ? (
        <img
          alt={artifact.altText ?? artifact.title}
          src={artifact.contentSrc}
          style={previewStyle}
        />
      ) : null}
      {artifact.description ? <p style={{ margin: 0 }}>{artifact.description}</p> : null}
      {artifact.isImage && onOpenArtifactFullView ? (
        <div>
          <button onClick={() => onOpenArtifactFullView(artifact)} type="button">
            Open full view
          </button>
        </div>
      ) : (
        <a href={artifact.contentSrc} rel="noreferrer" target="_blank">
          Download {artifact.title}
        </a>
      )}
    </InspectorFrame>
  );
}
