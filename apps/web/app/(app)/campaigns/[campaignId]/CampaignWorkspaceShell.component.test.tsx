import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { EncounterSessionSummary, PlayerAccessibleScenario } from "@glantri/domain";

import { buildCampaignWorkspaceHref, type CampaignWorkspaceTabId } from "@/lib/campaigns/workspace";
import { CampaignWorkspaceNavigation, CurrentScenarioContextPanel } from "./CampaignWorkspaceShell";

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

describe("Campaign workspace current Scenario context", () => {
  it("offers stable Scenario, Encounter, and GM Combat links for several live Scenarios", () => {
    render(
      <CurrentScenarioContextPanel
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

    expect(screen.getByText("Choose the current Scenario you want to continue.")).toBeVisible();
    expect(screen.getByText("The Library")).toBeVisible();
    expect(screen.getByText("The Courtyard")).toBeVisible();
    expect(screen.queryByText("Waiting outside")).not.toBeInTheDocument();

    const encounterRow = screen.getByText("Search the stacks").parentElement;
    expect(encounterRow).not.toBeNull();
    expect(within(encounterRow!).getByRole("link", { name: "Open Encounter" })).toHaveAttribute(
      "href",
      "/campaigns/campaign-1/scenarios/scenario-1/encounters/encounter-1",
    );
    expect(within(encounterRow!).getByRole("link", { name: "Open Combat" })).toHaveAttribute(
      "href",
      "/campaigns/campaign-1?tab=combat&scenarioId=scenario-1&encounterId=encounter-1",
    );
  });

  it("routes a player to Player combat for the same Scenario and Encounter", () => {
    render(
      <CurrentScenarioContextPanel
        buildWorkspaceHref={buildWorkspaceHref}
        canAccessGmEncounter={false}
        encounters={[
          encounter({ id: "encounter-1", scenarioId: "scenario-1", title: "Search the stacks" }),
        ]}
        scenarios={[scenarios[0]!]}
      />,
    );

    expect(
      screen.getByText("Continue the current Scenario and its active Encounters."),
    ).toBeVisible();
    expect(screen.getByRole("link", { name: "Open Combat" })).toHaveAttribute(
      "href",
      "/campaigns/campaign-1?tab=player-combat&scenarioId=scenario-1&encounterId=encounter-1",
    );
  });

  it("keeps Campaign Home available when no live Scenario exists", () => {
    render(
      <CurrentScenarioContextPanel
        buildWorkspaceHref={buildWorkspaceHref}
        canAccessGmEncounter={false}
        encounters={[]}
        scenarios={[]}
      />,
    );

    expect(
      screen.getByText(/No active Scenario is currently available.*completed history remain/s),
    ).toBeVisible();
    expect(screen.queryByRole("link", { name: "Open Scenario" })).not.toBeInTheDocument();
  });
});

describe("Campaign workspace task navigation", () => {
  it("organizes the GM shell around Campaign tasks without a separate play hierarchy", () => {
    render(
      <CampaignWorkspaceNavigation
        activeTab="campaign"
        campaignId="campaign-1"
        canManageCampaign
      />,
    );

    const tasks = screen.getByRole("navigation", { name: "Campaign tasks" });
    expect(within(tasks).getByRole("link", { name: "Membership" })).toHaveAttribute(
      "href",
      "/campaigns/campaign-1?tab=campaign#campaign-membership",
    );
    expect(within(tasks).getByRole("link", { name: "Scenarios" })).toHaveAttribute(
      "href",
      "/campaigns/campaign-1?tab=campaign#campaign-scenarios",
    );
    expect(within(tasks).getByRole("link", { name: "Campaign history" })).toHaveAttribute(
      "href",
      "/campaigns/campaign-1?tab=campaign#campaign-history",
    );
    expect(within(tasks).getByRole("link", { name: "Create material" })).toHaveAttribute(
      "href",
      "/campaigns/campaign-1?tab=campaign#campaign-create-material",
    );
    expect(within(tasks).getByRole("link", { name: "Notes & material" })).toHaveAttribute(
      "href",
      "/campaigns/campaign-1?tab=campaign#campaign-material",
    );
    expect(within(tasks).queryByRole("link", { name: "Combat" })).not.toBeInTheDocument();
    expect(within(tasks).queryByRole("link", { name: "Player combat" })).not.toBeInTheDocument();

    const relatedTools = screen.getByRole("navigation", { name: "Related Campaign tools" });
    expect(within(relatedTools).getByRole("link", { name: "Blackboard" })).toBeVisible();
    expect(within(relatedTools).getByRole("link", { name: "Maps" })).toBeVisible();
  });

  it("keeps the player shell compact and role-appropriate", () => {
    render(
      <CampaignWorkspaceNavigation
        activeTab="campaign"
        campaignId="campaign-1"
        canManageCampaign={false}
      />,
    );

    const navigation = screen.getByRole("navigation", { name: "Campaign navigation" });
    expect(within(navigation).getByRole("link", { name: /^Campaign$/ })).toBeVisible();
    expect(within(navigation).getByRole("link", { name: "Blackboard" })).toBeVisible();
    expect(within(navigation).getByRole("link", { name: "Maps" })).toBeVisible();
    expect(within(navigation).queryByRole("link", { name: "Membership" })).not.toBeInTheDocument();
  });
});
