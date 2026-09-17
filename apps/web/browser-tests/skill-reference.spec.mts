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
    await expect(page.getByRole("tab")).toHaveCount(4);
    await page.getByText("How the Skill system works").click();

    await page.getByRole("tab", { name: "Professions" }).click();
    await page
      .getByRole("searchbox", { name: "Search Professions, tracks, or training" })
      .fill("Sailor and Boat Worker");
    await expect(page.getByText(/alternative training routes here/)).toBeVisible();
    await page.getByRole("link", { name: "Working a boat" }).first().click();
    await expect(page.getByRole("tab", { name: "Learning Groups" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(page.getByRole("heading", { name: "Working a boat" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: testInfo.outputPath(`skill-reference-${viewport.width}.png`) });
  });
}
