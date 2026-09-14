import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

import { expect, test } from "@playwright/test";
import react from "@vitejs/plugin-react";

// Reuse Vitest's installed Vite runtime; this fixture needs no application/API/database service.
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
    root: fileURLToPath(new URL("./combat-tracker", import.meta.url)),
    plugins: [react()],
    resolve: {
      alias: {
        "@glantri/domain": fileURLToPath(
          new URL("../../../packages/domain/src/index.ts", import.meta.url),
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
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
]) {
  test(`Critical participant step accepts pointer clicks at ${viewport.width}px`, async ({
    page,
  }, testInfo) => {
    page.on("pageerror", (error) => {
      throw error;
    });
    await page.setViewportSize(viewport);
    await page.goto(baseURL);
    const grid = page.getByLabel("Combat round timeline grid");
    const button = grid.getByRole("button", { name: /Treated guard.*Round 1 · DE:/ });
    await expect(button).toBeVisible();
    // Plain clicks must pass native browser hit testing: no force, script dispatch, or keyboard fallback.
    await button.click({ timeout: 5000 });
    await expect(page.getByLabel("Inspected participant step")).toContainText("Round 1 · DE:");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: testInfo.outputPath("pointer-inspection.png") });
    // The horizontal timeline remains navigable in both directions.
    await grid.getByRole("button", { name: /Round 1 · round_summary:/ }).click({ timeout: 5000 });
    await expect(page.getByLabel("Inspected participant step")).toContainText("round_summary:");
    await button.click({ timeout: 5000 });
    await expect(page.getByLabel("Inspected participant step")).toContainText("Round 1 · DE:");
    await page.reload();
    await button.click({ timeout: 5000 });
    await expect(page.getByLabel("Inspected participant step")).toContainText("Round 1 · DE:");
  });
}
