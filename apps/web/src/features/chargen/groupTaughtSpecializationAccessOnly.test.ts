/**
 * Forgejo #382 — a Learning Group gives a genuine Specialization an acquisition and training
 * route only. It grants no Specialization XP and funds no Specialization progression.
 *
 * Rule sources:
 * - `docs/decisions/rules/0010-competency-classification-and-group-taught-specializations.md`
 *   ruling 3, clauses 1, 4, 5, 6 and 7: Group cost and Group XP apply to the Group's base
 *   Skills; a listed Specialization is acquired and progressed separately; it receives no
 *   retroactive Group-XP catch-up; further Group purchases add no Specialization Group XP;
 *   relationships may still establish non-additive minima.
 * - `docs/rules/competency-rules.md`: "An explicit Specialization in a Learning Group is
 *   access-only and is purchased separately".
 *
 * These cases are deliberately built on the catalogue Chargen actually loads —
 * `withCompetencyContentV2(buildTargetRuntimeContent(createTargetCompetencyChargenSource(...)))`,
 * the construction in `useChargenWizardState.tsx` — as
 * `docs/testing-regression-matrix.md` ("Which competency catalogue a Chargen reproduction must
 * use") requires. The legacy `getApprovedTargetChargenContent()` catalogue is not a valid
 * source of evidence about player-facing Chargen behaviour.
 *
 * The point pools are widened past the standard allowances so a single case can drive a
 * Learning Group to the ranks the defect needs. Only the pool sizes are widened; the content,
 * the Professions, the Society access and every price come from the real V2 projection.
 */
import { describe, expect, it } from "vitest";

import {
  type CanonicalContent,
  defaultCanonicalContent,
  withCompetencyContentV2,
} from "@glantri/content";
import type { CharacterProgression } from "@glantri/domain";
import {
  allocateChargenPoint,
  buildChargenDraftView,
  type ChargenDraftView,
  createChargenProgression,
  spendSecondaryPoint,
} from "@glantri/rules-engine";

import {
  buildCharacterSheetSpecializationRows,
  type CharacterSheetSpecializationRow,
} from "../../lib/characters/characterSheet";
import {
  buildTargetRuntimeContent,
  createTargetCompetencyChargenSource,
} from "./targetCompetencyContent";

const SOCIETY_ID = "feudal_manorial_kingdom";
const SOCIAL_BAND = 4;

function buildChargenContent(): CanonicalContent {
  return withCompetencyContentV2(
    buildTargetRuntimeContent(createTargetCompetencyChargenSource(defaultCanonicalContent)),
  );
}

function createHarness(input: { content: CanonicalContent; professionId: string }) {
  let progression: CharacterProgression = {
    ...createChargenProgression(),
    primaryPoolTotal: 200,
    secondaryPoolTotal: 200,
  };

  const shared = {
    content: input.content,
    professionId: input.professionId,
    societyId: SOCIETY_ID,
    societyLevel: SOCIAL_BAND,
  };

  return {
    buySkillOrGroup(targetId: string, targetType: "group" | "skill", times = 1): void {
      for (let attempt = 0; attempt < times; attempt += 1) {
        const result = allocateChargenPoint({ ...shared, progression, targetId, targetType });
        expect(result.error).toBeUndefined();
        progression = result.progression;
      }
    },
    buySpecialization(specializationId: string): number | undefined {
      const result = spendSecondaryPoint({
        ...shared,
        progression,
        targetId: specializationId,
        targetType: "specialization",
      });
      expect(result.error).toBeUndefined();
      progression = result.progression;
      return result.spentCost;
    },
    groupLevel(groupId: string): number | undefined {
      return this.view().groups.find((group) => group.groupId === groupId)?.groupLevel;
    },
    skillLevel(skillId: string): number | undefined {
      return this.view().skills.find((skill) => skill.skillId === skillId)?.effectiveSkillNumber;
    },
    specialization(specializationId: string) {
      return this.view().specializations.find(
        (specialization) => specialization.specializationId === specializationId,
      );
    },
    view(): ChargenDraftView {
      return buildChargenDraftView({ ...shared, progression });
    },
  };
}

function sheetRows(input: {
  content: CanonicalContent;
  view: ChargenDraftView;
}): CharacterSheetSpecializationRow[] {
  // `buildCharacterSheetSpecializationRows` reads only `sheetSummary.draftView.specializations`,
  // so the real draft view is the whole input the mapping consumes.
  return buildCharacterSheetSpecializationRows({
    content: input.content,
    sheetSummary: { draftView: input.view } as Parameters<
      typeof buildCharacterSheetSpecializationRows
    >[0]["sheetSummary"],
  });
}

