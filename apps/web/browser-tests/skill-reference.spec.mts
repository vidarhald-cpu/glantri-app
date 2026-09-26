import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { expect, test } from "@playwright/test";
import react from "@vitejs/plugin-react";

const require = createRequire(import.meta.url);
const viteUrl = new URL(
  "./dist/node/index.js",
  pathToFileURL(
    require.resolve("vite/package.json", {
      paths: [require.resolve("vitest/package.json")],
    }),
  ),
).href;
let close: () => Promise<void>;
let baseURL: string;

test.beforeAll(async () => {
  const { createServer } = await import(viteUrl);
  const server = await createServer({
    configFile: false,
    define: { "process.env": "{}" },
    root: fileURLToPath(new URL("./skill-reference", import.meta.url)),
    plugins: [react()],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("../src", import.meta.url)),
        "@glantri/content": fileURLToPath(
          new URL("../../../packages/content/src/index.ts", import.meta.url),
        ),
        "@glantri/domain": fileURLToPath(
          new URL("../../../packages/domain/src/index.ts", import.meta.url),
        ),
        "@glantri/rules-engine": fileURLToPath(
          new URL("../../../packages/rules-engine/src/index.ts", import.meta.url),
        ),
        "@glantri/shared": fileURLToPath(
          new URL("../../../packages/shared/src/index.ts", import.meta.url),
        ),
      },
    },
    server: { host: "127.0.0.1", port: 0 },
  });
  await server.listen();
  baseURL = server.resolvedUrls.local[0];
  close = () => server.close();
});

test.afterAll(async () => {
  await close?.();
});

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
]) {
  test(`Skill reference stays usable at ${viewport.width}px`, async ({ page }, testInfo) => {
    page.on("pageerror", (error) => {
      throw error;
    });
    await page.setViewportSize(viewport);
    await page.goto(baseURL);
    await expect(page.getByRole("heading", { name: "Skills and training" })).toBeVisible();
    /* The five required conceptual areas of the competency reference: Skills, Learning Groups,
       Professions, Societies, and the Rules area under its "How it works" label. */
    await expect(page.getByRole("tab")).toHaveCount(5);
    await page.getByRole("tab", { name: "How it works" }).click();
    await expect(
      page.getByRole("heading", { name: "How competency works in Glantri" }),
    ).toBeVisible();

    await page.getByRole("tab", { name: "Professions" }).click();
    const search = page.getByRole("searchbox", { name: "Search Professions, tracks, or training" });
    await search.fill("Sailor and Boat Worker");
    await page
      .getByRole("button", { name: "Sailor and Boat Worker — Small-craft boat worker" })
      .click();
    /* The Inspector opens with the occupation, and lists the Skills it can train without the reader
       opening every Learning Group by hand. */
    await expect(page.getByRole("heading", { name: "What can I learn?" })).toBeVisible();
    await expect(page.getByText(/possible reach, not effective breadth/)).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /^Skills this Profession can train/ }),
    ).toBeVisible();
    /* Society Level rows by Social Band columns, last in the Inspector. */
    await expect(page.getByRole("table", { name: "Society Level by Social Band" })).toBeVisible();

    /* G06 "Working a boat" was removed by the V2 redesign; N01 is the canonical practice. */
    await page.getByRole("link", { name: "Small-craft boat working" }).first().click();
    await expect(page.getByRole("tab", { name: "Learning Groups" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(page.getByRole("heading", { name: "Small-craft boat working" })).toBeVisible();
    /* N01 has no published full prose, so the Inspector says so instead of showing its one-liner. */
    await expect(
      page.getByText(/A full description of this training practice has not been published/),
    ).toBeVisible();

    /* Following the relationship kept the reader's Profession search. */
    await page.getByRole("tab", { name: "Professions" }).click();
    await expect(search).toHaveValue("Sailor and Boat Worker");

    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: testInfo.outputPath(`skill-reference-${viewport.width}.png`) });
  });
}
