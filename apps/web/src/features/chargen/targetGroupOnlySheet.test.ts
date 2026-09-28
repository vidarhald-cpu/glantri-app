import { describe, expect, it } from "vitest";
import { defaultCanonicalContent, getApprovedV2RuntimeContent } from "@glantri/content";
import { characterBuildSchema } from "@glantri/domain";
import {
  allocateChargenPoint,
  createChargenProgression,
  finalizeChargenDraft,
  buildCharacterSheetSummary,
  validateTargetChargenBuild,
} from "@glantri/rules-engine";
import { characterPayload } from "../../../e2e/character-fixture";
import { buildCharacterSheetSkillRows } from "../../lib/characters/characterSheet";
const approved = getApprovedV2RuntimeContent();
/*
 * The Hunter and Trapper is F41's Profession. Issue #389 removes F41 from the Soldier package —
 * rule decision 0010 ruling 2 keeps the military longbow path out of the civilian hunting
 * apprenticeship — so this group-only sheet is built on the civilian route that actually offers it.
 * F41 now teaches Longbow and Hunting and charges no Bow, so Bow is the separately purchased skill.
 */
function finalized(bowPurchases = 0) {
  const base = characterBuildSchema.parse(characterPayload("synthetic", "Synthetic").build);
  const context = {
    content: approved,
    professionId: "profession:hunter-trapper",
    profile: base.profile,
    societyId: "pastoral_clan_nomadic",
    societyLevel: 1,
  };
  let progression = allocateChargenPoint({
    ...context,
    progression: {
      ...createChargenProgression(),
      chargenSelections: {
        selectedCoreRouteId: "profession:hunter-trapper:core",
        selectedLanguageIds: [],
        selectedSkillIds: [],
        selectedGroupSlots: [],
      },
    },
    targetId: "G03",
    targetType: "group",
  }).progression;
  progression = allocateChargenPoint({
    ...context,
    progression,
    targetId: "F41",
    targetType: "group",
  }).progression;
  for (let index = 0; index < bowPurchases; index += 1)
    progression = allocateChargenPoint({
      ...context,
      progression,
      targetId: "bow",
      targetType: "skill",
    }).progression;
  const result = finalizeChargenDraft({ ...context, progression, name: "Group only archer" });
  expect(result.errors).toEqual([]);
  return characterBuildSchema.parse(JSON.parse(JSON.stringify(result.build)));
}
describe("saved target group-only sheet with real legacy content fallback", () => {
  for (const direct of [false, true])
    it(`resolves approved group members without inventing purchases (direct=${direct})`, () => {
      const build = finalized(direct ? 1 : 0);
      const before = JSON.stringify(build);
      expect(
        build.progression.skills
          .filter((s) => s.primaryRanks + s.secondaryRanks > 0)
          .map((s) => s.skillId),
      ).toEqual(direct ? ["bow"] : []);
      const summary = buildCharacterSheetSummary({ build, content: defaultCanonicalContent });
      const rows = buildCharacterSheetSkillRows({
        build,
        content: defaultCanonicalContent,
        sheetSummary: summary,
      }).flatMap((section) => section.rows);
      /* F41's members are Longbow and Hunting. LONGBOW MUST RESOLVE HERE as an ordinary group-taught
         Skill row — this is the vanishing check on the saved-sheet surface. */
      for (const id of ["longbow", "skill:hunting"]) {
        const match = rows.filter((row) => row.skillId === id);
        expect(match).toHaveLength(1);
        expect(match[0]).toMatchObject({ skillGroupXp: 1, totalXp: 1 });
      }
      /* Bow is charged only when it is actually purchased: F41 no longer teaches it. */
      const bowRows = rows.filter((row) => row.skillId === "bow");
      if (direct) {
        expect(bowRows).toHaveLength(1);
        expect(bowRows[0]).toMatchObject({ skillGroupXp: 0, totalXp: 1 });
      } else {
        expect(bowRows).toEqual([]);
      }
      expect(JSON.stringify(build)).toBe(before);
      // Learning Groups are priced once as a complete bundle through the shared canonical
      // acquisition arithmetic, ceil(2/3 * weightedUseful)
      // (docs/rules/pilot-skill-rules-v1.md section 4).
      expect(build.progression.primaryPoolSpent).toBe(direct ? 9 : 7);
    });
  it("rejects forged group/member and source metadata in summary and UI projections", () => {
    for (const mutate of [
      (b: ReturnType<typeof finalized>) => {
        b.progression.skillGroups[0].targetDefinition!.skillMemberships = [];
      },
      (b: ReturnType<typeof finalized>) => {
        b.targetChargen!.sourceDigest = "forged";
      },
    ]) {
      const build = finalized();
      const validSummary = buildCharacterSheetSummary({ build, content: defaultCanonicalContent });
      mutate(build);
      expect(() =>
        buildCharacterSheetSummary({ build, content: defaultCanonicalContent }),
      ).toThrow();
      expect(() =>
        buildCharacterSheetSkillRows({
          build,
          content: defaultCanonicalContent,
          sheetSummary: validSummary,
        }),
      ).toThrow();
    }
  });
  it("retains canonical relationship grants while rejecting excess/self-asserted derived ranks", () => {
    /* Two Bow purchases, because F41 contributes no Bow group XP any more: Crossbow's authored 50%
       derived grant from Bow needs Bow at 2 to round to 1. The relationship itself is unchanged. */
    const build = finalized(2);
    const crossbow = build.progression.skills.find((s) => s.skillId === "crossbow")!;
    expect(crossbow.relationshipGrantedRanks).toBe(1);
    expect(crossbow.primaryRanks + crossbow.secondaryRanks).toBe(0);
    expect(validateTargetChargenBuild(build, approved)).toEqual([]);
    for (const id of ["crossbow", "bow"]) {
      const forged = structuredClone(build);
      const row = forged.progression.skills.find((s) => s.skillId === id)!;
      row.relationshipGrantedRanks = (row.relationshipGrantedRanks ?? 0) + 9;
      row.ranks += 9;
      expect(
        validateTargetChargenBuild(forged, approved).some((e) =>
          e.includes("Invalid derived relationship grant"),
        ),
      ).toBe(true);
    }
    // Canonical bundle price, as above, plus the second individually purchased Bow.
    expect(build.progression.primaryPoolSpent).toBe(11);
  });
  it("keeps a historical build readable with its original content and spend", () => {
    const build = characterBuildSchema.parse(characterPayload("historical", "Historical").build);
    const before = JSON.stringify(build);
    const summary = buildCharacterSheetSummary({ build, content: defaultCanonicalContent });
    buildCharacterSheetSkillRows({
      build,
      content: defaultCanonicalContent,
      sheetSummary: summary,
    });
    expect(JSON.stringify(build)).toBe(before);
    expect(build.targetChargen).toBeUndefined();
  });
});
