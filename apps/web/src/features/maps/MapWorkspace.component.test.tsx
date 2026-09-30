// @vitest-environment happy-dom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  load: vi.fn(),
  list: vi.fn(),
  options: vi.fn(),
  save: vi.fn(),
}));

vi.mock("@/lib/api/mapClient", () => ({
  campaignMapBackgroundUrl: (_campaignId: string, mapId: string) => `/map-background/${mapId}`,
  createCampaignMap: mocks.create,
  loadCampaignMap: mocks.load,
  loadCampaignMapAuthoringOptions: mocks.options,
  loadCampaignMaps: mocks.list,
  saveCampaignMap: mocks.save,
}));

import { MapWorkspace } from "./MapWorkspace";

const summary = {
  access: "players" as const,
  description: "Border road",
  id: "map-1",
  name: "Shared Border",
  role: "area" as const,
  updatedAt: "2026-09-17T10:00:00.000Z",
};

const destinationSummary = {
  ...summary,
  id: "map-2",
  name: "Old City",
};

const gmMap = {
  access: "players" as const,
  backgroundArtifactId: null,
  campaignId: "campaign-1",
  createdAt: "2026-09-17T10:00:00.000Z",
  description: "Border road",
  id: "map-1",
  layers: [
    {
      id: "layer-1",
      markers: [
        {
          description: "",
          destinationMapId: null,
          entityLabelSnapshot: null,
          entityReferenceId: null,
          entityReferenceType: null,
          id: "marker-1",
          kind: "annotation" as const,
          label: "Old Gate",
          presentation: "G",
          sortOrder: 0,
          visibility: "inherit" as const,
          x: 0.5,
          y: 0.5,
        },
      ],
      name: "Places",
      sortOrder: 0,
      visibility: "player_visible" as const,
    },
  ],
  name: "Shared Border",
  role: "area" as const,
  updatedAt: "2026-09-17T10:00:00.000Z",
  version: 2,
};

const linkedGmMap = {
  ...gmMap,
  layers: [
    {
      ...gmMap.layers[0],
      markers: [
        {
          ...gmMap.layers[0].markers[0],
          destinationMapId: "map-2",
          id: "link-1",
          kind: "map_link" as const,
          label: "City road",
          presentation: "↗",
        },
      ],
    },
  ],
};

