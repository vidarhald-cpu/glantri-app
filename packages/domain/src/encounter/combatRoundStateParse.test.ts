import { describe, expect, it } from "vitest";
import { ZodError } from "zod";

import {
  buildCombatHistorySourceViewFromPersistedSession,
  composeEncounterSessionFromSplitCombatPersistence,
  combatRoundStateSchema,
  encounterSessionSchema,
  initializeCombatRoundState,
  parseCombatRoundState,
  safeParseCombatRoundState,
  splitEncounterSessionForCombatPersistence,
  type CombatRoundState,
  type EncounterSession,
} from "../index";

/**
 * #1145. `parseCombatRoundState` returns a state it has itself produced without walking it again.
 * Everything else — a state read from storage, a client payload, or a new object built from a
 * parsed state — must still be validated in full and refused exactly as `combatRoundStateSchema`
 * refuses it.
 */

const metadata = {
  campaignId: "campaign-1",
  createdAt: "2026-11-11T09:00:00.000Z",
  encounterId: "encounter-1",
  revision: "2026-11-11T10:00:00.000Z",
  scenarioId: "scenario-1",
  status: "active",
  title: "Courtyard",
} as const;

function rawState() {
  return {
    encounterId: "encounter-1",
    participants: [
      { label: "Aria", participantId: "aria" },
      { label: "Borin", participantId: "borin" },
    ],
    roundNumber: 2,
    rounds: [{ encounterId: "encounter-1", roundNumber: 1 }],
  };
}

function session(combatRoundState: unknown): EncounterSession {
  return encounterSessionSchema.parse({
    campaignId: metadata.campaignId,
    combatRoundState,
    createdAt: metadata.createdAt,
    currentRound: 2,
    id: metadata.encounterId,
    kind: "combat",
    participants: [
      { id: "aria", label: "Aria", participantType: "scenario", scenarioParticipantId: "s-aria" },
      {
        id: "borin",
        label: "Borin",
        participantType: "scenario",
        scenarioParticipantId: "s-borin",
      },
    ],
    scenarioId: metadata.scenarioId,
    status: "active",
    title: metadata.title,
    updatedAt: metadata.revision,
  });
}

function zodIssues(run: () => unknown) {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(ZodError);
    return (error as ZodError).issues;
  }
  throw new Error("expected the parse to be refused");
}

const malformedVariants: [string, (state: CombatRoundState) => unknown][] = [
  ["a non-integer round number", (state) => ({ ...state, roundNumber: 2.5 })],
  ["a participants value that is not a list", (state) => ({ ...state, participants: "aria" })],
  ["a participant without an id", (state) => ({ ...state, participants: [{ label: "Aria" }] })],
  ["an unknown current step", (state) => ({ ...state, currentStep: "not_a_step" })],
  [
    "an archived round with a text round number",
    (state) => ({ ...state, rounds: [{ roundNumber: "one" }] }),
  ],
];

