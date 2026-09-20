import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

import { expect, test, type Locator } from "@playwright/test";
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
    root: fileURLToPath(new URL("./artifact-inspection", import.meta.url)),
    plugins: [react()],
    // No HMR: a mid-test dependency re-optimization must not reload the page.
    server: { hmr: false, host: "127.0.0.1", port: 0 },
  });
  await server.listen();
  baseURL = server.resolvedUrls.local[0];
  close = () => server.close();
});
test.afterAll(async () => {
  await close?.();
});

async function box(locator: Locator) {
  const value = await locator.boundingBox();
  if (!value) throw new Error("Expected a laid-out element.");
  return value;
}

function overlaps(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

/**
 * Waits for the material's `transform 100ms ease-out` transition (see
 * `mediaInspection.module.css`) to actually finish before the caller reads a
 * bounding box, instead of racing it. A fixed timeout is only a safety net in
 * case a transition never starts (for example when a zoom/pan step produces
 * no visual change) or `transitionend` is otherwise missed.
 */
async function settled(locator: Locator): Promise<void> {
  await locator.evaluate(
    (element) =>
      new Promise<void>((resolve) => {
        const durations = getComputedStyle(element)
          .transitionDuration.split(",")
          .map((value) => parseFloat(value) || 0);
        if (Math.max(0, ...durations) === 0) {
          resolve();
          return;
        }
        let done = false;
        const finish = () => {
          if (done) return;
          done = true;
          element.removeEventListener("transitionend", onEnd);
          resolve();
        };
        const onEnd = (event: Event) => {
          if ((event as TransitionEvent).propertyName === "transform") finish();
        };
        element.addEventListener("transitionend", onEnd);
        // Safety net: the transition is fixed at 100ms in mediaInspection.module.css.
        setTimeout(finish, 400);
      }),
  );
}

for (const viewport of [
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
]) {
  test(`Artifact inspection uses the whole viewport at ${viewport.width}px`, async ({
    page,
  }, testInfo) => {
    page.on("pageerror", (error) => {
      throw error;
    });
    await page.setViewportSize(viewport);
    await page.goto(baseURL);

    const trigger = page.getByRole("button", { name: "Inspect Northern pass" });
    await trigger.click();

    const inspection = page.getByRole("dialog", { name: "Northern pass" });
    await expect(inspection).toBeVisible();

    // Campaign chrome no longer consumes the viewport.
    const shell = await box(inspection);
    expect(shell.width).toBeGreaterThanOrEqual(viewport.width - 1);
    expect(shell.height).toBeGreaterThanOrEqual(viewport.height - 1);

    // Controls never cover the inspected material.
    const stage = await box(page.getByRole("group", { name: "Pan and zoom Artifact" }));
    const header = await box(inspection.locator("header"));
    const exit = await box(page.getByRole("button", { name: "Close inspection" }));
    const zoomIn = await box(page.getByRole("button", { name: "Zoom in" }));
    const fit = await box(page.getByRole("button", { name: "Fit to screen" }));
    for (const control of [header, exit, zoomIn, fit]) {
      expect(overlaps(stage, control)).toBe(false);
    }

    // The material is scaled to fit the inspection area rather than the card.
    const image = await box(inspection.getByRole("img", { name: "A mountain pass map" }));
    expect(image.width).toBeLessThanOrEqual(stage.width + 1);
    expect(image.height).toBeLessThanOrEqual(stage.height + 1);
    expect(image.width).toBeGreaterThan(viewport.width * 0.6);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: testInfo.outputPath("inspection-open.png") });

    // The obvious way out takes focus first.
    await expect(page.getByRole("button", { name: "Close inspection" })).toBeFocused();

    // Keyboard zoom and pan act on the material. Each box is read only after
    // the CSS transform transition has settled (see `settled` above) so the
    // assertions check the actual end state rather than a mid-animation frame.
    const material = inspection.getByRole("img", { name: "A mountain pass map" });
    await page.getByRole("group", { name: "Pan and zoom Artifact" }).focus();
    await page.keyboard.press("+");
    await page.keyboard.press("+");
    await settled(material);
    await expect(page.getByText("Zoom 150%")).toBeVisible();
    const zoomed = await box(material);
    expect(zoomed.width).toBeGreaterThan(image.width);
    await page.keyboard.press("ArrowRight");
    await settled(material);
    const panned = await box(material);
    expect(panned.x).toBeGreaterThan(zoomed.x);
    await page.keyboard.press("0");
    await settled(material);
    await expect(page.getByText("Zoom 100%")).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("inspection-keyboard.png") });

    // Tab stays inside the inspection.
    await page.getByRole("button", { name: "Close inspection" }).focus();
    for (let step = 0; step < 6; step += 1) {
      await page.keyboard.press("Tab");
      expect(
        await page.evaluate(() => document.activeElement?.closest('[role="dialog"]') !== null),
      ).toBe(true);
    }

    // Escape exits and returns focus to the surface that opened the inspection.
    await page.keyboard.press("Escape");
    await expect(inspection).toBeHidden();
    await expect(trigger).toBeFocused();
    await page.screenshot({ path: testInfo.outputPath("inspection-closed.png") });
  });

  test(`Focused Artifact page inspection uses the whole viewport at ${viewport.width}px`, async ({
    page,
  }, testInfo) => {
    page.on("pageerror", (error) => {
      throw error;
    });
    await page.setViewportSize(viewport);
    await page.goto(`${baseURL}#page`);

    await expect(page.getByRole("heading", { name: "Northern pass" })).toBeVisible();
    const exit = page.getByRole("button", { name: "Back to Blackboard" });
    await expect(exit).toBeVisible();

    const stage = await box(page.getByRole("group", { name: "Pan and zoom Artifact" }));
    expect(stage.height).toBeGreaterThan(viewport.height * 0.5);
    expect(overlaps(stage, await box(exit))).toBe(false);
    expect(overlaps(stage, await box(page.getByRole("button", { name: "Zoom in" })))).toBe(false);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: testInfo.outputPath("focused-page.png") });
  });
}
