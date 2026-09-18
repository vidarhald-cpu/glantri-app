// @vitest-environment happy-dom

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CombatGenericAction, EncounterSession, ScenarioParticipant } from "@glantri/domain";

import {
  loadCombatItemInteractionOptions,
  updateCombatItemInteractionOnServer,
  updateGenericCombatActionOnServer,
} from "@/lib/api/localServiceClient";
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

const canonicalDrop: CombatGenericAction = {
  createdAt: "2026-08-14T09:00:00.000Z",
  duration: { kind: "gm_decided" },
  id: "canonical-drop",
  intent: "Drop the silver dagger.",
  itemInteraction: {
    itemId: "canonical-dagger",
    itemLabel: "Silver dagger",
    itemRevision: "2026-08-14T08:00:00.000Z",
    operation: "drop",
    stateAtDeclaration: "held",
    visibleToParticipantIds: ["encounter-aster"],
  },
  lastUpdatedAt: "2026-08-14T09:00:00.000Z",
  ownerParticipantId: "encounter-aster",
  preset: "item_interaction",
  progress: { completedRounds: 0 },
  reference: {
    itemId: "canonical-dagger",
    kind: "item",
    label: "Silver dagger",
    ownerParticipantId: "encounter-aster",
  },
  status: "declared",
};

function withActions(...actions: CombatGenericAction[]): EncounterSession {
  return {
    ...encounter,
    combatRoundState: {
      ...encounter.combatRoundState,
      genericActions: actions,
    },
  } as EncounterSession;
}

