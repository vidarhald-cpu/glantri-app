import { describe, expect, it } from "vitest";

import { importedWeaponTemplatesById } from "./importedWeaponTemplates";
import { applyThemistogenesWeaponEnrichments } from "./themistogenesWeaponEnrichments";
import { mergeThemistogenesThrownWeaponTemplates } from "./themistogenesThrownWeaponMerge";

describe("themistogenes thrown weapon merge", () => {
  const mergedTemplates = mergeThemistogenesThrownWeaponTemplates(
    applyThemistogenesWeaponEnrichments(Object.values(importedWeaponTemplatesById)),
  );
  const mergedById = Object.fromEntries(
    mergedTemplates.map((template) => [template.id, template]),
  );

  it("merges exact-match T. rows into the base weapon as a thrown mode", () => {
    const knife = mergedById["weapon-template-knife"];

    expect(mergedById["weapon-template-t-knife"]).toBeUndefined();
    expect(knife?.tags).toContain("thrown");
    expect(knife?.attackModes?.map((mode) => mode.id)).toEqual(["mode-1", "mode-2", "mode-3"]);
    expect(knife?.attackModes?.[2]).toMatchObject({
      id: "mode-3",
      label: "Throw",
      ob: 2,
      dmb: -1,
      crit: "DP",
      armorModifier: "A",
    });
    expect(knife?.attackModes?.[2]?.notes).toContain("Workbook thrown mode from T. Knife");
  });

  it("leaves ambiguous or non-matching T. rows as standalone templates", () => {
    expect(mergedById["weapon-template-t-th-dagger"]?.name).toBe("T. Th. dagger");
    expect(mergedById["weapon-template-t-javelin"]?.name).toBe("T. Javelin");
    expect(mergedById["weapon-template-t-spear"]?.name).toBe("T. Spear");
  });
});

