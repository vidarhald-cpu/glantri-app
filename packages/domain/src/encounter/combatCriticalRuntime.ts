import { z } from "zod";

import {
  canonicalCombatModifierDurationUnitSchema,
  type CanonicalCombatModifierConditionKind,
} from "./combatModifierLifecycle";

export const combatCriticalExactRationalSchema = z
  .object({
    denominator: z.number().int().positive(),
    numerator: z.number().int().nonnegative(),
  })
  .readonly();
export type CombatCriticalExactRational = z.infer<typeof combatCriticalExactRationalSchema>;

/**
 * The authored termination events carried by `until_event` Critical durations. Each member names
 * exactly one of the free-text phrases the accepted Critical source authors, so the binding adds
 * structure without adding a rule: nothing here invents a check, a DC, a duration or a clock.
 *
 * - `appropriate_care` — "until appropriate care".
 * - `controlled_removal_and_care` — "until controlled removal and care".
 * - `extinguishing_flames` — "while rolling to extinguish flames".
 * - `flames_extinguished` — "until flames extinguished".
 * - `mapped_staunch_event` — "until the mapped staunch event".
 * - `separately_resolved` — "until separately resolved".
 * - `staunched` — "until staunched".
 */
export const combatCriticalEndEventSchema = z.enum([
  "appropriate_care",
  "controlled_removal_and_care",
  "extinguishing_flames",
  "flames_extinguished",
  "mapped_staunch_event",
  "separately_resolved",
  "staunched",
]);
export type CombatCriticalEndEvent = z.infer<typeof combatCriticalEndEventSchema>;

/**
 * Maps an authored Critical termination event onto the canonical persisted condition/event
 * vocabulary in `combatModifierLifecycle.ts`. This is the only place the correspondence is stated,
 * which is what keeps `treated` a single canonical meaning rather than a second encoding.
 *
 * `null` means the accepted source names no canonical class for that event, so it stays GM-manual.
 * `separately_resolved` is the only such member today: the source tracks those function changes as
 * their own separately adjudicated records and states no transition this vocabulary can express.
 * Returning `null` is deliberate — guessing a class here would fabricate a rule.
 *
 * The `default` arm binds `event` to `never`, so adding a member to `combatCriticalEndEventSchema`
 * without deciding its canonical class fails the typecheck. Do not weaken or delete that guard.
 */
export function getCombatCriticalEndEventConditionKind(
  event: CombatCriticalEndEvent,
): CanonicalCombatModifierConditionKind | null {
  switch (event) {
    case "appropriate_care":
    case "controlled_removal_and_care":
    case "mapped_staunch_event":
    case "staunched":
      return "treated";
    case "extinguishing_flames":
    case "flames_extinguished":
      return "source_process_completed";
    case "separately_resolved":
      return null;
    default: {
      const exhaustive: never = event;
      return exhaustive;
    }
  }
}

/**
 * `text` is the pre-S6 carrier and stays required (`z.string().min(1)`). `endEvent` is an additive
 * optional structured binding for `until_event` durations: a stored fact written before the
 * binding existed omits it and still parses, which is what keeps historical `previousEffect` undo
 * facts readable through `combatEffectSchema.safeParse`. Do not make `endEvent` required and do not
 * relax `text`.
 *
 * `unit` references `canonicalCombatModifierDurationUnitSchema` rather than restating its members,
 * so this schema is a reference to the canonical vocabulary and not a parallel encoding of it. An
 * hour-measured `roll_once` duration therefore stores its retained `storedRoll` and leaves `rounds`
 * undefined: nothing here counts hours, and the Round End boundary never sees such a fact as a
 * round count.
 */
export const combatCriticalDurationSchema = z.object({
  endEvent: combatCriticalEndEventSchema.optional(),
  formula: z.enum(["d3", "d4"]).optional(),
  kind: z.enum(["fixed_rounds", "roll_once", "until_event", "gm_managed"]),
  rounds: z.number().int().positive().optional(),
  storedRoll: z.number().int().positive().optional(),
  text: z.string().min(1),
  unit: canonicalCombatModifierDurationUnitSchema.optional(),
});
export type CombatCriticalDuration = z.infer<typeof combatCriticalDurationSchema>;

