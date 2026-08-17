import { describe, expect, it } from "vitest";
import { weaponTemplates } from "@glantri/content";

import {
  commitCombatRoundDisarm,
  initializeCombatRoundState,
  openCombatRoundDisarmAfterContact,
  recordCombatRoundDeclaration,
  recordCombatRoundDisarmRoll,
  undoLatestCombatRoundCommand,
  type CombatDisarmRoll,
  type EncounterParticipant,
  type EncounterSession,
  type ScenarioParticipant,
} from "@glantri/domain";
import { buildPlayerSafeEncounterForUser } from "./encounterRoutes";

const NOW = "2026-08-17T10:00:00.000Z";
const REVISION = "2026-08-17T09:00:00.000Z";

function participant(id: string): EncounterParticipant {
  return {
    declaration: {
      actionType: "none",
      defenseFocus: "none",
      defensePosture: "none",
      targetLocation: "any",
    },
    facing: "north",
    id,
    initiative: 0,
    label: id,
    order: 0,
    orientation: "neutral",
    participantType: "scenario",
    position: { x: 0, y: 0, zone: "center" },
    scenarioParticipantId: `scenario-${id}`,
  };
}

function roll(input: {
  finalTotal: number;
  participantId: string;
  role: "disarm_actor" | "disarm_holder";
}): CombatDisarmRoll {
  return {
    calculation: {
      baseSkill: 10,
      calculationId: `calculation:${input.participantId}`,
      completeness: "complete",
      contestType: "disarm",
      derivedIntegerAdjustment: input.finalTotal - 20,
      finalResult: input.finalTotal,
      governingStat: { id: "strength", label: "Strength", value: 10 },
      missingContributionPoints: [],
      openEndedDie: { openEndedD10s: [], rollD20: 10, rollTotal: 10 },
      opponentParticipantId: input.participantId === "actor" ? "holder" : "actor",
      participantId: input.participantId,
      percentageContributions:
        input.role === "disarm_actor"
          ? [
              {
                category: "weapon_control",
                id: "secret-control",
                label: "Weapon-control mismatch",
                provenance: "Target 5 vs acting 2",
                sourceId: "gm-only-control",
                unit: "percentage",
                value: -9,
              },
            ]
          : [],
      preDieTotal: input.finalTotal - 10,
      role: input.role,
      skill: { id: "weapon-skill", label: "Weapon skill", totalXp: 0 },
      totalPercentageAdjustment: input.role === "disarm_actor" ? -9 : 0,
      visibility: "roller_and_gm",
    },
    characteristicChoice: "strength",
    finalTotal: input.finalTotal,
    id: `roll:${input.participantId}`,
    participantId: input.participantId,
    rolledAt: NOW,
    rolledByUserId: `user-${input.participantId}`,
    skillChoice: "weapon_skill",
  };
}

