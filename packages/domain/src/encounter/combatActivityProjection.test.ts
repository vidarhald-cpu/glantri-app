import { describe, expect, it } from "vitest";

import {
  buildCombatActivityFacts,
  COMBAT_ACTIVITY_FACTS_PAYLOAD_KEY,
  COMBAT_ACTIVITY_ITEM_RESOLUTION_EVENT_KIND,
  COMBAT_ACTIVITY_PUBLISHED_EVENT_TYPES,
  COMBAT_ACTIVITY_SUPPRESSED_EVENT_TYPES,
  isCombatActivityEventKindPublished,
  isCombatStepEventPublishedToActivity,
  readCombatActivityFacts,
  renderCombatActivitySummary,
} from "./combatActivityProjection";
import {
  combatStepEventSchema,
  combatStepEventTypeSchema,
  type CombatStepEvent,
  type CombatStepEventType,
} from "./combatStepEventSchema";

/**
 * The classification settled in combat-panel-contract.md 12.13 and Forgejo issue #317, written out
 * member by member. This is a **positive** list: the exhaustiveness assertion below fails loudly
 * when a `combatStepEventTypeSchema` member is added without being classified here.
 */
const EXPECTED_CLASSIFICATION: Readonly<Record<CombatStepEventType, "publish" | "suppress">> = {
  action_skipped: "suppress",
  adjust_distance_adjustment: "suppress",
  adjust_distance_committed: "publish",
  adjust_distance_response: "suppress",
  adjust_distance_result: "publish",
  adjust_distance_roll: "suppress",
  attack: "publish",
  break_off_committed: "publish",
  break_off_result: "publish",
  break_off_review: "suppress",
  break_off_roll: "suppress",
  combat_experience: "suppress",
  continued_contact_maintenance: "suppress",
  critical: "publish",
  damage_committed: "publish",
  damage_proposed: "suppress",
  declaration: "suppress",
  disarm_committed: "publish",
  disarm_opened: "suppress",
  disarm_result: "publish",
  disarm_roll: "suppress",
  distance_control_applied: "suppress",
  distance_control_result: "publish",
  distance_control_roll: "suppress",
  effect_review: "suppress",
  feint_committed: "publish",
  feint_feasibility: "suppress",
  feint_impossible: "suppress",
  feint_result: "publish",
  feint_roll: "suppress",
  health_check: "publish",
  hit_location: "publish",
  initiative: "suppress",
  missile_readiness: "suppress",
  modifier_review: "suppress",
  observation: "publish",
  offensive_parry_brawling: "suppress",
  parry: "publish",
  participant_su_review: "suppress",
  round_boundary: "suppress",
  task_resolved: "publish",
};

function buildEvent(overrides: Partial<CombatStepEvent>): CombatStepEvent {
  return combatStepEventSchema.parse({
    completeness: "complete",
    encounterId: "encounter-1",
    facts: { gmReview: {}, involvedOutcome: {}, publicOutcome: {}, rollerPrivate: {} },
    id: "event-1",
    missingFacts: [],
    occurredAt: "2026-09-24T10:00:00.000Z",
    roundNumber: 1,
    schemaVersion: 1,
    sequence: 1,
    source: { kind: "canonical", sourceIds: [] },
    status: "recorded",
    step: "phase_1_actions",
    type: "attack",
    visibility: { identityRefs: [], involvedParticipantIds: [], outcomeScope: "public" },
    ...overrides,
  });
}

const identity = (participantId: string | undefined) => participantId;

describe("combat Activity positive publish list", () => {
  it("classifies every combatStepEventTypeSchema member exactly once", () => {
    const members = combatStepEventTypeSchema.options;
    const classified = Object.keys(EXPECTED_CLASSIFICATION).sort();

    // A member added to the enum without a classification fails here, not silently in production.
    expect(classified).toEqual([...members].sort());
    expect(members).toHaveLength(41);

    const published = members.filter((member) => EXPECTED_CLASSIFICATION[member] === "publish");
    const suppressed = members.filter((member) => EXPECTED_CLASSIFICATION[member] === "suppress");
    expect(published).toHaveLength(17);
    expect(suppressed).toHaveLength(24);

    expect([...COMBAT_ACTIVITY_PUBLISHED_EVENT_TYPES].sort()).toEqual([...published].sort());
    expect([...COMBAT_ACTIVITY_SUPPRESSED_EVENT_TYPES].sort()).toEqual([...suppressed].sort());
    expect(
      COMBAT_ACTIVITY_PUBLISHED_EVENT_TYPES.filter((member) =>
        (COMBAT_ACTIVITY_SUPPRESSED_EVENT_TYPES as readonly string[]).includes(member),
      ),
    ).toEqual([]);
  });

  it.each(combatStepEventTypeSchema.options)(
    "gates %s on the write side according to its settled classification",
    (member) => {
      expect(isCombatStepEventPublishedToActivity(member)).toBe(
        EXPECTED_CLASSIFICATION[member] === "publish",
      );
    },
  );

  it.each(combatStepEventTypeSchema.options)(
    "gates %s on the read side according to its settled classification",
    (member) => {
      expect(isCombatActivityEventKindPublished(member)).toBe(
        EXPECTED_CLASSIFICATION[member] === "publish",
      );
    },
  );

  it("publishes the item_resolution payload classification and suppresses unknown kinds", () => {
    expect(isCombatActivityEventKindPublished(COMBAT_ACTIVITY_ITEM_RESOLUTION_EVENT_KIND)).toBe(
      true,
    );
    // The eventKind helper falls back to the row's eventType for a legacy row that carries none.
    expect(isCombatActivityEventKindPublished("encounter_combat_outcome")).toBe(false);
    expect(isCombatActivityEventKindPublished("a_kind_nobody_classified")).toBe(false);
  });
});

