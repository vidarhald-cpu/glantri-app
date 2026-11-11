import { createHash, randomBytes } from "node:crypto";
import { deflateSync } from "node:zlib";

import {
  expect,
  test,
  type APIRequestContext,
  type APIResponse,
  type Page,
} from "@playwright/test";

import { createCharacterForE2e } from "./character-fixture";
import { API_URL, WEB_URL } from "./targets";

/**
 * Forgejo #1148: the in-house Studio serves Glantri over plain HTTP on a LAN address, which a
 * browser does not treat as a secure context, so it exposes neither `crypto.subtle` nor
 * `crypto.randomUUID`. `crypto.getRandomValues` remains.
 *
 * On a loopback target (the ordinary task stack and CI) the browser *is* a secure context, so
 * each flow runs twice: once as served, and once with the two secure-context-only members
 * removed from `Crypto.prototype` before any page script runs — exactly what an insecure context
 * omits. On a non-loopback target (`http://<LAN address>:<port>`) the browser is genuinely
 * insecure, nothing is removed, and the spec asserts `window.isSecureContext === false`.
 *
 * Both runs must store the same kind of result: SHA-256 digests equal to Node's for the same
 * bytes, and ids that are RFC 4122 version-4 UUIDs.
 */

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const UUID_V4 = new RegExp(`^${UUID}$`);
const MAP_MUTATION_HEADERS = { origin: WEB_URL, "x-glantri-map-mutation": "1" };

function isLoopbackHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host === "[::1]" ||
    /^127(?:\.\d{1,3}){3}$/.test(host)
  );
}

const TARGET_IS_LOOPBACK = isLoopbackHost(new URL(WEB_URL).hostname);
type Mode = "secure" | "insecure";
const MODES: Mode[] = TARGET_IS_LOOPBACK ? ["secure", "insecure"] : ["insecure"];

async function enterMode(page: Page, mode: Mode): Promise<void> {
  if (mode === "insecure" && TARGET_IS_LOOPBACK) {
    await page.context().addInitScript(() => {
      delete (Crypto.prototype as { subtle?: unknown }).subtle;
      delete (Crypto.prototype as { randomUUID?: unknown }).randomUUID;
    });
  }
}

async function expectCryptoSurface(page: Page, mode: Mode): Promise<void> {
  const surface = await page.evaluate(() => ({
    getRandomValues: typeof crypto.getRandomValues,
    randomUUID: typeof crypto.randomUUID,
    secureContext: window.isSecureContext,
    subtle: typeof crypto.subtle,
  }));
  expect(surface.getRandomValues).toBe("function");
  if (mode === "secure") {
    expect(surface).toMatchObject({
      randomUUID: "function",
      secureContext: true,
      subtle: "object",
    });
  } else {
    expect(surface).toMatchObject({ randomUUID: "undefined", subtle: "undefined" });
    if (!TARGET_IS_LOOPBACK) expect(surface.secureContext).toBe(false);
  }
}

