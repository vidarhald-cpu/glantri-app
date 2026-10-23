import { describe, expect, it } from "vitest";
import { characterProgressionSchema, type CharacterProgression } from "@glantri/domain";

import {
  getApprovedV2RuntimeContent,
  getTargetProgressionValidationErrors,
} from "./targetCompetencies";

/**
 * Character snapshot integrity regression coverage — Forgejo #764.
 *
 * The Product Owner's two live Characters are **not** fixtures here; their data is not
 * committed to this repository. Both defects are instead reproduced deterministically from
 * the real catalogue by two programmatic mutations applied in this file:
 *
 * - `reorderKeysAsJsonb` reproduces the PostgreSQL `jsonb` round-trip, which canonicalizes
 *   object keys by length then bytewise at every nesting depth while preserving array order;
 * - `rewriteReaderFacingProse` reproduces an editorial catalogue re-wording.
 *
 * The real-snapshot runs are recorded as operational evidence on the PR instead.
 */

const READER_FACING_FIELDS = ["boundaries", "description", "fullDescription", "shortDescription"];

/** PostgreSQL `jsonb` key order: shorter keys first, then bytewise. */
function compareKeysAsJsonb(left: string, right: string): number {
  return left.length !== right.length
    ? left.length - right.length
    : left < right
      ? -1
      : left > right
        ? 1
        : 0;
}

/**
 * PostgreSQL `jsonb` key order: shorter keys first, then bytewise. Applied at every depth,
 * with array order left alone — which is what `jsonb` itself does.
 */
function reorderKeysAsJsonb<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((element) => reorderKeysAsJsonb(element)) as unknown as T;
  }
  if (typeof value !== "object" || value === null) return value;

  const source = value as Record<string, unknown>;
  const keys = Object.keys(source).sort(compareKeysAsJsonb);
  const reordered: Record<string, unknown> = {};
  for (const key of keys) reordered[key] = reorderKeysAsJsonb(source[key]);
  return reordered as unknown as T;
}

/**
 * Reports the first object, at any depth, whose keys are **not** in `jsonb` order.
 *
 * This exists to fail closed on the way integration coverage for defect A goes vacuous: if
 * anything normalizes the value before the comparison sees it — a `characterProgressionSchema`
 * parse, a spread through a Zod-typed builder — the keys come back in schema-declaration order
 * and this reports it. A test that reorders a fixture and then lets it be normalized away is
 * measuring nothing.
 */
function findJsonbKeyOrderViolation(value: unknown, path = "$"): string | undefined {
  if (Array.isArray(value)) {
    for (const [index, element] of value.entries()) {
      const violation = findJsonbKeyOrderViolation(element, `${path}[${index}]`);
      if (violation !== undefined) return violation;
    }
    return undefined;
  }
  if (typeof value !== "object" || value === null) return undefined;

  const source = value as Record<string, unknown>;
  const keys = Object.keys(source);
  const expected = [...keys].sort(compareKeysAsJsonb);
  if (JSON.stringify(keys) !== JSON.stringify(expected)) {
    return `${path}: keys ${JSON.stringify(keys)} are not in jsonb order ${JSON.stringify(expected)}`;
  }
  for (const key of keys) {
    const violation = findJsonbKeyOrderViolation(source[key], `${path}.${key}`);
    if (violation !== undefined) return violation;
  }
  return undefined;
}

/** An editorial re-wording: every reader-facing field, at every depth, gets new prose. */
function rewriteReaderFacingProse<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((element) => rewriteReaderFacingProse(element)) as unknown as T;
  }
  if (typeof value !== "object" || value === null) return value;

  const source = value as Record<string, unknown>;
  const rewritten: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(source)) {
    if (READER_FACING_FIELDS.includes(key) && typeof entry === "string") {
      rewritten[key] = `Re-worded by a later editorial pass. (${key})`;
      continue;
    }
    if (READER_FACING_FIELDS.includes(key) && Array.isArray(entry)) {
      rewritten[key] = ["Re-worded boundary statement.", "And a second one the author added."];
      continue;
    }
    rewritten[key] = rewriteReaderFacingProse(entry);
  }
  return rewritten as unknown as T;
}

