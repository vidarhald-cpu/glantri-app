import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const sourcePath = join(
  dirname(fileURLToPath(import.meta.url)),
  "ScenarioPlayerCombatPageContent.tsx",
);

function readSource(): string {
  return readFileSync(sourcePath, "utf8");
}

describe("ScenarioPlayerCombatPageContent", () => {
  it("keeps the recovered combat panel importable without future placeholder panels", () => {
    const source = readSource();

    expect(source).toContain("export default function ScenarioPlayerCombatPageContent");
    expect(source).toContain("Action selector");
    expect(source).toContain("EquipmentLoadoutModule");
    expect(source).toContain('workspaceTab = "player-encounter"');
    expect(source).toContain("displayedParticipant?.displayName ? ` — ${displayedParticipant.displayName}`");
    expect(source).toContain("showParticipantSelector = true");
    expect(source).toContain("readOnlyInspection = false");
    expect(source).not.toContain("GM player-view inspection is read-only.");
    expect(source).toContain("controlsDisabled || savingCombatContext");
    expect(source).not.toContain("will appear here in the next phase");
    expect(source).not.toContain("will expand into this area");
  });
});
