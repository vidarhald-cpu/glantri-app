import { readdirSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  accrueCombatCriticalBleed,
  combatCriticalDurationSchema,
  combatCriticalEndEventSchema,
  getCombatCriticalBleedEffectiveRate,
  getCombatCriticalEndEventConditionKind,
  transitionCombatCriticalBleedControl,
} from "./combatCriticalRuntime";
import {
  canonicalCombatModifierConditionKindSchema,
  canonicalCombatModifierDurationUnitSchema,
} from "./combatModifierLifecycle";

const external = {
  allowedControlStates: ["active", "partial", "staunched_zero", "resolved"] as const,
  controlState: "active" as const,
  currentRate: { denominator: 3, numerator: 1 },
  firstTickRound: 2,
  kind: "external" as const,
  rate: { denominator: 3, numerator: 1 },
  sourceEffectKey: "pointed_weapons|arm|09|03",
  sourceRate: "1 HP / 3 rounds",
};

const internal = {
  allowedControlStates: ["active", "stabilised", "resolved"] as const,
  controlState: "active" as const,
  currentRate: { denominator: 2, numerator: 1 },
  firstTickRound: 2,
  kind: "internal" as const,
  rate: { denominator: 2, numerator: 1 },
  sourceEffectKey: "sharp|chest|09|03",
  sourceRate: "1 HP / 2 rounds",
};

describe("C1 Critical runtime", () => {
  it("adds exact sources before applying whole HP and reduces the carried remainder", () => {
    expect(
      accrueCombatCriticalBleed({
        activeRates: [external.rate, internal.rate],
        previousRemainder: { denominator: 6, numerator: 5 },
      }),
    ).toEqual({
      appliedHp: 1,
      remainder: { denominator: 3, numerator: 2 },
      total: { denominator: 3, numerator: 5 },
    });
  });

  it("supports explicit external partial/staunched states without giving them to internal Bleed", () => {
    const partial = transitionCombatCriticalBleedControl({
      bleed: { ...external, allowedControlStates: [...external.allowedControlStates] },
      nextState: "partial",
      partialRate: { denominator: 6, numerator: 1 },
    });
    const staunched = transitionCombatCriticalBleedControl({
      bleed: partial,
      nextState: "staunched_zero",
    });

    expect(getCombatCriticalBleedEffectiveRate(partial)).toEqual({
      denominator: 6,
      numerator: 1,
    });
    expect(getCombatCriticalBleedEffectiveRate(staunched)).toEqual({
      denominator: 1,
      numerator: 0,
    });
    expect(() =>
      transitionCombatCriticalBleedControl({
        bleed: { ...internal, allowedControlStates: [...internal.allowedControlStates] },
        nextState: "partial",
        partialRate: { denominator: 4, numerator: 1 },
      }),
    ).toThrow("not an allowed control state");
    expect(() =>
      transitionCombatCriticalBleedControl({
        bleed: { ...external, allowedControlStates: [...external.allowedControlStates] },
        nextState: "partial",
        partialRate: { denominator: 1, numerator: 0 },
      }),
    ).toThrow("must retain a positive current rate");
  });
});

