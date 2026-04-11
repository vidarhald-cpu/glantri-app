import { describe, expect, it } from "vitest";

import { importThemistogenesShields } from "./importShields";

describe("importThemistogenesShields", () => {
  const imported = importThemistogenesShields();
  const templatesById = Object.fromEntries(
    imported.templates.map((template) => [template.id, template]),
  );

  it("merges medium shield offensive Weapon1 data with defensive Shields-tab data", () => {
    const mediumShield = templatesById["shield-template-medium-shield"];

    expect(mediumShield).toMatchObject({
      name: "Medium shield",
      weaponSkill: "Brawling",
      primaryAttackType: "Strike",
      ob1: 0,
      dmb1: 0,
      crit1: "AC",
      initiative: 0,
      parry: 5,
      shieldBonus: 5,
      defensiveValue: 5,
      movementModifier: 2,
      baseEncumbrance: 12,
    });
    expect(mediumShield?.offensiveSourceMetadata).toMatchObject({
      sheet: "Weapon1",
      row: 38,
    });
    expect(mediumShield?.defensiveSourceMetadata).toMatchObject({
      sheet: "Shields",
      row: 5,
    });
  });

  it("matches defensive shield rows to offensive shield rows through Shields column E", () => {
    const tyasianShield = templatesById["shield-template-tyasian-metal-shield"];

    expect(tyasianShield).toMatchObject({
      name: "Tyasian metal shield",
      shieldBonus: 8,
      defensiveValue: 8,
      parry: 8,
      movementModifier: 3,
      baseEncumbrance: 33,
      ob1: 0,
      dmb1: 0,
      crit1: "AC",
      initiative: 0,
    });
    expect(tyasianShield?.offensiveSourceMetadata).toMatchObject({
      sheet: "Weapon1",
      row: 39,
      rawRow: expect.objectContaining({
        A: "Large shield",
      }),
    });
    expect(tyasianShield?.defensiveSourceMetadata).toMatchObject({
      sheet: "Shields",
      row: 9,
      rawRow: expect.objectContaining({
        A: "Tyasian metal shield",
        E: "Large shield",
      }),
    });
    expect(tyasianShield?.importWarnings).toContain(
      "Tyasian metal shield: shield tab defensive value 8 overrides offensive shield-row value 7.",
    );
  });
});
