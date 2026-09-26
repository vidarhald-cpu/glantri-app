import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  activateCombatGenericAction,
  advanceCombatRoundStep,
  declareCombatGenericAction as declareCombatGenericActionCommand,
  combatRoundStateSchema,
  commitCombatRoundPhaseInitiativeResolution,
  declareCombatGenericAction,
  encounterSessionSchema,
  finishCombatGenericAction,
  initializeCombatRoundState,
  recordCombatRoundDeclaration,
  reviewCombatGenericAction,
  rollCombatRoundCombatExperience,
  setCombatRoundCombatExperienceDifficulty,
  setCombatRoundParticipantInitiative,
  type CombatGenericActionDuration,
  type CombatItemInteractionOperation,
  type CombatRoundState,
  type EncounterSession,
  type ScenarioParticipant,
} from "@glantri/domain";

/**
 * M7's client half — Forgejo issue #356.
 *
 * Every test here runs with `GenericCombatActionPanel` **unmounted**, which is the condition A3
 * (#335) parity check P6 needs: the declaration surface and the GM `review` / `activate` /
 * `resolve` path must both work without the panel A3 deletes.
 *
 * The lifecycle is driven through the real UI against the **real domain commands**: the fake
 * transport below applies `declareCombatGenericAction`, `reviewCombatGenericAction`,
 * `activateCombatGenericAction` and `finishCombatGenericAction` exactly as
 * `POST /encounters/:id/combat-round/item-interactions` applies them, including the route's own
 * `expectedItemRevision`, `expectedRevision` and resolve-input guards. No post-command state is
 * hand-built, and every assertion is made on the API payload rather than on the DOM.
 */

const TASK_ID = "round:1:participant:encounter-owner:declaration:perform_task";
const OWNER = "encounter-owner";
const OTHER = "encounter-other";
const ITEM_ID = "owner-crowbar";
const CURRENT_ITEM_REVISION = "2026-09-26T10:00:00.000Z";
const STALE_ITEM_REVISION = "2026-09-26T09:00:00.000Z";

const mocks = vi.hoisted(() => ({
  advanceDeterministic: vi.fn(),
  loadCharacterEquipmentState: vi
    .fn()
    .mockRejectedValue(new Error("Inspector combat loadout is not served in component tests.")),
  loadEncounter: vi.fn(),
  loadEncounterItems: vi.fn().mockResolvedValue({ availableItems: [], items: [] }),
  loadItemOptions: vi.fn(),
  loadParticipants: vi.fn(),
  loadServerCharacterById: vi
    .fn()
    .mockRejectedValue(new Error("Inspector combat loadout is not served in component tests.")),
  updateItemInteraction: vi.fn(),
}));

vi.mock("@/lib/api/encounterClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/encounterClient")>();
  return {
    ...actual,
    advanceDeterministicCombatOnServer: mocks.advanceDeterministic,
    loadCombatItemInteractionOptions: mocks.loadItemOptions,
    loadEncounterById: mocks.loadEncounter,
    updateCombatItemInteractionOnServer: mocks.updateItemInteraction,
  };
});

vi.mock("@/lib/api/localServiceClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/localServiceClient")>();
  return {
    ...actual,
    loadCharacterEquipmentState: mocks.loadCharacterEquipmentState,
    loadCombatItemInteractionOptions: mocks.loadItemOptions,
    loadEncounterItems: mocks.loadEncounterItems,
    loadServerCharacterById: mocks.loadServerCharacterById,
    updateCombatItemInteractionOnServer: mocks.updateItemInteraction,
  };
});

vi.mock("@/lib/api/scenarioClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/scenarioClient")>();
  return {
    ...actual,
    loadScenarioParticipants: mocks.loadParticipants,
  };
});

// The A3 unblock condition, enforced for every test in this file: the retiring panel renders
// nothing, so no capability proved below can be coming from it.
vi.mock("@/features/combat-generic-actions/GenericCombatActionPanel", () => ({
  GenericCombatActionPanel: () => null,
}));

import CombatRoundManagerPanel from "./CombatRoundManagerPanel";

mocks.advanceDeterministic.mockImplementation(
  async (input: { currentEncounter: EncounterSession }) => ({
    encounter: input.currentEncounter,
    executedTaskIds: [],
    participants: [],
    stopReason: "blocked_or_human_work" as const,
  }),
);

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
        itemsById: { [ITEM_ID]: { displayName: "Crowbar", id: ITEM_ID, name: "Crowbar" } },
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