describe("GenericCombatActionPanel", () => {
  beforeEach(() => {
    vi.mocked(loadCombatItemInteractionOptions).mockReset();
    vi.mocked(loadCombatItemInteractionOptions).mockImplementation(
      () => new Promise(() => undefined),
    );
    vi.mocked(updateCombatItemInteractionOnServer).mockReset();
    vi.mocked(updateCombatItemInteractionOnServer).mockResolvedValue(encounter);
    vi.mocked(updateGenericCombatActionOnServer).mockReset();
    vi.mocked(updateGenericCombatActionOnServer).mockResolvedValue(encounter);
  });

  it.each(["initial", "same value", "fallback"])(
    "keeps a canonical Drop reviewable after %s selection with its edited duration",
    async (selection) => {
      const props = {
        isGm: true,
        onEncounterUpdated: vi.fn(),
        scenarioParticipants: [scenarioParticipant],
      };
      const { rerender } = render(
        <GenericCombatActionPanel encounter={withActions()} {...props} />,
      );
      rerender(<GenericCombatActionPanel encounter={withActions(canonicalDrop)} {...props} />);
      const review = screen.getByRole("button", { name: "Review action" });
      await waitFor(() => expect(review).toBeEnabled());
      expect(screen.getByLabelText("Reviewed duration")).toHaveValue("gm_decided");
      expect(screen.queryByLabelText("Reviewed Item")).toBeNull();
      expect(screen.queryByLabelText("Reviewed reference")).toBeNull();
      fireEvent.change(screen.getByLabelText("Reviewed duration"), {
        target: { value: "rounds" },
      });
      fireEvent.change(screen.getByLabelText("Reviewed rounds"), { target: { value: "3" } });
      if (selection !== "initial") {
        fireEvent.change(screen.getByLabelText("Action and task history"), {
          target: { value: selection === "same value" ? canonicalDrop.id : "" },
        });
      }
      expect(review).toBeEnabled();
      expect(screen.getByLabelText("Reviewed rounds")).toHaveValue(3);
      fireEvent.click(review);
      await waitFor(() => expect(updateCombatItemInteractionOnServer).toHaveBeenCalledTimes(1));
      expect(updateCombatItemInteractionOnServer).toHaveBeenCalledWith({
        actionId: canonicalDrop.id,
        duration: { kind: "rounds", rounds: 3 },
        encounterId: encounter.id,
        expectedRevision: encounter.updatedAt,
        operation: "review",
        resultText: undefined,
        visibleToParticipantIds: undefined,
      });
      expect(updateGenericCombatActionOnServer).not.toHaveBeenCalled();
    },
  );

  it("keeps canonical review busy and reports a stale revision without advancing the encounter", async () => {
    let rejectReview!: (error: Error) => void;
    vi.mocked(updateCombatItemInteractionOnServer).mockReturnValue(
      new Promise((_resolve, reject) => {
        rejectReview = reject;
      }),
    );
    const onEncounterUpdated = vi.fn();
    render(
      <GenericCombatActionPanel
        encounter={withActions(canonicalDrop)}
        isGm
        onEncounterUpdated={onEncounterUpdated}
        scenarioParticipants={[scenarioParticipant]}
      />,
    );
    const review = screen.getByRole("button", { name: "Review action" });
    fireEvent.click(review);
    expect(review).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Action and task history"), {
      target: { value: canonicalDrop.id },
    });
    fireEvent.click(review);
    expect(updateCombatItemInteractionOnServer).toHaveBeenCalledTimes(1);
    rejectReview(
      new Error("The canonical Item action changed. Refresh and review the latest state."),
    );
    await screen.findByText(
      "The canonical Item action changed. Refresh and review the latest state.",
    );
    expect(onEncounterUpdated).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Reviewed duration")).toHaveValue("gm_decided");
  });

  it("does not offer GM review to a player", () => {
    render(
      <GenericCombatActionPanel
        encounter={withActions(canonicalDrop)}
        isGm={false}
        onEncounterUpdated={vi.fn()}
        participantId="encounter-aster"
        scenarioParticipants={[scenarioParticipant]}
      />,
    );
    fireEvent.change(screen.getByLabelText("Action and task history"), {
      target: { value: canonicalDrop.id },
    });
    expect(screen.queryByRole("button", { name: "Review action" })).toBeNull();
    expect(updateCombatItemInteractionOnServer).not.toHaveBeenCalled();
  });

  it("keeps a submitted player Item pending and readable at narrow width without generic controls", async () => {
    vi.mocked(loadCombatItemInteractionOptions).mockResolvedValue({
      actors: [
        {
          items: [
            {
              category: "weapon",
              id: "canonical-dagger",
              label: "Silver dagger",
              operations: ["drop"],
              revision: "2026-08-14T08:00:00.000Z",
              state: "held",
              templateId: "weapon-dagger",
            },
          ],
          label: "Aster",
          participantId: "encounter-aster",
        },
      ],
      disarmTargets: [],
      presentItems: [],
      recipients: [],
    });
    const submittedEncounter = withActions(canonicalDrop);
    vi.mocked(updateCombatItemInteractionOnServer).mockResolvedValue(submittedEncounter);
    const onEncounterUpdated = vi.fn();
    const props = {
      isGm: false,
      onEncounterUpdated,
      participantId: "encounter-aster",
      scenarioParticipants: [scenarioParticipant],
      showGenericDeclarationControls: false,
    };
    const { rerender } = render(<GenericCombatActionPanel encounter={encounter} {...props} />);

    fireEvent.click(await screen.findByRole("button", { name: "Silver dagger: Drop" }));
    await waitFor(() => expect(onEncounterUpdated).toHaveBeenCalledWith(submittedEncounter));
    rerender(<GenericCombatActionPanel encounter={submittedEncounter} {...props} />);

    const panel = screen.getByRole("region", { name: "Items and task history" });
    expect(panel.getAttribute("style")).toContain("max-width: calc(100vw - 3rem)");
    expect(panel.getAttribute("style")).toContain("min-width: 0");
    expect(screen.getByLabelText("Action and task history")).toHaveTextContent(
      "Waiting for GM review — Drop the silver dagger.",
    );
    expect(screen.getAllByText("Waiting for GM review", { exact: false }).length).toBeGreaterThan(
      0,
    );
    expect(screen.queryByLabelText("Generic action")).toBeNull();
    expect(screen.queryByLabelText("What do you intend to do?")).toBeNull();
    expect(screen.queryByRole("button", { name: "Declare generic action" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Review action" })).toBeNull();
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
      target: { value: "   " },
    });
    fireEvent.change(screen.getByLabelText("Action and task history"), {
      target: { value: "action-review" },
    });
    expect(screen.getByRole("button", { name: "Review action" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Review action" }));
    expect(updateGenericCombatActionOnServer).not.toHaveBeenCalled();
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
    fireEvent.change(selector, { target: { value: "action-no-roll" } });
    expect(screen.getByLabelText("Player-safe result")).toHaveValue(
      "This belongs only to the door action.",
    );
    expect(screen.getByRole("checkbox", { name: "Aster" })).toBeChecked();
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
