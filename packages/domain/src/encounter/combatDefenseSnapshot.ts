import { z } from "zod";

import { scenarioParticipantIncomingAttackSideSchema } from "../campaign/scenario";

const idSchema = z.string().min(1);

export const combatDefenseSourceKindSchema = z.enum(["shield", "weapon"]);
export type CombatDefenseSourceKind = z.infer<typeof combatDefenseSourceKindSchema>;

export const combatDefenseSourceSlotSchema = z.enum(["mainHand", "offHand"]);
export type CombatDefenseSourceSlot = z.infer<typeof combatDefenseSourceSlotSchema>;

export const combatDefenseSourceDecisionSchema = z.enum([
  "default_included",
  "gm_included",
  "gm_excluded",
]);
export type CombatDefenseSourceDecision = z.infer<typeof combatDefenseSourceDecisionSchema>;

export const combatDefenseSourceSnapshotSchema = z
  .object({
    decision: combatDefenseSourceDecisionSchema,
    included: z.boolean(),
    itemId: idSchema,
    itemRevision: idSchema,
    kind: combatDefenseSourceKindSchema,
    label: z.string().min(1),
    slot: combatDefenseSourceSlotSchema,
    templateId: idSchema,
  })
  .strict();
export type CombatDefenseSourceSnapshot = z.infer<typeof combatDefenseSourceSnapshotSchema>;

export const combatDefenseSnapshotSchema = z
  .object({
    attackDirection: scenarioParticipantIncomingAttackSideSchema.default("front"),
    attackerParticipantId: idSchema,
    attackId: idSchema,
    attackOpportunityId: idSchema,
    aware: z.boolean(),
    awarenessDefault: z.boolean(),
    awarenessOverridden: z.boolean(),
    defenderParticipantId: idSchema,
    id: idSchema,
    ordinaryDodgeAvailable: z.boolean(),
    phase: z.enum(["phase1", "phase2"]),
    reviewedAt: z.string().datetime(),
    reviewedByUserId: idSchema.optional(),
    roundNumber: z.number().int().positive(),
    schemaVersion: z.literal(1),
    sources: z.array(combatDefenseSourceSnapshotSchema),
    status: z.literal("committed"),
  })
  .strict()
  .superRefine((snapshot, context) => {
    if (snapshot.ordinaryDodgeAvailable !== snapshot.aware) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Ordinary Dodge availability must follow the committed awareness fact.",
        path: ["ordinaryDodgeAvailable"],
      });
    }

    const sourceIds = new Set<string>();
    snapshot.sources.forEach((source, index) => {
      if (sourceIds.has(source.itemId)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "A defense Item may appear only once in a defense snapshot.",
          path: ["sources", index, "itemId"],
        });
      }
      sourceIds.add(source.itemId);

      if (source.included === (source.decision === "gm_excluded")) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Defense-source inclusion and decision provenance disagree.",
          path: ["sources", index, "decision"],
        });
      }
    });
  });
export type CombatDefenseSnapshot = z.infer<typeof combatDefenseSnapshotSchema>;

export function buildCombatDefenseSnapshotId(attackId: string): string {
  return `defense-snapshot:${attackId}`;
}

export function getCombatDefenseSnapshotForAttack(
  snapshots: readonly CombatDefenseSnapshot[],
  attackId: string,
): CombatDefenseSnapshot | undefined {
  return snapshots.find((snapshot) => snapshot.attackId === attackId);
}

export function getLatestCombatDefenseSnapshot(input: {
  defenderParticipantId: string;
  phase: CombatDefenseSnapshot["phase"];
  roundNumber: number;
  snapshots: readonly CombatDefenseSnapshot[];
}): CombatDefenseSnapshot | undefined {
  return input.snapshots
    .filter(
      (snapshot) =>
        snapshot.defenderParticipantId === input.defenderParticipantId &&
        snapshot.phase === input.phase &&
        snapshot.roundNumber === input.roundNumber,
    )
    .sort(
      (left, right) =>
        right.reviewedAt.localeCompare(left.reviewedAt) || right.id.localeCompare(left.id),
    )[0];
}