describe("terminal-outcome coverage for suppressed intermediates", () => {
  /**
   * combat-panel-contract.md 12.13 section 4: where a suppressed intermediate leads to a meaningful
   * result, the terminal outcome must be published instead. Each suppressed intermediate below is
   * pinned to the published terminal event that carries its result into the recap.
   */
  const TERMINAL_COUNTERPART: Readonly<Record<string, readonly CombatStepEventType[]>> = {
    adjust_distance_adjustment: ["adjust_distance_result", "adjust_distance_committed"],
    adjust_distance_response: ["adjust_distance_result", "adjust_distance_committed"],
    adjust_distance_roll: ["adjust_distance_result", "adjust_distance_committed"],
    break_off_review: ["break_off_result", "break_off_committed"],
    break_off_roll: ["break_off_result", "break_off_committed"],
    damage_proposed: ["damage_committed"],
    declaration: ["attack", "parry"],
    disarm_opened: ["disarm_result", "disarm_committed"],
    disarm_roll: ["disarm_result", "disarm_committed"],
    distance_control_applied: ["distance_control_result"],
    distance_control_roll: ["distance_control_result"],
    feint_feasibility: ["feint_result", "feint_committed"],
    feint_roll: ["feint_result", "feint_committed"],
  };

  /**
   * Returned to the control plane as an implementation gap rather than closed by publishing the
   * mechanic (12.13 section 4). Each of these is itself the terminal record of its outcome and has
   * no published counterpart at this baseline:
   *
   * - `feint_impossible` is emitted *instead of* `feint_feasibility` with status
   *   `not_applicable`; no `feint_result` or `feint_committed` ever follows.
   * - `continued_contact_maintenance` is a Brawling skill contest whose own event is the only
   *   record of who won.
   * - `offensive_parry_brawling` carries `publicOutcome.contactEstablished`, which no other event
   *   reproduces; a following `damage_committed` or `parry` is not guaranteed.
   */
  const RETURNED_AS_IMPLEMENTATION_GAP = [
    "feint_impossible",
    "continued_contact_maintenance",
    "offensive_parry_brawling",
  ] as const;

  it("covers every suppressed intermediate by a published terminal event or a recorded return", () => {
    const bookkeeping = new Set([
      "combat_experience",
      "modifier_review",
      "initiative",
      "action_skipped",
      "missile_readiness",
      "participant_su_review",
      "effect_review",
      "round_boundary",
    ]);

    for (const member of COMBAT_ACTIVITY_SUPPRESSED_EVENT_TYPES) {
      if (bookkeeping.has(member)) continue;
      if ((RETURNED_AS_IMPLEMENTATION_GAP as readonly string[]).includes(member)) continue;
      const counterparts = TERMINAL_COUNTERPART[member];
      expect(counterparts, `${member} has no recorded terminal counterpart`).toBeDefined();
      for (const counterpart of counterparts ?? []) {
        expect(isCombatStepEventPublishedToActivity(counterpart)).toBe(true);
      }
    }
  });

  it("keeps the returned gaps suppressed rather than publishing the mechanic", () => {
    for (const member of RETURNED_AS_IMPLEMENTATION_GAP) {
      expect(isCombatStepEventPublishedToActivity(member)).toBe(false);
    }
  });
});

describe("persisted structured facts", () => {
  it("carries only public-scope facts, never GM-only or roller-private material", () => {
    const facts = buildCombatActivityFacts({
      event: buildEvent({
        actorParticipantId: "p-attacker",
        attackerParticipantId: "p-attacker",
        defenderParticipantId: "p-defender",
        facts: {
          gmReview: { secretModifier: 17 },
          involvedOutcome: { weaponName: "Longsword" },
          publicOutcome: { hit: true },
          rollerPrivate: { rollD20: 3 },
        },
        type: "attack",
      }),
      summaryFacts: { kind: "attack_resolved", outcome: "hit", weaponName: "Longsword" },
      toScenarioParticipantId: identity,
    });

    expect(facts.publicOutcome).toEqual({ hit: true });
    expect(JSON.stringify(facts)).not.toContain("secretModifier");
    expect(JSON.stringify(facts)).not.toContain("rollD20");
    expect(facts.identities).toEqual(
      expect.arrayContaining([
        {
          hiddenIdentityFallback: "unseen_attacker",
          participantId: "p-attacker",
          role: "attacker",
        },
        { hiddenIdentityFallback: "unseen_target", participantId: "p-defender", role: "defender" },
      ]),
    );
  });

  it("round-trips through a payloadJson-shaped record", () => {
    const facts = buildCombatActivityFacts({
      event: buildEvent({ actorParticipantId: "p-1", type: "observation" }),
      toScenarioParticipantId: identity,
    });
    const payload = JSON.parse(
      JSON.stringify({ [COMBAT_ACTIVITY_FACTS_PAYLOAD_KEY]: facts, eventKind: "observation" }),
    );
    expect(readCombatActivityFacts(payload)).toEqual(facts);
    expect(readCombatActivityFacts({ eventKind: "observation" })).toBeUndefined();
    expect(readCombatActivityFacts(undefined)).toBeUndefined();
  });
});

