import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  encounterSessionSchema,
  initializeCombatRoundState,
  rollCombatRoundCombatExperience,
  setCombatRoundCombatExperienceDifficulty,
  type EncounterSession,
  type ScenarioParticipant,
} from "@glantri/domain";

const mocks = vi.hoisted(() => ({
  submitDeclaration: vi.fn(),
}));

vi.mock("@/lib/api/encounterClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/encounterClient")>();
  return {
    ...actual,
    submitCombatDeclarationOnServer: mocks.submitDeclaration,
  };
});

vi.mock("@/features/player-combat/playerCombatPhaseModel", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/features/player-combat/playerCombatPhaseModel")>();
  const reference = (input: {
    attackModeId: string;
    itemId: string;
    slot: "primary" | "secondary";
  }) => ({
    am: "C",
    am2: "C",
    attackMode: input.attackModeId === "mode-1" ? "Slash" : "Thrust",
    attackMode2: "Thrust",
    combinedDb: "13",
    combinedDm: "0",
    combinedParry: "9",
    combinedSourceName: "Long sword",
    crit: input.attackModeId === "mode-1" ? "FS" : "EP",
    crit2: "EP",
    damageClass: input.attackModeId === "mode-1" ? "edged" : "pointed",
    damageClass2: "pointed",
    db: "13",
    dmb: input.attackModeId === "mode-1" ? "5" : "3",
    dmb2: "3",
    dm: "0",
    initiative: "0",
    ob: input.attackModeId === "mode-1" ? "2" : "1",
    ob2: "1",
    parry: "9",
    secondCrit: "—",
    selectedWeapon: "Long sword",
    sourceAttackModeId: input.attackModeId,
    sourceItemId: input.itemId,
    sourceSlot: input.slot,
    sourceTemplateId: "weapon-template-longsword",
  });

  return {
    ...actual,
    buildPlayerCombatLoadoutSummary: vi.fn(
      (input: Parameters<typeof actual.buildPlayerCombatLoadoutSummary>[0]) => {
        const phase2 = input.actionId === "double_attack" && input.phaseKey === "phase2";
        const selectedAttackModeId =
          input.selectedAttackModeId ?? (phase2 ? "mode-2" : "mode-1");
        const selectedReference = reference({
          attackModeId: selectedAttackModeId,
          itemId: phase2 ? "long-sword-secondary" : "long-sword-primary",
          slot: phase2 ? "secondary" : "primary",
        });

        return {
          attackModeOptions: [
            {
              allowsRepeatedRoundAttack: false,
              id: "mode-1",
              label: "Slash",
            },
            {
              allowsRepeatedRoundAttack: false,
              id: "mode-2",
              label: "Thrust",
            },
          ],
          attackStats: {
            attackMode: selectedReference.am,
            dmb: selectedReference.dmb,
            initiative: selectedReference.initiative,
            maxCrits: selectedReference.crit,
            ob: selectedReference.ob,
            weaponName: selectedReference.selectedWeapon,
          },
          mainHandParryItemLabel: "Long sword",
          offHandParryItemLabel: "Unarmed",
          passiveInitiative: 0,
          reference: selectedReference,
          selectedAttackModeId,
          selectedAttackModeUsedFallback: input.selectedAttackModeId == null,
        };
      },
    ),
  };
});

import CombatRoundManagerPanel from "./CombatRoundManagerPanel";

function encounterParticipant(input: {
  id: string;
  label: string;
  scenarioParticipantId: string;
}) {
  return {
    declaration: {
      actionType: "none",
      defenseFocus: "none",
      defensePosture: "none",
      targetLocation: "any",
    },
    facing: "north",
    id: input.id,
    initiative: 0,
    label: input.label,
    order: 0,
    orientation: "neutral",
    participantType: "scenario",
    position: { x: 0, y: 0, zone: "center" },
    scenarioParticipantId: input.scenarioParticipantId,
  };
}

