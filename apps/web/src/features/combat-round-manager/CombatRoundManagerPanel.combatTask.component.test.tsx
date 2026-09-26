import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  advanceCombatRoundStep,
  advanceCombatTaskAtOpportunity,
  buildCombatProgressionProjection,
  combatRoundStateSchema,
  commitCombatRoundPhaseInitiativeResolution,
  declareCombatGenericAction,
  encounterSessionSchema,
  finishCombatTaskAtOpportunity,
  getCombatTaskScheduledPhase,
  getCurrentExecutableCombatTasks,
  initializeCombatRoundState,
  recordCombatRoundDeclaration,
  resolveCombatTaskAtOpportunity,
  reviewCombatTaskAtOpportunity,
  rollCombatRoundCombatExperience,
  rollCombatTaskAtOpportunity,
  setCombatRoundCombatExperienceDifficulty,
  setCombatRoundParticipantInitiative,
  type CombatGenericActionDuration,
  type CombatRoundState,
  type EncounterSession,
  type ScenarioParticipant,
} from "@glantri/domain";

/**
 * GM Combat Task command wiring — Forgejo issue #340.
 *
 * Every test in this file runs with `GenericCombatActionPanel` **unmounted**, which is the explicit
 * A3 unblock condition in [Combat Panel Contract §12.15](../../../../docs/product/combat-panel-contract.md)
 * checks P1 and P2. The panel is not modified or deleted here — A3 owns that single deletion commit;
 * this file proves the GM needs nothing from it.
 *
 * The lifecycle is driven through the real Combat Inspector UI against the **real domain commands**:
 * the fake transport below applies `reviewCombatTaskAtOpportunity`, `rollCombatTaskAtOpportunity`,
 * `advanceCombatTaskAtOpportunity`, `resolveCombatTaskAtOpportunity` and
 * `finishCombatTaskAtOpportunity` exactly as `POST /combat-round/*-combat-task` applies them, so no
 * hand-built post-command state is asserted against.
 */

const mocks = vi.hoisted(() => ({
  advanceDeterministic: vi.fn(),
  loadCharacterEquipmentState: vi
    .fn()
    .mockRejectedValue(new Error("Inspector combat loadout is not served in component tests.")),
  loadEncounter: vi.fn(),
  loadEncounterItems: vi.fn().mockResolvedValue({ availableItems: [], items: [] }),
  loadItemOptions: vi.fn().mockResolvedValue(undefined),
  loadParticipants: vi.fn(),
  loadServerCharacterById: vi
    .fn()
    .mockRejectedValue(new Error("Inspector combat loadout is not served in component tests.")),
  sendTaskLifecycle: vi.fn(),
}));

vi.mock("@/lib/api/encounterClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/encounterClient")>();
  return {
    ...actual,
    advanceDeterministicCombatOnServer: mocks.advanceDeterministic,
    loadCombatItemInteractionOptions: mocks.loadItemOptions,
    loadEncounterById: mocks.loadEncounter,
    sendCombatTaskLifecycleCommandOnServer: mocks.sendTaskLifecycle,
  };
});

vi.mock("@/lib/api/localServiceClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/localServiceClient")>();
  return {
    ...actual,
    loadCharacterEquipmentState: mocks.loadCharacterEquipmentState,
    loadEncounterItems: mocks.loadEncounterItems,
    loadServerCharacterById: mocks.loadServerCharacterById,
  };
});

vi.mock("@/lib/api/scenarioClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/scenarioClient")>();
  return {
    ...actual,
    loadScenarioParticipants: mocks.loadParticipants,
  };
});

// A3, Forgejo issue #335: `GenericCombatActionPanel` is deleted, so every GM capability proved
// below is necessarily reached without it. The mock this file used to need is gone with it.

import CombatRoundManagerPanel from "./CombatRoundManagerPanel";

mocks.advanceDeterministic.mockImplementation(
  async (input: { currentEncounter: EncounterSession }) => ({
    encounter: input.currentEncounter,
    executedTaskIds: [],
    participants: [],
    stopReason: "blocked_or_human_work" as const,
  }),
);

const TASK_ID = "round:1:participant:encounter-owner:declaration:perform_task";
const OWNER = "encounter-owner";
const OTHER = "encounter-other";

