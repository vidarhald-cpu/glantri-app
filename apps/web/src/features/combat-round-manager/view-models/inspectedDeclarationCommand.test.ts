import { describe, expect, it } from "vitest";

import type { CombatProgressionPresentationProjection } from "@glantri/domain";

import type { CurrentActionCommandDescriptor } from "@/features/combat-history/view-models/currentActionPresentation";

import {
  getInspectedDeclarationParticipantAliases,
  resolveInspectedDeclarationCommandDescriptor,
} from "./inspectedDeclarationCommand";

/**
 * #691 — the descriptor must name the participant whose selectors the declaration form is showing,
 * because that is the only participant whose loadout and combat context are hydrated. Taking it
 * from the cursor task instead mixed three participant contexts into one request.
 */
const cursorDescriptor: CurrentActionCommandDescriptor = {
  commandType: "declare_action",
  encounterId: "encounter-1",
  executionGroupId: "group-attacker",
  expectedBoundary: "declaration",
  expectedRevision: "2026-07-23T10:00:00.000Z",
  participantId: "encounter-attacker",
  processId: "process-de",
  stageId: "stage-de",
  taskId: "task-declare-attacker",
};

function declarationTask(participantId: string) {
  return {
    actorAccess: { combatant: true, gm: true },
    automation: { eligible: false },
    contributesToProgression: true,
    executionGroupId: `group-${participantId}`,
    expectedCommand: "declare_action",
    id: `task-declare-${participantId}`,
    identity: { participantId },
    kind: "gm_submit_declaration",
    owner: { kind: "combatant", participantId },
    processId: "process-de",
    stageId: "stage-de",
    state: "available",
    trackerFacet: { step: "DE" },
  };
}

function projection(participantIds: readonly string[]): CombatProgressionPresentationProjection {
  return {
    awaitingGmTransition: false,
    boundary: { id: "boundary-de", kind: "declaration", roundNumber: 1 },
    processes: [
      {
        id: "process-de",
        kind: "declaration",
        stages: [
          {
            executionGroups: [],
            executionStrategy: "parallel",
            id: "stage-de",
            kind: "declaration",
            processId: "process-de",
            state: "available",
            tasks: participantIds.map(declarationTask),
          },
        ],
      },
    ],
    roundNumber: 1,
    taskVisibility: "available",
  } as unknown as CombatProgressionPresentationProjection;
}

describe("resolveInspectedDeclarationCommandDescriptor (#691)", () => {
  it("retargets the declaration command to the edited participant's own projected task", () => {
    expect(
      resolveInspectedDeclarationCommandDescriptor({
        descriptor: cursorDescriptor,
        participantId: "encounter-defender",
        projection: projection(["encounter-attacker", "encounter-defender"]),
      }),
    ).toMatchObject({
      executionGroupId: "group-encounter-defender",
      participantId: "encounter-defender",
      taskId: "task-declare-encounter-defender",
    });
  });

  it("keeps the immutable encounter and revision identity it was given", () => {
    const resolved = resolveInspectedDeclarationCommandDescriptor({
      descriptor: cursorDescriptor,
      participantId: "encounter-defender",
      projection: projection(["encounter-attacker", "encounter-defender"]),
    });

    expect(resolved.encounterId).toBe("encounter-1");
    expect(resolved.expectedRevision).toBe("2026-07-23T10:00:00.000Z");
    expect(resolved.expectedBoundary).toBe("declaration");
    expect(resolved.commandType).toBe("declare_action");
  });

  it("returns the descriptor unchanged when the edited participant already owns it", () => {
    const resolved = resolveInspectedDeclarationCommandDescriptor({
      descriptor: cursorDescriptor,
      participantId: "encounter-attacker",
      projection: projection(["encounter-attacker", "encounter-defender"]),
    });

    expect(resolved).toBe(cursorDescriptor);
  });

  /**
   * Nothing is retargeted onto a task that does not exist. A participant who has already declared
   * has no projected `declare_action` task, and the caller keeps what it held rather than guessing.
   */
  it("returns the descriptor unchanged when the edited participant has no declaration task", () => {
    expect(
      resolveInspectedDeclarationCommandDescriptor({
        descriptor: cursorDescriptor,
        participantId: "encounter-defender",
        projection: projection(["encounter-attacker"]),
      }),
    ).toBe(cursorDescriptor);
  });

  it("resolves a task recorded under one of the participant's other aliases", () => {
    expect(
      resolveInspectedDeclarationCommandDescriptor({
        descriptor: cursorDescriptor,
        participantAliases: ["scenario-defender", "character-defender"],
        participantId: "encounter-defender",
        projection: projection(["encounter-attacker", "scenario-defender"]),
      }),
    ).toMatchObject({
      participantId: "scenario-defender",
      taskId: "task-declare-scenario-defender",
    });
  });

  it("leaves modifier-review commands alone, because they keep their own ownership guard", () => {
    const reviewDescriptor: CurrentActionCommandDescriptor = {
      ...cursorDescriptor,
      commandType: "review_modifiers_phase1",
    };

    expect(
      resolveInspectedDeclarationCommandDescriptor({
        descriptor: reviewDescriptor,
        participantId: "encounter-defender",
        projection: projection(["encounter-attacker", "encounter-defender"]),
      }),
    ).toBe(reviewDescriptor);
  });

  it("returns the descriptor unchanged without a projection or an edited participant", () => {
    expect(
      resolveInspectedDeclarationCommandDescriptor({
        descriptor: cursorDescriptor,
        participantId: "encounter-defender",
      }),
    ).toBe(cursorDescriptor);
    expect(
      resolveInspectedDeclarationCommandDescriptor({
        descriptor: cursorDescriptor,
        participantId: "   ",
        projection: projection(["encounter-attacker", "encounter-defender"]),
      }),
    ).toBe(cursorDescriptor);
  });
});

describe("getInspectedDeclarationParticipantAliases (#691)", () => {
  it("offers every alias a declaration task owner may be recorded under", () => {
    const aliases = getInspectedDeclarationParticipantAliases({
      characterId: "character-defender",
      id: "encounter-defender",
      scenarioParticipantId: "scenario-defender",
    });

    expect(aliases).toContain("encounter-defender");
    expect(aliases).toContain("scenario-defender");
    expect(aliases).toContain("character-defender");
  });

  it("is empty for no participant", () => {
    expect(getInspectedDeclarationParticipantAliases(undefined)).toEqual([]);
  });
});
