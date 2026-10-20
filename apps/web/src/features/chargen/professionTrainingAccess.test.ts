import { describe, expect, it } from "vitest";

import {
  competencyContentV2GroupAvailability,
  defaultCanonicalContent,
  withCompetencyContentV2,
} from "@glantri/content";
import { buildProfessionTrainingAccess } from "./professionTrainingAccess";
import {
  buildTargetRuntimeContent,
  createTargetCompetencyChargenSource,
} from "./targetCompetencyContent";

/**
 * Forgejo #635 — intentional inaccessibility, made understandable.
 *
 * The Product Owner ruling of 2026-10-15 keeps the accepted access behaviour unchanged: the remedy
 * is explanation, not a mechanics change. These cases bind the explanation to the accepted
 * catalogue and hold the two bounds the ruling names: no invented reason, and no raw identifier or
 * implementation vocabulary in anything a reader sees.
 *
 * The population the explanation covers is re-measured under Forgejo #731 (control-plane ruling,
 * 2026-10-20). 569 of the 5504 combinations used to reach no training; 509 of those did have an
 * authored route valid for the Character, and were reported as closed only because
 * `resolveCompetencyV2PathAvailability` discarded the whole route set whenever no defining core
 * route was reachable. 60 combinations are closed on the authored content itself and still explain
 * themselves here. Not one bound changed, and nothing a reader is shown was reworded.
 */
const content = withCompetencyContentV2(
  buildTargetRuntimeContent(createTargetCompetencyChargenSource(defaultCanonicalContent)),
);
const societyById = new Map(content.societies!.map((society) => [society.id, society]));
const civilizations = content.civilizations.filter((civilization) =>
  societyById.has(civilization.linkedSocietyId!),
);
const paths = content.competencyV2!.paths;

function accessFor(civilizationId: string, professionId: string, socialBand: number) {
  const civilization = content.civilizations.find((row) => row.id === civilizationId)!;
  return buildProfessionTrainingAccess({
    civilizationName: civilization.name,
    content,
    professionId,
    socialBand,
    societyId: civilization.linkedSocietyId,
  });
}

const closedCombinations = civilizations.flatMap((civilization) =>
  [1, 2, 3, 4].flatMap((socialBand) =>
    paths.flatMap((path) => {
      const access = buildProfessionTrainingAccess({
        civilizationName: civilization.name,
        content,
        professionId: path.id,
        socialBand,
        societyId: civilization.linkedSocietyId,
      });
      return access
        ? [{ access, civilizationId: civilization.id, professionId: path.id, socialBand }]
        : [];
    }),
  ),
);

/* Everything a reader is shown, for the negative assertions. */
const renderedText = (access: NonNullable<ReturnType<typeof accessFor>>) =>
  [access.situation, ...access.authoredReasons].join(" ");

