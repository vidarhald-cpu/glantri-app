"use client";

import Link from "next/link";

import type { ScenarioSessionView } from "@glantri/domain";

import { buildCampaignWorkspaceHref } from "@/lib/campaigns/workspace";

const cardStyle = {
  background: "#fff",
  border: "1px solid #ddd7c9",
  borderRadius: 10,
  display: "grid",
  gap: "0.35rem",
  padding: "0.75rem",
} as const;

export function ScenarioSessionPanel({
  campaignId,
  onPickUp,
  session,
}: {
  campaignId?: string;
  onPickUp?: (availabilityId: string, targetParticipantId: string) => void;
  session: ScenarioSessionView;
}) {
  const controlledParticipants = session.participants.filter(
    (participant) => participant.isControlledByViewer,
  );

  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      <section aria-labelledby="scenario-participants-heading" style={cardStyle}>
        <h2 id="scenario-participants-heading" style={{ margin: 0 }}>
          Participants and presence
        </h2>
        {session.participants.length ? (
          <ul style={{ margin: 0, paddingLeft: "1.25rem" }}>
            {session.participants.map((participant) => (
              <li key={participant.id}>
                <strong>{participant.displayName}</strong>
                {participant.isControlledByViewer ? " (you)" : ""} —{" "}
                {participant.presence.kind === "encounter"
                  ? `Encounter: ${participant.presence.encounterName}`
                  : "Scenario"}
              </li>
            ))}
          </ul>
        ) : (
          <p style={{ margin: 0 }}>No visible participants are present.</p>
        )}
      </section>

      <section aria-labelledby="scenario-encounters-heading" style={cardStyle}>
        <h2 id="scenario-encounters-heading" style={{ margin: 0 }}>
          Encounters
        </h2>
        {session.encounters.length ? (
          <div style={{ display: "grid", gap: "0.6rem" }}>
            {session.encounters.map((encounter) => (
              <div key={encounter.id} style={cardStyle}>
                <strong>{encounter.title}</strong>
                <span>
                  {encounter.kind === "roleplay" ? "Roleplaying" : "Combat"} · {encounter.status}
                </span>
                {encounter.outcome ? <span>Outcome: {encounter.outcome}</span> : null}
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
              </div>
            ))}
          </div>
        ) : (
          <p style={{ margin: 0 }}>No Encounter is available to you right now.</p>
        )}
      </section>

      <section aria-labelledby="scenario-objects-heading" style={cardStyle}>
        <h2 id="scenario-objects-heading" style={{ margin: 0 }}>
          Available objects
        </h2>
        {session.availableObjects.length ? (
          <div style={{ display: "grid", gap: "0.6rem" }}>
            {session.availableObjects.map((object) => (
              <div key={object.id} style={cardStyle}>
                <strong>{object.name}</strong>
                <span>{object.referenceType}</span>
                {object.description ? <span>{object.description}</span> : null}
                {object.canPickUp && onPickUp && controlledParticipants.length ? (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
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
              </div>
            ))}
          </div>
        ) : (
          <p style={{ margin: 0 }}>No objects are currently available.</p>
        )}
      </section>

      <section aria-labelledby="scenario-history-heading" style={cardStyle}>
        <h2 id="scenario-history-heading" style={{ margin: 0 }}>
          Scenario history
        </h2>
        {session.history.length ? (
          <ol style={{ margin: 0, paddingLeft: "1.25rem" }}>
            {session.history.map((event) => (
              <li key={event.id}>
                <time dateTime={event.createdAt}>{new Date(event.createdAt).toLocaleString()}</time>
                {": "}
                {event.summary}
              </li>
            ))}
          </ol>
        ) : (
          <p style={{ margin: 0 }}>No objective Scenario history has been recorded yet.</p>
        )}
      </section>

      {session.viewerMode === "gm" ? (
        <section aria-labelledby="scenario-private-heading" style={cardStyle}>
          <h2 id="scenario-private-heading" style={{ margin: 0 }}>
            Private GM notes
          </h2>
          <p style={{ margin: 0 }}>{session.gmPrivateNotes || "No private notes."}</p>
        </section>
      ) : null}
    </div>
  );
}
