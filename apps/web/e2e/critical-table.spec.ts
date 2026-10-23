import { expect, test, type Page } from "@playwright/test";

import { CRITICAL_EFFECTS_TABLE } from "@glantri/domain";

/**
 * Rendered verification for the Forgejo #734 Critical Table.
 *
 * Reading the generated Markdown does not discharge this. Forgejo #612 shipped 107 verified cells
 * in a table that rendered as a run-together paragraph of pipe characters, so everything below is
 * asserted against the real DOM the reader gets: rows read out of rendered `<table>` elements, and
 * the excluded vocabulary scanned out of rendered text rather than asserted from memory.
 *
 * Audience note: this page is read-only rules reference material and must become readable by
 * players, but the whole `/admin` subtree is behind a role gate that Forgejo #670 owns. This suite
 * therefore verifies the GM/admin reader and *measures* what a player-only account receives,
 * without asserting a player pass that #670 has not yet delivered.
 */

const CRITICAL_RESULTS = CRITICAL_EFFECTS_TABLE.criticalResults;

const DOCUMENT_PATH = "/admin/rules-docs?doc=critical-table";

/** `critKey` is `family|location|NN`, so the published dimensions rebuild it without publishing it. */
function rebuildCritKey(family: string, location: string, resultNumber: number): string {
  return `${family}|${location}|${String(resultNumber).padStart(2, "0")}`;
}

/**
 * Every section's heading and its rendered rows, read out of the DOM in document order.
 *
 * The reader renderer shifts Markdown heading levels down by one so the page keeps a single `h1`,
 * so the document's `###` family-and-location sections arrive as `h4`.
 */
async function readRenderedSections(page: Page) {
  return page.evaluate(() => {
    const article = document.querySelector("article");
    const sections: { heading: string; rows: string[][] }[] = [];
    let current: { heading: string; rows: string[][] } | undefined;

    for (const node of Array.from(article?.querySelectorAll("h4, table") ?? [])) {
      if (node.tagName === "H4") {
        current = { heading: (node.textContent ?? "").trim(), rows: [] };
        sections.push(current);
        continue;
      }

      if (!current) {
        continue;
      }

      for (const row of Array.from(node.querySelectorAll("tbody tr"))) {
        current.rows.push(
          Array.from(row.querySelectorAll("td")).map((cell) => (cell.textContent ?? "").trim()),
        );
      }
    }

    const headers = Array.from(article?.querySelectorAll("table") ?? []).map((table) =>
      Array.from(table.querySelectorAll("thead th")).map((cell) => (cell.textContent ?? "").trim()),
    );

    return { headers, sections };
  });
}

/**
 * The 16 authoritative result titles of each family-and-location group, in result order.
 *
 * Used to bind a rendered section to its dimensions without parsing its heading.
 */
function authoritativeGroups() {
  const groups = new Map<string, { family: string; location: string; titles: string[] }>();

  for (const result of CRITICAL_RESULTS) {
    const groupKey = `${result.family}|${result.location}`;

    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        family: result.family,
        location: result.location,
        titles: CRITICAL_RESULTS.filter(
          (candidate) =>
            candidate.family === result.family && candidate.location === result.location,
        )
          .slice()
          .sort((left, right) => left.critIndex - right.critIndex)
          .map((candidate) => candidate.title),
      });
    }
  }

  return groups;
}

/**
 * Every rendered row keyed by the authoritative row it belongs to.
 *
 * Rows are located by section and result number, never by title. Measured on this data: titles are
 * **not** unique — 537 distinct titles across 608 results, with 62 titles shared by 133 rows, so
 * `sharp|head|10` and `blunt|head|10` carry the same title while differing in treatment. A locator
 * that finds a row by its title silently reads a different Critical.
 */
function bindRenderedRows(sections: { heading: string; rows: string[][] }[]) {
  const groups = authoritativeGroups();
  const byKey = new Map<string, string[]>();

  for (const section of sections) {
    const renderedTitles = section.rows.map((cells) => cells[2]).join("\u0000");
    const matches = [...groups.values()].filter(
      (group) => group.titles.join("\u0000") === renderedTitles,
    );

    expect(
      matches.length,
      `${section.heading} must match exactly one family and location group by its rendered titles`,
    ).toBe(1);

    for (const cells of section.rows) {
      byKey.set(rebuildCritKey(matches[0].family, matches[0].location, Number(cells[0])), cells);
    }
  }

  return byKey;
}

