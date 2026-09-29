"use client";

import type { ScenarioObjectiveHistoryEventType, ScenarioSessionView } from "@glantri/domain";

/**
 * Presentation labels for the event types
 * `scenarioObjectiveHistoryEventTypeSchema` already carries. Activity renders
 * only distinctions the existing model expresses: Player Play V1 §9.4 records
 * that adding an event type — a GM announcement member, for instance — is
 * floor-class and part of no slice, so nothing here invents one.
 */
const eventTypeLabels: Record<ScenarioObjectiveHistoryEventType, string> = {
  encounter_archived: "Encounter",
  encounter_closed: "Encounter",
  encounter_combat_outcome: "Combat outcome",
  encounter_created: "Encounter",
  encounter_participants_updated: "Encounter",
  encounter_paused: "Encounter",
  encounter_resumed: "Encounter",
  encounter_skill_outcome: "Skill outcome",
  encounter_started: "Encounter",
  equipment_reconciled: "Equipment",
  item_transferred: "Item",
  participant_activated: "Participants",
  participant_added: "Participants",
  participant_deactivated: "Participants",
};

/**
 * Activity across the full page width, below the selectors and the Inspector
 * (Player Play V1 §8.3). It presents `session.history` — the existing
 * `projectScenarioObjectiveHistory` output, which already performs the player
 * filtering §9.2 requires — and creates no second history model.
 */
export function SituationActivity({ session }: { session: ScenarioSessionView }) {
  return (
    <section
      aria-labelledby="situation-activity-heading"
      style={{ display: "grid", gap: "0.5rem" }}
    >
      <h2 id="situation-activity-heading" style={{ margin: 0 }}>
        Activity
      </h2>
      {session.history.length ? (
        <ol style={{ display: "grid", gap: "0.3rem", listStyle: "none", margin: 0, padding: 0 }}>
          {[...session.history].reverse().map((event) => (
            <li
              key={event.id}
              style={{
                borderBottom: "1px solid #ece8dc",
                display: "grid",
                gap: "0.1rem",
                padding: "0.35rem 0",
              }}
            >
              <div style={{ color: "#5e5a50", display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                <time dateTime={event.createdAt} style={{ fontSize: "0.8rem" }}>
                  {new Date(event.createdAt).toLocaleString()}
                </time>
                <span style={{ fontSize: "0.8rem" }}>{eventTypeLabels[event.type]}</span>
              </div>
              <span>{event.summary}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p style={{ margin: 0 }}>No objective Scenario history has been recorded yet.</p>
      )}
    </section>
  );
}
