import { expect, test } from "@playwright/test";

/**
 * Forgejo #743 — rendered proof that authored paragraph boundaries are visible.
 *
 * This defect existed precisely because source-level verification looked fine. The authored blank
 * lines reached the DOM in `textContent` on every record and displayed as nothing, because
 * `skillsReference.module.css` set no `white-space` on `.lede` or `.prose` and `normal` collapses a
 * blank line to a single space. So this spec never asserts on `textContent` alone: for every case
 * it reads `innerText` (what a reader sees), `textContent` (the stored text), the computed
 * `white-space` and `childElementCount`.
 *
 * Before and after are measured on the same build, on the same elements, because the whole change
 * under test is one declaration: the "before" reading is taken with `white-space: normal` forced
 * back on as an inline style, then reverted. `childElementCount` stays 0 throughout, which is what
 * distinguishes the CSS route taken here from a component route that would split the text into
 * paragraph elements.
 */

test.use({ storageState: "e2e/.auth/player.json" });

type Reading = {
  index: number;
  whiteSpace: string;
  childElementCount: number;
  textContent: string;
  innerTextAfter: string;
  innerTextBefore: string;
  whiteSpaceBefore: string;
};

/**
 * Reads every paragraph of one Inspector article, after and before, over the single declaration.
 */
async function readArticle(
  page: import("@playwright/test").Page,
  articleId: string,
): Promise<Reading[]> {
  return page.evaluate((id) => {
    const article = document.getElementById(id);
    if (!article) throw new Error(`No Inspector article #${id} is rendered.`);
    /* Direct paragraph children only: the Inspector's own lede and prose, not Block bodies. */
    const paragraphs = [...article.children].filter(
      (child): child is HTMLParagraphElement => child.tagName === "P",
    );
    return paragraphs.map((p, index) => {
      const whiteSpace = getComputedStyle(p).whiteSpace;
      const textContent = p.textContent ?? "";
      const innerTextAfter = p.innerText;
      const childElementCount = p.childElementCount;
      /* "Before": put `normal` back, which is exactly what this lane changed. */
      const restore = p.style.whiteSpace;
      p.style.whiteSpace = "normal";
      const whiteSpaceBefore = getComputedStyle(p).whiteSpace;
      const innerTextBefore = p.innerText;
      p.style.whiteSpace = restore;
      return {
        index,
        whiteSpace,
        childElementCount,
        textContent,
        innerTextAfter,
        innerTextBefore,
        whiteSpaceBefore,
      };
    });
  }, articleId);
}

/** The paragraph that carries the authored multi-paragraph prose for this case. */
function withAuthoredBreaks(readings: Reading[]): Reading {
  const found = readings.filter((row) => row.textContent.includes("\n\n"));
  expect(
    found.length,
    `exactly one paragraph should carry authored blank lines, got ${found.length}`,
  ).toBe(1);
  return found[0]!;
}

/** Compact, quotable evidence for the lane record; the assertions below are what actually gate. */
function report(reading: Reading, label: string) {
  const shape = (text: string) =>
    `len=${text.length} NL=${(text.match(/\n/g) ?? []).length} blankLines=${(text.match(/\n[ \t]*\n/g) ?? []).length}`;
  // eslint-disable-next-line no-console
  console.log(
    `#743 ${label}: white-space after=${reading.whiteSpace} before=${reading.whiteSpaceBefore} ` +
      `childElementCount=${reading.childElementCount} | textContent ${shape(reading.textContent)} | ` +
      `innerText before ${shape(reading.innerTextBefore)} | innerText after ${shape(reading.innerTextAfter)}`,
  );
}

