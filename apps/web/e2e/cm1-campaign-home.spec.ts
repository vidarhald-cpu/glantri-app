import { expect, test, type APIResponse } from "@playwright/test";

const API_URL = process.env.PLAYWRIGHT_API_URL ?? "http://localhost:4000";

async function json<T>(response: APIResponse): Promise<T> {
  if (!response.ok()) throw new Error(`${response.status()} ${await response.text()}`);
  return response.json() as Promise<T>;
}

test.describe("CM1 Campaign home and private notes", () => {
  test.use({ storageState: "e2e/.auth/gm.json" });

  test("preserves current context, notes, Items return navigation, and mobile layout", async ({
    browser,
    page,
  }) => {
    const suffix = Date.now();
    const campaignName = `CM1 Campaign ${suffix}`;
    const liveName = `Western Gate ${suffix}`;
    const pausedName = `Council Chamber ${suffix}`;
    const noteContent = `Question the sentry ${suffix}`;
    const campaign = await json<{ campaign: { id: string } }>(
      await page.request.post(`${API_URL}/campaigns`, {
        data: { name: campaignName, status: "active" },
      }),
    );
    const live = await json<{ scenario: { id: string } }>(
      await page.request.post(`${API_URL}/campaigns/${campaign.campaign.id}/scenarios`, {
        data: { name: liveName, status: "live" },
      }),
    );
    await json(
      await page.request.post(`${API_URL}/campaigns/${campaign.campaign.id}/scenarios`, {
        data: { name: pausedName, status: "paused" },
      }),
    );
    await json(
      await page.request.post(`${API_URL}/campaigns/${campaign.campaign.id}/notes`, {
        data: {
          content: noteContent,
          reference: { id: live.scenario.id, label: "Untrusted label", type: "scenario" },
        },
      }),
    );

    await page.setViewportSize({ height: 844, width: 390 });
    await page.goto(`/campaigns/${campaign.campaign.id}`);
    const currentPlay = page.getByRole("region", { name: "Current Scenario and Encounter" });
    const campaignTasks = page.getByRole("navigation", { name: "Campaign tasks" });
    await expect(currentPlay.getByText(liveName, { exact: true })).toBeVisible();
    await expect(currentPlay.getByText(pausedName, { exact: true })).toBeVisible();
    await expect(campaignTasks.getByRole("link", { name: "Membership" })).toBeVisible();
    await expect(campaignTasks.getByRole("link", { name: "Scenarios" })).toBeVisible();
    await expect(campaignTasks.getByRole("link", { name: "Campaign history" })).toBeVisible();
    await expect(campaignTasks.getByRole("link", { name: "Create material" })).toBeVisible();
    await expect(campaignTasks.getByRole("link", { name: "Notes & material" })).toBeVisible();
    await expect(campaignTasks.getByRole("link", { name: "Combat" })).toHaveCount(0);
    await expect(
      currentPlay.locator(
        `a[href="/campaigns/${campaign.campaign.id}/scenarios/${live.scenario.id}"]`,
      ),
    ).toBeVisible();
    await expect(page.locator("#campaign-history")).not.toHaveAttribute("open", "");
    await expect(page.getByRole("heading", { name: "Private GM Notes" })).toBeVisible();
    await expect(page.getByText(noteContent, { exact: true })).toBeVisible();
    await expect(currentPlay.getByText(liveName, { exact: true }).locator("..")).toContainText(
      "Active",
    );
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);

    const campaignTaskTargets = [
      ["Membership", "campaign-membership"],
      ["Scenarios", "campaign-scenarios"],
      ["Campaign history", "campaign-history"],
      ["Create material", "campaign-create-material"],
      ["Notes & material", "campaign-material"],
    ] as const;
    for (const activation of ["pointer", "keyboard"] as const) {
      for (const [label, targetId] of campaignTaskTargets) {
        await page.goto(`/campaigns/${campaign.campaign.id}?tab=maps`);
        const taskLink = page
          .getByRole("navigation", { name: "Campaign tasks" })
          .getByRole("link", { name: label, exact: true });
        await expect(taskLink).toHaveAttribute(
          "href",
          `/campaigns/${campaign.campaign.id}?tab=campaign#${targetId}`,
        );

        if (activation === "pointer") {
          await taskLink.click();
        } else {
          await taskLink.focus();
          await taskLink.press("Enter");
        }

        await expect.poll(() => page.evaluate(() => window.location.hash)).toBe(`#${targetId}`);
        await expect.poll(() => new URL(page.url()).searchParams.get("tab")).toBe("campaign");
        await expect(page.locator(`#${targetId}`)).toBeInViewport();
      }
    }

    await page.getByRole("link", { name: "Items", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Campaign items" })).toBeVisible();
    await page.goBack();
    await expect(page.getByText(noteContent, { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Resolve" }).click();
    await expect(page.getByRole("button", { name: "Reopen" })).toBeVisible();
    await page.reload();
    await expect(page.getByText(noteContent, { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Reopen" })).toBeVisible();
    await page.getByRole("button", { name: "Reopen" }).click();
    await expect(page.getByRole("button", { name: "Resolve" })).toBeVisible();

    await page.setViewportSize({ height: 900, width: 1280 });
    await page.reload();
    const desktopCurrentPlay = page.getByRole("region", {
      name: "Current Scenario and Encounter",
    });
    await expect(desktopCurrentPlay.getByText(liveName, { exact: true })).toBeVisible();
    await expect(desktopCurrentPlay.getByText(pausedName, { exact: true })).toBeVisible();
    await expect(
      page
        .getByRole("region", { name: "Private GM Notes" })
        .getByText(noteContent, { exact: true }),
    ).toBeVisible();

    const unrelated = await browser.newContext({ storageState: "e2e/.auth/unrelated.json" });
    const denied = await unrelated.request.get(
      `${API_URL}/campaigns/${campaign.campaign.id}/workspace-overview`,
    );
    expect(denied.status()).toBe(403);
    expect(await denied.text()).not.toContain(noteContent);
    await unrelated.close();
  });
});