function participants(): ScenarioParticipant[] {
  return [
    scenarioParticipant({ id: "scenario-owner", name: "The Gladiator", order: 0 }),
    scenarioParticipant({ id: "scenario-other", name: "City guard", order: 1 }),
  ];
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
 * The `/options` payload the real route serves, with the Item's **current** revision. The
 * declaration surface reads `revision` from here and sends it back as `expectedItemRevision`; that
 * round trip is exactly what the staleness test below perturbs.
 */
function itemOptionsPayload(revision = CURRENT_ITEM_REVISION) {
  return {
    actors: [
      {
        characterId: "character-owner",
        items: [
          {
            id: ITEM_ID,
            label: "Crowbar",
            operations: ["drop", "pass", "stow", "use"] as CombatItemInteractionOperation[],
            revision,
            state: "held" as const,
          },
        ],
        label: "The Gladiator",
        participantId: OWNER,
      },
    ],
    disarmTargets: [],
    presentItems: [],
    recipients: [
      { label: "The Gladiator", participantId: OWNER },
      { label: "City guard", participantId: OTHER },
    ],
  };
}

/**
 * Drives the real round machinery to the owner's Phase 1 primary-action opportunity: Combat
 * Experience resolved, both participants declared through `recordCombatRoundDeclaration`,
 * initiative set and the Phase 1 initiative resolution committed. Nothing about the Item action is
 * pre-built — the encounter starts with **no** generic action at all.
 */
function buildOpportunityEncounter(): EncounterSession {
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
    title: "M7 client completion",
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
  // The owner holds a declared Perform Task, exactly as `materializeCombatDeclarationTasks` mints
  // it. It is here only so the Inspector sits on the owner's live Phase 1 opportunity — the Item
  // action below is minted entirely through the real declare route, from nothing.
  const withTask = combatRoundStateSchema.parse({
    ...declarationReady,
    genericActions: declareCombatGenericActionCommand({
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
    combatRoundState: driveToOpportunity({
      at: "2026-09-26T10:01:00.000Z",
      state: withTask,
    }),
    updatedAt: "2026-09-26T10:02:00.000Z",
  });
}

function driveToOpportunity(input: { at: string; state: CombatRoundState }): CombatRoundState {
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
  return commitCombatRoundPhaseInitiativeResolution({
    command: { createdAt: input.at, createdByUserId: "gm-1" },
    phase: "phase1",
    state: withInitiative,
    visibility: { [OTHER]: { [OWNER]: true }, [OWNER]: { [OTHER]: true } },
  }).state;
}

interface ItemActionPayload {
  actionId: string;
  duration?: CombatGenericActionDuration;
  encounterId: string;
  expectedItemRevision?: string;
  expectedRevision: string;
  intentDetail?: string;
  itemId?: string;
  itemOperation?: CombatItemInteractionOperation;
  operation: "declare" | "review" | "activate" | "resolve" | "interrupt" | "cancel";
  participantId?: string;
  recipientParticipantId?: string;
  resultText?: string;
  visibleToParticipantIds?: readonly string[];
}

const operationIntentVerbs: Record<CombatItemInteractionOperation, string> = {
  draw: "Draw / ready",
  drop: "Drop",
  pass: "Pass / give",
  pickup: "Pick up",
  stow: "Stow / unequip",
  use: "Use / interact with",
};

/**
 * The fake transport. It mirrors `combatItemInteractionRoutes.ts`: the same guards, the same real
 * domain commands, and the same `CombatItemUnavailableError` message the route surfaces as a 404
 * when `expectedItemRevision` is stale. Item mutation itself stays with the Item authority, which
 * is why a resolve bumps the Item revision here exactly as a committed resolution does.
 */
function createServer(initial: EncounterSession, itemRevision = CURRENT_ITEM_REVISION) {
  let current = initial;
  let currentItemRevision = itemRevision;
  let clock = 0;
  mocks.loadItemOptions.mockImplementation(async () => itemOptionsPayload(currentItemRevision));
  mocks.updateItemInteraction.mockImplementation(async (payload: ItemActionPayload) => {
    clock += 1;
    const updatedAt = `2026-09-26T10:1${clock}:00.000Z`;
    const state = combatRoundStateSchema.parse(current.combatRoundState);
    const existing = state.genericActions.find((action) => action.id === payload.actionId);
    if (payload.operation !== "declare" && existing?.preset !== "item_interaction") {
      throw new Error("Canonical Item action not found.");
    }
    if (payload.expectedRevision !== current.updatedAt) {
      throw new Error("The canonical Item action changed. Refresh and review the latest state.");
    }
    let genericActions = state.genericActions;
    if (payload.operation === "declare") {
      // `resolveDeclaration`'s guard, verbatim in effect: the Item is matched by id **and**
      // revision, and a stale revision is refused with `CombatItemUnavailableError`.
      if (
        !payload.participantId ||
        !payload.itemId ||
        !payload.expectedItemRevision ||
        !payload.itemOperation ||
        payload.itemId !== ITEM_ID ||
        payload.expectedItemRevision !== currentItemRevision ||
        (payload.itemOperation === "pass" && !payload.recipientParticipantId) ||
        (payload.itemOperation !== "pass" && payload.recipientParticipantId)
      ) {
        throw new Error("The selected Item is no longer available.");
      }
      const recipientLabel = payload.recipientParticipantId === OTHER ? "City guard" : undefined;
      genericActions = declareCombatGenericAction({
        action: {
          createdAt: updatedAt,
          createdByUserId: "user-scenario-owner",
          duration: { kind: "gm_decided" },
          id: payload.actionId,
          intent: `${operationIntentVerbs[payload.itemOperation]} Crowbar${
            recipientLabel ? ` to ${recipientLabel}` : ""
          }${payload.intentDetail ? ` — ${payload.intentDetail}` : ""}`,
          itemInteraction: {
            itemId: payload.itemId,
            itemLabel: "Crowbar",
            itemRevision: payload.expectedItemRevision,
            operation: payload.itemOperation,
            recipientParticipantId: payload.recipientParticipantId,
            stateAtDeclaration: "held",
            visibleToParticipantIds: [OWNER, OTHER],
          },
          ownerParticipantId: payload.participantId,
          preset: "item_interaction",
          reference: {
            itemId: payload.itemId,
            kind: "item",
            label: "Crowbar",
            ownerParticipantId: payload.participantId,
          },
        },
        actions: genericActions,
      });
    } else if (payload.operation === "review") {
      genericActions = reviewCombatGenericAction({
        actionId: payload.actionId,
        actions: genericActions,
        duration: payload.duration ?? existing!.duration,
        reference: existing!.reference,
        reviewedAt: updatedAt,
      });
    } else if (payload.operation === "activate") {
      genericActions = activateCombatGenericAction({
        actionId: payload.actionId,
        activatedAt: updatedAt,
        actions: genericActions,
        roundNumber: state.roundNumber,
        step: state.currentStep,
      });
    } else {
      if (payload.operation === "resolve") {
        if (existing!.status !== "active") {
          throw new Error("Only an active Item action can be resolved.");
        }
        if (!payload.resultText || (payload.visibleToParticipantIds ?? []).length === 0) {
          throw new Error("Enter a player-safe result and audience.");
        }
      }
      genericActions = finishCombatGenericAction({
        actionId: payload.actionId,
        actions: genericActions,
        at: updatedAt,
        resolution:
          payload.operation === "resolve"
            ? {
                resolvedAt: updatedAt,
                resolvedByUserId: "user-gm",
                text: payload.resultText!,
                visibleToParticipantIds: [...(payload.visibleToParticipantIds ?? [])],
              }
            : undefined,
        roundNumber: state.roundNumber,
        status:
          payload.operation === "resolve"
            ? "completed"
            : payload.operation === "interrupt"
              ? "interrupted"
              : "cancelled",
        step: state.currentStep,
      });
      // The Item authority commits the mutation and the Item's revision moves on.
      if (payload.operation === "resolve") currentItemRevision = updatedAt;
    }
    current = encounterSessionSchema.parse({
      ...current,
      combatRoundState: combatRoundStateSchema.parse({ ...state, genericActions }),
      updatedAt,
    });
    return current;
  });
  return {
    get encounter() {
      return current;
    },
    get itemRevision() {
      return currentItemRevision;
    },
    get itemActions() {
      return combatRoundStateSchema
        .parse(current.combatRoundState)
        .genericActions.filter((action) => action.preset === "item_interaction");
    },
  };
}

async function renderPanel(encounter: EncounterSession) {
  const onEncounterUpdated = vi.fn();
  const view = render(
    <CombatRoundManagerPanel
      encounter={encounter}
      onEncounterUpdated={onEncounterUpdated}
      scenarioParticipants={participants()}
    />,
  );
  await screen.findByRole("button", { name: "Crowbar: Drop" });
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

function lastPayload(): ItemActionPayload {
  return mocks.updateItemInteraction.mock.calls.at(-1)?.[0] as ItemActionPayload;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.loadEncounterItems.mockResolvedValue({ availableItems: [], items: [] });
  mocks.loadItemOptions.mockResolvedValue(itemOptionsPayload());
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

describe("Item interaction without GenericCombatActionPanel (#356)", () => {
  it("never renders the retiring Actions and tasks surface", async () => {
    const encounter = buildOpportunityEncounter();
    createServer(encounter);
    await renderPanel(encounter);

    expect(screen.queryByText("Actions and tasks")).toBeNull();
    expect(screen.queryByText("Items and task history")).toBeNull();
  });

  /**
   * Acceptance criterion 1 — the declaration surface reaches the canonical route from the Action
   * Selector, for every permitted operation the `/options` payload offers.
   */
  it("declares each permitted Item operation from the Action Selector", async () => {
    for (const operation of ["drop", "stow"] as const) {
      const encounter = buildOpportunityEncounter();
      const server = createServer(encounter);
      await renderPanel(encounter);

      fireEvent.click(
        screen.getByRole("button", {
          name: `Crowbar: ${operation === "drop" ? "Drop" : "Stow / unequip"}`,
        }),
      );

      await waitFor(() => expect(mocks.updateItemInteraction).toHaveBeenCalled());
      expect(lastPayload()).toMatchObject({
        encounterId: "encounter-1",
        expectedItemRevision: CURRENT_ITEM_REVISION,
        expectedRevision: encounter.updatedAt,
        itemId: ITEM_ID,
        itemOperation: operation,
        operation: "declare",
        participantId: OWNER,
      });
      expect(lastPayload().recipientParticipantId).toBeUndefined();
      // The real `declareCombatGenericAction` accepted it, so this is the production shape.
      expect(server.itemActions).toHaveLength(1);
      expect(server.itemActions[0]!.itemInteraction?.operation).toBe(operation);
      expect(server.itemActions[0]!.status).toBe("declared");
      cleanup();
      vi.clearAllMocks();
    }
  });

  it("declares pass with its recipient", async () => {
    const encounter = buildOpportunityEncounter();
    const server = createServer(encounter);
    await renderPanel(encounter);

    // The button is disabled until a recipient is chosen, so a bad payload cannot be sent.
    expect(screen.getByRole("button", { name: "Crowbar: Pass / give" })).toHaveProperty(
      "disabled",
      true,
    );
    fireEvent.change(screen.getByLabelText("Pass Crowbar to"), { target: { value: OTHER } });
    fireEvent.click(screen.getByRole("button", { name: "Crowbar: Pass / give" }));

    await waitFor(() => expect(mocks.updateItemInteraction).toHaveBeenCalledTimes(1));
    expect(lastPayload()).toMatchObject({
      expectedItemRevision: CURRENT_ITEM_REVISION,
      itemOperation: "pass",
      operation: "declare",
      recipientParticipantId: OTHER,
    });
    expect(server.itemActions[0]!.itemInteraction?.recipientParticipantId).toBe(OTHER);
  });

  it("declares use with its intentDetail", async () => {
    const encounter = buildOpportunityEncounter();
    const server = createServer(encounter);
    await renderPanel(encounter);

    expect(screen.getByRole("button", { name: "Crowbar: Use / interact" })).toHaveProperty(
      "disabled",
      true,
    );
    fireEvent.change(screen.getByLabelText("How will you use Crowbar?"), {
      target: { value: "Lever the portcullis winch." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Crowbar: Use / interact" }));

    await waitFor(() => expect(mocks.updateItemInteraction).toHaveBeenCalledTimes(1));
    expect(lastPayload()).toMatchObject({
      intentDetail: "Lever the portcullis winch.",
      itemOperation: "use",
      operation: "declare",
    });
    expect(server.itemActions[0]!.intent).toContain("Lever the portcullis winch.");
  });

  /**
   * Acceptance criterion 2 — the GM carries a declared Item action through review, activate and
   * resolve from the Combat Inspector, and the resolution commits. Every step is a real domain
   * command applied by the transport, and every assertion is on the payload.
   */
  it("carries an Item action from declared to a committed item_resolution", async () => {
    const encounter = buildOpportunityEncounter();
    const server = createServer(encounter);
    const { view } = await renderPanel(encounter);

    fireEvent.click(screen.getByRole("button", { name: "Crowbar: Drop" }));
    await waitFor(() => expect(server.itemActions).toHaveLength(1));
    const actionId = server.itemActions[0]!.id;

    // Review. The action's status is the only thing that decides which command is offered.
    await rerenderWith(view, server.encounter, "Review Item action");
    const reviewFields = screen.getByLabelText("Item action review fields");
    // The fieldset carries inputs only; the command is the Current action button beside it.
    expect(within(reviewFields).queryByRole("button")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Review Item action" }));
    await waitFor(() => expect(server.itemActions[0]!.status).toBe("reviewed"));
    // The reviewed duration is seeded from the action's own current duration and carried as a
    // command input — the declare route's `gm_decided`, unchanged by the GM here.
    expect(lastPayload()).toMatchObject({
      actionId,
      duration: { kind: "gm_decided" },
      encounterId: "encounter-1",
      operation: "review",
    });
    expect(lastPayload().resultText).toBeUndefined();
    expect(lastPayload().visibleToParticipantIds).toBeUndefined();

    // Activate.
    const revisionBeforeActivate = server.encounter.updatedAt;
    await rerenderWith(view, server.encounter, "Start Item action");
    fireEvent.click(screen.getByRole("button", { name: "Start Item action" }));
    await waitFor(() => expect(server.itemActions[0]!.status).toBe("active"));
    expect(lastPayload()).toMatchObject({
      actionId,
      expectedRevision: revisionBeforeActivate,
      operation: "activate",
    });
    expect(lastPayload().duration).toBeUndefined();

    // Resolve. The result text and its audience are resolve-command inputs, and an incomplete
    // fieldset disables the command rather than sending a request the route would refuse.
    const revisionBeforeResolve = server.encounter.updatedAt;
    await rerenderWith(view, server.encounter, "Resolve Item action");
    fireEvent.click(
      within(screen.getByLabelText("Who receives this Item result?")).getByLabelText(
        "The Gladiator",
      ),
    );
    expect(screen.getByRole("button", { name: "Resolve Item action" })).toHaveProperty(
      "disabled",
      true,
    );
    expect(
      screen.getByText("Enter the player-safe result before resolving this Item action."),
    ).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Player-safe result"), {
      target: { value: "The crowbar clatters onto the flagstones." },
    });
    fireEvent.click(
      within(screen.getByLabelText("Who receives this Item result?")).getByLabelText("City guard"),
    );
    fireEvent.click(screen.getByRole("button", { name: "Resolve Item action" }));

    await waitFor(() => expect(server.itemActions[0]!.status).toBe("completed"));
    expect(lastPayload()).toMatchObject({
      actionId,
      expectedRevision: revisionBeforeResolve,
      operation: "resolve",
      resultText: "The crowbar clatters onto the flagstones.",
    });
    expect([...(lastPayload().visibleToParticipantIds ?? [])].sort()).toEqual([OTHER].sort());
    // The committed resolution the Item authority persists.
    expect(server.itemActions[0]!.resolution?.text).toBe(
      "The crowbar clatters onto the flagstones.",
    );
    expect(server.itemActions[0]!.resolution?.visibleToParticipantIds).toEqual([OTHER]);
    // Resolution moved the Item's revision on, which is the authority committing the mutation.
    expect(server.itemRevision).not.toBe(CURRENT_ITEM_REVISION);
  });

  it("carries a changed reviewed duration and blocks an incomplete one", async () => {
    const encounter = buildOpportunityEncounter();
    const server = createServer(encounter);
    const { view } = await renderPanel(encounter);

    fireEvent.click(screen.getByRole("button", { name: "Crowbar: Drop" }));
    await waitFor(() => expect(server.itemActions).toHaveLength(1));
    await rerenderWith(view, server.encounter, "Review Item action");

    const reviewFields = screen.getByLabelText("Item action review fields");
    fireEvent.change(within(reviewFields).getByLabelText("Reviewed duration"), {
      target: { value: "rounds" },
    });
    fireEvent.change(within(reviewFields).getByLabelText("Reviewed rounds"), {
      target: { value: "1" },
    });
    // An incomplete fieldset disables the command rather than sending a duration the domain
    // would refuse.
    expect(screen.getByRole("button", { name: "Review Item action" })).toHaveProperty(
      "disabled",
      true,
    );
    expect(screen.getByText("Enter at least 2 reviewed rounds.")).toBeTruthy();

    fireEvent.change(within(reviewFields).getByLabelText("Reviewed rounds"), {
      target: { value: "3" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Review Item action" }));

    await waitFor(() => expect(server.itemActions[0]!.status).toBe("reviewed"));
    expect(lastPayload()).toMatchObject({ duration: { kind: "rounds", rounds: 3 } });
    expect(server.itemActions[0]!.duration).toEqual({ kind: "rounds", rounds: 3 });
  });

  it("does not offer a later command before the mandatory GM review", async () => {
    const encounter = buildOpportunityEncounter();
    const server = createServer(encounter);
    const { view } = await renderPanel(encounter);

    fireEvent.click(screen.getByRole("button", { name: "Crowbar: Drop" }));
    await waitFor(() => expect(server.itemActions).toHaveLength(1));
    await rerenderWith(view, server.encounter, "Review Item action");

    expect(screen.queryByRole("button", { name: "Start Item action" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Resolve Item action" })).toBeNull();
    expect(screen.queryByLabelText("Player-safe result")).toBeNull();
  });

  it("offers the GM interrupt and cancel commands for an open Item action", async () => {
    const encounter = buildOpportunityEncounter();
    const server = createServer(encounter);
    const { view } = await renderPanel(encounter);

    fireEvent.click(screen.getByRole("button", { name: "Crowbar: Drop" }));
    await waitFor(() => expect(server.itemActions).toHaveLength(1));
    await rerenderWith(view, server.encounter, "Cancel Item action");

    fireEvent.click(screen.getByRole("button", { name: "Cancel Item action" }));
    await waitFor(() => expect(server.itemActions[0]!.status).toBe("cancelled"));
    expect(lastPayload()).toMatchObject({ operation: "cancel" });
    // A finished Item action leaves the Inspector — its history belongs to the Combat Log.
    await rerenderWith(view, server.encounter, "Crowbar: Drop");
    expect(screen.queryByRole("button", { name: "Cancel Item action" })).toBeNull();
  });

  /**
   * Acceptance criterion 3 — `expectedItemRevision` staleness behaviour is unchanged. The
   * declaration surface sends the revision the `/options` payload served, and the Item authority
   * refuses it when the Item has moved on. Nothing in this lane sits between those two facts.
   */
  it("sends the served expectedItemRevision and surfaces the authority's refusal when it is stale", async () => {
    const encounter = buildOpportunityEncounter();
    // The Item's real revision has moved on since the options payload the surface is holding.
    const server = createServer(encounter, CURRENT_ITEM_REVISION);
    mocks.loadItemOptions.mockResolvedValue(itemOptionsPayload(STALE_ITEM_REVISION));
    await renderPanel(encounter);

    fireEvent.click(screen.getByRole("button", { name: "Crowbar: Drop" }));

    await waitFor(() => expect(mocks.updateItemInteraction).toHaveBeenCalledTimes(1));
    // The stale revision is carried verbatim — the client neither repairs nor omits it.
    expect(lastPayload().expectedItemRevision).toBe(STALE_ITEM_REVISION);
    // And the authority's refusal reaches the user, with no Item action created.
    await screen.findByText("The selected Item is no longer available.");
    expect(server.itemActions).toHaveLength(0);
  });

  it("refuses a stale encounter revision without creating an Item action", async () => {
    const encounter = buildOpportunityEncounter();
    const server = createServer(encounter);
    await renderPanel(encounter);

    mocks.updateItemInteraction.mockRejectedValueOnce(
      new Error("The canonical Item action changed. Refresh and review the latest state."),
    );
    fireEvent.click(screen.getByRole("button", { name: "Crowbar: Drop" }));

    await screen.findByText(
      "The canonical Item action changed. Refresh and review the latest state.",
    );
    expect(server.itemActions).toHaveLength(0);
  });
});