function assertBoundariesBecameVisible(reading: Reading, label: string) {
  report(reading, label);
  /* The rule reached the element. */
  expect(reading.whiteSpace, `${label}: computed white-space`).toBe("pre-line");
  expect(reading.whiteSpaceBefore, `${label}: forced-back white-space`).toBe("normal");
  /* Before: the authored boundary was in the stored text and invisible to a reader. */
  expect(reading.textContent, `${label}: stored text carries a blank line`).toMatch(/\n\s*\n/);
  expect(reading.innerTextBefore, `${label}: before, no blank line was rendered`).not.toMatch(
    /\n[ \t]*\n/,
  );
  /* After: the reader sees them. */
  expect(reading.innerTextAfter, `${label}: after, blank lines render`).toMatch(/\n[ \t]*\n/);
  const authored = (reading.textContent.match(/\n\n/g) ?? []).length;
  const rendered = (reading.innerTextAfter.match(/\n[ \t]*\n/g) ?? []).length;
  expect(rendered, `${label}: every authored boundary renders`).toBe(authored);
  /* The stored text is untouched and no element was introduced: presentation only. */
  expect(reading.childElementCount, `${label}: no paragraph elements introduced`).toBe(0);
  expect(
    reading.innerTextAfter.replace(/\n+/g, "\n"),
    `${label}: after-text is the stored text, only its newlines now shown`,
  ).toBe(reading.textContent.replace(/\n+/g, "\n"));
}

function assertUnchangedByTheRule(reading: Reading, label: string) {
  report(reading, label);
  expect(reading.textContent, `${label}: carries no newline`).not.toMatch(/\n/);
  expect(reading.innerTextAfter, `${label}: renders identically before and after`).toBe(
    reading.innerTextBefore,
  );
}

test.describe("#743 authored paragraph boundaries are visible in the catalogue Inspectors", () => {
  test("a Skill with several paragraphs — Swimming", async ({ page }) => {
    await page.goto("/skills#skill-swimming");
    await expect(page.getByRole("heading", { name: "Swimming", exact: true })).toBeVisible();
    const readings = await readArticle(page, "skill-swimming");
    assertBoundariesBecameVisible(withAuthoredBreaks(readings), "Swimming .lede");
  });

  test("a Learning Group with several paragraphs — Diving and underwater work practice", async ({
    page,
  }) => {
    /* Learning Group anchors are name slugs; `#group-<id>` is the withdrawn-group Inspector. */
    await page.goto("/skills#group-diving-and-underwater-work-practice");
    await expect(
      page.getByRole("heading", { name: "Diving and underwater work practice" }),
    ).toBeVisible();
    const readings = await readArticle(page, "group-diving-and-underwater-work-practice");
    const full = withAuthoredBreaks(readings);
    assertBoundariesBecameVisible(full, "Diving .prose");
    /* ProseIntroduction emits the lede immediately before the full prose. It is the frozen
     * catalogue short description, which this lane must leave exactly as a reader saw it. */
    const lede = readings.find((row) => row.index === full.index - 1);
    expect(lede, "the ProseIntroduction lede paragraph").toBeDefined();
    expect(lede!.whiteSpace, "the lede carries the same class").toBe("pre-line");
    assertUnchangedByTheRule(lede!, "Diving .lede (frozen shortDescription)");
  });

  test("a Profession with a full description — Soldier", async ({ page }) => {
    await page.goto("/skills#profession-soldier");
    await expect(page.getByRole("heading", { name: "Soldier", exact: true })).toBeVisible();
    const readings = await readArticle(page, "profession-soldier");
    assertBoundariesBecameVisible(withAuthoredBreaks(readings), "Soldier .prose");
  });

  test("an unaffected prose surface using the same classes — the Society Inspector", async ({
    page,
  }) => {
    await page.goto("/skills#society-forager-ritual-tribal");
    await expect(page.getByRole("heading", { name: "Forager / ritual-tribal" })).toBeVisible();
    const readings = await readArticle(page, "society-forager-ritual-tribal");
    /* Nothing here is multi-paragraph, so the rule must change nothing a reader sees. */
    expect(readings.filter((row) => row.textContent.includes("\n\n"))).toEqual([]);
    const styled = readings.filter((row) => row.whiteSpace === "pre-line");
    expect(styled.length, "the Society lede and the Arch Society line carry the classes").toBe(2);
    for (const reading of styled)
      assertUnchangedByTheRule(reading, `Society paragraph ${reading.index}`);
    /* The Arch Society line is a composed paragraph: its element children must survive untouched. */
    const arch = readings.find((row) => row.textContent.startsWith("Arch Society:"));
    expect(arch, "the Arch Society .prose line").toBeDefined();
    expect(arch!.childElementCount, "the <strong> label is still there").toBe(1);
  });
});
