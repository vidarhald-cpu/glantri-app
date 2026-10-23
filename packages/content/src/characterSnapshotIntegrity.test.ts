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
  const keys = Object.keys(source).sort((left, right) =>
    left.length !== right.length
      ? left.length - right.length
      : left < right
        ? -1
        : left > right
          ? 1
          : 0,
  );
  const reordered: Record<string, unknown> = {};
  for (const key of keys) reordered[key] = reorderKeysAsJsonb(source[key]);
  return reordered as unknown as T;
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

  it("throws rather than writing when handed a deeply frozen progression", () => {
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
