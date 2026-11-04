import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildCombatHistorySourceViewFromPersistedSession,
  buildPlayerFacing,
  combatRoundStateSchema,
  completedCombatRoundSchema,
  playerFacingCombatRoundStateSchema,
  type CompletedCombatRound,
  type EncounterSession,
  type ScenarioParticipant,
} from "@glantri/domain";

/**
 * Forgejo #925 — a completed round is recorded history, read back as the boundary wrote it.
 *
 * Product Owner ruling of 2026-11-04 (#915 comment 20281): *"The past is always recorded history,
 * and not something we calculate or make calculations on."* `normalizeCompletedCombatRounds`
 * filtered every completed round through the **live** participant set, so a combatant removed from
 * the roster was erased from the round they actually played: the measured figures on #925 were a
 * round persisted with 2 participants and 7 commands reading back with 1 and 1.
 *
 * The fixture below reproduces exactly those figures, and the assertions cover the acceptance
 * items that catch a careless repair:
 *
 * - item 1, the round reads back as persisted, on **both** GM read paths;
 * - item 2, no player receives a departed participant's rows, on raw response bodies, on both
 *   player paths and at the one seam every other player encounter payload passes through;
 * - item 3, a GM perspective read behaves like the player it impersonates;
 * - item 4, a departed participant in a historical row is **named**, from the record;
 * - item 5, the present is unchanged — the departed combatant is gone from the live roster, the
 *   live command list and the live round's own rows;
 * - item 6, nothing writes a filtered round back, measured on the one route that saves a
 *   read-side repair (`clear-current-step`);
 * - item 7, take-back still covers exactly the current round.
 */

const PERSISTED = "2026-11-01T10:00:00.000Z";
const GM_PARTICIPANT = "encounter-participant-1";
const DEPARTED_PARTICIPANT = "encounter-participant-2";
const DEPARTED_LABEL = "Sera of the Broken Oath";
const STAYED_LABEL = "The Gladiator";

const mocks = vi.hoisted(() => {
  const adminUser = { email: "gm@example.test", id: "gm-1", roles: ["game_master"] };
  const playerUser = { email: "player@example.test", id: "player-1", roles: ["player"] };

  return {
    adminUser,
    campaignService: {
      getCampaignById: vi.fn(),
      listCampaignsByUserAccess: vi.fn(),
    },
    combatStateReadService: {
      getCombatHistorySourceById: vi.fn(),
      getEncounterMetadataById: vi.fn(),
      listEncounterAccessMetadataByScenario: vi.fn(),
      listScenarioEncounterManagementProjections: vi.fn(),
    },
    encounterService: {
      commitCombatModifierReview: vi.fn(),
      commitCombatModifierReviews: vi.fn(),
      commitCombatParticipantStateMutation: vi.fn(),
      commitCombatParticipantStateMutations: vi.fn(),
      createEncounter: vi.fn(),
      getEncounterById: vi.fn(),
      getEncounterSummaryById: vi.fn(),
      listEncounterSummariesByScenario: vi.fn(),
      listEncountersByScenario: vi.fn(),
      updateCombatEncounter: vi.fn(),
      updateEncounter: vi.fn(),
      updateScenarioParticipantState: vi.fn(),
    },
    playerUser,
    requireAdminUser: vi.fn(),
    requireAuthenticatedUser: vi.fn(),
    scenarioService: {
      getScenarioById: vi.fn(),
      getScenarioParticipantById: vi.fn(),
      listScenarioParticipants: vi.fn(),
      recordScenarioEvent: vi.fn(),
      resolveEquipmentStatuses: vi.fn().mockResolvedValue({}),
      userHasPlayerScenarioAccess: vi.fn(),
    },
  };
});

vi.mock("@glantri/database", async () => ({
  ...(await vi.importActual<Record<string, unknown>>("@glantri/database")),
  ArtifactImportService: vi.fn(() => ({})),
  ArtifactService: vi.fn(() => ({})),
  CampaignService: vi.fn(() => mocks.campaignService),
  CampaignManagementService: vi.fn(() => ({})),
  CampaignMapService: vi.fn(() => ({})),
  CharacterEquipmentReadModelService: vi.fn(() => ({})),
  CharacterService: vi.fn(() => ({})),
  CombatItemInteractionService: vi.fn(() => ({})),
  CombatStateReadService: vi.fn(() => mocks.combatStateReadService),
  EncounterService: vi.fn(() => mocks.encounterService),
  ScenarioService: vi.fn(() => mocks.scenarioService),
}));

