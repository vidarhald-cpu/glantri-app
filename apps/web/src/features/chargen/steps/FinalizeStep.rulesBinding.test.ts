import { describe, expect, it } from "vitest";

import { defaultCanonicalContent, withCompetencyContentV2 } from "@glantri/content";
import { buildChargenCoreRouteStatus, reviewChargenDraft } from "@glantri/rules-engine";

import {
  buildTargetRuntimeContent,
  createTargetCompetencyChargenSource,
} from "../targetCompetencyContent";
import { CORE_ROUTE_SELECTION_ERROR } from "./FinalizeStep";

/**
 * Forgejo #636, with the #635 cross-lane finding.
 *
 * `FinalizeStep` surfaces `review.errors` verbatim, except for one string:
 * `review.ts` adds `CORE_ROUTE_SELECTION_ERROR` whenever
 * `coreRouteStatus.isSelectionValid` is false, and that flag is false both when
 * a core-route choice is genuinely owed and when **no applicable route exists at
 * all**. In the second case the string would instruct the player to select one
 * of zero options, so the step withholds that one message instead of rewording
 * it, and still states every other reason.
 *
 * Recognising the engine's message by its literal is a drift hazard, so this
 * test binds the constant to what the engine actually emits, against the real
 * Chargen runtime catalogue the wizard builds. It makes no rules change: it only
 * reads `buildChargenCoreRouteStatus` and `reviewChargenDraft`.
 *
 * Forgejo #731 moved which pair reaches the first situation, and not the binding.
 * Scribe and Copyist at Society Level 1 is no longer it: the catalogue authors
 * "Taught directly in the writing room" with no Society-Level bound, so that
 * route is valid for the Character and the path is available with no reachable
 * core route — `isSelectionValid` is then true, nothing is owed, and the engine
 * emits no core-route message to withhold. The first situation now needs a
 * Profession no authored route reaches at all, which is Mathematical
 * Practitioner below Society Level 3.
 */
/** One applicable, incomplete route: the genuinely actionable blocked state. */
const ACTIONABLE_PROFESSION_ID = "profession:scribe";
const ACTIONABLE_SOCIETY_ID = "bronze_age_palace_state";
/** Zero applicable routes: `resolveCompetencyV2PathAvailability` is not valid for this pair. */
const NO_ROUTE_PROFESSION_ID = "profession:mathematical-practitioner";
const NO_ROUTE_SOCIETY_ID = "forager_ritual_tribal";

function runtimeContent() {
  return withCompetencyContentV2(
    buildTargetRuntimeContent(createTargetCompetencyChargenSource(defaultCanonicalContent)),
  );
}

function evaluate(professionId: string, societyId: string) {
  const content = runtimeContent();
  const progression = {
    primaryPoolSpent: 0,
    secondaryPoolSpent: 0,
    skillGroups: [],
    skills: [],
    specializations: [],
  } as never;
  const coreRouteStatus = buildChargenCoreRouteStatus({
    content: content as never,
    professionId,
    progression,
    societyId,
    socialBand: 1,
  });
  const review = reviewChargenDraft({
    civilizationId: "scythians",
    content: content as never,
    professionId,
    profile: { socialClassRoll: 1 } as never,
    progression,
    societyId,
    societyLevel: 1,
  });

  return { coreRouteStatus, review };
}

describe("Finalize step binding to the rules engine", () => {
  it("still recognises the engine's core-route message when no route is applicable", () => {
    const { coreRouteStatus, review } = evaluate(NO_ROUTE_PROFESSION_ID, NO_ROUTE_SOCIETY_ID);

    expect(coreRouteStatus.applicableRoutes).toEqual([]);
    expect(coreRouteStatus.isSelectionValid).toBe(false);
    expect(review.canFinalize).toBe(false);
    // The literal the step withholds is exactly the one the engine emits here,
    // and it is the only reason this draft is blocked.
    expect(review.errors).toEqual([CORE_ROUTE_SELECTION_ERROR]);
  });

  it("produces a different, genuinely actionable reason when a route is applicable", () => {
    const { coreRouteStatus, review } = evaluate(ACTIONABLE_PROFESSION_ID, ACTIONABLE_SOCIETY_ID);

    expect(coreRouteStatus.applicableRoutes.length).toBeGreaterThan(0);
    expect(coreRouteStatus.isSelectionValid).toBe(true);
    expect(review.canFinalize).toBe(false);
    expect(review.errors).not.toContain(CORE_ROUTE_SELECTION_ERROR);
    expect(review.errors.length).toBeGreaterThan(0);
    for (const error of review.errors) {
      expect(error).toMatch(/^Complete the selected Profession core route: /);
    }
  });
});