describe("group-taught Specializations are access-only in the V2 Chargen projection", () => {
  it("does not pay Specialization XP for F29 ranks, before or after the purchase", () => {
    // Forgejo #382 section 0.3, the canonical reproduction.
    const content = buildChargenContent();
    const harness = createHarness({ content, professionId: "profession:surgeon:field" });

    harness.buySkillOrGroup("F29", "group", 4);
    expect(harness.groupLevel("F29")).toBe(4);

    harness.buySkillOrGroup("skill:surgery", "skill", 2);
    // `battlefield_surgery` carries `minimumParentLevel: 6`, satisfied by the parent Skill.
    expect(harness.skillLevel("skill:surgery")).toBe(6);

    expect(harness.buySpecialization("battlefield_surgery")).toBe(4);

    // Ruling 3 clauses 4 and 5: acquired and progressed separately, with no retroactive
    // Group-XP catch-up. One purchased rank is one rank of competence.
    expect(harness.specialization("battlefield_surgery")).toMatchObject({
      effectiveSpecializationNumber: 1,
      relationshipGrantedSpecializationLevel: 0,
      secondaryRanks: 1,
      specializationLevel: 1,
    });

    // Ruling 3 clause 6: further Group purchases add no Specialization Group XP.
    harness.buySkillOrGroup("F29", "group", 2);
    expect(harness.groupLevel("F29")).toBe(6);
    expect(harness.specialization("battlefield_surgery")?.effectiveSpecializationNumber).toBe(1);

    // The displayed total is the sum of the displayed columns.
    expect(
      sheetRows({ content, view: harness.view() }).find(
        (row) => row.specializationId === "battlefield_surgery",
      ),
    ).toMatchObject({ grantedXp: 0, total: 1, xp: 1 });
  });

  it("gives a Group no Specialization XP through the Specialization's parent Skill", () => {
    // The defect's actual mechanism: the half-group term came from the Specialization's PARENT
    // SKILL's strongest active Group, not from the Group that teaches the Specialization.
    // K06 "Religious service practice" teaches `spec:theology`, never `spec:courtly-protocol`,
    // but it does teach `skill:customs`, which is `spec:courtly-protocol`'s parent. Before the
    // repair this row read 7 at group level 12.
    const content = buildChargenContent();
    const k06 = content.skillGroups.find((group) => group.id === "K06")!;
    expect(k06.specializationIds).not.toContain("spec:courtly-protocol");
    expect(k06.skillMemberships?.map(({ skillId }) => skillId)).toContain("skill:customs");

    const harness = createHarness({ content, professionId: "profession:religious-practitioner" });
    harness.buySkillOrGroup("K06", "group", 12);
    expect(harness.groupLevel("K06")).toBe(12);
    // `spec:courtly-protocol` carries `minimumParentLevel: 11`, satisfied by the Group-taught
    // parent Skill. Access through a Group is exactly what ruling 3 clause 2 allows.
    expect(harness.skillLevel("skill:customs")).toBe(12);

    expect(harness.buySpecialization("spec:courtly-protocol")).toBe(4);
    expect(harness.specialization("spec:courtly-protocol")).toMatchObject({
      effectiveSpecializationNumber: 1,
      relationshipGrantedSpecializationLevel: 0,
      secondaryRanks: 1,
    });

    harness.buySkillOrGroup("K06", "group", 2);
    expect(harness.groupLevel("K06")).toBe(14);
    expect(harness.specialization("spec:courtly-protocol")?.effectiveSpecializationNumber).toBe(1);
  });

  it("holds for the teaching Group that never inflated, and for the parent's Group that did", () => {
    // Control pair, recorded so a future reader cannot mistake the teaching Group for the
    // mechanism. K04 "Astrological reading practice" teaches `spec:omen-reading` but does not
    // teach its parent `divination`: K04 never inflated it, and an acceptance case written
    // against the teaching Group would therefore have passed while the defect was live.
    // K05 "Divinatory practice" does teach `divination`, and took it to 7 before the repair.
    const content = buildChargenContent();
    const k04 = content.skillGroups.find((group) => group.id === "K04")!;
    const k05 = content.skillGroups.find((group) => group.id === "K05")!;
    expect(k04.specializationIds).toContain("spec:omen-reading");
    expect(k04.skillMemberships?.map(({ skillId }) => skillId)).not.toContain("divination");
    expect(k05.skillMemberships?.map(({ skillId }) => skillId)).toContain("divination");

    const harness = createHarness({ content, professionId: "profession:diviner" });
    harness.buySkillOrGroup("divination", "skill", 11);
    expect(harness.skillLevel("divination")).toBe(11);
    expect(harness.buySpecialization("spec:omen-reading")).toBe(4);
    expect(harness.specialization("spec:omen-reading")?.effectiveSpecializationNumber).toBe(1);

    harness.buySkillOrGroup("K04", "group", 12);
    expect(harness.groupLevel("K04")).toBe(12);
    expect(harness.specialization("spec:omen-reading")?.effectiveSpecializationNumber).toBe(1);

    harness.buySkillOrGroup("K05", "group", 12);
    expect(harness.groupLevel("K05")).toBe(12);
    expect(harness.specialization("spec:omen-reading")?.effectiveSpecializationNumber).toBe(1);
  });

  it("records that a Specialization whose parent is a Specialization has no Group at all", () => {
    // `spec:falconry`'s parent is itself a Specialization, so the retired arithmetic could
    // never reach it. It is a structural immunity, not a repaired case, and is recorded here
    // so it is not mistaken for evidence that the repair works.
    const content = buildChargenContent();
    const falconry = content.specializations.find(
      (specialization) => specialization.id === "spec:falconry",
    )!;
    expect(content.skills.some((skill) => skill.id === falconry.skillId)).toBe(false);
    expect(
      content.specializations.some((specialization) => specialization.id === falconry.skillId),
    ).toBe(true);
  });
});
