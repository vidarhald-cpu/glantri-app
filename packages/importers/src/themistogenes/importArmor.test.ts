import { describe, expect, it } from "vitest";

import { importThemistogenesArmor } from "./importArmor";

describe("importThemistogenesArmor", () => {
  const imported = importThemistogenesArmor();
  const templatesById = Object.fromEntries(imported.templates.map((template) => [template.id, template]));

  it("imports light workbook-backed armor with location values and paired type row", () => {
    const leatherJerkin = templatesById["armor-template-leather-jerkin"];

    expect(leatherJerkin).toMatchObject({
      name: "Leather Jerkin",
      defaultMaterial: "leather",
      armorRating: 2.666666667,
      armorActivityModifier: 0,
      perceptionModifier: 0,
      movementFactor: 0.2666666667,
      baseEncumbrance: 0.6666666667,
      locationValues: {
        head: 0,
        chest: 3,
      },
      locationTypes: {
        head: "A",
        chest: "B",
        generalArmor: "B",
      },
    });
    expect(leatherJerkin?.componentProfiles?.map((profile) => profile.name)).toEqual([
      "Gauntlets",
      "Light  Boots",
    ]);
    expect(leatherJerkin?.sourceMetadata).toMatchObject({
      finishedRow: 8,
      typeRow: 9,
      componentRows: [6, 7],
    });
  });

  it("imports heavier armor with workbook AA and perception modifiers intact", () => {
    const fullPlate = templatesById["armor-template-full-plate-armor"];

    expect(fullPlate).toMatchObject({
      name: "Full Plate Armor",
      defaultMaterial: "steel",
      armorRating: 14.22222222,
      armorActivityModifier: -1,
      perceptionModifier: -6,
      movementFactor: 4.183333333,
      baseEncumbrance: 3.555555556,
      locationTypes: {
        head: "E",
        frontFoot: "E",
        generalArmor: "E",
      },
    });
    expect(fullPlate?.componentProfiles?.map((profile) => profile.name)).toEqual(["Knights Helmet"]);
  });

  it("preserves material-profile-style workbook rows and warns on ambiguous default material", () => {
    const leatherCloth = templatesById["armor-template-leather-cloth"];

    expect(leatherCloth).toMatchObject({
      name: "Leather/Cloth",
      defaultMaterial: "other",
      armorRating: 1.777777778,
      armorActivityModifier: 0,
      movementFactor: 0.1777777778,
      baseEncumbrance: 0.4444444444,
    });
    expect(leatherCloth?.importWarnings).toContain(
      "Leather/Cloth: workbook name spans more than one material family, so default material stays 'other'.",
    );
  });
});
