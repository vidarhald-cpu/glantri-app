import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const sourcePath = join(dirname(fileURLToPath(import.meta.url)), "CampaignsPageContent.tsx");

function readSource(): string {
  return readFileSync(sourcePath, "utf8");
}

describe("CampaignsPageContent player campaign listing", () => {
  it("renders a useful player Campaign Home with one native-link resume action", () => {
    const source = readSource();

    expect(source).toContain("Campaign Home");
    expect(source).toContain("Your character");
    expect(source).toContain("Current scenario");
    expect(source).toContain("Continue combat");
    expect(source).toContain("Continue encounter");
    expect(source).toContain("Continue scenario");
    expect(source).toContain("No active scenario is currently available.");
    expect(source).toContain("buildPlayerResumeHref(record)");
    expect(source).toContain(
      'gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 290px), 1fr))"',
    );
    expect(source).toContain("<Link\n          href={buildPlayerResumeHref(record)}");
    expect(source).not.toContain("Allow player self-join");
    expect(source).not.toContain("Player self-join:");
    expect(source).not.toContain("setAllowPlayerSelfJoin");
    expect(source).not.toContain("Accessible scenarios:");
    expect(source).not.toContain("GM-only");
    expect(source).not.toContain("mapAssetId");
  });

  it("preserves the existing GM create and workspace entry points", () => {
    const source = readSource();

    expect(source).toContain("Create campaign");
    expect(source).toContain("createCampaignOnServer");
    expect(source).toContain("Status: {formatScenarioStatus(campaign.status)}");
    expect(source).not.toContain("Status: {campaign.status}");
    expect(source).toContain('tab: "campaign"');
  });
});
