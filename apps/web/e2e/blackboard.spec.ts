import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { createCharacterForE2e } from "./character-fixture";

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

function filesBelow(root: string): string[] {
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const resolved = path.join(root, entry.name);
    return entry.isDirectory() ? filesBelow(resolved) : [resolved];
  });
}

test.describe("Campaign Blackboard shared-reference workspace", () => {
  test.use({ storageState: "e2e/.auth/gm.json" });

  test("keeps one shared board across GM and two players, reload, correction, and removal", async ({
    browser,
    page,
  }) => {
    test.setTimeout(90_000);
    const suffix = Date.now();
    const campaignResponse = await page.request.post(`${API_URL}/campaigns`, {
      data: { name: `Blackboard campaign ${suffix}`, status: "active" },
    });
    expect(campaignResponse.status()).toBe(200);
    const campaignId = ((await campaignResponse.json()) as { campaign: { id: string } }).campaign
      .id;
    const characterId = `blackboard-player-${suffix}`;
    const nonHolderCharacterId = `blackboard-other-${suffix}`;
    const playerContext = await browser.newContext({
      storageState: path.resolve(__dirname, ".auth/player.json"),
    });
    const otherPlayerContext = await browser.newContext({
      storageState: path.resolve(__dirname, ".auth/non-holder.json"),
    });
    await createCharacterForE2e({
      apiUrl: API_URL,
      id: characterId,
      name: `Blackboard Player ${suffix}`,
      request: playerContext.request,
    });
    await createCharacterForE2e({
      apiUrl: API_URL,
      id: nonHolderCharacterId,
      name: `Blackboard Other ${suffix}`,
      request: otherPlayerContext.request,
    });

    for (const sourceId of [characterId, nonHolderCharacterId]) {
      const rosterResponse = await page.request.post(`${API_URL}/campaigns/${campaignId}/roster`, {
        data: { category: "pc", sourceId, sourceType: "character" },
      });
      expect(rosterResponse.status()).toBe(200);
    }

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
    const document = (await documentResponse.json()) as {
      entry: { entryVersion: number; id: string };
    };

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
    const recap = (await recapResponse.json()) as { entry: { id: string } };

    const artifactStorageAvailable =
      process.env.CI !== "true" || process.env.ARTIFACT_E2E_STORAGE_ENABLED === "1";
    const mapTitle = artifactStorageAvailable ? `Hill route ${suffix}` : undefined;
    let mapEntryId: string | undefined;
    let storedMapFile: string | undefined;
    if (mapTitle) {
      const artifactRoot = process.env.ARTIFACT_LOCAL_ROOT;
      expect(artifactRoot).toBeTruthy();
      const filesBeforeUpload = new Set(
        filesBelow(artifactRoot!).filter((file) => !file.endsWith(".withheld")),
      );
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
      const newStoredFiles = filesBelow(artifactRoot!).filter(
        (file) => !file.endsWith(".withheld") && !filesBeforeUpload.has(file),
      );
      expect(newStoredFiles).toHaveLength(1);
      storedMapFile = newStoredFiles[0]!;
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
      mapEntryId = ((await mapResponse.json()) as { entry: { id: string } }).entry.id;
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

    type Capabilities = {
      entries: Array<{ canCorrect: boolean; canRemove: boolean; entryId: string }>;
    };
    const [gmCapabilitiesResponse, playerCapabilitiesResponse, otherCapabilitiesResponse] =
      await Promise.all([
        page.request.get(`${API_URL}/campaigns/${campaignId}/blackboard/capabilities`),
        playerContext.request.get(`${API_URL}/campaigns/${campaignId}/blackboard/capabilities`),
        otherPlayerContext.request.get(
          `${API_URL}/campaigns/${campaignId}/blackboard/capabilities`,
        ),
      ]);
    const [gmCapabilities, playerCapabilities, otherCapabilities] = await Promise.all([
      gmCapabilitiesResponse.json() as Promise<Capabilities>,
      playerCapabilitiesResponse.json() as Promise<Capabilities>,
      otherCapabilitiesResponse.json() as Promise<Capabilities>,
    ]);
    const capabilityFor = (projection: Capabilities, entryId: string) =>
      projection.entries.find((entry) => entry.entryId === entryId);
    expect(capabilityFor(gmCapabilities, clue.entry.id)).toMatchObject({
      canCorrect: true,
      canRemove: true,
    });
    expect(capabilityFor(gmCapabilities, recap.entry.id)).toMatchObject({
      canCorrect: true,
      canRemove: true,
    });
    expect(capabilityFor(playerCapabilities, clue.entry.id)).toMatchObject({
      canCorrect: true,
      canRemove: true,
    });
    expect(capabilityFor(playerCapabilities, document.entry.id)).toMatchObject({
      canCorrect: false,
      canRemove: false,
    });
    expect(capabilityFor(otherCapabilities, clue.entry.id)).toMatchObject({
      canCorrect: false,
      canRemove: false,
    });
    if (mapEntryId) {
      expect(capabilityFor(otherCapabilities, mapEntryId)).toMatchObject({
        canCorrect: false,
        canRemove: false,
      });
    }
    expect(JSON.stringify(otherCapabilities)).not.toMatch(/owner|userId|displayName|storage/i);

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
    await playerPage.getByLabel("Search shared references").fill("bronze bell");
    await playerPage.getByRole("combobox", { name: "Kind", exact: true }).selectOption("clue_fact");
    await playerPage.getByRole("combobox", { name: "Board", exact: true }).selectOption("pinned");
    await playerPage.getByRole("button", { name: "Search", exact: true }).click();
    const searchResults = playerPage.getByRole("region", { name: "Blackboard search results" });
    await expect(searchResults.getByText("1 found")).toBeVisible();
    await searchResults.getByRole("button", { name: new RegExp(clueTitle) }).click();
    await expect(playerPage.getByRole("heading", { name: clueTitle })).toBeFocused();
    await expect(playerPage).toHaveURL(new RegExp(`entryId=${clue.entry.id}`));
    await playerPage.reload();
    await expect(playerPage.getByRole("heading", { name: clueTitle })).toBeFocused();
    await expect(playerPage.getByLabel("Search shared references")).toHaveValue("bronze bell");
    await expect(
      playerPage.getByRole("button", { name: "Back to shared catalogue" }),
    ).toBeVisible();
    expect(
      await playerPage
        .locator("html")
        .evaluate((element) => element.scrollWidth <= element.clientWidth),
    ).toBe(true);

    await page.getByRole("button").filter({ hasText: documentTitle }).click();
    await expect(page.getByRole("button", { name: "Correct this entry" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Remove this entry" })).toBeVisible();
    await page.getByRole("button").filter({ hasText: recapTitle }).click();
    await expect(page.getByRole("button", { name: "Correct this entry" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Remove this entry" })).toBeVisible();

    const playerCorrectTrigger = playerPage.getByRole("button", { name: "Correct this entry" });
    await expect(playerCorrectTrigger).toBeVisible();
    await playerCorrectTrigger.click();
    await expect(playerPage.getByRole("heading", { name: "Correct this reference" })).toBeFocused();
    await playerPage.getByRole("button", { name: "Cancel" }).click();
    await expect(playerCorrectTrigger).toBeFocused();
    await playerCorrectTrigger.click();
    await playerPage.getByLabel("Clue or fact").fill("The bronze bell now rings three times.");
    await playerPage.getByRole("button", { name: "Share correction" }).click();
    await expect(playerPage.getByText(/Correction shared/)).toBeVisible();
    await expect(playerPage.getByRole("heading", { name: clueTitle })).toBeFocused();
    await playerPage.reload();
    await expect(
      playerPage.getByText("The bronze bell now rings three times.").last(),
    ).toBeVisible();
    await playerPage.getByRole("button", { name: "History" }).click();
    await expect(playerPage.getByRole("region", { name: "Reference history" })).toContainText(
      clueFact,
    );

    const otherPlayerPage = await otherPlayerContext.newPage();
    await otherPlayerPage.goto(`${WEB_URL}/campaigns/${campaignId}?tab=blackboard`);
    const shareTrigger = otherPlayerPage.getByRole("button", { name: "Share a reference" });
    await shareTrigger.click();
    await expect(otherPlayerPage.getByRole("heading", { name: "Share a reference" })).toBeFocused();
    await otherPlayerPage.getByRole("button", { name: "Share reference" }).click();
    await expect(otherPlayerPage.getByLabel("Title")).toBeFocused();
    await expect(
      otherPlayerPage.getByRole("alert").filter({ hasText: "Give this reference a title" }),
    ).toBeVisible();
    await otherPlayerPage.getByRole("button", { name: "Cancel" }).click();
    await expect(shareTrigger).toBeFocused();
    await otherPlayerPage.getByRole("button").filter({ hasText: documentTitle }).click();
    await expect(otherPlayerPage.getByRole("button", { name: "Correct this entry" })).toHaveCount(
      0,
    );
    await expect(otherPlayerPage.getByRole("button", { name: "Remove this entry" })).toHaveCount(0);
    const deniedCorrection = await otherPlayerContext.request.post(
      `${API_URL}/campaigns/${campaignId}/blackboard/entries/${document.entry.id}/revisions`,
      {
        data: {
          category: "document_text",
          changeKind: "correction",
          documentText: "This must not be accepted.",
          expectedEntryVersion: document.entry.entryVersion,
          title: documentTitle,
        },
        headers: BLACKBOARD_HEADERS,
      },
    );
    expect(deniedCorrection.status()).toBe(404);
    const boardAfterDenied = await otherPlayerContext.request.get(
      `${API_URL}/campaigns/${campaignId}/blackboard`,
    );
    const playerBoardAfterCorrection = await playerContext.request.get(
      `${API_URL}/campaigns/${campaignId}/blackboard`,
    );
    expect(await boardAfterDenied.text()).toBe(await playerBoardAfterCorrection.text());

    if (mapTitle) {
      const storedFile = storedMapFile!;
      const withheldFile = `${storedFile}.withheld`;

      await page.getByRole("button").filter({ hasText: mapTitle }).click();
      const mapImage = page.getByRole("img", {
        name: "A hand-drawn route from the mill to the hill caves",
      });
      await expect(mapImage).toBeVisible();
      expect(
        await mapImage.evaluate((image: HTMLImageElement) => image.naturalWidth),
      ).toBeGreaterThan(0);

      await page.getByRole("link", { name: "Open focused Blackboard" }).click();
      await expect(page).toHaveURL(
        new RegExp(`/campaigns/${campaignId}/blackboard\\?entryId=${mapEntryId}`),
      );
      await expect(page.getByRole("heading", { name: mapTitle })).toBeVisible();
      await page.getByRole("button", { name: "Inspect Artifact" }).click();
      await expect(page).toHaveURL(/inspection=artifact/);
      const artifactViewport = page.getByRole("group", { name: "Pan and zoom Artifact" });
      await expect(artifactViewport).toBeVisible();
      await page.getByRole("button", { name: "Zoom in" }).click();
      await expect(page.getByText("Zoom 125%")).toBeVisible();
      await artifactViewport.press("ArrowRight");
      await expect(
        page.getByRole("img", {
          name: "A hand-drawn route from the mill to the hill caves",
        }),
      ).toHaveAttribute("style", /translate\(48px, 0px\) scale\(1.25\)/);
      const artifactBounds = await artifactViewport.boundingBox();
      expect(artifactBounds).not.toBeNull();
      const artifactImage = page.getByRole("img", {
        name: "A hand-drawn route from the mill to the hill caves",
      });
      const keyboardTransform = await artifactImage.getAttribute("style");
      await page.mouse.move(artifactBounds!.x + 120, artifactBounds!.y + 120);
      await page.mouse.down();
      await page.mouse.move(artifactBounds!.x + 152, artifactBounds!.y + 144);
      await page.mouse.up();
      await expect.poll(() => artifactImage.getAttribute("style")).not.toBe(keyboardTransform);
      await page.keyboard.press("Escape");
      await expect(page).not.toHaveURL(/inspection=artifact/);
      await expect(page.getByRole("heading", { name: mapTitle })).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page).toHaveURL(new RegExp(`/campaigns/${campaignId}\\?tab=blackboard`));

      const desktopViewport = page.viewportSize();
      await page.setViewportSize({ height: 844, width: 390 });
      await page.goto(
        `${WEB_URL}/campaigns/${campaignId}/blackboard?entryId=${mapEntryId}&inspection=artifact`,
      );
      await expect(artifactViewport).toBeVisible();
      expect(
        await page
          .locator("html")
          .evaluate((element) => element.scrollWidth <= element.clientWidth),
      ).toBe(true);
      await page.getByRole("button", { name: "Back to Blackboard" }).click();
      await expect(page.getByRole("heading", { name: mapTitle })).toBeVisible();
      await page.getByRole("button", { name: "Back to Campaign" }).click();
      await expect(page).toHaveURL(new RegExp(`/campaigns/${campaignId}\\?tab=blackboard`));
      if (desktopViewport) await page.setViewportSize(desktopViewport);
      await page.getByRole("button").filter({ hasText: mapTitle }).click();

      fs.renameSync(storedFile, withheldFile);
      let restored = false;
      try {
        await page.reload();
        await page.getByRole("button").filter({ hasText: mapTitle }).click();
        await expect(
          page.getByText("The shared visual could not be loaded right now."),
        ).toBeVisible();
        await expect(mapImage).toHaveCount(0);
        expect(await page.locator("body").innerText()).not.toMatch(
          /503|storage|provider|object key|filesystem|path|diagnostic/i,
        );

        fs.renameSync(withheldFile, storedFile);
        restored = true;
        await page.getByRole("button", { name: "Retry shared visual" }).click();
        await expect(mapImage).toBeVisible();
        expect(
          await mapImage.evaluate((image: HTMLImageElement) => image.naturalWidth),
        ).toBeGreaterThan(0);
      } finally {
        if (!restored && fs.existsSync(withheldFile)) fs.renameSync(withheldFile, storedFile);
      }
    }

    await playerPage.reload();
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
    const unauthorizedCapabilities = await unauthorizedContext.request.get(
      `${API_URL}/campaigns/${campaignId}/blackboard/capabilities`,
    );
    expect(unauthorizedCapabilities.status()).toBe(404);
    expect(await unauthorizedCapabilities.json()).toEqual({ error: "Blackboard unavailable." });
    if (mapEntryId && mapTitle) {
      const unauthorizedPage = await unauthorizedContext.newPage();
      await unauthorizedPage.goto(
        `${WEB_URL}/campaigns/${campaignId}/blackboard?entryId=${mapEntryId}&inspection=artifact`,
      );
      await expect(unauthorizedPage.getByText(/Blackboard could not be loaded/)).toBeVisible();
      await expect(unauthorizedPage.getByText(mapTitle)).toHaveCount(0);
      await expect(
        unauthorizedPage.getByText("A hand-drawn route from the mill to the hill caves"),
      ).toHaveCount(0);
      await unauthorizedPage.close();
    }

    await unauthorizedContext.close();
    await otherPlayerContext.close();
    await playerContext.close();
  });
});
