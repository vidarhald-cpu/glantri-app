import { describe, expect, it } from "vitest";

import { importedWeaponTemplatesById } from "./importedWeaponTemplates";
import { applyThemistogenesWeaponEnrichments } from "./themistogenesWeaponEnrichments";
import { mergeThemistogenesThrownWeaponTemplates } from "./themistogenesThrownWeaponMerge";

describe("themistogenes thrown weapon merge", () => {
  const mergedTemplates = mergeThemistogenesThrownWeaponTemplates(
    applyThemistogenesWeaponEnrichments(Object.values(importedWeaponTemplatesById)),
  );
  const mergedById = Object.fromEntries(mergedTemplates.map((template) => [template.id, template]));

  it("merges exact-match T. rows into the base weapon as a thrown mode", () => {
    const knife = mergedById["weapon-template-knife"];

    expect(mergedById["weapon-template-t-knife"]).toBeUndefined();
    expect(knife?.tags).toContain("thrown");
    expect(knife?.attackModes?.map((mode) => mode.id)).toEqual(["mode-1", "mode-2", "mode-3"]);
    expect(knife?.attackModes?.[2]).toMatchObject({
      attackType: "thrown",
      id: "mode-3",
      label: "Throw",
      ob: 2,
      dmb: -1,
      crit: "DP",
      armorModifier: "A",
      allowsRepeatedRoundAttack: false,
      canonicalMeleeMode: null,
      isPrimaryAttack: false,
      initiative: 0,
      order: 2,
      range: "0.0",
      sourceMetadata: {
        row: 2,
        sheet: "Weapon2",
        sourceRange: "Weapon2!A2:K2",
      },
    });
    expect(knife?.attackModes?.[2]?.notes).toContain("Workbook thrown mode from T. Knife");
  });

  it("maps the approved Javelin and heavy two-handed Spear source rows", () => {
    const javelin = mergedById["weapon-template-1-h-javelin"];
    const spear = mergedById["weapon-template-spear"];

    expect(mergedById["weapon-template-t-javelin"]).toBeUndefined();
    expect(mergedById["weapon-template-t-spear"]).toBeUndefined();
    expect(javelin?.name).toBe("1-h Javelin");
    expect(javelin?.attackModes?.find((mode) => mode.attackType === "thrown")).toMatchObject({
      crit: "FP",
      dmb: 3,
      initiative: -1,
      ob: 3,
      range: "2.0",
      sourceMetadata: { row: 9, sheet: "Weapon2" },
    });
    expect(spear?.name).toBe("2-h Spear");
    expect(spear?.attackModes?.find((mode) => mode.attackType === "thrown")).toMatchObject({
      crit: "FP bs",
      dmb: 6,
      initiative: -2,
      ob: 2,
      range: "1.0",
      sourceMetadata: { row: 10, sheet: "Weapon2" },
    });
  });

  it("keeps Throwing dagger and unapproved Weapon2 rows as standalone templates", () => {
    expect(mergedById["weapon-template-t-th-dagger"]?.name).toBe("T. Th. dagger");
    expect(mergedById["weapon-template-t-th-dagger"]?.attackModes?.[0]).toMatchObject({
      attackType: "thrown",
      initiative: 1,
      range: "1.0",
      sourceMetadata: { row: 4, sheet: "Weapon2" },
    });
  });
});
