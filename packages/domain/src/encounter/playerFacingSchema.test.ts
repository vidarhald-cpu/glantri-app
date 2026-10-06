import { describe, expect, it } from "vitest";
import { z } from "zod";

import { combatBreakOffProposalSchema } from "./combatBreakOff";
import { playerFacingCombatBreakOffProposalSchema } from "./playerFacingCombatRoundStructures";
import {
  brandPlayerFacing,
  buildPlayerFacing,
  findLeafViolation,
  findWholePathViolations,
  isPlayerFacingObjectSchema,
  LEAF,
  playerFacingObject,
  playerFacingVariant,
  TIER_4_OPEN_COMMAND_FACTS,
} from "./playerFacingSchema";

/** Forgejo #517 (privacy hardening, Tier 3): the construction kit's own guarantees. */

describe("#517 player-facing schema kit: leaves", () => {
  it("treats a value that holds no object at any depth as a leaf, and nothing else", () => {
    for (const leaf of [
      z.string(),
      z.number().int().optional(),
      z.enum(["a", "b"]).default("a"),
      z.array(z.literal(1)),
      z.record(z.string(), z.boolean()),
      z.union([z.string(), z.array(z.number())]),
      z.string().refine((value) => value.length > 0),
      z.preprocess((value) => value, z.number()),
      z.array(z.never()),
    ]) {
      expect(findLeafViolation(leaf)).toBeUndefined();
    }
    for (const composite of [
      z.object({}),
      z.array(z.object({ a: z.string() })),
      z.record(z.string(), z.object({})),
      z.unknown(),
      z.any(),
      z.record(z.string(), z.unknown()),
      z.lazy(() => z.string()),
      z.string().transform((value) => ({ value })),
      z.union([z.string(), z.object({})]),
    ]) {
      expect(findLeafViolation(composite)).toBeDefined();
    }
  });
});

describe("#517 player-facing schema kit: construction", () => {
  it("refuses an object field marked LEAF, at compile time and when the module loads", () => {
    expect(() =>
      playerFacingObject("Leaf", combatBreakOffProposalSchema, {
        // @ts-expect-error An object-valued field cannot be reused from the internal schema.
        attackerRoll: LEAF,
      }),
    ).toThrow(/reuses an internal schema/);
  });

  it("refuses a field built from an internal object schema", () => {
    expect(() =>
      playerFacingObject("Internal", combatBreakOffProposalSchema, {
        attackerRoll: combatBreakOffProposalSchema.shape.attackerRoll,
      }),
    ).toThrow(/not whole-path/);
  });

  it("refuses an open value, and a field its internal schema does not have", () => {
    expect(() =>
      playerFacingObject("Open", combatBreakOffProposalSchema, {
        attackerRoll: z.unknown(),
      }),
    ).toThrow(/not whole-path/);
    expect(() =>
      playerFacingObject("Extra", combatBreakOffProposalSchema, {
        // @ts-expect-error A player-facing object names only fields of its internal schema.
        notAField: LEAF,
      }),
    ).toThrow(/not a field/);
  });

  it("registers its objects, which strip unknown keys, and brands them", () => {
    const variant = playerFacingVariant("Variant", z.object({ kind: z.literal("a") }), {
      kind: LEAF,
    });
    const other = playerFacingVariant("Other", z.object({ kind: z.literal("b") }), {
      kind: LEAF,
    });
    const object = playerFacingObject("Object", z.object({ id: z.string() }), { id: LEAF });

    expect(isPlayerFacingObjectSchema(variant)).toBe(true);
    expect(isPlayerFacingObjectSchema(object.unwrap())).toBe(true);
    expect(isPlayerFacingObjectSchema(z.object({}))).toBe(false);
    expect(object.parse({ id: "x", extra: "SECRET" })).toEqual({ id: "x" });
    expect(findWholePathViolations(brandPlayerFacing("Union", z.union([variant, other])))).toEqual(
      [],
    );
  });

  it("admits the Tier 4 command facts record as the only open value", () => {
    expect(findWholePathViolations(z.object({ facts: TIER_4_OPEN_COMMAND_FACTS }))).toEqual([
      "$: an internal object schema",
    ]);
    const command = playerFacingObject(
      "Command",
      z.object({ facts: z.record(z.string(), z.unknown()) }),
      { facts: TIER_4_OPEN_COMMAND_FACTS },
    );
    expect(findWholePathViolations(command)).toEqual([]);
    expect(findWholePathViolations(z.record(z.string(), z.unknown()))).not.toEqual([]);
  });
});

describe("#517 player-facing schema kit: buildPlayerFacing", () => {
  const proposal = combatBreakOffProposalSchema.parse({
    attackerParticipantId: "attacker",
    attackerRoll: {
      calculation: {
        baseSkill: 10,
        calculationId: "calculation",
        contestType: "break_off",
        derivedIntegerAdjustment: 0,
        finalResult: 20,
        governingStat: { id: "agility", label: "Agility", value: 10 },
        openEndedDie: { openEndedD10s: [], rollD20: 10, rollTotal: 10 },
        participantId: "attacker",
        preDieTotal: 10,
        role: "break_off_attacker",
        skill: { id: "dodge", label: "Dodge", totalXp: 10 },
        totalPercentageAdjustment: 0,
      },
      finalTotal: 20,
      id: "roll",
      participantId: "attacker",
      rolledAt: "2026-10-06T08:00:00.000Z",
      rolledByUserId: "SECRET_ROLLER",
    },
    committedByUserId: "SECRET_COMMITTER",
    escapeeParticipantId: "escapee",
    gmReview: { notes: "SECRET_GM_NOTE" },
    id: "proposal",
    pairKey: "attacker::escapee",
    roundNumber: 1,
  });

  it("reads only the fields the schema names and applies the overrides given", () => {
    const player = buildPlayerFacing(
      playerFacingCombatBreakOffProposalSchema,
      { ...proposal, futureField: "SECRET_FUTURE" },
      { attackerRoll: undefined },
    );

    expect(JSON.stringify(player)).not.toContain("SECRET");
    expect(player).not.toHaveProperty("attackerRoll");
    expect(player.gmReview).toEqual({ attackerAdjustment: 0, escapeeAdjustment: 0 });
    expect(player.id).toBe("proposal");
  });

  it("strips every level the schema names, not only the top", () => {
    const player = buildPlayerFacing(playerFacingCombatBreakOffProposalSchema, proposal);

    expect(player.attackerRoll).toBeDefined();
    expect(JSON.stringify(player)).not.toContain("SECRET");
  });

  it("refuses a schema that is not a player-facing object", () => {
    expect(() => buildPlayerFacing(z.object({ id: z.string() }), { id: "x" })).toThrow(
      /player-facing object schema/,
    );
  });
});