vi.mock("../../lib/sessionAuth", () => ({
  requireAdminUser: mocks.requireAdminUser,
  requireAuthenticatedUser: mocks.requireAuthenticatedUser,
}));

import { combatItemInteractionRoutes } from "./combatItemInteractionRoutes";
import { encounterRoutes } from "./encounterRoutes";

function cursor(participantId: string, step: "DE" | "SU") {
  return { participantId, roundNumber: 1, step };
}

function roundParticipant(input: { label: string; participantId: string }) {
  return {
    attackResults: {},
    initiatives: {},
    label: input.label,
    participantId: input.participantId,
    scenarioParticipantId: `scenario-${input.participantId}`,
  };
}

/**
 * The persisted round-1 record: two participants, seven commands, three of them the departed
 * combatant's own, and a round-end review keyed on both.
 *
 * Three of the four commands the staying combatant owns carry a cursor naming the departed
 * participant, which is why the `dev` filter left exactly one of the seven — the figure measured
 * on #925. The filter dropped a command whose own `participantId` had left **and** a command of
 * anyone else's whose `beforeCursor`/`afterCursor` named them.
 */
function persistedCompletedRound(): CompletedCombatRound {
  const command = (input: {
    afterCursorParticipantId: string;
    beforeCursorParticipantId: string;
    id: string;
    participantId: string;
  }) => ({
    afterCursor: cursor(input.afterCursorParticipantId, "SU"),
    beforeCursor: cursor(input.beforeCursorParticipantId, "DE"),
    createdAt: PERSISTED,
    facts: {},
    id: input.id,
    participantId: input.participantId,
    roundNumber: 1,
    type: "declare_action" as const,
  });

  return completedCombatRoundSchema.parse({
    commands: [
      // The staying combatant's own commands. Only the first names nobody who left.
      command({
        afterCursorParticipantId: GM_PARTICIPANT,
        beforeCursorParticipantId: GM_PARTICIPANT,
        id: "command-stayed-1",
        participantId: GM_PARTICIPANT,
      }),
      command({
        afterCursorParticipantId: DEPARTED_PARTICIPANT,
        beforeCursorParticipantId: GM_PARTICIPANT,
        id: "command-stayed-2",
        participantId: GM_PARTICIPANT,
      }),
      command({
        afterCursorParticipantId: GM_PARTICIPANT,
        beforeCursorParticipantId: DEPARTED_PARTICIPANT,
        id: "command-stayed-3",
        participantId: GM_PARTICIPANT,
      }),
      command({
        afterCursorParticipantId: DEPARTED_PARTICIPANT,
        beforeCursorParticipantId: DEPARTED_PARTICIPANT,
        id: "command-stayed-4",
        participantId: GM_PARTICIPANT,
      }),
      // The departed combatant's own three commands.
      command({
        afterCursorParticipantId: DEPARTED_PARTICIPANT,
        beforeCursorParticipantId: DEPARTED_PARTICIPANT,
        id: "command-departed-1",
        participantId: DEPARTED_PARTICIPANT,
      }),
      command({
        afterCursorParticipantId: DEPARTED_PARTICIPANT,
        beforeCursorParticipantId: DEPARTED_PARTICIPANT,
        id: "command-departed-2",
        participantId: DEPARTED_PARTICIPANT,
      }),
      command({
        afterCursorParticipantId: DEPARTED_PARTICIPANT,
        beforeCursorParticipantId: DEPARTED_PARTICIPANT,
        id: "command-departed-3",
        participantId: DEPARTED_PARTICIPANT,
      }),
    ],
    completedAt: PERSISTED,
    currentCursor: cursor(DEPARTED_PARTICIPANT, "SU"),
    currentStep: "round_summary",
    encounterId: "encounter-1",
    events: [
      {
        encounterId: "encounter-1",
        completeness: "complete",
        facts: { involvedOutcome: { outcome: "hit" }, publicOutcome: {} },
        id: "event-departed-attack",
        missingFacts: [],
        occurredAt: PERSISTED,
        ownerParticipantId: DEPARTED_PARTICIPANT,
        rollerParticipantId: DEPARTED_PARTICIPANT,
        roundNumber: 1,
        schemaVersion: 1,
        sequence: 0,
        source: { kind: "canonical", sourceIds: [] },
        status: "recorded",
        step: "phase_1_actions",
        type: "attack",
        visibility: {
          identityRefs: [
            { participantId: DEPARTED_PARTICIPANT, role: "attacker" },
            { participantId: GM_PARTICIPANT, role: "defender" },
          ],
          involvedParticipantIds: [DEPARTED_PARTICIPANT, GM_PARTICIPANT],
          outcomeScope: "perceived",
          rollerParticipantId: DEPARTED_PARTICIPANT,
        },
      },
    ],
    participants: [
      roundParticipant({ label: STAYED_LABEL, participantId: GM_PARTICIPANT }),
      roundParticipant({ label: DEPARTED_LABEL, participantId: DEPARTED_PARTICIPANT }),
    ],
    phaseResolutionStatuses: {
      [DEPARTED_PARTICIPANT]: { phase1: { substep: "pending" } },
      [GM_PARTICIPANT]: { phase1: { substep: "pending" } },
    },
    roundEndReview: {
      participantReviews: {
        [DEPARTED_PARTICIPANT]: {
          committedAt: PERSISTED,
          participantId: DEPARTED_PARTICIPANT,
          status: "committed",
        },
        [GM_PARTICIPANT]: {
          committedAt: PERSISTED,
          participantId: GM_PARTICIPANT,
          status: "committed",
        },
      },
      roundNumber: 1,
    },
    roundNumber: 1,
    selectedParticipantId: DEPARTED_PARTICIPANT,
    stepSnapshots: [
      {
        committedAt: PERSISTED,
        id: "snapshot-departed",
        participantId: DEPARTED_PARTICIPANT,
        participantLabel: DEPARTED_LABEL,
        roundNumber: 1,
        step: "phase_1_actions",
      },
      {
        committedAt: PERSISTED,
        id: "snapshot-stayed",
        participantId: GM_PARTICIPANT,
        participantLabel: STAYED_LABEL,
        roundNumber: 1,
        step: "phase_1_actions",
      },
    ],
  });
}

