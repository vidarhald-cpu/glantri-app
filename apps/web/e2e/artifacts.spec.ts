import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const API_URL = process.env.PLAYWRIGHT_API_URL ?? "http://localhost:4000";
const WEB_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

function loadCharacterIds(): { characterId: string; nonHolderCharacterId: string } {
  const state = JSON.parse(fs.readFileSync(path.join(__dirname, "test-state.json"), "utf8")) as {
    characterId: string;
    nonHolderCharacterId: string;
  };
  return state;
}

test.describe("Campaign Artifact player presentation", () => {
  test.use({ storageState: "e2e/.auth/gm.json" });

  test("publishes a safe visual Artifact to entitled players without exposing GM controls", async ({
    browser,
    page,
  }) => {
    const title = `Artifact player presentation ${Date.now()}`;
    const altText = "A smiling dwarf holding a tankard";
    const imagePath = path.resolve(__dirname, "../public/images/GrinulGrimbrew.jpeg");
    const characterIds = loadCharacterIds();
    const campaignResponse = await page.request.post(`${API_URL}/campaigns`, {
      data: { name: `Artifact presentation ${Date.now()}`, status: "active" },
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

    const playerContext = await browser.newContext({
      storageState: path.resolve(__dirname, ".auth/player.json"),
    });
    const playerMe = await playerContext.request.get(`${API_URL}/auth/me`);
    expect((await playerMe.json()).user.email).toBe("smoke-player@test.local");
    const participantResponse = await playerContext.request.post(
      `${API_URL}/scenarios/${scenarioId}/participants/character`,
      { data: { characterId: characterIds.characterId } },
    );
    expect(participantResponse.status()).toBe(200);

    await page.goto(`/campaigns/${campaignId}?tab=campaign`);
    await expect(page.getByRole("heading", { name: "Upload an Artifact" })).toBeVisible();
    await page.locator('input[type="file"]').setInputFiles(imagePath);
    await page.getByLabel("Title").fill(title);
    await page.getByLabel("Alt text for visual content").fill(altText);
    await page.getByRole("button", { name: "Upload privately" }).click();
    await expect(page.getByText("Artifact uploaded privately.", { exact: false })).toBeVisible();

    const gmCard = page.getByRole("article").filter({ hasText: title });
    await expect(gmCard.getByRole("img", { name: altText })).toBeVisible();
    await gmCard.getByRole("button", { name: "Share with Campaign" }).click();
    await expect(page.getByText("Artifact shared with the Campaign.")).toBeVisible();

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

    await gmCard.getByRole("button", { name: "Attach privately" }).click();
    await expect(page.getByText("Artifact attached privately to the Scenario.")).toBeVisible();
    await gmCard.getByRole("button", { name: "Share with Scenario" }).click();
    await expect(page.getByText("Artifact shared with entitled Scenario players.")).toBeVisible();
    await gmCard.getByRole("button", { name: "Withdraw from Campaign" }).click();
    await expect(page.getByText("Campaign access withdrawn.")).toBeVisible();

    await playerPage.reload();
    await expect(playerPage.getByRole("article").filter({ hasText: title })).toBeVisible();
    const scenarioOnlyList = await playerContext.request.get(
      `${API_URL}/campaigns/${campaignId}/artifacts`,
    );
    expect((await scenarioOnlyList.json()).artifacts).toEqual(
      expect.arrayContaining([expect.objectContaining({ title })]),
    );

    const campaignOnlyContext = await browser.newContext({
      storageState: path.resolve(__dirname, ".auth/non-holder.json"),
    });
    const playerImageSrc = await playerCard.getByRole("img", { name: altText }).getAttribute("src");
    expect(playerImageSrc).not.toBeNull();
    const artifactId = new URL(playerImageSrc!, API_URL).pathname.split("/").at(-2)!;
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
