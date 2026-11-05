import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { API_URL as API, WEB_URL as WEB } from "./targets";
const headers = { origin: WEB, "x-glantri-artifact-mutation": "1" };
test.describe("AM1 Artifact library and import", () => {
  test.use({ storageState: "e2e/.auth/gm.json" });
  test("creates, reuses, revises, retires and imports through review at narrow width", async ({
    page,
  }) => {
    test.skip(
      process.env.CI === "true" && process.env.ARTIFACT_E2E_STORAGE_ENABLED !== "1",
      "Requires the explicitly owned private Artifact storage run.",
    );
    const campaignResponse = await page.request.post(`${API}/campaigns`, {
      data: { name: `AM1 browser ${Date.now()}`, status: "active" },
    });
    expect(campaignResponse.status()).toBe(200);
    const campaignId = (await campaignResponse.json()).campaign.id;
    const scenario = await page.request.post(`${API}/campaigns/${campaignId}/scenarios`, {
      data: { name: "AM1 reuse", status: "live" },
    });
    const scenarioId = (await scenario.json()).scenario.id;
    const bytes = fs.readFileSync(path.resolve(__dirname, "../public/images/GrinulGrimbrew.jpeg"));
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${WEB}/campaigns/${campaignId}?tab=campaign`);
    const panel = page.getByRole("region", { name: "Artifact library", exact: true });
    const ordinaryUpload = panel.getByRole("region", { name: "Upload Artifacts" });
    await ordinaryUpload
      .getByLabel("Files", { exact: true })
      .setInputFiles({ name: "portrait.jpeg", mimeType: "image/jpeg", buffer: bytes });
    await ordinaryUpload.getByLabel("Title for portrait.jpeg").fill("Captain original");
    await ordinaryUpload.getByLabel("Alt text for portrait.jpeg (optional)").fill("A captain");
    await ordinaryUpload.getByRole("button", { name: "Validate and preview" }).click();
    const ordinaryReview = ordinaryUpload.getByRole("region", {
      name: "Artifact import review",
    });
    await expect(ordinaryReview.getByText(/^Create/)).toBeVisible();
    await ordinaryReview.getByRole("button", { name: "Accept selected Artifacts" }).click();
    await expect(ordinaryReview.getByRole("status")).toContainText("Accepted: 1");
    await expect(panel.getByText("Captain original", { exact: true }).first()).toBeVisible();
    let list = (await (await page.request.get(`${API}/campaigns/${campaignId}/artifacts`)).json())
      .artifacts;
    const id = list[0].id;
    let artifact = list[0];
    const share = await page.request.put(
      `${API}/campaigns/${campaignId}/artifacts/${id}/audience`,
      {
        headers,
        data: { audience: "campaign", expectedMetadataVersion: artifact.metadataVersion },
      },
    );
    artifact = (await share.json()).artifact;
    const attach = await page.request.post(
      `${API}/campaigns/${campaignId}/scenarios/${scenarioId}/artifacts/${id}/attach`,
      { headers, data: { expectedArtifactVersion: artifact.metadataVersion } },
    );
    expect(attach.status()).toBe(200);
    const blackboard = await page.request.post(
      `${API}/campaigns/${campaignId}/blackboard/entries`,
      {
        headers: { origin: WEB, "x-glantri-blackboard-mutation": "1" },
        data: { category: "image_map", sourceArtifactId: id, title: "Captain briefing" },
      },
    );
    expect(blackboard.status()).toBe(201);
    await page.reload();
    await panel.getByLabel("Find Artifacts").fill("Captain");
    const card = panel
      .locator("article")
      .filter({ has: page.getByText("Captain original", { exact: true }) })
      .first();
    await card.getByText("History, uses and new version", { exact: true }).click();
    await expect(card.getByText(/Scenario: AM1 reuse/)).toBeVisible();
    await expect(card.getByText(/Blackboard: Captain briefing/)).toBeVisible();
    const corrected = Buffer.concat([
      bytes.subarray(0, bytes.length - 2),
      Buffer.from("corrected"),
      bytes.subarray(bytes.length - 2),
    ]);
    await card
      .getByLabel("Corrected media")
      .setInputFiles({ name: "corrected.jpeg", mimeType: "image/jpeg", buffer: corrected });
    await card.getByRole("button", { name: "Preview new version" }).click();
    await expect(card.getByText(/^Update candidate/)).toBeVisible();
    await expect(card.getByRole("button", { name: "Accept selected Artifacts" })).toBeDisabled();
    await card.getByLabel(/Approve updating Captain original/).check();
    await card.getByRole("button", { name: "Accept selected Artifacts" }).click();
    await expect(card.getByRole("status")).toContainText("Accepted: 1");
    await expect(card.getByRole("link", { name: "Version 2", exact: true })).toBeVisible();
    expect(
      await (
        await page.request.get(`${API}/campaigns/${campaignId}/artifacts/${id}/content`)
      ).body(),
    ).toEqual(corrected);
    await card.getByRole("button", { name: "Retire", exact: true }).click();
    await expect(panel.getByText("Captain original", { exact: true })).toHaveCount(0);
    await panel.getByRole("combobox", { name: "Lifecycle", exact: true }).selectOption("archived");
    await expect(panel.getByText("Captain original", { exact: true })).toBeVisible();
    expect(
      (await page.request.get(`${API}/campaigns/${campaignId}/artifacts/${id}/content`)).status(),
    ).toBe(200);
    const board = await (
      await page.request.get(`${API}/campaigns/${campaignId}/blackboard`)
    ).json();
    expect(JSON.stringify(board)).not.toContain("source_unavailable");
    await panel.getByLabel("Find Artifacts").fill("");
    await panel.getByRole("combobox", { name: "Lifecycle", exact: true }).selectOption("active");
    await panel.getByText("Import Artifact package", { exact: true }).click();
    const manifest = {
      schemaVersion: 1,
      producer: "browser-author",
      packageId: "browser-portraits",
      version: "1",
      title: "Browser handouts",
      resources: [
        {
          id: "picture",
          mediaType: "image/jpeg",
          sha256: createHash("sha256").update(bytes).digest("hex"),
        },
      ],
      objects: ["A", "B", "C"].map((title, i) => ({
        id: title,
        type: "Artifact",
        optional: i > 0,
        resourceId: "picture",
        sourceId: title,
        metadata: { title: `Handout ${title}`, artifactKind: "image", altText: `Image ${title}` },
      })),
    };
    await panel.getByLabel("Package manifest").setInputFiles({
      name: "package.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(manifest)),
    });
    await panel
      .getByLabel("Resource: picture")
      .setInputFiles({ name: "picture.jpeg", mimeType: "image/jpeg", buffer: bytes });
    await panel.getByRole("button", { name: "Validate and preview package" }).click();
    const review = panel.getByRole("region", { name: "Artifact import review" });
    await expect(review.getByText("Browser handouts", { exact: true })).toBeVisible();
    await review.getByLabel("Handout C", { exact: true }).click();
    await expect(review.getByLabel("Handout C", { exact: true })).not.toBeChecked();
    await expect(review.getByText("Excluded", { exact: true })).toBeVisible();
    await review.getByRole("button", { name: "Accept selected Artifacts" }).click();
    await expect(review.getByRole("status")).toContainText("Accepted: 2");
    await page.reload();
    await expect(panel.getByText("Handout A", { exact: true })).toBeVisible();
    await expect(panel.getByText("Handout B", { exact: true })).toBeVisible();
    await expect(panel.getByText("Handout C", { exact: true })).toHaveCount(0);
    await panel.getByLabel("Find Artifacts").focus();
    await expect(panel.getByLabel("Find Artifacts")).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(panel.getByLabel("Filter by kind")).toBeFocused();
    expect(await panel.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(
      true,
    );
    await page.screenshot({ path: test.info().outputPath("am1-library-390.png"), fullPage: true });
    list = (await (await page.request.get(`${API}/campaigns/${campaignId}/artifacts`)).json())
      .artifacts;
    expect(list).toHaveLength(3);
  });
  test("reviews and atomically accepts multiple loose files without an archive", async ({
    page,
  }) => {
    test.skip(
      process.env.CI === "true" && process.env.ARTIFACT_E2E_STORAGE_ENABLED !== "1",
      "Requires the explicitly owned private Artifact storage run.",
    );
    const campaignResponse = await page.request.post(`${API}/campaigns`, {
      data: { name: `Ordinary multi-file ${Date.now()}`, status: "active" },
    });
    expect(campaignResponse.status()).toBe(200);
    const campaignId = (await campaignResponse.json()).campaign.id;
    const bytes = fs.readFileSync(path.resolve(__dirname, "../public/images/GrinulGrimbrew.jpeg"));
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${WEB}/campaigns/${campaignId}?tab=campaign`);
    const panel = page.getByRole("region", { name: "Artifact library", exact: true });
    const upload = panel.getByRole("region", { name: "Upload Artifacts" });

    await upload.getByLabel("Files", { exact: true }).setInputFiles({
      name: "first-portrait.jpeg",
      mimeType: "image/jpeg",
      buffer: bytes,
    });
    await expect(upload.getByLabel("Title for first-portrait.jpeg")).toHaveValue("first portrait");
    await upload.getByRole("button", { name: "Validate and preview" }).click();
    let review = upload.getByRole("region", { name: "Artifact import review" });
    await review.getByRole("button", { name: "Accept selected Artifacts" }).click();
    await expect(review.getByRole("status")).toContainText("Accepted: 1");

    await upload.getByLabel("Files", { exact: true }).setInputFiles([
      { name: "same-bytes-map.jpeg", mimeType: "image/jpeg", buffer: bytes },
      { name: "same-bytes-handout.jpeg", mimeType: "image/jpeg", buffer: bytes },
    ]);
    await upload.getByLabel("Kind for same-bytes-map.jpeg").selectOption("map");
    await upload.getByLabel("Kind for same-bytes-handout.jpeg").selectOption("handout");
    await expect(upload.getByLabel("Alt text for same-bytes-map.jpeg (optional)")).toHaveValue("");
    await upload.getByRole("button", { name: "Validate and preview" }).click();
    review = upload.getByRole("region", { name: "Artifact import review" });
    await expect(review.getByText("2 Artifact uploads", { exact: true })).toBeVisible();
    await expect(review.getByText(/matches existing Artifact/)).toHaveCount(2);
    await expect(review.getByText(/^Create/)).toHaveCount(2);
    await review.getByRole("button", { name: "Accept selected Artifacts" }).click();
    await expect(review.getByRole("status")).toContainText("Accepted: 2");

    const artifacts = (
      await (await page.request.get(`${API}/campaigns/${campaignId}/artifacts`)).json()
    ).artifacts;
    expect(artifacts).toHaveLength(3);
    expect(new Set(artifacts.map((artifact: { id: string }) => artifact.id)).size).toBe(3);
    expect(
      artifacts.every(
        (artifact: { altText?: string; audience: string; provenanceKind: string }) =>
          artifact.audience === "gm_private" &&
          artifact.provenanceKind === "user_upload" &&
          artifact.altText === undefined,
      ),
    ).toBe(true);
    await page.screenshot({
      path: test.info().outputPath("ordinary-multi-file-review-390.png"),
      fullPage: true,
    });
  });
  test("recovers from missing staged storage and stale update approval without partial acceptance", async ({
    page,
  }) => {
    const root = process.env.ARTIFACT_LOCAL_ROOT;
    test.skip(!root, "Requires the owned private storage root for failure injection.");
    const response = await page.request.post(`${API}/campaigns`, {
      data: { name: `AM1 recovery ${Date.now()}`, status: "active" },
    });
    const campaignId = (await response.json()).campaign.id;
    const bytes = fs.readFileSync(path.resolve(__dirname, "../public/images/GrinulGrimbrew.jpeg"));
    const data = {
      schemaVersion: 1,
      producer: "recovery-author",
      packageId: "recovery",
      version: "1",
      title: "Recovery package",
      resources: [
        {
          id: "media",
          mediaType: "image/jpeg",
          sha256: createHash("sha256").update(bytes).digest("hex"),
        },
      ],
      objects: [
        {
          id: "portrait",
          sourceId: "portrait",
          type: "Artifact",
          resourceId: "media",
          metadata: { title: "Recovery portrait", artifactKind: "image", altText: "A portrait" },
        },
      ],
    };
    function files(dir: string): string[] {
      return fs
        .readdirSync(dir, { withFileTypes: true })
        .flatMap((entry) =>
          entry.isDirectory() ? files(path.join(dir, entry.name)) : [path.join(dir, entry.name)],
        );
    }
    const before = new Set(files(root!));
    const staged = await page.request.post(`${API}/campaigns/${campaignId}/artifact-imports`, {
      headers,
      multipart: {
        manifest: JSON.stringify(data),
        media: { name: "portrait.jpeg", mimeType: "image/jpeg", buffer: bytes },
      },
    });
    expect(staged.status()).toBe(201);
    const stagedPath = files(root!).find((file) => !before.has(file))!;
    expect(stagedPath).toBeTruthy();
    await page.setViewportSize({ width: 360, height: 780 });
    await page.goto(`${WEB}/campaigns/${campaignId}?tab=campaign`);
    const panel = page.getByRole("region", { name: "Artifact library", exact: true });
    await panel.getByText("Import Artifact package", { exact: true }).click();
    await panel.getByRole("button", { name: "Review record" }).click();
    const review = panel.getByRole("region", { name: "Artifact import review" });
    fs.renameSync(stagedPath, `${stagedPath}.withheld`);
    try {
      await review.getByRole("button", { name: "Accept selected Artifacts" }).click();
      await expect(review.getByRole("alert")).toContainText(/storage|temporarily unavailable/i);
      expect(
        (await (await page.request.get(`${API}/campaigns/${campaignId}/artifacts`)).json())
          .artifacts,
      ).toHaveLength(0);
    } finally {
      fs.renameSync(`${stagedPath}.withheld`, stagedPath);
    }
    await review.getByRole("button", { name: "Accept selected Artifacts" }).click();
    await expect(review.getByRole("status")).toContainText("Accepted: 1");
    const artifact = (
      await (await page.request.get(`${API}/campaigns/${campaignId}/artifacts`)).json()
    ).artifacts[0];
    data.version = "2";
    data.objects[0]!.metadata.title = "Revised portrait";
    const updatedStage = await page.request.post(
      `${API}/campaigns/${campaignId}/artifact-imports`,
      {
        headers,
        multipart: {
          manifest: JSON.stringify(data),
          media: { name: "portrait.jpeg", mimeType: "image/jpeg", buffer: bytes },
        },
      },
    );
    expect(updatedStage.status()).toBe(201);
    await page.reload();
    await panel.getByText("Import Artifact package", { exact: true }).click();
    await panel.getByRole("button", { name: "Review record" }).first().click();
    await review.getByLabel(/Approve updating Revised portrait/).check();
    const edit = await page.request.patch(
      `${API}/campaigns/${campaignId}/artifacts/${artifact.id}`,
      {
        headers,
        data: { expectedMetadataVersion: artifact.metadataVersion, title: "Concurrent GM edit" },
      },
    );
    expect(edit.status()).toBe(200);
    await review.getByRole("button", { name: "Accept selected Artifacts" }).click();
    await expect(review.getByRole("alert")).toContainText("Refresh the preview");
    const history = await (
      await page.request.get(`${API}/campaigns/${campaignId}/artifacts/${artifact.id}/history`)
    ).json();
    expect(history.revisions).toHaveLength(1);
    await review.getByRole("button", { name: "Refresh validation" }).click();
    await expect(review.getByLabel(/Approve updating Revised portrait/)).not.toBeChecked();
    await expect(review.getByRole("button", { name: "Accept selected Artifacts" })).toBeDisabled();
    await review.getByLabel(/Approve updating Revised portrait/).check();
    await review.getByRole("button", { name: "Accept selected Artifacts" }).click();
    await expect(review.getByRole("status")).toContainText("Accepted: 1");
    await page.screenshot({ path: test.info().outputPath("am1-recovery-360.png"), fullPage: true });
  });
  test("invalidates approved updates when files or manifests change and accepts only freshly reviewed bytes", async ({
    page,
  }) => {
    test.skip(
      process.env.CI === "true" && process.env.ARTIFACT_E2E_STORAGE_ENABLED !== "1",
      "Requires owned private Artifact storage.",
    );
    const response = await page.request.post(`${API}/campaigns`, {
      data: { name: `AM1 approval binding ${Date.now()}`, status: "active" },
    });
    expect(response.status()).toBe(200);
    const campaignId = (await response.json()).campaign.id;
    const original = fs.readFileSync(
      path.resolve(__dirname, "../public/images/GrinulGrimbrew.jpeg"),
    );
    const revise = (text: string) =>
      Buffer.concat([
        original.subarray(0, original.length - 2),
        Buffer.from(text),
        original.subarray(original.length - 2),
      ]);
    const first = revise("revision one"),
      replacement = revise("revision two");
    const manifest = (bytes: Buffer, version: string) => ({
      schemaVersion: 1,
      producer: "approval-binding",
      packageId: "portrait",
      version,
      title: "Approval binding",
      resources: [
        {
          id: "media",
          mediaType: "image/jpeg",
          sha256: createHash("sha256").update(bytes).digest("hex"),
        },
      ],
      objects: [
        {
          id: "portrait",
          sourceId: "captain",
          type: "Artifact",
          resourceId: "media",
          metadata: { title: "Binding captain", artifactKind: "portrait", altText: "Captain" },
        },
      ],
    });
    const staged = await page.request.post(`${API}/campaigns/${campaignId}/artifact-imports`, {
      headers,
      multipart: {
        manifest: JSON.stringify(manifest(original, "1")),
        media: { name: "original.jpg", mimeType: "image/jpeg", buffer: original },
      },
    });
    expect(staged.status()).toBe(201);
    const initial = (await staged.json()).preview;
    const accepted = await page.request.post(
      `${API}/campaigns/${campaignId}/artifact-imports/${initial.id}/accept`,
      { headers, data: { previewToken: initial.previewToken, approvedUpdates: [] } },
    );
    expect(accepted.status()).toBe(200);
    const artifactId = (await accepted.json()).preview.result.portrait;
    const current = async () =>
      (
        await page.request.get(`${API}/campaigns/${campaignId}/artifacts/${artifactId}/content`)
      ).body();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${WEB}/campaigns/${campaignId}?tab=campaign`);
    const panel = page.getByRole("region", { name: "Artifact library", exact: true });
    await panel.getByText("Import Artifact package", { exact: true }).click();
    const chooseManifest = async (bytes: Buffer, version: string) =>
      panel.getByLabel("Package manifest").setInputFiles({
        name: "package.json",
        mimeType: "application/json",
        buffer: Buffer.from(JSON.stringify(manifest(bytes, version))),
      });
    const chooseResource = async (bytes: Buffer) =>
      panel
        .getByLabel("Resource: media")
        .setInputFiles({ name: "revision.jpg", mimeType: "image/jpeg", buffer: bytes });
    const validate = panel.getByRole("button", { name: "Validate and preview package" });
    const review = panel.getByRole("region", { name: "Artifact import review" });
    const approve = review.getByLabel(/Approve updating Binding captain/);
    const accept = review.getByRole("button", { name: "Accept selected Artifacts" });
    await chooseManifest(first, "2");
    await chooseResource(first);
    await validate.click();
    await approve.check();
    await expect(accept).toBeEnabled();
    await chooseResource(replacement);
    await expect(review).toHaveCount(0);
    expect(await current()).toEqual(original);
    await validate.click();
    await expect(panel.getByRole("alert")).toBeVisible();
    await expect(review).toHaveCount(0);
    expect(await current()).toEqual(original);
    await chooseManifest(replacement, "3");
    await chooseResource(replacement);
    await validate.click();
    await expect(approve).not.toBeChecked();
    await expect(accept).toBeDisabled();
    await approve.check();
    await panel.getByLabel("Package manifest").setInputFiles({
      name: "invalid.json",
      mimeType: "application/json",
      buffer: Buffer.from("invalid"),
    });
    await expect(review).toHaveCount(0);
    await expect(validate).toBeDisabled();
    await expect(panel.getByRole("alert")).toContainText("Choose a valid Artifact package");
    expect(await current()).toEqual(original);
    await chooseManifest(replacement, "3");
    await chooseResource(replacement);
    await validate.click();
    await expect(approve).not.toBeChecked();
    await expect(accept).toBeDisabled();
    await approve.check();
    await panel.getByLabel("Resource: media").setInputFiles([]);
    await expect(review).toHaveCount(0);
    await expect(validate).toBeDisabled();
    await chooseResource(replacement);
    await validate.click();
    await expect(approve).not.toBeChecked();
    await expect(accept).toBeDisabled();
    await approve.check();
    await accept.click();
    await expect(review.getByRole("status")).toContainText("Accepted: 1");
    expect(await current()).toEqual(replacement);
    expect(await current()).not.toEqual(first);
    await page.screenshot({
      path: test.info().outputPath("am1-fresh-approval-390.png"),
      fullPage: true,
    });
  });
});
