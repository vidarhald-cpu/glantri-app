import { describe, expect, it } from "vitest";

import { importThemistogenesArmor } from "./importArmor";

describe("importThemistogenesArmor", () => {
  const imported = importThemistogenesArmor();
  const templatesById = Object.fromEntries(imported.templates.map((template) => [template.id, template]));

  it("imports light workbook-backed armor with location values and paired type row", () => {
    const leatherJerkin = templatesById["armor-template-leather-jerkin"];

    expect(leatherJerkin?.name).toBe("Leather Jerkin");
    expect(leatherJerkin?.defaultMaterial).toBe("leather");
    expect(leatherJerkin?.armorRating).toBeCloseTo(2.666666667, 9);
    expect(leatherJerkin?.generalArmorRounded).toBe(3);
    expect(leatherJerkin?.armorActivityModifier).toBe(0);
    expect(leatherJerkin?.perceptionModifier).toBe(0);
    expect(leatherJerkin?.movementFactor).toBeCloseTo(0.2666666667, 9);
    expect(leatherJerkin?.baseEncumbrance).toBeCloseTo(0.6666666667, 9);
    expect(leatherJerkin?.encumbranceFactor).toBeCloseTo(0.6666666667, 9);
    expect(leatherJerkin?.locationValues).toMatchObject({
      head: 0,
      chest: 3,
    });
    expect(leatherJerkin?.criticalModifierByArea).toMatchObject({
      head: 0,
      chest: 1,
    });
    expect(leatherJerkin?.criticalModifierGeneral).toBe(1);
    expect(leatherJerkin?.locationTypes).toMatchObject({
      head: "A",
      chest: "B",
      generalArmor: "B",
    });
    expect(leatherJerkin?.componentProfiles?.map((profile) => profile.name)).toEqual([
      "Unnamed component (row 5)",
      "Gauntlets",
      "Light  Boots",
    ]);
    expect(leatherJerkin?.componentProfiles?.[0]).toMatchObject({
      encumbranceFactor: 0.3888888889,
      generalArmor: 1.555555556,
      generalArmorRounded: 2,
    });
    expect(leatherJerkin?.sourceMetadata).toMatchObject({
      finishedRow: 8,
      typeRow: 9,
      componentRows: [5, 6, 7],
    });
    expect((leatherJerkin?.encumbranceFactor ?? 0) * 13).toBeCloseTo(8.666666667, 9);
  });

  it("imports heavier armor with workbook AA and perception modifiers intact", () => {
    const fullPlate = templatesById["armor-template-full-plate-armor"];

    expect(fullPlate?.name).toBe("Full Plate Armor");
    expect(fullPlate?.defaultMaterial).toBe("steel");
    expect(fullPlate?.armorRating).toBeCloseTo(14.22222222, 8);
    expect(fullPlate?.generalArmorRounded).toBe(14);
    expect(fullPlate?.armorActivityModifier).toBe(-1);
    expect(fullPlate?.perceptionModifier).toBe(-6);
    expect(fullPlate?.movementFactor).toBeCloseTo(4.183333333, 9);
    expect(fullPlate?.baseEncumbrance).toBeCloseTo(3.555555556, 9);
    expect(fullPlate?.encumbranceFactor).toBeCloseTo(3.555555556, 9);
    expect(fullPlate?.criticalModifierGeneral).toBe(6);
    expect(fullPlate?.locationTypes).toMatchObject({
      head: "E",
      frontFoot: "E",
      generalArmor: "E",
    });
    expect(fullPlate?.componentProfiles?.map((profile) => profile.name)).toEqual([
      "Unnamed component (row 114)",
      "Knights Helmet",
    ]);
  });

  it("preserves workbook component modifiers, including helmet-driven perception and ambiguous materials", () => {
    const leatherCloth = templatesById["armor-template-leather-cloth"];
    const cloth = templatesById["armor-template-cloth"];

    expect(leatherCloth?.name).toBe("Leather/Cloth");
    expect(leatherCloth?.defaultMaterial).toBe("other");
    expect(leatherCloth?.armorRating).toBeCloseTo(1.777777778, 9);
    expect(leatherCloth?.generalArmorRounded).toBe(2);
    expect(leatherCloth?.armorActivityModifier).toBe(0);
    expect(leatherCloth?.movementFactor).toBeCloseTo(0.1777777778, 9);
    expect(leatherCloth?.baseEncumbrance).toBeCloseTo(0.4444444444, 9);
    expect(leatherCloth?.encumbranceFactor).toBeCloseTo(0.4444444444, 9);
    expect(leatherCloth?.importWarnings).toContain(
      "Leather/Cloth: workbook name spans more than one material family, so default material stays 'other'.",
    );
    expect(cloth).toMatchObject({
      name: "Cloth",
      perceptionModifier: -1,
      criticalModifierGeneral: 1,
    });
    expect(cloth?.componentProfiles?.map((profile) => profile.name)).toEqual([
      "Unnamed component (row 15)",
      "Fur Stuffing",
      "Light  Boots",
    ]);
    expect(cloth?.componentProfiles?.[1]).toMatchObject({
      name: "Fur Stuffing",
      perceptionModifier: -1,
      locationValues: {
        head: 4,
        chest: 4,
      },
    });
  });
});