function buildEncounter(): EncounterSession {
  const encounter = encounterSessionSchema.parse({
    actionLog: [],
    createdAt: "2026-07-23T10:00:00.000Z",
    currentRound: 1,
    currentTurnIndex: 0,
    declarationsLocked: false,
    id: "encounter-double-attack-form",
    kind: "combat",
    participants: [
      encounterParticipant({
        id: "encounter-attacker",
        label: "The Gladiator",
        scenarioParticipantId: "scenario-attacker",
      }),
      encounterParticipant({
        id: "encounter-defender",
        label: "Scyrian cavalry guy",
        scenarioParticipantId: "scenario-defender",
      }),
    ],
    scenarioId: "scenario-1",
    status: "active",
    title: "Rendered Double Attack",
    turnOrderMode: "manual",
    updatedAt: "2026-07-23T10:00:00.000Z",
  });
  const combatExperienceOpen = setCombatRoundCombatExperienceDifficulty({
    difficulty: 26,
    state: initializeCombatRoundState({ encounter }),
  });
  const attackerResolved = rollCombatRoundCombatExperience({
    command: {
      createdAt: "2026-07-23T10:00:00.100Z",
      createdByUserId: "gm-1",
    },
    participantId: "encounter-attacker",
    rng: () => 0.6,
    skillTotal: 26,
    state: combatExperienceOpen,
  }).state;
  const declarationReady = rollCombatRoundCombatExperience({
    command: {
      createdAt: "2026-07-23T10:00:00.200Z",
      createdByUserId: "gm-1",
    },
    participantId: "encounter-defender",
    rng: () => 0.6,
    skillTotal: 26,
    state: attackerResolved,
  }).state;

  return encounterSessionSchema.parse({
    ...encounter,
    combatRoundState: declarationReady,
  });
}

function scenarioParticipant(input: {
  id: string;
  name: string;
  order: number;
}): ScenarioParticipant {
  return {
    controlledByUserId: `user-${input.id}`,
    createdAt: "2026-07-23T10:00:00.000Z",
    displayOrder: input.order,
    factionId: null,
    id: input.id,
    isActive: true,
    joinSource: "scenario_setup",
    role: "player_character",
    roleTag: null,
    scenarioId: "scenario-1",
    snapshot: {
      displayName: input.name,
      sourceUpdatedAt: "2026-07-23T10:00:00.000Z",
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
    updatedAt: "2026-07-23T10:00:00.000Z",
  } as unknown as ScenarioParticipant;
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("CombatRoundManagerPanel Double Attack declaration form", () => {
  it("renders and submits the explicit Phase 2 mode from the editable canonical context", async () => {
    const encounter = buildEncounter();
    const participants = [
      scenarioParticipant({ id: "scenario-attacker", name: "The Gladiator", order: 0 }),
      scenarioParticipant({ id: "scenario-defender", name: "Scyrian cavalry guy", order: 1 }),
    ];
    mocks.submitDeclaration.mockResolvedValue({
      encounter: {
        ...encounter,
        updatedAt: "2026-07-23T10:00:01.000Z",
      },
      participant: participants[0],
    });

    render(
      <CombatRoundManagerPanel encounter={encounter} scenarioParticipants={participants} />,
    );

    fireEvent.change(screen.getByRole("combobox", { name: "Action" }), {
      target: { value: "double_attack" },
    });

    const attackModeSelectors = await screen.findAllByRole("combobox", {
      name: "Attack mode",
    });
    expect(attackModeSelectors).toHaveLength(2);
    expect(attackModeSelectors[0]).toHaveValue("mode-1");
    expect(attackModeSelectors[1]).toHaveValue("mode-2");

    const targetSelectors = screen.getAllByRole("combobox", { name: "Target" });
    expect(targetSelectors).toHaveLength(2);
    for (const targetSelector of targetSelectors) {
      fireEvent.change(targetSelector, { target: { value: "encounter-defender" } });
    }

    fireEvent.click(screen.getByRole("button", { name: "Declare action" }));

    await waitFor(() => expect(mocks.submitDeclaration).toHaveBeenCalledTimes(1));
    expect(mocks.submitDeclaration.mock.calls[0]?.[0]).toMatchObject({
      actionId: "double_attack",
      phaseAttackSources: {
        phase1: {
          attackModeId: "mode-1",
          opportunitySlot: "attack_1",
          scenarioItemId: "long-sword-primary",
          slot: "primary",
        },
        phase2: {
          attackModeId: "mode-2",
          opportunitySlot: "attack_2",
          scenarioItemId: "long-sword-secondary",
          slot: "secondary",
        },
      },
      phaseContexts: {
        phase1: {
          attackModeId: "mode-1",
          targetParticipantId: "encounter-defender",
        },
        phase2: {
          attackModeId: "mode-2",
          targetParticipantId: "encounter-defender",
        },
      },
    });
  });
});
