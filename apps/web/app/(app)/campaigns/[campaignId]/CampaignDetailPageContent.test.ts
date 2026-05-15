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

    expect(source).toContain("Roster membership filter");
    expect(source).toContain("Members");
    expect(source).toContain("Other campaigns");
    expect(source).toContain("Roster type filter");
    expect(source).toContain("All types");
    expect(source).toContain("PCs");
    expect(source).toContain("NPCs");
    expect(source).toContain("Templates");
    expect(source).toContain("All civilizations");
    expect(source).toContain("All professions");
    expect(source).toContain("All skill groups");
    expect(source).toContain("Search roster candidates");
    expect(source).toContain("Member</th>");
    expect(source).toContain("Name</th>");
    expect(source).toContain("Type</th>");
    expect(source).toContain("Civilization</th>");
    expect(source).toContain("Profession</th>");
    expect(source).toContain("Owner</th>");
    expect(source).toContain("Action</th>");
    expect(source).toContain("Remove");
    expect(source).not.toContain("Skill groups</th>");
    expect(source).not.toContain("Source</th>");
    expect(source).not.toContain("Character · Owner:");
  });

  it("maps roster civilizations to player-facing names without showing unknown internal ids", () => {
    const source = readCampaignDetailSource();

    expect(source).toContain("defaultCanonicalContent.civilizations");
    expect(source).toContain("getCivilizationDisplayName");
    expect(source).toContain("civilizationNameById");
    expect(source).toContain("civilizationNamesBySocietyId");
    expect(source).toContain('return "—";');
  });

  it("removes roster membership locally by entry and source so filters do not stay stale", () => {
    const source = readCampaignDetailSource();

    expect(source).toContain("function removeRosterEntryFromList");
    expect(source).toContain("entry.id === removedEntry.id");
    expect(source).toContain("entry.campaignId === removedEntry.campaignId");
    expect(source).toContain("setRoster((current) => removeRosterEntryFromList(current, rosterEntry))");
    expect(source).toContain(
      "setAllRosterEntries((current) => removeRosterEntryFromList(current, rosterEntry))"
    );
  });

  it("does not expose scenario kind or combat status on the campaign-level scenario UI", () => {
    const source = readCampaignDetailSource();

    expect(source).toContain('kind: "mixed"');
    expect(source).not.toContain("setScenarioKind");
    expect(source).not.toContain('<option value="combat">Combat</option>');
    expect(source).not.toContain(">Kind</th>");
    expect(source).not.toContain("scenario.kind}</td>");
    expect(source).not.toContain(">Combat</th>");
    expect(source).not.toContain("scenario.liveState?.combatStatus");
    expect(source).toContain(">Scenario</th>");
    expect(source).toContain(">Status</th>");
    expect(source).toContain(">Follows</th>");
    expect(source).toContain(">Action</th>");
  });
});
