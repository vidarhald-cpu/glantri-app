import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const sourcePath = join(
  dirname(fileURLToPath(import.meta.url)),
  "CampaignDetailPageContent.tsx"
);

function readCampaignDetailSource(): string {
  return readFileSync(sourcePath, "utf8");
}

describe("CampaignDetailPageContent roster UI", () => {
  it("does not render the legacy campaign NPC creation/list sections", () => {
    const source = readCampaignDetailSource();

    expect(source).not.toContain("<h2 style={{ margin: 0 }}>Create campaign NPC</h2>");
    expect(source).not.toContain("<h2 style={{ margin: 0 }}>Campaign NPCs</h2>");
    expect(source).not.toContain("Start from template");
    expect(source).not.toContain("Use template values");
    expect(source).not.toContain("Add PC");
    expect(source).not.toContain("Add NPC");
    expect(source).not.toContain("Add template");
  });

  it("exposes the intended roster filter groups and candidate table columns", () => {
    const source = readCampaignDetailSource();

    expect(source).toContain("Membership");
    expect(source).toContain("In campaign");
    expect(source).toContain("Other campaigns");
    expect(source).toContain("Type");
    expect(source).toContain("All civilizations");
    expect(source).toContain("All professions");
    expect(source).toContain("All skill groups");
    expect(source).toContain("Search name, type, profession, civilization");
    expect(source).toContain("In campaign</th>");
    expect(source).toContain("Civilization</th>");
    expect(source).toContain("Profession</th>");
    expect(source).toContain("Skill groups</th>");
    expect(source).toContain("Source</th>");
  });
});
