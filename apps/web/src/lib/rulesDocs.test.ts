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
          fileName: "equipment-encumbrance-calculations.md",
          id: "equipment-encumbrance-calculations",
          section: "Equipment",
          title: "Equipment & Encumbrance Calculations"
        }),
        expect.objectContaining({
          fileName: "combat-loadout-calculations.md",
          id: "combat-loadout-calculations",
          section: "Combat / Equipment",
          title: "Combat Loadout Calculations"
        })
      ])
    );
  });

  it("defaults to Character Sheet Calculations", () => {
    expect(getRulesDocumentEntryById(undefined)).toMatchObject({
      id: "character-sheet-calculations",
      title: "Character Sheet Calculations"
    });
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

  it("loads the combat loadout document with weapon and defense formulas", async () => {
    const model = await getRulesDocumentationPageModel({
      selectedDocumentId: "combat-loadout-calculations"
    });

    expect(model.selectedDocument.title).toBe("Combat Loadout Calculations");
    expect(model.selectedDocument.markdown).toContain("# Combat Loadout Calculations");
    expect(model.selectedDocument.markdown).toContain("Raw OB");
    expect(model.selectedDocument.markdown).toContain("Base DB");
    expect(model.selectedDocument.markdown).toContain("Combined parry modifier");
    expect(model.selectedDocument.markdown).toContain("GMR");
  });
});
