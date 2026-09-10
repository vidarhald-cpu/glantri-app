import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { EncounterSessionSummary, PlayerAccessibleScenario } from "@glantri/domain";

import { buildCampaignWorkspaceHref, type CampaignWorkspaceTabId } from "@/lib/campaigns/workspace";
import { LivePlayPanel } from "./CampaignWorkspaceShell";

const scenarios: PlayerAccessibleScenario[] = [
  {
    campaignId: "campaign-1",
    description: "",
    id: "scenario-1",
    name: "The Library",
    status: "live",
  },
  {
    campaignId: "campaign-1",
    description: "",
    id: "scenario-2",
    name: "The Courtyard",
    status: "live",
  },
];

function encounter(input: {
  id: string;
  scenarioId: string;
  status?: EncounterSessionSummary["status"];
  title: string;
}): EncounterSessionSummary {
  return {
    campaignId: "campaign-1",
    createdAt: "2026-09-10T12:00:00.000Z",
    id: input.id,
    scenarioId: input.scenarioId,
    status: input.status ?? "active",
    title: input.title,
    updatedAt: "2026-09-10T12:00:00.000Z",
    viewerAssigned: true,
  };
}

const buildWorkspaceHref = (input: {
  encounterId?: string | null;
  scenarioId?: string | null;
  tab?: CampaignWorkspaceTabId | null;
}) => buildCampaignWorkspaceHref({ campaignId: "campaign-1", ...input });

describe("Campaign workspace live play panel", () => {
  it("offers stable Scenario, Encounter, and GM Combat links for several live Scenarios", () => {
    render(
      <LivePlayPanel
        buildWorkspaceHref={buildWorkspaceHref}
        canAccessGmEncounter
        encounters={[
          encounter({ id: "encounter-1", scenarioId: "scenario-1", title: "Search the stacks" }),
          encounter({
            id: "encounter-paused",
            scenarioId: "scenario-2",
            status: "paused",
            title: "Waiting outside",
          }),
        ]}
        scenarios={scenarios}
      />,
    );

    expect(screen.getByText("Choose the live Scenario you want to continue.")).toBeVisible();
    expect(screen.getByText("The Library")).toBeVisible();
    expect(screen.getByText("The Courtyard")).toBeVisible();
    expect(screen.queryByText("Waiting outside")).not.toBeInTheDocument();

    const encounterRow = screen.getByText("Search the stacks").parentElement;
    expect(encounterRow).not.toBeNull();
    expect(within(encounterRow!).getByRole("link", { name: "Open Encounter" })).toHaveAttribute(
      "href",
      "/campaigns/campaign-1?tab=encounter&scenarioId=scenario-1&encounterId=encounter-1",
    );
    expect(within(encounterRow!).getByRole("link", { name: "Open Combat" })).toHaveAttribute(
      "href",
      "/campaigns/campaign-1?tab=combat&scenarioId=scenario-1&encounterId=encounter-1",
    );
  });

  it("routes a player to Player combat for the same Scenario and Encounter", () => {
    render(
      <LivePlayPanel
        buildWorkspaceHref={buildWorkspaceHref}
        canAccessGmEncounter={false}
        encounters={[
          encounter({ id: "encounter-1", scenarioId: "scenario-1", title: "Search the stacks" }),
        ]}
        scenarios={[scenarios[0]!]}
      />,
    );

    expect(screen.getByText("Continue the live Scenario and its active Encounters.")).toBeVisible();
    expect(screen.getByRole("link", { name: "Open Combat" })).toHaveAttribute(
      "href",
      "/campaigns/campaign-1?tab=player-combat&scenarioId=scenario-1&encounterId=encounter-1",
    );
  });

  it("keeps Campaign Home available when no live Scenario exists", () => {
    render(
      <LivePlayPanel
        buildWorkspaceHref={buildWorkspaceHref}
        canAccessGmEncounter={false}
        encounters={[]}
        scenarios={[]}
      />,
    );

    expect(
      screen.getByText(/No live Scenario is currently available.*completed history remain/s),
    ).toBeVisible();
    expect(screen.queryByRole("link", { name: "Open Scenario" })).not.toBeInTheDocument();
  });
});