async function json<T>(response: APIResponse): Promise<T> {
  if (!response.ok()) throw new Error(`${response.status()} ${await response.text()}`);
  return response.json() as Promise<T>;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(bytes: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

/** A valid RGB PNG of random pixels, so it stays near width × height × 3 bytes. */
function noisePng(width: number, height: number): Buffer {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 2, 0, 0, 0], 8);
  const rows = Buffer.alloc((width * 3 + 1) * height);
  const pixels = randomBytes(width * 3 * height);
  for (let row = 0; row < height; row += 1)
    pixels.copy(rows, row * (width * 3 + 1) + 1, row * width * 3, (row + 1) * width * 3);
  return Buffer.concat([
    Buffer.from("89504e470d0a1a0a", "hex"),
    pngChunk("IHDR", header),
    pngChunk("IDAT", deflateSync(rows, { level: 1 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

const sha256 = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");

interface StagedPreview {
  preview: {
    items: Array<{ derived?: { sha256: string }; title: string }>;
  };
}

/** Waits for the next staging response and returns each derived digest by item title. */
function nextStagedDigests(page: Page): Promise<Map<string, string>> {
  return page
    .waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        /\/campaigns\/[^/]+\/artifact-imports$/.test(new URL(response.url()).pathname),
    )
    .then(async (response) => {
      const body = await json<StagedPreview>(response);
      return new Map(body.preview.items.map((item) => [item.title, item.derived?.sha256 ?? ""]));
    });
}

async function createCampaign(request: APIRequestContext, name: string): Promise<string> {
  return (
    await json<{ campaign: { id: string } }>(
      await request.post(`${API_URL}/campaigns`, { data: { name, status: "active" } }),
    )
  ).campaign.id;
}

test.describe("Plain-HTTP LAN hosting without secure-context Web Crypto (#1148)", () => {
  test.use({ storageState: "e2e/.auth/gm.json" });

  for (const mode of MODES) {
    test(`[${mode}] uploads, takes in AI material and publishes a new version`, async ({
      page,
    }) => {
      test.skip(
        process.env.CI === "true" && process.env.ARTIFACT_E2E_STORAGE_ENABLED !== "1",
        "Requires the explicitly owned private Artifact storage run.",
      );
      test.setTimeout(120_000);
      const suffix = Date.now();
      const campaignId = await createCampaign(page.request, `#1148 artifacts ${mode} ${suffix}`);
      await enterMode(page, mode);
      await page.goto(`/campaigns/${campaignId}?tab=campaign`);
      await expectCryptoSurface(page, mode);
      const panel = page.getByRole("region", { name: "Artifact library", exact: true });

      // Ordinary upload.
      const original = noisePng(320, 240);
      const upload = panel.getByRole("region", { name: "Upload Artifacts" });
      await upload
        .getByLabel("Files", { exact: true })
        .setInputFiles({ name: "watchtower.png", mimeType: "image/png", buffer: original });
      let staged = nextStagedDigests(page);
      await upload.getByRole("button", { name: "Validate and preview" }).click();
      expect((await staged).get("watchtower")).toBe(sha256(original));
      let review = upload.getByRole("region", { name: "Artifact import review" });
      await review.getByRole("button", { name: "Accept selected Artifacts" }).click();
      await expect(review.getByRole("status")).toContainText("Accepted: 1");

      // AI intake with several multi-MiB PNGs: stage, preview, confirm.
      const intakeFiles = [0, 1, 2, 3].map((index) => ({
        buffer: noisePng(900 + index * 40, 900),
        mimeType: "image/png",
        name: `handout-${index + 1}.png`,
      }));
      for (const file of intakeFiles) expect(file.buffer.length).toBeGreaterThan(2 * 1024 * 1024);
      const intake = panel.getByRole("region", { name: "AI-assisted intake" });
      await intake.getByLabel("Pasted context").fill(
        JSON.stringify({
          entries: intakeFiles.map((file, index) => ({
            filename: file.name,
            kind: "handout",
            represents: "artifact",
            title: `Handout ${index + 1}`,
          })),
          format: "glantri-intake",
          version: 1,
        }),
      );
      await intake.getByLabel("Files described by the context").setInputFiles(intakeFiles);
      staged = nextStagedDigests(page);
      await intake.getByRole("button", { name: "Validate and stage a proposal" }).click();
      const intakeDigests = await staged;
      intakeFiles.forEach((file, index) =>
        expect(intakeDigests.get(`Handout ${index + 1}`)).toBe(sha256(file.buffer)),
      );
      review = intake.getByRole("region", { name: "Artifact import review" });
      await expect(review.getByText(/^Create/)).toHaveCount(intakeFiles.length);
      await review.getByRole("button", { name: "Accept selected Artifacts" }).click();
      await expect(review.getByRole("status")).toContainText(`Accepted: ${intakeFiles.length}`);

      // A new version of the ordinary upload.
      const artifacts = (
        await json<{ artifacts: Array<{ id: string; title: string }> }>(
          await page.request.get(`${API_URL}/campaigns/${campaignId}/artifacts`),
        )
      ).artifacts;
      expect(artifacts).toHaveLength(1 + intakeFiles.length);
      const watchtower = artifacts.find((artifact) => artifact.title === "watchtower")!;
      await page.reload();
      const card = panel
        .locator("article")
        .filter({ has: page.getByText("watchtower", { exact: true }) })
        .first();
      await card.getByText("History, uses and new version", { exact: true }).click();
      const corrected = noisePng(320, 240);
      await card
        .getByLabel("Corrected media")
        .setInputFiles({ name: "watchtower-v2.png", mimeType: "image/png", buffer: corrected });
      staged = nextStagedDigests(page);
      await card.getByRole("button", { name: "Preview new version" }).click();
      expect((await staged).get("watchtower")).toBe(sha256(corrected));
      await card.getByLabel(/Approve updating watchtower/).check();
      await card.getByRole("button", { name: "Accept selected Artifacts" }).click();
      await expect(card.getByRole("status")).toContainText("Accepted: 1");
      expect(
        await (
          await page.request.get(
            `${API_URL}/campaigns/${campaignId}/artifacts/${watchtower.id}/content`,
          )
        ).body(),
      ).toEqual(corrected);
    });

    test(`[${mode}] places a Map marker`, async ({ page }) => {
      const suffix = Date.now();
      const campaignId = await createCampaign(page.request, `#1148 map ${mode} ${suffix}`);
      const created = await json<{ map: { id: string; version: number } }>(
        await page.request.post(`${API_URL}/campaigns/${campaignId}/maps`, {
          data: {
            access: "gm_only",
            backgroundArtifactId: null,
            description: "",
            name: `Coast ${suffix}`,
            role: "area",
          },
          headers: MAP_MUTATION_HEADERS,
        }),
      );
      await json(
        await page.request.put(`${API_URL}/campaigns/${campaignId}/maps/${created.map.id}`, {
          data: {
            access: "gm_only",
            backgroundArtifactId: null,
            description: "",
            expectedVersion: created.map.version,
            layers: [
              {
                id: `layer-${suffix}`,
                markers: [],
                name: "Shoreline",
                sortOrder: 0,
                visibility: "gm_only",
              },
            ],
            name: `Coast ${suffix}`,
            role: "area",
          },
          headers: MAP_MUTATION_HEADERS,
        }),
      );

      await enterMode(page, mode);
      await page.goto(`/campaigns/${campaignId}?tab=maps&mapId=${created.map.id}`);
      await expectCryptoSurface(page, mode);
      await page.getByRole("button", { name: "Add marker", exact: true }).click();
      await page.getByRole("button", { name: "Save Map" }).click();
      await expect(page.getByRole("status").filter({ hasText: "Map saved." })).toBeVisible();

      const stored = await json<{
        map: { layers: Array<{ markers: Array<{ id: string; label: string }> }> };
      }>(await page.request.get(`${API_URL}/campaigns/${campaignId}/maps/${created.map.id}`));
      const markers = stored.map.layers.flatMap((layer) => layer.markers);
      expect(markers).toHaveLength(1);
      expect(markers[0]!.id).toMatch(new RegExp(`^marker-${UUID}$`));
    });

    test(`[${mode}] makes an Item available and a player picks it up`, async ({
      browser,
      page,
    }) => {
      test.setTimeout(90_000);
      const suffix = Date.now();
      const characterId = `insecure-pickup-${mode}-${suffix}`;
      const characterName = `Pickup Player ${mode} ${suffix}`;
      const itemName = `Brass Lantern ${suffix}`;
      const playerContext = await browser.newContext({ storageState: "e2e/.auth/player.json" });
      const playerUser = await json<{ user: { id: string } }>(
        await playerContext.request.get(`${API_URL}/auth/me`),
      );
      await createCharacterForE2e({
        apiUrl: API_URL,
        id: characterId,
        name: characterName,
        request: playerContext.request,
      });
      const campaignId = await createCampaign(page.request, `#1148 pickup ${mode} ${suffix}`);
      await json(
        await page.request.post(`${API_URL}/campaigns/${campaignId}/roster`, {
          data: { category: "pc", sourceId: characterId, sourceType: "character" },
        }),
      );
      const scenarioId = (
        await json<{ scenario: { id: string } }>(
          await page.request.post(`${API_URL}/campaigns/${campaignId}/scenarios`, {
            data: { description: "", name: `Harbour ${suffix}`, status: "live" },
          }),
        )
      ).scenario.id;
      await json(
        await page.request.post(`${API_URL}/scenarios/${scenarioId}/participants/character`, {
          data: { characterId, controlledByUserId: playerUser.user.id },
        }),
      );
      await json(
        await page.request.post(`${API_URL}/campaigns/${campaignId}/items`, {
          data: {
            displayName: itemName,
            facts: { descriptiveTraits: [], unsupportedCapabilities: [] },
            holderCharacterId: null,
            templateId: "weapon-template-dagger",
          },
        }),
      );

      // GM session action: make the Item available, which mints the reference id in the browser.
      await enterMode(page, mode);
      await page.goto(`/campaigns/${campaignId}?tab=scenario&scenarioId=${scenarioId}`);
      await expectCryptoSurface(page, mode);
      await page.getByLabel("Campaign object").selectOption({ label: `Item: ${itemName}` });
      await page.getByRole("button", { name: "Make available", exact: true }).click();
      await page.getByRole("button", { name: "Save session preparation" }).click();
      await expect(page.getByText("Saved Scenario session preparation.")).toBeVisible();
      type GmSession = { session: { availableObjects: Array<{ id: string }> } };
      let session = await json<GmSession>(
        await page.request.get(`${API_URL}/scenarios/${scenarioId}/session`),
      );
      expect(session.session.availableObjects).toHaveLength(1);
      expect(session.session.availableObjects[0]!.id).toMatch(UUID_V4);

      // Player pick-up, which mints the request id in the browser.
      const playerPage = await playerContext.newPage();
      await enterMode(playerPage, mode);
      await playerPage.goto(`/campaigns/${campaignId}/scenarios/${scenarioId}/player`);
      await expectCryptoSurface(playerPage, mode);
      await playerPage.getByRole("button", { exact: true, name: itemName }).click();
      const pickUpRequest = playerPage.waitForRequest(
        (request) => request.method() === "POST" && request.url().endsWith("/pick-up"),
      );
      await playerPage.getByRole("button", { name: `Pick up as ${characterName}` }).click();
      await expect(playerPage.getByRole("status")).toHaveText("Item picked up.");
      // The server keeps the applied request id privately; the id the browser sent is the one.
      expect((await pickUpRequest).postDataJSON().requestId).toMatch(UUID_V4);

      session = await json<GmSession>(
        await page.request.get(`${API_URL}/scenarios/${scenarioId}/session`),
      );
      expect(session.session.availableObjects).toHaveLength(0);
      await playerContext.close();
    });
  }
});
