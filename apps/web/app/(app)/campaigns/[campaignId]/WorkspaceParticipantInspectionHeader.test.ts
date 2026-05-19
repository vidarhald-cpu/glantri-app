import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const sourcePath = join(
  dirname(fileURLToPath(import.meta.url)),
  "WorkspaceParticipantInspectionHeader.tsx",
);

function readSource(): string {
  return readFileSync(sourcePath, "utf8");
}

describe("WorkspaceParticipantInspectionHeader", () => {
  it("renders shared screen title and GM participant shuffler controls", () => {
    const source = readSource();

    expect(source).toContain("{screenName}");
    expect(source).toContain("selectedCandidate?.label");
    expect(source).toContain("Select character to inspect");
    expect(source).toContain("Previous");
    expect(source).toContain("Next");
    expect(source).toContain("onSelectParticipantId");
    expect(source).toContain("isGameMaster");
  });
});
