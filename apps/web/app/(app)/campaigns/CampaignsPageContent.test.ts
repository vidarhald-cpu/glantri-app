import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const sourcePath = join(dirname(fileURLToPath(import.meta.url)), "CampaignsPageContent.tsx");

function readSource(): string {
  return readFileSync(sourcePath, "utf8");
}

describe("CampaignsPageContent player campaign listing", () => {
  it("keeps the multi-Campaign player list with one native-link resume action per Campaign", () => {
    const source = readSource();

    expect(source).not.toContain('"Campaign Home"');
    expect(source).toContain("Your character");
    expect(source).toContain("Current scenario");
    expect(source).toContain("No active scenario is currently available.");
    expect(source).toContain("buildPlayerCampaignResumeHref(record)");
    expect(source).toContain(
      'gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 290px), 1fr))"',
    );
    expect(source).toContain("<Link\n          href={buildPlayerCampaignResumeHref(record)}");
    expect(source).toContain("getPlayerCampaignResumeLabel(record)");
    expect(source).not.toContain("Allow player self-join");
    expect(source).not.toContain("Player self-join:");
    expect(source).not.toContain("setAllowPlayerSelfJoin");
    expect(source).not.toContain("Accessible scenarios:");
    expect(source).not.toContain("GM-only");
    expect(source).not.toContain("mapAssetId");
  });

  it("opens a player's sole Campaign straight into its landing instead of a second Campaign page", () => {
    const source = readSource();

    expect(source).toContain("playerCampaigns.length === 1");
    expect(source).toContain(
      'router.replace(buildCampaignWorkspaceHref({ campaignId: soleCampaignId, tab: "campaign" }))',
    );
    // The GM list is never redirected.
    expect(source).toContain("!canManageCampaigns && !loading && !error");
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
