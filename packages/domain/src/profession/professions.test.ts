import { describe, expect, it } from "vitest";

import { normalizeProfessionId, professionSkillMapSchema } from "./professions";

describe("profession compatibility", () => {
  it("normalizes retired skill group ids in profession grants", () => {
    expect(
      professionSkillMapSchema.parse({
        grantType: "group",
        professionId: "legacy-profession",
        skillGroupId: "officer_training"
      }).skillGroupId
    ).toBe("veteran_leadership");
  });

  it("normalizes retired duplicate performer profession ids", () => {
    expect(normalizeProfessionId("entertainers_dancer_acrobat")).toBe("dancer_acrobat");
    expect(normalizeProfessionId("entertainers_singer_musician")).toBe("musician");
    expect(normalizeProfessionId("entertainers_trickster_fool")).toBe("entertainer");
    expect(normalizeProfessionId("actor")).toBe("actor");
  });
});
