import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { createCharacterForE2e } from "./character-fixture";
import { API_URL, WEB_URL } from "./targets";

const ARTIFACT_MUTATION_HEADERS = {
  origin: WEB_URL,
  "x-glantri-artifact-mutation": "1",
};

test.describe("Campaign Artifact player presentation", () => {
  test.use({ storageState: "e2e/.auth/gm.json" });

  test("publishes a safe visual Artifact to entitled players without exposing GM controls", async ({
    browser,
    page,
  }) => {
    test.skip(
      process.env.CI === "true" && process.env.ARTIFACT_E2E_STORAGE_ENABLED !== "1",
      "The production Docker smoke environment intentionally has no Artifact storage configuration; the isolated Artifact E2E run supplies one.",
    );
    const suffix = Date.now();
    const title = `Artifact player presentation ${suffix}`;
    const altText = "A smiling dwarf holding a tankard";
    const imagePath = path.resolve(__dirname, "../public/images/GrinulGrimbrew.jpeg");
    const characterIds = {
      characterId: `artifact-player-${suffix}`,
      nonHolderCharacterId: `artifact-other-${suffix}`,
    };
    const playerContext = await browser.newContext({
      storageState: path.resolve(__dirname, ".auth/player.json"),
    });
    const campaignOnlyContext = await browser.newContext({
      storageState: path.resolve(__dirname, ".auth/non-holder.json"),
    });
    await createCharacterForE2e({
      apiUrl: API_URL,
      id: characterIds.characterId,
      name: `Artifact Player ${suffix}`,
      request: playerContext.request,
    });
    await createCharacterForE2e({
      apiUrl: API_URL,
      id: characterIds.nonHolderCharacterId,
      name: `Artifact Other ${suffix}`,
      request: campaignOnlyContext.request,
    });
    const campaignResponse = await page.request.post(`${API_URL}/campaigns`, {
      data: { name: `Artifact presentation ${suffix}`, status: "active" },
    });
    expect(campaignResponse.status()).toBe(200);
    const campaignId = ((await campaignResponse.json()) as { campaign: { id: string } }).campaign
      .id;
    for (const sourceId of [characterIds.characterId, characterIds.nonHolderCharacterId]) {
      const rosterResponse = await page.request.post(`${API_URL}/campaigns/${campaignId}/roster`, {
        data: { category: "pc", sourceId, sourceType: "character" },
      });
      expect(rosterResponse.status()).toBe(200);
    }
    const scenarioResponse = await page.request.post(
      `${API_URL}/campaigns/${campaignId}/scenarios`,
      { data: { name: "Artifact entitled Scenario", status: "live" } },
    );
    expect(scenarioResponse.status()).toBe(200);
    const scenarioId = ((await scenarioResponse.json()) as { scenario: { id: string } }).scenario
      .id;

    const playerMe = await playerContext.request.get(`${API_URL}/auth/me`);
    expect((await playerMe.json()).user.email).toBe("smoke-player@test.local");
    const participantResponse = await playerContext.request.post(
      `${API_URL}/scenarios/${scenarioId}/participants/character`,
      { data: { characterId: characterIds.characterId } },
    );
    expect(participantResponse.status()).toBe(200);

    const uploadResponse = await page.request.post(`${API_URL}/campaigns/${campaignId}/artifacts`, {
      headers: ARTIFACT_MUTATION_HEADERS,
      multipart: {
        metadata: JSON.stringify({ altText, artifactKind: "image", title }),
        file: {
          buffer: fs.readFileSync(imagePath),
          mimeType: "image/jpeg",
          name: "safe-player-presentation.jpeg",
        },
      },
    });
    expect(uploadResponse.status()).toBe(201);
    const uploaded = (await uploadResponse.json()) as {
      artifact: { id: string; metadataVersion: number };
    };
    const artifactId = uploaded.artifact.id;
    const campaignPublished = await page.request.put(
      `${API_URL}/campaigns/${campaignId}/artifacts/${artifactId}/audience`,
      {
        data: {
          audience: "campaign",
          expectedMetadataVersion: uploaded.artifact.metadataVersion,
        },
        headers: ARTIFACT_MUTATION_HEADERS,
      },
    );
    expect(campaignPublished.status()).toBe(200);
    let artifactVersion = (
      (await campaignPublished.json()) as { artifact: { metadataVersion: number } }
    ).artifact.metadataVersion;

    const playerPage = await playerContext.newPage();
    await playerPage.setViewportSize({ height: 740, width: 360 });
    const playerArtifactList = await playerContext.request.get(
      `${API_URL}/campaigns/${campaignId}/artifacts`,
    );
    expect(playerArtifactList.status()).toBe(200);
    expect((await playerArtifactList.json()).artifacts).toEqual(
      expect.arrayContaining([expect.objectContaining({ title })]),
    );
    const contentResponsePromise = playerPage.waitForResponse(
      (response) =>
        response.url().startsWith(`${API_URL}/campaigns/${campaignId}/artifacts/`) &&
        response.url().endsWith("/content"),
    );
    await playerPage.goto(`${WEB_URL}/campaigns/${campaignId}?tab=campaign`);
    await expect(
      playerPage.getByText("Maps, images, and handouts deliberately shared with you."),
    ).toBeVisible();
    const playerCard = playerPage.getByRole("article").filter({ hasText: title });
    await expect(playerCard).toBeVisible();
    await expect(playerCard.getByRole("img", { name: altText })).toBeVisible();
    expect((await contentResponsePromise).status()).toBe(200);
    await expect(playerCard.getByRole("button")).toHaveCount(0);
    await expect(playerPage.getByText(/digest|storage key|original filename/i)).toHaveCount(0);
    expect(
      await playerPage
        .locator("html")
        .evaluate((element) => element.scrollWidth <= element.clientWidth),
    ).toBe(true);

    const attached = await page.request.post(
      `${API_URL}/campaigns/${campaignId}/scenarios/${scenarioId}/artifacts/${artifactId}/attach`,
      {
        data: { expectedArtifactVersion: artifactVersion },
        headers: ARTIFACT_MUTATION_HEADERS,
      },
    );
    expect(attached.status()).toBe(200);
    const attachedBody = (await attached.json()) as {
      artifact: { metadataVersion: number };
      reference: { version: number };
    };
    artifactVersion = attachedBody.artifact.metadataVersion;
    const scenarioPublished = await page.request.post(
      `${API_URL}/campaigns/${campaignId}/scenarios/${scenarioId}/artifacts/${artifactId}/publish`,
      {
        data: {
          expectedArtifactVersion: artifactVersion,
          expectedReferenceVersion: attachedBody.reference.version,
        },
        headers: ARTIFACT_MUTATION_HEADERS,
      },
    );
    expect(scenarioPublished.status()).toBe(200);
    artifactVersion = (
      (await scenarioPublished.json()) as { artifact: { metadataVersion: number } }
    ).artifact.metadataVersion;
    const campaignWithdrawn = await page.request.put(
      `${API_URL}/campaigns/${campaignId}/artifacts/${artifactId}/audience`,
      {
        data: { audience: "gm_private", expectedMetadataVersion: artifactVersion },
        headers: ARTIFACT_MUTATION_HEADERS,
      },
    );
    expect(campaignWithdrawn.status()).toBe(200);

    await playerPage.reload();
    await expect(playerPage.getByRole("article").filter({ hasText: title })).toBeVisible();
    const scenarioOnlyList = await playerContext.request.get(
      `${API_URL}/campaigns/${campaignId}/artifacts`,
    );
    expect((await scenarioOnlyList.json()).artifacts).toEqual(
      expect.arrayContaining([expect.objectContaining({ title })]),
    );

    const campaignOnlyList = await campaignOnlyContext.request.get(
      `${API_URL}/campaigns/${campaignId}/artifacts`,
    );
    expect(campaignOnlyList.status()).toBe(200);
    expect((await campaignOnlyList.json()).artifacts).toEqual([]);
    const denied = await campaignOnlyContext.request.get(
      `${API_URL}/campaigns/${campaignId}/artifacts/${artifactId}/content`,
    );
    expect(denied.status()).toBe(404);
    expect(await denied.json()).toEqual({ error: "Artifact not found." });

    await campaignOnlyContext.close();
    await playerContext.close();
  });
});
