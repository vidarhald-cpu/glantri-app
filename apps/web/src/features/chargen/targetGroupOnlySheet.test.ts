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
function finalized(direct = false) {
  const base = characterBuildSchema.parse(characterPayload("synthetic", "Synthetic").build);
  const context = {
    content: approved,
    professionId: "profession:soldier",
    profile: base.profile,
    societyId: "pastoral_clan_nomadic",
    societyLevel: 1,
  };
  let progression = allocateChargenPoint({
    ...context,
    progression: {
      ...createChargenProgression(),
      chargenSelections: {
        selectedCoreRouteId: "profession:soldier:core:contingent",
        selectedLanguageIds: [],
        selectedSkillIds: [],
        selectedGroupSlots: [
          {
            groupId: "M01",
            slotId: "melee-family",
            selectedSkillIds: ["one_handed_edged"],
          },
        ],
      },
    },
    targetId: "M01",
    targetType: "group",
  }).progression;
  progression = allocateChargenPoint({
    ...context,
    progression,
    targetId: "F41",
    targetType: "group",
  }).progression;
  if (direct)
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
      const build = finalized(direct);
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
      for (const id of ["bow", "skill:hunting"]) {
        const match = rows.filter((row) => row.skillId === id);
        expect(match).toHaveLength(1);
        expect(match[0]).toMatchObject({
          skillGroupXp: 1,
          totalXp: id === "bow" && direct ? 2 : 1,
        });
      }
      expect(JSON.stringify(build)).toBe(before);
      expect(build.progression.primaryPoolSpent).toBe(direct ? 7 : 5);
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
    const build = finalized(true);
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
    expect(build.progression.primaryPoolSpent).toBe(7);
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
