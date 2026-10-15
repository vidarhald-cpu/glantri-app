import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { MarkdownRenderer, parseMarkdownBlocks } from "./MarkdownRenderer";

function render(markdown: string): string {
  return renderToStaticMarkup(createElement(MarkdownRenderer, { markdown }));
}

describe("rules docs markdown renderer", () => {
  it("parses headings, code blocks, and tables used by calculation docs", () => {
    const blocks = parseMarkdownBlocks(`# Title

Formula:

\`\`\`text
Displayed GM = trunc((Current stat - 11) / 2)
\`\`\`

| Label | Value |
| --- | --- |
| GM | 2 |
`);

    expect(blocks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          text: "Title",
          type: "heading",
        }),
        expect.objectContaining({
          code: "Displayed GM = trunc((Current stat - 11) / 2)",
          language: "text",
          type: "code",
        }),
        expect.objectContaining({
          rows: [
            ["Label", "Value"],
            ["GM", "2"],
          ],
          type: "table",
        }),
      ]),
    );
  });

  it("renders an ordinary markdown link as an anchor named by its visible text", () => {
    const html = render("See [Competency Rules](./competency-rules.md) for the Skill authority.");

    expect(html).toContain('<a href="./competency-rules.md">Competency Rules</a>');
    /* The defect this replaces: the link painted verbatim, brackets and parentheses included. */
    expect(html).not.toContain("[Competency Rules]");
    expect(html).not.toContain("(./competency-rules.md)");
  });

  it("renders a link inside a table cell, which is how a reader finds the right page", () => {
    const html = render(`| Question | Authority |
| --- | --- |
| Which Skills exist? | [Competency Rules](./competency-rules.md) |
`);

    expect(html).toContain('<td style="');
    expect(html).toContain('<a href="./competency-rules.md">Competency Rules</a>');
  });

  it("keeps inline code and bold inside a link's own text", () => {
    const html = render("Superseded by [`pilot-skill-rules-v1.md`](./pilot-skill-rules-v1.md).");

    expect(html).toContain(
      '<a href="./pilot-skill-rules-v1.md"><code>pilot-skill-rules-v1.md</code></a>',
    );
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
      "Before unclosed [text](./target.md after",
      "Before bare [text] after",
      "Before empty text [](./target.md) after",
      "Before empty target [text]() after",
      "Before nested [outer [inner] text](./target.md) after",
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
});
