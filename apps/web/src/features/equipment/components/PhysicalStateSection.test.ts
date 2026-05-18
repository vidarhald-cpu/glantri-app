import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const sourcePath = join(dirname(fileURLToPath(import.meta.url)), "PhysicalStateSection.tsx");

function readSource(): string {
  return readFileSync(sourcePath, "utf8");
}

describe("PhysicalStateSection", () => {
  it("renders physical state combat-effect panels", () => {
    const source = readSource();

    expect(source).toContain("Physical state");
    expect(source).toContain("Hitpoints and damage");
    expect(source).toContain("Combat effects by sum");
    expect(source).toContain("Combat effects");
    expect(source).toContain("General hitpoints");
    expect(source).toContain("No combat effects recorded.");
    expect(source).not.toContain("weight");
  });

  it("keeps the summary panels in a responsive two-column row", () => {
    const source = readSource();

    expect(source).toContain('gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 20rem), 1fr))"');
    expect(source).toContain('alignItems: "start"');
  });

  it("renders the combat effects and hitpoint table columns", () => {
    const source = readSource();

    expect(source).toContain("Location");
    expect(source).toContain("Original");
    expect(source).toContain("Current");
    expect(source).toContain("Round");
    expect(source).toContain("Event");
    expect(source).toContain("Value");
    expect(source).toContain("Dur/Sta");
    expect(source).toContain("Details");
    expect(source).toContain("Current effect");
    expect(source).toContain("Save");
    expect(source).toContain("Delete");
  });

  it("keeps the manual combat effect editor compact and tied to selected rows", () => {
    const source = readSource();

    expect(source).toContain("New effect");
    expect(source).toContain("Edit selected effect");
    expect(source).toContain("Same event");
    expect(source).toContain("Round");
    expect(source).toContain("Description");
    expect(source).toContain("Loc");
    expect(source).toContain("Dam");
    expect(source).toContain("Mod");
    expect(source).toContain("Dur");
    expect(source).toContain("Sta");
    expect(source).toContain("onSaveCombatEffect");
    expect(source).toContain('type: "physical_damage"');
    expect(source).toContain('effectGroup: "none"');
    expect(source).toContain("sourceEventId: draft.sourceEventId ?? createLocalId");
    expect(source).toContain("entry.eventNumber");
    expect(source).toContain('gridTemplateColumns: "4rem minmax(14rem, 1fr) auto"');
    expect(source).toContain('gridTemplateColumns:');
    expect(source).toContain("position: \"sticky\"");
    expect(source).not.toContain("Add combat effect event");
    expect(source).not.toContain("Add effect row");
    expect(source).not.toContain("Source/Event label");
    expect(source).not.toContain("General damage");
    expect(source).not.toContain("Future phases will");
  });

  it("offers None options for event-neutral fields", () => {
    const source = readSource();

    expect(source).toContain('{ label: "None", value: "none" }');
    expect(source).not.toContain('{ fullLabel: "No location", label: "None", value: "" }');
  });

  it("keeps type and modifier group choices separate in the compact editor", () => {
    const source = readSource();

    expect(source).toContain('{ label: "Physical", value: "physical_damage" }');
    expect(source).toContain('{ label: "Stun", value: "stun" }');
    expect(source).toContain('{ label: "OB/Skill", value: "obSkill" }');
    expect(source).not.toContain('{ label: "General modifier", value: "general_modifier" }');
    expect(source).not.toContain('{ label: "OB/Skill modifier", value: "ob_skill_modifier" }');
  });

  it("uses compact hit location selectors including general damage", () => {
    const source = readSource();

    for (const label of ["H", "LA", "RA", "CB", "AB", "ULL", "LLL", "URL", "LRL", "Gen"]) {
      expect(source).toContain(`label: "${label}"`);
    }
    expect(source).toContain("locationGridStyle");
    expect(source).toContain("locationHeaderCellStyle");
    expect(source).toContain("locationCheckboxCellStyle");
    expect(source).not.toContain('label: "None", value: ""');
  });
});
