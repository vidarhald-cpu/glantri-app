import { describe, expect, it } from "vitest";
import { getApprovedV2RuntimeContent } from "@glantri/content";

import { resolveCompetencyV2PathAvailability } from "../professions/resolveCompetencyV2Path";
import { buildChargenSkillAccessSummary, getAllowedPrimaryGroupIds } from "./primaryAllocation";

/**
 * Control-plane ruling, 2026-10-20 (Forgejo #731): Profession availability must consider the
 * Profession's **authored valid training routes**, and a restricted core route must not invalidate
 * another route that is authored and valid for the Character.
 *
 * Before the repair `resolveCompetencyV2PathAvailability` filtered the routes by their authored
 * bounds, computed the reachable Learning Groups and direct Competencies from the routes that
 * survived, and then discarded all of it whenever no defining core route was reachable. A Thyatis
 * Common Folk Character reached zero normal access on 15 Professions, 13 of which have an open
 * authored route. Those alternatives were computed and thrown away.
 *
 * Nothing here relaxes a bound. Every route keeps its authored `minSocialBand` and
 * `minSocietyLevel`, the restricted core-route Learning Groups stay out of reach, and a Profession
 * whose every authored route is closed stays unavailable.
 *
 * Measured against the real approved V2 catalogue: a hand-built path object would prove nothing,
 * because the defect is in how the authored routes are aggregated.
 *
 * Re-measured after the content ruling of 2026-10-20 (Forgejo #732) removed the mis-encoded
 * `minSocialBand: "L2"` from F24 Ironmaking and forge apprenticeship. On the corrected catalogue a
 * Thyatis Common Folk Character reaches 73 available Professions before the repair and 86 after:
 * the same 13 gains, and Smith and Smelter now open to Band 1 under both, because #732 brings their
 * core-route Learning Group back within reach. Smith and Smelter are therefore no longer a control
 * here; the Social-Band control is Building Designer among the Scythians (below).
 */
const content = getApprovedV2RuntimeContent();
const paths = content.competencyV2!.paths;

/** Thyatis is the reported Civilization: `linkedSocietyId` is this society, at Society Level 5. */
const THYATIS_SOCIETY_ID = "imperial_classical_high_civ";
/** Common Folk. */
const BAND_1 = 1;
/** The highest Social Band, used by the control so no band can be the reason it is closed. */
const BAND_4 = 4;
/**
 * The control. `profession:mathematical-practitioner` has three authored routes and no direct
 * route, and all three are bounded on `minSocietyLevel: 3` alone — not one of them carries any
 * `minSocialBand`. Below Society Level 3 the Character has no authored valid route at any Social
 * Band, so the Profession must remain unavailable, and no Social-Band ruling can open it. That is
 * why it is the control rather than Smith or Smelter: the separate content ruling (#732) has since
 * opened those two at Band 1, and this control is untouched by it.
 */
const CONTROL_PATH_ID = "profession:mathematical-practitioner";
/** Society Level 2: below the control's authored `minSocietyLevel: 3`. */
const CONTROL_SOCIETY_ID = "pastoral_clan_nomadic";
/**
 * The secondary control, replacing Smith and Smelter, which Forgejo #732 opened. Among the
 * Scythians (Society Level 2) only one of Building Designer's three authored routes is within the
 * Society Level bound at all — the F28 group route — and that one route carries
 * `minSocialBand: "L2"`. Common Folk therefore have no authored valid route and the Profession must
 * stay unavailable, while Band 2 opens it. A pass-through `valid` would wrongly open it at Band 1,
 * which is what this control catches. The authored bound is asserted first, so a content lane that
 * changes it breaks the premise loudly instead of silently passing.
 */
const BAND_CONTROL_PATH_ID = "profession:building-designer";
const BAND_CONTROL_SOCIETY_ID = "pastoral_clan_nomadic";

function availability(professionId: string, societyId: string, socialBand: number) {
  return resolveCompetencyV2PathAvailability({ content, professionId, societyId, socialBand })!;
}

