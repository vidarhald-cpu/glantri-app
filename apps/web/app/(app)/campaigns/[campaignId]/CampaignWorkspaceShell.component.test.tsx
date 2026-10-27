import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { EncounterSessionSummary, PlayerAccessibleScenario } from "@glantri/domain";

import { buildCampaignWorkspaceHref, type CampaignWorkspaceTabId } from "@/lib/campaigns/workspace";
import {
  CampaignWorkspaceNavigation,
  CurrentScenarioContextPanel,
  ScenarioPlayNavigation,
} from "./CampaignWorkspaceShell";

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

    expect(
      screen.queryByText("Choose the current Scenario you want to continue."),
    ).not.toBeInTheDocument();
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
      screen.queryByText("Continue the current Scenario and its active Encounters."),
    ).not.toBeInTheDocument();
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

  it("drops the player Campaign row's duplicate Blackboard and Maps while the Play arena is on screen", () => {
    render(
      <CampaignWorkspaceNavigation
        activeTab="scenario"
        campaignId="campaign-1"
        canManageCampaign={false}
        playArenaPresent
      />,
    );

    const navigation = screen.getByRole("navigation", { name: "Campaign navigation" });
    expect(
      within(navigation)
        .getAllByRole("link")
        .map((link) => link.textContent),
    ).toEqual(["Campaigns", "Campaign"]);
    expect(within(navigation).queryByRole("link", { name: "Blackboard" })).not.toBeInTheDocument();
    expect(within(navigation).queryByRole("link", { name: "Maps" })).not.toBeInTheDocument();
  });

  it("keeps the GM Campaign rows unchanged while a Play arena is on screen", () => {
    render(
      <CampaignWorkspaceNavigation
        activeTab="scenario"
        campaignId="campaign-1"
        canManageCampaign
        playArenaPresent
      />,
    );

    const relatedTools = screen.getByRole("navigation", { name: "Related Campaign tools" });
    expect(within(relatedTools).getByRole("link", { name: "Blackboard" })).toBeVisible();
    expect(within(relatedTools).getByRole("link", { name: "Maps" })).toBeVisible();
  });
});

