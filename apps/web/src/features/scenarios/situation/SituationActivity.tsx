"use client";

import type { ScenarioObjectiveHistoryEventType, ScenarioSessionView } from "@glantri/domain";

/**
 * Presentation labels for the event types
 * `scenarioObjectiveHistoryEventTypeSchema` already carries. Activity renders
 * only distinctions the existing model expresses: Player Play V1 §9.4 records
 * that adding an event type — a GM announcement member, for instance — is
 * floor-class and part of no slice, so nothing here invents one.
 *
 * The map is keyed on every member of the enum because the enum is the model's
 * own type. Several of those members can no longer appear in a player's
 * `session.history` at all: #788 settles that Scenario and Encounter
 * membership changes (`participant_added`, `participant_activated`,
 * `participant_deactivated`, `encounter_participants_updated`) and
 * implementation/maintenance events (`equipment_reconciled`) are GM
 * operational state, and `projectScenarioObjectiveHistory` withholds them from
 * the player projection. Their entries are retained only to keep this a total
 * `Record` over the model's type; the audience boundary is enforced in the
 * projection, never here, so this component cannot become a second authority
 * on it.
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
    <section aria-labelledby="situation-activity-heading" className="glantri-panel">
      <h2 className="glantri-section-heading" id="situation-activity-heading" style={{ margin: 0 }}>
        Activity
      </h2>
      {session.history.length ? (
        <ol style={{ display: "grid", gap: "0.3rem", listStyle: "none", margin: 0, padding: 0 }}>
          {[...session.history].reverse().map((event) => (
            <li
              key={event.id}
              style={{
                borderBottom: "var(--glantri-border-subtle)",
                display: "grid",
                gap: "0.1rem",
                padding: "0.35rem 0",
              }}
            >
              <div className="glantri-actions glantri-helper-text">
                <time dateTime={event.createdAt}>{new Date(event.createdAt).toLocaleString()}</time>
                <span>{eventTypeLabels[event.type]}</span>
              </div>
              <span>{event.summary}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="glantri-helper-text" style={{ margin: 0 }}>
          No objective Scenario history has been recorded yet.
        </p>
      )}
    </section>
  );
}