test.describe("Critical Table", () => {
  test.use({ storageState: "e2e/.auth/gm.json" });

  test("renders every authoritative Critical result exactly once", async ({ page }) => {
    await page.goto(DOCUMENT_PATH);
    /* The document's own heading, by the slug id the renderer assigns: the page also shows the
     * registry title in its header, so the plain name matches twice. */
    await expect(page.locator("#critical-table")).toBeVisible();

    const rendered = await readRenderedSections(page);

    /* The page actually produced tables, so the #612 pipe-text failure cannot pass silently. */
    expect(rendered.headers.length).toBeGreaterThan(0);
    for (const header of rendered.headers) {
      expect(header[0]).toBe("Result");
      expect(header).toContain("What happens");
      expect(header).toContain("GM notes");
    }

    /*
     * No rendered cell may carry an underscored internal code. Forgejo #747's guard covers result
     * titles in the authoritative data; it does not cover this page's other columns, and two of the
     * fields published here are underscored codes at source — `mortalityState` and each effect's
     * `target`. They reach the reader only through a label map and a word transformation, so this
     * asserts the rendered outcome rather than trusting either.
     */
    for (const section of rendered.sections) {
      for (const cells of section.rows) {
        for (const cell of cells) {
          expect(cell, `rendered cell published an underscored code: ${cell}`).not.toMatch(/_/);
        }
      }
    }

    /* Headings come from the generator's own reader labels, so there is one definition of them. */
    const headings = rendered.sections.map((section) => section.heading);
    expect(new Set(headings).size, "section headings must be distinct").toBe(headings.length);
    for (const heading of headings) {
      expect(heading.length, "a section heading rendered empty").toBeGreaterThan(0);
    }

    for (const section of rendered.sections) {
      expect(section.rows.length, `${section.heading} rendered no rows`).toBe(16);
    }

    const renderedKeys = [...bindRenderedRows(rendered.sections).keys()];

    /* Every authoritative result, exactly once, counted against live data at this head. */
    expect(renderedKeys.length).toBe(CRITICAL_RESULTS.length);
    expect(new Set(renderedKeys).size).toBe(renderedKeys.length);
    expect([...new Set(renderedKeys)].sort()).toEqual(
      CRITICAL_RESULTS.map((result) => result.critKey).sort(),
    );
  });

  test("renders cells that trace to the authoritative data across families and locations", async ({
    page,
  }) => {
    await page.goto(DOCUMENT_PATH);
    /* The document's own heading, by the slug id the renderer assigns: the page also shows the
     * registry title in its header, so the plain name matches twice. */
    await expect(page.locator("#critical-table")).toBeVisible();

    const rendered = await readRenderedSections(page);
    const byKey = bindRenderedRows(rendered.sections);

    /*
     * Deliberately spread across every family and six different locations, including both
     * whole-body-only families, rather than sampling the first family only.
     */
    const samples = [
      "sharp|head|10",
      "blunt|arm|12",
      "teeth_claws|chest|07",
      "arrows_bolts|abdomen|14",
      "firearms|upper_leg|03",
      "pointed_weapons|lower_leg|16",
      "falling_crushing|whole_body|09",
      "fire_energy|whole_body|05",
    ];

    for (const critKey of samples) {
      const result = CRITICAL_RESULTS.find((candidate) => candidate.critKey === critKey);
      expect(result, `${critKey} is missing from the authoritative data`).toBeDefined();

      if (!result) {
        continue;
      }

      const cells = byKey.get(critKey);
      expect(cells, `${critKey} has no rendered row`).toBeDefined();

      if (!cells) {
        continue;
      }

      expect(cells[2], `${critKey} title`).toBe(result.title);
      expect(cells[3], `${critKey} body text`).toBe(result.bodyText);
      expect(cells[4], `${critKey} damage floor`).toContain(String(result.minTotalDamage));
      expect(cells[4], `${critKey} damage reason`).toContain(result.minDamageReason);
      expect(cells[6], `${critKey} urgency`).toBe(String(result.urgency));
      expect(cells[1].toLowerCase(), `${critKey} band`).toBe(result.critBand.toLowerCase());

      /* Columns Forgejo #734 QA finding F3 reported as asserted by neither suite. */
      if (result.mortalityState === "none") {
        expect(cells[5], `${critKey} mortality`).toBe("-");
      } else {
        expect(cells[5].toLowerCase(), `${critKey} mortality`).toBe(
          result.mortalityState.replace(/_/g, " "),
        );
      }

      if (typeof result.treatmentGateRaw === "string" && result.treatmentGateRaw.length > 0) {
        expect(cells[9], `${critKey} treatment gate`).toContain(result.treatmentGateRaw);
      }
      if (typeof result.treatmentDifficulty === "number") {
        expect(cells[9], `${critKey} treatment difficulty`).toContain(
          String(result.treatmentDifficulty),
        );
      }

      if (typeof result.selfStaunchWindow === "string" && result.selfStaunchWindow.length > 0) {
        expect(cells[10], `${critKey} self-staunch window`).toContain(result.selfStaunchWindow);
      }
      if (typeof result.selfStaunchLikelihood === "string") {
        expect(cells[10].toLowerCase(), `${critKey} self-staunch likelihood`).toContain(
          result.selfStaunchLikelihood,
        );
      }
    }
  });

  test("never renders an excluded identifier or implementation word", async ({ page }) => {
    await page.goto(DOCUMENT_PATH);
    /* The document's own heading, by the slug id the renderer assigns: the page also shows the
     * registry title in its header, so the plain name matches twice. */
    await expect(page.locator("#critical-table")).toBeVisible();

    const text = await page.evaluate(() => document.querySelector("article")?.textContent ?? "");

    expect(text.length).toBeGreaterThan(1000);

    for (const forbidden of [
      "critKey",
      "sourceSpecialTags",
      "specialFlag",
      "effectKey",
      "sourceField",
      "sourceValue",
      "implementationNote",
      "physicalImmediateOnly",
      "treatmentGateRaw",
      "selfStaunchLikelihood",
      "minTotalDamage",
      "mortalityState",
      "critBand",
      "critIndex",
      "bodyText",
      "sourceNotes",
      "CRITICAL_RESULTS",
      "criticalEffectsTableData",
      "AppFacing_Crits",
      ".xlsx",
      "sha256",
      "manifest",
      "fixture",
      "Pilot",
    ]) {
      expect(text, `rendered page must not show ${JSON.stringify(forbidden)}`).not.toContain(
        forbidden,
      );
    }

    expect(text, "rendered page must not use C1 implementation vocabulary").not.toMatch(/\bC1\b/);

    for (const result of CRITICAL_RESULTS) {
      expect(text, `rendered page must not show the row key ${result.critKey}`).not.toContain(
        result.critKey,
      );
    }
  });

  test("gives every section a reachable anchor", async ({ page }) => {
    await page.goto(DOCUMENT_PATH);
    /* The document's own heading, by the slug id the renderer assigns: the page also shows the
     * registry title in its header, so the plain name matches twice. */
    await expect(page.locator("#critical-table")).toBeVisible();

    /*
     * The contents links are written against the renderer's heading-`id` contract. Every link must
     * resolve to an element the page actually carries, or the reader is handed a dead anchor.
     */
    const anchors = await page.evaluate(() => {
      const article = document.querySelector("article");
      const targets = Array.from(article?.querySelectorAll('a[href^="#"]') ?? []).map((link) =>
        (link.getAttribute("href") ?? "").slice(1),
      );
      const ids = Array.from(article?.querySelectorAll("h4[id]") ?? []).map((heading) =>
        heading.getAttribute("id"),
      );
      return { ids, targets };
    });

    const combinations = new Set(
      CRITICAL_RESULTS.map((result) => `${result.family}|${result.location}`),
    );

    expect(anchors.targets.length).toBe(combinations.size);
    expect(anchors.ids.length).toBe(combinations.size);

    for (const target of anchors.targets) {
      expect(anchors.ids, `contents link #${target} has no heading`).toContain(target);
    }
  });
});