describe("Scenario Play navigation", () => {
  const playNavigationProps = {
    buildWorkspaceHref,
    campaignId: "campaign-1",
    scenarioId: "scenario-1",
    scenarioName: "The Library",
  };

  it("gives a player exactly one active-play sub-navigation row holding every entry point", () => {
    render(
      <ScenarioPlayNavigation
        {...playNavigationProps}
        activeEncounterId="encounter-1"
        activeEncounterTitle="Search the stacks"
        activeTab="player-skill-rolls"
        canAccessGmEncounter={false}
      />,
    );

    const playViews = screen.getByRole("navigation", { name: "Play views" });
    expect(
      within(playViews)
        .getAllByRole("link")
        .map((link) => link.textContent),
    ).toEqual(["Situation", "Action", "Map", "Blackboard", "Character", "Player combat"]);

    // #787: one contextual row only, and one Map/Blackboard entry each in it.
    expect(screen.getAllByRole("navigation")).toHaveLength(1);
    expect(within(playViews).getAllByRole("link", { name: "Map" })).toHaveLength(1);
    expect(within(playViews).getAllByRole("link", { name: "Blackboard" })).toHaveLength(1);

    expect(within(playViews).getByRole("link", { name: "Situation" })).toHaveAttribute(
      "href",
      "/campaigns/campaign-1?tab=scenario&scenarioId=scenario-1&encounterId=encounter-1",
    );
    expect(within(playViews).getByRole("link", { name: "Action" })).toHaveAttribute(
      "href",
      "/campaigns/campaign-1?tab=player-skill-rolls&scenarioId=scenario-1&encounterId=encounter-1",
    );
    expect(within(playViews).getByRole("link", { name: "Map" })).toHaveAttribute(
      "href",
      "/campaigns/campaign-1?tab=maps&scenarioId=scenario-1&encounterId=encounter-1",
    );
    expect(within(playViews).getByRole("link", { name: "Blackboard" })).toHaveAttribute(
      "href",
      "/campaigns/campaign-1?tab=blackboard&scenarioId=scenario-1&encounterId=encounter-1",
    );
    expect(within(playViews).getByRole("link", { name: "Character" })).toHaveAttribute(
      "href",
      "/campaigns/campaign-1?tab=character&scenarioId=scenario-1&encounterId=encounter-1",
    );

    // The consolidated tabs are no longer separate player entry points.
    expect(within(playViews).queryByRole("link", { name: "Scenario" })).not.toBeInTheDocument();
    expect(within(playViews).queryByRole("link", { name: "Encounter" })).not.toBeInTheDocument();
    expect(within(playViews).queryByRole("link", { name: "Skill rolls" })).not.toBeInTheDocument();

    // A player never sees the GM-only Combat tooling.
    expect(screen.queryByRole("link", { name: "Combat" })).not.toBeInTheDocument();

    // Existing routes remain reachable: Player combat keeps its own route and
    // now sits inside the one row rather than a second contextual row.
    expect(
      screen.queryByRole("navigation", { name: "Retained Play entry points" }),
    ).not.toBeInTheDocument();
    expect(within(playViews).getByRole("link", { name: "Player combat" })).toHaveAttribute(
      "href",
      "/campaigns/campaign-1?tab=player-combat&scenarioId=scenario-1&encounterId=encounter-1",
    );
  });

  it("names the Scenario and the active Encounter in the shared Play header", () => {
    render(
      <ScenarioPlayNavigation
        {...playNavigationProps}
        activeEncounterId="encounter-1"
        activeEncounterTitle="Search the stacks"
        activeTab="scenario"
        canAccessGmEncounter={false}
      />,
    );

    const header = screen.getByRole("region", { name: "Play header" });
    expect(within(header).getByText("The Library")).toBeVisible();
    expect(within(header).getByText("Encounter · Search the stacks")).toBeVisible();
  });

  it("omits the Encounter indication and the retained Combat link when no Encounter is active", () => {
    render(
      <ScenarioPlayNavigation
        {...playNavigationProps}
        activeTab="scenario"
        canAccessGmEncounter={false}
      />,
    );

    const header = screen.getByRole("region", { name: "Play header" });
    expect(within(header).getByText("The Library")).toBeVisible();
    expect(screen.queryByTestId("play-header-encounter")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("navigation", { name: "Retained Play entry points" }),
    ).not.toBeInTheDocument();

    expect(screen.getByRole("navigation", { name: "Play views" })).toBeVisible();
    expect(screen.queryByRole("link", { name: "Player combat" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Action" })).toHaveAttribute(
      "href",
      "/campaigns/campaign-1?tab=player-skill-rolls&scenarioId=scenario-1",
    );
  });

  it("marks the Play view that presents each consolidated tab as current", () => {
    for (const [activeTab, currentView] of [
      ["scenario", "Situation"],
      ["encounter", "Action"],
      ["player-encounter", "Action"],
      ["skill-rolls", "Action"],
      ["player-skill-rolls", "Action"],
      ["maps", "Map"],
      ["blackboard", "Blackboard"],
      ["character", "Character"],
    ] as Array<[CampaignWorkspaceTabId, string]>) {
      const { unmount } = render(
        <ScenarioPlayNavigation
          {...playNavigationProps}
          activeTab={activeTab}
          canAccessGmEncounter={false}
        />,
      );

      expect(screen.getByRole("link", { name: currentView })).toHaveAttribute(
        "aria-current",
        "page",
      );
      expect(
        screen.getAllByRole("link").filter((link) => link.getAttribute("aria-current") === "page"),
      ).toHaveLength(1);

      unmount();
    }
  });

  it("marks the retained player Combat entry current from inside the one Play views row", () => {
    render(
      <ScenarioPlayNavigation
        {...playNavigationProps}
        activeEncounterId="encounter-1"
        activeEncounterTitle="Search the stacks"
        activeTab="player-combat"
        canAccessGmEncounter={false}
      />,
    );

    const playViews = screen.getByRole("navigation", { name: "Play views" });
    const current = within(playViews)
      .getAllByRole("link")
      .filter((link) => link.getAttribute("aria-current") === "page");
    expect(current.map((link) => link.textContent)).toEqual(["Player combat"]);
    expect(within(playViews).getByRole("link", { name: "Player combat" })).toBeVisible();
  });

  it("leaves the GM Scenario and Encounter tools unchanged", () => {
    render(
      <ScenarioPlayNavigation
        {...playNavigationProps}
        activeEncounterId="encounter-1"
        activeEncounterTitle="Search the stacks"
        activeTab="combat"
        canAccessGmEncounter
      />,
    );

    const tools = screen.getByRole("navigation", { name: "Scenario and Encounter tools" });
    expect(
      within(tools)
        .getAllByRole("link")
        .map((link) => link.textContent),
    ).toEqual(["Scenario", "Encounter", "Character", "Skill rolls", "Combat", "Player combat"]);

    expect(within(tools).getByRole("link", { name: "Scenario" })).toHaveAttribute(
      "href",
      "/campaigns/campaign-1/scenarios/scenario-1",
    );
    expect(within(tools).getByRole("link", { name: "Encounter" })).toHaveAttribute(
      "href",
      "/campaigns/campaign-1/scenarios/scenario-1/encounters/encounter-1",
    );
    expect(within(tools).getByRole("link", { name: "Combat" })).toHaveAttribute(
      "href",
      "/campaigns/campaign-1?tab=combat&scenarioId=scenario-1&encounterId=encounter-1",
    );

    // A GM keeps their own tabs and does not get the player Play arena.
    expect(screen.queryByRole("navigation", { name: "Play views" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Play header" })).not.toBeInTheDocument();
  });

  it("hides the GM Encounter tools that need an Encounter when none is active", () => {
    render(
      <ScenarioPlayNavigation {...playNavigationProps} activeTab="scenario" canAccessGmEncounter />,
    );

    const tools = screen.getByRole("navigation", { name: "Scenario and Encounter tools" });
    expect(
      within(tools)
        .getAllByRole("link")
        .map((link) => link.textContent),
    ).toEqual(["Scenario", "Character"]);
  });
});
