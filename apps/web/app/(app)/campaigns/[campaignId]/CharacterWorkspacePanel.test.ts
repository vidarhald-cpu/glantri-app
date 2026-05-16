import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const sourcePath = join(dirname(fileURLToPath(import.meta.url)), "CharacterWorkspacePanel.tsx");

function readSource(): string {
  return readFileSync(sourcePath, "utf8");
}

describe("CharacterWorkspacePanel", () => {
  it("reuses the loadout view with Physical state and without future combat-state placeholders", () => {
    const source = readSource();

    expect(source).toContain("CharacterLoadoutView");
    expect(source).toContain(
      "<CharacterLoadoutView characterId={selectedCandidate.characterId} showPhysicalState />",
    );
    expect(source).not.toContain("Damage");
    expect(source).not.toContain("Combat arena");
  });

  it("keeps player and GM character controls separate", () => {
    const source = readSource();

    expect(source).toContain("You are not currently assigned to a character in this scenario.");
    expect(source).toContain("Select character to inspect");
    expect(source).toContain("Previous");
    expect(source).toContain("Next");
  });
});
