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
  default: (props: {
    canEditCombatEffects?: boolean;
    characterId: string;
    onCombatEffectsChange?: unknown;
    onEquipmentStateChange?: (state: unknown) => Promise<void>;
    physicalStateEncounterId?: string;
    physicalStateCurrentRoundNumber?: number;
    showPhysicalState?: boolean;
  }) => (
    <div
      data-can-edit-combat-effects={String(Boolean(props.canEditCombatEffects))}
      data-character-id={props.characterId}
      data-combat-effects-handler={String(props.onCombatEffectsChange !== undefined)}
      data-encounter-id={props.physicalStateEncounterId ?? ""}
      data-equipment-handler={String(props.onEquipmentStateChange !== undefined)}
      data-round-number={String(props.physicalStateCurrentRoundNumber ?? "")}
      data-show-physical-state={String(Boolean(props.showPhysicalState))}
      data-testid="loadout-view"
    >
      <button
        onClick={() => props.onEquipmentStateChange?.({ activeLoadoutByCharacterId: {} })}
        type="button"
      >
        Equip Broadsword
      </button>
    </div>
  ),
}));

vi.mock("./WorkspaceParticipantInspectionHeader", () => ({
  default: () => <div>Character participant</div>,
}));

import CharacterWorkspacePanel from "./CharacterWorkspacePanel";

function makeParticipant(overrides: Partial<ScenarioParticipant> = {}): ScenarioParticipant {
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
    ...overrides,
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
      await screen.findByText("Scyrian cavalry guy’s Scenario equipment was reconciled."),
    ).toBeInTheDocument();
  });
});

describe("CharacterWorkspacePanel canonical Character click-through", () => {
  it("gives a player click-through to their own Character sheet and equipment", () => {
    const participant = makeParticipant();

    render(
      <CharacterWorkspacePanel
        currentUserId="player-scyrian"
        isGameMaster={false}
        scenarioId="scenario-1"
        scenarioParticipants={[participant]}
      />,
    );

    expect(screen.getByRole("link", { name: "Open the full character sheet" })).toHaveAttribute(
      "href",
      "/characters/character-scyrian",
    );
    expect(screen.getByRole("link", { name: "Open the full equipment inventory" })).toHaveAttribute(
      "href",
      "/characters/character-scyrian/equipment",
    );
  });

  it("never offers a player a click-through to another player's Character", () => {
    const ownCharacter = makeParticipant();
    const otherCharacter = makeParticipant({
      characterId: "character-otherplayer",
      controlledByUserId: "player-other",
      displayOrder: 1,
      id: "scenario-participant-other",
    } as Partial<ScenarioParticipant>);

    render(
      <CharacterWorkspacePanel
        currentUserId="player-scyrian"
        isGameMaster={false}
        scenarioId="scenario-1"
        scenarioParticipants={[ownCharacter, otherCharacter]}
        selectedParticipantId="scenario-participant-other"
      />,
    );

    for (const link of screen.getAllByRole("link")) {
      expect(link.getAttribute("href")).not.toContain("character-otherplayer");
    }
    expect(screen.getByTestId("loadout-view")).toHaveAttribute(
      "data-character-id",
      "character-scyrian",
    );
  });

  it("leaves the GM view unchanged — no click-through and every GM affordance intact", () => {
    const participant = makeParticipant();

    render(
      <CharacterWorkspacePanel
        isGameMaster
        scenarioId="scenario-1"
        scenarioParticipants={[participant]}
        selectedParticipantId={participant.id}
      />,
    );

    expect(screen.queryByTestId("character-play-canonical-detail")).toBeNull();
    expect(screen.queryByRole("link", { name: "Open the full character sheet" })).toBeNull();

    const loadout = screen.getByTestId("loadout-view");
    expect(loadout).toHaveAttribute("data-can-edit-combat-effects", "true");
    expect(loadout).toHaveAttribute("data-combat-effects-handler", "true");
    expect(loadout).toHaveAttribute("data-equipment-handler", "true");
  });

  it("withholds every GM mutation affordance from a player", () => {
    const participant = makeParticipant();

    render(
      <CharacterWorkspacePanel
        currentUserId="player-scyrian"
        isGameMaster={false}
        scenarioId="scenario-1"
        scenarioParticipants={[participant]}
      />,
    );

    const loadout = screen.getByTestId("loadout-view");
    expect(loadout).toHaveAttribute("data-can-edit-combat-effects", "false");
    expect(loadout).toHaveAttribute("data-combat-effects-handler", "false");
    expect(loadout).toHaveAttribute("data-equipment-handler", "false");
  });

  it("reflects the active Encounter in the same Character UI rather than a second one", () => {
    const participant = makeParticipant();
    const activeEncounter = {
      id: "encounter-1",
      participants: [
        {
          characterId: "character-scyrian",
          scenarioParticipantId: "scenario-participant-scyrian",
        },
      ],
      scenarioId: "scenario-1",
    } as never;

    const withoutEncounter = render(
      <CharacterWorkspacePanel
        currentUserId="player-scyrian"
        isGameMaster={false}
        scenarioId="scenario-1"
        scenarioParticipants={[participant]}
      />,
    );

    expect(screen.getByTestId("loadout-view")).toHaveAttribute("data-encounter-id", "");
    withoutEncounter.unmount();

    render(
      <CharacterWorkspacePanel
        activeEncounter={activeEncounter}
        currentRoundNumber={4}
        currentUserId="player-scyrian"
        isGameMaster={false}
        scenarioId="scenario-1"
        scenarioParticipants={[participant]}
      />,
    );

    const loadout = screen.getByTestId("loadout-view");
    expect(loadout).toHaveAttribute("data-encounter-id", "encounter-1");
    expect(loadout).toHaveAttribute("data-round-number", "4");
    expect(loadout).toHaveAttribute("data-show-physical-state", "true");
    expect(screen.getByRole("link", { name: "Open the full equipment inventory" })).toHaveAttribute(
      "href",
      "/characters/character-scyrian/equipment",
    );
  });
});
