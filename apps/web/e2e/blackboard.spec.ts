import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const API_URL = process.env.PLAYWRIGHT_API_URL ?? "http://localhost:4000";
const WEB_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const BLACKBOARD_HEADERS = {
  origin: WEB_URL,
  "x-glantri-blackboard-mutation": "1",
};
const ARTIFACT_HEADERS = {
  origin: WEB_URL,
  "x-glantri-artifact-mutation": "1",
};

function loadCharacterIds(): { characterId: string; nonHolderCharacterId: string } {
  return JSON.parse(fs.readFileSync(path.join(__dirname, "test-state.json"), "utf8")) as {
    characterId: string;
    nonHolderCharacterId: string;
  };
}

test.describe("Campaign Blackboard shared-reference workspace", () => {
  test.use({ storageState: "e2e/.auth/gm.json" });

  test("keeps one shared board across GM and two players, reload, correction, and removal", async ({
    browser,
    page,
  }) => {
    test.setTimeout(60_000);
    const suffix = Date.now();
    const campaignResponse = await page.request.post(`${API_URL}/campaigns`, {
      data: { name: `Blackboard campaign ${suffix}`, status: "active" },
    });
    expect(campaignResponse.status()).toBe(200);
    const campaignId = ((await campaignResponse.json()) as { campaign: { id: string } }).campaign
      .id;
    const { characterId, nonHolderCharacterId } = loadCharacterIds();

    for (const sourceId of [characterId, nonHolderCharacterId]) {
      const rosterResponse = await page.request.post(`${API_URL}/campaigns/${campaignId}/roster`, {
        data: { category: "pc", sourceId, sourceType: "character" },
      });
      expect(rosterResponse.status()).toBe(200);
    }

    const playerContext = await browser.newContext({
      storageState: path.resolve(__dirname, ".auth/player.json"),
    });
    const otherPlayerContext = await browser.newContext({
      storageState: path.resolve(__dirname, ".auth/non-holder.json"),
    });
    const unauthorizedContext = await browser.newContext({
      storageState: path.resolve(__dirname, ".auth/unrelated.json"),
    });

    const clueTitle = `Bell signal ${suffix}`;
    const clueFact = "The bronze bell rings twice before the passage opens.";
    const clueResponse = await playerContext.request.post(
      `${API_URL}/campaigns/${campaignId}/blackboard/entries`,
      {
        data: { category: "clue_fact", fact: clueFact, title: clueTitle },
        headers: BLACKBOARD_HEADERS,
      },
    );
    expect(clueResponse.status()).toBe(201);
    const clue = (await clueResponse.json()) as { entry: { entryVersion: number; id: string } };

    const documentTitle = `Intercepted letter ${suffix}`;
    const documentResponse = await page.request.post(
      `${API_URL}/campaigns/${campaignId}/blackboard/entries`,
      {
        data: {
          category: "document_text",
          documentText: "Meet beneath the western arch after dusk.",
          title: documentTitle,
        },
        headers: BLACKBOARD_HEADERS,
      },
    );
    expect(documentResponse.status()).toBe(201);

    const recapTitle = `Last session ${suffix}`;
    const recapResponse = await page.request.post(
      `${API_URL}/campaigns/${campaignId}/blackboard/entries`,
      {
        data: {
          category: "recap",
          recapText: "The group recovered the seal and returned safely.",
          title: recapTitle,
        },
        headers: BLACKBOARD_HEADERS,
      },
    );
    expect(recapResponse.status()).toBe(201);

    const artifactStorageAvailable =
      process.env.CI !== "true" || process.env.ARTIFACT_E2E_STORAGE_ENABLED === "1";
    const mapTitle = artifactStorageAvailable ? `Hill route ${suffix}` : undefined;
    if (mapTitle) {
      const mapUploadResponse = await page.request.post(
        `${API_URL}/campaigns/${campaignId}/artifacts`,
        {
          headers: ARTIFACT_HEADERS,
          multipart: {
            metadata: JSON.stringify({
              altText: "A hand-drawn route from the mill to the hill caves",
              artifactKind: "map",
              title: mapTitle,
            }),
            file: {
              buffer: fs.readFileSync(
                path.resolve(__dirname, "../public/images/GrinulGrimbrew.jpeg"),
              ),
              mimeType: "image/jpeg",
              name: "blackboard-route.jpeg",
            },
          },
        },
      );
      expect(mapUploadResponse.status()).toBe(201);
      const uploadedMap = (await mapUploadResponse.json()) as {
        artifact: { id: string; metadataVersion: number };
      };
      const publishMapResponse = await page.request.put(
        `${API_URL}/campaigns/${campaignId}/artifacts/${uploadedMap.artifact.id}/audience`,
        {
          data: {
            audience: "campaign",
            expectedMetadataVersion: uploadedMap.artifact.metadataVersion,
          },
          headers: ARTIFACT_HEADERS,
        },
      );
      expect(publishMapResponse.status()).toBe(200);
      const mapResponse = await page.request.post(
        `${API_URL}/campaigns/${campaignId}/blackboard/entries`,
        {
          data: {
            caption: "The safe route avoids the watchtower.",
            category: "image_map",
            sourceArtifactId: uploadedMap.artifact.id,
            title: mapTitle,
          },
          headers: BLACKBOARD_HEADERS,
        },
      );
      expect(mapResponse.status()).toBe(201);
    }

    const pinResponse = await playerContext.request.post(
      `${API_URL}/campaigns/${campaignId}/blackboard/placements`,
      {
        data: {
          entryId: clue.entry.id,
          expectedLayoutVersion: 0,
          height: 180,
          layer: 1,
          width: 260,
          x: 0,
          y: 0,
        },
        headers: BLACKBOARD_HEADERS,
      },
    );
    expect(pinResponse.status()).toBe(200);

    const [gmBoard, playerBoard, otherPlayerBoard] = await Promise.all([
      page.request.get(`${API_URL}/campaigns/${campaignId}/blackboard`),
      playerContext.request.get(`${API_URL}/campaigns/${campaignId}/blackboard`),
      otherPlayerContext.request.get(`${API_URL}/campaigns/${campaignId}/blackboard`),
    ]);
    expect(gmBoard.status()).toBe(200);
    const gmBoardBytes = await gmBoard.text();
    expect(await playerBoard.text()).toBe(gmBoardBytes);
    expect(await otherPlayerBoard.text()).toBe(gmBoardBytes);

    await page.goto(`${WEB_URL}/campaigns/${campaignId}?tab=blackboard`);
    await expect(page.getByRole("heading", { name: "Blackboard" })).toBeVisible();
    await expect(page.getByText(clueTitle, { exact: true }).first()).toBeVisible();
    await expect(page.getByText(documentTitle, { exact: true })).toBeVisible();
    if (mapTitle) await expect(page.getByText(mapTitle, { exact: true })).toBeVisible();
    await expect(page.getByText(recapTitle, { exact: true })).toBeVisible();
    await expect(page.getByText(/unitKey|grant stream|storage key|digest/i)).toHaveCount(0);

    const playerPage = await playerContext.newPage();
    await playerPage.setViewportSize({ height: 760, width: 360 });
    await playerPage.goto(`${WEB_URL}/campaigns/${campaignId}?tab=blackboard`);
    await playerPage.getByRole("button", { name: `Open ${clueTitle}` }).click();
    await expect(playerPage.getByRole("heading", { name: clueTitle })).toBeFocused();
    await expect(
      playerPage.getByRole("button", { name: "Back to shared catalogue" }),
    ).toBeVisible();
    expect(
      await playerPage
        .locator("html")
        .evaluate((element) => element.scrollWidth <= element.clientWidth),
    ).toBe(true);

    await page.getByRole("button", { name: `Open ${clueTitle}` }).click();
    await page.getByRole("button", { name: "Correct this entry" }).click();
    await page.getByLabel("Clue or fact").fill("The bronze bell now rings three times.");
    await page.getByRole("button", { name: "Share correction" }).click();
    await expect(page.getByRole("status")).toContainText("Correction shared");
    await page.reload();
    await page.getByRole("button", { name: `Open ${clueTitle}` }).click();
    await expect(page.getByText("The bronze bell now rings three times.").last()).toBeVisible();
    await page.getByRole("button", { name: "History" }).click();
    await expect(page.getByRole("region", { name: "Reference history" })).toContainText(clueFact);

    const otherPlayerPage = await otherPlayerContext.newPage();
    await otherPlayerPage.goto(`${WEB_URL}/campaigns/${campaignId}?tab=blackboard`);
    await otherPlayerPage.getByRole("button").filter({ hasText: documentTitle }).click();
    await otherPlayerPage.getByRole("button", { name: "Correct this entry" }).click();
    await otherPlayerPage.getByLabel("Document text").fill("This must not be accepted.");
    await otherPlayerPage.getByRole("button", { name: "Share correction" }).click();
    await expect(otherPlayerPage.getByText(/Nothing was changed/)).toBeVisible();

    await playerPage.reload();
    await playerPage.getByRole("button", { name: `Open ${clueTitle}` }).click();
    await playerPage.getByRole("button", { name: "Remove this entry" }).click();
    await playerPage
      .getByRole("alertdialog", { name: "Remove reference" })
      .getByRole("button", { name: "Remove reference" })
      .click();
    await expect(playerPage.getByRole("heading", { name: "Removed reference" })).toBeVisible();
    await expect(playerPage.getByText(clueFact)).toHaveCount(0);
    await expect(playerPage.getByText("The bronze bell now rings three times.")).toHaveCount(0);

    const unauthorized = await unauthorizedContext.request.get(
      `${API_URL}/campaigns/${campaignId}/blackboard`,
    );
    expect(unauthorized.status()).toBe(404);
    expect(await unauthorized.json()).toEqual({ error: "Blackboard unavailable." });

    await unauthorizedContext.close();
    await otherPlayerContext.close();
    await playerContext.close();
  });
});
