import fs from "node:fs";
import path from "node:path";

import { expect, test, type APIRequestContext, type APIResponse } from "@playwright/test";

const API_URL = process.env.PLAYWRIGHT_API_URL ?? "http://localhost:4000";
const MAP_MUTATION_HEADERS = {
  origin: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
  "x-glantri-map-mutation": "1",
};

interface SmokeTestState {
  b2CampaignId: string;
  characterId: string;
}

function loadTestState(): SmokeTestState {
  return JSON.parse(
    fs.readFileSync(path.join(__dirname, "test-state.json"), "utf8"),
  ) as SmokeTestState;
}

async function json<T>(response: APIResponse): Promise<T> {
  if (!response.ok()) throw new Error(`${response.status()} ${await response.text()}`);
  return response.json() as Promise<T>;
}

async function createMap(request: APIRequestContext, campaignId: string, name: string) {
  return json<{ map: { id: string; version: number } }>(
    await request.post(`${API_URL}/campaigns/${campaignId}/maps`, {
      data: { access: "gm_only", backgroundArtifactId: null, description: "", name, role: "area" },
      headers: MAP_MUTATION_HEADERS,
    }),
  );
}

test.describe("Map Workspace V1", () => {
  test.use({ storageState: "e2e/.auth/gm.json" });

  test("authors at narrow width and projects a private-safe linked Map to a player", async ({
    browser,
    page,
  }) => {
    const suffix = Date.now();
    const { b2CampaignId: campaignId } = loadTestState();
    const activation = await page.request.post(`${API_URL}/campaigns/${campaignId}/activate`);
    expect([200, 400]).toContain(activation.status());

    const mapA = (await createMap(page.request, campaignId, `Borderlands ${suffix}`)).map;
    const mapB = (await createMap(page.request, campaignId, `Old City ${suffix}`)).map;
    for (const map of [mapB]) {
      expect(
        (
          await page.request.put(`${API_URL}/campaigns/${campaignId}/maps/${map.id}`, {
            data: {
              access: "players",
              backgroundArtifactId: null,
              description: "A linked destination",
              expectedVersion: map.version,
              layers: [],
              name: `Old City ${suffix}`,
              role: "area",
            },
            headers: MAP_MUTATION_HEADERS,
          })
        ).ok(),
      ).toBe(true);
    }
    const updatedA = await page.request.put(`${API_URL}/campaigns/${campaignId}/maps/${mapA.id}`, {
      data: {
        access: "players",
        backgroundArtifactId: null,
        description: "The road west",
        expectedVersion: mapA.version,
        layers: [
          {
            id: `public-${suffix}`,
            markers: [
              {
                description: "Open the linked city Map",
                destinationMapId: mapB.id,
                entityLabelSnapshot: null,
                entityReferenceId: null,
                entityReferenceType: null,
                id: `link-${suffix}`,
                kind: "map_link",
                label: "City road",
                presentation: "↗",
                sortOrder: 0,
                visibility: "inherit",
                x: 0.4,
                y: 0.4,
              },
            ],
            name: "Known roads",
            sortOrder: 0,
            visibility: "player_visible",
          },
          {
            id: `secret-${suffix}`,
            markers: [
              {
                description: "Revealed without exposing its private Layer",
                destinationMapId: null,
                entityLabelSnapshot: null,
                entityReferenceId: null,
                entityReferenceType: null,
                id: `ruin-${suffix}`,
                kind: "annotation",
                label: "Old ruin",
                presentation: "R",
                sortOrder: 0,
                visibility: "player_visible",
                x: 0.7,
                y: 0.8,
              },
            ],
            name: "GM Secrets",
            sortOrder: 1,
            visibility: "gm_only",
          },
        ],
        name: `Borderlands ${suffix}`,
        role: "world_region",
      },
      headers: MAP_MUTATION_HEADERS,
    });
    expect(updatedA.ok(), await updatedA.text()).toBe(true);

    await page.setViewportSize({ height: 844, width: 390 });
    await page.goto(`/campaigns/${campaignId}?tab=maps&mapId=${mapA.id}`);
    await expect(page.getByRole("heading", { name: "Maps" })).toBeVisible();
    await page.getByRole("button", { name: "City road, open linked Map" }).click();
    await page.getByRole("button", { name: "Left" }).click();
    await page.getByRole("button", { name: "Save Map" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Map saved." })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);

    await page.setViewportSize({ height: 900, width: 1280 });
    await page.reload();
    await expect(page.getByRole("button", { name: "City road, open linked Map" })).toBeVisible();

    const player = await browser.newContext({ storageState: "e2e/.auth/player.json" });
    const playerPage = await player.newPage();
    await playerPage.goto(`/campaigns/${campaignId}?tab=maps&mapId=${mapA.id}`);
    await expect(playerPage.getByText("Known roads", { exact: true })).toBeVisible();
    await expect(playerPage.getByText("Old ruin", { exact: true })).toBeVisible();
    await expect(playerPage.getByText("GM Secrets", { exact: true })).toHaveCount(0);
    await expect(playerPage.getByRole("button", { name: "Save Map" })).toHaveCount(0);
    await playerPage.getByRole("button", { name: "City road, open linked Map" }).click();
    await expect(playerPage).toHaveURL(new RegExp(`mapId=${mapB.id}`));
    await expect(playerPage.getByText(`Old City ${suffix}`, { exact: true }).first()).toBeVisible();
    await player.close();

    const unrelated = await browser.newContext({ storageState: "e2e/.auth/unrelated.json" });
    const denied = await unrelated.request.get(
      `${API_URL}/campaigns/${campaignId}/maps/${mapA.id}`,
    );
    expect(denied.status()).toBe(404);
    expect(await denied.text()).not.toContain("GM Secrets");
    await unrelated.close();
  });
});