const content = getApprovedV2RuntimeContent();

/** A Learning Group carrying prose in several fields, and real mechanical structure. */
const groupWithProseAndSlots = content.skillGroups.find(
  (group) =>
    (group.selectionSlots?.length ?? 0) > 0 &&
    (group.skillMemberships?.length ?? 0) > 0 &&
    group.boundaries !== undefined &&
    group.fullDescription !== undefined,
);

const skillWithProse = content.skills.find(
  (skill) => "catalogueSource" in skill && skill.description !== undefined,
);

function progressionWithGroup(targetDefinition: unknown): CharacterProgression {
  return characterProgressionSchema.parse({
    skillGroups: [
      {
        groupId: groupWithProseAndSlots!.id,
        primaryRanks: 0,
        ranks: 0,
        secondaryRanks: 0,
        targetDefinition,
      },
    ],
  });
}

function progressionWithSkill(targetDefinition: unknown): CharacterProgression {
  const skill = skillWithProse!;
  return characterProgressionSchema.parse({
    skills: [
      {
        groupId: skill.groupId,
        groupIds: skill.groupIds,
        skillId: skill.id,
        targetDefinition,
      },
    ],
  });
}

/**
 * The persisted value exactly as `jsonb` hands it back, with **no `characterProgressionSchema`
 * parse anywhere in front of it**.
 *
 * `progressionWithGroup` / `progressionWithSkill` above parse, and a parse rebuilds every object
 * in schema-declaration order — which erases a `jsonb` reordering before the comparison can see
 * it. The repair must not depend on that incidental normalization staying in front of it
 * (#764 contract: "the ordering repair must not rely on the Zod normalization remaining in front
 * of the comparison [...] the comparison must be order-insensitive at every nesting depth on the
 * raw value"), so these fixtures are cast, never parsed. `jsonb` canonicalizes the whole stored
 * document, so the reordering is applied to the whole progression, not only to the snapshot.
 */
function rawJsonbProgression(persisted: {
  skillGroups?: readonly unknown[];
  skills?: readonly unknown[];
}): CharacterProgression {
  return reorderKeysAsJsonb({
    chargenMode: "standard",
    educationPoints: 0,
    flexiblePointFactor: 1,
    level: 1,
    primaryPoolSpent: 0,
    primaryPoolTotal: 60,
    secondaryPoolSpent: 0,
    secondaryPoolTotal: 0,
    skillGroups: persisted.skillGroups ?? [],
    skills: persisted.skills ?? [],
    specializations: [],
  }) as unknown as CharacterProgression;
}

function rawGroupRow(targetDefinition: unknown): Record<string, unknown> {
  return {
    grantedRanks: 0,
    gms: 0,
    groupId: groupWithProseAndSlots!.id,
    primaryRanks: 0,
    ranks: 0,
    secondaryRanks: 0,
    targetDefinition,
  };
}

function rawSkillRow(targetDefinition: unknown): Record<string, unknown> {
  const skill = skillWithProse!;
  return {
    groupId: skill.groupId,
    groupIds: skill.groupIds,
    skillId: skill.id,
    targetDefinition,
  };
}

