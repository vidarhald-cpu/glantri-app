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
          type: "heading"
        }),
        expect.objectContaining({
          code: "Displayed GM = trunc((Current stat - 11) / 2)",
          language: "text",
          type: "code"
        }),
        expect.objectContaining({
          rows: [
            ["Label", "Value"],
            ["GM", "2"]
          ],
          type: "table"
        })
      ])
    );
  });
});