function fixture(input?: { hiddenSuffix?: string }) {
  const hiddenSuffix = input?.hiddenSuffix ?? "secret";
  const encounterParticipants = [
    participant("actor"),
    participant("holder"),
    participant("observer"),
  ];
  let state = initializeCombatRoundState({
    encounter: { currentRound: 3, id: "encounter-1", participants: encounterParticipants },
  });
  state = recordCombatRoundDeclaration({
    command: { commandId: "declare", createdAt: NOW },
    declaration: {
      actionId: "disarm",
      disarm: {
        actingWeapon: {
          capability: "trap",
          controlRating: 2,
          itemId: `${hiddenSuffix}-acting-item`,
          itemRevision: REVISION,
          label: "Secret trap",
          parryModifier: 2,
          templateId: `${hiddenSuffix}-acting-template`,
        },
        method: "proactive",
        phase: "phase1",
        targetParticipantId: "holder",
        targetWeapon: {
          capability: "none",
          controlRating: 5,
          itemId: `${hiddenSuffix}-target-item`,
          itemRevision: REVISION,
          label: "Secret target",
          parryModifier: 0,
          templateId: `${hiddenSuffix}-target-template`,
        },
      },
      roundNumber: 3,
    },
    participantId: "actor",
    state,
    submittedBy: "gm",
  });
  const declaredState = state;
  const attemptId = state.disarmAttempts[0]!.id;
  state = openCombatRoundDisarmAfterContact({
    attackResultId: "attack-1",
    attemptId,
    command: { commandId: "open", createdAt: NOW },
    state,
  });
  const contactState = state;
  state = recordCombatRoundDisarmRoll({
    attemptId,
    command: { commandId: "actor-roll", createdAt: NOW },
    result: roll({ finalTotal: 31, participantId: "actor", role: "disarm_actor" }),
    state,
  });
  const actorRolledState = state;
  state = recordCombatRoundDisarmRoll({
    attemptId,
    command: { commandId: "holder-roll", createdAt: NOW },
    result: roll({ finalTotal: 15, participantId: "holder", role: "disarm_holder" }),
    state,
  });
  const awaitingCommitState = state;
  state = commitCombatRoundDisarm({
    attemptId,
    command: { commandId: "commit", createdAt: NOW },
    state,
  });
  const committedState = state;
  const scenarioParticipants = ["actor", "holder", "observer"].map(
    (id) =>
      ({
        characterId: `character-${id}`,
        controlledByUserId: `user-${id}`,
        id: `scenario-${id}`,
        isActive: true,
        role: "player_character",
        scenarioId: "scenario-1",
        snapshot: { displayName: id },
      }) as unknown as ScenarioParticipant,
  );
  const encounter = {
    combatRoundState: state,
    currentRound: 3,
    id: "encounter-1",
    participantVisibility: {
      actor: { actor: true, holder: true },
      holder: { actor: true, holder: true },
      observer: { observer: true },
    },
    participants: encounterParticipants,
    scenarioId: "scenario-1",
    updatedAt: NOW,
  } as unknown as EncounterSession;
  return {
    encounter,
    lifecycleStates: [
      declaredState,
      contactState,
      actorRolledState,
      awaitingCommitState,
      committedState,
    ],
    scenarioParticipants,
    state,
  };
}