describe("fixture construction actually reproduces both #764 defects", () => {
  it("has a catalogue entry with prose, boundaries, memberships and selection slots", () => {
    expect(groupWithProseAndSlots).toBeDefined();
    expect(skillWithProse).toBeDefined();
  });

  it("reorderKeysAsJsonb really does change the byte sequence", () => {
    const reordered = reorderKeysAsJsonb(groupWithProseAndSlots!);
    expect(JSON.stringify(reordered)).not.toBe(JSON.stringify(groupWithProseAndSlots));
    // ...and the defect it reproduces is exactly the predicate this lane replaced.
    expect(
      JSON.stringify(reordered) === JSON.stringify(groupWithProseAndSlots),
      "the pre-repair raw-stringify comparison must fail on this fixture",
    ).toBe(false);
  });

  it("rewriteReaderFacingProse really does change the prose", () => {
    const reworded = rewriteReaderFacingProse(groupWithProseAndSlots!);
    expect(reworded.fullDescription).not.toBe(groupWithProseAndSlots!.fullDescription);
    expect(reworded.boundaries).not.toEqual(groupWithProseAndSlots!.boundaries);
    expect(JSON.stringify(reworded) === JSON.stringify(groupWithProseAndSlots)).toBe(false);
  });
});

/**
 * The POST-PARSE path only. `progressionWithGroup` / `progressionWithSkill` parse, so the
 * reordering these two cases apply is rebuilt in schema-declaration order before the comparison
 * sees it — which is why both of them also pass on the unrepaired baseline. They are kept because
 * they are the production `mapCharacterRecord` sequence, but the order coverage that actually
 * measures the repair is the RAW block below, not this one.
 */
describe("object key order across a store that does not preserve it (#764 defect A)", () => {
  it("does not invalidate a Learning Group snapshot", () => {
    expect(
      getTargetProgressionValidationErrors(
        progressionWithGroup(reorderKeysAsJsonb(groupWithProseAndSlots!)),
      ),
    ).toEqual([]);
  });

  it("does not invalidate a Skill snapshot", () => {
    expect(
      getTargetProgressionValidationErrors(
        progressionWithSkill(reorderKeysAsJsonb(skillWithProse!)),
      ),
    ).toEqual([]);
  });
});

/**
 * The path integrity actually has to survive on: the unparsed, `jsonb`-ordered column value.
 *
 * Everything in this block reaches `getTargetProgressionValidationErrors` without
 * `characterProgressionSchema.parse`, and each case asserts — before it asserts anything about
 * the errors — that the value it hands over is still in `jsonb` key order and still byte-different
 * from the live catalogue entry. Both halves are needed: the order assertion proves nothing
 * normalized the fixture, and the byte-difference assertion proves the fixture still reproduces
 * the defect.
 */