function encounterParticipant(input: { id: string; label: string; scenarioParticipantId: string }) {
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

function scenarioParticipant(input: {
  id: string;
  name: string;
  order: number;
}): ScenarioParticipant {
  return {
    controlledByUserId: `user-${input.id}`,
    createdAt: "2026-09-26T10:00:00.000Z",
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
      equipmentState: {
        activeLoadoutByCharacterId: { [input.id]: { activeAmmoItemIds: [] } },
        itemsById: {
          "owner-crowbar": { displayName: "Crowbar", id: "owner-crowbar", name: "Crowbar" },
        },
        locationsById: {},
        templatesById: {},
      },
      sourceUpdatedAt: "2026-09-26T10:00:00.000Z",
    },
    sourceType: "character",
    state: {
      combat: {
        combatContext: {
          modifierBuckets: {
            general: [],
            situationDb: [],
            situationInitiative: [],
            situationObSkill: [],
          },
        },
      },
      combatEffects: { effects: [], events: [] },
      equipment: { carriedItemIds: [], equippedItemIds: [], readyItemIds: [] },
      health: { currentHp: 10, maxHp: 10 },
      status: "active",
    },
    tacticalGroupId: null,
    updatedAt: "2026-09-26T10:00:00.000Z",
  } as unknown as ScenarioParticipant;
}

/**
 * A declared Perform Task holding its owner's Phase 1 primary-action opportunity, reached the way
 * production reaches it: Combat Experience resolved, both participants declared through
 * `recordCombatRoundDeclaration`, initiative set and the Phase 1 initiative resolution committed.
 * The generic action carries exactly the shape `materializeCombatDeclarationTasks` mints — the
 * canonical server-owned id, `declarationKind: "perform_task"`, a `gm_decided` duration and
 * `declared` status — written through the same `declareCombatGenericAction` the route calls.
 */
function buildDeclaredTaskEncounter(): EncounterSession {
  const base = encounterSessionSchema.parse({
    actionLog: [],
    createdAt: "2026-09-26T10:00:00.000Z",
    currentRound: 1,
    currentTurnIndex: 0,
    declarationsLocked: false,
    id: "encounter-1",
    kind: "combat",
    participants: [
      encounterParticipant({
        id: OWNER,
        label: "The Gladiator",
        scenarioParticipantId: "scenario-owner",
      }),
      encounterParticipant({
        id: OTHER,
        label: "City guard",
        scenarioParticipantId: "scenario-other",
      }),
    ],
    scenarioId: "scenario-1",
    status: "active",
    title: "GM Combat Task wiring",
    turnOrderMode: "manual",
    updatedAt: "2026-09-26T10:02:00.000Z",
  });
  const combatExperienceOpen = setCombatRoundCombatExperienceDifficulty({
    difficulty: 26,
    state: initializeCombatRoundState({ encounter: base }),
  });
  const ownerResolved = rollCombatRoundCombatExperience({
    command: { createdAt: "2026-09-26T10:00:00.100Z", createdByUserId: "gm-1" },
    participantId: OWNER,
    rng: () => 0.6,
    skillTotal: 26,
    state: combatExperienceOpen,
  }).state;
  const declarationReady = rollCombatRoundCombatExperience({
    command: { createdAt: "2026-09-26T10:00:00.200Z", createdByUserId: "gm-1" },
    participantId: OTHER,
    rng: () => 0.6,
    skillTotal: 26,
    state: ownerResolved,
  }).state;
  const withTask = combatRoundStateSchema.parse({
    ...declarationReady,
    genericActions: declareCombatGenericAction({
      action: {
        createdAt: "2026-09-26T10:01:00.000Z",
        createdByUserId: "user-scenario-owner",
        declarationKind: "perform_task",
        duration: { kind: "gm_decided" },
        id: TASK_ID,
        intent: "Force the portcullis winch.",
        ownerParticipantId: OWNER,
      },
      actions: declarationReady.genericActions,
    }),
  });
  return encounterSessionSchema.parse({
    ...base,
    combatRoundState: driveToPerformTaskOpportunity({
      at: "2026-09-26T10:01:00.000Z",
      state: withTask,
    }),
    updatedAt: "2026-09-26T10:02:00.000Z",
  });
}

function emptyModifierBuckets() {
  return {
    general: [],
    situationDb: [],
    situationInitiative: [],
    situationObSkill: [],
  };
}

