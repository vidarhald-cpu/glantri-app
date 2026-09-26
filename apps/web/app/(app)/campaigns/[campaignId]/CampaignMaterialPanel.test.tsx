// @vitest-environment happy-dom

import "@testing-library/jest-dom/vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Scenario } from "@glantri/domain";

const mocks = vi.hoisted(() => ({
  artifacts: vi.fn(),
  items: vi.fn(),
  maps: vi.fn(),
  map: vi.fn(),
}));

vi.mock("@/features/artifacts", () => ({
  ArtifactPanel: ({ focusedArtifactId }: { focusedArtifactId?: string }) => (
    <div>Artifact controls for {focusedArtifactId}</div>
  ),
}));
vi.mock("@/lib/api/artifactClient", () => ({ loadArtifacts: mocks.artifacts }));
vi.mock("@/lib/api/equipmentClient", () => ({ loadCampaignItems: mocks.items }));
vi.mock("@/lib/api/mapClient", () => ({
  loadCampaignMaps: mocks.maps,
  loadCampaignMap: mocks.map,
}));

import { CampaignMaterialPanel } from "./CampaignMaterialPanel";
import {
  artifactEntriesFromPayload,
  itemEntriesFromPayload,
  mapEntriesFromPayload,
} from "./materialSources";

const scenarios = [
  {
    id: "scenario-1",
    name: "The northern pass",
    campaignId: "campaign-1",
    liveState: {
      session: {
        availableObjects: [{ sourceKind: "campaign_item", sourceId: "item-2" }],
      },
    },
  },
] as Scenario[];

const artifactPayload = {
  mode: "gm" as const,
  artifacts: [
    {
      id: "artifact-1",
      title: "Public handout",
      description: "A road notice",
      artifactKind: "handout" as const,
      audience: "campaign" as const,
      lifecycle: "active" as const,
      storageState: "ready" as const,
    },
    {
      id: "artifact-2",
      title: "Secret portrait",
      description: "The captain",
      artifactKind: "portrait" as const,
      audience: "gm_private" as const,
      lifecycle: "archived" as const,
      storageState: "ready" as const,
    },
  ],
  references: [
    { id: "ref-1", artifactId: "artifact-2", scenarioId: "scenario-1", state: "attached" as const },
  ],
};

const itemPayload = {
  characters: [],
  gmNotesById: { "item-1": "Never reveal" },
  state: {
    itemsById: {
      "item-1": {
        id: "item-1",
        displayName: "GM-private key",
        holderCharacterId: null,
        notes: "A hidden key",
        templateId: null,
        category: null,
      },
      "item-2": {
        id: "item-2",
        displayName: "Bronze blade",
        holderCharacterId: null,
        templateId: null,
        category: null,
      },
    },
    templatesById: {},
  },
};

