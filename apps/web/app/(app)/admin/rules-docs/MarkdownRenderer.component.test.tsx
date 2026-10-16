import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { getRulesDocumentById, getRulesDocumentEntryById } from "@/lib/rulesDocs";
import { MarkdownRenderer } from "./MarkdownRenderer";

/**
 * `fileName` is the registry path of the document the markdown came from, which is what lets a
 * relative target be resolved against the registry. `competency-rules.md` is a registered
 * root-level page, so these renders see exactly the resolution the reader surface does.
 */
function render(markdown: string, fileName = "competency-rules.md"): string {
  return renderToStaticMarkup(createElement(MarkdownRenderer, { fileName, markdown }));
}

describe("rules docs markdown renderer (rendered output)", () => {
  it("resolves a link to a registered page onto the live reader route", () => {
    const html = render(
      "See [Combat To Hit](./combat-to-hit.md) for the hit/miss lookup.",
      "combat-round-and-actions.md",
    );

    expect(html).toContain('<a href="/admin/rules-docs?doc=combat-to-hit">Combat To Hit</a>');
    /* The defect this replaces: the link painted verbatim, brackets and parentheses included. */
    expect(html).not.toContain("[Combat To Hit]");
    expect(html).not.toContain("(./combat-to-hit.md)");
  });

  it("resolves a registered target reached through a subdirectory and back out of one", () => {
    expect(
      render("See [Criticals](./gm/criticals.md) now.", "combat-round-and-actions.md"),
    ).toContain('<a href="/admin/rules-docs?doc=gm-criticals">Criticals</a>');

    /* `player/parry.md` links back out to a root page, and keeps the author's fragment. */
    expect(
      render(
        "See [Observe Opponent](../combat-round-and-actions.md#8-observe-opponent) now.",
        "player/parry.md",
      ),
    ).toContain(
      '<a href="/admin/rules-docs?doc=combat-round-and-actions#8-observe-opponent">Observe Opponent</a>',
    );
  });

  it("renders a link inside a table cell, which is how a reader finds the right page", () => {
    const html = render(
      `| Question | Authority |
| --- | --- |
| Which Skills exist? | [Competency Rules](./competency-rules.md) |
`,
      "combat-round-and-actions.md",
    );

    expect(html).toContain('<td style="');
    expect(html).toContain('<a href="/admin/rules-docs?doc=competency-rules">Competency Rules</a>');
  });

  it("renders a target with no reader route as visible text, not a dead anchor", () => {
    /**
     * `pilot-skill-rules-v1.md` and `competency-reference/skills.md` are deliberately unregistered,
     * and `docs/decisions` is outside `docs/rules` altogether. None has a reader route, so the
     * author's visible label is shown as text. Nothing is registered to make such a link work.
     */
    for (const [markdown, label] of [
      [
        "Superseded by [`pilot-skill-rules-v1.md`](./pilot-skill-rules-v1.md).",
        "pilot-skill-rules-v1.md",
      ],
      ["Settled by [rule decision 0011](../decisions/rules/0011-shared.md).", "rule decision 0011"],
      ["Listed under [Skills](./competency-reference/skills.md).", "Skills"],
    ] as const) {
      const html = render(markdown);

      expect(html).not.toContain("<a ");
      expect(html).toContain(label);
      /* And the markdown syntax itself is gone — the reader sees the label, not the source. */
      expect(html).not.toContain("](");
    }
  });

  it("keeps inline code and bold inside a link's own text", () => {
    const html = render(
      "Superseded by [`combat-to-hit.md`](./combat-to-hit.md).",
      "combat-round-and-actions.md",
    );

    expect(html).toContain(
      '<a href="/admin/rules-docs?doc=combat-to-hit"><code>combat-to-hit.md</code></a>',
    );
  });

  it("keeps a same-page fragment as a fragment, and emits the heading id it points at", () => {
    const html = render(`## 6. Distance

Back to [section 6](#6-distance).
`);

    expect(html).toContain('<h3 id="6-distance"');
    expect(html).toContain('<a href="#6-distance">section 6</a>');
  });

  it("emits deterministic heading ids document authors can rely on", () => {
    const html = render(`# Combat Round, Loadout and Actions

## 6. Distance

### 7.3 Feint - Attack

### 7.4 Adjust Distance-Attack

### \`sharp|head|10\` — Severe concussion

#### Where each value came from
`);

    /* Punctuation is dropped, and each space it stood between becomes a hyphen. */
    expect(html).toContain('<h2 id="combat-round-loadout-and-actions"');
    expect(html).toContain('<h3 id="6-distance"');
    expect(html).toContain('<h4 id="73-feint---attack"');
    expect(html).toContain('<h4 id="74-adjust-distance-attack"');
    /* Inline code contributes its text, not its backticks or the pipes inside it. */
    expect(html).toContain('<h4 id="sharphead10--severe-concussion"');
    expect(html).toContain('<h5 id="where-each-value-came-from"');
  });

  it("suffixes duplicate heading slugs in document order", () => {
    const html = render(`## Notes

## Notes

## Notes
`);

    expect(html).toContain('<h3 id="notes"');
    expect(html).toContain('<h3 id="notes-1"');
    expect(html).toContain('<h3 id="notes-2"');
  });

  it("omits the id entirely for a heading with nothing sluggable in it", () => {
    expect(render("## ***")).not.toContain('id=""');
  });

  it("leaves inline code and bold outside links exactly as they were", () => {
    expect(render("A `code` span and a **bold** run.")).toBe(
      render("A `code` span and a **bold** run."),
    );
    expect(render("A `code` span and a **bold** run.")).toContain("<code>code</code>");
    expect(render("A `code` span and a **bold** run.")).toContain("<strong>bold</strong>");
  });

  it("leaves malformed and degenerate link syntax as visible text", () => {
    /* No anchor may be produced for any of these, and none may swallow its surrounding text. */
    for (const malformed of [
      "Before unclosed [text](./competency-rules.md after",
      "Before bare [text] after",
      "Before empty text [](./competency-rules.md) after",
      "Before empty target [text]() after",
      "Before nested [outer [inner] text](./competency-rules.md) after",
    ]) {
      const html = render(malformed);

      expect(html).not.toContain("<a ");
      /* The text on both sides of the malformed syntax survives. */
      expect(html).toContain("Before");
      expect(html).toContain("after");
    }
  });

  it("refuses a link target carrying an executable scheme", () => {
    const html = render("Do not link [click me](javascript:void) from document content.");

    expect(html).not.toContain("<a ");
    expect(html).toContain("javascript:void");
  });

  it("keeps an ordinary web address as a real link", () => {
    expect(render("Tracked as [issue #211](https://example.test/issues/211).")).toContain(
      '<a href="https://example.test/issues/211">issue #211</a>',
    );
  });
});