/**
 * The encounter as storage holds it: round 2 is live with only the staying combatant on the
 * roster, and round 1 is archived with both. The departed combatant is absent from
 * `participants` and from the scenario roster, which is what a GM removal leaves behind.
 */
function persistedEncounter(): EncounterSession {
  const archivedRound = persistedCompletedRound();

  return {
    actionLog: [],
    campaignId: "campaign-1",
    combatRoundState: combatRoundStateSchema.parse({
      commands: [
        {
          afterCursor: { participantId: GM_PARTICIPANT, roundNumber: 2, step: "DE" },
          beforeCursor: { participantId: GM_PARTICIPANT, roundNumber: 2, step: "DE" },
          createdAt: PERSISTED,
          facts: {},
          id: "command-live-stayed",
          participantId: GM_PARTICIPANT,
          roundNumber: 2,
          type: "declare_action",
        },
        {
          afterCursor: { participantId: DEPARTED_PARTICIPANT, roundNumber: 2, step: "DE" },
          beforeCursor: {
            participantId: DEPARTED_PARTICIPANT,
            roundNumber: 2,
            step: "DE",
          },
          createdAt: PERSISTED,
          facts: {},
          id: "command-live-departed",
          participantId: DEPARTED_PARTICIPANT,
          roundNumber: 2,
          type: "declare_action",
        },
      ],
      currentStep: "select_actions",
      encounterId: "encounter-1",
      participants: [
        roundParticipant({ label: STAYED_LABEL, participantId: GM_PARTICIPANT }),
        roundParticipant({ label: DEPARTED_LABEL, participantId: DEPARTED_PARTICIPANT }),
      ],
      roundNumber: 2,
      rounds: [archivedRound],
    }),
    createdAt: "2026-11-01T09:00:00.000Z",
    currentRound: 2,
    currentTurnIndex: 0,
    declarationsLocked: false,
    id: "encounter-1",
    kind: "combat",
    participants: [
      {
        declaration: {
          actionType: "none",
          defenseFocus: "none",
          defensePosture: "none",
          targetLocation: "any",
        },
        facing: "north",
        id: GM_PARTICIPANT,
        initiative: 0,
        label: STAYED_LABEL,
        order: 0,
        orientation: "neutral",
        participantType: "scenario",
        position: { x: 0, y: 0, zone: "center" },
        scenarioParticipantId: "participant-1",
      },
    ],
    scenarioId: "scenario-1",
    status: "active",
    title: "The bridge, after the retreat",
    turnOrderMode: "manual",
    updatedAt: PERSISTED,
  } as unknown as EncounterSession;
}

