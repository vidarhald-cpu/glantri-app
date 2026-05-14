import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const routePath = dirname(fileURLToPath(import.meta.url));
const sourcePath = join(routePath, "RoleplayEncounterScreens.tsx");
const componentsPath = join(routePath, "components");

function readSource(): string {
  return readFileSync(sourcePath, "utf8");
}

function readComponentSource(fileName: string): string {
  return readFileSync(join(componentsPath, fileName), "utf8");
}

function readPlayerScreenSource(): string {
  const source = readSource();
  const start = source.indexOf("export function PlayerRoleplayingEncounterScreen");

  return start === -1 ? "" : source.slice(start);
}

function readFunctionSource(source: string, exportName: string, nextMarker: string): string {
  const start = source.indexOf(`export function ${exportName}`);
  const end = source.indexOf(nextMarker, start);

  return start === -1 ? "" : source.slice(start, end === -1 ? undefined : end);
}

describe("RoleplayEncounterScreens", () => {
  it("keeps the route component as orchestration and uses extracted roleplay components", () => {
    const source = readSource();

    expect(source).toContain('from "./components/RoleplayRollBlock"');
    expect(source).toContain('from "./components/RoleplayCalculationPanel"');
    expect(source).toContain('from "./components/RoleplaySections"');
    expect(source).toContain('from "./components/roleplayStyles"');
    expect(source).toContain('from "./components/roleplayRollTypes"');
    expect(source).toContain("<RoleplayRollBlock");
    expect(source).toContain("<RoleplayRollCalculationPanel");
    expect(source).toContain("<RoleplayTopInfo");
    expect(source).toContain("<GmMessageSection");
    expect(source).toContain("<VisibilityGridSection");
    expect(source).toContain("<ParticipantDescriptionsSection");
    expect(source).toContain("<RankedRollResultsSection");
    expect(source).toContain("<RoleplayActionLogSection");
  });

  it("keeps extracted component files in charge of their rendering areas", () => {
    const rollBlockSource = readComponentSource("RoleplayRollBlock.tsx");
    const calculationSource = readComponentSource("RoleplayCalculationPanel.tsx");
    const sectionsSource = readComponentSource("RoleplaySections.tsx");

    expect(rollBlockSource).toContain("export function RoleplayRollBlock");
    expect(rollBlockSource).toContain("Assign");
    expect(rollBlockSource).toContain("GM Roll");
    expect(rollBlockSource).toContain("GM Roll both");
    expect(rollBlockSource).toContain("Open opponent block");
    expect(calculationSource).toContain("export function RoleplayRollCalculationPanel");
    expect(calculationSource).toContain("Comparison");
    expect(sectionsSource).toContain("export function PlayerEncounterTopInfo");
    expect(sectionsSource).toContain("export function GmMessageSection");
    expect(sectionsSource).toContain("export function VisibilityGridSection");
    expect(sectionsSource).toContain("export function ParticipantDescriptionsSection");
    expect(sectionsSource).toContain("export function RankedRollResultsSection");
    expect(sectionsSource).toContain("export function RoleplayActionLogSection");
  });

  it("keeps roleplay roll rules and persistence helpers wired through domain/rules-engine helpers", () => {
    const source = readSource();

    expect(source).toContain("normalizeRoleplayState");
    expect(source).toContain("assignRoleplaySkillRoll");
    expect(source).toContain("recordRoleplayGmSkillRoll");
    expect(source).toContain("rollOpenEndedRoleplayD20");
    expect(source).toContain("compareRoleplayOpposedRolls");
    expect(source).toContain("buildRoleplayCalculationPreview");
    expect(source).toContain("resolveRoleplaySkillRollModifiers");
    expect(source).toContain("resolveParticipantSkillRollProfile");
    expect(source).toContain("submitPlayerRoleplayRollOnServer");
  });

  it("keeps the player screen free of GM-only controls and GM-only sections", () => {
    const playerSource = readPlayerScreenSource();

    expect(playerSource).toContain("Situation");
    expect(playerSource).toContain("PCs and NPCs");
    expect(playerSource).toContain("Skill roll grid");
    expect(playerSource).toContain("Character log");
    expect(playerSource).not.toContain("GM Roll");
    expect(playerSource).not.toContain("GM Roll both");
    expect(playerSource).not.toContain("Action log");
    expect(playerSource).not.toContain("Visibility grid");
    expect(playerSource).not.toContain("Select all");
    expect(playerSource).not.toContain(">Silent<");
  });

  it("keeps player encounter safety/read-model behavior wired through sanitized helpers", () => {
    const source = readSource();
    const playerSource = readPlayerScreenSource();

    expect(playerSource).toContain("buildPlayerGeneralEncounterView");
    expect(playerSource).toContain("playerView.visibleParticipants");
    expect(playerSource).toContain("playerView.assignedRolls");
    expect(playerSource).toContain("playerView.rankedResults");
    expect(playerSource).toContain("playerView.characterLog");
    expect(playerSource).toContain("dismissedAssignedRollIds");
    expect(playerSource).toContain("dismissedRankedResultIds");
    expect(source).toContain("getScenarioParticipantFallbackEncounterParticipants");
    expect(source).toContain("resolveEncounterParticipantByRollParticipantId");
  });

  it("preserves opposed result matching and player submitted roll identity", () => {
    const source = readSource();

    expect(source).toContain("findRoleplayResultForSide");
    expect(source).toContain("pendingRollId");
    expect(source).toContain("rollSetId");
    expect(source).toContain('side: "actor"');
    expect(source).toContain('side: "opponent"');
    expect(source).toContain("matchingPendingRoll");
    expect(source).toContain("matchingOpponentPendingRoll");
    expect(source).toContain("activeOpposedRollSetId");
  });

  it("keeps opposed rolls out of ranked result stacks while allowing non-opposed results", () => {
    const source = readSource();
    const sectionsSource = readComponentSource("RoleplaySections.tsx");
    const rankedSource = readFunctionSource(
      sectionsSource,
      "RankedRollResultsSection",
      "function formatDifficulty"
    );

    expect(source).toContain('entry.mode !== "opposed"');
    expect(source).toContain('pendingRoll.mode !== "opposed"');
    expect(source).toContain("replaceDraftRankedRollResults(draft.id, [])");
    expect(rankedSource).toContain("entry.numericSubtotal == null");
    expect(rankedSource).not.toContain("entry.fumble ? \"FUMBLE\"");
    expect(rankedSource).not.toContain("entry.success");
  });

  it("preserves known/unknown skill value and default modifier behavior", () => {
    const source = readSource();
    const typesSource = readComponentSource("roleplayRollTypes.ts");

    expect(source).toContain("readSystemSkillOptions");
    expect(source).toContain("value: profile.rollBaseValue");
    expect(source).toContain("applyUnknownSkillDefaultOtherMod");
    expect(source).toContain("unknownSkillPenalty");
    expect(source).toContain("otherModTouched");
    expect(source).toContain("Skill not known (-3 default). GM may adjust or forbid.");
    expect(typesSource).toContain("profile?: ParticipantSkillRollProfile");
    expect(typesSource).toContain("warning?: string");
  });

  it("keeps player local and assigned roll lifecycle state local to the player screen", () => {
    const playerSource = readPlayerScreenSource();

    expect(playerSource).toContain("PlayerLocalRollDraft");
    expect(playerSource).toContain("makePlayerLocalRollDraft");
    expect(playerSource).toContain("handleClearAssignedRolls");
    expect(playerSource).toContain("unresolvedAssignedRolls");
    expect(playerSource).toContain("handlePlayerRoll");
    expect(playerSource).toContain("handleLocalPlayerRoll");
    expect(playerSource).toContain("Roll 1d20");
    expect(playerSource).toContain("Roll both 1d20s");
  });
});
