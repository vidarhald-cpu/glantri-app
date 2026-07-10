import { useState } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { EncounterSession, ScenarioParticipant } from "@glantri/domain";

import { ScenarioEncounterAssignmentSection } from "./ScenarioEncounterAssignmentSection";
import { ScenarioEncountersSection } from "./ScenarioEncountersSection";

const encounter = {
  createdAt: "2026-07-10T10:00:00.000Z",
  id: "encounter-1",
  kind: "combat",
  participantMembershipMode: "explicit",
  participants: [],
  scenarioId: "scenario-1",
  status: "active",
  title: "Courtyard",
  updatedAt: "2026-07-10T10:00:00.000Z",
} as unknown as EncounterSession;

const participant = {
  controlledByUserId: "player-1",
  createdAt: "2026-07-10T10:00:00.000Z",
  id: "participant-1",
  isActive: true,
  joinSource: "gm_added",
  role: "player_character",
  scenarioId: "scenario-1",
  snapshot: {
    build: {},
    displayName: "The Gladiator",
  },
  sourceType: "character",
  state: {},
  updatedAt: "2026-07-10T10:00:00.000Z",
} as unknown as ScenarioParticipant;

function renderAssignmentSection(input: {
  onBulkEncounterAssignment?: (member: boolean) => void;
  onEncounterParticipantToggle?: (
    nextEncounter: EncounterSession,
    nextParticipant: ScenarioParticipant,
    member: boolean
  ) => void;
} = {}) {
  function AssignmentHarness() {
    const [selectedAssignmentParticipantIds, setSelectedAssignmentParticipantIds] = useState<string[]>([]);
    const [expandedAssignmentParticipantIds, setExpandedAssignmentParticipantIds] = useState<string[]>([]);
    const [selectedBulkEncounterId, setSelectedBulkEncounterId] = useState(encounter.id);

    return (
      <ScenarioEncounterAssignmentSection
        assignmentParticipants={[participant]}
        concreteParticipants={[participant]}
        expandedAssignmentParticipantIds={expandedAssignmentParticipantIds}
        formatUserLabel={(userId) => userId ?? "Unassigned"}
        isParticipantInEncounter={() => false}
        nonArchivedEncounters={[encounter]}
        onBulkEncounterAssignment={input.onBulkEncounterAssignment ?? vi.fn()}
        onBulkEncounterIdChange={setSelectedBulkEncounterId}
        onEncounterParticipantToggle={input.onEncounterParticipantToggle ?? vi.fn()}
        onParticipantActiveToggle={vi.fn()}
        onParticipantCivilizationFilterChange={vi.fn()}
        onParticipantProfessionFilterChange={vi.fn()}
        onParticipantSearchChange={vi.fn()}
        onParticipantSkillGroupFilterChange={vi.fn()}
        onParticipantTypeFilterChange={vi.fn()}
        participantCivilizationFilter=""
        participantCivilizationOptions={[]}
        participantProfessionFilter=""
        participantProfessionOptions={[]}
        participantSearch=""
        participantSkillGroupFilter=""
        participantSkillGroupOptions={[]}
        participantTypeFilter="all"
        participantTypeFilterOptions={[{ id: "all", label: "All types" }]}
        selectedAssignmentParticipantIds={selectedAssignmentParticipantIds}
        selectedBulkEncounterId={selectedBulkEncounterId}
        setExpandedAssignmentParticipantIds={setExpandedAssignmentParticipantIds}
        setSelectedAssignmentParticipantIds={setSelectedAssignmentParticipantIds}
      />
    );
  }

  render(<AssignmentHarness />);
}

describe("scenario encounter controls", () => {
  afterEach(() => cleanup());

  it("fires pause and archive status handlers from button clicks", async () => {
    const user = userEvent.setup();
    const onUpdateEncounterStatus = vi.fn();

    render(
      <ScenarioEncountersSection
        campaignId="campaign-1"
        encounterDescription=""
        encounterKind="combat"
        encounterTimelineLabel=""
        encounterTitle=""
        onCreateEncounter={vi.fn()}
        onDescriptionChange={vi.fn()}
        onKindChange={vi.fn()}
        onTimelineLabelChange={vi.fn()}
        onTitleChange={vi.fn()}
        onUpdateEncounterStatus={onUpdateEncounterStatus}
        orderedEncounters={[encounter]}
        scenarioId="scenario-1"
      />,
    );

    await user.click(screen.getByRole("button", { name: "Pause" }));
    await user.click(screen.getByRole("button", { name: "Archive" }));

    expect(onUpdateEncounterStatus).toHaveBeenNthCalledWith(1, encounter, "paused");
    expect(onUpdateEncounterStatus).toHaveBeenNthCalledWith(2, encounter, "archived");
  });

  it("captures row selection before assigning or withdrawing selected participants", async () => {
    const user = userEvent.setup();
    const onBulkEncounterAssignment = vi.fn();
    renderAssignmentSection({ onBulkEncounterAssignment });

    expect(screen.getByRole("button", { name: "Assign selected" })).toBeDisabled();
    await user.click(
      screen.getByRole("checkbox", {
        name: "Select The Gladiator for bulk encounter assignment",
      }),
    );

    await user.click(screen.getByRole("button", { name: "Assign selected" }));
    await user.click(screen.getByRole("button", { name: "Withdraw selected" }));

    expect(onBulkEncounterAssignment).toHaveBeenNthCalledWith(1, true);
    expect(onBulkEncounterAssignment).toHaveBeenNthCalledWith(2, false);
  });

  it("fires direct encounter membership toggles from grid checkboxes", async () => {
    const user = userEvent.setup();
    const onEncounterParticipantToggle = vi.fn();
    renderAssignmentSection({ onEncounterParticipantToggle });

    await user.click(
      screen.getByRole("checkbox", {
        name: "Toggle The Gladiator in Courtyard",
      }),
    );

    expect(onEncounterParticipantToggle).toHaveBeenCalledWith(encounter, participant, true);
  });
});