describe("per-viewer Activity summary", () => {
  const participantDisplayNames = new Map([
    ["p-attacker", "Sergeant"],
    ["p-defender", "Test Hunter"],
  ]);

  const attackFacts = buildCombatActivityFacts({
    event: buildEvent({
      actorParticipantId: "p-attacker",
      attackerParticipantId: "p-attacker",
      defenderParticipantId: "p-defender",
      facts: {
        gmReview: {},
        involvedOutcome: { weaponName: "Longsword" },
        publicOutcome: { hit: true },
        rollerPrivate: {},
      },
      type: "attack",
      visibility: {
        identityRefs: [],
        involvedParticipantIds: ["p-attacker", "p-defender"],
        outcomeScope: "perceived",
      },
    }),
    summaryFacts: { kind: "attack_resolved", outcome: "hit", weaponName: "Longsword" },
    toScenarioParticipantId: identity,
  });

  it("yields different authorized sentences for two viewers from the same stored facts", () => {
    const defenderView = renderCombatActivitySummary({
      facts: attackFacts,
      participantDisplayNames,
      viewer: {
        controlledParticipantIds: new Set(["p-defender"]),
        kind: "player",
        // The defender was struck but never perceived the attacker.
        visibleParticipantIds: new Set(["p-defender"]),
      },
    });
    const attackerView = renderCombatActivitySummary({
      facts: attackFacts,
      participantDisplayNames,
      viewer: {
        controlledParticipantIds: new Set(["p-attacker"]),
        kind: "player",
        visibleParticipantIds: new Set(["p-attacker", "p-defender"]),
      },
    });
    const gmView = renderCombatActivitySummary({
      facts: attackFacts,
      participantDisplayNames,
      viewer: { kind: "gm" },
    });

    expect(defenderView).toBe("An unseen attacker attacked you with Longsword. The attack hit.");
    expect(attackerView).toBe("You attacked Test Hunter with Longsword. The attack hit.");
    expect(gmView).toBe("Sergeant attacked Test Hunter with Longsword. The attack hit.");
    expect(defenderView).not.toBe(attackerView);
    // No stored rendered string is authority: the same facts produced three different sentences.
    expect(new Set([defenderView, attackerView, gmView]).size).toBe(3);
  });

  it("renders a parry from the defender's side, per Player Play V1 9.2", () => {
    const parryFacts = buildCombatActivityFacts({
      event: buildEvent({
        attackerParticipantId: "p-attacker",
        defenderParticipantId: "p-defender",
        facts: {
          gmReview: {},
          involvedOutcome: {},
          publicOutcome: { success: true },
          rollerPrivate: {},
        },
        type: "parry",
      }),
      summaryFacts: { defense: "parry", kind: "defense_resolved", outcome: "succeeded" },
      toScenarioParticipantId: identity,
    });

    expect(
      renderCombatActivitySummary({
        facts: parryFacts,
        participantDisplayNames,
        viewer: { kind: "gm" },
      }),
    ).toBe("Test Hunter’s parry succeeded.");
    expect(
      renderCombatActivitySummary({
        facts: parryFacts,
        participantDisplayNames,
        viewer: {
          controlledParticipantIds: new Set(["p-defender"]),
          kind: "player",
          visibleParticipantIds: new Set(["p-defender", "p-attacker"]),
        },
      }),
    ).toBe("Your parry succeeded.");
  });

  it("falls back to the event's own public-scope facts where the Combat Log projects no entry", () => {
    const disarmFacts = buildCombatActivityFacts({
      event: buildEvent({
        actorParticipantId: "p-attacker",
        facts: {
          gmReview: {},
          involvedOutcome: {},
          publicOutcome: { success: true },
          rollerPrivate: {},
        },
        targetParticipantId: "p-defender",
        type: "disarm_result",
      }),
      toScenarioParticipantId: identity,
    });

    expect(
      renderCombatActivitySummary({
        facts: disarmFacts,
        participantDisplayNames,
        viewer: { kind: "gm" },
      }),
    ).toBe("Sergeant disarmed Test Hunter.");
  });
});
