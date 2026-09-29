// @vitest-environment happy-dom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CombatGenericAction, EncounterSession } from "@glantri/domain";

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
              templateId: "weapon-dagger",
            },
          ],
          label: "Aster",
          participantId: "participant-1",
        },
      ],
      disarmTargets: [],
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
      disarmTargets: [],
      presentItems: [
        {
          category: "weapon",
          id: "hidden-technical-id",
          label: "Dropped dagger",
          operations: ["pickup"],
          revision: "2026-08-16T09:59:00.000Z",
          state: "present_unheld",
          templateId: "weapon-dagger",
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
              templateId: "weapon-dagger",
            },
          ],
          label: "Aster",
          participantId: "participant-1",
        },
      ],
      disarmTargets: [],
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

describe("CombatItemInteractionPanel — pending Item action state (Forgejo #409)", () => {
  const liveAction: CombatGenericAction = {
    createdAt: "2026-08-16T09:30:00.000Z",
    duration: { kind: "gm_decided" },
    id: "action-1",
    intent: "Draw / ready Silver dagger",
    itemInteraction: {
      itemId: "item-dagger",
      itemLabel: "Silver dagger",
      itemRevision: "2026-08-16T09:59:00.000Z",
      operation: "draw",
      stateAtDeclaration: "stowed",
      visibleToParticipantIds: ["participant-1"],
    },
    lastUpdatedAt: "2026-08-16T09:30:00.000Z",
    ownerParticipantId: "participant-1",
    preset: "item_interaction",
    progress: { completedRounds: 0 },
    reference: {
      itemId: "item-dagger",
      kind: "item",
      label: "Silver dagger",
      ownerParticipantId: "participant-1",
    },
    status: "declared",
  };

  function encounterWith(actions: CombatGenericAction[]): EncounterSession {
    return {
      ...encounter,
      combatRoundState: { genericActions: actions },
    } as unknown as EncounterSession;
  }

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
              operations: ["draw", "drop"],
              revision: "2026-08-16T09:59:00.000Z",
              state: "stowed",
              templateId: "weapon-dagger",
            },
          ],
          label: "Aster",
          participantId: "participant-1",
        },
      ],
      disarmTargets: [],
      presentItems: [],
      recipients: [],
    });
    vi.mocked(updateCombatItemInteractionOnServer).mockResolvedValue(encounter);
  });

  it.each([
    ["declared", "Waiting for GM review"],
    ["reviewed", "Reviewed — waiting to act"],
    ["active", "In progress"],
  ] as const)(
    "shows the %s Item action from canonical state, so it survives a reload",
    async (status, label) => {
      // A fresh mount with no prior interaction is exactly what a reload produces.
      render(
        <CombatItemInteractionPanel
          encounter={encounterWith([{ ...liveAction, status }])}
          isGm={false}
          onEncounterUpdated={vi.fn()}
          participantId="participant-1"
        />,
      );

      expect(
        await screen.findByText(`Pending Item action: Draw / ready Silver dagger — ${label}.`),
      ).toBeInTheDocument();
    },
  );

  it.each([["completed"], ["interrupted"], ["cancelled"]] as const)(
    "shows no pending state and frees the operations once the action is %s",
    async (status) => {
      render(
        <CombatItemInteractionPanel
          encounter={encounterWith([{ ...liveAction, status }])}
          isGm={false}
          onEncounterUpdated={vi.fn()}
          participantId="participant-1"
        />,
      );

      expect(await screen.findByRole("button", { name: "Silver dagger: Drop" })).toBeEnabled();
      expect(screen.queryByText(/Pending Item action/)).not.toBeInTheDocument();
    },
  );

  it("disables the operations while a live declaration exists, as a consequence of canonical state", async () => {
    render(
      <CombatItemInteractionPanel
        encounter={encounterWith([liveAction])}
        isGm={false}
        onEncounterUpdated={vi.fn()}
        participantId="participant-1"
      />,
    );

    expect(await screen.findByRole("button", { name: "Silver dagger: Drop" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Silver dagger: Draw / ready" })).toBeDisabled();
  });

  it("ignores another participant's live Item action", async () => {
    render(
      <CombatItemInteractionPanel
        encounter={encounterWith([{ ...liveAction, ownerParticipantId: "participant-2" }])}
        isGm={false}
        onEncounterUpdated={vi.fn()}
        participantId="participant-1"
      />,
    );

    expect(await screen.findByRole("button", { name: "Silver dagger: Drop" })).toBeEnabled();
    expect(screen.queryByText(/Pending Item action/)).not.toBeInTheDocument();
  });

  /**
   * The real M7 shape (Forgejo issue #323): a secondary `small_action` naming an Item carries
   * **both** `preset: "item_interaction"` and `declarationKind: "small_action"`. Under the Product
   * Owner ruling on #409 it is a Small Action involving an Item, not a guarded Item action — so the
   * panel must not label it a pending Item action and must not disable the operations, mirroring
   * the server, which does not refuse behind it either.
   */
  const m7SmallAction: CombatGenericAction = {
    ...liveAction,
    declarationKind: "small_action",
    id: "round-1:participant-1:declaration:small_action",
  };

  it("does not treat an M7 `small_action` that names an Item as a pending Item action", async () => {
    render(
      <CombatItemInteractionPanel
        encounter={encounterWith([m7SmallAction])}
        isGm={false}
        onEncounterUpdated={vi.fn()}
        participantId="participant-1"
      />,
    );

    expect(await screen.findByRole("button", { name: "Silver dagger: Drop" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Silver dagger: Draw / ready" })).toBeEnabled();
    expect(screen.queryByText(/Pending Item action/)).not.toBeInTheDocument();
  });

  it("still shows the genuine Item action beside an M7 `small_action` that names an Item", async () => {
    render(
      <CombatItemInteractionPanel
        encounter={encounterWith([m7SmallAction, liveAction])}
        isGm={false}
        onEncounterUpdated={vi.fn()}
        participantId="participant-1"
      />,
    );

    expect(
      await screen.findByText(
        "Pending Item action: Draw / ready Silver dagger — Waiting for GM review.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Silver dagger: Drop" })).toBeDisabled();
  });
});
