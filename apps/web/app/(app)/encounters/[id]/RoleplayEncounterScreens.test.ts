import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const sourcePath = join(dirname(fileURLToPath(import.meta.url)), "RoleplayEncounterScreens.tsx");

function readSource(): string {
  return readFileSync(sourcePath, "utf8");
}

describe("RoleplayEncounterScreens", () => {
  it("renders GM top info, GM message, visibility, roster descriptions, skill rolls, and action log", () => {
    const source = readSource();

    expect(source).toContain("Type: Roleplaying");
    expect(source).toContain("GM message");
    expect(source).toContain("Save GM message");
    expect(source).toContain("Visibility grid");
    expect(source).toContain("Select all");
    expect(source).toContain("Roleplay roster descriptions");
    expect(source).toContain("Skill roll assignment");
    expect(source).toContain("Silent skill roll");
    expect(source).toContain("Assign");
    expect(source).toContain("GM Roll");
    expect(source).toContain("Action log");
  });

  it("stores roleplay state through sessionJson helpers without inventing success math", () => {
    const source = readSource();

    expect(source).toContain("normalizeRoleplayState");
    expect(source).toContain("updateRoleplayGmMessage");
    expect(source).toContain("updateRoleplayVisibility");
    expect(source).toContain("selectAllRoleplayVisibilityForViewer");
    expect(source).toContain("updateRoleplayParticipantDescription");
    expect(source).toContain("assignRoleplaySkillRoll");
    expect(source).toContain("recordRoleplayGmSkillRoll");
    expect(source).toContain("calculation pending rules");
    expect(source).toContain("rollD20");
  });

  it("keeps player roleplay screen minimal and hides GM-only sections", () => {
    const source = readSource();
    const playerSource = source.slice(source.indexOf("export function PlayerRoleplayingEncounterScreen"));

    expect(playerSource).toContain("Roleplaying encounter player tools will appear here.");
    expect(playerSource).toContain("<RoleplayTopInfo");
    expect(playerSource).not.toContain("Visibility grid");
    expect(playerSource).not.toContain("Roleplay roster descriptions");
    expect(playerSource).not.toContain("Skill roll assignment");
    expect(playerSource).not.toContain("Action log");
  });

  it("orders and labels roleplay participants and difficulty options", () => {
    const source = readSource();

    expect(source).toContain("orderRoleplayEncounterParticipants");
    expect(source).toContain("roleplayDifficultyOptions");
    expect(source).toContain("formatDifficulty(difficulty)");
  });
});
