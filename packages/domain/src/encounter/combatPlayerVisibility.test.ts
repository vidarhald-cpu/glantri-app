import { describe, expect, it } from "vitest";

import { scenarioParticipantSchema } from "../campaign/scenario";
import { getCombatDistanceParticipantAliases } from "./combatDistance";
import {
  buildPlayerSafeCombatScopeForParticipants,
  buildPlayerSafeCombatScopeForUser,
  hasCombatDistanceVisibility,
} from "./combatPlayerVisibility";
import { encounterSessionSchema, roleplayStateSchema } from "./session";

const now = "2026-09-15T10:00:00.000Z";
function fixture() {
  const scenarioParticipants = ["a", "b", "c"].map((id) =>
    scenarioParticipantSchema.parse({
      id: `scenario-${id}`,
      scenarioId: "scenario",
      characterId: `character-${id}`,
      controlledByUserId: id === "c" ? "other-user" : "user",
      role: "player_character",
      sourceType: "character",
      joinSource: "gm_added",
      isActive: true,
      state: { combat: {}, equipment: {}, health: {}, resources: {} },
      snapshot: { displayName: id },
      createdAt: now,
      updatedAt: now,
    }),
  );
  const encounter = encounterSessionSchema.parse({
    id: "encounter",
    scenarioId: "scenario",
    title: "Combat",
    kind: "combat",
    status: "active",
    participantMembershipMode: "explicit",
    createdAt: now,
    updatedAt: now,
    participants: scenarioParticipants.map((entry, index) => ({
      id: `encounter-${index}`,
      scenarioParticipantId: entry.id,
      characterId: entry.characterId,
      label: entry.snapshot.displayName,
      participantType: "scenario",
    })),
  });
  return { encounter, scenarioParticipants, userId: "user" };
}

function aliases(input: ReturnType<typeof fixture>, indexes: number[]) {
  return new Set(
    indexes.flatMap((index) =>
      getCombatDistanceParticipantAliases(input.encounter.participants[index]),
    ),
  );
}

describe("shared Combat player visibility", () => {
  it("preserves legacy membership fallback and its no-grid visibility", () => {
    const input = fixture();
    input.encounter.participantMembershipMode = undefined;
    input.encounter.participants = [];
    const scope = buildPlayerSafeCombatScopeForUser(input);
    expect(scope.controlledEncounterParticipantIds).toContain("scenario-a");
    expect(scope.controlledEncounterParticipantIds).toContain("scenario-b");
    expect(scope.controlledEncounterParticipantIds).not.toContain("scenario-c");
    expect(scope.visibleParticipantIds).toContain("scenario-c");
    expect(scope.visibleParticipantIds).not.toContain("character-c");
  });

  it("preserves no-grid defaults, controlled aliases, and explicit participant-scope parity", () => {
    const input = fixture();
    const scope = buildPlayerSafeCombatScopeForUser(input);
    expect(scope.controlledEncounterParticipantIds).toEqual(aliases(input, [0, 1]));
    expect(scope.visibleParticipantIds).toEqual(aliases(input, [0, 1, 2]));
    expect(
      buildPlayerSafeCombatScopeForParticipants({
        ...input,
        controlledEncounterParticipants: input.encounter.participants.slice(0, 2),
      }),
    ).toEqual(scope);
  });

  it("preserves any-controlled-viewer visibility and every existing identity alias", () => {
    const input = fixture();
    for (const viewer of getCombatDistanceParticipantAliases(input.encounter.participants[1])) {
      for (const target of getCombatDistanceParticipantAliases(input.encounter.participants[2])) {
        input.encounter.roleplayState = roleplayStateSchema.parse({
          visibility: { [viewer]: { [target]: true } },
        });
        expect(buildPlayerSafeCombatScopeForUser(input).visibleParticipantIds).toEqual(
          aliases(input, [0, 1, 2]),
        );
        expect(
          hasCombatDistanceVisibility({
            viewer: input.encounter.participants[1]!,
            target: input.encounter.participants[2]!,
            visibility: input.encounter.roleplayState.visibility,
          }),
        ).toBe(true);
      }
    }
  });

  it("preserves grid false/missing edges, self control, and participantVisibility precedence", () => {
    const input = fixture();
    input.encounter.roleplayState = roleplayStateSchema.parse({
      visibility: { "encounter-0": { "encounter-2": false } },
    });
    expect(buildPlayerSafeCombatScopeForUser(input).visibleParticipantIds).toEqual(
      aliases(input, [0, 1]),
    );
    input.encounter.roleplayState.visibility = { "encounter-0": {} };
    expect(buildPlayerSafeCombatScopeForUser(input).visibleParticipantIds).toEqual(
      aliases(input, [0, 1]),
    );
    expect(
      buildPlayerSafeCombatScopeForUser({
        ...input,
        encounter: { ...input.encounter, participantVisibility: {} },
      }).visibleParticipantIds,
    ).toEqual(aliases(input, [0, 1, 2]));
  });

  it.each(["hidden", "gm_only"] as const)(
    "preserves Scenario %s exclusion and controlled-self exception",
    (visibility) => {
      const input = fixture();
      input.scenarioParticipants[0]!.visibilityOverrides = { visibility };
      input.scenarioParticipants[2]!.visibilityOverrides = { visibility };
      expect(buildPlayerSafeCombatScopeForUser(input).visibleParticipantIds).toEqual(
        aliases(input, [0, 1]),
      );
    },
  );

  it("preserves inactive, unrelated, archived, and explicit-membership control rules", () => {
    const input = fixture();
    input.scenarioParticipants[0]!.isActive = false;
    expect(buildPlayerSafeCombatScopeForUser(input).controlledEncounterParticipantIds).toEqual(
      aliases(input, [1]),
    );
    expect(
      buildPlayerSafeCombatScopeForUser({ ...input, userId: "unrelated" })
        .controlledEncounterParticipantIds.size,
    ).toBe(0);
    input.encounter.participants = [input.encounter.participants[2]!];
    expect(buildPlayerSafeCombatScopeForUser(input).controlledEncounterParticipantIds.size).toBe(0);
    const archived = fixture();
    archived.encounter.status = "archived";
    expect(buildPlayerSafeCombatScopeForUser(archived).controlledEncounterParticipantIds.size).toBe(
      0,
    );
  });
});
