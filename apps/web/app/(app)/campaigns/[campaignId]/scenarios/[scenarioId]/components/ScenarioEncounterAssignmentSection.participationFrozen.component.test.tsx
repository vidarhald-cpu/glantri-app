import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ScenarioEncounterManagementProjection, ScenarioParticipant } from "@glantri/domain";

import { ScenarioEncounterAssignmentSection } from "./ScenarioEncounterAssignmentSection";

afterEach(() => cleanup());

const PARTICIPANT_ID = "participant-1";

function participant(isActive = true): ScenarioParticipant {
  return {
    createdAt: "2026-01-01T00:00:00.000Z",
    id: PARTICIPANT_ID,
    isActive,
    joinSource: "gm_added",
    role: "player_character",
    scenarioId: "scenario-1",
    snapshot: { displayName: "Glim Fairwater" },
    sourceType: "character",
    state: {
      combat: {
        combatContext: {
          modifierBuckets: {
            general: [],
            situationDb: [],
            situationInitiative: [],
            situationObSkill: [],
          },
        },
        engaged: false,
      },
      conditions: [],
      equipment: {},
      health: { bleeding: 0, currentHp: 0, dead: false, maxHp: 0, unconscious: false, wounds: 0 },
      modifiers: [],
      resources: {},
      snapshotVersion: 1,
    },
    updatedAt: "2026-01-01T00:00:00.000Z",
  } as unknown as ScenarioParticipant;
}

function encounter(status: "active" | "draft" | "paused"): ScenarioEncounterManagementProjection {
  return {
    createdAt: "2026-01-01T00:00:00.000Z",
    id: "encounter-1",
    kind: "combat",
    participantCount: 1,
    participantMembershipMode: "explicit",
    participantMemberships: [
      { id: "encounter-participant-1", scenarioParticipantId: PARTICIPANT_ID },
    ],
    scenarioId: "scenario-1",
    status,
    title: "Courtyard",
    updatedAt: "2026-01-01T00:00:00.000Z",
  } as unknown as ScenarioEncounterManagementProjection;
}

function renderSection(input: {
  encounterStatus: "active" | "draft" | "paused";
  isActive?: boolean;
  onParticipantActiveToggle?: ReturnType<typeof vi.fn>;
}) {
  const subject = participant(input.isActive ?? true);
  return render(
    <ScenarioEncounterAssignmentSection
      assignmentParticipants={[subject]}
      concreteParticipants={[subject]}
      expandedAssignmentParticipantIds={[PARTICIPANT_ID]}
      formatUserLabel={() => "GM"}
      isParticipantInEncounter={() => true}
      nonArchivedEncounters={[encounter(input.encounterStatus)]}
      onBulkEncounterAssignment={vi.fn()}
      onBulkEncounterIdChange={vi.fn()}
      onEncounterParticipantToggle={vi.fn()}
      onParticipantActiveToggle={input.onParticipantActiveToggle ?? vi.fn()}
      onParticipantCivilizationFilterChange={vi.fn()}
      onParticipantProfessionFilterChange={vi.fn()}
      onParticipantSearchChange={vi.fn()}
      onParticipantSkillGroupFilterChange={vi.fn()}
      onParticipantTypeFilterChange={vi.fn()}
      onRefreshParticipantEquipment={vi.fn()}
      participantCivilizationFilter=""
      participantCivilizationOptions={[]}
      participantProfessionFilter=""
      participantProfessionOptions={[]}
      participantSearch=""
      participantSkillGroupFilter=""
      participantSkillGroupOptions={[]}
      participantTypeFilter="all"
      participantTypeFilterOptions={[{ id: "all", label: "All" }]}
      selectedAssignmentParticipantIds={[]}
      selectedBulkEncounterId=""
      setExpandedAssignmentParticipantIds={vi.fn()}
      setSelectedAssignmentParticipantIds={vi.fn()}
    />,
  );
}

const ACTIVITY_CONTROL = "Toggle Glim Fairwater active scenario status";
const ENCOUNTER_CONTROL = "Toggle Glim Fairwater in Courtyard";

describe("a combatant of a running Encounter in the Encounter Assignment details (#845)", () => {
  it("offers no way to make them inactive, and says why and what to do instead", () => {
    const onParticipantActiveToggle = vi.fn();
    renderSection({ encounterStatus: "active", onParticipantActiveToggle });

    const activityControl = screen.getByLabelText(ACTIVITY_CONTROL);
    expect(activityControl).toBeDisabled();

    const note = screen.getByTestId(`participation-frozen-${PARTICIPANT_ID}`);
    expect(note).toHaveTextContent("Combatants enter and leave only between rounds");
    expect(note).toHaveTextContent("Glim Fairwater");
    expect(note).toHaveTextContent("Courtyard");
    expect(note).toHaveTextContent("next round boundary");
    expect(note.textContent?.toLowerCase()).not.toContain("refresh");

    fireEvent.click(activityControl);
    expect(onParticipantActiveToggle).not.toHaveBeenCalled();
  });

  it("leaves the Encounter roster control in the same row available, because that one works", () => {
    renderSection({ encounterStatus: "active" });

    expect(screen.getByLabelText(ENCOUNTER_CONTROL)).toBeEnabled();
  });

  it.each(["draft", "paused"] as const)(
    "leaves the activity control alone for a %s Encounter, which runs no round",
    (status) => {
      renderSection({ encounterStatus: status });

      expect(screen.getByLabelText(ACTIVITY_CONTROL)).toBeEnabled();
      expect(
        screen.queryByTestId(`participation-frozen-${PARTICIPANT_ID}`),
      ).not.toBeInTheDocument();
    },
  );

  it("leaves reactivation available, because it is the move that repairs a stored bad state", () => {
    renderSection({ encounterStatus: "active", isActive: false });

    expect(screen.getByLabelText(ACTIVITY_CONTROL)).toBeEnabled();
    expect(screen.queryByTestId(`participation-frozen-${PARTICIPANT_ID}`)).not.toBeInTheDocument();
  });
});
