import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createParticipantSnapshotFromEntity,
  type EncounterParticipant,
  type EncounterSession,
  type RoleplayState,
  type ScenarioParticipant,
} from "@glantri/domain";

const roleplayApiMocks = vi.hoisted(() => ({
  loadCampaignById: vi.fn(),
  loadEncounterById: vi.fn(),
  loadScenarioById: vi.fn(),
  loadScenarioMyParticipant: vi.fn(),
  loadScenarioParticipants: vi.fn(),
  submitPlayerRoleplayRollOnServer: vi.fn(),
}));

vi.mock("@/lib/api/localServiceClient", () => roleplayApiMocks);
vi.mock("@/lib/auth/SessionUserContext", () => ({
  useSessionUser: () => ({
    currentUser: { id: "player-1", roles: ["player"] },
  }),
}));
vi.mock("@/lib/content/loadCanonicalContent", () => ({
  loadCanonicalContent: vi.fn().mockResolvedValue({ skills: [] }),
}));

import {
  GmRoleplayingEncounterScreen,
  PlayerRoleplayingEncounterScreen,
} from "../RoleplayEncounterScreens";
import { EncounterInfoCard, ParticipantDescriptionsSection } from "./RoleplaySections";

const participant: EncounterParticipant = {
  declaration: {
    actionType: "none",
    defenseFocus: "none",
    defensePosture: "none",
    targetLocation: "any",
  },
  facing: "north",
  id: "participant-1",
  initiative: 0,
  label: "The Gladiator",
  order: 0,
  orientation: "neutral",
  participantType: "scenario",
  position: { x: 0, y: 0, zone: "center" },
};

function roleplayState(input: {
  detailedDescription?: string;
  name?: string;
  shortDescription?: string;
}): RoleplayState {
  return {
    actionLog: [],
    gmMessage: "",
    participantDescriptions: {
      [participant.id]: {
        detailedDescription: input.detailedDescription ?? "",
        name: input.name ?? participant.label,
        shortDescription: input.shortDescription ?? "",
      },
    },
    pendingSkillRolls: [],
    pendingStatChecks: [],
    visibility: {},
  };
}

function statCheckEncounter(): EncounterSession {
  return {
    actionLog: [],
    createdAt: "2026-08-13T10:00:00.000Z",
    currentRound: 1,
    currentTurnIndex: 0,
    declarationsLocked: false,
    id: "encounter-1",
    kind: "roleplay",
    participants: [{ ...participant, scenarioParticipantId: "scenario-participant-1" }],
    roleplayState: roleplayState({}),
    scenarioId: "scenario-1",
    status: "active",
    title: "At the Council Table",
    turnOrderMode: "manual",
    updatedAt: "2026-08-13T10:00:00.000Z",
  };
}

const scenarioParticipantWithStats = {
  controlledByUserId: "player-1",
  id: "scenario-participant-1",
  isActive: true,
  role: "player_character",
  snapshot: createParticipantSnapshotFromEntity({
    entity: {
      kind: "npc",
      name: "Ari",
      snapshot: {
        generatedHumanoidNpc: {
          stats: {
            base: { dex: 12, pow: 22 },
            final: { dex: 14, pow: 26 },
          },
        },
      },
    },
  }).snapshot,
} as unknown as ScenarioParticipant;

describe("GM Stat check assignment controls", () => {
  afterEach(() => cleanup());

  it("exposes labelled table-pressure controls and assigns the displayed canonical Stat", async () => {
    const user = userEvent.setup();
    const encounter = statCheckEncounter();
    const onAssignStatCheck = vi.fn().mockResolvedValue(encounter);

    render(
      <GmRoleplayingEncounterScreen
        encounter={encounter}
        onAssignStatCheck={onAssignStatCheck}
        onPersist={vi.fn().mockResolvedValue(encounter)}
        scenarioId="scenario-1"
        scenarioParticipants={[scenarioParticipantWithStats]}
        surface="skill-rolls"
      />,
    );

    expect(screen.getByRole("heading", { name: "Stat check assignment" })).toBeTruthy();
    expect(screen.getByLabelText("Stat check participant")).toHaveValue(participant.id);
    expect(screen.getByLabelText("Stat check Stat")).toHaveValue("dex");
    expect(screen.getByText(/Dex 14 · open-ended d20 · Medium/)).toBeTruthy();
    expect(screen.getByRole("option", { name: "Pow (26)" })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "Assign Stat check" }));

    await waitFor(() =>
      expect(onAssignStatCheck).toHaveBeenCalledWith({
        difficulty: "medium",
        participantId: participant.id,
        statId: "dex",
      }),
    );
    expect(screen.getByRole("status")).toHaveTextContent("Assigned Dex 14 at Medium.");
  });
});

