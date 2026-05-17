import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { EncounterParticipant, RoleplayState } from "@glantri/domain";

import { ParticipantDescriptionsSection } from "./RoleplaySections";

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
    visibility: {},
  };
}

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
    const shortDescription = screen.getByLabelText("The Gladiator short description") as HTMLInputElement;
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
    expect((screen.getByLabelText("The Gladiator detailed description") as HTMLTextAreaElement).value).toBe(
      "Refreshed detailed description",
    );
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

    expect((screen.getByLabelText("The Gladiator short description") as HTMLInputElement).value).toBe(
      "Fresh server description",
    );
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
    const shortDescription = screen.getByLabelText("The Gladiator short description") as HTMLInputElement;
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
