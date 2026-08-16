// @vitest-environment happy-dom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { EncounterSession } from "@glantri/domain";

import {
  loadCombatItemInteractionOptions,
  updateCombatItemInteractionOnServer,
} from "@/lib/api/localServiceClient";
import { CombatItemInteractionPanel } from "./CombatItemInteractionPanel";

vi.mock("@/lib/api/localServiceClient", () => ({
  loadCombatItemInteractionOptions: vi.fn(),
  updateCombatItemInteractionOnServer: vi.fn(),
}));

const encounter = {
  id: "encounter-1",
  updatedAt: "2026-08-16T10:00:00.000Z",
} as EncounterSession;

describe("CombatItemInteractionPanel", () => {
  beforeEach(() => {
    vi.mocked(loadCombatItemInteractionOptions).mockResolvedValue({
      actors: [
        {
          characterId: "character-1",
          items: [
            {
              category: "weapon",
              id: "item-dagger",
              label: "Silver dagger",
              operations: ["draw", "drop", "pass", "use"],
              revision: "2026-08-16T09:59:00.000Z",
              state: "held",
            },
          ],
          label: "Aster",
          participantId: "participant-1",
        },
      ],
      presentItems: [],
      recipients: [
        { label: "Aster", participantId: "participant-1" },
        { label: "Bram", participantId: "participant-2" },
      ],
    });
    vi.mocked(updateCombatItemInteractionOnServer).mockResolvedValue(encounter);
  });

  it("shows contextual Item state and declares exact Item/revision/recipient for GM review", async () => {
    render(
      <CombatItemInteractionPanel
        encounter={encounter}
        isGm={false}
        onEncounterUpdated={vi.fn()}
        participantId="participant-1"
      />,
    );

    expect(await screen.findByText("Silver dagger")).toBeInTheDocument();
    expect(screen.getByText("Held · On person")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Silver dagger: Draw / ready" })).toBeEnabled();
    const passButton = screen.getByRole("button", { name: "Silver dagger: Pass / give" });
    expect(passButton).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Pass Silver dagger to"), {
      target: { value: "participant-2" },
    });
    fireEvent.click(passButton);

    await waitFor(() => expect(updateCombatItemInteractionOnServer).toHaveBeenCalledTimes(1));
    expect(updateCombatItemInteractionOnServer).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedItemRevision: "2026-08-16T09:59:00.000Z",
        itemId: "item-dagger",
        itemOperation: "pass",
        operation: "declare",
        participantId: "participant-1",
        recipientParticipantId: "participant-2",
      }),
    );
  });

  it("renders present-unheld Items without exposing IDs and keeps use as GM-adjudicated intent", async () => {
    vi.mocked(loadCombatItemInteractionOptions).mockResolvedValueOnce({
      actors: [{ items: [], label: "Aster", participantId: "participant-1" }],
      presentItems: [
        {
          category: "weapon",
          id: "hidden-technical-id",
          label: "Dropped dagger",
          operations: ["pickup"],
          revision: "2026-08-16T09:59:00.000Z",
          state: "present_unheld",
        },
      ],
      recipients: [],
    });
    const { container } = render(
      <CombatItemInteractionPanel
        encounter={encounter}
        isGm={false}
        onEncounterUpdated={vi.fn()}
        participantId="participant-1"
      />,
    );

    expect(await screen.findByText("Present · Unheld")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Dropped dagger: Pick up" })).toBeEnabled();
    expect(container.textContent).not.toContain("hidden-technical-id");
  });

  it("renders only server-authorized pass recipients without hidden names, IDs, or counts", async () => {
    vi.mocked(loadCombatItemInteractionOptions).mockResolvedValueOnce({
      actors: [
        {
          characterId: "character-1",
          items: [
            {
              category: "weapon",
              id: "item-dagger",
              label: "Silver dagger",
              operations: ["pass"],
              revision: "2026-08-16T09:59:00.000Z",
              state: "held",
            },
          ],
          label: "Aster",
          participantId: "participant-1",
        },
      ],
      presentItems: [],
      recipients: [{ label: "Aster", participantId: "participant-1" }],
    });
    const { container } = render(
      <CombatItemInteractionPanel
        encounter={encounter}
        isGm={false}
        onEncounterUpdated={vi.fn()}
        participantId="participant-1"
      />,
    );

    const recipientSelect = await screen.findByLabelText("Pass Silver dagger to");
    expect(recipientSelect).toHaveTextContent("Choose participant");
    expect(recipientSelect.querySelectorAll("option")).toHaveLength(1);
    expect(container.textContent).not.toContain("Hidden Bram");
    expect(container.textContent).not.toContain("participant-2");
  });
});
