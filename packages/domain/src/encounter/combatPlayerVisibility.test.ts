import { describe, expect, it } from "vitest";

import { scenarioParticipantSchema } from "../campaign/scenario";
import { getCombatDistanceParticipantAliases } from "./combatDistance";
import {
  buildPlayerSafeCombatScopeForParticipants,
  buildPlayerSafeCombatScopeForUser,
  hasCombatDistanceVisibility,
} from "./combatPlayerVisibility";
import {
  advanceCombatRoundStep,
  commitCombatRoundPhaseInitiativeResolution,
  initializeCombatRoundState,
  recordCombatRoundDeclaration,
  recordCombatRoundInitiative,
  type CombatRoundState,
} from "./combatRoundManager";
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

  /**
   * #894 acceptance criterion 4, at the **record** level: a hidden participant stays hidden from a
   * viewer even when initiative is published.
   *
   * Two participations, which a per-viewer claim requires: the viewer controls `scenario-a` and
   * `scenario-b`, and `scenario-c` belongs to another user. The hide is written into
   * `roleplayState.visibility` — the per-viewer matrix the GM's reachable control writes and this
   * gate consults — in the shape `updateRoleplayVisibility` produces (`viewer -> target ->
   * boolean`). `ScenarioParticipant.visibilityOverrides` is deliberately untouched: it has no
   * production write path and nothing here is wired to it (#798 ruling D1).
   *
   * The publication is real rather than stipulated: a genuine phase-1 initiative commit runs over
   * this very Encounter, and the stored record is asserted to publish the hidden participant's
   * total before visibility is measured. The commit's own record is also `neverPlayerFacing`, so
   * it reaches no player at all (#875, #895); this case measures the separate per-viewer gate.
   */
  it("#894 criterion 4 — a hidden participant stays hidden once initiative is published", () => {
    const input = fixture();
    const hidden = input.encounter.participants[2]!;
    const viewer = input.encounter.participants[0]!;

    // Past the first round, so the combat-start Combat Experience window is not the thing under
    // test here; the publication boundary is.
    input.encounter.currentRound = 3;
    let state: CombatRoundState = initializeCombatRoundState({ encounter: input.encounter });
    for (const combatant of state.participants) {
      state = recordCombatRoundDeclaration({
        declaration: {
          phaseContexts: {
            phase1: {
              modifierBuckets: {
                general: [],
                situationDb: [],
                situationInitiative: [],
                situationObSkill: [],
              },
              targetParticipantId: combatant.participantId === viewer.id ? hidden.id : viewer.id,
            },
          },
          roundNumber: state.roundNumber,
        },
        participantId: combatant.participantId,
        state,
        submittedBy: "gm",
      });
    }
    for (let guard = 0; guard < 60 && state.currentStep !== "initiative_phase_1"; guard += 1) {
      state = advanceCombatRoundStep(state);
    }
    expect(state.currentStep).toBe("initiative_phase_1");
    for (const [index, combatant] of state.participants.entries()) {
      state = recordCombatRoundInitiative({
        command: { createdAt: "2026-09-15T10:02:00.000Z", createdByUserId: "gm-1" },
        initiative: {
          baseInitiative: 0,
          modifierAdjustment: 0,
          rolls: [index + 2],
          rollTotal: index + 2,
          total: index + 2,
        },
        participantId: combatant.participantId,
        phase: "phase1",
        state,
        submittedBy: "gm",
      });
    }
    const committed = commitCombatRoundPhaseInitiativeResolution({
      command: { createdAt: "2026-09-15T10:03:00.000Z", createdByUserId: "gm-1" },
      phase: "phase1",
      state,
    });

    // Publication established, not assumed: the hidden participant's total is published by this
    // commit's own record. Without this the visibility measurement below would be vacuous.
    const publishedEntry = committed.state.committedInitiativeOrders
      .at(-1)
      ?.entries.find((entry) => entry.participantId === hidden.id);
    expect(publishedEntry?.initiativePublished).toBe(true);
    expect(publishedEntry?.initiativeResult?.total).toBe(4);

    // CONTROL: with the GM's row saying visible, this gate admits the participant through the
    // exact field the measurement reads, so a clean result below is a real exclusion.
    input.encounter.combatRoundState = committed.state;
    input.encounter.roleplayState = roleplayStateSchema.parse({
      visibility: { [viewer.id]: { [hidden.id]: true } },
    });
    expect(buildPlayerSafeCombatScopeForUser(input).visibleParticipantIds).toEqual(
      aliases(input, [0, 1, 2]),
    );

    // MEASUREMENT: the GM hides it from this one viewer, and no alias of it survives.
    input.encounter.roleplayState = roleplayStateSchema.parse({
      visibility: { [viewer.id]: { [hidden.id]: false } },
    });
    const scope = buildPlayerSafeCombatScopeForUser(input);
    expect(scope.visibleParticipantIds).toEqual(aliases(input, [0, 1]));
    for (const alias of getCombatDistanceParticipantAliases(hidden)) {
      expect(scope.visibleParticipantIds.has(alias), alias).toBe(false);
    }
    // The viewer's own participations are untouched, so the hide is per target, not a blackout.
    expect(scope.controlledEncounterParticipantIds).toEqual(aliases(input, [0, 1]));
  });

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
