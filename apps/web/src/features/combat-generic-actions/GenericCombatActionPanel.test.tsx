// @vitest-environment happy-dom

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { EncounterSession, ScenarioParticipant } from "@glantri/domain";

import { updateGenericCombatActionOnServer } from "@/lib/api/localServiceClient";
import { GenericCombatActionPanel } from "./GenericCombatActionPanel";

vi.mock("@/lib/api/localServiceClient", () => ({
  loadCombatItemInteractionOptions: vi.fn(() => new Promise(() => undefined)),
  updateCombatItemInteractionOnServer: vi.fn(),
  updateGenericCombatActionOnServer: vi.fn(),
}));

const encounter = {
  combatRoundState: {
    genericActions: [],
    participants: [{ label: "Aster", participantId: "encounter-aster" }],
  },
  id: "encounter-1",
  participants: [
    {
      characterId: "character-aster",
      id: "encounter-aster",
      scenarioParticipantId: "scenario-aster",
    },
  ],
  updatedAt: "2026-08-14T10:00:00.000Z",
} as unknown as EncounterSession;

const scenarioParticipant = {
  characterId: "character-aster",
  id: "scenario-aster",
  snapshot: { displayName: "Aster" },
} as unknown as ScenarioParticipant;

describe("GenericCombatActionPanel", () => {
  beforeEach(() => {
    vi.mocked(updateGenericCombatActionOnServer).mockReset();
    vi.mocked(updateGenericCombatActionOnServer).mockResolvedValue(encounter);
  });

  it("declares the Survey preset with canonical Perception and a visible numeric Difficulty", async () => {
    render(
      <GenericCombatActionPanel
        encounter={encounter}
        isGm={false}
        onEncounterUpdated={vi.fn()}
        participantId="encounter-aster"
        scenarioParticipants={[scenarioParticipant]}
      />,
    );

    expect(screen.getByText("Perception")).toBeInTheDocument();
    expect(screen.getByLabelText("Action Difficulty")).toHaveValue(26);
    fireEvent.change(screen.getByLabelText("What do you intend to do?"), {
      target: { value: "Survey the dark balcony for movement." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Declare generic action" }));

    await waitFor(() => expect(updateGenericCombatActionOnServer).toHaveBeenCalledTimes(1));
    expect(updateGenericCombatActionOnServer).toHaveBeenCalledWith(
      expect.objectContaining({
        difficulty: 26,
        intent: "Survey the dark balcony for movement.",
        operation: "declare",
        participantId: "encounter-aster",
        preset: "look_around",
        rollKind: "skill",
        skillId: "perception",
      }),
    );
  });

  it("supports a simple action with no roll", async () => {
    render(
      <GenericCombatActionPanel
        encounter={encounter}
        isGm={false}
        onEncounterUpdated={vi.fn()}
        participantId="encounter-aster"
        scenarioParticipants={[scenarioParticipant]}
      />,
    );

    fireEvent.change(screen.getByLabelText("Generic action"), { target: { value: "other" } });
    fireEvent.change(screen.getByLabelText("Roll"), { target: { value: "none" } });
    fireEvent.change(screen.getByLabelText("What do you intend to do?"), {
      target: { value: "Bar the door." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Declare generic action" }));

    await waitFor(() => expect(updateGenericCombatActionOnServer).toHaveBeenCalledTimes(1));
    expect(updateGenericCombatActionOnServer).toHaveBeenCalledWith(
      expect.objectContaining({ intent: "Bar the door.", operation: "declare" }),
    );
    expect(
      vi.mocked(updateGenericCombatActionOnServer).mock.calls[0]?.[0].rollKind,
    ).toBeUndefined();
  });

  it("defensively omits hidden round participants from the player reference selector", () => {
    const playerSafeEncounter = {
      ...encounter,
      combatRoundState: {
        ...encounter.combatRoundState,
        participants: [
          { label: "Aster", participantId: "encounter-aster" },
          { label: "Hidden watcher", participantId: "encounter-hidden" },
        ],
      },
    } as unknown as EncounterSession;
    render(
      <GenericCombatActionPanel
        encounter={playerSafeEncounter}
        isGm={false}
        onEncounterUpdated={vi.fn()}
        participantId="encounter-aster"
        scenarioParticipants={[scenarioParticipant]}
      />,
    );

    fireEvent.change(screen.getByLabelText("Reference"), {
      target: { value: "participant" },
    });
    const selector = screen.getByLabelText("Referenced participant");
    expect(within(selector).getByRole("option", { name: "Aster" })).toBeInTheDocument();
    expect(within(selector).queryByRole("option", { name: "Hidden watcher" })).toBeNull();
    expect(
      Array.from((selector as HTMLSelectElement).options).map((option) => option.value),
    ).not.toContain("encounter-hidden");
  });

  it("lets the GM adjust roll basis, Difficulty, and typed reference without claiming Current task", async () => {
    const gmEncounter = {
      ...encounter,
      combatRoundState: {
        genericActions: [
          {
            createdAt: "2026-08-14T08:00:00.000Z",
            duration: { kind: "round" },
            id: "action-completed",
            intent: "Check the courtyard.",
            lastUpdatedAt: "2026-08-14T08:10:00.000Z",
            ownerParticipantId: "encounter-aster",
            progress: { completedRounds: 1, totalRounds: 1 },
            resolution: {
              resolvedAt: "2026-08-14T08:10:00.000Z",
              text: "The courtyard is clear.",
              visibleToParticipantIds: ["encounter-aster"],
            },
            status: "completed",
          },
          {
            awarenessContext: { kind: "survey" },
            createdAt: "2026-08-14T09:00:00.000Z",
            duration: { kind: "round" },
            id: "action-review",
            intent: "Survey the balcony.",
            lastUpdatedAt: "2026-08-14T09:00:00.000Z",
            ownerParticipantId: "encounter-aster",
            preset: "look_around",
            progress: { completedRounds: 0, totalRounds: 1 },
            rollRequest: {
              basis: {
                avgStats: 14,
                baseValue: 21,
                derivedXp: 0,
                groupXp: 0,
                kind: "skill",
                skillId: "perception",
                skillLabel: "Perception",
                skillXp: 0,
                unknownSkillPenalty: 0,
              },
              difficulty: 26,
            },
            status: "declared",
          },
        ],
        participants: [
          { label: "Aster", participantId: "encounter-aster" },
          { label: "Gate guard", participantId: "encounter-guard" },
        ],
      },
      participants: [
        ...encounter.participants,
        {
          characterId: "character-guard",
          id: "encounter-guard",
          scenarioParticipantId: "scenario-guard",
        },
      ],
    } as unknown as EncounterSession;
    render(
      <GenericCombatActionPanel
        encounter={gmEncounter}
        isGm
        onEncounterUpdated={vi.fn()}
        participantId="encounter-aster"
        scenarioParticipants={[scenarioParticipant]}
        skills={[
          { id: "perception", name: "Perception" },
          { id: "stealth", name: "Stealth" },
        ]}
      />,
    );

    expect(screen.queryByLabelText("Current task")).toBeNull();
    expect(screen.getByLabelText("Action and task history")).toHaveValue("action-review");
    expect(screen.getByRole("group", { name: "Open actions and tasks" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Completed and closed history" })).toBeInTheDocument();
    expect(
      within(screen.getByLabelText("Reviewed roll")).getByRole("option", { name: "No roll" }),
    ).toBeInTheDocument();
    expect(
      within(screen.getByLabelText("Reviewed roll")).getByRole("option", { name: "Skill" }),
    ).toBeInTheDocument();
    expect(
      within(screen.getByLabelText("Reviewed roll")).getByRole("option", { name: "Current Stat" }),
    ).toBeInTheDocument();
    expect(
      within(screen.getByLabelText("Reviewed reference")).getByRole("option", { name: "Item" }),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Reviewed roll"), { target: { value: "stat" } });
    fireEvent.change(screen.getByLabelText("Reviewed Current Stat"), {
      target: { value: "dex" },
    });
    fireEvent.change(screen.getByLabelText("Reviewed Difficulty"), { target: { value: "31" } });
    fireEvent.change(screen.getByLabelText("Reviewed reference"), {
      target: { value: "environment" },
    });
    fireEvent.change(screen.getByLabelText("Reviewed environment"), {
      target: { value: "The gatehouse roofline" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Review action" }));

    await waitFor(() => expect(updateGenericCombatActionOnServer).toHaveBeenCalledTimes(1));
    expect(updateGenericCombatActionOnServer).toHaveBeenCalledWith(
      expect.objectContaining({
        actionId: "action-review",
        difficulty: 31,
        environmentDescription: "The gatehouse roofline",
        operation: "review",
        referenceKind: "environment",
        rollKind: "stat",
        statId: "dex",
      }),
    );
  });

  it("scopes an unsaved GM result to the selected action and exact recipient set", async () => {
    const gmEncounter = {
      ...encounter,
      combatRoundState: {
        genericActions: [
          {
            createdAt: "2026-08-14T08:00:00.000Z",
            duration: { kind: "round" },
            id: "action-no-roll",
            intent: "Bar the door.",
            lastUpdatedAt: "2026-08-14T08:00:00.000Z",
            ownerParticipantId: "encounter-aster",
            progress: { completedRounds: 1, totalRounds: 1 },
            status: "active",
          },
          {
            createdAt: "2026-08-14T08:05:00.000Z",
            duration: { kind: "rounds", rounds: 3 },
            id: "action-three-rounds",
            intent: "Reinforce the gate.",
            lastUpdatedAt: "2026-08-14T08:05:00.000Z",
            ownerParticipantId: "encounter-guard",
            progress: { completedRounds: 3, totalRounds: 3 },
            status: "active",
          },
          {
            createdAt: "2026-08-14T07:00:00.000Z",
            duration: { kind: "round" },
            id: "action-completed",
            intent: "Check the courtyard.",
            lastUpdatedAt: "2026-08-14T07:10:00.000Z",
            ownerParticipantId: "encounter-aster",
            progress: { completedRounds: 1, totalRounds: 1 },
            resolution: {
              resolvedAt: "2026-08-14T07:10:00.000Z",
              text: "The courtyard is clear.",
              visibleToParticipantIds: ["encounter-aster"],
            },
            status: "completed",
          },
        ],
        participants: [
          { label: "Aster", participantId: "encounter-aster" },
          { label: "Gate guard", participantId: "encounter-guard" },
        ],
      },
      participants: [
        ...encounter.participants,
        {
          characterId: "character-guard",
          id: "encounter-guard",
          scenarioParticipantId: "scenario-guard",
        },
      ],
    } as unknown as EncounterSession;
    const props = {
      encounter: gmEncounter,
      isGm: true,
      onEncounterUpdated: vi.fn(),
      participantId: "encounter-aster",
      scenarioParticipants: [scenarioParticipant],
    };
    const { unmount } = render(<GenericCombatActionPanel {...props} />);
    const selector = screen.getByLabelText("Action and task history");
    const resolveButton = screen.getByRole("button", { name: "Resolve action" });

    await waitFor(() => expect(resolveButton).toBeDisabled());
    fireEvent.change(screen.getByLabelText("Player-safe result"), {
      target: { value: "This belongs only to the door action." },
    });
    expect(resolveButton).toBeEnabled();

    fireEvent.change(selector, { target: { value: "action-three-rounds" } });
    await waitFor(() => {
      expect(screen.getByLabelText("Player-safe result")).toHaveValue("");
      expect(screen.getByRole("button", { name: "Resolve action" })).toBeDisabled();
      expect(screen.getByRole("checkbox", { name: "Gate guard" })).toBeChecked();
      expect(screen.getByRole("checkbox", { name: "Aster" })).not.toBeChecked();
    });

    fireEvent.change(screen.getByLabelText("Player-safe result"), {
      target: { value: "The gate braces hold." },
    });
    expect(screen.getByRole("button", { name: "Resolve action" })).toBeEnabled();
    fireEvent.click(screen.getByRole("checkbox", { name: "Aster" }));
    expect(screen.getByLabelText("Player-safe result")).toHaveValue("");
    expect(screen.getByRole("button", { name: "Resolve action" })).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Player-safe result"), {
      target: { value: "Both defenders notice the gate settling." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Resolve action" }));
    await waitFor(() => expect(updateGenericCombatActionOnServer).toHaveBeenCalledTimes(1));
    expect(updateGenericCombatActionOnServer).toHaveBeenCalledWith(
      expect.objectContaining({
        actionId: "action-three-rounds",
        operation: "resolve",
        resultText: "Both defenders notice the gate settling.",
        visibleToParticipantIds: ["encounter-guard", "encounter-aster"],
      }),
    );

    fireEvent.change(selector, { target: { value: "action-completed" } });
    await waitFor(() => expect(screen.queryByLabelText("Player-safe result")).toBeNull());
    expect(screen.getByText("The courtyard is clear.")).toBeInTheDocument();
    fireEvent.change(selector, { target: { value: "action-no-roll" } });
    await waitFor(() => {
      expect(screen.getByLabelText("Player-safe result")).toHaveValue("");
      expect(screen.getByRole("button", { name: "Resolve action" })).toBeDisabled();
    });

    unmount();
    render(<GenericCombatActionPanel {...props} />);
    await waitFor(() => {
      expect(screen.getByLabelText("Action and task history")).toHaveValue("action-no-roll");
      expect(screen.getByLabelText("Player-safe result")).toHaveValue("");
      expect(screen.getByRole("button", { name: "Resolve action" })).toBeDisabled();
    });
    fireEvent.change(screen.getByLabelText("Action and task history"), {
      target: { value: "action-completed" },
    });
    await waitFor(() => expect(screen.getByText("The courtyard is clear.")).toBeInTheDocument());
  });

  it("reloads canonical GM review fields whenever the selected action changes", async () => {
    const gmEncounter = {
      ...encounter,
      combatRoundState: {
        genericActions: [
          {
            createdAt: "2026-08-14T09:00:00.000Z",
            duration: { kind: "rounds", rounds: 3 },
            id: "review-survey",
            intent: "Survey the balcony.",
            lastUpdatedAt: "2026-08-14T09:00:00.000Z",
            ownerParticipantId: "encounter-aster",
            progress: { completedRounds: 0, totalRounds: 3 },
            reference: { description: "North balcony", kind: "environment" },
            rollRequest: {
              basis: {
                avgStats: 14,
                baseValue: 21,
                derivedXp: 0,
                groupXp: 0,
                kind: "skill",
                skillId: "perception",
                skillLabel: "Perception",
                skillXp: 0,
                unknownSkillPenalty: 0,
              },
              difficulty: 26,
            },
            status: "declared",
          },
          {
            createdAt: "2026-08-14T09:05:00.000Z",
            duration: { kind: "phase", phase: "phase2" },
            id: "review-no-roll",
            intent: "Signal the guard.",
            lastUpdatedAt: "2026-08-14T09:05:00.000Z",
            ownerParticipantId: "encounter-aster",
            progress: { completedRounds: 0 },
            reference: {
              kind: "participant",
              label: "Gate guard",
              participantId: "encounter-guard",
            },
            status: "declared",
          },
        ],
        participants: [
          { label: "Aster", participantId: "encounter-aster" },
          { label: "Gate guard", participantId: "encounter-guard" },
        ],
      },
      participants: [
        ...encounter.participants,
        {
          characterId: "character-guard",
          id: "encounter-guard",
          scenarioParticipantId: "scenario-guard",
        },
      ],
    } as unknown as EncounterSession;
    render(
      <GenericCombatActionPanel
        encounter={gmEncounter}
        isGm
        onEncounterUpdated={vi.fn()}
        participantId="encounter-aster"
        scenarioParticipants={[scenarioParticipant]}
        skills={[{ id: "perception", name: "Perception" }]}
      />,
    );

    await waitFor(() => expect(screen.getByLabelText("Reviewed roll")).toHaveValue("skill"));
    fireEvent.change(screen.getByLabelText("Reviewed roll"), { target: { value: "stat" } });
    fireEvent.change(screen.getByLabelText("Reviewed reference"), {
      target: { value: "environment" },
    });
    fireEvent.change(screen.getByLabelText("Reviewed environment"), {
      target: { value: "Unsaved stale reference" },
    });

    fireEvent.change(screen.getByLabelText("Action and task history"), {
      target: { value: "review-no-roll" },
    });
    await waitFor(() => {
      expect(screen.getByLabelText("Reviewed duration")).toHaveValue("phase");
      expect(screen.getByLabelText("Reviewed phase")).toHaveValue("phase2");
      expect(screen.getByLabelText("Reviewed roll")).toHaveValue("none");
      expect(screen.getByLabelText("Reviewed reference")).toHaveValue("participant");
      expect(screen.getByLabelText("Reviewed participant")).toHaveValue("encounter-guard");
    });

    fireEvent.change(screen.getByLabelText("Action and task history"), {
      target: { value: "review-survey" },
    });
    await waitFor(() => {
      expect(screen.getByLabelText("Reviewed duration")).toHaveValue("rounds");
      expect(screen.getByLabelText("Reviewed rounds")).toHaveValue(3);
      expect(screen.getByLabelText("Reviewed roll")).toHaveValue("skill");
      expect(screen.getByLabelText("Reviewed Skill")).toHaveValue("perception");
      expect(screen.getByLabelText("Reviewed Difficulty")).toHaveValue(26);
      expect(screen.getByLabelText("Reviewed reference")).toHaveValue("environment");
      expect(screen.getByLabelText("Reviewed environment")).toHaveValue("North balcony");
    });
  });

  it("keeps fixed-duration resolution disabled until canonical progress is complete", async () => {
    const action = {
      createdAt: "2026-08-14T09:00:00.000Z",
      duration: { kind: "rounds" as const, rounds: 3 },
      id: "fixed-action",
      intent: "Raise the gate.",
      lastUpdatedAt: "2026-08-14T09:00:00.000Z",
      ownerParticipantId: "encounter-aster",
      progress: {
        completedRounds: 1,
        startedRoundNumber: 1,
        startedStep: "select_actions" as const,
        totalRounds: 3,
      },
      status: "active" as const,
    };
    const buildEncounter = (completedRounds: number) =>
      ({
        ...encounter,
        combatRoundState: {
          currentStep: "select_actions",
          genericActions: [{ ...action, progress: { ...action.progress, completedRounds } }],
          participants: [{ label: "Aster", participantId: "encounter-aster" }],
          roundNumber: 2,
        },
      }) as unknown as EncounterSession;
    const props = {
      isGm: true,
      onEncounterUpdated: vi.fn(),
      participantId: "encounter-aster",
      scenarioParticipants: [scenarioParticipant],
    };
    const { rerender } = render(
      <GenericCombatActionPanel encounter={buildEncounter(1)} {...props} />,
    );
    fireEvent.change(screen.getByLabelText("Player-safe result"), {
      target: { value: "The gate rises." },
    });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Resolve action" })).toBeDisabled(),
    );

    rerender(<GenericCombatActionPanel encounter={buildEncounter(3)} {...props} />);
    fireEvent.change(screen.getByLabelText("Player-safe result"), {
      target: { value: "The gate rises." },
    });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Resolve action" })).toBeEnabled(),
    );
  });
});
