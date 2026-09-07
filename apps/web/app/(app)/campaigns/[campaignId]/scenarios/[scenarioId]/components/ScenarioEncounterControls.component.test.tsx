import { useState } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ScenarioEncounterManagementProjection, ScenarioParticipant } from "@glantri/domain";

import { ScenarioEncounterAssignmentSection } from "./ScenarioEncounterAssignmentSection";
import { ScenarioEncountersSection } from "./ScenarioEncountersSection";

const encounter = {
  createdAt: "2026-07-10T10:00:00.000Z",
  id: "encounter-1",
  kind: "combat",
  participantCount: 0,
  participantMembershipMode: "explicit",
  participantMemberships: [],
  scenarioId: "scenario-1",
  status: "active",
  title: "Courtyard",
  updatedAt: "2026-07-10T10:00:00.000Z",
} satisfies ScenarioEncounterManagementProjection;

const participant = {
  characterId: "character-1",
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

function renderAssignmentSection(
  input: {
    assignmentParticipants?: ScenarioParticipant[];
    equipmentRefreshResult?: {
      kind: "error" | "success";
      message: string;
      participantId: string;
    };
    onBulkEncounterAssignment?: (member: boolean) => void;
    onEncounterParticipantToggle?: (
      nextEncounter: ScenarioEncounterManagementProjection,
      nextParticipant: ScenarioParticipant,
      member: boolean,
    ) => void;
    onRefreshParticipantEquipment?: (participant: ScenarioParticipant) => void;
    refreshingEquipmentParticipantId?: string;
  } = {},
) {
  function AssignmentHarness() {
    const [selectedAssignmentParticipantIds, setSelectedAssignmentParticipantIds] = useState<
      string[]
    >([]);
    const [expandedAssignmentParticipantIds, setExpandedAssignmentParticipantIds] = useState<
      string[]
    >([]);
    const [selectedBulkEncounterId, setSelectedBulkEncounterId] = useState(encounter.id);

    return (
      <ScenarioEncounterAssignmentSection
        assignmentParticipants={input.assignmentParticipants ?? [participant]}
        concreteParticipants={input.assignmentParticipants ?? [participant]}
        expandedAssignmentParticipantIds={expandedAssignmentParticipantIds}
        equipmentRefreshResult={input.equipmentRefreshResult}
        formatUserLabel={(userId) => userId ?? "Unassigned"}
        isParticipantInEncounter={() => false}
        nonArchivedEncounters={[encounter]}
        onBulkEncounterAssignment={input.onBulkEncounterAssignment ?? vi.fn()}
        onBulkEncounterIdChange={setSelectedBulkEncounterId}
        onEncounterParticipantToggle={input.onEncounterParticipantToggle ?? vi.fn()}
        onParticipantActiveToggle={vi.fn()}
        onRefreshParticipantEquipment={input.onRefreshParticipantEquipment ?? vi.fn()}
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
        refreshingEquipmentParticipantId={input.refreshingEquipmentParticipantId}
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

  it("offers only Pause for an active Encounter", async () => {
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

    expect(onUpdateEncounterStatus).toHaveBeenCalledWith(encounter, "paused");
    expect(screen.queryByRole("button", { name: "Archive" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Close encounter" })).not.toBeInTheDocument();
  });

  it("allows a Draft Encounter to be archived directly", async () => {
    const user = userEvent.setup();
    const onUpdateEncounterStatus = vi.fn();
    const draftEncounter = { ...encounter, status: "draft" as const };

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
        orderedEncounters={[draftEncounter]}
        scenarioId="scenario-1"
      />,
    );

    await user.click(screen.getByRole("button", { name: "Archive" }));
    expect(onUpdateEncounterStatus).toHaveBeenCalledWith(draftEncounter, "archived");
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

  it("offers equipment refresh for character rows and calls it with that participant", async () => {
    const user = userEvent.setup();
    const onRefreshParticipantEquipment = vi.fn();
    renderAssignmentSection({ onRefreshParticipantEquipment });

    await user.click(
      screen.getByRole("button", { name: "Toggle The Gladiator assignment details" }),
    );
    const refreshButton = screen.getByRole("button", { name: "Refresh equipment" });
    expect(refreshButton).toHaveAttribute(
      "title",
      expect.stringContaining(
        "Health, effects, combat state, and other participant state are preserved",
      ),
    );
    await user.click(refreshButton);

    expect(onRefreshParticipantEquipment).toHaveBeenCalledWith(participant);
  });

  it("shows a disabled pending state and row-scoped refresh feedback", async () => {
    const user = userEvent.setup();
    renderAssignmentSection({
      equipmentRefreshResult: {
        kind: "success",
        message: "The Gladiator’s scenario equipment was refreshed.",
        participantId: participant.id,
      },
      refreshingEquipmentParticipantId: participant.id,
    });
    await user.click(
      screen.getByRole("button", { name: "Toggle The Gladiator assignment details" }),
    );

    expect(screen.getByRole("button", { name: "Refreshing…" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent(
      "The Gladiator’s scenario equipment was refreshed.",
    );
  });

  it("shows normalized failures and omits refresh for non-character rows", async () => {
    const user = userEvent.setup();
    renderAssignmentSection({
      equipmentRefreshResult: {
        kind: "error",
        message: "Committed character equipment could not be loaded.",
        participantId: participant.id,
      },
    });
    await user.click(
      screen.getByRole("button", { name: "Toggle The Gladiator assignment details" }),
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Committed character equipment could not be loaded.",
    );

    cleanup();
    const entityParticipant = {
      ...participant,
      characterId: undefined,
      entityId: "entity-1",
      sourceType: "entity",
    } as ScenarioParticipant;
    renderAssignmentSection({ assignmentParticipants: [entityParticipant] });
    await user.click(
      screen.getByRole("button", { name: "Toggle The Gladiator assignment details" }),
    );
    expect(screen.queryByRole("button", { name: "Refresh equipment" })).not.toBeInTheDocument();
  });
});
