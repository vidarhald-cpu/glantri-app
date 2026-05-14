import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const sourcePath = join(dirname(fileURLToPath(import.meta.url)), "RoleplayEncounterScreens.tsx");
const componentsPath = join(dirname(fileURLToPath(import.meta.url)), "components");
const componentSourcePaths = [
  "RoleplayCalculationPanel.tsx",
  "RoleplayRollBlock.tsx",
  "RoleplaySections.tsx",
  "roleplayRollTypes.ts",
  "roleplayStyles.ts",
];

function readSource(): string {
  return readFileSync(sourcePath, "utf8");
}

function readComponentSource(fileName: string): string {
  return readFileSync(join(componentsPath, fileName), "utf8");
}

function readRoleplaySources(): string {
  return [
    readSource(),
    ...componentSourcePaths.map((fileName) => readComponentSource(fileName)),
  ].join("\n");
}

function readPlayerSource(): string {
  const source = readSource();
  const sectionsSource = readComponentSource("RoleplaySections.tsx");
  const playerTopInfoSource = sectionsSource.slice(
    sectionsSource.indexOf("export function PlayerEncounterTopInfo"),
    sectionsSource.indexOf("export function GmMessageSection")
  );

  return [
    source.slice(source.indexOf("export function PlayerRoleplayingEncounterScreen")),
    playerTopInfoSource,
    readComponentSource("roleplayStyles.ts"),
  ].join("\n");
}