function liveScenarioParticipants(): ScenarioParticipant[] {
  return [
    {
      controlledByUserId: "player-1",
      createdAt: PERSISTED,
      id: "participant-1",
      isActive: true,
      joinSource: "gm_added",
      role: "player_character",
      scenarioId: "scenario-1",
      snapshot: { displayName: STAYED_LABEL },
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
        conditions: [],
        equipment: {},
        health: {},
        modifiers: [],
        resources: {},
      },
      updatedAt: PERSISTED,
    } as unknown as ScenarioParticipant,
  ];
}

async function buildApp() {
  const app = Fastify({ logger: false });
  await app.register(encounterRoutes);
  await app.register(combatItemInteractionRoutes);
  await app.ready();
  return app;
}

/**
 * Every route in the two scenario route files that can put an encounter payload in front of a
 * **player**, enumerated from source rather than sampled. The classification is in the lane's
 * evidence: of 79 routes in `encounterRoutes.ts`, `combatItemInteractionRoutes.ts`,
 * `participantRoutes.ts` and `scenarioRoutes.ts`, 28 build their payload with
 * `buildPlayerFacingEncounterForUser`, 1 with `projectCombatHistory`, 36 reject a non-GM before
 * returning anything, and 14 return no encounter payload at all. These 29 are the first two
 * classes — the ~47 mutation responses plus the roleplay, player-roll and item-interaction routes
 * the #925 survey deliberately declined to generalise over.
 */
const PLAYER_REACHABLE_ENCOUNTER_ROUTES: ReadonlyArray<readonly [string, string]> = [
  ["GET", "/scenarios/:scenarioId/encounters"],
  ["GET", "/encounters/:encounterId"],
  ["GET", "/encounters/:encounterId/combat-history"],
  ["POST", "/encounters/:encounterId/combat-declaration"],
  ["POST", "/encounters/:encounterId/combat-initiative"],
  ["POST", "/encounters/:encounterId/player-roll"],
  ["POST", "/encounters/:encounterId/combat-round/back-out-phase-attack"],
  ["POST", "/encounters/:encounterId/combat-round/commit-distance-control"],
  ["POST", "/encounters/:encounterId/combat-round/continue-phase-attack"],
  ["POST", "/encounters/:encounterId/combat-round/double-attack-phase2-decision"],
  ["POST", "/encounters/:encounterId/combat-round/generic-actions"],
  ["POST", "/encounters/:encounterId/combat-round/item-interactions"],
  ["POST", "/encounters/:encounterId/combat-round/progress-missile-readiness"],
  ["POST", "/encounters/:encounterId/combat-round/resolve-phase-damage"],
  ["POST", "/encounters/:encounterId/combat-round/respond-adjust-distance"],
  ["POST", "/encounters/:encounterId/combat-round/roll-adjust-distance"],
  ["POST", "/encounters/:encounterId/combat-round/roll-attack"],
  ["POST", "/encounters/:encounterId/combat-round/roll-break-off"],
  ["POST", "/encounters/:encounterId/combat-round/roll-combat-experience"],
  ["POST", "/encounters/:encounterId/combat-round/roll-continued-contact-maintenance"],
  ["POST", "/encounters/:encounterId/combat-round/roll-critical"],
  ["POST", "/encounters/:encounterId/combat-round/roll-disarm"],
  ["POST", "/encounters/:encounterId/combat-round/roll-distance-control"],
  ["POST", "/encounters/:encounterId/combat-round/roll-feint"],
  ["POST", "/encounters/:encounterId/combat-round/roll-health-check"],
  ["POST", "/encounters/:encounterId/combat-round/roll-hit-location"],
  ["POST", "/encounters/:encounterId/combat-round/roll-observation"],
  ["POST", "/encounters/:encounterId/combat-round/roll-offensive-parry-brawling"],
  ["POST", "/encounters/:encounterId/combat-round/roll-parry"],
];

