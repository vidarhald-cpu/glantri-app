import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { TrainingCostChangeNotice } from "./TrainingCostChangeNotice";

/**
 * The canonical F35/G08 reduction is `16 -> 15` ordinary points
 * (`packages/rules-engine/src/chargen/overlappingLearningGroupPricing.test.ts`). Product Owner
 * ruling, 2026-09-27: the reduction is correct, but it must never be visible as simply "added
 * training, points spent went down". This covers the wording, because the F35/G08 case is not
 * reachable through the Chargen browser surface — those Learning Groups exist only in the
 * `/skills` content projection, not in the one Chargen consumes.
 *
 * The explanation must describe training carrying over to related Skills, not the separate rule
 * that makes a single rank free because stronger training already teaches the same Skill
 * (Product Owner ruling, 2026-09-27, on #385-QA-5). The free-rank wording lives in
 * `SkillAllocationStep.tsx` and is correct where it stands.
 */
describe("TrainingCostChangeNotice", () => {
  it("shows the before and after cost and explains a reduction as benefit to related skills", () => {
    render(
      <TrainingCostChangeNotice
        change={{ previousTotal: 16, shift: "reduced-by-overlap", total: 15 }}
      />,
    );

    const notice = screen.getByRole("status");

    expect(notice).toHaveTextContent("Training cost went down: 16 → 15 ordinary points.");
    expect(notice).toHaveTextContent(
      "This training also improves related skills, so some points previously needed elsewhere are no longer needed.",
    );
  });

  it("explains the mirror case, where removing training raises the cost", () => {
    render(
      <TrainingCostChangeNotice
        change={{ previousTotal: 15, shift: "raised-by-overlap", total: 16 }}
      />,
    );

    const notice = screen.getByRole("status");

    expect(notice).toHaveTextContent("Training cost went up: 15 → 16 ordinary points.");
    expect(notice).toHaveTextContent(
      "Removing this training also removes its benefit to related skills, so more points are needed elsewhere.",
    );
  });

  it("uses no implementation vocabulary, per the experience contract section 2", () => {
    render(
      <TrainingCostChangeNotice
        change={{ previousTotal: 16, shift: "reduced-by-overlap", total: 15 }}
      />,
    );

    const text = screen.getByRole("status").textContent ?? "";

    for (const forbidden of [
      "bundle",
      "marginal",
      "useful increment",
      "relationship floor",
      "recompute",
      "suppressed",
      "coefficient",
      "refund",
    ]) {
      expect(text.toLowerCase()).not.toContain(forbidden);
    }
  });
});
