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
 */
describe("TrainingCostChangeNotice", () => {
  it("shows the before and after cost and explains a reduction as overlapping training", () => {
    render(
      <TrainingCostChangeNotice
        change={{ previousTotal: 16, shift: "reduced-by-overlap", total: 15 }}
      />,
    );

    const notice = screen.getByRole("status");

    expect(notice).toHaveTextContent("Training cost went down: 16 → 15 ordinary points.");
    expect(notice).toHaveTextContent(
      "Overlapping training does not stack. The new training covers ground the earlier training was already priced for, so this build costs less than before.",
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
      "Overlapping training does not stack. With that training gone there is less overlap left, so the rest of this build costs more than before.",
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
