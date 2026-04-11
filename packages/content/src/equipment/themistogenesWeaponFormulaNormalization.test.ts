import { describe, expect, it } from "vitest";

import { importedWeaponTemplatesById } from "./importedWeaponTemplates";
import {
  applyThemistogenesWeaponEnrichments,
} from "./themistogenesWeaponEnrichments";
import {
  applyThemistogenesWeaponFormulaNormalization,
  buildThemistogenesWeaponFormulaNormalizationReport,
} from "./themistogenesWeaponFormulaNormalization";

describe("themistogenes weapon formula normalization", () => {
  const enrichedTemplates = applyThemistogenesWeaponEnrichments(
    Object.values(importedWeaponTemplatesById),
  );
  const normalizedTemplates = applyThemistogenesWeaponFormulaNormalization(enrichedTemplates);
  const normalizedById = Object.fromEntries(
    normalizedTemplates.map((template) => [template.id, template]),
  );

  it("structures dice-based DMB formulas while preserving the raw source value", () => {
    const compositeBow = normalizedById["weapon-template-composite-bow"];
    const mode = compositeBow?.attackModes?.find((attackMode) => attackMode.id === "mode-1");

    expect(mode?.dmb).toBeNull();
    expect(mode?.dmbRaw).toBe("2d6 + GMstr");
    expect(mode?.dmbFormula).toEqual({
      kind: "dice",
      raw: "2d6 + GMstr",
      diceCount: 2,
      diceSides: 6,
      flatModifier: null,
      textModifier: "GMstr",
    });
    expect(compositeBow.importWarnings ?? []).not.toContain(
      "Composite bow mode-1: DMB '2d6 + GMstr' preserved as raw source text.",
    );
  });

  it("parses flat dice modifiers and ammo-linked encumbrance", () => {
    const rifle = normalizedById["weapon-template-cartridge-rifle"];
    const rifleMode = rifle?.attackModes?.find((attackMode) => attackMode.id === "mode-1");
    const ballista = normalizedById["weapon-template-ballista"];

    expect(rifleMode?.dmbFormula).toMatchObject({
      kind: "dice",
      raw: "3d10-2",
      diceCount: 3,
      diceSides: 10,
      flatModifier: -2,
    });
    expect(ballista.baseEncumbrance).toBe(20);
    expect(ballista.baseEncumbranceFormula).toEqual({
      kind: "ammo_linked",
      raw: "20+20",
      baseValue: 20,
      ammoValue: 20,
      note: "Source appears to encode weapon and projectile encumbrance together.",
    });
    expect(ballista.importWarnings ?? []).not.toContain(
      "Ballista: encumbrance '20+20' reduced to compatibility number 20.",
    );
  });

  it("keeps ambiguous expressions unresolved instead of inventing precision", () => {
    const handCannon = normalizedById["weapon-template-hand-cannon"];
    const mode = handCannon?.attackModes?.find((attackMode) => attackMode.id === "mode-1");

    expect(mode?.dmbFormula).toEqual({
      kind: "unresolved",
      raw: "4d6/2d10*",
      note: "Normalization layer could not safely interpret this DMB expression.",
    });
    expect(handCannon.importWarnings).toContain(
      "Hand Cannon mode-1: DMB '4d6/2d10*' preserved as raw source text.",
    );
  });

  it("reports which warning categories were resolved and which remain", () => {
    const report = buildThemistogenesWeaponFormulaNormalizationReport(
      enrichedTemplates,
      normalizedTemplates,
    );

    expect(report).toEqual({
      totalTemplates: 58,
      templatesWithFormulaNormalization: 14,
      rawWarningCount: 17,
      resolvedWarningCount: 15,
      unresolvedWarningCount: 2,
      resolvedWarningCategories: {
        non_numeric_dmb_preserved_raw: 14,
        non_numeric_encumbrance_compat: 1,
      },
      unresolvedWarningCategories: {
        other: 1,
        non_numeric_dmb_preserved_raw: 1,
      },
    });
  });
});
