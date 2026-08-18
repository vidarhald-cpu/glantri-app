import { describe, expect, it } from "vitest";

import { resolveHistoricalFeintSkillLabel } from "./historicalFeintPresentation";

describe("historical Feint presentation", () => {
  it("resolves the archived skill identity without current equipment input", () => {
    expect(
      resolveHistoricalFeintSkillLabel({
        skillId: "archived-skill",
        skills: [{ id: "archived-skill", name: "Archived sword skill" }],
        specializations: [],
      }),
    ).toBe("Archived sword skill");
  });

  it("reports a bounded missing fact instead of substituting a current skill", () => {
    expect(
      resolveHistoricalFeintSkillLabel({
        skillId: "removed-skill",
        skills: [{ id: "current-weapon-skill", name: "Current weapon skill" }],
        specializations: [],
      }),
    ).toBe("Recorded skill unavailable");
  });
});