/**
 * Forgejo #651's cross-page references, rendered rather than computed.
 *
 * Both are `#fragment` targets into another registered page, and the slug contract is only a
 * contract: #612 verified 107 published cells while its flagship table rendered as pipe text,
 * because nobody rendered the page. So each reference is checked twice from the real registered
 * Markdown — the anchor the referring page emits, and the heading `id` on the page it points at —
 * and a renamed heading on either side fails here.
 */
describe("the registered reader pages' cross-page fragment references resolve when rendered", () => {
  async function renderPage(id: string): Promise<string> {
    const document = await getRulesDocumentById(id);
    const entry = getRulesDocumentEntryById(id);

    return renderToStaticMarkup(
      createElement(MarkdownRenderer, {
        fileName: entry.fileName,
        markdown: document.markdown,
      }),
    );
  }

  it("renders the C1 boundary authority heading combat-to-hit.md links to", async () => {
    const referring = await renderPage("combat-to-hit");
    const authority = await renderPage("combat-critical-effects");

    expect(referring).toContain(
      '<a href="/admin/rules-docs?doc=combat-critical-effects#c1-representative-fixture-authority">',
    );
    expect(authority).toContain('id="c1-representative-fixture-authority"');
  });

  it("renders the next-check schedule section combat-round-and-actions.md links to", async () => {
    const referring = await renderPage("combat-round-and-actions");
    const schedule = await renderPage("combat-experience");

    expect(referring).toContain(
      '<a href="/admin/rules-docs?doc=combat-experience#when-the-next-check-is-due">schedule</a>',
    );
    expect(schedule).toContain('id="when-the-next-check-is-due"');
    /* The schedule is a table, so it must render as one rather than as a row of pipe characters. */
    expect(schedule).toContain("<th");
    expect(schedule).toContain("Next check due");
    expect(schedule).not.toContain("| Result rolled in round |");
  });

  it("renders no development-tracker anchor on the GM Parry procedure", async () => {
    const html = await renderPage("gm-parry");

    expect(html).not.toContain("github.com");
    expect(html).toContain("Parry internal notes");
    /* The internal notes are deliberately unregistered, so the label stays text, not a dead link. */
    expect(html).not.toContain("internal/parry-notes.md");
  });
});
