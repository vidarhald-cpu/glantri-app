// @vitest-environment happy-dom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { EncounterSession, ScenarioParticipant } from "@glantri/domain";

import { updateGenericCombatActionOnServer } from "@/lib/api/localServiceClient";
import { GenericCombatActionPanel } from "./GenericCombatActionPanel";

vi.mock("@/lib/api/localServiceClient", () => ({
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
});
