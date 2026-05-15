import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const sourcePath = join(dirname(fileURLToPath(import.meta.url)), "CampaignsPageContent.tsx");

function readSource(): string {
  return readFileSync(sourcePath, "utf8");
}

describe("CampaignsPageContent player campaign listing", () => {
  it("keeps player campaign cards story-facing and links accessible scenarios", () => {
    const source = readSource();

    expect(source).toContain('tab: "scenario"');
    expect(source).toContain("Choose an available campaign to continue your story.");
    expect(source).toContain("No active scenario is currently available.");
    expect(source).toContain("canManageCampaigns ? (");
    expect(source).toContain("Player self-join:");
    expect(source).not.toContain("Accessible scenarios:");
  });
});