/** The authored routes of this path that are valid for this Character, by the authored bounds. */
function openRoutes(professionId: string, societyId: string, socialBand: number) {
  const societyLevel = content.societies!.find((society) => society.id === societyId)!.societyLevel;
  return paths
    .find((path) => path.id === professionId)!
    .routes.filter(
      (route) =>
        (route.minSocietyLevel ?? 1) <= societyLevel &&
        Number((route.minSocialBand ?? "L1").slice(1)) <= socialBand,
    );
}

/** What the Chargen consumers actually hand the player, not just the availability flag. */
function normalAccess(professionId: string, societyId: string, socialBand: number) {
  const summary = buildChargenSkillAccessSummary({
    content,
    professionId,
    societyId,
    societyLevel: socialBand,
  });
  return {
    groupIds: summary.normalSkillGroupIds,
    primaryGroupIds: getAllowedPrimaryGroupIds(content, professionId, societyId, socialBand),
    professionSkillIds: Object.entries(summary.skillSources)
      .filter(([, sources]) => sources.includes("profession-skill"))
      .map(([skillId]) => skillId),
  };
}

/**
 * The three reported Professions, each with the restricted core-route Learning Group that used to
 * close the whole occupation and the authored routes that were open all along.
 */
const reported = [
  {
    closedCoreGroupId: "G15",
    openGroupIds: ["K18", "K25"],
    openDirectSkillIds: ["skill:disguise"],
    pathId: "profession:thief",
  },
  {
    closedCoreGroupId: "F26",
    openGroupIds: ["C04"],
    openDirectSkillIds: [],
    pathId: "profession:armorer",
  },
  {
    closedCoreGroupId: "C07",
    openGroupIds: ["G04"],
    openDirectSkillIds: ["ropework", "skill:appraisal"],
    pathId: "profession:miner",
  },
] as const;