describe("Profession training access explanation", () => {
  it("explains exactly the combinations that reach no training, and no others", () => {
    expect(civilizations).toHaveLength(16);
    expect(paths).toHaveLength(86);
    expect(closedCombinations).toHaveLength(60);
  });

  it("names a Scythian Profession closed by its own authored routes, at every social class", () => {
    /*
     * #635 reported Scythians + Scribe and Copyist. Under #731 that pair is no longer closed: the
     * records office (`G11`) is still out of reach among the Scythians, but the catalogue also
     * authors "Taught directly in the writing room" with no Society-Level bound, and that route was
     * valid for the Character all along. Mathematical Practitioner is the Scythian case that is
     * genuinely closed — all three of its authored routes are bounded at Society Level 3 and it has
     * no direct route — so it is what the explanation must still name.
     */
    expect(accessFor("scythians", "profession:scribe", 1)).toBeUndefined();

    for (const socialBand of [1, 2, 3, 4]) {
      const access = accessFor("scythians", "profession:mathematical-practitioner", socialBand);

      expect(access, `band ${socialBand}`).toBeDefined();
      expect(access!.closedBy).toBe("society");
      expect(access!.situation).toBe("No one among the Scythians trains this Profession.");
      expect(access!.authoredReasons).toEqual([
        "Applied calculation is kept accounts and measured ground reduced to figures.",
      ]);
    }
  });

  it("leaves a Profession whose training is reachable without any explanation", () => {
    for (const professionId of [
      "profession:carpenter",
      "profession:cook",
      "profession:physician",
      "profession:mason",
    ])
      expect(accessFor("scythians", professionId, 2), professionId).toBeUndefined();
  });

  it("distinguishes the society from the social class, and reports both where both close it", () => {
    const byClosure = closedCombinations.reduce<Record<string, number>>((totals, row) => {
      totals[row.access.closedBy] = (totals[row.access.closedBy] ?? 0) + 1;
      return totals;
    }, {});

    expect(byClosure).toEqual({
      society: 25,
      "social-class": 32,
      "society-and-social-class": 3,
    });
  });

  it("quotes the accepted catalogue and never composes a reason of its own", () => {
    const authored = new Set(
      Object.values(competencyContentV2GroupAvailability).map((bound) => bound.reason),
    );

    for (const row of closedCombinations) {
      expect(
        row.access.authoredReasons.length,
        `${row.civilizationId}/${row.professionId}`,
      ).toBeGreaterThan(0);
      for (const reason of row.access.authoredReasons)
        expect(authored.has(reason), reason).toBe(true);
    }
  });

  it("states the situation without inventing a rationale when no authored reason is attributable", () => {
    /*
     * No current combination reaches this branch — every one of the 60 attributes an authored
     * reason — so it is held against content whose bound carries none. A fabricated rationale is the
     * one thing the ruling forbids outright.
     *
     * Two conditions have to hold at once, and #731 separated them: no authored route may be valid
     * for the Character, which is what makes the Profession closed, and the core route must then
     * need something no route of the path reaches, which is what leaves the closure unattributed.
     */
    const unattributed = structuredClone(content) as typeof content;
    const scribe = unattributed.competencyV2!.paths.find(
      (path) => path.id === "profession:scribe",
    )!;
    for (const route of scribe.routes) route.minSocietyLevel = 6;
    scribe.coreRoutes = [
      {
        groupIds: ["group-that-no-route-reaches"],
        id: "synthetic-core",
        label: "Synthetic",
        skillIds: [],
        writtenLanguageChoiceCount: 0,
      },
    ];

    const access = buildProfessionTrainingAccess({
      civilizationName: "Scythians",
      content: unattributed,
      professionId: "profession:scribe",
      socialBand: 2,
      societyId: "pastoral_clan_nomadic",
    });

    expect(access).toEqual({
      authoredReasons: [],
      closedBy: "unattributed",
      situation: "No training for this Profession is available to this Character.",
    });
  });

  it("exposes no raw identifier in any of the 60 explanations", () => {
    const patterns = [
      /\b(?:profession|skill|group|society|civilization|specialization):/i,
      /\b[A-Z]\d{2}\b/,
      /[a-z]+_[a-z]+/,
    ];

    for (const row of closedCombinations) {
      const text = renderedText(row.access);
      for (const pattern of patterns)
        expect(text, `${row.civilizationId}/${row.professionId}/${pattern}`).not.toMatch(pattern);
    }
  });

  it("writes no implementation vocabulary of its own into the situation sentence", () => {
    const situations = new Set(closedCombinations.map((row) => row.access.situation));

    expect([...situations].sort()).toEqual([
      "No one among the Latial Chiefdoms trains this Profession.",
      "No one among the San Forager Bands trains this Profession, and its training is not open to a Character of this social class either.",
      "No one among the San Forager Bands trains this Profession.",
      "No one among the Scythians trains this Profession.",
      "This Profession's training is not open to a Character of this social class.",
    ]);
    for (const situation of situations)
      for (const term of ["core route", "availability", "projection", "schema", "route"])
        expect(situation.toLowerCase(), term).not.toContain(term);
  });

  it("says nothing at all until the draft has chosen a Civilization, a social class and a Profession", () => {
    expect(
      buildProfessionTrainingAccess({ content, professionId: "profession:scribe", socialBand: 1 }),
    ).toBeUndefined();
    expect(
      buildProfessionTrainingAccess({
        content,
        professionId: "profession:scribe",
        societyId: "pastoral_clan_nomadic",
      }),
    ).toBeUndefined();
    expect(
      buildProfessionTrainingAccess({
        content,
        socialBand: 1,
        societyId: "pastoral_clan_nomadic",
      }),
    ).toBeUndefined();
  });
});
