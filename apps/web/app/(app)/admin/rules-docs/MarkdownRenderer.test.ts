import { describe, expect, it } from "vitest";

import { parseMarkdownBlocks } from "./MarkdownRenderer";

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
});

/**
 * Forgejo: the reader renderer dropped a wrapped list item's continuation lines.
 *
 * `parseMarkdownBlocks` matched list items one source line at a time and ended the list at the
 * first line that carried no marker. Prettier wraps `docs/rules` prose at 100 columns, so every
 * item longer than that arrived as a marker line followed by an indented continuation line: the
 * item was truncated at the wrap, its tail became a separate paragraph block, and the following
 * item opened a brand-new list that restarted its numbering at 1.
 */
describe("a wrapped list item keeps its continuation lines", () => {
  it("joins an indented continuation line into the item it belongs to", () => {
    expect(
      parseMarkdownBlocks(`2. After a hit or grazing hit, confirm the defender-owned Current Action and its available main-hand
   and/or off-hand Parry sources.
`),
    ).toEqual([
      {
        items: [
          "After a hit or grazing hit, confirm the defender-owned Current Action and its available main-hand and/or off-hand Parry sources.",
        ],
        ordered: true,
        type: "list",
      },
    ]);
  });

  it("keeps a wrapped ordered list as one list, so its numbering does not restart", () => {
    const blocks = parseMarkdownBlocks(`1. First item, unwrapped.
2. Second item, which runs past the column limit and therefore
   continues here.
3. Third item, which also runs past the column limit and
   continues here.
`);

    expect(blocks).toEqual([
      {
        items: [
          "First item, unwrapped.",
          "Second item, which runs past the column limit and therefore continues here.",
          "Third item, which also runs past the column limit and continues here.",
        ],
        ordered: true,
        type: "list",
      },
    ]);
  });

  it("joins an unwrapped continuation that is not indented at all", () => {
    /* GFM lazy continuation does not require the indent, and neither does this. */
    expect(parseMarkdownBlocks("- An item that wraps\nonto the next line.\n")).toEqual([
      { items: ["An item that wraps onto the next line."], ordered: false, type: "list" },
    ]);
  });

  it("ends the item at a blank line, so the next paragraph stays a paragraph", () => {
    expect(parseMarkdownBlocks("- An item.\n\nA following paragraph.\n")).toEqual([
      { items: ["An item."], ordered: false, type: "list" },
      { lines: ["A following paragraph."], type: "paragraph" },
    ]);
  });

  it("ends the item at a heading, a fence and a table, not only at a blank line", () => {
    expect(parseMarkdownBlocks("- An item.\n## A heading\n")).toEqual([
      { items: ["An item."], ordered: false, type: "list" },
      { level: 2, text: "A heading", type: "heading" },
    ]);

    expect(parseMarkdownBlocks("- An item.\n```text\ncode\n```\n")).toEqual([
      { items: ["An item."], ordered: false, type: "list" },
      { code: "code", language: "text", type: "code" },
    ]);

    expect(
      parseMarkdownBlocks("- An item.\n| Label | Value |\n| --- | --- |\n| GM | 2 |\n"),
    ).toEqual([
      { items: ["An item."], ordered: false, type: "list" },
      {
        rows: [
          ["Label", "Value"],
          ["GM", "2"],
        ],
        type: "table",
      },
    ]);
  });

  it("still separates an ordered list from an unordered one that follows it", () => {
    /* A marker of the other type opens its own list; it is never absorbed as a continuation. */
    expect(parseMarkdownBlocks("1. Ordered, wrapped\n   here.\n- Unordered.\n")).toEqual([
      { items: ["Ordered, wrapped here."], ordered: true, type: "list" },
      { items: ["Unordered."], ordered: false, type: "list" },
    ]);
  });

  it("collects an indented nested marker as a sibling item, exactly as it did before", () => {
    /**
     * Nesting is explicitly out of scope: no registered reader page nests a list, and the four
     * `docs/rules` pages that do are all unregistered. An indented marker still matches the item
     * pattern and so is flattened into the same list, which is the behaviour this change inherits
     * rather than introduces — pinned here so a later nesting change is a deliberate one.
     */
    expect(parseMarkdownBlocks("- Parent\n  - Child\n")).toEqual([
      { items: ["Parent", "Child"], ordered: false, type: "list" },
    ]);
  });
});
