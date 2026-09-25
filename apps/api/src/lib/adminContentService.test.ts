import { describe, expect, it } from "vitest";
import { CanonicalContentService } from "./adminContentService";

describe("admin competency reference service", () => {
  it("returns the canonical V2 reference projection with approved mechanics", async () => {
    const source = await new CanonicalContentService().getSkillReference();
    expect(source.sourceDigest).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(source.groups).toHaveLength(95);
    expect(source.paths).toHaveLength(86);
    expect(source.families).toHaveLength(84);
    expect(source.relationships.grants).toContainEqual({
      sourceId: "skill:medicine",
      targetId: "skill:first-aid",
      factor: 1,
    });
    expect(source.relationships.bridges.map((row) => row.specializationId)).toEqual(
      expect.arrayContaining(["longbow", "fencing"]),
    );
    expect(source.skills.some((row) => row.id === "medicine" || row.id === "first_aid")).toBe(
      false,
    );
    expect(JSON.stringify(source)).not.toMatch(
      /"(?:sourceId|targetId|skillId|specializationId)":"(?:medicine|first_aid)"/,
    );
  });
});