describe("[#215 S6] structured Critical termination events", () => {
  // The seven phrases the accepted source authors, counted at the frozen baseline across the 33
  // production call sites in representativeCriticalFixtures.ts.
  const AUTHORED_PHRASES = {
    appropriate_care: "until appropriate care",
    controlled_removal_and_care: "until controlled removal and care",
    extinguishing_flames: "while rolling to extinguish flames",
    flames_extinguished: "until flames extinguished",
    mapped_staunch_event: "until the mapped staunch event",
    separately_resolved: "until separately resolved",
    staunched: "until staunched",
  } as const;

  it("reads a pre-S6 stored duration fact unchanged, with no binding field invented on read", () => {
    // This is the exact shape of every pre-S6 `until_event` fact: free text, no `endEvent`. If the
    // widening were anything but additive this parse would fail, and the undo-restore path drops a
    // failed parse silently.
    const preS6 = { kind: "until_event", text: "until appropriate care" };
    const parsed = combatCriticalDurationSchema.safeParse(preS6);

    expect(parsed.success).toBe(true);
    expect(parsed.data).toEqual(preS6);
    expect(parsed.data).not.toHaveProperty("endEvent");
  });

  it("keeps `text` required, so no stored fact is weakened to simplify the binding", () => {
    expect(combatCriticalDurationSchema.safeParse({ kind: "until_event" }).success).toBe(false);
    expect(combatCriticalDurationSchema.safeParse({ kind: "until_event", text: "" }).success).toBe(
      false,
    );
    expect(
      combatCriticalDurationSchema.safeParse({
        endEvent: "appropriate_care",
        kind: "until_event",
      }).success,
    ).toBe(false);
  });

  it("round-trips a structured binding alongside the authored text", () => {
    for (const [endEvent, text] of Object.entries(AUTHORED_PHRASES)) {
      const parsed = combatCriticalDurationSchema.parse({ endEvent, kind: "until_event", text });
      expect(parsed).toEqual({ endEvent, kind: "until_event", text });
    }
    expect(combatCriticalEndEventSchema.options).toEqual(Object.keys(AUTHORED_PHRASES));
  });

  it("rejects an unbound free-text phrase as an event member", () => {
    expect(combatCriticalEndEventSchema.safeParse("until appropriate care").success).toBe(false);
    expect(combatCriticalEndEventSchema.safeParse("treated").success).toBe(false);
  });

  it("maps each event onto the canonical persisted vocabulary and nowhere else", () => {
    const canonical = new Set(canonicalCombatModifierConditionKindSchema.options);

    for (const endEvent of combatCriticalEndEventSchema.options) {
      const conditionKind = getCombatCriticalEndEventConditionKind(endEvent);
      // Either a member of the one canonical vocabulary, or an explicit absence. Never a second
      // encoding of the same distinction.
      if (conditionKind !== null) expect(canonical.has(conditionKind)).toBe(true);
    }

    // The treatment-gated events are what the source's `end_trigger: treated` names.
    expect(getCombatCriticalEndEventConditionKind("appropriate_care")).toBe("treated");
    expect(getCombatCriticalEndEventConditionKind("controlled_removal_and_care")).toBe("treated");
    expect(getCombatCriticalEndEventConditionKind("mapped_staunch_event")).toBe("treated");
    expect(getCombatCriticalEndEventConditionKind("staunched")).toBe("treated");
    expect(getCombatCriticalEndEventConditionKind("flames_extinguished")).toBe(
      "source_process_completed",
    );
    expect(getCombatCriticalEndEventConditionKind("extinguishing_flames")).toBe(
      "source_process_completed",
    );
    // The source names no transition this vocabulary can express for separately tracked function
    // changes, so the mapping says so instead of guessing one.
    expect(getCombatCriticalEndEventConditionKind("separately_resolved")).toBeNull();
  });
});

describe("[#215 S6] the Critical runtime duration references the canonical unit vocabulary", () => {
  it("INVARIANT 5 — `unit` is the canonical schema itself, not a parallel list of members", () => {
    // Identity, not equality of members: this schema IS the canonical one, so the two cannot drift.
    expect(combatCriticalDurationSchema.shape.unit.unwrap()).toBe(
      canonicalCombatModifierDurationUnitSchema,
    );
    expect(combatCriticalDurationSchema.shape.unit.unwrap().options).toEqual(["round", "hour"]);
  });

  it("INVARIANT 5 — the canonical unit members are declared in exactly one source file", () => {
    // A hand-maintained second enumeration of the same members would be invisible to the compiler
    // and to every behavioural assertion, so it is searched for directly rather than assumed away.
    const sources = readdirSync(new URL(".", import.meta.url))
      .filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts"))
      .map((name) => ({
        name,
        text: readFileSync(new URL(`./${name}`, import.meta.url), "utf8"),
      }));
    const declarations = sources.filter((source) =>
      /z\s*\.\s*enum\s*\(\s*\[\s*"round"\s*,\s*"hour"\s*\]/u.test(source.text),
    );

    expect(declarations.map((source) => source.name)).toEqual(["combatModifierLifecycle.ts"]);
  });

  it("INVARIANT 3 — an hour-measured rolled fact round-trips with `unit` intact", () => {
    const hourFact = {
      formula: "d4",
      kind: "roll_once",
      storedRoll: 3,
      text: "D4 hours",
      unit: "hour",
    } as const;
    const parsed = combatCriticalDurationSchema.parse({ ...hourFact });

    expect(parsed).toEqual(hourFact);
    expect(parsed.unit).toBe("hour");
    // `rounds` stays absent: an hour quantity is never expressed as a round count, which is why no
    // clock is needed to store it faithfully.
    expect(parsed.rounds).toBeUndefined();
    expect(JSON.parse(JSON.stringify(parsed))).toEqual(hourFact);
  });

  it("INVARIANT 1 — a stored duration fact without `unit` is unchanged by the widening", () => {
    const preUnit = {
      formula: "d4",
      kind: "roll_once",
      rounds: 3,
      storedRoll: 3,
      text: "D4 rounds",
    };
    const parsed = combatCriticalDurationSchema.parse({ ...preUnit });

    expect(parsed).toEqual(preUnit);
    expect(Object.keys(parsed).includes("unit")).toBe(false);
  });

  it("rejects an unknown unit rather than coercing or defaulting it", () => {
    for (const unit of ["hours", "minute", "rounds", ""]) {
      expect(
        combatCriticalDurationSchema.safeParse({ kind: "roll_once", text: "D4 hours", unit })
          .success,
      ).toBe(false);
    }
  });
});
