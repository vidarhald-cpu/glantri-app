import { describe, expect, it } from "vitest";

import {
  getRulesDocumentEntryById,
  getRulesDocumentationPageModel,
  getRulesDocuments
} from "./rulesDocs";

describe("rules documentation registry", () => {
  it("includes Character Sheet Calculations", () => {
    expect(getRulesDocuments()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fileName: "character-sheet-calculations.md",
          id: "character-sheet-calculations",
          section: "Character",
          title: "Character Sheet Calculations"
        }),
        expect.objectContaining({
          fileName: "chargen-calculations.md",
          id: "chargen-calculations",
          section: "Chargen",
          title: "Chargen Calculations"
        }),
        expect.objectContaining({
          fileName: "equipment-encumbrance-calculations.md",
          id: "equipment-encumbrance-calculations",
          section: "Equipment",
          title: "Equipment & Encumbrance Calculations"
        }),
        expect.objectContaining({
          fileName: "character-progression-calculations.md",
          id: "character-progression-calculations",
          section: "Character",
          title: "Character Progression Calculations"
        }),
        expect.objectContaining({
          fileName: "combat-loadout-calculations.md",
          id: "combat-loadout-calculations",
          section: "Combat / Equipment",
          title: "Equip Items Calculations"
        })
      ])
    );
  });

  it("orders Chargen Calculations first", () => {
    expect(getRulesDocuments().map((document) => document.title)).toEqual([
      "Chargen Calculations",
      "Character Sheet Calculations",
      "Character Progression Calculations",
      "Equipment & Encumbrance Calculations",
      "Equip Items Calculations"
    ]);
  });

  it("defaults to Chargen Calculations", () => {
    expect(getRulesDocumentEntryById(undefined)).toMatchObject({
      id: "chargen-calculations",
      title: "Chargen Calculations"
    });
  });

  it("loads the character progression document with roll and threshold content", async () => {
    const model = await getRulesDocumentationPageModel({
      selectedDocumentId: "character-progression-calculations"
    });

    expect(model.selectedDocument.title).toBe("Character Progression Calculations");
    expect(model.selectedDocument.markdown).toContain("# Character Progression Calculations");
    expect(model.selectedDocument.markdown).toContain("Progression succeeds if final roll total >= threshold");
    expect(model.selectedDocument.markdown).toContain("Skill thresholds use XP, not Total skill level.");
    expect(model.selectedDocument.markdown).toContain("Stat advancement is checks-only/deferred.");
  });

  it("loads the markdown title and formula text for the docs page", async () => {
    const model = await getRulesDocumentationPageModel({
      selectedDocumentId: "character-sheet-calculations"
    });

    expect(model.selectedDocument.title).toBe("Character Sheet Calculations");
    expect(model.selectedDocument.markdown).toContain("# Character Sheet Calculations");
    expect(model.selectedDocument.markdown).toContain("Stats die roll");
    expect(model.selectedDocument.markdown).toContain("Group XP");
    expect(model.selectedDocument.markdown).toContain("Skill XP");
    expect(model.selectedDocument.markdown).toContain("Derived XP rules and skill relationships can be reviewed in Admin -> Skills.");
    expect(model.selectedDocument.markdown).toContain("GM = trunc((Current - 11) / 2)");
    expect(model.selectedDocument.markdown).toContain("Skill group cost = floor(0.6 * total individual cost of active group skills)");
    expect(model.selectedDocument.markdown).not.toContain("Character Detail does not show Derived XP");
  });

  it("loads the chargen document with profile and skill-point formulas", async () => {
    const model = await getRulesDocumentationPageModel({
      selectedDocumentId: "chargen-calculations"
    });

    expect(model.selectedDocument.title).toBe("Chargen Calculations");
    expect(model.selectedDocument.markdown).toContain("# Chargen Calculations");
    expect(model.selectedDocument.markdown).toContain("What you see in Chargen");
    expect(model.selectedDocument.markdown).toContain("Profile stats");
    expect(model.selectedDocument.markdown).toContain("4d6, drop the lowest die");
    expect(model.selectedDocument.markdown).toContain("Social class roll | `1d20`.");
    expect(model.selectedDocument.markdown).not.toContain("Best of two");
    expect(model.selectedDocument.markdown).toContain("Default value");
    expect(model.selectedDocument.markdown).not.toContain("Standard value");
    expect(model.selectedDocument.markdown).toContain("Flexible points = floor((resolved INT + resolved LCK) * flexible point factor)");
    expect(model.selectedDocument.markdown).toContain("Skill group cost = floor(0.6 * total individual cost of active group skills)");
  });

  it("loads the equipment encumbrance document with location and formula content", async () => {
    const model = await getRulesDocumentationPageModel({
      selectedDocumentId: "equipment-encumbrance-calculations"
    });

    expect(model.selectedDocument.title).toBe("Equipment & Encumbrance Calculations");
    expect(model.selectedDocument.markdown).toContain("# Equipment & Encumbrance Calculations");
    expect(model.selectedDocument.markdown).toContain("Effective item ENC = base ENC * quantity * material factor * quality factor * carry factor");
    expect(model.selectedDocument.markdown).toContain("Carry state");
    expect(model.selectedDocument.markdown).toContain("Mount-carried ENC = sum(base ENC of mount-carried items)");
  });

  it("loads the Equip Items document with weapon and defense formulas", async () => {
    const model = await getRulesDocumentationPageModel({
      selectedDocumentId: "combat-loadout-calculations"
    });

    expect(model.selectedDocument.title).toBe("Equip Items Calculations");
    expect(model.selectedDocument.markdown).toContain("# Equip Items Calculations");
    expect(model.selectedDocument.markdown).toContain("Raw melee OB");
    expect(model.selectedDocument.markdown).toContain("Base DB");
    expect(model.selectedDocument.markdown).toContain("Combined parry modifier");
    expect(model.selectedDocument.markdown).toContain("GMR");
  });
});
