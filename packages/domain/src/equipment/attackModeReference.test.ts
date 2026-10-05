import { describe, expect, expectTypeOf, it } from "vitest";

import {
  CompetencyIdSchema,
  WeaponAttackModeSchema,
  parseCompetencyId,
  type CompetencyId,
  type WeaponAttackMode,
} from "./index";

const baseMode = { id: "mode-1", provenance: "imported" as const };

describe("WeaponAttackMode competency reference and requirements (#515)", () => {
  it("represents and validates a mode with NO competency reference", () => {
    const parsed = WeaponAttackModeSchema.parse(baseMode);
    expect(parsed.competencyRef).toBeUndefined();
    expect(parsed.requirements).toBeUndefined();
    // Explicit null is the other "unauthored" spelling used by every other optional field here.
    expect(WeaponAttackModeSchema.parse({ ...baseMode, competencyRef: null }).competencyRef).toBe(
      null,
    );
  });

  it("accepts an authored competency id and keeps the wire value a plain string", () => {
    const parsed = WeaponAttackModeSchema.parse({ ...baseMode, competencyRef: "one_handed_edged" });
    expect(parsed.competencyRef).toBe("one_handed_edged");
    expect(JSON.parse(JSON.stringify(parsed)).competencyRef).toBe("one_handed_edged");
  });

  it("rejects an empty competency id", () => {
    expect(WeaponAttackModeSchema.safeParse({ ...baseMode, competencyRef: "" }).success).toBe(
      false,
    );
    expect(() => parseCompetencyId("")).toThrow();
  });

  it("does not change the mode id", () => {
    const parsed = WeaponAttackModeSchema.parse({
      ...baseMode,
      competencyRef: "bow",
      requirements: { handRequirement: "two_handed" },
    });
    expect(parsed.id).toBe("mode-1");
  });

  it("carries structural requirements without interpreting them", () => {
    const parsed = WeaponAttackModeSchema.parse({
      ...baseMode,
      requirements: {
        handRequirement: "two_handed",
        entries: [{ kind: "future-kind", parameters: { anything: 1 } }, { kind: "bare" }],
      },
    });
    expect(parsed.requirements?.handRequirement).toBe("two_handed");
    expect(parsed.requirements?.entries).toEqual([
      { kind: "future-kind", parameters: { anything: 1 } },
      { kind: "bare" },
    ]);
    expect(WeaponAttackModeSchema.parse({ ...baseMode, requirements: {} }).requirements).toEqual(
      {},
    );
    expect(
      WeaponAttackModeSchema.safeParse({ ...baseMode, requirements: { entries: [{ kind: "" }] } })
        .success,
    ).toBe(false);
    expect(
      WeaponAttackModeSchema.safeParse({ ...baseMode, requirements: { handRequirement: "bogus" } })
        .success,
    ).toBe(false);
  });

  it("type level: a bare string is not a competency identity", () => {
    const bare: string = "one_handed_edged";
    const id: CompetencyId = parseCompetencyId("one_handed_edged");

    // @ts-expect-error a bare string must not satisfy CompetencyId
    const fromString: CompetencyId = bare;
    // @ts-expect-error a string literal must not satisfy CompetencyId either
    const fromLiteral: CompetencyId = "one_handed_edged";
    // @ts-expect-error nor may a name string be put on a mode's competencyRef
    const modeFromName: WeaponAttackMode = { ...baseMode, competencyRef: "1-h edged" };
    // @ts-expect-error nor a template-style weaponSkill string
    const modeFromVar: WeaponAttackMode = { ...baseMode, competencyRef: bare };

    const okMode: WeaponAttackMode = { ...baseMode, competencyRef: id };
    expectTypeOf(okMode.competencyRef).toEqualTypeOf<CompetencyId | null | undefined>();
    expectTypeOf<CompetencyId>().toExtend<string>();
    expectTypeOf<string>().not.toExtend<CompetencyId>();
    expectTypeOf(CompetencyIdSchema.parse(bare)).toEqualTypeOf<CompetencyId>();
    expect([fromString, fromLiteral, modeFromName, modeFromVar].length).toBe(4);
  });
});