/**
 * Drives the real round machinery from an open declaration step to the owner's Phase 1
 * primary-action opportunity: both participants declare, initiative is set, and the Phase 1
 * initiative resolution is committed. The owner re-declares the Perform Task by its carried
 * `taskId`, exactly as production carry-forward does.
 */
function driveToPerformTaskOpportunity(input: {
  at: string;
  state: CombatRoundState;
}): CombatRoundState {
  const roundNumber = input.state.roundNumber;
  const ownerDeclared = recordCombatRoundDeclaration({
    command: { createdAt: input.at, createdByUserId: "gm-1" },
    declaration: {
      actionId: "perform_task",
      combatContext: { modifierBuckets: emptyModifierBuckets() },
      id: `declaration:owner:${roundNumber}`,
      intent: {
        primaryAction: {
          actionId: "perform_task",
          description: "Force the portcullis winch.",
          taskId: TASK_ID,
        },
        relativePositions: [],
      },
      roundNumber,
      submittedAt: input.at,
    },
    participantId: OWNER,
    state: input.state,
    submittedBy: "player",
  });
  const bothDeclared = recordCombatRoundDeclaration({
    command: { createdAt: input.at, createdByUserId: "gm-1" },
    declaration: {
      actionId: "pass",
      combatContext: { modifierBuckets: emptyModifierBuckets() },
      id: `declaration:other:${roundNumber}`,
      roundNumber,
      submittedAt: input.at,
    },
    participantId: OTHER,
    state: ownerDeclared,
    submittedBy: "gm",
  });
  let atInitiative = bothDeclared;
  for (let guard = 0; guard < 20 && atInitiative.currentStep !== "initiative_phase_1"; guard += 1) {
    atInitiative = advanceCombatRoundStep(atInitiative);
  }
  const withInitiative = [OWNER, OTHER].reduce(
    (current, participantId, index) =>
      setCombatRoundParticipantInitiative({
        initiative: {
          baseInitiative: 0,
          modifierAdjustment: 0,
          rolls: [index === 0 ? 6 : 4],
          rollTotal: index === 0 ? 6 : 4,
          total: index === 0 ? 6 : 4,
        },
        participantId,
        phase: "phase1",
        state: current,
      }),
    atInitiative,
  );
  const committedState = commitCombatRoundPhaseInitiativeResolution({
    command: { createdAt: input.at, createdByUserId: "gm-1" },
    phase: "phase1",
    state: withInitiative,
    visibility: { [OTHER]: { [OWNER]: true }, [OWNER]: { [OTHER]: true } },
  }).state;
  return committedState;
}

function participants(): ScenarioParticipant[] {
  return [
    scenarioParticipant({ id: "scenario-owner", name: "The Gladiator", order: 0 }),
    scenarioParticipant({ id: "scenario-other", name: "City guard", order: 1 }),
  ];
}

interface LifecyclePayload {
  actionId: string;
  boundary?: "declaration" | "opportunity";
  difficulty?: number;
  duration?: CombatGenericActionDuration;
  environmentDescription?: string;
  finishKind?: "cancel" | "interrupt";
  itemId?: string;
  operation: "advance" | "finish" | "resolve" | "review" | "roll";
  referenceKind?: "none" | "participant" | "item" | "environment";
  referenceParticipantId?: string;
  resultText?: string;
  rollKind?: "none" | "skill" | "stat";
  scenarioParticipantId: string;
  skillId?: string;
  statId?: string;
  visibleToParticipantIds?: readonly string[];
}

/**
 * The fake transport. It applies the real domain command for the requested operation, so the state
 * the UI then renders is the production state machine's, not a fixture's idea of it.
 */
