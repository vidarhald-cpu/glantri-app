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

  it("marks only explicit melee thrust modes as eligible for same-source Double Attack", () => {
    for (const id of [
      "weapon-template-dagger",
      "weapon-template-fencing-sword",
      "weapon-template-rapier",
      "weapon-template-1-h-spear",
      "weapon-template-2-h-javelin",
      "weapon-template-1-h-javelin",
      "weapon-template-spear",
    ]) {
      expect(enrichedById[id]?.attackModes?.[0]).toMatchObject({
        allowsRepeatedRoundAttack: true,
        canonicalMeleeMode: "thrust",
        isPrimaryAttack: true,
        order: 0,
      });
    }
    expect(
      enrichedById["weapon-template-t-javelin"]?.attackModes?.[0]?.allowsRepeatedRoundAttack,
    ).not.toBe(true);
  });

  it("marks Broad sword's explicit secondary Thrust profile as repeat eligible", () => {
    const broadSword = enrichedById["weapon-template-broad-sword"];

    expect(broadSword?.sourceMetadata).toMatchObject({
      row: 7,
      sheet: "Weapon1",
      sourceRange: "Weapon1!A7:Q7",
    });
    expect(broadSword?.attackModes).toEqual([
      expect.objectContaining({
        canonicalMeleeMode: "slash",
        crit: "FS",
        dmb: 4,
        id: "mode-1",
        label: "Slash",
        ob: 2,
      }),
      expect.objectContaining({
        allowsRepeatedRoundAttack: true,
        canonicalMeleeMode: "thrust",
        crit: "EP",
        dmb: 3,
        id: "mode-2",
        label: "Thrust",
        ob: 1,
      }),
    ]);
    expect(broadSword?.attackModes?.[0]?.allowsRepeatedRoundAttack).not.toBe(true);
  });

  it("authors only the accepted default Disarm capability and one-handed polearm overrides", () => {
    const capable = [
      "weapon-template-main-gauche",
      "weapon-template-swordbreaker",
      "weapon-template-rapier",
      "weapon-template-fencing-sword",
    ];
    for (const id of capable) expect(enrichedById[id]?.disarmCapability).toBe("trap");
    for (const id of [
      "weapon-template-broad-sword",
      "weapon-template-sabre",
      "weapon-template-dagger",
      "weapon-template-maul",
      "weapon-template-1-h-spear",
    ]) {
      expect(enrichedById[id]?.disarmCapability).toBe("none");
    }
    expect(enrichedById["weapon-template-1-h-javelin"]?.disarmGripClass).toBe("one_handed");
    expect(enrichedById["weapon-template-1-h-spear"]?.disarmGripClass).toBe("one_handed");
    expect(enrichedById["weapon-template-maul"]?.disarmGripClass).toBeNull();
    expect(enrichedById["weapon-template-rapier"]?.attackModes?.[0]).toMatchObject({
      allowsRepeatedRoundAttack: true,
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