describe("MapWorkspace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.list.mockResolvedValue({ maps: [summary], mode: "gm" });
    mocks.options.mockResolvedValue({
      artifacts: [],
      entities: [],
      maps: [summary, destinationSummary],
    });
    mocks.load.mockResolvedValue({ map: gmMap, mode: "gm" });
    mocks.save.mockResolvedValue({ ...gmMap, version: 3 });
  });

  it("renders only player controls and navigates a shared Map link", async () => {
    const routeChange = vi.fn();
    mocks.list.mockResolvedValue({ maps: [summary], mode: "player" });
    mocks.load.mockResolvedValue({
      mode: "player",
      map: {
        description: "Border road",
        id: "map-1",
        layers: [
          {
            id: "public-layer",
            markers: [
              {
                description: "To the city",
                destinationMapId: "map-2",
                id: "link-1",
                kind: "map_link",
                label: "City road",
                presentation: "↗",
                sortOrder: 0,
                x: 0.4,
                y: 0.4,
              },
            ],
            name: "Known roads",
            sortOrder: 0,
          },
        ],
        name: "Shared Border",
        revealedMarkers: [
          {
            description: "Revealed without its private Layer",
            id: "revealed-1",
            kind: "annotation",
            label: "Old ruin",
            presentation: "R",
            sortOrder: 0,
            x: 0.7,
            y: 0.8,
          },
        ],
        role: "area",
      },
    });

    render(
      <MapWorkspace
        campaignId="campaign-1"
        initialMapId="map-1"
        isGameMaster={false}
        onMapRouteChange={routeChange}
      />,
    );

    expect(await screen.findByText("Known roads")).toBeInTheDocument();
    expect(screen.getByText("Old ruin")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save Map" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("New Map name")).not.toBeInTheDocument();
    await waitFor(() => expect(routeChange).toHaveBeenCalledWith("map-1", "replace"));
    await userEvent.click(screen.getByRole("button", { name: "City road, open linked Map" }));
    await waitFor(() => expect(mocks.load).toHaveBeenCalledWith("campaign-1", "map-2"));
    await waitFor(() => expect(routeChange).toHaveBeenLastCalledWith("map-2", "push"));
  });

  it("keeps GM keyboard selection distinct from linked-Map navigation", async () => {
    const routeChange = vi.fn();
    mocks.list.mockResolvedValue({ maps: [summary, destinationSummary], mode: "gm" });
    mocks.load.mockImplementation((_campaignId: string, mapId: string) =>
      Promise.resolve({
        map:
          mapId === "map-2" ? { ...gmMap, id: "map-2", layers: [], name: "Old City" } : linkedGmMap,
        mode: "gm",
      }),
    );

    render(
      <MapWorkspace
        campaignId="campaign-1"
        initialMapId="map-1"
        isGameMaster
        onMapRouteChange={routeChange}
      />,
    );

    const marker = await screen.findByRole("button", {
      name: "City road, open linked Map",
    });
    marker.focus();
    await userEvent.keyboard("{Enter}");

    expect(marker).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("Marker label")).toHaveValue("City road");
    expect(routeChange).not.toHaveBeenCalledWith("map-2", "push");

    const openLink = screen.getByRole("button", { name: "Open linked Map" });
    openLink.focus();
    await userEvent.keyboard("{Enter}");

    await waitFor(() => expect(mocks.load).toHaveBeenCalledWith("campaign-1", "map-2"));
    await waitFor(() => expect(routeChange).toHaveBeenLastCalledWith("map-2", "push"));
  });

  it("supports keyboard-accessible normalized reposition and one optimistic aggregate save", async () => {
    render(
      <MapWorkspace
        campaignId="campaign-1"
        initialMapId="map-1"
        isGameMaster
        onMapRouteChange={vi.fn()}
      />,
    );

    await userEvent.click(await screen.findByRole("button", { name: "Old Gate" }));
    await userEvent.click(screen.getByRole("button", { name: "Left" }));
    await userEvent.click(screen.getByRole("button", { name: "Save Map" }));

    await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(1));
    expect(mocks.save.mock.calls[0]?.[0]).toMatchObject({
      campaignId: "campaign-1",
      mapId: "map-1",
      mutation: {
        expectedVersion: 2,
        layers: [{ markers: [{ id: "marker-1", x: 0.45, y: 0.5 }] }],
      },
    });
  });

  it.each([
    { height: 1600, label: "a tall portrait plan", ratio: 1000 / 1600, width: 1000 },
    { height: 1000, label: "a square battle mat", ratio: 1, width: 1000 },
    { height: 600, label: "a wide regional chart", ratio: 2400 / 600, width: 2400 },
  ])("shows $label at its own proportions instead of stretching it", async (prepared) => {
    mocks.load.mockResolvedValue({
      map: {
        ...gmMap,
        background: {
          altText: "A prepared plan",
          artifactId: "artifact-1",
          available: true,
          playerCanView: true,
          title: "Old Gatehouse",
        },
        backgroundArtifactId: "artifact-1",
      },
      mode: "gm",
    });

    render(
      <MapWorkspace
        campaignId="campaign-1"
        initialMapId="map-1"
        isGameMaster
        onMapRouteChange={vi.fn()}
      />,
    );

    const image = await screen.findByAltText("A prepared plan");
    const canvas = screen.getByTestId("map-canvas");
    // The style value may be serialized as "a / b" or as a single number.
    const canvasRatio = () => {
      const [width, height = "1"] = canvas.style.aspectRatio.split("/");
      return Number(width) / Number(height);
    };
    // Until the prepared image reports its own proportions nothing is stretched.
    expect(canvasRatio()).toBeCloseTo(16 / 9);
    expect(image.style.objectFit).toBe("contain");

    Object.defineProperty(image, "naturalWidth", { configurable: true, value: prepared.width });
    Object.defineProperty(image, "naturalHeight", { configurable: true, value: prepared.height });
    fireEvent.load(image);

    await waitFor(() => expect(canvasRatio()).toBeCloseTo(prepared.ratio));
    // The canvas now matches the image exactly, so filling it cannot distort
    // the image and the normalized marker frame still covers what is shown.
    expect(image.style.objectFit).toBe("fill");
    expect(canvas.style.minHeight).toBe("");
    expect(screen.getByRole("button", { name: "Old Gate" })).toBeInTheDocument();
  });
});