function createServer(initial: EncounterSession) {
  let current = initial;
  let clock = 0;
  mocks.sendTaskLifecycle.mockImplementation(async (payload: LifecyclePayload) => {
    clock += 1;
    const updatedAt = `2026-09-26T10:1${clock}:00.000Z`;
    const state = combatRoundStateSchema.parse(current.combatRoundState);
    const action = state.genericActions.find((candidate) => candidate.id === payload.actionId);
    if (!action) throw new Error("This Combat Task is no longer available.");
    const phase = getCombatTaskScheduledPhase(payload.duration ?? action.duration);
    const command = { createdAt: updatedAt, createdByUserId: "user-gm" };
    const applied =
      payload.operation === "review"
        ? reviewCombatTaskAtOpportunity({
            actionId: action.id,
            command,
            duration: payload.duration ?? action.duration,
            participantId: OWNER,
            phase,
            reference:
              payload.referenceKind === "participant"
                ? {
                    kind: "participant",
                    label: "City guard",
                    participantId: payload.referenceParticipantId!,
                  }
                : payload.referenceKind === "item"
                  ? {
                      itemId: payload.itemId!,
                      kind: "item",
                      label: "Crowbar",
                      ownerParticipantId: OWNER,
                    }
                  : payload.referenceKind === "environment"
                    ? { description: payload.environmentDescription!, kind: "environment" }
                    : undefined,
            rollRequest:
              payload.rollKind === "stat"
                ? {
                    basis: {
                      baseValue: 14,
                      kind: "stat",
                      statId: payload.statId as "dex",
                      statLabel: "Dexterity",
                    },
                    difficulty: payload.difficulty!,
                  }
                : payload.rollKind === "skill"
                  ? {
                      basis: {
                        avgStats: 10,
                        baseValue: 20,
                        derivedXp: 0,
                        groupXp: 0,
                        kind: "skill",
                        skillId: payload.skillId!,
                        skillLabel: payload.skillId!,
                        skillXp: 20,
                        unknownSkillPenalty: 0,
                      },
                      difficulty: payload.difficulty!,
                    }
                  : undefined,
            state,
            updatedAt,
          })
        : payload.operation === "roll"
          ? rollCombatTaskAtOpportunity({
              actionId: action.id,
              command,
              participantId: OWNER,
              phase,
              result: {
                achievedLevelId: "success",
                achievedLevelLabel: "Success",
                calculationText: "14 + 12 = 26",
                dieResult: 12,
                finalTotal: 26,
                openEndedD10s: [],
                rollD20: 12,
                rolledAt: updatedAt,
                success: true,
              },
              state,
              updatedAt,
            })
          : payload.operation === "advance"
            ? advanceCombatTaskAtOpportunity({
                actionId: action.id,
                command,
                participantId: OWNER,
                phase,
                state,
                submittedBy: "gm",
                updatedAt,
              })
            : payload.operation === "resolve"
              ? resolveCombatTaskAtOpportunity({
                  actionId: action.id,
                  command,
                  participantId: OWNER,
                  phase,
                  resultText: payload.resultText!,
                  state,
                  updatedAt,
                  visibleToParticipantIds: payload.visibleToParticipantIds ?? [],
                })
              : finishCombatTaskAtOpportunity({
                  actionId: action.id,
                  command,
                  kind: payload.finishKind ?? "cancel",
                  participantId: OWNER,
                  phase,
                  state,
                  updatedAt,
                });
    current = encounterSessionSchema.parse({
      ...current,
      combatRoundState: applied.state,
      currentRound: applied.state.roundNumber,
      updatedAt,
    });
    return { commandEnvelope: { commands: [], revision: updatedAt }, encounter: current };
  });
  return {
    get encounter() {
      return current;
    },
    get state(): CombatRoundState {
      return combatRoundStateSchema.parse(current.combatRoundState);
    },
  };
}

function projectedTaskKinds(state: CombatRoundState): string[] {
  return getCurrentExecutableCombatTasks(buildCombatProgressionProjection(state)).map(
    (task) => task.kind,
  );
}

/** The one message no Combat Task command may ever reach. */
const FALLTHROUGH = "This combat task does not have a canonical command handler.";

function expectNoFallthrough() {
  expect(screen.queryByText(FALLTHROUGH)).toBeNull();
}

async function renderPanel(encounter: EncounterSession, onEncounterUpdated = vi.fn()) {
  const view = render(
    <CombatRoundManagerPanel
      encounter={encounter}
      onEncounterUpdated={onEncounterUpdated}
      scenarioParticipants={participants()}
    />,
  );
  await screen.findByRole("button", { name: "Review task" });
  return { onEncounterUpdated, view };
}

/** Re-renders the panel against the server's current encounter, as the page's owner would. */
async function rerenderWith(
  view: Awaited<ReturnType<typeof renderPanel>>["view"],
  encounter: EncounterSession,
  buttonName: string,
) {
  view.rerender(
    <CombatRoundManagerPanel encounter={encounter} scenarioParticipants={participants()} />,
  );
  return screen.findByRole("button", { name: buttonName });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.loadEncounterItems.mockResolvedValue({ availableItems: [], items: [] });
  mocks.loadItemOptions.mockResolvedValue(undefined);
  mocks.advanceDeterministic.mockImplementation(
    async (input: { currentEncounter: EncounterSession }) => ({
      encounter: input.currentEncounter,
      executedTaskIds: [],
      participants: [],
      stopReason: "blocked_or_human_work" as const,
    }),
  );
});