describe("the RAW jsonb-ordered progression, with no normalizing parse in front (#764 defect A)", () => {
  const groupError = `Learning Group ${groupWithProseAndSlots!.id} does not match the approved target definition.`;
  const skillError = `Skill ${skillWithProse!.id} does not match the approved target definition.`;

  function handedGroupDefinition(progression: CharacterProgression): unknown {
    expect(findJsonbKeyOrderViolation(progression)).toBeUndefined();
    const handed = progression.skillGroups[0]!.targetDefinition;
    expect(handed).toBeDefined();
    expect(JSON.stringify(handed)).not.toBe(JSON.stringify(groupWithProseAndSlots));
    return handed;
  }

  it("hands the comparison a value no parse has touched: jsonb order, byte-different, same content", () => {
    const progression = rawJsonbProgression({
      skillGroups: [rawGroupRow(groupWithProseAndSlots!)],
    });
    const handed = handedGroupDefinition(progression);

    // Byte-different, and specifically different in key ORDER rather than in content.
    expect(Object.keys(handed as Record<string, unknown>)).not.toEqual(
      Object.keys(groupWithProseAndSlots!),
    );
    expect(Object.keys(handed as Record<string, unknown>).sort()).toEqual(
      Object.keys(groupWithProseAndSlots!).sort(),
    );
    // And the pre-repair predicate — raw `JSON.stringify` equality — fails on it, which is the
    // defect. This is the assertion that goes red if the fixture ever stops reproducing it.
    expect(
      JSON.stringify(handed) === JSON.stringify(groupWithProseAndSlots),
      "the pre-repair raw-stringify comparison must fail on the value actually handed over",
    ).toBe(false);
  });

  it("does not invalidate a Learning Group snapshot", () => {
    const progression = rawJsonbProgression({
      skillGroups: [rawGroupRow(groupWithProseAndSlots!)],
    });
    handedGroupDefinition(progression);
    expect(getTargetProgressionValidationErrors(progression)).toEqual([]);
  });

  it("does not invalidate a Learning Group snapshot that is also prose-stale", () => {
    const progression = rawJsonbProgression({
      skillGroups: [rawGroupRow(rewriteReaderFacingProse(groupWithProseAndSlots!))],
    });
    handedGroupDefinition(progression);
    expect(getTargetProgressionValidationErrors(progression)).toEqual([]);
  });

  it("still catches a mechanical divergence on the raw value", () => {
    const progression = rawJsonbProgression({
      skillGroups: [
        rawGroupRow({
          ...groupWithProseAndSlots!,
          sortOrder: groupWithProseAndSlots!.sortOrder + 1,
        }),
      ],
    });
    expect(findJsonbKeyOrderViolation(progression)).toBeUndefined();
    expect(getTargetProgressionValidationErrors(progression)).toEqual([groupError]);
  });

  it("still catches a reordered semantic array on the raw value", () => {
    const [slot, ...rest] = groupWithProseAndSlots!.selectionSlots!;
    expect(slot.candidateSkillIds.length).toBeGreaterThan(1);
    const progression = rawJsonbProgression({
      skillGroups: [
        rawGroupRow({
          ...groupWithProseAndSlots!,
          selectionSlots: [
            { ...slot, candidateSkillIds: [...slot.candidateSkillIds].reverse() },
            ...rest,
          ],
        }),
      ],
    });
    expect(findJsonbKeyOrderViolation(progression)).toBeUndefined();
    expect(getTargetProgressionValidationErrors(progression)).toEqual([groupError]);
  });

  it("does not invalidate a raw Skill snapshot, and still catches a mechanical divergence", () => {
    const skill = skillWithProse!;
    const clean = rawJsonbProgression({ skills: [rawSkillRow(skill)] });
    expect(findJsonbKeyOrderViolation(clean)).toBeUndefined();
    expect(JSON.stringify(clean.skills[0]!.targetDefinition)).not.toBe(JSON.stringify(skill));
    expect(getTargetProgressionValidationErrors(clean)).toEqual([]);

    const diverged = rawJsonbProgression({
      skills: [rawSkillRow({ ...skill, sortOrder: skill.sortOrder + 1 })],
    });
    expect(findJsonbKeyOrderViolation(diverged)).toBeUndefined();
    expect(getTargetProgressionValidationErrors(diverged)).toEqual([skillError]);
  });

  it("does not mutate the raw persisted value it was handed", () => {
    const progression = rawJsonbProgression({
      skillGroups: [
        rawGroupRow(reorderKeysAsJsonb(rewriteReaderFacingProse(groupWithProseAndSlots!))),
      ],
    });
    const before = JSON.stringify(progression);
    expect(getTargetProgressionValidationErrors(progression)).toEqual([]);
    expect(JSON.stringify(progression)).toBe(before);
    expect(findJsonbKeyOrderViolation(progression)).toBeUndefined();
  });
});

describe("a prose-only catalogue edit does not invalidate a Character (#764 defect B)", () => {
  it("accepts a Learning Group snapshot with older description, fullDescription and boundaries", () => {
    expect(
      getTargetProgressionValidationErrors(
        progressionWithGroup(rewriteReaderFacingProse(groupWithProseAndSlots!)),
      ),
    ).toEqual([]);
  });

  it("accepts a Skill snapshot with an older description", () => {
    expect(
      getTargetProgressionValidationErrors(
        progressionWithSkill(rewriteReaderFacingProse(skillWithProse!)),
      ),
    ).toEqual([]);
  });

  it("accepts both defects at once, which is the state the Alpha was actually in", () => {
    expect(
      getTargetProgressionValidationErrors(
        progressionWithGroup(reorderKeysAsJsonb(rewriteReaderFacingProse(groupWithProseAndSlots!))),
      ),
    ).toEqual([]);
  });
});

