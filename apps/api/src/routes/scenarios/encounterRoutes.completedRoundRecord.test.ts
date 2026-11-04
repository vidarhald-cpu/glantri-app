import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildCombatHistorySourceViewFromPersistedSession,
  buildCombatProgressionProjection,
  buildCombatRoundCommandEnvelope,
  buildPlayerFacing,
  combatRoundStateSchema,
  completedCombatRoundSchema,
  initializeCombatRoundState,
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
/**
 * `buildCombatRoundCommandId`'s real shape, which embeds the actor's participant id. Written out
 * rather than generated so the assertions below can name it, and so the embedded id is visible.
 */
const DEPARTED_HEALTH_CHECK_COMMAND_ID = `combat-command:1:8:roll_round_end_health_check:${DEPARTED_PARTICIPANT}:${PERSISTED}`;
/** What the summariser produces for that command when the viewer is entitled to the name. */
const DEPARTED_HEALTH_CHECK_SUMMARY = `Round 1, SU: ${DEPARTED_LABEL} health roll 64 vs 50 succeeded.`;

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
 * The persisted round-1 record: two participants, eight commands, four of them the departed
 * combatant's own, and a round-end review keyed on both.
 *
 * Three of the four commands the staying combatant owns carry a cursor naming the departed
 * participant, which is why the `dev` filter left exactly one of the seven `declare_action`
 * commands — the figure measured on #925. The filter dropped a command whose own `participantId`
 * had left **and** a command of anyone else's whose `beforeCursor`/`afterCursor` named them.
 *
 * #937. The record also carries `activeParticipantId`, `phaseResolutionCursor`,
 * `phaseResolutionResults` and `distanceState`, all owned by the departed combatant. Independent QA
 * measured that the first three were covered by **no** assertion at the previous head, not because
 * no assertion existed but because the fixture left those fields empty, which makes any assertion
 * over them vacuous. With them populated the whole-round comparison in item 1a covers all eleven
 * deleted overrides in one check.
 *
 * #925 R1. The eighth command is the departed combatant's `roll_round_end_health_check`, the last
 * command of the round and a type the latest-event summariser **does** summarise. That is the
 * command the blocking finding travels on, and it is the only summarisable command anywhere in the
 * fixture: round 2's are `declare_action`, which the summariser does not handle, so a summariser
 * that walks backwards across rounds reaches this one. Its id is written in
 * `buildCombatRoundCommandId`'s real shape — `combat-command:<round>:<n>:<type>:<participantId>:<createdAt>`
 * — because that shape **embeds the participant id**, so a repair that redacted only the label
 * would still hand a player the departed combatant's identifier inside `latestEvent.commandId`.
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
      // The summarisable one, last in the round. Real command-id shape: the id itself names them.
      {
        afterCursor: cursor(DEPARTED_PARTICIPANT, "SU"),
        beforeCursor: cursor(DEPARTED_PARTICIPANT, "SU"),
        createdAt: PERSISTED,
        facts: { difficulty: 50, finalTotal: 64, success: true },
        id: DEPARTED_HEALTH_CHECK_COMMAND_ID,
        participantId: DEPARTED_PARTICIPANT,
        roundNumber: 1,
        step: "SU" as const,
        type: "roll_round_end_health_check" as const,
      },
    ],
    completedAt: PERSISTED,
    activeParticipantId: DEPARTED_PARTICIPANT,
    currentCursor: cursor(DEPARTED_PARTICIPANT, "SU"),
    distanceState: {
      edges: {
        [`${GM_PARTICIPANT}|${DEPARTED_PARTICIPANT}`]: {
          distance: 3,
          lastChangedRound: 1,
          pairKey: `${GM_PARTICIPANT}|${DEPARTED_PARTICIPANT}`,
          participantAId: GM_PARTICIPANT,
          participantBId: DEPARTED_PARTICIPANT,
          source: "round_end_review",
        },
      },
    },
    phaseResolutionCursor: {
      participantId: DEPARTED_PARTICIPANT,
      phase: "phase1",
      substep: "attack",
    },
    phaseResolutionResults: [
      {
        attackResultId: "1:phase1:" + DEPARTED_PARTICIPANT + ":" + GM_PARTICIPANT,
        attackerParticipantId: DEPARTED_PARTICIPANT,
        criticalRoll: {},
        defenderParticipantId: GM_PARTICIPANT,
        hitLocationRoll: {},
        phase: "phase1",
        roundNumber: 1,
        updatedAt: PERSISTED,
      },
    ],
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
 * Every route in the four scenario route files that can put a combat payload in front of a
 * **player**, enumerated from source rather than sampled.
 *
 * #938. The previous version of this list was 29 and the enumeration behind it was 79 — both
 * corrected here. There are **80** `app.<method>("…")` literal registrations across
 * `encounterRoutes.ts` (60), `combatItemInteractionRoutes.ts` (2), `participantRoutes.ts` (9) and
 * `scenarioRoutes.ts` (9), and **five more** paths that `registerCombatTaskLifecycleRoute`
 * registers from a path variable, so the files serve **85** distinct `(method, path)` pairs. Item
 * 9a derives all of those figures from source. The five added at the end of this list are the ones
 * no literal scan sees, and they are also the handler whose return object carried the blocking
 * finding — which is why the previous sweep never visited them.
 *
 * The old classification was also keyed on one payload key: routes were bucketed by how they build
 * their `encounter`, so `commandEnvelope` sat beside a classified key and was never examined. Item
 * 9b re-derives the enumeration by response key instead.
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
  /*
   * #938 / #925 R1. The five paths `registerCombatTaskLifecycleRoute` registers from a path
   * variable. No scan over `app.post("…")` literals finds them, which is why the 80-registration
   * count does not include them and why the previous sweep never visited them — and two of the
   * twenty-six command-envelope construction sites are inside that one handler. `review`,
   * `resolve` and `finish` answer 403 to a non-GM; `roll` and `advance` do not.
   */
  ["POST", "/encounters/:encounterId/combat-round/review-combat-task"],
  ["POST", "/encounters/:encounterId/combat-round/roll-combat-task"],
  ["POST", "/encounters/:encounterId/combat-round/advance-combat-task"],
  ["POST", "/encounters/:encounterId/combat-round/resolve-combat-task"],
  ["POST", "/encounters/:encounterId/combat-round/finish-combat-task"],
];

