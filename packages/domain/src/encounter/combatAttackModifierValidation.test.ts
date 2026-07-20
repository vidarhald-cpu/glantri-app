import { describe, expect, it } from "vitest";

import {
  combatRoundStateSchema,
  fingerprintCombatModifierResolution,
  resolveCanonicalCombatAttackModifierFacts,
  scenarioParticipantSchema,
  type ScenarioParticipantCombatContext,
} from "../index";

const emptyBuckets = () => ({
  general: [],
  situationDb: [],
  situationInitiative: [],
  situationObSkill: [],
});

function participant(input: {
  id: string;
  modifierBuckets: ScenarioParticipantCombatContext["modifierBuckets"];
}) {
  return scenarioParticipantSchema.parse({
    createdAt: "2026-01-01T00:00:00.000Z",
    id: input.id,
    isActive: true,
    joinSource: "gm_added",
    role: "player_character",
    scenarioId: "scenario-1",
    snapshot: { displayName: input.id },
    sourceType: "character",
    state: {
      combat: { combatContext: { modifierBuckets: input.modifierBuckets } },
      equipment: {},
      health: {},
      resources: {},
    },
    updatedAt: "2026-01-01T00:00:00.000Z",
  });
}

describe("canonical combat attack modifier validation", () => {
  it("resolves both sides once from scenario identities and one canonical pair context", () => {
    const attacker = participant({
      id: "scenario-attacker",
      modifierBuckets: {
        ...emptyBuckets(),
        situationObSkill: [
          {
            generated: true,
            id: "generated:distance:phase1:ob-skill",
            notes: "short distance",
            scope: "until",
            sourceActionId: "attack_parry",
            sourceEncounterId: "encounter-1",
            sourcePhase: "phase1",
            sourceRoundNumber: 2,
            value: -2,
          },
        ],
      },
    });
    const defender = participant({
      id: "scenario-defender",
      modifierBuckets: {
        ...emptyBuckets(),
        situationDb: [
          {
            generated: true,
            id: "generated:adjust-range-attack:phase1:db-parry",
            notes: "adjust range",
            scope: "until",
            sourceActionId: "adjust_range_attack",
            sourceEncounterId: "encounter-1",
            sourcePhase: "phase1",
            sourceRoundNumber: 2,
            value: -2,
          },
        ],
      },
    });
    const state = combatRoundStateSchema.parse({
      currentStep: "phase_1_actions",
      participants: [
        {
          declaration: {
            actionId: "attack_parry",
            attackOpportunities: [
              {
                id: "current-opportunity",
                origin: "declared",
                phase: "phase1",
                slot: "attack_1",
                status: "committed",
                targetParticipantId: "encounter-defender",
              },
            ],
            roundNumber: 2,
            submittedBy: "player",
          },
          label: "Attacker",
          participantId: "encounter-attacker",
          scenarioParticipantId: attacker.id,
        },
        {
          declaration: {
            actionId: "adjust_range_attack",
            roundNumber: 2,
            submittedBy: "player",
          },
          label: "Defender",
          participantId: "encounter-defender",
          scenarioParticipantId: defender.id,
        },
      ],
      roundNumber: 2,
    });
    const original = structuredClone(state);

    const first = resolveCanonicalCombatAttackModifierFacts({
      attackerCombatantId: "encounter-attacker",
      attackerScenarioParticipant: attacker,
      defenderCombatantId: "encounter-defender",
      defenderScenarioParticipant: defender,
      encounterId: "encounter-1",
      opportunityId: "current-opportunity",
      phase: "phase1",
      state,
    });
    const reloaded = resolveCanonicalCombatAttackModifierFacts({
      attackerCombatantId: "encounter-attacker",
      attackerScenarioParticipant: scenarioParticipantSchema.parse(structuredClone(attacker)),
      defenderCombatantId: "encounter-defender",
      defenderScenarioParticipant: scenarioParticipantSchema.parse(structuredClone(defender)),
      encounterId: "encounter-1",
      opportunityId: "current-opportunity",
      phase: "phase1",
      state: combatRoundStateSchema.parse(structuredClone(state)),
    });

    expect(first).toEqual(reloaded);
    expect(first.pairKey).toBe("scenario-attacker::scenario-defender");
    expect(first.attackerResolution).toMatchObject({
      rows: [
        {
          id: "generated:distance:phase1:ob-skill",
          label: "short distance",
          value: -2,
        },
      ],
      total: -2,
    });
    expect(first.defenderResolution).toMatchObject({
      rows: [
        {
          id: "generated:adjust-range-attack:phase1:db-parry",
          label: "adjust range",
          value: -2,
        },
      ],
      total: -2,
    });
    expect(fingerprintCombatModifierResolution(first.attackerResolution)).toBe("v1:82d757a9");
    expect(state).toEqual(original);
  });
});
