import { render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PlayerCampaignHomeRecord } from "@glantri/domain";

const mocks = vi.hoisted(() => ({ loadPlayerCampaignHome: vi.fn() }));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("@/lib/api/campaignClient", () => ({
  loadPlayerCampaignHome: mocks.loadPlayerCampaignHome,
}));

import {
  buildPlayerScenarioContext,
  PlayerCampaignHomeSummary,
  usePlayerCampaignHome,
  type PlayerCampaignHomeState,
} from "./PlayerCampaignLanding";

const campaign = {
  description: "",
  id: "campaign-1",
  name: "The Lost Seal",
  status: "active",
} as PlayerCampaignHomeRecord["campaign"];

function record(overrides: Partial<PlayerCampaignHomeRecord> = {}): PlayerCampaignHomeRecord {
  return {
    campaign,
    characters: [{ id: "character-1", name: "Aldric" }],
    resume: {
      encounterId: "encounter-1",
      scenarioId: "scenario-1",
      tab: "player-combat",
    },
    scenarios: [
      {
        characters: [{ id: "character-1", name: "Aldric" }],
        encounter: { id: "encounter-1", status: "active", title: "Courtyard" },
        scenario: {
          campaignId: "campaign-1",
          description: "",
          id: "scenario-1",
          name: "The Library",
          status: "live",
        },
      },
    ],
    ...overrides,
  };
}

describe("PlayerCampaignHomeSummary", () => {
  it("carries Your character and a Continue combat link to the active Combat", () => {
    render(<PlayerCampaignHomeSummary state={{ record: record(), status: "ready" }} />);

    expect(screen.getByText("Your character")).toBeVisible();
    expect(screen.getByText("Aldric")).toBeVisible();
    expect(screen.getByRole("link", { name: "Continue combat" })).toHaveAttribute(
      "href",
      "/campaigns/campaign-1?tab=player-combat&scenarioId=scenario-1&encounterId=encounter-1",
    );
  });

  it("uses the plural label and the empty-character line, and offers no self-link on the landing", () => {
    const { rerender } = render(
      <PlayerCampaignHomeSummary
        state={{
          record: record({
            characters: [
              { id: "character-1", name: "Aldric" },
              { id: "character-2", name: "Brenna" },
            ],
            resume: { tab: "campaign" },
          }),
          status: "ready",
        }}
      />,
    );

    expect(screen.getByText("Your characters")).toBeVisible();
    expect(screen.getByText("Aldric, Brenna")).toBeVisible();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();

    rerender(
      <PlayerCampaignHomeSummary
        state={{ record: record({ characters: [], resume: { tab: "campaign" } }), status: "ready" }}
      />,
    );
    expect(screen.getByText("No controlled character is currently available.")).toBeVisible();
  });

  it("labels the Encounter and Scenario resume targets", () => {
    for (const [tab, label] of [
      ["encounter", "Continue encounter"],
      ["scenario", "Continue scenario"],
    ] as const) {
      const { unmount } = render(
        <PlayerCampaignHomeSummary
          state={{
            record: record({
              resume: { encounterId: "encounter-1", scenarioId: "scenario-1", tab },
            }),
            status: "ready",
          }}
        />,
      );
      expect(screen.getByRole("link", { name: label })).toBeVisible();
      unmount();
    }
  });

  it("renders nothing while loading or when no record names this Campaign, and says so on failure", () => {
    const { container, rerender } = render(
      <PlayerCampaignHomeSummary state={{ status: "loading" }} />,
    );
    expect(container).toBeEmptyDOMElement();

    rerender(<PlayerCampaignHomeSummary state={{ record: undefined, status: "ready" }} />);
    expect(container).toBeEmptyDOMElement();

    rerender(<PlayerCampaignHomeSummary state={{ status: "unavailable" }} />);
    expect(screen.getByRole("status")).toHaveTextContent("could not be loaded");
  });
});

describe("buildPlayerScenarioContext", () => {
  it("maps each Scenario to the Characters played there and its current Encounter, and is empty before the record loads", () => {
    expect(buildPlayerScenarioContext({ record: record(), status: "ready" })).toEqual({
      "scenario-1": { characters: ["Aldric"], encounterTitle: "Courtyard" },
    });
    expect(buildPlayerScenarioContext({ status: "loading" })).toEqual({});
    expect(buildPlayerScenarioContext({ record: undefined, status: "ready" })).toEqual({});
  });
});

describe("usePlayerCampaignHome", () => {
  beforeEach(() => {
    mocks.loadPlayerCampaignHome.mockReset();
  });

  function Probe({ enabled }: { enabled: boolean }) {
    const state: PlayerCampaignHomeState = usePlayerCampaignHome({
      campaignId: "campaign-1",
      enabled,
    });
    return (
      <div data-testid="state">
        {state.status === "ready" ? (state.record?.campaign.name ?? "none") : state.status}
      </div>
    );
  }

  it("requests the projection only while enabled and selects this Campaign's record", async () => {
    mocks.loadPlayerCampaignHome.mockResolvedValue([
      { ...record(), campaign: { ...campaign, id: "other", name: "Elsewhere" } },
      record(),
    ]);

    const { rerender } = render(<Probe enabled={false} />);
    expect(mocks.loadPlayerCampaignHome).not.toHaveBeenCalled();

    rerender(<Probe enabled />);
    await waitFor(() => expect(screen.getByTestId("state")).toHaveTextContent("The Lost Seal"));
    expect(mocks.loadPlayerCampaignHome).toHaveBeenCalledTimes(1);
  });

  it("reports a failed load as unavailable", async () => {
    mocks.loadPlayerCampaignHome.mockRejectedValue(new Error("boom"));
    render(<Probe enabled />);
    await waitFor(() => expect(screen.getByTestId("state")).toHaveTextContent("unavailable"));
  });
});
