import { describe, expect, it } from "vitest";

import {
  expandStructuredRuleTableDirectives,
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
        }),
        expect.objectContaining({
          fileName: "combat-to-hit.md",
          id: "combat-to-hit",
          section: "Combat",
          title: "Glantri Combat To Hit / Damage"
        }),
        expect.objectContaining({
          fileName: "combat-critical-effects.md",
          id: "combat-critical-effects",
          section: "Combat",
          title: "Glantri Critical Effects"
        }),
        expect.objectContaining({
          fileName: "combat-experience.md",
          id: "combat-experience",
          section: "Combat",
          title: "Combat Experience"
        })
      ])
    );
    expect(getRulesDocuments()).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "combat-hit-location"
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
      "Equip Items Calculations",
      "Glantri Combat To Hit / Damage",
      "Glantri Critical Effects",
      "Combat Experience"
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

  it("loads the Combat Experience document with current result bands", async () => {
    const model = await getRulesDocumentationPageModel({
      selectedDocumentId: "combat-experience"
    });

    expect(model.selectedDocument.title).toBe("Combat Experience");
    expect(model.selectedDocument.markdown).toContain("# Combat Experience");
    expect(model.selectedDocument.markdown).toContain("Default difficulty: `26`");
    expect(model.selectedDocument.markdown).toContain("`<= 5` | Panic | `-4`");
    expect(model.selectedDocument.markdown).toContain("does not restrict player action dropdowns");
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

  it("loads the Glantri Combat To Hit / Damage document with roll and damage-scope notes", async () => {
    const model = await getRulesDocumentationPageModel({
      selectedDocumentId: "combat-to-hit"
    });

    expect(model.selectedDocument.title).toBe("Glantri Combat To Hit / Damage");
    expect(model.selectedDocument.markdown).toContain("# Glantri Combat To Hit / Damage");
    expect(model.selectedDocument.markdown).toContain("Roll open-ended `1d20`");
    expect(model.selectedDocument.markdown).toContain("hit lookup total = OB - DB + open-ended roll total");
    expect(model.selectedDocument.markdown).toContain("Lookup total `11` is a grazing hit.");
    expect(model.selectedDocument.markdown).toContain(
      "Damage metadata is available for hits and grazing hits.",
    );
    expect(model.selectedDocument.markdown).toContain("Lookup totals `17` and `18` are resolved");
    expect(model.selectedDocument.markdown).toContain("Lookup totals above the displayed table continue");
    expect(model.selectedDocument.markdown).toContain(
      "damage lookup total = hit lookup total + weapon DMB + defender DM",
    );
    expect(model.selectedDocument.markdown).toContain("damage lookup is `14 + 8 + 0 = 22`");
    expect(model.selectedDocument.markdown).toContain("Armor is applied after the table row is read.");
    expect(model.selectedDocument.markdown).toContain("the grazing hit rolls `1d7`");
    expect(model.selectedDocument.markdown).toContain("damage result proposal");
    expect(model.selectedDocument.markdown).toContain("Commit phase damage");
    expect(model.selectedDocument.markdown).toContain("one active physical damage effect row");
    expect(model.selectedDocument.markdown).toContain("critical effects remain a GM");
    expect(model.selectedDocument.markdown).not.toContain("New Combat Arena.xlsx");
    expect(model.selectedDocument.markdown).not.toContain("Sheet: `to hit (new)`");
    expect(model.selectedDocument.markdown).not.toContain("| Lookup total |");
  });

  it("loads the Glantri Critical Effects document with table-driven integration notes", async () => {
    const model = await getRulesDocumentationPageModel({
      selectedDocumentId: "combat-critical-effects"
    });

    expect(model.selectedDocument.title).toBe("Glantri Critical Effects");
    expect(model.selectedDocument.markdown).toContain("# Glantri Critical Effects");
    expect(model.selectedDocument.markdown).toContain("GM-reviewable proposals");
    expect(model.selectedDocument.markdown).toContain("Critical family");
    expect(model.selectedDocument.markdown).toContain("Critical index from `1` through `16`");
    expect(model.selectedDocument.markdown).toContain("app rolls those table-contained dice");
    expect(model.selectedDocument.markdown).toContain("shown as proposal warnings rather than guessed");
    expect(model.selectedDocument.markdown).toContain("minimum total damage floor");
    expect(model.selectedDocument.markdown).toContain("GM review remains required");
    expect(model.selectedDocument.markdown).not.toContain("Glantri_CriticalEffects_AppFacing");
    expect(model.selectedDocument.markdown).not.toContain("AppFacing_Crits");
  });

  it("expands structured rule-table directives into markdown tables", () => {
    expect(expandStructuredRuleTableDirectives("{{rule-table:combat-hit-location}}")).toContain(
      "| 20 | Head | Head | `head` |"
    );
    expect(expandStructuredRuleTableDirectives("{{rule-table:combat-hit-location}}")).toContain(
      "| 1 | Left leg | L leg | `leftLeg` |"
    );
  });

});
