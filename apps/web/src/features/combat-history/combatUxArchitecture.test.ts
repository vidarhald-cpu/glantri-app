import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), "../../../../../");

function readArchitectureDocument(name: string): string {
  return readFileSync(join(repositoryRoot, "docs/architecture", name), "utf8");
}

describe("combat UX architecture", () => {
  it("records the approved shared conversation and panel-ownership principles", () => {
    const principles = readArchitectureDocument("combat-ux-principles.md");

    expect(principles).toContain("Combat in Glantri is a shared tabletop conversation.");
    expect(principles).toContain("GM Combat, GM Player Combat, and Player Combat must show the same tracker order.");
    expect(principles).toContain("Combat Situation explains.");
    expect(principles).toContain("Results prove.");
    expect(principles).toContain("Current Action decides.");
    expect(principles).toContain("The amber live marker and green inspection cursor");
    expect(principles).toContain("a future no-work stage remains");
    expect(principles).toContain("are not participant combat Results");
    expect(principles).toContain("Transient feedback is for transient actions.");
    expect(principles).toContain("Permanent UI is for persistent state.");
  });

  it("keeps the normative combat architecture linked to the UX principles", () => {
    expect(readArchitectureDocument("combat-architecture-overview.md")).toContain(
      "[combat-ux-principles.md](./combat-ux-principles.md)",
    );
    expect(readArchitectureDocument("combat-presentation-guidelines.md")).toContain(
      "[Combat UX Principles](./combat-ux-principles.md)",
    );
  });
});