test.describe("Critical Table audience", () => {
  test.use({ storageState: "e2e/.auth/player.json" });

  /**
   * A measurement, not a pass.
   *
   * Forgejo #670 owns the `/admin` audience gate and this lane must not implement audience routing,
   * so a player-only account cannot yet read this page in the interface. What this test pins is the
   * two things that must stay true until #670 lands: the page is reached rather than erroring, and
   * the gate is the client-only one already recorded, which is not a confidentiality boundary. It
   * asserts the current state so that #670 changing it is a visible, deliberate change here.
   */
  test("is currently withheld from a player-only account by the /admin role gate", async ({
    page,
  }) => {
    const response = await page.goto(DOCUMENT_PATH);

    /* The route is healthy: this is a role gate, never a broken page. */
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: "Admin access required" })).toBeVisible();

    /* The reader cannot see the catalogue: the gate replaces the document, so nothing renders. */
    await expect(page.locator("#critical-table")).toHaveCount(0);
    await expect(page.locator("article table")).toHaveCount(0);

    /*
     * And the measured half that must not be mistaken for a confidentiality boundary. `RequireRole`
     * is a client component, so the server-rendered document it wraps still ships inside the 200
     * response body: the catalogue is present in the RSC payload even though no reader can see it.
     * This is why "the page looked right" proves nothing about authorization in either direction,
     * and why this lane claims only readability, never secrecy. The page is read-only rules
     * reference material and nothing here is confidential, so the leak is not a defect — but the
     * assertion is kept so that anyone who later reads this gate as protection is contradicted by
     * a test. Forgejo #670 owns making the table readable by players.
     */
    const body = await page.content();
    expect(body).toContain("Families and locations");
  });
});
