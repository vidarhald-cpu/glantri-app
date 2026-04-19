import { describe, expect, it } from "vitest";

import { glantriTerms } from "./glantriTerms";

describe("glantriTerms", () => {
  it("covers the canonical terminology set", () => {
    const ids = glantriTerms.map((term) => term.id);

    expect(ids).toEqual([
      "skill",
      "skill-type",
      "skill-group",
      "skill-category",
      "primary-vs-optional-group",
      "profession",
      "society-level",
      "social-band"
    ]);
  });

  it("keeps each term documented with usage notes", () => {
    for (const term of glantriTerms) {
      expect(term.name.length).toBeGreaterThan(0);
      expect(term.definition.length).toBeGreaterThan(0);
      expect(term.whereUsed.length).toBeGreaterThan(0);
    }
  });
});