describe("parseCombatRoundState (#1145)", () => {
  it("normalises a fresh input exactly as the schema does, as a new object", () => {
    const input = rawState();
    const parsed = parseCombatRoundState(input);

    expect(parsed).toEqual(combatRoundStateSchema.parse(rawState()));
    expect(parsed).not.toBe(input);
    // Defaults are applied to the fresh input.
    expect(parsed.currentStep).toBe("select_actions");
    expect(parsed.commands).toEqual([]);
    expect(parsed.distanceState).toEqual({ edges: {} });
  });

  it("returns its own earlier result as it is, equal to a full re-parse", () => {
    const parsed = parseCombatRoundState(rawState());

    expect(parseCombatRoundState(parsed)).toBe(parsed);
    expect(combatRoundStateSchema.parse(parsed)).toEqual(parsed);
  });

  it("parses a schema result it did not produce itself in full", () => {
    const fromSchema = combatRoundStateSchema.parse(rawState());
    const parsed = parseCombatRoundState(fromSchema);

    expect(parsed).not.toBe(fromSchema);
    expect(parsed).toEqual(fromSchema);
  });

  it("strips unknown keys from a new object built by spreading a parsed state", () => {
    const parsed = parseCombatRoundState(rawState());
    const next = parseCombatRoundState({ ...parsed, notAStateField: true, roundNumber: 3 });

    expect(next).not.toBe(parsed);
    expect(next.roundNumber).toBe(3);
    expect(next).not.toHaveProperty("notAStateField");
  });

  it.each(malformedVariants)(
    "refuses a fresh payload with %s, with the schema's own error",
    (_label, malform) => {
      const payload = malform(combatRoundStateSchema.parse(rawState()));

      expect(zodIssues(() => parseCombatRoundState(payload))).toEqual(
        zodIssues(() => combatRoundStateSchema.parse(payload)),
      );
    },
  );

  it.each(malformedVariants)(
    "refuses a new object built from an already parsed state with %s",
    (_label, malform) => {
      const parsed = parseCombatRoundState(rawState());
      // Parsing the parsed state again warms the shortcut; the object built from it is new.
      parseCombatRoundState(parsed);
      const payload = malform(parsed);

      expect(zodIssues(() => parseCombatRoundState(payload))).toEqual(
        zodIssues(() => combatRoundStateSchema.parse(payload)),
      );
    },
  );

  it("safe-parses with the same shortcut and the same refusals", () => {
    const parsed = parseCombatRoundState(rawState());
    expect(safeParseCombatRoundState(parsed)).toEqual({ data: parsed, success: true });
    expect(safeParseCombatRoundState(parsed).data).toBe(parsed);

    const fresh = safeParseCombatRoundState(rawState());
    expect(fresh).toEqual(combatRoundStateSchema.safeParse(rawState()));
    expect(fresh.success && parseCombatRoundState(fresh.data)).toBe(fresh.data);

    for (const [, malform] of malformedVariants) {
      const payload = malform(parsed);
      const result = safeParseCombatRoundState(payload);
      expect(result.success).toBe(false);
      expect(result.error?.issues).toEqual(combatRoundStateSchema.safeParse(payload).error?.issues);
    }
  });

  it("refuses a parsed state that comes back malformed through storage (JSON)", () => {
    const parsed = parseCombatRoundState(rawState());
    const stored = JSON.parse(JSON.stringify(parsed)) as Record<string, unknown>;
    stored.roundNumber = "two";

    expect(() => parseCombatRoundState(stored)).toThrow(ZodError);
  });

  it("still refuses malformed stored combat state on the read path after a valid read", () => {
    const valid = session(rawState());
    const parts = splitEncounterSessionForCombatPersistence(valid);
    // A valid read first, so every parse cache is warm.
    const read = composeEncounterSessionFromSplitCombatPersistence({ ...parts, metadata });
    expect(read.combatRoundState?.roundNumber).toBe(2);

    const storedActive = JSON.parse(JSON.stringify(parts.activeCombatState)) as Record<
      string,
      unknown
    >;
    expect(() =>
      composeEncounterSessionFromSplitCombatPersistence({
        ...parts,
        activeCombatState: { ...storedActive, participants: [{ label: "No id" }] },
        metadata,
      }),
    ).toThrow();
    expect(() =>
      composeEncounterSessionFromSplitCombatPersistence({
        ...parts,
        archivedRounds: [{ roundNumber: "one" }],
        metadata,
      }),
    ).toThrow();
    expect(() =>
      buildCombatHistorySourceViewFromPersistedSession({
        metadata,
        sessionJson: {
          ...JSON.parse(JSON.stringify(valid)),
          combatRoundState: { roundNumber: "two" },
        },
      }),
    ).toThrow();
  });

  it("still refuses a client session whose combat state is malformed, even one built from a parsed state", () => {
    const parsed = parseCombatRoundState(
      initializeCombatRoundState({ encounter: session(undefined) }),
    );
    parseCombatRoundState(parsed);

    expect(() =>
      encounterSessionSchema.parse({
        ...session(undefined),
        combatRoundState: { ...parsed, participants: [{ label: "No id" }] },
      }),
    ).toThrow();
    expect(() =>
      encounterSessionSchema.parse(
        JSON.parse(
          JSON.stringify({
            ...session(undefined),
            combatRoundState: { ...parsed, roundNumber: 0 },
          }),
        ),
      ),
    ).toThrow();
  });
});