export const combatCriticalStunChannelSchema = z.enum(["ob_skill", "db_parry", "initiative"]);
export type CombatCriticalStunChannel = z.infer<typeof combatCriticalStunChannelSchema>;

export const combatCriticalAdjudicationSchema = z.object({
  criticalKey: z.string().min(1),
  narrativeOverride: z.string().trim().min(1).max(2_000).optional(),
  reason: z.string().trim().min(1).max(1_000).optional(),
  stunModifierOverride: z
    .union([z.literal(-1), z.literal(-2), z.literal(-4), z.literal(-8)])
    .optional(),
  suppressedEffectKeys: z.array(z.string().min(1)).max(12).default([]),
  titleOverride: z.string().trim().min(1).max(200).optional(),
});
export type CombatCriticalAdjudication = z.infer<typeof combatCriticalAdjudicationSchema>;

export const combatCriticalCanonicalAtomPresentationSchema = z.object({
  kind: z.enum([
    "damage_floor",
    "modifier",
    "periodic_loss",
    "condition",
    "operation",
    "information",
  ]),
  sourceEffectKey: z.string().min(1).optional(),
  summary: z.string().min(1),
  suppressible: z.boolean(),
  target: z.string().min(1),
  timing: z.string().min(1),
});
export type CombatCriticalCanonicalAtomPresentation = z.infer<
  typeof combatCriticalCanonicalAtomPresentationSchema
>;

export const combatCriticalCanonicalReviewSchema = z.object({
  atoms: z.array(combatCriticalCanonicalAtomPresentationSchema).min(2),
  criticalKey: z.string().min(1),
  fixtureVersion: z.string().min(1),
  narrative: z.string().min(1),
  provenance: z.object({
    acceptedCommentId: z.number().int().positive(),
    acceptedPart: z.string().min(1),
    effectRange: z.string().min(1),
    resultRange: z.string().min(1),
  }),
  title: z.string().min(1),
});
export type CombatCriticalCanonicalReview = z.infer<typeof combatCriticalCanonicalReviewSchema>;

export const combatCriticalStunRuntimeSchema = z.object({
  channels: z
    .array(combatCriticalStunChannelSchema)
    .length(3)
    .refine((channels) => new Set(channels).size === 3, "Stun channels must be unique."),
  duration: combatCriticalDurationSchema,
  modifier: z.union([z.literal(-1), z.literal(-2), z.literal(-4), z.literal(-8)]).nullable(),
  onset: z.enum(["immediate", "next_round"]),
  severity: z.number().int().min(1).max(5),
  sourceEffectKey: z.string().min(1),
});

export const combatCriticalConditionRuntimeSchema = z.object({
  code: z.enum([
    "collapse",
    "function_unusable",
    "impaired",
    "no_action",
    "parry_only",
    "prone",
    "recovery_restricted",
    "restricted",
    "unconscious",
  ]),
  duration: combatCriticalDurationSchema,
  mechanicallyActive: z.boolean(),
  onset: z.enum(["immediate", "next_round"]),
  sourceEffectKey: z.string().min(1).optional(),
  target: z.string().min(1),
});

export const combatCriticalBleedControlStateSchema = z.enum([
  "active",
  "partial",
  "staunched_zero",
  "stabilised",
  "resolved",
]);
export type CombatCriticalBleedControlState = z.infer<typeof combatCriticalBleedControlStateSchema>;

export function getCombatCriticalBleedControlStateLabel(
  state: CombatCriticalBleedControlState,
): string {
  if (state === "partial") return "controlled";
  if (state === "staunched_zero") return "staunched";
  return state;
}