describe("Profession availability aggregates the authored route set (#731)", () => {
  describe.each(reported)(
    "$pathId",
    ({ closedCoreGroupId, openDirectSkillIds, openGroupIds, pathId }) => {
      it("keeps the restricted core route closed and still opens the authored alternatives", () => {
        const path = paths.find((candidate) => candidate.id === pathId)!;
        const open = openRoutes(pathId, THYATIS_SOCIETY_ID, BAND_1);
        const openIds = new Set(open.map((route) => route.id));

        // The core route is defined on the Learning Group that is restricted here, and the authored
        // bound on that one route is untouched: it is filtered out, exactly as before.
        expect(path.coreRoutes.flatMap((core) => core.groupIds)).toContain(closedCoreGroupId);
        expect(
          path.routes
            .filter((route) => route.groupId === closedCoreGroupId)
            .map((route) => route.minSocialBand),
        ).toEqual(["L2"]);
        expect([...openIds]).not.toContain(`${pathId}/group/${closedCoreGroupId}`);
        // ...and other authored routes were valid for this Character the whole time.
        expect(open.length).toBeGreaterThan(0);

        const resolved = availability(pathId, THYATIS_SOCIETY_ID, BAND_1);

        expect(resolved.valid).toBe(true);
        // No core route became reachable. The repair changed the aggregation, not any bound.
        expect(resolved.satisfiedCoreRouteIds).toEqual([]);
        expect(resolved.availableGroupIds).toEqual(expect.arrayContaining([...openGroupIds]));
        expect(resolved.availableGroupIds).not.toContain(closedCoreGroupId);
        expect(resolved.availableDirectSkillIds).toEqual(
          expect.arrayContaining([...openDirectSkillIds]),
        );
      });

      it("hands that access to the Character through the Chargen consumers", () => {
        const access = normalAccess(pathId, THYATIS_SOCIETY_ID, BAND_1);

        expect(access.primaryGroupIds).toEqual(expect.arrayContaining([...openGroupIds]));
        expect(access.primaryGroupIds).not.toContain(closedCoreGroupId);
        expect(access.groupIds).toEqual(expect.arrayContaining([...openGroupIds]));
        expect(access.professionSkillIds).toEqual(expect.arrayContaining([...openDirectSkillIds]));
        expect(access.groupIds.length + access.professionSkillIds.length).toBeGreaterThan(0);
      });
    },
  );

  it("keeps a Profession with no authored valid route unavailable, at every Social Band", () => {
    const path = paths.find((candidate) => candidate.id === CONTROL_PATH_ID)!;

    // Why this Profession is genuinely closed: every authored route is bounded on the Society
    // Level alone, and this society is below it. Nothing here is a Social-Band restriction.
    expect(path.routes.map((route) => route.minSocietyLevel)).toEqual([3, 3, 3]);
    expect(path.routes.map((route) => route.minSocialBand)).toEqual([
      undefined,
      undefined,
      undefined,
    ]);
    expect(path.routes.filter((route) => route.kind === "direct")).toEqual([]);

    for (const socialBand of [BAND_1, 2, 3, BAND_4]) {
      const resolved = availability(CONTROL_PATH_ID, CONTROL_SOCIETY_ID, socialBand);
      const access = normalAccess(CONTROL_PATH_ID, CONTROL_SOCIETY_ID, socialBand);

      expect(
        openRoutes(CONTROL_PATH_ID, CONTROL_SOCIETY_ID, socialBand),
        `band ${socialBand}`,
      ).toEqual([]);
      expect(resolved.valid, `band ${socialBand}`).toBe(false);
      expect(resolved.availableGroupIds, `band ${socialBand}`).toEqual([]);
      expect(resolved.availableDirectSkillIds, `band ${socialBand}`).toEqual([]);
      expect(resolved.availableSpecializationIds, `band ${socialBand}`).toEqual([]);
      expect(access.primaryGroupIds, `band ${socialBand}`).toEqual([]);
      expect(access.professionSkillIds, `band ${socialBand}`).toEqual([]);
    }
  });

  it("keeps a Profession closed by the authored Social Band unavailable at that band", () => {
    /*
     * Secondary control, replacing Smith and Smelter after Forgejo #732 opened them. The content
     * premise comes first: if a content lane moves either authored bound, this is what fails.
     */
    const path = paths.find((candidate) => candidate.id === BAND_CONTROL_PATH_ID)!;
    const society = content.societies!.find((row) => row.id === BAND_CONTROL_SOCIETY_ID)!;

    expect(society.societyLevel).toBe(2);
    expect(path.routes.map((route) => route.minSocietyLevel)).toEqual([2, 3, 3]);
    expect(path.routes.map((route) => route.minSocialBand)).toEqual(["L2", undefined, undefined]);

    // Exactly one authored route is within the Society Level bound here, and it is band-bounded.
    expect(openRoutes(BAND_CONTROL_PATH_ID, BAND_CONTROL_SOCIETY_ID, BAND_1)).toEqual([]);
    expect(
      openRoutes(BAND_CONTROL_PATH_ID, BAND_CONTROL_SOCIETY_ID, 2).map((route) => route.id),
    ).toEqual(["profession:building-designer/group/F28"]);

    const closed = availability(BAND_CONTROL_PATH_ID, BAND_CONTROL_SOCIETY_ID, BAND_1);

    expect(closed.valid).toBe(false);
    expect(closed.availableGroupIds).toEqual([]);
    expect(closed.availableDirectSkillIds).toEqual([]);
    expect(closed.availableSpecializationIds).toEqual([]);
    expect(
      normalAccess(BAND_CONTROL_PATH_ID, BAND_CONTROL_SOCIETY_ID, BAND_1).primaryGroupIds,
    ).toEqual([]);
    // ...and the next band up opens it, so the Social Band is demonstrably what closed it.
    expect(availability(BAND_CONTROL_PATH_ID, BAND_CONTROL_SOCIETY_ID, 2).valid).toBe(true);
  });

  it("gains exactly the 13 reported Professions and loses none", () => {
    const gained = paths
      .filter((path) => {
        const resolved = availability(path.id, THYATIS_SOCIETY_ID, BAND_1);
        return resolved.valid && resolved.satisfiedCoreRouteIds.length === 0;
      })
      .map((path) => path.id);

    /*
     * The 15 the defect measured, less Smith and Smelter, whose gain is a reachable core route
     * rather than an aggregated alternative: measured at 13 again on the Forgejo #732 catalogue.
     */
    expect([...gained].sort()).toEqual(
      [
        "profession:armorer",
        "profession:building-designer",
        "profession:locksmith",
        "profession:military-commander",
        "profession:military-scout",
        "profession:miner",
        "profession:sailmaker",
        "profession:shipbuilder",
        "profession:smuggler",
        "profession:thief",
        "profession:trader",
        "profession:vintner",
        "profession:weapon-instructor",
      ].sort(),
    );
    /*
     * Nothing is left unavailable for this Character. Before Forgejo #732 this was Smith and
     * Smelter, closed by the `minSocialBand: "L2"` that ruling removed from F24; the content premise
     * is that the surviving trades-tier bounds no longer close anything at Band 1 in a Society
     * Level 5 society. The Social-Band control above holds the closed direction, among the Scythians.
     */
    expect(
      paths
        .filter((path) => !availability(path.id, THYATIS_SOCIETY_ID, BAND_1).valid)
        .map((p) => p.id),
    ).toEqual([]);
  });

  it("makes availability the authored route set across the whole catalogue, and nothing looser", () => {
    for (const path of paths) {
      for (const society of content.societies!) {
        for (const socialBand of [BAND_1, 2, 3, BAND_4]) {
          const resolved = availability(path.id, society.id, socialBand);
          const open = openRoutes(path.id, society.id, socialBand);
          const label = `${path.id}/${society.id}/${socialBand}`;

          expect(resolved.valid, label).toBe(open.length > 0);
          // Reachable content never exceeds what the surviving authored routes themselves carry.
          expect(
            resolved.availableGroupIds.every((groupId) =>
              open.some((route) => route.groupId === groupId),
            ),
            label,
          ).toBe(true);
          expect(
            resolved.availableDirectSkillIds.every((skillId) =>
              open.some((route) => route.kind === "direct" && route.skillIds.includes(skillId)),
            ),
            label,
          ).toBe(true);
          if (!resolved.valid) {
            expect(resolved.availableGroupIds, label).toEqual([]);
            expect(resolved.availableDirectSkillIds, label).toEqual([]);
          }
        }
      }
    }
  });

  it("remeasures Thief against Political Agent for the reported Character", () => {
    /*
     * The pair that made the defect visible: two clandestine occupations on the same Character,
     * one open and one shut. Political Agent was already available because its own core-route
     * Learning Group, G10, carries no restriction. After the repair Thief is available too,
     * through K18, K25 and its direct route, while G15 stays closed. Thief is no longer blocked,
     * so the ruling's condition for a further content exception is not met.
     */
    const thief = availability("profession:thief", THYATIS_SOCIETY_ID, BAND_1);
    const politicalAgent = availability("profession:political-agent", THYATIS_SOCIETY_ID, BAND_1);

    expect(thief.valid).toBe(true);
    expect(politicalAgent.valid).toBe(true);
    expect(politicalAgent.satisfiedCoreRouteIds).toEqual(["profession:political-agent:core"]);
    expect(openRoutes("profession:political-agent", THYATIS_SOCIETY_ID, BAND_1)).toHaveLength(4);
    expect(
      openRoutes("profession:thief", THYATIS_SOCIETY_ID, BAND_1).map((route) => route.label),
    ).toEqual([
      "Standing in an illicit milieu",
      "Learning the trade from an established thief",
      "Taught directly by an established thief",
    ]);
  });
});
