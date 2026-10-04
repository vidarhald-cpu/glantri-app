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
 * canonical content cannot break this lock; only a change to the accessor can. Every bound
 * states BOTH `minSocietyLevel` and `minSocialBand` explicitly, so no expectation rests on an
 * implicit default by accident. Exactly two bounds omit one field ON PURPOSE, solely to pin the
 * accessor's current defaults (unset minSocietyLevel behaves as 1, unset minSocialBand as "L1");
 * they are marked below and are not oversights. The societies include a level-1 society,
 * because the minSocietyLevel default is observable only there (at level 1, `1 <= 1` holds
 * while a default of 2 would not); at levels 2 and above every such default behaves
 * identically. The bounds also include ones exactly at the boundary band (band 4 evaluated at
 * band 4), which distinguishes `<=` from `<`. Expected ids are exact and in groupBounds order
 * (the accessor preserves it, so order is part of the locked current behaviour; nothing is
 * normalised). Bound ids read g-s<minSocietyLevel>-b<minSocialBand number>.
 */

const groupBounds = [
  { groupId: "g-s1-b1", minSocietyLevel: 1, minSocialBand: "L1" },
  { groupId: "g-s1-b2", minSocietyLevel: 1, minSocialBand: "L2" },
  { groupId: "g-s1-b3", minSocietyLevel: 1, minSocialBand: "L3" },
  { groupId: "g-s1-b4", minSocietyLevel: 1, minSocialBand: "L4" },
  { groupId: "g-s2-b2", minSocietyLevel: 2, minSocialBand: "L2" },
  { groupId: "g-s3-b1", minSocietyLevel: 3, minSocialBand: "L1" },
  { groupId: "g-s3-b4", minSocietyLevel: 3, minSocialBand: "L4" },
  { groupId: "g-s4-b1", minSocietyLevel: 4, minSocialBand: "L1" },
  // DELIBERATELY leaves minSocietyLevel UNSET, to exercise the accessor's current default
  // (treated as 1). Not an oversight; do not "complete" it. Only a level-1 society observes it.
  { groupId: "g-default-society-level", minSocialBand: "L1" },
  // DELIBERATELY leaves minSocialBand UNSET, to exercise the accessor's current default
  // (treated as "L1"). Not an oversight; do not "complete" it.
  { groupId: "g-default-social-band", minSocietyLevel: 1 },
] as const;

const fixture = {
  societies: [
    { id: "society-level-1", societyLevel: 1 },
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
        "g-s1-b1",
        "g-s1-b2",
        "g-s1-b3",
        "g-s1-b4",
        "g-s2-b2",
        "g-s3-b1",
        "g-s3-b4",
        "g-s4-b1",
        "g-default-society-level",
        "g-default-social-band",
      ],
    },
    {
      societyId: "society-level-4",
      band: 3,
      expected: [
        "g-s1-b1",
        "g-s1-b2",
        "g-s1-b3",
        "g-s2-b2",
        "g-s3-b1",
        "g-s4-b1",
        "g-default-society-level",
        "g-default-social-band",
      ],
    },
    {
      societyId: "society-level-4",
      band: 2,
      expected: [
        "g-s1-b1",
        "g-s1-b2",
        "g-s2-b2",
        "g-s3-b1",
        "g-s4-b1",
        "g-default-society-level",
        "g-default-social-band",
      ],
    },
    {
      societyId: "society-level-4",
      band: 1,
      expected: [
        "g-s1-b1",
        "g-s3-b1",
        "g-s4-b1",
        "g-default-society-level",
        "g-default-social-band",
      ],
    },
    {
      societyId: "society-level-2",
      band: 4,
      expected: [
        "g-s1-b1",
        "g-s1-b2",
        "g-s1-b3",
        "g-s1-b4",
        "g-s2-b2",
        "g-default-society-level",
        "g-default-social-band",
      ],
    },
    {
      societyId: "society-level-2",
      band: 2,
      expected: [
        "g-s1-b1",
        "g-s1-b2",
        "g-s2-b2",
        "g-default-society-level",
        "g-default-social-band",
      ],
    },
    // Level-1 society: the only place the unset-minSocietyLevel default is observable.
    {
      societyId: "society-level-1",
      band: 4,
      expected: [
        "g-s1-b1",
        "g-s1-b2",
        "g-s1-b3",
        "g-s1-b4",
        "g-default-society-level",
        "g-default-social-band",
      ],
    },
    {
      societyId: "society-level-1",
      band: 2,
      expected: ["g-s1-b1", "g-s1-b2", "g-default-society-level", "g-default-social-band"],
    },
    {
      societyId: "society-level-1",
      band: 1,
      expected: ["g-s1-b1", "g-default-society-level", "g-default-social-band"],
    },
    // Out-of-range band: early-return guard (levels outside 1..4 yield nothing).
    { societyId: "society-level-4", band: 5, expected: [] },
    { societyId: "society-level-4", band: 0, expected: [] },
    { societyId: "society-level-1", band: 5, expected: [] },
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