const mapPayload = {
  mode: "gm" as const,
  maps: [
    {
      id: "map-1",
      name: "Mountain map",
      description: "A mountain region",
      role: "area" as const,
      access: "players" as const,
      updatedAt: "2026-09-26T00:00:00.000Z",
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.artifacts.mockResolvedValue(artifactPayload);
  mocks.items.mockResolvedValue(itemPayload);
  mocks.maps.mockResolvedValue(mapPayload);
  mocks.map.mockResolvedValue({ mode: "gm", map: { background: undefined } });
});

describe("Campaign Material", () => {
  it("composes the three GM API payloads into one searchable list", async () => {
    const user = userEvent.setup();
    render(<CampaignMaterialPanel campaignId="campaign-1" scenarios={scenarios} />);
    const list = await screen.findByLabelText("Material list");
    expect(within(list).getAllByRole("button")).toHaveLength(5);

    await user.type(screen.getByRole("searchbox", { name: "Search material" }), "mountain");
    expect(within(list).getAllByRole("button")).toHaveLength(1);
    expect(within(list).getByRole("button", { name: /Mountain map/ })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Search: mountain/ }));
    expect(within(list).getAllByRole("button")).toHaveLength(5);

    await user.selectOptions(screen.getByRole("combobox", { name: "View" }), "scenario");
    expect(within(list).getAllByRole("button")).toHaveLength(2);
    expect(within(list).getByRole("button", { name: /Secret portrait/ })).toBeInTheDocument();
    expect(within(list).getByRole("button", { name: /Bronze blade/ })).toBeInTheDocument();

    await user.selectOptions(screen.getByRole("combobox", { name: "View" }), "unattached");
    expect(within(list).getAllByRole("button")).toHaveLength(3);
    expect(within(list).getByRole("button", { name: /GM-private key/ })).toBeInTheDocument();
  });

  it("filters Shared Artifacts only from resolved Artifact audience in the payload", async () => {
    const context = { campaignId: "campaign-1", scenarios, onMaterialChanged: () => {} };
    const entries = [
      ...artifactEntriesFromPayload(artifactPayload as never, context),
      ...itemEntriesFromPayload(itemPayload as never, context),
      ...mapEntriesFromPayload(mapPayload, context),
    ];
    expect(
      entries.filter((entry) => entry.views.includes("shared-artifacts")).map((entry) => entry.key),
    ).toEqual(["artifact:artifact-1"]);
    expect(entries.find((entry) => entry.key === "artifact:artifact-2")?.views).not.toContain(
      "shared-artifacts",
    );
    expect(entries.find((entry) => entry.key === "item:item-1")?.views).not.toContain(
      "shared-artifacts",
    );
    expect(entries.find((entry) => entry.key === "map:map-1")?.views).not.toContain(
      "shared-artifacts",
    );
    const unavailableCampaignArtifacts = artifactEntriesFromPayload(
      {
        ...artifactPayload,
        artifacts: [
          { ...artifactPayload.artifacts[0], id: "pending", storageState: "pending" },
          { ...artifactPayload.artifacts[0], id: "deleted", lifecycle: "deleted" },
        ],
      } as never,
      context,
    );
    expect(
      unavailableCampaignArtifacts.every((entry) => !entry.views.includes("shared-artifacts")),
    ).toBe(true);

    const user = userEvent.setup();
    render(<CampaignMaterialPanel campaignId="campaign-1" scenarios={scenarios} />);
    const list = await screen.findByLabelText("Material list");
    await user.selectOptions(screen.getByRole("combobox", { name: "View" }), "shared-artifacts");
    expect(within(list).getAllByRole("button")).toHaveLength(1);
    expect(within(list).getByRole("button", { name: /Public handout/ })).toBeInTheDocument();
    expect(
      screen.getByText(/Item and Map player knowledge is outside this view/),
    ).toBeInTheDocument();
  });

  it("keeps category a removable filter and opens canonical domain editors", async () => {
    const user = userEvent.setup();
    render(<CampaignMaterialPanel campaignId="campaign-1" scenarios={scenarios} />);
    const list = await screen.findByLabelText("Material list");
    await user.click(screen.getByText("Filters"));
    await user.selectOptions(screen.getByRole("combobox", { name: "Category" }), "item");
    expect(within(list).getAllByRole("button")).toHaveLength(2);
    expect(screen.getByRole("link", { name: "Open Item editor" })).toHaveAttribute(
      "href",
      "/campaigns/campaign-1?tab=items&itemId=item-2",
    );
    await user.click(screen.getByRole("button", { name: /Category: Items/ }));
    expect(within(list).getAllByRole("button")).toHaveLength(5);

    await user.selectOptions(
      screen.getByRole("combobox", { name: "Artifact access" }),
      "gm_private",
    );
    expect(within(list).getAllByRole("button")).toHaveLength(1);
    expect(within(list).getByRole("button", { name: /Secret portrait/ })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Artifact access: GM only/ }));
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Artifact lifecycle" }),
      "active",
    );
    expect(within(list).getAllByRole("button")).toHaveLength(1);
    expect(within(list).getByRole("button", { name: /Public handout/ })).toBeInTheDocument();
  });
});