function namesTheDeparted(payload: string): boolean {
  return payload.includes(DEPARTED_PARTICIPANT) || payload.includes(DEPARTED_LABEL);
}

/**
 * An order-independent serialisation, for comparing a round record across a write.
 *
 * `JSON.stringify` equality is **unsound** for this comparison and was the previous head's form of
 * it. Persisted combat state is Postgres `jsonb`, which preserves no object key order, so a
 * stringify comparison across a real round trip can fail for a record whose content is identical,
 * and the same unsoundness has produced a wrong measurement twice on this programme. This sorts
 * every object's keys at every depth and leaves array order — which **is** meaningful for commands,
 * participants and snapshots — alone.
 */
function canonicalJson(value: unknown): string {
  const canonicalize = (input: unknown): unknown => {
    if (Array.isArray(input)) return input.map(canonicalize);
    if (input && typeof input === "object") {
      return Object.fromEntries(
        Object.entries(input as Record<string, unknown>)
          .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
          .map(([key, nested]) => [key, canonicalize(nested)]),
      );
    }
    return input;
  };

  return JSON.stringify(canonicalize(value));
}

describe("#925 a completed round is recorded history, not rebuilt from the live roster", () => {
  let stored: EncounterSession;
  let scenarioParticipants: ScenarioParticipant[];

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
    /*
     * Item 8 drives two real player mutations, so the participant-state write has to behave like
     * the service: it persists the session and hands back the saved encounter and participant.
     * Without it the declaration answers 400 and the 200 this item needs is unreachable.
     */
    mocks.encounterService.commitCombatParticipantStateMutation.mockImplementation(
      async (update: {
        participant: ScenarioParticipant;
        session: EncounterSession;
        state: ScenarioParticipant["state"];
      }) => {
        stored = update.session;
        const participant = { ...update.participant, state: update.state };
        scenarioParticipants = scenarioParticipants.map((candidate) =>
          candidate.id === participant.id ? participant : candidate,
        );
        return { encounter: stored, participant };
      },
    );
    scenarioParticipants = liveScenarioParticipants();
    mocks.scenarioService.listScenarioParticipants.mockImplementation(
      async () => scenarioParticipants,
    );
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
  it("holds a persisted round of 2 participants and 8 commands, 4 of them the departed combatant's", () => {
    const archived = stored.combatRoundState?.rounds ?? [];

    expect(archived).toHaveLength(1);
    expect(archived[0]?.participants.map((participant) => participant.participantId)).toEqual([
      GM_PARTICIPANT,
      DEPARTED_PARTICIPANT,
    ]);
    expect(archived[0]?.commands).toHaveLength(8);
    expect(
      archived[0]?.commands.filter((command) => command.participantId === DEPARTED_PARTICIPANT),
    ).toHaveLength(4);
    expect(Object.keys(archived[0]?.roundEndReview?.participantReviews ?? {}).sort()).toEqual(
      [DEPARTED_PARTICIPANT, GM_PARTICIPANT].sort(),
    );
    /*
     * #937. The three fields that were covered by nothing because the fixture left them empty, now
     * populated and owned by the departed combatant, plus `distanceState`. Asserted here so the
     * whole-round comparison in item 1a is not vacuous over them: an assertion over an empty field
     * cannot distinguish the repaired read from the unrepaired one.
     */
    expect(archived[0]?.activeParticipantId).toBe(DEPARTED_PARTICIPANT);
    expect(archived[0]?.phaseResolutionCursor?.participantId).toBe(DEPARTED_PARTICIPANT);
    expect(archived[0]?.phaseResolutionResults).toHaveLength(1);
    expect(archived[0]?.phaseResolutionResults?.[0]?.attackerParticipantId).toBe(
      DEPARTED_PARTICIPANT,
    );
    expect(Object.keys(archived[0]?.distanceState?.edges ?? {})).toHaveLength(1);
    // The summarisable command the latest-event channel travels on, and its identifying id.
    const healthCheck = archived[0]?.commands.at(-1);
    expect(healthCheck?.type).toBe("roll_round_end_health_check");
    expect(healthCheck?.id).toBe(DEPARTED_HEALTH_CHECK_COMMAND_ID);
    expect(healthCheck?.id).toContain(DEPARTED_PARTICIPANT);
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
    expect(archived[0].commands).toHaveLength(8);
    expect(
      archived[0].commands.filter(
        (command: { participantId: string }) => command.participantId === DEPARTED_PARTICIPANT,
      ),
    ).toHaveLength(4);
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
   * The seam that covers every other player encounter payload. The player-reachable routes that
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
   * What this measures and what it does not, stated plainly because the previous head's version of
   * this sweep was judged **not sufficient** and the reason was exactly this. The mutation routes
   * reject a `{}` body, so most of the 34 answer 4xx, and for those the only thing asserted is that
   * the refusal itself names nobody; the item-interactions route answers 500 against this file's
   * stub service, which is a property of the stub and not of the route. **A 4xx closes nothing.**
   * The load-bearing measurement for the command envelope is item 8, which drives a player to a
   * real 200 on one of these routes and reads the summary out of the raw body. The structural
   * guarantee for the encounter payload is item 2c: every route that serialises a player round
   * state does it through `playerFacingCombatRoundStateSchema`, which cannot carry an archived
   * round at all.
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

    expect(results).toHaveLength(34);
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

  // ===== item 8, the command envelope ============================================================

  /**
   * The live round as it stands when a player can act: the staying combatant holds an open Combat
   * Task at their own Phase 1 action opportunity. Built from the same persisted encounter, so the
   * archived round and its departed combatant are untouched.
   *
   * **Round 2 deliberately carries no summarisable command.** `command-live-stayed` is a
   * `declare_action`, and the `advance_combat_task` the drive below appends is not in the summarised
   * set either, which is what lets the backwards walk reach round 1 at all. A
   * `roll_initiative_phase1` command here — the shape the equivalent fixture in `scenarios.test.ts`
   * uses — *is* summarised, the walk would stop in round 2, and this item would measure nothing. The
   * initiative is therefore carried on the participant's own `initiatives` rather than as a command.
   */
  function performTaskLiveEncounter(): EncounterSession {
    const base = persistedEncounter();
    const live = combatRoundStateSchema.parse(base.combatRoundState);
    const taskId = `round:2:participant:${GM_PARTICIPANT}:declaration:perform_task`;

    return {
      ...base,
      combatRoundState: combatRoundStateSchema.parse({
        ...live,
        /*
         * The live `declare_action` carries the phase, which is what
         * `combatRoundStateHasPhaseResolutionEvidence` accepts as support for a phase-step cursor.
         * The alternative evidence it accepts is a `roll_initiative_phase1` command, and that type
         * **is** summarised — using it would stop the backwards walk inside round 2 and make this
         * item measure nothing.
         */
        commands: live.commands.map((command) =>
          command.id === "command-live-stayed" ? { ...command, phase: "phase1" } : command,
        ),
        currentCursor: { participantId: GM_PARTICIPANT, roundNumber: 2, step: "A1" },
        currentStep: "phase_1_actions",
        genericActions: [
          {
            createdAt: PERSISTED,
            createdByUserId: "player-1",
            declarationKind: "perform_task",
            duration: { kind: "gm_decided" },
            id: taskId,
            intent: "Watch the bridge for the retreating band.",
            lastUpdatedAt: PERSISTED,
            ownerParticipantId: GM_PARTICIPANT,
            progress: { completedRounds: 0 },
            status: "declared",
          },
        ],
        participants: live.participants.map((participant) =>
          participant.participantId === GM_PARTICIPANT
            ? {
                ...participant,
                declaration: {
                  actionId: "perform_task",
                  intent: {
                    primaryAction: {
                      actionId: "perform_task",
                      description: "Watch the bridge for the retreating band.",
                      taskId,
                    },
                    relativePositions: [],
                  },
                  roundNumber: 2,
                  submittedAt: PERSISTED,
                  submittedBy: "player",
                },
                initiatives: {
                  phase1: {
                    baseInitiative: 0,
                    modifierAdjustment: 0,
                    rolls: [6],
                    rollTotal: 6,
                    total: 6,
                  },
                },
              }
            : participant,
        ),
        phaseResolutionCursor: {
          participantId: GM_PARTICIPANT,
          phase: "phase1",
          substep: "perform_task",
        },
        phaseResolutionStatuses: {
          [GM_PARTICIPANT]: { phase1: { substep: "perform_task", updatedAt: PERSISTED } },
        },
        selectedParticipantId: GM_PARTICIPANT,
        selectedStep: "phase_1_actions",
      }),
    } as EncounterSession;
  }

  /** Every task the progression projects for a session, flattened. */
  function combatProgressionTasks(session: EncounterSession) {
    const state = initializeCombatRoundState({ encounter: session });
    return buildCombatProgressionProjection(state).boundary.processes.flatMap((process) =>
      process.stages.flatMap((stage) => stage.tasks),
    );
  }

  /**
   * #925 repair cycle 1, the blocking finding (independent QA verdict comment 20613, B1).
   *
   * Driven to an **HTTP 200 as the player**, which is what the previous head's sweep could not do:
   * most of its routes answered 4xx on an empty body, so the only thing it measured for them was
   * that the refusal named nobody, and the verdict says so. `commandEnvelope` is a sibling key of
   * `encounter` in the same return object; the `encounter` was player-projected and the envelope
   * was not.
   *
   * The route is one of the five that `registerCombatTaskLifecycleRoute` registers from a path
   * **variable**, which is why no scan over `app.post("…")` literals counts them, and it is the
   * handler whose return object the reviewer read at the previous head. `advance` is not among the
   * GM-only operations (`review`, `resolve`, `finish`), so a player reaches it.
   *
   * Measured either side of the repair on this same driven 200, with the entitlement gate
   * neutralised for the second reading:
   *
   * - repaired: `200`, `latestEvent` withheld, raw body names the departed combatant **false**;
   * - gate neutralised: `200`,
   *   `summaryText = "Round 1, SU: Sera of the Broken Oath health roll 64 vs 50 succeeded."`,
   *   `commandId = "combat-command:1:8:roll_round_end_health_check:encounter-participant-2:…"`,
   *   raw body names the departed combatant **true**.
   */
  it("item 8 — a player driven to HTTP 200 on an envelope route is never told the departed combatant's name", async () => {
    stored = performTaskLiveEncounter();

    /*
     * Setup, as the GM: the Combat Task's duration is the GM's to decide, so the task becomes
     * advanceable only after a GM review. Its `review_combat_task` command lands in round 2 and is
     * not in the summarised set, so it does not disturb the backwards walk.
     */
    const gmApp = await buildApp();
    const reviewTask = combatProgressionTasks(stored).find(
      (task) => task.expectedCommand === "review_combat_task",
    );
    if (!reviewTask) throw new Error("Expected an open Combat Task review for the GM.");
    const review = await gmApp.inject({
      method: "POST",
      payload: {
        actionId: reviewTask.identity.actionId,
        duration: { kind: "rounds", rounds: 2 },
        executionGroupId: reviewTask.executionGroupId,
        expectedRevision: stored.updatedAt,
        processId: reviewTask.processId,
        rollKind: "none",
        scenarioParticipantId: "participant-1",
        stageId: reviewTask.stageId,
        taskId: reviewTask.id,
      },
      url: "/encounters/encounter-1/combat-round/review-combat-task",
    });
    await gmApp.close();
    expect(review.statusCode, review.payload).toBe(200);

    mocks.requireAuthenticatedUser.mockResolvedValue(mocks.playerUser);
    mocks.requireAdminUser.mockResolvedValue(undefined);
    const app = await buildApp();

    const roundState = initializeCombatRoundState({ encounter: stored });
    const openTask = roundState.genericActions.find(
      (action) => action.declarationKind === "perform_task",
    );
    expect(openTask?.ownerParticipantId).toBe(GM_PARTICIPANT);
    const advanceTask = buildCombatProgressionProjection(roundState)
      .boundary.processes.flatMap((process) => process.stages.flatMap((stage) => stage.tasks))
      .find((task) => task.expectedCommand === "advance_combat_task");
    if (!advanceTask) throw new Error("Expected an open advance task for the player.");

    const response = await app.inject({
      method: "POST",
      payload: {
        actionId: advanceTask.identity.actionId,
        executionGroupId: advanceTask.executionGroupId,
        expectedRevision: stored.updatedAt,
        processId: advanceTask.processId,
        scenarioParticipantId: "participant-1",
        stageId: advanceTask.stageId,
        taskId: advanceTask.id,
      },
      url: "/encounters/encounter-1/combat-round/advance-combat-task",
    });
    await app.close();

    // The load-bearing part: a real 200 with a real body, not a refusal.
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.commandEnvelope).toBeDefined();
    // The archived round is still in storage behind this response, so there was something to leak.
    expect(stored.combatRoundState?.rounds?.[0]?.commands.at(-1)?.id).toBe(
      DEPARTED_HEALTH_CHECK_COMMAND_ID,
    );
    // The raw body, which is the measurement the previous head's sweep could not take.
    expect(namesTheDeparted(response.payload)).toBe(false);
    expect(response.payload).not.toContain(DEPARTED_HEALTH_CHECK_SUMMARY);
    expect(body.commandEnvelope.latestEvent?.summaryText ?? "").not.toContain(DEPARTED_LABEL);
    expect(JSON.stringify(body.commandEnvelope)).not.toContain(DEPARTED_PARTICIPANT);
    /*
     * What the player receives instead: the envelope, with its present-tense fields intact and the
     * latest event withheld. Withheld rather than renamed, because the summary's `commandId` is
     * `buildCombatRoundCommandId`'s output and **embeds the actor's participant id** — redacting the
     * label alone would still hand over the identifier. Asserted positively so this item cannot be
     * satisfied by an empty envelope.
     */
    expect(body.commandEnvelope.currentStep).toBe("phase_1_actions");
    expect(body.commandEnvelope.warnings).toEqual([]);
    expect(body.commandEnvelope.latestEvent).toBeUndefined();
    // And the player still receives their own projected payload beside it, so the route worked.
    expect(body.encounter?.id).toBe("encounter-1");
  });

  /**
   * The negative control for item 8, and the proof that it discriminates.
   *
   * The same builder, the same state, the only difference being the viewer: a GM viewer still
   * receives the departed combatant's recorded label and the command id that embeds their
   * participant id. That is the pre-repair behaviour, reproduced here on purpose. If the viewer
   * parameter were ignored — which is what a repair that only patched the two return sites would
   * leave behind — the player branch would equal the GM branch and item 8 would fail.
   */
  it("item 8 control — the same envelope with a GM viewer does name the departed combatant", () => {
    const state = combatRoundStateSchema.parse(stored.combatRoundState);
    const gmEnvelope = buildCombatRoundCommandEnvelope({ state, viewer: { kind: "gm" } });
    const playerEnvelope = buildCombatRoundCommandEnvelope({
      state,
      viewer: {
        controlledParticipantIds: new Set([GM_PARTICIPANT]),
        kind: "player",
        visibleParticipantIds: new Set([GM_PARTICIPANT]),
      },
    });

    // The channel is live: with a GM viewer the archived round still wins the backwards walk.
    expect(gmEnvelope.latestEvent?.summaryText).toBe(DEPARTED_HEALTH_CHECK_SUMMARY);
    expect(gmEnvelope.latestEvent?.commandId).toBe(DEPARTED_HEALTH_CHECK_COMMAND_ID);
    expect(JSON.stringify(gmEnvelope)).toContain(DEPARTED_LABEL);
    expect(JSON.stringify(gmEnvelope)).toContain(DEPARTED_PARTICIPANT);
    // And the player's differs, by the viewer alone.
    expect(JSON.stringify(playerEnvelope)).not.toContain(DEPARTED_LABEL);
    expect(JSON.stringify(playerEnvelope)).not.toContain(DEPARTED_PARTICIPANT);
    expect(playerEnvelope.latestEvent?.summaryText).not.toBe(gmEnvelope.latestEvent?.summaryText);
  });

  // ===== item 9, the enumeration by response key (#938) ==========================================

  /**
   * #938. The previous enumeration classified **routes** by how they build their `encounter`, so a
   * sibling key in the same return object was fully classified without ever being examined. That
   * sibling was `commandEnvelope`, and it is where the blocking finding lived. This item re-derives
   * the enumeration by **response key** instead, and fixes the registration count.
   *
   * The 80 the reviewer counted is the count of `app.<method>("…")` **literal** registrations, and
   * it is correct for that scan. It is not the number of paths these files serve:
   * `registerCombatTaskLifecycleRoute` registers five more from a path **variable**, which no scan
   * over literals can see — and two of the twenty-six envelope construction sites are inside that
   * registrar, so the five paths a literal scan misses include the ones whose return object carries
   * the leak.
   */
  const ROUTE_FILES = [
    "encounterRoutes.ts",
    "combatItemInteractionRoutes.ts",
    "participantRoutes.ts",
    "scenarioRoutes.ts",
  ] as const;

  function routeFileSource(name: string): string {
    return readFileSync(resolve(__dirname, name), "utf8");
  }

  /** Top-level keys of the object literal whose `{` is at `openBrace`, strings and nesting aware. */
  function objectLiteralKeys(source: string, openBrace: number): string[] {
    const keys: string[] = [];
    let index = openBrace + 1;
    let depth = 0;
    let atKey = true;

    while (index < source.length) {
      const char = source[index]!;
      if (char === '"' || char === "'" || char === "`") {
        const quote = char;
        index += 1;
        while (index < source.length && source[index] !== quote) {
          if (source[index] === "\\") index += 1;
          index += 1;
        }
        index += 1;
        continue;
      }
      if (char === "{" || char === "[" || char === "(") {
        depth += 1;
        index += 1;
        continue;
      }
      if (char === "}" || char === "]" || char === ")") {
        if (depth === 0 && char === "}") return keys;
        depth -= 1;
        index += 1;
        continue;
      }
      if (depth === 0) {
        if (char === ",") {
          atKey = true;
          index += 1;
          continue;
        }
        if (char === " " || char === "\n" || char === "\t" || char === "\r") {
          index += 1;
          continue;
        }
        if (char === "/" && source[index + 1] === "/") {
          index = source.indexOf("\n", index) + 1;
          continue;
        }
        if (char === "/" && source[index + 1] === "*") {
          index = source.indexOf("*/", index) + 2;
          continue;
        }
        if (atKey) {
          const identifier = /^[A-Za-z_$][A-Za-z0-9_$]*/.exec(source.slice(index))?.[0];
          if (identifier) {
            const after = source.slice(index + identifier.length).replace(/^[\s]*/, "")[0];
            if (after === ":" || after === "," || after === "}") {
              keys.push(identifier);
              atKey = false;
              index += identifier.length;
              continue;
            }
          }
          atKey = false;
        }
      }
      index += 1;
    }
    return keys;
  }

  /**
   * Every top-level key any `return { … }` in the four route files produces. Deliberately
   * **over-inclusive**: a route span also contains inner helpers whose own object literals are
   * counted. Over-inclusion is sound for the question this item answers — "is every key a route
   * returns classified" — while under-inclusion is exactly the defect #938 records.
   */
  function derivedResponseKeys(): string[] {
    const keys = new Set<string>();
    for (const file of ROUTE_FILES) {
      const source = routeFileSource(file);
      // Route spans only: from each registration to the next, so module-level helpers elsewhere in
      // the file are not counted. Within a span, inner helpers still are — see over-inclusion above.
      const starts = [...source.matchAll(/\bapp\.(?:get|post|patch|put|delete)\(/g)].map(
        (match) => match.index,
      );
      const literals = [
        ...source.matchAll(/\bapp\.(?:get|post|patch|put|delete)\(\s*\n?\s*"([^"]+)"/g),
      ].map((match) => match.index);
      for (const start of literals) {
        const end = starts.find((candidate) => candidate > start) ?? source.length;
        const span = source.slice(start, end);
        for (const match of span.matchAll(/return\s*\{/g)) {
          for (const key of objectLiteralKeys(span, match.index + match[0].length - 1)) {
            keys.add(key);
          }
        }
      }
    }
    return [...keys].sort();
  }

  /**
   * Every derived key, classified. `viewer-projected` means a non-GM receives a value built through
   * a per-viewer projection; `viewer-gated` means the route answers 403 to a non-GM, so the key
   * never reaches a player; `no-identity` means the value names no participant; `inner-helper`
   * means the key belongs to an object literal inside the route span that is not a response.
   */
  const RESPONSE_KEY_CLASSIFICATION: Readonly<
    Record<string, "viewer-projected" | "viewer-gated" | "no-identity" | "inner-helper">
  > = {
    attackResult: "viewer-gated",
    attempt: "viewer-projected",
    availableItems: "viewer-projected",
    blocker: "viewer-gated",
    boundary: "inner-helper",
    combatExperience: "viewer-projected",
    command: "viewer-projected",
    // #925 R1. The key this item exists for. Its builder now takes a required viewer, and every
    // construction site declares one — asserted mechanically below.
    commandEnvelope: "viewer-projected",
    completedParticipantIds: "viewer-gated",
    declarationProposal: "viewer-gated",
    defenseSnapshot: "viewer-projected",
    description: "inner-helper",
    deterministicAdvance: "viewer-gated",
    difficulty: "no-identity",
    edge: "viewer-gated",
    encounter: "viewer-projected",
    encounters: "viewer-projected",
    eventLogs: "viewer-projected",
    executedTaskIds: "viewer-gated",
    finishKind: "inner-helper",
    gmUserId: "inner-helper",
    history: "viewer-projected",
    idempotent: "no-identity",
    initiative: "viewer-projected",
    items: "viewer-projected",
    joinableScenarios: "viewer-projected",
    kind: "inner-helper",
    name: "inner-helper",
    notes: "inner-helper",
    options: "viewer-projected",
    participant: "viewer-projected",
    participants: "viewer-projected",
    participation: "viewer-gated",
    pendingMissileAttack: "viewer-gated",
    playerOwnedParticipantIds: "viewer-gated",
    processId: "inner-helper",
    progression: "viewer-gated",
    projection: "viewer-gated",
    reason: "inner-helper",
    revision: "no-identity",
    roll: "viewer-projected",
    roundState: "viewer-gated",
    ruleInputs: "inner-helper",
    scenario: "viewer-projected",
    scenarioParticipantId: "inner-helper",
    session: "viewer-projected",
    snapshot: "inner-helper",
    stageId: "inner-helper",
    state: "viewer-gated",
    stopReason: "no-identity",
    stoppedAtParticipantId: "viewer-gated",
    windowOpen: "no-identity",
    workflow: "viewer-gated",
  };

  it("item 9a — the four route files serve 85 paths, of which a literal scan sees only 80", () => {
    const literalByFile = ROUTE_FILES.map((file) => {
      const source = routeFileSource(file);
      return {
        all: [...source.matchAll(/\bapp\.(?:get|post|patch|put|delete)\(/g)].length,
        file,
        literal: [...source.matchAll(/\bapp\.(?:get|post|patch|put|delete)\(\s*\n?\s*"([^"]+)"/g)]
          .length,
      };
    });

    expect(literalByFile).toEqual([
      { all: 61, file: "encounterRoutes.ts", literal: 60 },
      { all: 2, file: "combatItemInteractionRoutes.ts", literal: 2 },
      { all: 9, file: "participantRoutes.ts", literal: 9 },
      { all: 9, file: "scenarioRoutes.ts", literal: 9 },
    ]);
    expect(literalByFile.reduce((total, entry) => total + entry.literal, 0)).toBe(80);

    // The one `app.post(` that names no literal path is the lifecycle registrar, and it registers
    // five paths from its `path` parameter.
    const source = routeFileSource("encounterRoutes.ts");
    const lifecyclePaths = [
      ...source.matchAll(/registerCombatTaskLifecycleRoute\(\s*\n?\s*"([^"]+)"/g),
    ].map((match) => match[1]);
    expect(lifecyclePaths).toEqual([
      "/encounters/:encounterId/combat-round/review-combat-task",
      "/encounters/:encounterId/combat-round/roll-combat-task",
      "/encounters/:encounterId/combat-round/advance-combat-task",
      "/encounters/:encounterId/combat-round/resolve-combat-task",
      "/encounters/:encounterId/combat-round/finish-combat-task",
    ]);
    expect(80 + lifecyclePaths.length).toBe(85);
    // Item 8 drives one of exactly those five.
    expect(lifecyclePaths).toContain("/encounters/:encounterId/combat-round/advance-combat-task");
  });

  it("item 9b — every top-level response key the four files return is classified, with none left over", () => {
    const derived = derivedResponseKeys();

    // The scan found something, so a clean result means something.
    expect(derived.length).toBeGreaterThan(40);
    expect(derived).toContain("encounter");
    // The key the previous enumeration never examined, now derived in its own right.
    expect(derived).toContain("commandEnvelope");

    const unclassified = derived.filter((key) => !(key in RESPONSE_KEY_CLASSIFICATION));
    expect(unclassified).toEqual([]);
    // And the table carries no entry the scan does not find, so it cannot drift into fiction.
    expect(
      Object.keys(RESPONSE_KEY_CLASSIFICATION).filter((key) => !derived.includes(key)),
    ).toEqual([]);
    expect(RESPONSE_KEY_CLASSIFICATION.commandEnvelope).toBe("viewer-projected");
  });

  it("item 9c — every command-envelope construction site in the route files declares its viewer", () => {
    const sites: Array<{ file: string; hasViewer: boolean }> = [];
    for (const file of ROUTE_FILES) {
      const source = routeFileSource(file);
      for (const match of source.matchAll(/buildCombatRoundCommandEnvelope\(\{/g)) {
        const open = match.index + match[0].length - 1;
        const keys = objectLiteralKeys(source, open);
        sites.push({ file, hasViewer: keys.includes("viewer") });
      }
    }

    expect(sites).toHaveLength(26);
    expect(sites.filter((site) => !site.hasViewer)).toEqual([]);
    // Each one resolves the viewer from the route's own authorization rather than asserting a role.
    const source = routeFileSource("encounterRoutes.ts");
    expect(
      [...source.matchAll(/viewer: resolveCombatRoundCommandEnvelopeViewer\(\{/g)].length,
    ).toBe(26);
    expect([...source.matchAll(/mode: access\.mode,/g)].length).toBe(26);
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
    const before = canonicalJson(stored.combatRoundState?.rounds);
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
    // The archive is identical across that write, compared order-independently, and the archive
    // count is unchanged.
    expect(canonicalJson(stored.combatRoundState?.rounds)).toBe(before);
    expect(stored.combatRoundState?.rounds).toHaveLength(beforeArchiveCount ?? -1);
    expect(stored.combatRoundState?.rounds?.[0]?.commands).toHaveLength(8);
    expect(stored.combatRoundState?.rounds?.[0]?.participants).toHaveLength(2);
    // #937. The three previously unguarded overrides survive the write too.
    expect(stored.combatRoundState?.rounds?.[0]?.activeParticipantId).toBe(DEPARTED_PARTICIPANT);
    expect(stored.combatRoundState?.rounds?.[0]?.phaseResolutionCursor?.participantId).toBe(
      DEPARTED_PARTICIPANT,
    );
    expect(stored.combatRoundState?.rounds?.[0]?.phaseResolutionResults).toHaveLength(1);
    // Take-back reaches the current round only: round 1 stays archived and round 2 stays live.
    expect(stored.combatRoundState?.roundNumber).toBe(2);
    expect(stored.combatRoundState?.rounds?.[0]?.roundNumber).toBe(1);
  });
});
