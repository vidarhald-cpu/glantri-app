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
    expect(source).toContain("Silent");
    expect(source).toContain("Skill category");
    expect(source).toContain("All categories");
    expect(source).toContain("Gen mod");
    expect(source).toContain("OB/Skill mod");
    expect(source).toContain("DB mod");
    expect(source).toContain("Other mod");
    expect(source).toContain("Assign");
    expect(source).toContain("GM Roll");
    expect(source).toContain("Add roll");
    expect(source).toContain("Ranked roll results");
    expect(source).toContain("Action log");
  });

  it("stores roleplay state through sessionJson helpers and evaluates non-opposed success levels", () => {
    const source = readSource();

    expect(source).toContain("normalizeRoleplayState");
    expect(source).toContain("updateRoleplayGmMessage");
    expect(source).toContain("updateRoleplayVisibility");
    expect(source).toContain("selectAllRoleplayVisibilityForViewer");
    expect(source).toContain("updateRoleplayParticipantDescription");
    expect(source).toContain("assignRoleplaySkillRoll");
    expect(source).toContain("recordRoleplayGmSkillRoll");
    expect(source).toContain("buildRoleplayCalculationPreview");
    expect(source).toContain("rankRoleplayGmRollResults");
    expect(source).toContain("rollOpenEndedRoleplayD20");
    expect(source).toContain("SUCCESS");
    expect(source).toContain("NOT SUCCESSFUL");
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
    expect(source).toContain("getPlayerFacingSkillBucketDefinitions");
    expect(source).toContain("getPlayerFacingSkillBucket");
    expect(source).toContain("readSystemSkillOptions");
    expect(source).not.toContain("Critical +");
  });

  it("uses all canonical ordinary and secondary skills instead of only participant-known skills", () => {
    const source = readSource();

    expect(source).toContain("input.content.skills");
    expect(source).toContain("skill.category === \"ordinary\" || skill.category === \"secondary\"");
    expect(source).toContain("!skill.specializationOfSkillId");
    expect(source).toContain("value: getParticipantSkillValue");
  });
});