describe("a genuine mechanical divergence still invalidates a Character", () => {
  const groupError = () =>
    `Learning Group ${groupWithProseAndSlots!.id} does not match the approved target definition.`;

  it("catches a changed sortOrder", () => {
    const mutated = {
      ...groupWithProseAndSlots!,
      sortOrder: groupWithProseAndSlots!.sortOrder + 1,
    };
    expect(getTargetProgressionValidationErrors(progressionWithGroup(mutated))).toEqual([
      groupError(),
    ]);
  });

  it("catches a removed skill membership", () => {
    const mutated = {
      ...groupWithProseAndSlots!,
      skillMemberships: groupWithProseAndSlots!.skillMemberships!.slice(1),
    };
    expect(getTargetProgressionValidationErrors(progressionWithGroup(mutated))).toEqual([
      groupError(),
    ]);
  });

  it("catches a changed membership relevance", () => {
    const [first, ...rest] = groupWithProseAndSlots!.skillMemberships!;
    const mutated = {
      ...groupWithProseAndSlots!,
      skillMemberships: [
        { ...first, relevance: first.relevance === "core" ? "optional" : "core" },
        ...rest,
      ],
    };
    expect(getTargetProgressionValidationErrors(progressionWithGroup(mutated))).toEqual([
      groupError(),
    ]);
  });

  it("catches a changed selection-slot chooseCount", () => {
    const [slot, ...rest] = groupWithProseAndSlots!.selectionSlots!;
    const mutated = {
      ...groupWithProseAndSlots!,
      selectionSlots: [{ ...slot, chooseCount: slot.chooseCount + 1 }, ...rest],
    };
    expect(getTargetProgressionValidationErrors(progressionWithGroup(mutated))).toEqual([
      groupError(),
    ]);
  });

  it("catches a changed selection-slot required flag", () => {
    const [slot, ...rest] = groupWithProseAndSlots!.selectionSlots!;
    const mutated = {
      ...groupWithProseAndSlots!,
      selectionSlots: [{ ...slot, required: !slot.required }, ...rest],
    };
    expect(getTargetProgressionValidationErrors(progressionWithGroup(mutated))).toEqual([
      groupError(),
    ]);
  });

  it("catches an added candidate skill in a selection slot", () => {
    const [slot, ...rest] = groupWithProseAndSlots!.selectionSlots!;
    const mutated = {
      ...groupWithProseAndSlots!,
      selectionSlots: [
        { ...slot, candidateSkillIds: [...slot.candidateSkillIds, "unarmed_combat"] },
        ...rest,
      ],
    };
    expect(getTargetProgressionValidationErrors(progressionWithGroup(mutated))).toEqual([
      groupError(),
    ]);
  });

  it("catches a REORDERED candidate skill list, because array order stays compared", () => {
    const [slot, ...rest] = groupWithProseAndSlots!.selectionSlots!;
    expect(slot.candidateSkillIds.length).toBeGreaterThan(1);
    const mutated = {
      ...groupWithProseAndSlots!,
      selectionSlots: [
        { ...slot, candidateSkillIds: [...slot.candidateSkillIds].reverse() },
        ...rest,
      ],
    };
    expect(getTargetProgressionValidationErrors(progressionWithGroup(mutated))).toEqual([
      groupError(),
    ]);
  });

  it("catches a changed selection-slot label, which stays mechanical", () => {
    const [slot, ...rest] = groupWithProseAndSlots!.selectionSlots!;
    const mutated = {
      ...groupWithProseAndSlots!,
      selectionSlots: [{ ...slot, label: `${slot.label} (changed)` }, ...rest],
    };
    expect(getTargetProgressionValidationErrors(progressionWithGroup(mutated))).toEqual([
      groupError(),
    ]);
  });

  it("catches a changed Learning Group name, which stays mechanical", () => {
    const mutated = {
      ...groupWithProseAndSlots!,
      name: `${groupWithProseAndSlots!.name} (changed)`,
    };
    expect(getTargetProgressionValidationErrors(progressionWithGroup(mutated))).toEqual([
      groupError(),
    ]);
  });

  it("catches a changed Skill linkedStats value and a reordered linkedStats pair", () => {
    const skill = skillWithProse!;
    expect(skill.linkedStats.length).toBeGreaterThan(1);
    const expected = `Skill ${skill.id} does not match the approved target definition.`;

    expect(
      getTargetProgressionValidationErrors(
        progressionWithSkill({ ...skill, linkedStats: [...skill.linkedStats, "lck"] }),
      ),
    ).toEqual([expected]);

    const reversed = [...skill.linkedStats].reverse();
    if (JSON.stringify(reversed) !== JSON.stringify(skill.linkedStats)) {
      expect(
        getTargetProgressionValidationErrors(
          progressionWithSkill({ ...skill, linkedStats: reversed }),
        ),
      ).toEqual([expected]);
    }
  });

  it("catches a changed Skill societyLevel, category and sortOrder", () => {
    const skill = skillWithProse!;
    const expected = `Skill ${skill.id} does not match the approved target definition.`;
    for (const mutated of [
      { ...skill, societyLevel: skill.societyLevel + 1 },
      { ...skill, sortOrder: skill.sortOrder + 1 },
      { ...skill, isTheoretical: !skill.isTheoretical },
    ]) {
      expect(getTargetProgressionValidationErrors(progressionWithSkill(mutated))).toEqual([
        expected,
      ]);
    }
  });

  it("catches a snapshot of a Learning Group that is no longer in the catalogue", () => {
    const progression = characterProgressionSchema.parse({
      skillGroups: [
        {
          groupId: "ZZ99",
          primaryRanks: 0,
          ranks: 0,
          secondaryRanks: 0,
          targetDefinition: { ...groupWithProseAndSlots!, id: "ZZ99" },
        },
      ],
    });
    expect(getTargetProgressionValidationErrors(progression)).toEqual([
      "Learning Group ZZ99 does not match the approved target definition.",
    ]);
  });
});