afterEach(() => {
  cleanup();
});

describe("GM Combat Task command wiring with GenericCombatActionPanel unmounted (#340)", () => {
  it("never renders the retiring Actions and tasks surface", async () => {
    const encounter = buildDeclaredTaskEncounter();
    createServer(encounter);
    await renderPanel(encounter);

    expect(screen.queryByText("Actions and tasks")).toBeNull();
    expect(screen.queryByText("Items and task history")).toBeNull();
    expect(screen.queryByRole("button", { name: "Review action" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Resolve action" })).toBeNull();
  });

  it("projects the declared task as the GM's mandatory first command", async () => {
    const encounter = buildDeclaredTaskEncounter();
    const server = createServer(encounter);
    await renderPanel(encounter);

    // The projection accepts the fixture as a canonical task, which is what makes it production
    // shaped rather than a convenient one.
    expect(projectedTaskKinds(server.state)).toEqual(["combat_task_review"]);
    expect(screen.getByText("Review the declared task and set its rule inputs.")).toBeTruthy();
    expectNoFallthrough();
  });

  /**
   * Acceptance criterion 1 — review_combat_task with every GM review field, issued from Current
   * action while the fields live in the Action Selector (the settled M5 split).
   */
  it("reviews a declared task with duration, roll basis, Stat, Difficulty and reference", async () => {
    const encounter = buildDeclaredTaskEncounter();
    const server = createServer(encounter);
    const { onEncounterUpdated } = await renderPanel(encounter);

    const fields = screen.getByLabelText("Combat Task review fields");
    // M5's negative presentation check: the Action Selector carries the fields and no commit
    // control of its own.
    expect(within(fields).queryByRole("button")).toBeNull();
    expect(screen.getByText("Review is committed from Current action.")).toBeTruthy();

    fireEvent.change(within(fields).getByLabelText("Reviewed duration"), {
      target: { value: "round" },
    });
    fireEvent.change(within(fields).getByLabelText("Reviewed roll"), {
      target: { value: "stat" },
    });
    fireEvent.change(within(fields).getByLabelText("Reviewed Current Stat"), {
      target: { value: "dex" },
    });
    fireEvent.change(within(fields).getByLabelText("Reviewed Difficulty"), {
      target: { value: "31" },
    });
    fireEvent.change(within(fields).getByLabelText("Reviewed reference"), {
      target: { value: "participant" },
    });
    fireEvent.change(within(fields).getByLabelText("Reviewed participant"), {
      target: { value: OTHER },
    });

    fireEvent.click(screen.getByRole("button", { name: "Review task" }));

    await waitFor(() => expect(mocks.sendTaskLifecycle).toHaveBeenCalledTimes(1));
    expect(mocks.sendTaskLifecycle).toHaveBeenCalledWith(
      expect.objectContaining({
        actionId: TASK_ID,
        difficulty: 31,
        duration: { kind: "round" },
        operation: "review",
        referenceKind: "participant",
        referenceParticipantId: OTHER,
        rollKind: "stat",
        scenarioParticipantId: "scenario-owner",
        statId: "dex",
      }),
    );
    await waitFor(() => expect(onEncounterUpdated).toHaveBeenCalled());
    const reviewed = server.state.genericActions[0]!;
    expect(reviewed.status).toBe("active");
    expect(reviewed.duration).toEqual({ kind: "round" });
    expect(reviewed.rollRequest?.difficulty).toBe(31);
    expect(reviewed.reference).toMatchObject({ kind: "participant", participantId: OTHER });
    expect(server.state.commands.at(-1)?.type).toBe("review_combat_task");
    expectNoFallthrough();
  });

  it("blocks the review command until an incomplete reference is chosen", async () => {
    const encounter = buildDeclaredTaskEncounter();
    createServer(encounter);
    await renderPanel(encounter);

    const fields = screen.getByLabelText("Combat Task review fields");
    fireEvent.change(within(fields).getByLabelText("Reviewed reference"), {
      target: { value: "item" },
    });

    await waitFor(() =>
      expect(
        (screen.getByRole("button", { name: "Review task" }) as HTMLButtonElement).disabled,
      ).toBe(true),
    );
    expect(screen.getAllByText("Choose the reviewed Item.").length).toBeGreaterThan(0);

    fireEvent.change(within(fields).getByLabelText("Reviewed Item"), {
      target: { value: "owner-crowbar" },
    });
    await waitFor(() =>
      expect(
        (screen.getByRole("button", { name: "Review task" }) as HTMLButtonElement).disabled,
      ).toBe(false),
    );
    expect(mocks.sendTaskLifecycle).not.toHaveBeenCalled();
  });

  /**
   * Acceptance criterion 7 — the explicit A3 unblock condition, part 1. One GM drives the whole
   * life of a one-round task through Current action with the retiring panel unmounted: declare →
   * review → roll → resolve, with the audience the GM chose. `advance_combat_task` is part 2 below:
   * an advance spends the actor's primary-action opportunity, so by the settled rules it cannot
   * occur in the same round as the resolve that ends the task.
   */
  it("drives the full GM lifecycle of a one-round task: review, roll and resolve", async () => {
    const encounter = buildDeclaredTaskEncounter();
    const server = createServer(encounter);
    const { view } = await renderPanel(encounter);

    const fields = screen.getByLabelText("Combat Task review fields");
    fireEvent.change(within(fields).getByLabelText("Reviewed duration"), {
      target: { value: "round" },
    });
    fireEvent.change(within(fields).getByLabelText("Reviewed roll"), { target: { value: "stat" } });
    fireEvent.change(within(fields).getByLabelText("Reviewed Current Stat"), {
      target: { value: "dex" },
    });
    fireEvent.change(within(fields).getByLabelText("Reviewed Difficulty"), {
      target: { value: "26" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Review task" }));
    await waitFor(() => expect(server.state.genericActions[0]?.status).toBe("active"));
    expect(server.state.commands.at(-1)?.type).toBe("review_combat_task");
    expect(projectedTaskKinds(server.state)).toEqual(["combat_task_roll"]);
    expectNoFallthrough();

    // Roll — driven by the GM, not only the player.
    fireEvent.click(await rerenderWith(view, server.encounter, "Roll for task"));
    await waitFor(() => expect(server.state.genericActions[0]?.rollResult).toBeTruthy());
    expect(server.state.commands.at(-1)?.type).toBe("roll_combat_task");
    expect(projectedTaskKinds(server.state)).toEqual(["combat_task_resolve"]);
    expectNoFallthrough();

    // Resolve — with the GM-authored player-safe result text and the chosen audience.
    await rerenderWith(view, server.encounter, "Resolve task");
    const audience = screen.getByLabelText("Who receives this result?");
    fireEvent.change(screen.getByLabelText("Player-safe result"), {
      target: { value: "The winch groans and the portcullis lifts a hand's width." },
    });
    fireEvent.click(within(audience).getByRole("checkbox", { name: "City guard" }));
    fireEvent.click(screen.getByRole("button", { name: "Resolve task" }));

    await waitFor(() => expect(server.state.genericActions[0]?.status).toBe("completed"));
    expect(mocks.sendTaskLifecycle).toHaveBeenLastCalledWith(
      expect.objectContaining({
        operation: "resolve",
        resultText: "The winch groans and the portcullis lifts a hand's width.",
        visibleToParticipantIds: [OWNER, OTHER],
      }),
    );
    expect(server.state.genericActions[0]?.resolution).toMatchObject({
      text: "The winch groans and the portcullis lifts a hand's width.",
      visibleToParticipantIds: [OWNER, OTHER],
    });
    expect(server.state.events.filter((event) => event.type === "task_resolved")).toHaveLength(1);
    expect(server.state.commands.at(-1)?.type).toBe("resolve_combat_task");
    expectNoFallthrough();
  });

  /**
   * Acceptance criterion 7, part 2, and criterion 2 — the GM drives `advance_combat_task` at the
   * actor's own opportunity for a multi-round task, and that spends the opportunity.
   */
  it("advances a multi-round task at the GM's command and spends the opportunity", async () => {
    const encounter = buildDeclaredTaskEncounter();
    const server = createServer(encounter);
    const { view } = await renderPanel(encounter);

    const fields = screen.getByLabelText("Combat Task review fields");
    fireEvent.change(within(fields).getByLabelText("Reviewed duration"), {
      target: { value: "rounds" },
    });
    fireEvent.change(within(fields).getByLabelText("Reviewed rounds"), { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: "Review task" }));
    await waitFor(() => expect(server.state.genericActions[0]?.status).toBe("active"));

    fireEvent.click(await rerenderWith(view, server.encounter, "Continue task"));
    await waitFor(() => expect(server.state.commands.at(-1)?.type).toBe("advance_combat_task"));
    expect(mocks.sendTaskLifecycle).toHaveBeenLastCalledWith(
      expect.objectContaining({ operation: "advance", scenarioParticipantId: "scenario-owner" }),
    );
    expect(server.state.genericActions[0]).toMatchObject({
      progress: { completedRounds: 1, lastProgressedRoundNumber: 1, totalRounds: 3 },
      status: "active",
    });
    // The opportunity is spent for this round: no Perform Task command remains projected, and the
    // task is neither resolved nor silently expired.
    expect(server.state.phaseResolutionStatuses[OWNER]?.phase1?.substep).toBe("done");
    expect(
      projectedTaskKinds(server.state).filter((kind) => kind.startsWith("combat_task")),
    ).toHaveLength(0);
    expect(server.state.events.filter((event) => event.type === "task_resolved")).toHaveLength(0);
    expectNoFallthrough();
  });

  it("refuses to resolve without the player-safe result text and an audience", async () => {
    const encounter = buildDeclaredTaskEncounter();
    const server = createServer(encounter);
    const { view } = await renderPanel(encounter);

    fireEvent.change(
      within(screen.getByLabelText("Combat Task review fields")).getByLabelText(
        "Reviewed duration",
      ),
      { target: { value: "round" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "Review task" }));
    await waitFor(() => expect(server.state.genericActions[0]?.status).toBe("active"));

    const resolve = await rerenderWith(view, server.encounter, "Resolve task");
    expect((resolve as HTMLButtonElement).disabled).toBe(true);
    expect(
      screen.getByText("Enter the player-safe result before resolving this Combat Task."),
    ).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Player-safe result"), {
      target: { value: "The winch holds." },
    });
    // The owner is the audience the resolve seeds, so the command becomes available with the text.
    await waitFor(() =>
      expect(
        (screen.getByRole("button", { name: "Resolve task" }) as HTMLButtonElement).disabled,
      ).toBe(false),
    );
    expect(mocks.sendTaskLifecycle).toHaveBeenCalledTimes(1);
  });

  /** Acceptance criterion 4 — interrupt at the opportunity boundary. */
  it("interrupts an active task at the opportunity boundary", async () => {
    const encounter = buildDeclaredTaskEncounter();
    const server = createServer(encounter);
    const { view } = await renderPanel(encounter);

    fireEvent.change(
      within(screen.getByLabelText("Combat Task review fields")).getByLabelText(
        "Reviewed duration",
      ),
      { target: { value: "round" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "Review task" }));
    await waitFor(() => expect(server.state.genericActions[0]?.status).toBe("active"));

    const interrupt = await rerenderWith(view, server.encounter, "Interrupt Combat Task");
    fireEvent.click(interrupt);

    await waitFor(() => expect(server.state.genericActions[0]?.status).toBe("interrupted"));
    expect(mocks.sendTaskLifecycle).toHaveBeenLastCalledWith(
      expect.objectContaining({
        boundary: "opportunity",
        finishKind: "interrupt",
        operation: "finish",
      }),
    );
    expect(server.state.commands.at(-1)?.type).toBe("interrupt_combat_task");
    expect(server.state.events.filter((event) => event.type === "task_resolved")).toHaveLength(0);
    expectNoFallthrough();
  });

  /**
   * Acceptance criterion 4 — cancel at the opportunity boundary. Cancel is reachable from the
   * mandatory review stage too, which is the only stage interrupt is not authorized at.
   */
  it("cancels a declared task at the opportunity boundary", async () => {
    const encounter = buildDeclaredTaskEncounter();
    const server = createServer(encounter);
    await renderPanel(encounter);

    expect(screen.queryByRole("button", { name: "Interrupt Combat Task" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Cancel Combat Task" }));

    await waitFor(() => expect(server.state.genericActions[0]?.status).toBe("cancelled"));
    expect(mocks.sendTaskLifecycle).toHaveBeenLastCalledWith(
      expect.objectContaining({
        boundary: "opportunity",
        finishKind: "cancel",
        operation: "finish",
      }),
    );
    expect(server.state.commands.at(-1)?.type).toBe("cancel_combat_task");
    expectNoFallthrough();
  });

  /**
   * Acceptance criterion 6 — no Combat Task command falls through to the default handler. Each of
   * the six GM Combat Task commands is driven through the one canonical dispatch, and the
   * fall-through message is asserted unreachable after every one of them.
   */
  it("reaches a canonical handler for all six GM Combat Task commands", async () => {
    const commandTypes: string[] = [];

    let view: ReturnType<typeof render> | undefined;

    async function withFreshTask(
      drive: (server: ReturnType<typeof createServer>) => Promise<void>,
    ) {
      cleanup();
      const encounter = buildDeclaredTaskEncounter();
      const server = createServer(encounter);
      view = (await renderPanel(encounter)).view;
      await drive(server);
    }

    async function review(server: ReturnType<typeof createServer>, rounds?: number) {
      const fields = screen.getByLabelText("Combat Task review fields");
      fireEvent.change(within(fields).getByLabelText("Reviewed duration"), {
        target: { value: rounds === undefined ? "round" : "rounds" },
      });
      if (rounds !== undefined) {
        fireEvent.change(within(fields).getByLabelText("Reviewed rounds"), {
          target: { value: String(rounds) },
        });
      }
      fireEvent.change(within(fields).getByLabelText("Reviewed roll"), {
        target: { value: "stat" },
      });
      fireEvent.change(within(fields).getByLabelText("Reviewed Difficulty"), {
        target: { value: "26" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Review task" }));
      await waitFor(() => expect(server.state.genericActions[0]?.status).toBe("active"));
      commandTypes.push(server.state.commands.at(-1)!.type);
      expectNoFallthrough();
    }

    async function click(server: ReturnType<typeof createServer>, name: string, expected: string) {
      view!.rerender(
        <CombatRoundManagerPanel
          encounter={server.encounter}
          scenarioParticipants={participants()}
        />,
      );
      fireEvent.click(await screen.findByRole("button", { name }));
      await waitFor(() => expect(server.state.commands.at(-1)?.type).toBe(expected));
      commandTypes.push(expected);
      expectNoFallthrough();
    }

    // cancel, from the mandatory review stage — the one stage interrupt is not authorized at.
    const first = buildDeclaredTaskEncounter();
    const firstServer = createServer(first);
    view = (await renderPanel(first)).view;
    expect(screen.queryByRole("button", { name: "Interrupt Combat Task" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Cancel Combat Task" }));
    await waitFor(() => expect(firstServer.state.genericActions[0]?.status).toBe("cancelled"));
    commandTypes.push(firstServer.state.commands.at(-1)!.type);
    expectNoFallthrough();

    // review, roll and interrupt
    await withFreshTask(async (server) => {
      await review(server);
      await click(server, "Roll for task", "roll_combat_task");
      await click(server, "Interrupt Combat Task", "interrupt_combat_task");
      expect(server.state.genericActions[0]?.status).toBe("interrupted");
    });

    // advance, on a multi-round task
    await withFreshTask(async (server) => {
      await review(server, 3);
      await click(server, "Roll for task", "roll_combat_task");
      await click(server, "Continue task", "advance_combat_task");
    });

    // resolve, on a one-round task
    await withFreshTask(async (server) => {
      await review(server);
      await click(server, "Roll for task", "roll_combat_task");
      view!.rerender(
        <CombatRoundManagerPanel
          encounter={server.encounter}
          scenarioParticipants={participants()}
        />,
      );
      await screen.findByRole("button", { name: "Resolve task" });
      fireEvent.change(screen.getByLabelText("Player-safe result"), {
        target: { value: "The winch lifts." },
      });
      fireEvent.click(screen.getByRole("button", { name: "Resolve task" }));
      await waitFor(() => expect(server.state.genericActions[0]?.status).toBe("completed"));
      commandTypes.push(server.state.commands.at(-1)!.type);
      expectNoFallthrough();
    });

    expect(new Set(commandTypes)).toEqual(
      new Set([
        "advance_combat_task",
        "cancel_combat_task",
        "interrupt_combat_task",
        "resolve_combat_task",
        "review_combat_task",
        "roll_combat_task",
      ]),
    );
  });
});