describe("player-safe Disarm state", () => {
  it("keeps each involved roll usable without commands, opposite roll math, or hidden ratings", () => {
    const { encounter, scenarioParticipants } = fixture();
    const actor = buildPlayerSafeEncounterForUser({
      encounter,
      scenarioParticipants,
      userId: "user-actor",
    }).combatRoundState!;
    const holder = buildPlayerSafeEncounterForUser({
      encounter,
      scenarioParticipants,
      userId: "user-holder",
    }).combatRoundState!;
    const actorAttempt = actor.disarmAttempts[0]!;
    const holderAttempt = holder.disarmAttempts[0]!;

    expect(actor.commands.map((command) => command.type)).not.toEqual(
      expect.arrayContaining(["open_disarm", "roll_disarm", "commit_disarm"]),
    );
    expect(actorAttempt).toMatchObject({
      actingRoll: { finalTotal: 31, rolledByUserId: undefined },
      actingWeaponItemId: "redacted:disarm:acting-weapon",
      actingWeaponTemplateId: "redacted:disarm:acting-template",
      difference: undefined,
      resistingRoll: undefined,
      targetWeaponItemId: "redacted:disarm:target-weapon",
      targetWeaponItemRevision: "1970-01-01T00:00:00.000Z",
      targetWeaponTemplateId: "redacted:disarm:target-template",
    });
    expect(actorAttempt.id).toBe("disarm:round:3:phase1:actor:actor");
    expect(actorAttempt.actingRoll?.calculation.percentageContributions).toEqual([]);
    expect(JSON.stringify(actorAttempt)).not.toMatch(
      /Target 5 vs acting 2|secret-acting|secret-target|gm-only-control/,
    );
    expect(holderAttempt).toMatchObject({
      actingRoll: undefined,
      difference: undefined,
      resistingRoll: { finalTotal: 15, rolledByUserId: undefined },
    });
    expect(
      actor.participants.find((entry) => entry.participantId === "actor")?.declaration?.disarm,
    ).toBeUndefined();
    expect(JSON.stringify(holderAttempt)).not.toMatch(/secret-acting|secret-target/);
  });

  it("keeps actor and holder payloads independent of hidden Item facts across the full lifecycle", () => {
    const canonical = fixture();
    const nonexistent = fixture({ hiddenSuffix: "nonexistent" });

    canonical.lifecycleStates.forEach((state, index) => {
      for (const role of ["actor", "holder"] as const) {
        const projected = buildPlayerSafeEncounterForUser({
          encounter: { ...canonical.encounter, combatRoundState: state },
          scenarioParticipants: canonical.scenarioParticipants,
          userId: `user-${role}`,
        });
        const projectedNonexistent = buildPlayerSafeEncounterForUser({
          encounter: {
            ...nonexistent.encounter,
            combatRoundState: nonexistent.lifecycleStates[index],
          },
          scenarioParticipants: nonexistent.scenarioParticipants,
          userId: `user-${role}`,
        });

        expect(JSON.stringify(projected)).not.toMatch(
          /secret-acting|secret-target|secret-acting-template|secret-target-template|gm-only-control|Target 5 vs acting 2/,
        );
        expect(projected.combatRoundState?.disarmAttempts).toEqual(
          projectedNonexistent.combatRoundState?.disarmAttempts,
        );
        expect(
          projected.combatRoundState?.participants.find((entry) => entry.participantId === "actor")
            ?.declaration,
        ).toEqual(
          projectedNonexistent.combatRoundState?.participants.find(
            (entry) => entry.participantId === "actor",
          )?.declaration,
        );
      }
    });
  });

  it("makes an uncontrolled Disarm declaration equivalent to no declaration and hides it from an uninvolved viewer", () => {
    const { encounter, scenarioParticipants } = fixture();
    const holder = buildPlayerSafeEncounterForUser({
      encounter,
      scenarioParticipants,
      userId: "user-holder",
    });
    const noDeclaration = buildPlayerSafeEncounterForUser({
      encounter: {
        ...encounter,
        combatRoundState: {
          ...encounter.combatRoundState!,
          participants: encounter.combatRoundState!.participants.map((entry) =>
            entry.participantId === "actor" ? { ...entry, declaration: undefined } : entry,
          ),
        },
      },
      scenarioParticipants,
      userId: "user-holder",
    });
    const holderActor = holder.combatRoundState?.participants.find(
      (entry) => entry.participantId === "actor",
    );
    const noDeclarationActor = noDeclaration.combatRoundState?.participants.find(
      (entry) => entry.participantId === "actor",
    );
    expect(holderActor?.declaration).toEqual(noDeclarationActor?.declaration);

    const observer = buildPlayerSafeEncounterForUser({
      encounter,
      scenarioParticipants,
      userId: "user-observer",
    });
    expect(observer.combatRoundState?.disarmAttempts).toEqual([]);
    expect(observer.combatRoundState?.disarmUnbalancedConditions).toEqual([]);
    expect(JSON.stringify(observer)).not.toContain("secret-acting-item");
    expect(JSON.stringify(observer)).not.toContain("secret-target-item");
  });

  it("does not mutate authoritative undo snapshots while projecting safe views", () => {
    const { encounter, scenarioParticipants, state } = fixture();
    buildPlayerSafeEncounterForUser({ encounter, scenarioParticipants, userId: "user-actor" });
    const undone = undoLatestCombatRoundCommand({ state });

    expect(undone?.disarmAttempts[0]?.status).toBe("awaiting_commit");
    expect(undone?.commands.at(-1)?.type).toBe("roll_disarm");
    const safeUndone = buildPlayerSafeEncounterForUser({
      encounter: { ...encounter, combatRoundState: undone },
      scenarioParticipants,
      userId: "user-actor",
    });
    expect(JSON.stringify(safeUndone)).not.toMatch(
      /secret-acting|secret-target|gm-only-control|Target 5 vs acting 2/,
    );
    expect(safeUndone.combatRoundState?.disarmAttempts[0]).toMatchObject({
      actingWeaponItemId: "redacted:disarm:acting-weapon",
      status: "awaiting_commit",
      targetWeaponItemId: "redacted:disarm:target-weapon",
    });
  });
});

