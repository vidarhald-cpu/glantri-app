import { describe, expect, it } from "vitest";

import { getAllowedSecondaryGroupIds } from "./access";
import type { CanonicalContentShape } from "./_helpers";

/*
 * CHARACTERISATION LOCK (Forgejo #494) -- records CURRENT BEHAVIOUR, NOT AN APPROVED RULE.
 *
 * `getAllowedSecondaryGroupIds` computes an UNRULED / NON-CANONICAL Social-Band eligibility
 * predicate (see the marker above `getAllowedSecondaryGroupIdsInternal` in access.ts). Nothing
 * below says which groups a character SHOULD be allowed to reach. Whether Social Band is the
 * right dimension, whether "at or below your band" is the right comparison, and whether
 * Profession participates are all still owed a Product Owner ruling. The expected arrays are what
 * the code returns today for a fixed synthetic input; they are a regression tripwire so the
 * result cannot drift silently (for example by the filter being deleted, which once left the
 * whole suite green). If the ruling later changes the predicate, UPDATE THESE EXPECTATIONS; a
 * failure here means "behaviour changed", never "the rule was violated".
 *
 * Design: the fixture is synthetic and self-contained, so legitimate edits to the real
 * canonical content cannot break this lock; only a change to the accessor can. The bounds
 * deliberately include a bound exactly at the boundary band (L4 evaluated at band 4), which
 * distinguishes `<=` from `<`. Expected ids are exact and in groupBounds order (the accessor
 * preserves it, so order is part of the locked current behaviour; nothing is normalised).
 */

const groupBounds = [
  { groupId: "g-open" },
  { groupId: "g-l1", minSocialBand: "L1" },
  { groupId: "g-l2", minSocialBand: "L2" },
  { groupId: "g-l3", minSocialBand: "L3" },
  { groupId: "g-l4", minSocialBand: "L4" },
  { groupId: "g-soc3", minSocietyLevel: 3 },
  { groupId: "g-soc3-l4", minSocietyLevel: 3, minSocialBand: "L4" },
  { groupId: "g-soc2-l2", minSocietyLevel: 2, minSocialBand: "L2" },
  { groupId: "g-soc4", minSocietyLevel: 4 },
] as const;

const fixture = {
  societies: [
    { id: "society-level-2", societyLevel: 2 },
    { id: "society-level-4", societyLevel: 4 },
  ],
  competencyV2: { groupBounds },
} as unknown as CanonicalContentShape;

describe("secondary-group accessor characterisation lock (current behaviour, not an approved rule)", () => {
  const cases: {
    societyId: string | undefined;
    band: number;
    expected: string[];
  }[] = [
    {
      societyId: "society-level-4",
      band: 4,
      expected: [
        "g-open",
        "g-l1",
        "g-l2",
        "g-l3",
        "g-l4",
        "g-soc3",
        "g-soc3-l4",
        "g-soc2-l2",
        "g-soc4",
      ],
    },
    {
      societyId: "society-level-4",
      band: 3,
      expected: ["g-open", "g-l1", "g-l2", "g-l3", "g-soc3", "g-soc2-l2", "g-soc4"],
    },
    {
      societyId: "society-level-4",
      band: 2,
      expected: ["g-open", "g-l1", "g-l2", "g-soc3", "g-soc2-l2", "g-soc4"],
    },
    { societyId: "society-level-4", band: 1, expected: ["g-open", "g-l1", "g-soc3", "g-soc4"] },
    {
      societyId: "society-level-2",
      band: 4,
      expected: ["g-open", "g-l1", "g-l2", "g-l3", "g-l4", "g-soc2-l2"],
    },
    { societyId: "society-level-2", band: 2, expected: ["g-open", "g-l1", "g-l2", "g-soc2-l2"] },
    // Out-of-range band: early-return guard (levels outside 1..4 yield nothing).
    { societyId: "society-level-4", band: 5, expected: [] },
    { societyId: "society-level-4", band: 0, expected: [] },
    // Unresolvable society.
    { societyId: "no-such-society", band: 4, expected: [] },
    { societyId: undefined, band: 4, expected: [] },
  ];

  for (const { societyId, band, expected } of cases) {
    it(`records current output for society=${String(societyId)} band=${band}`, () => {
      expect(getAllowedSecondaryGroupIds(fixture, societyId, band)).toEqual(expected);
    });
  }
});
