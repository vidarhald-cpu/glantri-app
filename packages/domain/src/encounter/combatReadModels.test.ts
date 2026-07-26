import { describe, expect, it } from "vitest";

import {
  activeCombatStateViewSchema,
  buildActiveCombatStateViewFromPersistedSession,
  buildArchivedCombatRoundsViewFromPersistedSession,
  buildCombatHistorySourceViewFromPersistedSession,
  buildCombatHistorySourceViewFromState,
  buildEncounterMetadataView,
  combatHistorySourceViewSchema,
  combatRoundStateSchema,
  encounterMetadataViewSchema,
  materializeCombatHistoryRoundState,
  projectCombatHistory,
} from "../index";

const metadata = {
  campaignId: "campaign-1",
  createdAt: "2026-07-26T09:00:00.000Z",
  encounterId: "encounter-1",
  revision: "2026-07-26T10:00:00.000Z",
  scenarioId: "scenario-1",
  status: "active",
  title: "Courtyard",
} as const;

function sessionJson() {
  return {
    combatRoundState: combatRoundStateSchema.parse({
      encounterId: "encounter-1",
      events: [],
      participants: [
        { label: "Aria", participantId: "aria" },
        { label: "Borin", participantId: "borin" },
      ],
      roundNumber: 3,
      rounds: [
        { encounterId: "encounter-1", roundNumber: 1 },
        {
          encounterId: "encounter-1",
          roundNumber: 2,
          stepSnapshots: [],
        },
      ],
    }),
    currentRound: 3,
    participants: [
      {
        id: "aria",
        label: "Aria",
        participantType: "scenario",
        scenarioParticipantId: "scenario-aria",
      },
      {
        id: "borin",
        label: "Borin",
        participantType: "scenario",
        scenarioParticipantId: "scenario-borin",
      },
    ],
    roleplayState: {
      deliberatelyMalformedUnrelatedHistory: { nested: true },
      visibility: { aria: { borin: true } },
    },
    unrelatedWorkspacePayload: {
      commands: [{ recursive: "not part of this view" }],
    },
  };
}

describe("combat read models", () => {
  it("keeps metadata strict and free of combat state", () => {
    const view = buildEncounterMetadataView(metadata);

    expect(view).toMatchObject({
      encounterId: "encounter-1",
      revision: metadata.revision,
      viewVersion: 1,
    });
    expect(() =>
      encounterMetadataViewSchema.parse({
        ...view,
        combatRoundState: {},
      }),
    ).toThrow();
  });

  it("keeps active state separate from archived rounds", () => {
    const view = buildActiveCombatStateViewFromPersistedSession({
      metadata,
      sessionJson: sessionJson(),
    });

    expect(view.activeCombatState?.roundNumber).toBe(3);
    expect(view.activeCombatState).not.toHaveProperty("rounds");
    expect(() =>
      activeCombatStateViewSchema.parse({
        ...view,
        archivedRounds: [],
      }),
    ).toThrow();
    expect(() =>
      activeCombatStateViewSchema.parse({
        ...view,
        activeCombatState: {
          ...view.activeCombatState,
          rounds: [],
        },
      }),
    ).toThrow();
  });

  it("preserves archived ordering and reads legacy-defaulted round variants", () => {
    const view = buildArchivedCombatRoundsViewFromPersistedSession({
      metadata,
      sessionJson: sessionJson(),
    });

    expect(view.archivedRounds.map((round) => round.roundNumber)).toEqual([1, 2]);
    expect(view.archivedRounds[0]).toMatchObject({
      commands: [],
      events: [],
      participants: [],
      roundNumber: 1,
      stepSnapshots: [],
    });
  });

  it("extracts only required history data and ignores unrelated malformed fields", () => {
    const input = sessionJson();
    const source = buildCombatHistorySourceViewFromPersistedSession({
      metadata,
      sessionJson: {
        ...input,
        actionLog: "malformed but unrelated to combat history",
        roleplayState: {
          ...input.roleplayState,
          actionLog: "malformed but unrelated to combat history",
        },
      },
    });

    expect(source).toMatchObject({
      encounterId: "encounter-1",
      revision: metadata.revision,
      viewVersion: 1,
    });
    expect(source.archivedRounds).toHaveLength(2);
    expect(source).not.toHaveProperty("actionLog");
    expect(source).not.toHaveProperty("unrelatedWorkspacePayload");
    expect(() =>
      combatHistorySourceViewSchema.parse({
        ...source,
        scenarioContent: { private: true },
      }),
    ).toThrow();
  });

  it("rejects malformed required active or archived history data", () => {
    expect(() =>
      buildCombatHistorySourceViewFromPersistedSession({
        metadata,
        sessionJson: {
          ...sessionJson(),
          combatRoundState: { roundNumber: "three" },
        },
      }),
    ).toThrow();

    expect(() =>
      buildCombatHistorySourceViewFromPersistedSession({
        metadata,
        sessionJson: {
          ...sessionJson(),
          combatRoundState: {
            ...sessionJson().combatRoundState,
            rounds: [{ roundNumber: "one" }],
          },
        },
      }),
    ).toThrow();
  });

  it("reconstructs exact state identity without mixing active and archived revisions", () => {
    const source = buildCombatHistorySourceViewFromPersistedSession({
      metadata,
      sessionJson: sessionJson(),
    });
    const state = materializeCombatHistoryRoundState(source);

    expect(state?.encounterId).toBe(source.encounterId);
    expect(state?.rounds.map((round) => round.roundNumber)).toEqual([1, 2]);
    expect(source.revision).toBe(source.updatedAt);
  });

  it("projects unchanged GM and player-safe history from the narrow source", () => {
    const state = combatRoundStateSchema.parse({
      encounterId: "encounter-1",
      events: [
        {
          completeness: "complete",
          encounterId: "encounter-1",
          facts: {
            gmReview: { secret: "gm only" },
            publicOutcome: { summary: "Aria acted." },
            rollerPrivate: { die: 12 },
          },
          id: "event-1",
          missingFacts: [],
          occurredAt: "2026-07-26T10:00:01.000Z",
          ownerParticipantId: "aria",
          rollerParticipantId: "aria",
          roundNumber: 1,
          schemaVersion: 1,
          sequence: 1,
          source: { kind: "canonical", sourceIds: [] },
          status: "recorded",
          step: "phase_1_actions",
          type: "attack",
          visibility: {
            identityRefs: [{ participantId: "aria", role: "attacker" }],
            involvedParticipantIds: ["aria"],
            outcomeScope: "public",
            rollerParticipantId: "aria",
          },
        },
      ],
      participants: [{ label: "Aria", participantId: "aria" }],
    });
    const source = buildCombatHistorySourceViewFromState({
      revision: metadata.revision,
      state,
    });
    const participants = [{ displayName: "Aria", participantId: "aria" }];
    const gm = projectCombatHistory({
      participants,
      source,
      viewer: { kind: "gm" },
    });
    const player = projectCombatHistory({
      participants,
      source,
      viewer: {
        controlledParticipantIds: new Set(["aria"]),
        kind: "player",
        visibleParticipantIds: new Set(["aria"]),
      },
    });

    expect(gm.sourceEncounterId).toBe("encounter-1");
    expect(gm.sourceUpdatedAt).toBe(metadata.revision);
    expect(gm.activeRound.events[0]?.facts.gmReview).toEqual({ secret: "gm only" });
    expect(player.activeRound.events[0]?.facts.gmReview).toBeUndefined();
    expect(player.activeRound.events[0]?.facts.privateCalculation).toEqual({ die: 12 });
  });
});
