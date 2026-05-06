import type { ReactNode } from "react";

type MarkdownBlock =
  | {
      level: number;
      text: string;
      type: "heading";
    }
  | {
      lines: string[];
      type: "paragraph";
    }
  | {
      items: string[];
      ordered: boolean;
      type: "list";
    }
  | {
      code: string;
      language?: string;
      type: "code";
    }
  | {
      rows: string[][];
      type: "table";
    };

function parseTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function isTableSeparator(line: string): boolean {
  return /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(line.trim());
}

export function parseMarkdownBlocks(markdown: string): MarkdownBlock[] {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks: MarkdownBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    if (trimmed.startsWith("```")) {
      const language = trimmed.slice(3).trim() || undefined;
      const codeLines: string[] = [];
      index += 1;

      while (index < lines.length && !lines[index].trim().startsWith("```")) {
        codeLines.push(lines[index]);
        index += 1;
      }

      blocks.push({
        code: codeLines.join("\n"),
        language,
        type: "code"
      });
      index += 1;
      continue;
    }

    const heading = /^(#{1,6})\s+(.+)$/.exec(trimmed);
    if (heading) {
      blocks.push({
        level: heading[1].length,
        text: heading[2],
        type: "heading"
      });
      index += 1;
      continue;
    }

    if (trimmed.includes("|") && index + 1 < lines.length && isTableSeparator(lines[index + 1])) {
      const rows = [parseTableRow(trimmed)];
      index += 2;

      while (index < lines.length && lines[index].trim().includes("|")) {
        rows.push(parseTableRow(lines[index]));
        index += 1;
      }

      blocks.push({
        rows,
        type: "table"
      });
      continue;
    }

    const unorderedList = /^[-*]\s+(.+)$/.exec(trimmed);
    const orderedList = /^\d+\.\s+(.+)$/.exec(trimmed);
    if (unorderedList || orderedList) {
      const ordered = Boolean(orderedList);
      const items: string[] = [];

      while (index < lines.length) {
        const itemMatch = ordered
          ? /^\d+\.\s+(.+)$/.exec(lines[index].trim())
          : /^[-*]\s+(.+)$/.exec(lines[index].trim());

        if (!itemMatch) {
          break;
        }

        items.push(itemMatch[1]);
        index += 1;
      }

      blocks.push({
        items,
        ordered,
        type: "list"
      });
      continue;
    }

    const paragraphLines: string[] = [];
    while (index < lines.length) {
      const candidate = lines[index].trim();

      if (
        !candidate ||
        candidate.startsWith("```") ||
        /^(#{1,6})\s+/.test(candidate) ||
        /^[-*]\s+/.test(candidate) ||
        /^\d+\.\s+/.test(candidate) ||
        (candidate.includes("|") && index + 1 < lines.length && isTableSeparator(lines[index + 1]))
      ) {
        break;
      }

      paragraphLines.push(candidate);
      index += 1;
    }

    blocks.push({
      lines: paragraphLines,
      type: "paragraph"
    });
  }

  return blocks;
}

function renderInlineText(text: string): ReactNode[] {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);

  return parts.map((part, index) => {
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={index}>{part.slice(1, -1)}</code>;
    }

    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }

    return part;
  });
}

export function MarkdownRenderer(props: { markdown: string }) {
  const blocks = parseMarkdownBlocks(props.markdown);

  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      {blocks.map((block, index) => {
        if (block.type === "heading") {
          const headingStyle = { color: "#2c2418", margin: "0.75rem 0 0" };

          if (block.level <= 1) {
            return (
              <h2 key={index} style={headingStyle}>
                {renderInlineText(block.text)}
              </h2>
            );
          }

          if (block.level === 2) {
            return (
              <h3 key={index} style={headingStyle}>
                {renderInlineText(block.text)}
              </h3>
            );
          }

          if (block.level === 3) {
            return (
              <h4 key={index} style={headingStyle}>
                {renderInlineText(block.text)}
              </h4>
            );
          }

          return (
            <h5 key={index} style={headingStyle}>
              {renderInlineText(block.text)}
            </h5>
          );
        }

        if (block.type === "paragraph") {
          return (
            <p key={index} style={{ color: "#4f4635", lineHeight: 1.7, margin: 0 }}>
              {renderInlineText(block.lines.join(" "))}
            </p>
          );
        }

        if (block.type === "list") {
          const ListTag = block.ordered ? "ol" : "ul";

          return (
            <ListTag key={index} style={{ color: "#4f4635", lineHeight: 1.7, margin: 0, paddingLeft: "1.35rem" }}>
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>{renderInlineText(item)}</li>
              ))}
            </ListTag>
          );
        }

        if (block.type === "code") {
          return (
            <pre
              key={index}
              style={{
                background: "#2c2418",
                borderRadius: 14,
                color: "#fff7df",
                lineHeight: 1.6,
                margin: 0,
                overflowX: "auto",
                padding: "1rem"
              }}
            >
              <code>{block.code}</code>
            </pre>
          );
        }

        const [header, ...rows] = block.rows;

        return (
          <div key={index} style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", minWidth: 520, width: "100%" }}>
              <thead>
                <tr>
                  {header.map((cell, cellIndex) => (
                    <th
                      key={cellIndex}
                      style={{
                        borderBottom: "1px solid rgba(85, 73, 48, 0.22)",
                        color: "#2c2418",
                        padding: "0.55rem 0.7rem",
                        textAlign: "left"
                      }}
                    >
                      {renderInlineText(cell)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {row.map((cell, cellIndex) => (
                      <td
                        key={cellIndex}
                        style={{
                          borderBottom: "1px solid rgba(85, 73, 48, 0.1)",
                          color: "#4f4635",
                          padding: "0.55rem 0.7rem",
                          verticalAlign: "top"
                        }}
                      >
                        {renderInlineText(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
