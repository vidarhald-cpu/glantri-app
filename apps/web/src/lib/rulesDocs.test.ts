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
    expect(model.selectedDocument.markdown).toContain("Displayed GM = trunc((Current stat - 11) / 2)");
    expect(model.selectedDocument.markdown).toContain("Skill group cost = floor(0.6 * total individual cost of active group skills)");
  });
});