describe("Player Stat check mobile presentation", () => {
  afterEach(() => cleanup());

  it("keeps the Stat fields, outcome, and keyboard action in responsive flow at 390px", async () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
    window.dispatchEvent(new Event("resize"));
    const encounter = {
      ...statCheckEncounter(),
      participantMembershipMode: "explicit" as const,
      roleplayState: {
        ...roleplayState({}),
        pendingStatChecks: [
          {
            assignedAt: "2026-08-13T10:01:00.000Z",
            difficulty: "medium" as const,
            id: "stat-check-dex",
            participantId: participant.id,
            statId: "dex" as const,
            statLabel: "Dex",
            statValue: 14,
          },
        ],
      },
    };
    roleplayApiMocks.loadEncounterById.mockResolvedValue(encounter);
    roleplayApiMocks.loadScenarioById.mockResolvedValue({
      id: "scenario-1",
      name: "Council session",
      status: "live",
    });
    roleplayApiMocks.loadCampaignById.mockResolvedValue({
      id: "campaign-1",
      name: "Council campaign",
      status: "active",
    });
    roleplayApiMocks.loadScenarioMyParticipant.mockResolvedValue(scenarioParticipantWithStats);

    render(
      <PlayerRoleplayingEncounterScreen
        campaignId="campaign-1"
        encounterId={encounter.id}
        scenarioId="scenario-1"
        surface="skill-rolls"
      />,
    );

    const statRegion = await screen.findByRole("region", { name: "Dex Stat check" });
    const statField = screen.getByLabelText("Assigned Stat");
    const difficultyField = screen.getByLabelText("Assigned Stat check difficulty");
    const action = screen.getByRole("button", { name: "Roll Stat check" });

    expect((statRegion as HTMLElement).style.gridTemplateColumns).toBe(
      "repeat(auto-fit, minmax(min(100%, 22rem), 1fr))",
    );
    expect(statField).toBeVisible();
    expect(statField).toHaveValue("Dex (14)");
    expect(difficultyField).toBeVisible();
    expect(difficultyField).toHaveValue("Medium");
    expect(screen.getByText("Calculation")).toBeVisible();
    expect(screen.getByText(/Result:/)).toBeVisible();
    expect(action).toBeVisible();
    action.focus();
    expect(document.activeElement).toBe(action);
  });
});

describe("Roleplay participant description drafts", () => {
  afterEach(() => cleanup());

  it("does not overwrite a dirty short description draft when refreshed server data arrives", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const { rerender } = render(
      <ParticipantDescriptionsSection
        onSave={onSave}
        roster={[participant]}
        state={roleplayState({
          detailedDescription: "Old detailed description",
          shortDescription: "Old short description",
        })}
      />,
    );

    await user.click(screen.getByText("The Gladiator"));
    const shortDescription = screen.getByLabelText(
      "The Gladiator short description",
    ) as HTMLInputElement;
    await user.clear(shortDescription);
    await user.type(shortDescription, "Local draft");

    rerender(
      <ParticipantDescriptionsSection
        onSave={onSave}
        roster={[participant]}
        state={roleplayState({
          detailedDescription: "Refreshed detailed description",
          shortDescription: "Server refresh should not win",
        })}
      />,
    );

    expect(shortDescription.value).toBe("Local draft");
    expect(
      (screen.getByLabelText("The Gladiator detailed description") as HTMLTextAreaElement).value,
    ).toBe("Refreshed detailed description");
  });

  it("updates non-dirty description drafts from fresh server data", () => {
    const onSave = vi.fn();
    const { rerender } = render(
      <ParticipantDescriptionsSection
        onSave={onSave}
        roster={[participant]}
        state={roleplayState({ shortDescription: "Old short description" })}
      />,
    );

    rerender(
      <ParticipantDescriptionsSection
        onSave={onSave}
        roster={[participant]}
        state={roleplayState({ shortDescription: "Fresh server description" })}
      />,
    );

    expect(
      (screen.getByLabelText("The Gladiator short description") as HTMLInputElement).value,
    ).toBe("Fresh server description");
  });

  it("saves the local draft and then accepts later server updates", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    const { rerender } = render(
      <ParticipantDescriptionsSection
        onSave={onSave}
        roster={[participant]}
        state={roleplayState({ shortDescription: "Old short description" })}
      />,
    );

    await user.click(screen.getByText("The Gladiator"));
    const shortDescription = screen.getByLabelText(
      "The Gladiator short description",
    ) as HTMLInputElement;
    await user.clear(shortDescription);
    await user.type(shortDescription, "Saved local draft");
    await user.click(screen.getByRole("button", { name: "Save description" }));

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({
        description: {
          detailedDescription: "",
          name: "The Gladiator",
          shortDescription: "Saved local draft",
        },
        participantId: "participant-1",
      }),
    );

    rerender(
      <ParticipantDescriptionsSection
        onSave={onSave}
        roster={[participant]}
        state={roleplayState({ shortDescription: "Later server update" })}
      />,
    );

    expect(shortDescription.value).toBe("Later server update");
  });
});

describe("Encounter info card status label", () => {
  afterEach(() => cleanup());

  it("shows the decided lifecycle label, never the raw enum", () => {
    render(<EncounterInfoCard encounter={{ ...statCheckEncounter(), status: "completed" }} />);

    expect(screen.getByText("Status: Closed")).toBeTruthy();
    expect(screen.queryByText("Status: completed")).toBeNull();
  });
});
