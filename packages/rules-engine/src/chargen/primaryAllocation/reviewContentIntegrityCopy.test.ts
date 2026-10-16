import { describe, expect, it } from "vitest";

import { defaultCanonicalContent } from "@glantri/content";
import type { CharacterProgression } from "@glantri/domain";

import { reviewChargenDraft } from "./review";

/*
 * Forgejo #644 (control-plane ruling of 2026-10-15).
 *
 * `reviewChargenDraft` emits two CONTENT-INTEGRITY errors: one when a progression row references
 * a skill the catalogue does not define, one for a specialization. #636 surfaced `review.errors`
 * on the Chargen Finalize step, so both now reach a player. The ruling replaced their former
 * diagnostic wording (which interpolated the raw content id) with player-facing copy and bound
 * it: **no raw id may appear in either string**.
 *
 * These assertions are exact literals on purpose. A substring match would not catch a
 * reintroduced id, which is the single bound this lane exists to hold, and the id guards below
 * assert the absence of the ids the progressions actually carry.
 *
 * Gating is unchanged: both remain errors and both keep `canFinalize` false.
 */
const MISSING_SKILL_ERROR = "A required skill is unavailable. Ask the GM to review this character.";
const MISSING_SPECIALIZATION_ERROR =
  "A required specialization is unavailable. Ask the GM to review this character.";

const UNKNOWN_SKILL_ID = "skill:no-such-skill-644";
const UNKNOWN_SPECIALIZATION_ID = "specialization:no-such-specialization-644";

function progressionWith(
  overrides: Partial<CharacterProgression> & Record<string, unknown>,
): CharacterProgression {
  return {
    primaryPoolSpent: 0,
    secondaryPoolSpent: 0,
    skillGroups: [],
    skills: [],
    specializations: [],
    ...overrides,
  } as unknown as CharacterProgression;
}

function review(progression: CharacterProgression) {
  return reviewChargenDraft({
    content: defaultCanonicalContent,
    progression,
  });
}

describe("Chargen review content-integrity error copy (Forgejo #644)", () => {
  it("states an unavailable skill without naming the content id", () => {
    const result = review(
      progressionWith({
        skills: [
          {
            gms: 0,
            grantedRanks: 0,
            groupId: "basic_melee_training",
            primaryRanks: 1,
            ranks: 1,
            secondaryRanks: 0,
            skillId: UNKNOWN_SKILL_ID,
          },
        ],
      }),
    );

    expect(result.errors).toContain(MISSING_SKILL_ERROR);
    expect(result.canFinalize).toBe(false);

    for (const error of result.errors) {
      expect(error).not.toContain(UNKNOWN_SKILL_ID);
      expect(error).not.toContain("no-such-skill-644");
    }
  });

  it("states an unavailable specialization without naming the content id", () => {
    const result = review(
      progressionWith({
        specializations: [
          {
            gms: 0,
            grantedRanks: 0,
            primaryRanks: 1,
            ranks: 1,
            secondaryRanks: 0,
            specializationId: UNKNOWN_SPECIALIZATION_ID,
          },
        ],
      }),
    );

    expect(result.errors).toContain(MISSING_SPECIALIZATION_ERROR);
    expect(result.canFinalize).toBe(false);

    for (const error of result.errors) {
      expect(error).not.toContain(UNKNOWN_SPECIALIZATION_ID);
      expect(error).not.toContain("no-such-specialization-644");
    }
  });
});
