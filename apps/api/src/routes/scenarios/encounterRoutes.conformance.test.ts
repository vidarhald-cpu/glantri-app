import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(__dirname, "encounterRoutes.ts"), "utf8");

describe("combat route canonical-conformance guards", () => {
  it("does not expose the removed cursor-authorized GM mutation routes", () => {
    for (const route of [
      "combat-round/feint-feasibility",
      "combat-round/skip-current-action",
      "combat-round/advance-current-phase-resolution",
      "combat-round/complete-current-phase-resolution",
    ]) {
      expect(source).not.toContain(route);
    }
  });

  it("does not shadow projected attack authorization with the compatibility roll cursor", () => {
    expect(source).not.toContain("getPlayerCombatCurrentRollAction");
  });

  it("requires the boundary command execution group and command type", () => {
    expect(source).toContain("expectedCommandType: body.commandType");
    expect(source).toContain("expectedExecutionGroupId: body.executionGroupId");
    expect(source).toContain("expectedTaskId: body.taskId");
  });

  it("forwards initiative-group identity into projected-task authorization", () => {
    expect(source).toContain("initiativeGroupId: input.identity.initiativeGroupId");
    expect(source).toContain("initiativeValue: input.identity.initiativeValue");
  });

  it("binds attack modifier validation to the current initiative-group cutoff", () => {
    expect(source).toContain("effectCutoffInitiativeGroupId: task.identity.initiativeGroupId");
    expect(source).toContain("initiativeGroupId: task.identity.initiativeGroupId");
    expect(source).toContain("initiativeValue: task.identity.initiativeValue");
    expect(source).toContain('code: "modifier_validation_task_mismatch"');
    expect(source).toContain('code: "attacker_modifier_signature_mismatch"');
    expect(source).toContain('code: "defender_modifier_signature_mismatch"');
  });

  it("binds Offensive Parry Brawling to exact task and parry lineage", () => {
    expect(source).toContain("combat-round/roll-offensive-parry-brawling");
    for (const identity of [
      "attackResultId",
      "contestId",
      "declarationId",
      "declaredOpponentParticipantId",
      "executionGroupId",
      "opportunityId",
      "offensiveParryAttemptId",
      "parryResultId",
      "processId",
      "stageId",
      "taskId",
    ]) {
      expect(source).toContain(`${identity}: body.${identity}`);
    }
    expect(source).toContain('commandType: "roll_offensive_parry_brawling"');
    expect(source).toContain('rollPurpose: "offensive_parry_brawling"');
  });

  it("binds Continued Contact maintenance to the exact task, contest, contact, and roll purpose", () => {
    expect(source).toContain("combat-round/roll-continued-contact-maintenance");
    for (const identity of [
      "contestId",
      "continuedContactId",
      "executionGroupId",
      "opponentParticipantId",
      "processId",
      "stageId",
      "taskId",
    ]) {
      expect(source).toContain(`${identity}: body.${identity}`);
    }
    expect(source).toContain('commandType: "roll_continued_contact_maintenance"');
    expect(source).toContain('rollPurpose: "escape_continued_contact"');
  });

  it("authorizes proactive parry from the complete projected descriptor", () => {
    for (const identity of [
      "attackResultId",
      "attackerParticipantId",
      "declarationId",
      "declaredOpponentParticipantId",
      "defenderParticipantId",
      "executionGroupId",
      "offensiveParryAttemptId",
      "opportunityId",
      "parryPurpose",
      "parrySourceId",
      "processId",
      "stageId",
      "taskId",
    ]) {
      expect(source).toContain(`${identity}: body.${identity}`);
    }
    expect(source).toContain('commandType: "roll_parry"');
    expect(source).toContain("commandType must be roll_parry.");
  });
});