describe("no read-path write and no self-heal", () => {
  it("does not mutate the persisted snapshot it was handed", () => {
    const persisted = reorderKeysAsJsonb(rewriteReaderFacingProse(groupWithProseAndSlots!));
    const progression = progressionWithGroup(persisted);
    const before = JSON.stringify(progression);

    expect(getTargetProgressionValidationErrors(progression)).toEqual([]);

    expect(JSON.stringify(progression)).toBe(before);
    // The stale prose is still exactly as stored: nothing refreshed it to current wording.
    expect(progression.skillGroups[0].targetDefinition!.fullDescription).toBe(
      "Re-worded by a later editorial pass. (fullDescription)",
    );
    expect(progression.skillGroups[0].targetDefinition!.fullDescription).not.toBe(
      groupWithProseAndSlots!.fullDescription,
    );
  });

  it("completes without throwing when handed a deeply frozen progression, so it wrote nothing", () => {
    const freezeDeep = (value: unknown): void => {
      if (typeof value !== "object" || value === null || Object.isFrozen(value)) return;
      Object.freeze(value);
      for (const entry of Object.values(value)) freezeDeep(entry);
    };

    const progression = progressionWithGroup(reorderKeysAsJsonb(groupWithProseAndSlots!));
    freezeDeep(progression);

    // A frozen input would throw on any assignment under strict mode. It returns cleanly,
    // so the read path performed no write at all.
    expect(getTargetProgressionValidationErrors(progression)).toEqual([]);
  });

  it("does not mutate the live catalogue either", () => {
    const before = JSON.stringify(getApprovedV2RuntimeContent().skillGroups);
    getTargetProgressionValidationErrors(
      progressionWithGroup(rewriteReaderFacingProse(groupWithProseAndSlots!)),
    );
    expect(JSON.stringify(getApprovedV2RuntimeContent().skillGroups)).toBe(before);
  });
});
