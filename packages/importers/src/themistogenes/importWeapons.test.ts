import { describe, expect, it } from "vitest";

import { importThemistogenesWeapons } from "./importWeapons";

describe("importThemistogenesWeapons", () => {
  const imported = importThemistogenesWeapons();
  const templatesById = Object.fromEntries(
    imported.templates.map((template) => [template.id, template]),
  );

  it("keeps axe-family main attacks on Strike and attaches Second crit. to that main mode", () => {
    const handAxe = templatesById["weapon-template-hand-axe"];

    expect(handAxe?.attackModes).toHaveLength(1);
    expect(handAxe?.primeAttackType).toBe("Strike");
    expect(handAxe?.attackModes?.[0]).toMatchObject({
      id: "mode-1",
      label: "Strike",
      canonicalMeleeMode: "strike",
      isPrimaryAttack: true,
      ob: 1,
      dmb: 6,
      crit: "FS",
      secondCrit: "CC",
    });
    expect(handAxe?.crit2).toBeNull();
    expect(handAxe?.secondCrit).toBe("CC");
  });

  it("maps sword secondary attacks by Crit 2 family instead of guessing from the main mode", () => {
    const shortSword = templatesById["weapon-template-short-sword"];

    expect(shortSword?.attackModes).toHaveLength(2);
    expect(shortSword?.primeAttackType).toBe("Slash");
    expect(shortSword?.attackModes?.[0]).toMatchObject({
      id: "mode-1",
      label: "Slash",
      canonicalMeleeMode: "slash",
      crit: "ES",
    });
    expect(shortSword?.attackModes?.[1]).toMatchObject({
      id: "mode-2",
      label: "Thrust",
      canonicalMeleeMode: "thrust",
      crit: "DP",
      ob: 1,
      dmb: 3,
    });
  });

  it("preserves thrust-main polearms and keeps Second crit. on the primary mode only", () => {
    const spear = templatesById["weapon-template-1-h-spear"];

    expect(spear?.attackModes).toHaveLength(2);
    expect(spear?.primeAttackType).toBe("Thrust");
    expect(spear?.attackModes?.[0]).toMatchObject({
      id: "mode-1",
      label: "Thrust",
      canonicalMeleeMode: "thrust",
      crit: "FP",
      secondCrit: "AS",
    });
    expect(spear?.attackModes?.[1]).toMatchObject({
      id: "mode-2",
      label: "Slash",
      canonicalMeleeMode: "slash",
      crit: "BS",
      secondCrit: null,
    });
  });

  it("preserves Lance primary attack as Charge while keeping its canonical family puncture-like", () => {
    const lance = templatesById["weapon-template-lance"];

    expect(lance?.primeAttackType).toBe("Charge");
    expect(lance?.primaryAttackType).toBe("Charge");
    expect(lance?.attackModes?.[0]).toMatchObject({
      id: "mode-1",
      label: "Charge",
      canonicalMeleeMode: "thrust",
      isPrimaryAttack: true,
      crit: "FP",
      secondCrit: "DC",
    });
    expect(lance?.attackModes?.[1]).toMatchObject({
      id: "mode-2",
      label: null,
      canonicalMeleeMode: null,
      secondCrit: null,
    });
  });
});
