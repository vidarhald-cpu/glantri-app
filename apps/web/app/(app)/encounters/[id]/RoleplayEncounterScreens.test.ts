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
    expect(source).toContain("Category");
    expect(source).toContain("All categories");
    expect(source).toContain("Gen");
    expect(source).toContain("OB/Skill");
    expect(source).toContain("DB");
    expect(source).toContain("Other mod");
    expect(source).toContain("Support category");
    expect(source).toContain("No support skill");
    expect(source).toContain("Level");
    expect(source).toContain("No level");
    expect(source).toContain("No opponent");
    expect(source).toContain("Open opponent block");
    expect(source).toContain("Assign");
    expect(source).toContain("GM Roll");
    expect(source).toContain("GM Roll both");
    expect(source).toContain("Clear");
    expect(source).toContain("Add roll");
    expect(source).toContain("Ranked roll results");
    expect(source).toContain("Action log");
    expect(source).not.toContain("Difficulty OR Opponent");
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
    expect(source).toContain("compareRoleplayOpposedRolls");
    expect(source).toContain("currentRankedRollResults");
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

  it("renders opposed roll state, support metadata, and opposed results in GM-only areas", () => {
    const source = readSource();

    expect(source).toContain("mode: \"opposed\"");
    expect(source).toContain("mode: \"difficulty\"");
    expect(source).toContain("supportSkillId");
    expect(source).toContain("opponentParticipantId");
    expect(source).toContain("opponentSkillId");
    expect(source).toContain("opponentSilent");
    expect(source).toContain("opponentSupportSkillId");
    expect(source).toContain("opponentBlockOpen");
    expect(source).toContain("opposedResult");
    expect(source).toContain("opposedMargin");
    expect(source).toContain("difficulty: \"none\"");
    expect(source).toContain("opponentBlockOpen: nextDifficulty === \"none\" ? draft.opponentBlockOpen : false");
    expect(source).toContain("opponentBlockOpen: false");
    expect(source).toContain("opponentBlockOpen: true");
    expect(source).toContain("handleAssignSkillRoll(draft, \"actor\")");
    expect(source).toContain("handleAssignSkillRoll(draft, \"opponent\")");
    expect(source).toContain("handleGmRoll(draft, \"actor\")");
    expect(source).toContain("handleGmRoll(draft, \"opponent\")");
    expect(source).toContain("handleGmRoll(draft, \"both\")");
  });

  it("keeps the roll preview concise with pending notes outside the formula", () => {
    const source = readSource();

    expect(source).toContain("pendingModifierLabels");
    expect(source).toContain("formulaText");
    expect(source).toContain("resultText");
    expect(source).toContain("Pending:");
    expect(source).toContain("RollCalculationPreview");
    expect(source).not.toContain("pending support-rule effect");
    expect(source).not.toContain("pending support rule");
    expect(source).not.toContain("Required difficulty");
  });

  it("uses persistent two-column roll blocks with structured calculation panels", () => {
    const source = readSource();

    expect(source).toContain("gridTemplateColumns: \"minmax(0, 1fr) minmax(22rem, 1fr)\"");
    expect(source).toContain("alignSelf: \"stretch\"");
    expect(source).toContain("boxSizing: \"border-box\"");
    expect(source).toContain("overflow: \"hidden\"");
    expect(source).toContain("<strong>Calculation</strong>");
    expect(source).toContain("<strong>Actor</strong>");
    expect(source).toContain("<strong>Opponent</strong>");
    expect(source).toContain("label=\"Comparison\"");
    expect(source).toContain("minHeight: \"10.5rem\"");
    expect(source).toContain("whiteSpace: \"nowrap\"");
    expect(source).toContain("<strong>{label}:</strong> {preview?.formulaText ?? \"—\"}");
    expect(source).toContain("function RoleplayRollCalculationPanel");
    expect(source).toContain("style={rollControlRowStyle}");
    expect(source).toContain("style={{ ...compactInputStyle, width: \"4.5rem\" }}");
    expect(source).not.toContain("<RoleplayRollPreviewPanel");
  });

  it("preselects the chosen opponent block participant without auto-selecting an opponent skill", () => {
    const source = readSource();

    expect(source).toContain("opponentParticipantId: event.target.value");
    expect(source).toContain("opponentRoll: undefined");
    expect(source).toContain("opponentBlockOpen: Boolean(event.target.value) && draft.opponentBlockOpen");
    expect(source).toContain("!draft.opponentBlockOpen || draft.opponentSkillId === \"\"");
    expect(source).toContain("opponentSkillId: \"\"");
    expect(source).toContain("value={context.opponent.id}");
  });

  it("clears draft-only roll editor state without touching persisted logs", () => {
    const source = readSource();

    expect(source).toContain("function resetRollDrafts()");
    expect(source).toContain("setRollDrafts([");
    expect(source).toContain("makeRollDraft({");
    expect(source).toContain("participantId: roster[0]?.id");
    expect(source).toContain("skillId: initialSkillId");
    expect(source).toContain("setCurrentRankedRollResults([])");
    expect(source).toContain("difficulty: \"medium\"");
    expect(source).not.toContain("id: draft.id");
    expect(source).not.toContain("setGmMessageDraft(\"\")");
  });

  it("uses all canonical ordinary and secondary skills instead of only participant-known skills", () => {
    const source = readSource();

    expect(source).toContain("input.content.skills");
    expect(source).toContain("skill.category === \"ordinary\" || skill.category === \"secondary\"");
    expect(source).toContain("!skill.specializationOfSkillId");
    expect(source).toContain("value: getParticipantSkillValue");
  });
});
