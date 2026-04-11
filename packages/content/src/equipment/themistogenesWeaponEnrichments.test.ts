import { describe, expect, it } from "vitest";

import { importedWeaponTemplatesById } from "./importedWeaponTemplates";
import { applyThemistogenesWeaponEnrichments } from "./themistogenesWeaponEnrichments";

describe("themistogenes weapon enrichments", () => {
  const enrichedTemplates = applyThemistogenesWeaponEnrichments(
    Object.values(importedWeaponTemplatesById),
  );
  const enrichedById = Object.fromEntries(
    enrichedTemplates.map((template) => [template.id, template]),
  );

  it("removes bogus secondary melee modes that were created only from Second crit.", () => {
    const handAxe = enrichedById["weapon-template-hand-axe"];

    expect(handAxe?.attackModes).toHaveLength(1);
    expect(handAxe?.primeAttackType).toBe("Strike");
    expect(handAxe?.attackModes?.[0]).toMatchObject({
      id: "mode-1",
      label: "Strike",
      canonicalMeleeMode: "strike",
      secondCrit: "CC",
    });
    expect(handAxe?.secondaryAttackType).toBeNull();
    expect(handAxe?.importWarnings ?? []).not.toContain(
      "Hand axe mode-2: source table has no explicit secondary attack label column.",
    );
  });

  it("derives canonical secondary melee labels from Crit 2 family for swords", () => {
    const shortSword = enrichedById["weapon-template-short-sword"];

    expect(shortSword?.primeAttackType).toBe("Slash");
    expect(shortSword?.attackModes?.[1]).toMatchObject({
      id: "mode-2",
      label: "Thrust",
      canonicalMeleeMode: "thrust",
      crit: "DP",
    });
    expect(shortSword?.secondaryAttackType).toBe("Thrust");
  });

  it("keeps thrust-main weapons aligned with workbook main/secondary families", () => {
    const spear = enrichedById["weapon-template-1-h-spear"];

    expect(spear?.primeAttackType).toBe("Thrust");
    expect(spear?.attackModes?.[0]).toMatchObject({
      id: "mode-1",
      label: "Thrust",
      canonicalMeleeMode: "thrust",
      secondCrit: "AS",
    });
    expect(spear?.attackModes?.[1]).toMatchObject({
      id: "mode-2",
      label: "Slash",
      canonicalMeleeMode: "slash",
      crit: "BS",
    });
  });

  it("preserves Lance primary Charge attack explicitly while keeping Second crit. on that primary mode", () => {
    const lance = enrichedById["weapon-template-lance"];

    expect(lance?.primeAttackType).toBe("Charge");
    expect(lance?.primaryAttackType).toBe("Charge");
    expect(lance?.attackModes?.[0]).toMatchObject({
      id: "mode-1",
      label: "Charge",
      canonicalMeleeMode: "thrust",
      secondCrit: "DC",
    });
    expect(lance?.importWarnings).toContain(
      "Lance mode-2: source table has no explicit secondary attack label column.",
    );
  });
});
