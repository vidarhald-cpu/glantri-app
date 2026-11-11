import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ScenarioParticipant } from "@glantri/domain";

import { ApiRequestError } from "@/lib/api/apiClient";

const mocks = vi.hoisted(() => ({
  changeCombatEffects: vi.fn(),
  refreshEquipment: vi.fn(),
}));

vi.mock("@/lib/api/scenarioClient", () => ({
  changeScenarioParticipantCombatEffectsOnServer: mocks.changeCombatEffects,
  refreshScenarioParticipantEquipmentOnServer: mocks.refreshEquipment,
}));

vi.mock("@/features/equipment/components/PhysicalStateSection", () => ({
  PhysicalStateSection: (props: {
    canEditCombatEffects?: boolean;
    model: { generalHitpoints?: number | null };
    onDeleteCombatEffect?: (effectId: string) => Promise<void> | void;
    onSaveCombatEffect?: (draft: unknown) => Promise<void> | void;
  }) => (
    <div
      data-can-edit-combat-effects={String(Boolean(props.canEditCombatEffects))}
      data-testid="npc-physical-state-section"
    >
      <button
        onClick={() =>
          // Like the real section, a refused save leaves the draft in place.
          void Promise.resolve(
            props.onSaveCombatEffect?.({
              damage: 3,
              effectGroup: "damage",
              locationIds: ["chest"],
              status: "active",
              type: "physical_damage",
            }),
          ).catch(() => undefined)
        }
        type="button"
      >
        Save effect
      </button>
      <button onClick={() => void props.onDeleteCombatEffect?.("effect-old")} type="button">
        Delete effect
      </button>
    </div>
  ),
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
  // Like the real header, the selector is rendered only for the GM.
  default: (props: {
    candidates?: Array<{ id: string; label: string }>;
    isGameMaster: boolean;
  }) => (
    <div data-testid="inspection-header">
      Character participant
      {(props.isGameMaster ? (props.candidates ?? []) : []).map((candidate) => (
        <span data-testid="inspection-candidate" key={candidate.id}>
          {candidate.label}
        </span>
      ))}
    </div>
  ),
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

describe("CharacterWorkspacePanel GM review of a generated NPC (#1118)", () => {
  function makeNpc(): ScenarioParticipant {
    const base = makeParticipant();
    return makeParticipant({
      characterId: null,
      controlledByUserId: "gm-1",
      displayOrder: 1,
      id: "scenario-participant-garrison",
      role: "npc",
      snapshot: { ...base.snapshot, displayName: "Garrison Soldier 248" },
      sourceType: "entity",
      state: {
        ...base.state,
        combatEffects: {
          effects: [{ id: "effect-old", type: "physical_damage" }],
          events: [],
        },
        health: { currentHp: 12, maxHp: 12 },
      },
    } as unknown as Partial<ScenarioParticipant>);
  }

  it("lists the NPC for the GM and shows only its Physical state, with no loadout", () => {
    const character = makeParticipant();
    const npc = makeNpc();

    render(
      <CharacterWorkspacePanel
        isGameMaster
        scenarioId="scenario-1"
        scenarioParticipants={[character, npc]}
        selectedParticipantId={npc.id}
      />,
    );

    expect(screen.getAllByTestId("inspection-candidate").map((node) => node.textContent)).toEqual([
      "Scyrian cavalry guy",
      "Garrison Soldier 248",
    ]);
    expect(screen.getByTestId("npc-physical-state-section")).toHaveAttribute(
      "data-can-edit-combat-effects",
      "true",
    );
    expect(screen.queryByTestId("loadout-view")).toBeNull();
  });

  it("sends NPC combat-effect saves and removals as changes to the stored state", async () => {
    const npc = makeNpc();
    const onScenarioParticipantUpdated = vi.fn();
    mocks.changeCombatEffects.mockReset();
    mocks.changeCombatEffects.mockResolvedValue(npc);

    render(
      <CharacterWorkspacePanel
        activeEncounter={{ id: "encounter-1", participants: [], scenarioId: "scenario-1" } as never}
        isGameMaster
        onScenarioParticipantUpdated={onScenarioParticipantUpdated}
        scenarioId="scenario-1"
        scenarioParticipants={[npc]}
        selectedParticipantId={npc.id}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Save effect" }));
    await waitFor(() => expect(mocks.changeCombatEffects).toHaveBeenCalledTimes(1));
    const saved = mocks.changeCombatEffects.mock.calls[0]![0] as {
      change: { effects: unknown[]; event: unknown; kind: string; previousEffect?: unknown };
      participantId: string;
      scenarioId: string;
      state?: unknown;
    };
    expect(saved.participantId).toBe("scenario-participant-garrison");
    expect(saved.scenarioId).toBe("scenario-1");
    // Only the new effect and its event travel; the stored effect-old is not resent.
    expect(saved.state).toBeUndefined();
    expect(saved.change.kind).toBe("save_effect");
    expect(saved.change.previousEffect).toBeUndefined();
    expect(saved.change.effects).toEqual([
      expect.objectContaining({
        damage: 3,
        location: "chest",
        targetParticipantId: "scenario-participant-garrison",
      }),
    ]);
    expect(saved.change.event).toMatchObject({
      encounterId: "encounter-1",
      scenarioId: "scenario-1",
      targetParticipantId: "scenario-participant-garrison",
    });
    expect(onScenarioParticipantUpdated).toHaveBeenCalledWith(npc);

    fireEvent.click(screen.getByRole("button", { name: "Delete effect" }));
    await waitFor(() => expect(mocks.changeCombatEffects).toHaveBeenCalledTimes(2));
    expect(mocks.changeCombatEffects.mock.calls[1]![0]).toEqual({
      change: { effectId: "effect-old", kind: "remove_effect" },
      participantId: "scenario-participant-garrison",
      scenarioId: "scenario-1",
    });
  });

  it("shows the participant as it is now, and the message, when the server refuses a stale edit", async () => {
    const npc = makeNpc();
    const current = { ...npc, updatedAt: "2026-07-15T12:05:00.000Z" } as ScenarioParticipant;
    const message =
      "This combatant changed meanwhile; the screen has been refreshed, please apply your change again.";
    const onScenarioParticipantUpdated = vi.fn();
    mocks.changeCombatEffects.mockReset();
    mocks.changeCombatEffects.mockRejectedValue(
      new ApiRequestError(message, 409, {
        code: "participant_state_changed",
        error: message,
        participant: current,
      }),
    );

    render(
      <CharacterWorkspacePanel
        isGameMaster
        onScenarioParticipantUpdated={onScenarioParticipantUpdated}
        scenarioId="scenario-1"
        scenarioParticipants={[npc]}
        selectedParticipantId={npc.id}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Save effect" }));
    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(onScenarioParticipantUpdated).toHaveBeenCalledWith(current);
  });

  it("never offers a player the NPC, even when the NPC is controlled by their user id", () => {
    const character = makeParticipant();
    const npc = makeNpc();

    for (const userId of ["player-scyrian", "gm-1"]) {
      const view = render(
        <CharacterWorkspacePanel
          currentUserId={userId}
          isGameMaster={false}
          scenarioId="scenario-1"
          scenarioParticipants={[character, npc]}
          selectedParticipantId={npc.id}
        />,
      );

      expect(screen.queryByTestId("inspection-candidate")).toBeNull();
      expect(screen.queryByTestId("npc-physical-state-section")).toBeNull();
      expect(screen.queryByText("Garrison Soldier 248")).toBeNull();
      view.unmount();
    }
  });
});
