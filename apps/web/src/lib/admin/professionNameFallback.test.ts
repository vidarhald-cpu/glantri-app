import { describe, expect, it, vi } from "vitest";

import { defaultCanonicalContent, type CanonicalContent } from "@glantri/content";

// The real package resolver throws for an id that is not in the catalogue, which
// stops the builders before the display fallback can be reached. Stand in for it
// only for ids it does not know, so the fallback at each call site is exercised.
vi.mock("@glantri/rules-engine", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@glantri/rules-engine")>();
  const emptyPackage = {
    finalEffectiveGroupIds: [],
    finalEffectiveReachableSkillIds: [],
    finalEffectiveSkillIds: [],
    reachableSkillIdsThroughGroups: []
  };

  return {
    ...actual,
    resolveEffectiveProfessionPackage: (input: {
      content: { professions: Array<{ id: string }> };
      subtypeId?: string;
    }) =>
      input.content.professions.some((profession) => profession.id === input.subtypeId)
        ? actual.resolveEffectiveProfessionPackage(
            input as Parameters<typeof actual.resolveEffectiveProfessionPackage>[0]
          )
        : { core: emptyPackage, favored: emptyPackage }
  };
});

import {
  PROFESSION_UNAVAILABLE_LABEL,
  resolveProfessionDisplayName
} from "./view-models/_helpers";
import { buildSocietyAuditIssues, buildSocietyMatrixRows } from "./viewModels";

const UNAVAILABLE = "Profession unavailable";
const societyId = "fallback_society";
const resolvableId = "profession:courier:messenger";
const resolvableName = "Courier and Messenger";

function level(societyLevel: number, professionIds: string[]) {
  return {
    professionIds,
    skillGroupIds: [],
    skillIds: [],
    socialClass: "Common",
    societyId,
    societyLevel,
    societyName: "Fallback Society"
  };
}

// `profession:courier` is not in this catalogue; `profession:courier:messenger`
// is, and carries a title that no slicing or title-casing of either id could
// reproduce. A forged id whose tail looks like a name therefore exposes munging.
function withProfessions(levelOneIds: string[], levelTwoIds: string[]): CanonicalContent {
  return {
    ...defaultCanonicalContent,
    professions: [
      ...defaultCanonicalContent.professions,
      { ...defaultCanonicalContent.professions[0], id: resolvableId, name: resolvableName }
    ],
    societies: [
      ...defaultCanonicalContent.societies,
      { id: societyId, name: "Fallback Society", shortDescription: "", societyLevel: 2 }
    ],
    societyLevels: [
      ...defaultCanonicalContent.societyLevels,
      level(1, levelOneIds),
      level(2, levelTwoIds)
    ]
  } as unknown as CanonicalContent;
}

const matrixRow = (content: CanonicalContent) =>
  buildSocietyMatrixRows(content).find((row) => row.id === `${societyId}:1`);
const regressionIssue = (content: CanonicalContent) =>
  buildSocietyAuditIssues(content).find((issue) => issue.id === `profession-regression:${societyId}:2`);

describe("Admin Profession display name fallback", () => {
  it("uses the ruled wording", () => {
    expect(PROFESSION_UNAVAILABLE_LABEL).toBe(UNAVAILABLE);
  });

  it("resolves the catalogue name at both sites for a known id", () => {
    const fixture = withProfessions([resolvableId], []);

    expect(matrixRow(fixture)?.reachableProfessions).toEqual([resolvableName]);
    expect(regressionIssue(fixture)?.relatedEntries).toEqual([resolvableName]);
  });

  it("shows Profession unavailable, never the id, at the society matrix site", () => {
    const row = matrixRow(withProfessions(["profession:ghost"], []));

    expect(row?.reachableProfessions).toEqual([UNAVAILABLE]);
    expect(JSON.stringify(row?.reachableProfessions)).not.toContain("ghost");
  });

  it("shows Profession unavailable, never the id, at the society audit site", () => {
    const issue = regressionIssue(withProfessions(["profession:ghost"], []));

    expect(issue?.relatedEntries).toEqual([UNAVAILABLE]);
    expect(JSON.stringify(issue?.relatedEntries)).not.toContain("ghost");
  });

  it("does not derive a name from the id: a forged id with a name-like tail stays unavailable", () => {
    const fixture = withProfessions(["profession:courier", "profession:messenger"], []);

    for (const shown of [matrixRow(fixture)?.reachableProfessions, regressionIssue(fixture)?.relatedEntries]) {
      const text = JSON.stringify(shown).toLowerCase();

      expect(text).not.toContain("courier");
      expect(text).not.toContain("messenger");
      expect(text).not.toContain("profession:");
      expect(shown?.every((entry) => entry === UNAVAILABLE)).toBe(true);
    }
  });

  it("resolveProfessionDisplayName never returns or reshapes the id", () => {
    const byId = new Map([[resolvableId, { name: resolvableName }]]);

    expect(resolveProfessionDisplayName(byId, resolvableId)).toBe(resolvableName);
    expect(resolveProfessionDisplayName(byId, "profession:courier")).toBe(UNAVAILABLE);
    expect(resolveProfessionDisplayName(byId, "profession:courier:messenger:x")).toBe(UNAVAILABLE);
  });
});