describe("player-safe missile readiness state", () => {
  it("keeps only the actor's progress and removes exact ammo, GM timing, and undo payloads", () => {
    const current = fixture();
    const profile = weaponTemplates.find(
      (weapon) => weapon.id === "weapon-template-bow",
    )!.missileProfile!;
    const seedCommand = current.state.commands[0]!;
    const readiness = {
      aimCompletedRounds: 1,
      aimLevel: 2 as const,
      aimRequiredRounds: 4,
      ammoFamily: "arrow" as const,
      ammoItemId: "secret-ammo-item",
      ammoItemRevision: REVISION,
      baseCompletedRounds: 1,
      baseRequiredRounds: 5,
      family: "short_bow" as const,
      gmPreparationAdjustment: 4,
      id: "missile-readiness:actor:secret-bow",
      lastCommandId: "secret-readiness-command",
      lastProgressRound: 3,
      participantId: "actor",
      phase: "phase1" as const,
      profile,
      rapidShot: false,
      status: "preparing" as const,
      targetParticipantId: "holder",
      updatedAt: NOW,
      weaponItemId: "secret-bow",
      weaponTemplateId: "weapon-template-bow",
    };
    const progressCommand = {
      ...seedCommand,
      facts: { ammoItemId: "secret-ammo-item", ammoItemRevision: REVISION, readiness },
      id: "secret-readiness-command",
      participantId: "actor",
      type: "progress_missile_readiness" as const,
    };
    const attackCommand = {
      ...seedCommand,
      facts: {
        missileAmmoUndo: {
          ammoItemId: "secret-ammo-item",
          quantityAfter: 2,
          quantityBefore: 3,
        },
      },
      id: "secret-attack-command",
      participantId: "actor",
      type: "roll_attack" as const,
    };
    const encounter = {
      ...current.encounter,
      combatRoundState: {
        ...current.state,
        commands: [...current.state.commands, progressCommand, attackCommand],
        missileReadiness: [
          readiness,
          { ...readiness, id: "other-readiness", participantId: "holder" },
        ],
      },
    } as EncounterSession;
    const actor = buildPlayerSafeEncounterForUser({
      encounter,
      scenarioParticipants: current.scenarioParticipants,
      userId: "user-actor",
    }).combatRoundState!;
    const observer = buildPlayerSafeEncounterForUser({
      encounter,
      scenarioParticipants: current.scenarioParticipants,
      userId: "user-observer",
    }).combatRoundState!;

    expect(actor.missileReadiness).toHaveLength(1);
    expect(actor.missileReadiness[0]).toMatchObject({
      aimCompletedRounds: 1,
      aimLevel: 2,
      aimRequiredRounds: 4,
      ammoItemId: undefined,
      ammoItemRevision: undefined,
      baseCompletedRounds: 1,
      baseRequiredRounds: 5,
      gmPreparationAdjustment: 0,
      lastCommandId: undefined,
      participantId: "actor",
    });
    expect(actor.commands.map((command) => command.type)).not.toContain(
      "progress_missile_readiness",
    );
    expect(JSON.stringify(actor)).not.toMatch(
      /secret-ammo-item|secret-readiness-command|quantityBefore|quantityAfter/,
    );
    expect(observer.missileReadiness).toEqual([]);
    expect(JSON.stringify(observer)).not.toMatch(/secret-ammo-item|other-readiness/);
  });
});
