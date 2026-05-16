import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const routePath = dirname(fileURLToPath(import.meta.url));

function readRoute(relativePath: string): string {
  return readFileSync(join(routePath, relativePath), "utf8");
}

describe("character control routes", () => {
  it("keeps the existing Equip items route wired to the shared loadout view", () => {
    const source = readRoute("[id]/loadout/page.tsx");

    expect(source).toContain("CharacterLoadoutView");
    expect(source).toContain("<CharacterLoadoutView characterId={id} />");
  });

  it("adds a player Character route as an Equip items replica", () => {
    const source = readRoute("[id]/character/page.tsx");
    const sharedViewSource = readRoute("[id]/components/CharacterLoadoutView.tsx");

    expect(source).toContain("CharacterLoadoutView");
    expect(source).toContain("<CharacterLoadoutView characterId={id} />");
    expect(sharedViewSource).toContain("Equip items -");
    expect(sharedViewSource).not.toContain("physical state");
    expect(sharedViewSource).not.toContain("combat arena");
  });

  it("adds a GM inspection page with a character selector and the same loadout view", () => {
    const source = readRoute("inspect/CharacterInspectionPageContent.tsx");

    expect(source).toContain("<h1 style={{ margin: 0 }}>Character</h1>");
    expect(source).toContain("Select character to inspect");
    expect(source).toContain("Previous");
    expect(source).toContain("Next");
    expect(source).toContain("CharacterLoadoutView");
  });
});