function namesTheDeparted(payload: string): boolean {
  return payload.includes(DEPARTED_PARTICIPANT) || payload.includes(DEPARTED_LABEL);
}

describe("#925 a completed round is recorded history, not rebuilt from the live roster", () => {
  let stored: EncounterSession;

  beforeEach(() => {
    vi.clearAllMocks();
    stored = persistedEncounter();
    mocks.requireAuthenticatedUser.mockResolvedValue(mocks.adminUser);
    mocks.requireAdminUser.mockResolvedValue(mocks.adminUser);
    mocks.encounterService.getEncounterById.mockImplementation(async () => stored);
    mocks.encounterService.updateCombatEncounter.mockImplementation(
      async (update: { session: EncounterSession }) => {
        stored = update.session;
        return stored;
      },
    );
    mocks.scenarioService.listScenarioParticipants.mockResolvedValue(liveScenarioParticipants());
    mocks.scenarioService.userHasPlayerScenarioAccess.mockResolvedValue(true);
    mocks.scenarioService.getScenarioById.mockResolvedValue({
      campaignId: "campaign-1",
      id: "scenario-1",
      kind: "combat",
      name: "The bridge",
      status: "live",
    });
    mocks.campaignService.getCampaignById.mockResolvedValue({
      gmUserId: "gm-1",
      id: "campaign-1",
      name: "Border Trouble",
      status: "active",
    });
    mocks.campaignService.listCampaignsByUserAccess.mockResolvedValue([{ id: "campaign-1" }]);
    mocks.combatStateReadService.getCombatHistorySourceById.mockImplementation(async () =>
      buildCombatHistorySourceViewFromPersistedSession({
        metadata: {
          campaignId: stored.campaignId,
          createdAt: stored.createdAt,
          encounterId: stored.id,
          revision: stored.updatedAt,
          scenarioId: stored.scenarioId,
          status: stored.status,
          title: stored.title,
        },
        sessionJson: stored,
      }),
    );
  });

  /**
   * The fixture's own figures, asserted before any route result is read. Without this the
   * measurements below could pass against a fixture that never held the departed rows.
   */
  it("holds a persisted round of 2 participants and 7 commands, 3 of them the departed combatant's", () => {
    const archived = stored.combatRoundState?.rounds ?? [];

    expect(archived).toHaveLength(1);
    expect(archived[0]?.participants.map((participant) => participant.participantId)).toEqual([
      GM_PARTICIPANT,
      DEPARTED_PARTICIPANT,
    ]);
    expect(archived[0]?.commands).toHaveLength(7);
    expect(
      archived[0]?.commands.filter((command) => command.participantId === DEPARTED_PARTICIPANT),
    ).toHaveLength(3);
    expect(Object.keys(archived[0]?.roundEndReview?.participantReviews ?? {}).sort()).toEqual(
      [DEPARTED_PARTICIPANT, GM_PARTICIPANT].sort(),
    );
    // The present really has lost them: the live roster is one combatant.
    expect(stored.participants.map((participant) => participant.id)).toEqual([GM_PARTICIPANT]);
  });

  // ===== item 1 ==================================================================================

  it("item 1a — the GM encounter read returns the archived round exactly as persisted", async () => {
    const app = await buildApp();
    const response = await app.inject({ method: "GET", url: "/encounters/encounter-1" });
    await app.close();

    expect(response.statusCode).toBe(200);
    const archived = response.json().encounter.combatRoundState.rounds;
    expect(archived).toHaveLength(1);
    expect(
      archived[0].participants.map(
        (participant: { participantId: string }) => participant.participantId,
      ),
    ).toEqual([GM_PARTICIPANT, DEPARTED_PARTICIPANT]);
    expect(archived[0].commands).toHaveLength(7);
    expect(
      archived[0].commands.filter(
        (command: { participantId: string }) => command.participantId === DEPARTED_PARTICIPANT,
      ),
    ).toHaveLength(3);
    expect(Object.keys(archived[0].roundEndReview.participantReviews).sort()).toEqual(
      [DEPARTED_PARTICIPANT, GM_PARTICIPANT].sort(),
    );
    // #929's `selectedParticipantId` substitution is gone with the overrides: the record's own
    // value survives rather than being rewritten to name the first remaining participant.
    expect(archived[0].selectedParticipantId).toBe(DEPARTED_PARTICIPANT);
    expect(archived[0].stepSnapshots).toHaveLength(2);
    expect(archived[0].phaseResolutionStatuses).toHaveProperty(DEPARTED_PARTICIPANT);
    // The strongest form of item 1: the whole round, field for field, as storage holds it.
    expect(archived[0]).toEqual(
      JSON.parse(JSON.stringify(persistedEncounter().combatRoundState?.rounds?.[0])),
    );
  });

  it("item 1b — the GM combat-history read projects the archived round's full set", async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: "GET",
      url: "/encounters/encounter-1/combat-history",
    });
    await app.close();

    expect(response.statusCode).toBe(200);
    const archived = response.json().history.archivedRounds;
    expect(archived).toHaveLength(1);
    expect(
      archived[0].snapshots.map(
        (snapshot: { participant: { participantId: string } }) =>
          snapshot.participant.participantId,
      ),
    ).toEqual(expect.arrayContaining([GM_PARTICIPANT, DEPARTED_PARTICIPANT]));
    expect(
      archived[0].events.some(
        (event: { ownerParticipantId?: string }) =>
          event.ownerParticipantId === DEPARTED_PARTICIPANT,
      ),
    ).toBe(true);
  });

  // ===== item 4 ==================================================================================

  it("item 4 — the departed combatant's historical rows are named from the record", async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: "GET",
      url: "/encounters/encounter-1/combat-history",
    });
    await app.close();

    const archived = response.json().history.archivedRounds[0];
    const departedSnapshot = archived.snapshots.find(
      (snapshot: { participant: { participantId: string } }) =>
        snapshot.participant.participantId === DEPARTED_PARTICIPANT,
    );
    expect(departedSnapshot?.participant.displayName).toBe(DEPARTED_LABEL);
    const departedIdentity = archived.events
      .flatMap(
        (event: { identities?: Array<{ displayName?: string; participantId?: string }> }) =>
          event.identities ?? [],
      )
      .find(
        (identity: { participantId?: string }) => identity.participantId === DEPARTED_PARTICIPANT,
      );
    expect(departedIdentity?.displayName).toBe(DEPARTED_LABEL);
    // And the live tracker row list is still the present's roster, not the union.
    expect(
      response.json().history.rows.map((row: { participantId: string }) => row.participantId),
    ).toEqual([GM_PARTICIPANT]);
  });

  // ===== item 2 ==================================================================================

  it("item 2a — a player's encounter read names the departed combatant nowhere", async () => {
    mocks.requireAuthenticatedUser.mockResolvedValue(mocks.playerUser);
    const app = await buildApp();
    const response = await app.inject({ method: "GET", url: "/encounters/encounter-1" });
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json().encounter.combatRoundState.rounds).toEqual([]);
    expect(namesTheDeparted(response.payload)).toBe(false);
  });

  it("item 2b — a player's combat-history read names the departed combatant nowhere", async () => {
    mocks.requireAuthenticatedUser.mockResolvedValue(mocks.playerUser);
    const app = await buildApp();
    const response = await app.inject({
      method: "GET",
      url: "/encounters/encounter-1/combat-history",
    });
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json().history.archivedRounds).toHaveLength(1);
    // The player keeps the archived round and their own row in it; the departed combatant's row is
    // withheld by the established per-viewer gate, which builds its visible set from the live
    // roster and so can never contain them.
    expect(
      response
        .json()
        .history.archivedRounds[0].snapshots.map(
          (snapshot: { participant: { participantId: string } }) =>
            snapshot.participant.participantId,
        ),
    ).toEqual([GM_PARTICIPANT]);
    expect(namesTheDeparted(response.payload)).toBe(false);
  });

  /**
   * The seam that covers every other player encounter payload. All 28 player-reachable routes that
   * return an encounter build it with `buildPlayerFacingEncounterForUser`, whose round state is
   * parsed by `playerFacingCombatRoundStateSchema`. `rounds` there is `z.array(z.never())`, so the
   * guarantee is refusal rather than silent emptying — a caller that forgot the `rounds: []`
   * override would throw, not leak.
   */
  it("item 2c — the player-facing round-state schema cannot carry an archived round at all", () => {
    const state = stored.combatRoundState;
    expect(state?.rounds).toHaveLength(1);
    expect(() =>
      buildPlayerFacing(playerFacingCombatRoundStateSchema, state as object, {
        defenseSnapshots: [],
        events: [],
        committedInitiativeOrders: [],
        stepSnapshots: [],
      }),
    ).toThrow(/Expected never/);
    expect(
      buildPlayerFacing(playerFacingCombatRoundStateSchema, state as object, {
        defenseSnapshots: [],
        events: [],
        committedInitiativeOrders: [],
        participants: [],
        rounds: [],
        stepSnapshots: [],
      }).rounds,
    ).toEqual([]);
  });

  /**
   * item 2d — the per-path sweep. Every player-reachable encounter route, driven as the player,
   * with the departed combatant's whole archived round sitting in storage, asserted on the **raw
   * response body**: none of them names them.
   *
   * What this measures and what it does not. The mutation routes reject a `{}` body, so 25 of the
   * 29 answer 4xx and for those the assertion is only that the refusal itself names nobody; the
   * item-interactions route answers 500 against this file's stub service, which is a property of
   * the stub and not of the route. The 2xx paths are the load-bearing ones, and the sweep asserts
   * that the two established read paths really are among them and that every 2xx body is clean.
   * The structural guarantee for the remainder is item 2c above: all 28 serialise their round
   * state through `playerFacingCombatRoundStateSchema`, which cannot carry an archived round.
   */
  it("item 2d — no player-reachable encounter route names the departed combatant", async () => {
    mocks.requireAuthenticatedUser.mockResolvedValue(mocks.playerUser);
    mocks.requireAdminUser.mockResolvedValue(undefined);
    mocks.encounterService.listEncountersByScenario.mockResolvedValue([stored]);
    mocks.encounterService.listEncounterSummariesByScenario.mockResolvedValue([stored]);
    mocks.combatStateReadService.listEncounterAccessMetadataByScenario.mockResolvedValue([]);
    const app = await buildApp();
    const results: Array<{ route: string; status: number }> = [];

    for (const [method, template] of PLAYER_REACHABLE_ENCOUNTER_ROUTES) {
      const url = template
        .replace(":encounterId", "encounter-1")
        .replace(":scenarioId", "scenario-1");
      const response = await app.inject(
        method === "GET" ? { method: "GET", url } : { method: "POST", payload: {}, url },
      );
      results.push({ route: `${method} ${url}`, status: response.statusCode });
      expect(
        namesTheDeparted(response.payload),
        `${method} ${url} (${response.statusCode}) named the departed combatant`,
      ).toBe(false);
    }
    await app.close();

    expect(results).toHaveLength(29);
    // The sweep is not vacuous: the two read paths really answered 200 with a body.
    expect(
      results.filter((result) => result.status >= 200 && result.status < 300).length,
    ).toBeGreaterThanOrEqual(2);
    expect(results.find((result) => result.route === "GET /encounters/encounter-1")?.status).toBe(
      200,
    );
    expect(
      results.find((result) => result.route === "GET /encounters/encounter-1/combat-history")
        ?.status,
    ).toBe(200);
  });

  // ===== item 3 ==================================================================================

  it("item 3 — a GM perspective read behaves like the player it impersonates", async () => {
    const app = await buildApp();
    const gmView = await app.inject({
      method: "GET",
      url: "/encounters/encounter-1/combat-history",
    });
    const perspectiveView = await app.inject({
      method: "GET",
      url: `/encounters/encounter-1/combat-history?perspectiveParticipantId=${GM_PARTICIPANT}`,
    });
    mocks.requireAuthenticatedUser.mockResolvedValue(mocks.playerUser);
    const playerApp = await buildApp();
    const playerView = await playerApp.inject({
      method: "GET",
      url: "/encounters/encounter-1/combat-history",
    });
    await app.close();
    await playerApp.close();

    expect(perspectiveView.statusCode).toBe(200);
    expect(namesTheDeparted(gmView.payload)).toBe(true);
    expect(namesTheDeparted(perspectiveView.payload)).toBe(false);
    expect(perspectiveView.json().history.archivedRounds[0].snapshots).toEqual(
      playerView.json().history.archivedRounds[0].snapshots,
    );
    expect(perspectiveView.json().history.archivedRounds[0].events).toEqual(
      playerView.json().history.archivedRounds[0].events,
    );
  });

  // ===== item 5 ==================================================================================

  it("item 5 — the present is unchanged: the departed combatant is gone from the live round", async () => {
    const app = await buildApp();
    const response = await app.inject({ method: "GET", url: "/encounters/encounter-1" });
    await app.close();

    const live = response.json().encounter.combatRoundState;
    expect(live.roundNumber).toBe(2);
    expect(
      live.participants.map((participant: { participantId: string }) => participant.participantId),
    ).toEqual([GM_PARTICIPANT]);
    expect(live.commands.map((command: { id: string }) => command.id)).toEqual([
      "command-live-stayed",
    ]);
  });

  // ===== items 6 and 7 ===========================================================================

  /**
   * `clear-current-step` is the one route that persists a read-side repair: when the materialized
   * round state differs from the stored one and the step cannot be cleared, it saves the
   * materialized state (`encounterRoutes.ts`, the `combatRoundStatesDiffer` branch). On `dev` the
   * materialized state carried the *filtered* archive, so this route wrote the erasure to storage.
   */
  it("items 6 and 7 — take-back covers the current round and never rewrites the archive", async () => {
    /*
     * The round-2 commands are cleared so the current step has nothing left to take back. That is
     * what puts the route on its save-back branch rather than its forward rewind: it then compares
     * the materialized state against the stored one and, because the live roster sanitisation has
     * removed the departed combatant's live row, they differ and the route persists. The archived
     * round must ride through that write untouched.
     */
    const live = stored.combatRoundState as unknown as Record<string, unknown>;
    stored = {
      ...stored,
      combatRoundState: combatRoundStateSchema.parse({ ...live, commands: [] }),
    } as EncounterSession;
    const before = JSON.stringify(stored.combatRoundState?.rounds);
    const beforeArchiveCount = stored.combatRoundState?.rounds?.length;
    const app = await buildApp();
    const response = await app.inject({
      method: "POST",
      url: "/encounters/encounter-1/combat-round/clear-current-step",
      payload: {},
    });
    await app.close();

    expect(response.statusCode).toBe(200);
    // The instrument must have fired: without a write there is nothing for this item to measure.
    expect(mocks.encounterService.updateCombatEncounter).toHaveBeenCalledTimes(1);
    // The archive is byte-identical across that write, and the archive count is unchanged.
    expect(JSON.stringify(stored.combatRoundState?.rounds)).toBe(before);
    expect(stored.combatRoundState?.rounds).toHaveLength(beforeArchiveCount ?? -1);
    expect(stored.combatRoundState?.rounds?.[0]?.commands).toHaveLength(7);
    expect(stored.combatRoundState?.rounds?.[0]?.participants).toHaveLength(2);
    // Take-back reaches the current round only: round 1 stays archived and round 2 stays live.
    expect(stored.combatRoundState?.roundNumber).toBe(2);
    expect(stored.combatRoundState?.rounds?.[0]?.roundNumber).toBe(1);
  });
});