export const combatCriticalBleedRuntimeSchema = z
  .object({
    allowedControlStates: z.array(combatCriticalBleedControlStateSchema).min(2),
    controlState: combatCriticalBleedControlStateSchema.default("active"),
    currentRate: combatCriticalExactRationalSchema.optional(),
    firstTickRound: z.number().int().positive(),
    kind: z.enum(["external", "internal"]),
    rate: combatCriticalExactRationalSchema,
    rollFormula: z.enum(["d4", "d6"]).optional(),
    sourceEffectKey: z.string().min(1),
    sourceRate: z.string().min(1),
    storedRoll: z.number().int().positive().optional(),
  })
  .superRefine((bleed, context) => {
    const allowed = new Set(bleed.allowedControlStates);
    if (!allowed.has(bleed.controlState)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Bleed control state is not allowed for this source.",
        path: ["controlState"],
      });
    }
    if (bleed.kind === "internal" && allowed.has("partial")) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Internal Bleed cannot inherit external partial-control behavior.",
        path: ["allowedControlStates"],
      });
    }
    if (bleed.rollFormula) {
      const maximum = bleed.rollFormula === "d4" ? 4 : 6;
      if (!bleed.storedRoll || bleed.storedRoll > maximum) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Roll-once Bleed requires a retained ${bleed.rollFormula} result.`,
          path: ["storedRoll"],
        });
      }
    }
  });

export const combatCriticalTreatmentSchema = z.object({
  equipmentOrOperation: z.array(z.string().min(1)),
  gmManaged: z.boolean(),
  guidance: z.string().min(1),
  sourceGate: z.string().min(1).optional(),
  stages: z.array(
    z.object({
      role: z.enum(["field_control", "diagnosis_nonoperative", "definitive_care"]),
      skill: z.enum(["first_aid", "medicine", "surgery"]),
    }),
  ),
});

export const combatCriticalInformationSchema = z.object({
  mechanicallyActive: z.literal(false),
  topic: z.enum(["guidance", "mortality", "permanence", "recovery", "unresolved"]),
  value: z.string().min(1),
});

export const combatCriticalRuntimeDefinitionSchema = z.object({
  bleed: z.array(combatCriticalBleedRuntimeSchema),
  canonicalName: z.string().min(1),
  conditions: z.array(combatCriticalConditionRuntimeSchema),
  criticalKey: z.string().min(1),
  description: z.string().min(1),
  fixtureVersion: z.string().min(1),
  information: z.array(combatCriticalInformationSchema),
  operations: z.array(z.enum(["drop_held_item", "fall_to_ground"])),
  stun: combatCriticalStunRuntimeSchema.optional(),
  treatment: combatCriticalTreatmentSchema,
});
export type CombatCriticalRuntimeDefinition = z.infer<typeof combatCriticalRuntimeDefinitionSchema>;

const combatCriticalEffectRuntimeIdentitySchema = z.object({
  criticalKey: z.string().min(1),
  fixtureVersion: z.string().min(1),
});
export const combatCriticalEffectRuntimeSchema = z.discriminatedUnion("kind", [
  combatCriticalEffectRuntimeIdentitySchema.extend({
    kind: z.literal("stun"),
    stun: combatCriticalStunRuntimeSchema,
  }),
  combatCriticalEffectRuntimeIdentitySchema.extend({
    condition: combatCriticalConditionRuntimeSchema,
    kind: z.literal("condition"),
  }),
  combatCriticalEffectRuntimeIdentitySchema.extend({
    bleed: combatCriticalBleedRuntimeSchema,
    kind: z.literal("bleed"),
  }),
  combatCriticalEffectRuntimeIdentitySchema.extend({
    information: z.array(combatCriticalInformationSchema),
    kind: z.literal("treatment_read_state"),
    treatment: combatCriticalTreatmentSchema,
  }),
]);
export type CombatCriticalEffectRuntime = z.infer<typeof combatCriticalEffectRuntimeSchema>;

export const combatCriticalBleedAccumulatorSchema = z.object({
  lastProcessedRound: z.number().int().positive().optional(),
  remainder: combatCriticalExactRationalSchema.default({ denominator: 1, numerator: 0 }),
});
export type CombatCriticalBleedAccumulator = z.infer<typeof combatCriticalBleedAccumulatorSchema>;

function greatestCommonDivisor(left: number, right: number): number {
  let a = Math.abs(left);
  let b = Math.abs(right);
  while (b !== 0) [a, b] = [b, a % b];
  return a || 1;
}

export function normalizeCombatCriticalExactRational(
  value: CombatCriticalExactRational,
): CombatCriticalExactRational {
  const parsed = combatCriticalExactRationalSchema.parse(value);
  const divisor = greatestCommonDivisor(parsed.numerator, parsed.denominator);
  return {
    denominator: parsed.denominator / divisor,
    numerator: parsed.numerator / divisor,
  };
}

export function addCombatCriticalExactRationals(
  left: CombatCriticalExactRational,
  right: CombatCriticalExactRational,
): CombatCriticalExactRational {
  return normalizeCombatCriticalExactRational({
    denominator: left.denominator * right.denominator,
    numerator: left.numerator * right.denominator + right.numerator * left.denominator,
  });
}

export function accrueCombatCriticalBleed(input: {
  activeRates: readonly CombatCriticalExactRational[];
  previousRemainder?: CombatCriticalExactRational;
}): {
  appliedHp: number;
  remainder: CombatCriticalExactRational;
  total: CombatCriticalExactRational;
} {
  const total = input.activeRates.reduce(
    addCombatCriticalExactRationals,
    input.previousRemainder ?? { denominator: 1, numerator: 0 },
  );
  const appliedHp = Math.floor(total.numerator / total.denominator);
  return {
    appliedHp,
    remainder: normalizeCombatCriticalExactRational({
      denominator: total.denominator,
      numerator: total.numerator - appliedHp * total.denominator,
    }),
    total,
  };
}

export function isCombatCriticalBleedSourceActive(
  bleed: z.infer<typeof combatCriticalBleedRuntimeSchema>,
): boolean {
  return (
    (bleed.controlState === "active" || bleed.controlState === "partial") &&
    (bleed.currentRate ?? bleed.rate).numerator > 0
  );
}

export function getCombatCriticalBleedEffectiveRate(
  bleed: z.infer<typeof combatCriticalBleedRuntimeSchema>,
): CombatCriticalExactRational {
  return normalizeCombatCriticalExactRational(bleed.currentRate ?? bleed.rate);
}

export function transitionCombatCriticalBleedControl(input: {
  bleed: z.infer<typeof combatCriticalBleedRuntimeSchema>;
  nextState: CombatCriticalBleedControlState;
  partialRate?: CombatCriticalExactRational;
}): z.infer<typeof combatCriticalBleedRuntimeSchema> {
  const bleed = combatCriticalBleedRuntimeSchema.parse(input.bleed);
  if (!bleed.allowedControlStates.includes(input.nextState)) {
    throw new RangeError(
      `${input.nextState} is not an allowed control state for this ${bleed.kind} Bleed source.`,
    );
  }
  if (input.nextState === "partial") {
    if (bleed.kind !== "external" || !input.partialRate) {
      throw new RangeError("External partial control requires an explicit exact current rate.");
    }
    const partialRate = normalizeCombatCriticalExactRational(input.partialRate);
    if (partialRate.numerator === 0) {
      throw new RangeError("Partial control must retain a positive current rate.");
    }
    if (
      partialRate.numerator * bleed.rate.denominator >=
      bleed.rate.numerator * partialRate.denominator
    ) {
      throw new RangeError("Partial control must reduce the authored source rate.");
    }
    return combatCriticalBleedRuntimeSchema.parse({
      ...bleed,
      controlState: input.nextState,
      currentRate: partialRate,
    });
  }
  return combatCriticalBleedRuntimeSchema.parse({
    ...bleed,
    controlState: input.nextState,
    currentRate: input.nextState === "active" ? bleed.rate : { denominator: 1, numerator: 0 },
  });
}
