import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ScenarioParticipant } from "@glantri/domain";

const mocks = vi.hoisted(() => ({
  refreshEquipment: vi.fn(),
}));

vi.mock("@/lib/api/scenarioClient", () => ({
  refreshScenarioParticipantEquipmentOnServer: mocks.refreshEquipment,
  updateScenarioParticipantStateOnServer: vi.fn(),
}));

vi.mock("../../characters/[id]/components/CharacterLoadoutView", () => ({
  default: (props: { onEquipmentStateChange?: (state: unknown) => Promise<void> }) => (
    <button
      onClick={() => props.onEquipmentStateChange?.({ activeLoadoutByCharacterId: {} })}
      type="button"
    >
      Equip Broadsword
    </button>
  ),
}));

vi.mock("./WorkspaceParticipantInspectionHeader", () => ({
  default: () => <div>Character participant</div>,
}));

import CharacterWorkspacePanel from "./CharacterWorkspacePanel";

function makeParticipant(): ScenarioParticipant {
  return {
    characterId: "character-scyrian",
    controlledByUserId: "player-scyrian",
    createdAt: "2026-07-15T12:00:00.000Z",
    displayOrder: 0,
    factionId: null,
    id: "scenario-participant-scyrian",
    isActive: true,
    joinSource: "scenario_setup",
    role: "player_character",
    roleTag: null,
    scenarioId: "scenario-1",
    snapshot: {
      displayName: "Scyrian cavalry guy",
      equipmentState: {},
      sourceUpdatedAt: "2026-07-15T12:00:00.000Z",
    },
    sourceType: "character",
    state: {
      combat: { combatContext: { modifierBuckets: {} } },
      combatEffects: { effects: [], events: [] },
      equipment: {
        carriedItemIds: [],
        equippedItemIds: [],
        readyItemIds: [],
      },
      health: { currentHp: 10, maxHp: 10 },
      status: "active",
    },
    tacticalGroupId: null,
    updatedAt: "2026-07-15T12:00:00.000Z",
  } as unknown as ScenarioParticipant;
}

describe("CharacterWorkspacePanel scenario equipment ownership", () => {
  it("recommits an explicit GM loadout edit and publishes the refreshed participant", async () => {
    const participant = makeParticipant();
    const refreshedParticipant = {
      ...participant,
      snapshot: {
        ...participant.snapshot,
        equipmentState: { marker: "broadsword" },
      },
    };
    const onScenarioParticipantUpdated = vi.fn();
    mocks.refreshEquipment.mockResolvedValueOnce(refreshedParticipant);

    render(
      <CharacterWorkspacePanel
        isGameMaster
        onScenarioParticipantUpdated={onScenarioParticipantUpdated}
        scenarioId="scenario-1"
        scenarioParticipants={[participant]}
        selectedParticipantId={participant.id}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Equip Broadsword" }));

    await waitFor(() =>
      expect(mocks.refreshEquipment).toHaveBeenCalledWith({
        participantId: "scenario-participant-scyrian",
        scenarioId: "scenario-1",
      }),
    );
    expect(onScenarioParticipantUpdated).toHaveBeenCalledWith(refreshedParticipant);
    expect(
      await screen.findByText("Scyrian cavalry guy’s scenario equipment was refreshed."),
    ).toBeInTheDocument();
  });
});