describe("RoleplayEncounterScreens", () => {
  it("renders GM top info, GM message, visibility, roster descriptions, skill rolls, and action log", () => {
    const source = readRoleplaySources();

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
    const source = readRoleplaySources();

    expect(source).toContain("normalizeRoleplayState");
    expect(source).toContain("updateRoleplayGmMessage");
    expect(source).toContain("updateRoleplayVisibility");
    expect(source).toContain("selectAllRoleplayVisibilityForViewer");
    expect(source).toContain("updateRoleplayParticipantDescription");
    expect(source).toContain("assignRoleplaySkillRoll");
    expect(source).toContain("recordRoleplayGmSkillRoll");
    expect(source).toContain("buildRoleplayCalculationPreview");
    expect(source).toContain("resolveRoleplaySkillRollModifiers");
    expect(source).toContain("modifierPipeline");
    expect(source).toContain("compareRoleplayOpposedRolls");
    expect(source).toContain("currentRankedRollResults");
    expect(source).toContain("rollOpenEndedRoleplayD20");
    expect(source).toContain("SUCCESS");
    expect(source).toContain("NOT SUCCESSFUL");
  });

  it("renders the player general encounter shell without GM-only sections", () => {
    const source = readRoleplaySources();
    const playerSource = readPlayerSource();

    expect(source).toContain("Player encounter summary");
    expect(source).toContain("playerMetadataTagStyle");
    expect(source).toContain("textOverflow: \"ellipsis\"");
    expect(source).toContain("Scenario: {scenarioName}");
    expect(source).toContain("Campaign: {campaignName}");
    expect(source).toContain("encounter.description");
    expect(source).toContain("playerReadOnlyPanelStyle");
    expect(playerSource).toContain("<PlayerEncounterTopInfo");
    expect(playerSource).toContain("Situation");
    expect(source).toContain("whiteSpace: \"pre-wrap\"");
    expect(playerSource).toContain("overflowY: \"auto\"");
    expect(playerSource).toContain("aria-readonly=\"true\"");
    expect(playerSource).toContain("PCs and NPCs");
    expect(playerSource).toContain("No other visible participants.");
    expect(playerSource).toContain("<col style={{ width: \"56%\" }}");
    expect(playerSource).toContain("Short description");
    expect(playerSource).toContain("Skill roll grid");
    expect(playerSource).toContain("handleClearAssignedRolls");
    expect(playerSource).toContain("dismissedAssignedRollIds");
    expect(playerSource).toContain("dismissedRankedResultIds");
    expect(playerSource).toContain("localRankedResults");
    expect(playerSource).toContain("PlayerLocalRollDraft");
    expect(playerSource).toContain("visibleRankedResults");
    expect(playerSource).toContain("No skill rolls assigned.");
    expect(playerSource).toContain("Local roll 1");
    expect(playerSource).toContain("No skills available");
    expect(playerSource).toContain("handleLocalPlayerRoll");
    expect(playerSource).toContain("unresolvedAssignedRolls");
    expect(playerSource).toContain("Roll 1d20");
    expect(playerSource).toContain("Roll both 1d20s");
    expect(playerSource).toContain("Assigned roll {index + 1} · {roll.participantName}");
    expect(playerSource).toContain("Use:");
    expect(playerSource).toContain("checked={roll.useGenMod}");
    expect(playerSource).toContain("checked={roll.useObSkillMod}");
    expect(playerSource).toContain("checked={roll.useDbMod}");
    expect(playerSource).toContain("playerRollSkillColumnsStyle");
    expect(playerSource).toContain("buildPlayerRollResult");
    expect(playerSource).toContain("resolveEncounterParticipantByRollParticipantId");
    expect(playerSource).toContain("cleanPendingText");
    expect(playerSource).toContain("showPendingLabels={false}");
    expect(playerSource).toContain("Skill not known (-3 default).");
    expect(playerSource).toContain("localOtherModInput");
    expect(playerSource).toContain("Ranked roll results");
    expect(playerSource).toContain("Character log");
    expect(playerSource).toContain("buildPlayerGeneralEncounterView");
    expect(playerSource).toContain("submitPlayerRoleplayRollOnServer");
    expect(playerSource).toContain("fetchRoleplayEncounter");
    expect(playerSource).toContain("window.setInterval");
    expect(playerSource).toContain("You are in this scenario, but not assigned to this encounter.");
    expect(playerSource).toContain("<RoleplayRollCalculationPanel");
    expect(playerSource).toContain("Support category");
    expect(playerSource).toContain("No support skill");
    expect(playerSource).not.toContain("<RoleplayTopInfo");
    expect(playerSource).not.toContain("Status:");
    expect(playerSource).not.toContain("<span>Character</span>");
    expect(playerSource).not.toContain("GM Roll");
    expect(playerSource).not.toContain("GM Roll both");
    expect(playerSource).not.toContain("Silent");
    expect(playerSource).not.toContain("Pending:");
    expect(playerSource).not.toContain("Visibility grid");
    expect(playerSource).not.toContain("Roleplay roster descriptions");
    expect(playerSource).not.toContain("Skill roll assignment");
    expect(playerSource).not.toContain("Action log");
    expect(playerSource).not.toContain("Select all");
    expect(playerSource).not.toContain("visibility[");
    expect(playerSource).not.toContain("opponentSilent");
  });

  it("orders and labels roleplay participants and difficulty options", () => {
    const source = readRoleplaySources();

    expect(source).toContain("orderRoleplayEncounterParticipants");
    expect(source).toContain("roleplayDifficultyOptions");
    expect(source).toContain("getPlayerFacingSkillBucketDefinitions");
    expect(source).toContain("getPlayerFacingSkillBucket");
    expect(source).toContain("readSystemSkillOptions");
    expect(source).not.toContain("Critical +");
  });

  it("renders opposed roll state, support metadata, and opposed results in GM-only areas", () => {
    const source = readRoleplaySources();

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
    expect(source).toContain("onAssignSkillRoll={handleAssignSkillRoll}");
    expect(source).toContain("onAssignSkillRoll(draft, \"actor\")");
    expect(source).toContain("onAssignSkillRoll(draft, \"opponent\")");
    expect(source).toContain("onGmRoll={handleGmRoll}");
    expect(source).toContain("onGmRoll(draft, \"actor\")");
    expect(source).toContain("onGmRoll(draft, \"opponent\")");
    expect(source).toContain("onGmRoll(draft, \"both\")");
    expect(source).toContain("findRoleplayResultForSide");
    expect(source).toContain("rollSetId === draft.rollSetId");
    expect(source).toContain("activeOpposedRollSetId");
    expect(source).toContain("matchingOpponentPendingRoll");
    expect(source).toContain("side: \"actor\"");
    expect(source).toContain("side: \"opponent\"");
    expect(source).toContain("pendingRollId: matchingPendingRoll?.id");
    expect(source).toContain("rollSetId: activeOpposedRollSetId");
    expect(source).toContain("scorePendingRoll");
    expect(source).toContain("duplicateOpponentAssignment");
    expect(source).toContain("duplicateActorAssignment");
    expect(source).toContain("Result received");
    expect(source).toContain("Assigned · Pending player roll");
    expect(source).toContain("return;");
  });

  it("keeps the roll preview concise with pending notes outside the formula", () => {
    const source = readRoleplaySources();

    expect(source).toContain("pendingModifierLabels");
    expect(source).toContain("formulaText");
    expect(source).toContain("resultText");
    expect(source).toContain("return preview.resultText ?? \"FUMBLE\"");
    expect(source).toContain("Pending:");
    expect(source).toContain("RollCalculationPreview");
    expect(source).not.toContain("pending support-rule effect");
    expect(source).not.toContain("pending support rule");
    expect(source).not.toContain("Required difficulty");
  });

  it("shows ranked rows only through total and keeps fumble details out of ranked rows", () => {
    const source = readRoleplaySources();
    const rankedSource = readComponentSource("RoleplaySections.tsx").slice(
      readComponentSource("RoleplaySections.tsx").indexOf("export function RankedRollResultsSection"),
      readComponentSource("RoleplaySections.tsx").indexOf("function formatDifficulty")
    );

    expect(rankedSource).toContain("entry.numericSubtotal == null ? \"unresolved\" : `total ${entry.numericSubtotal}`");
    expect(source).toContain("if (opponent) {");
    expect(source).toContain("replaceDraftRankedRollResults(draft.id, []);");
    expect(source).toContain("entry.mode !== \"opposed\"");
    expect(source).toContain("pendingRoll.mode !== \"opposed\"");
    expect(rankedSource).not.toContain("entry.mode === \"opposed\"");
    expect(rankedSource).not.toContain("{entry.fumble ? \" · FUMBLE\" : \"\"}");
    expect(rankedSource).not.toContain("entry.fumble ? \"FUMBLE\"");
  });

  it("locks actor and opponent roll controls independently after each side rolls", () => {
    const source = readRoleplaySources();

    expect(source).toContain("const actorLocked = Boolean(draft.actorRoll || context.actorExternalResult)");
    expect(source).toContain("const opponentLocked = Boolean(draft.opponentRoll || context.opponentExternalResult)");
    expect(source).toContain("disabled={actorLocked || !context.participant || !context.selectedSkill}");
    expect(source).toContain("disabled={opponentLocked || !context.opponent || !context.selectedOpponentSkill}");
    expect(source).toContain("actorLocked ||");
    expect(source).toContain("opponentLocked ||");
    expect(source).toContain("setCurrentRankedRollResults([])");
  });

  it("uses persistent two-column roll blocks with structured calculation panels", () => {
    const source = readRoleplaySources();

    expect(source).toContain("gridTemplateColumns: \"minmax(0, 1fr) minmax(22rem, 1fr)\"");
    expect(source).toContain("alignSelf: \"stretch\"");
    expect(source).toContain("boxSizing: \"border-box\"");
    expect(source).toContain("overflow: \"hidden\"");
    expect(source).toContain("<strong>Calculation</strong>");
    expect(source).toContain("<strong>{actorLabel}</strong>");
    expect(source).toContain("<strong>{opponentLabel}</strong>");
    expect(source).toContain("label=\"Comparison\"");
    expect(source).toContain("minHeight: \"10.5rem\"");
    expect(source).toContain("whiteSpace: \"nowrap\"");
    expect(source).toContain("<strong>{label}:</strong> {formulaText}");
    expect(source).toContain("function RoleplayRollCalculationPanel");
    expect(source).toContain("style={rollControlRowStyle}");
    expect(source).toContain("style={rollSkillGridStyle}");
    expect(source).toContain("<strong>Roll {index + 1}</strong>");
    expect(source).toContain("aria-label={`Roleplay roll ${index + 1} participant`}");
    expect(source).toContain("aria-label={`Roleplay roll ${index + 1} opponent block participant`}");
    expect(source).toContain("style={{ ...compactInputStyle, width: \"4.5rem\" }}");
    expect(source).not.toContain("<RoleplayRollPreviewPanel");
  });

  it("preselects the chosen opponent block participant without auto-selecting an opponent skill", () => {
    const source = readRoleplaySources();

    expect(source).toContain("opponentParticipantId: event.target.value");
    expect(source).toContain("opponentRoll: undefined");
    expect(source).toContain("opponentBlockOpen: Boolean(event.target.value) && draft.opponentBlockOpen");
    expect(source).toContain("!draft.opponentBlockOpen || draft.opponentSkillId === \"\"");
    expect(source).toContain("opponentSkillId: \"\"");
    expect(source).toContain("value={context.opponent.id}");
  });

  it("clears draft-only roll editor state without touching persisted logs", () => {
    const source = readRoleplaySources();

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
    const source = readRoleplaySources();

    expect(source).toContain("input.content.skills");
    expect(source).toContain("skill.category === \"ordinary\" || skill.category === \"secondary\"");
    expect(source).toContain("!skill.specializationOfSkillId");
    expect(source).toContain("resolveParticipantSkillRollProfile");
    expect(source).toContain("content: input.content");
    expect(source).toContain("value: profile.rollBaseValue");
    expect(source).toContain("Skill not known (-3 default). GM may adjust or forbid.");
    expect(source).toContain("applyUnknownSkillDefaultOtherMod");
    expect(source).toContain("otherModTouched");
  });
});
