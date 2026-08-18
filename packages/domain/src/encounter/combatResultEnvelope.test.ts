import { describe, expect, it } from "vitest";

import { projectCombatResultEnvelope } from "./combatResultEnvelope";
import {
  buildCombatResultAdjustmentMetadata,
  combatResultPresentationFactsSchema,
} from "./combatResultPresentation";
import { combatStepEventSchema } from "./combatStepEventSchema";

function event() {
  return combatStepEventSchema.parse({
    actorParticipantId: "attacker",
    commandId: "command-1",
    completeness: "complete",
    encounterId: "encounter-1",
    facts: {
      gmReview: { adjudicationCode: "private", targetCalculation: { total: 12 } },
      involvedOutcome: { difference: 7 },
      publicOutcome: {},
      resultPresentation: {
        actionInstanceId: "feint-1",
        calculationReferences: [
          {
            kind: "calculation_snapshot",
            ownerParticipantId: "attacker",
            sourceId: "roll-attacker",
            visibility: "owner",
          },
          {
            kind: "calculation_snapshot",
            ownerParticipantId: "defender",
            sourceId: "roll-defender",
            visibility: "owner",
          },
        ],
        committedConsequences: [
          {
            affectedParticipantId: "defender",
            key: "defenderPhase2SkillObModifier",
            label: "Defender Skill/OB · Phase 2",
            value: -3,
          },
        ],
        conciseOutcome: { details: ["Margin 7"], label: "Feint committed" },
        publicCombatNote: "The defender overcommitted.",
        standardConsequences: [
          {
            affectedParticipantId: "defender",
            key: "defenderPhase2SkillObModifier",
            label: "Defender Skill/OB · Phase 2",
            value: -2,
          },
        ],
        subordinateEventReferences: ["roll-attacker", "roll-defender", "modifier-1"],
      },
      rollerPrivate: {},
    },
    id: "event-1",
    missingFacts: [],
    occurredAt: "2026-07-29T12:00:00.000Z",
    ownerParticipantId: "attacker",
    roundNumber: 2,
    schemaVersion: 1,
    sequence: 4,
    source: {
      commandType: "commit_feint_result",
      kind: "canonical",
      sourceIds: ["command-1", "feint-1"],
    },
    status: "committed",
    step: "phase_1_actions",
    targetParticipantId: "defender",
    type: "feint_committed",
    visibility: {
      identityRefs: [
        { participantId: "attacker", role: "actor" },
        { participantId: "defender", role: "target" },
      ],
      involvedParticipantIds: ["attacker", "defender"],
      outcomeScope: "involved",
    },
  });
}

const identities = [
  {
    displayName: "Aria",
    participantId: "attacker",
    role: "actor" as const,
    visibility: "visible" as const,
  },
  {
    displayName: "Borin",
    participantId: "defender",
    role: "target" as const,
    visibility: "visible" as const,
  },
];

describe("combat result envelope", () => {
  it("projects one typed GM envelope over canonical event identity and private diagnostics", () => {
    const envelope = projectCombatResultEnvelope({
      event: event(),
      identities,
      involved: true,
      ownRoll: true,
      viewer: "gm",
    });

    expect(envelope).toMatchObject({
      actionInstanceId: "feint-1",
      actionType: "feint_committed",
      actor: { displayName: "Aria", participantId: "attacker" },
      conciseOutcome: { details: ["Margin 7"], label: "Feint committed" },
      publicCombatNote: "The defender overcommitted.",
      resultId: "event-1",
      round: 2,
      sequence: 4,
      step: "phase_1_actions",
      visibility: { calculationAccess: "full", privateDiagnosticsIncluded: true },
    });
    expect(envelope.participants).toEqual(identities);
    expect(envelope.privateDiagnostics[0]).toMatchObject({
      factKeys: ["adjudicationCode", "targetCalculation"],
      source: "gm_review",
    });
    expect(envelope.provenance).toMatchObject({
      commandId: "command-1",
      sourceIds: ["command-1", "feint-1"],
    });
    expect(envelope.subordinateEventReferences).toEqual([
      "roll-attacker",
      "roll-defender",
      "modifier-1",
    ]);
  });

  it("keeps the public note but strips private diagnostics and provenance ids for players", () => {
    const envelope = projectCombatResultEnvelope({
      event: event(),
      identities,
      involved: true,
      ownRoll: false,
      viewer: "player",
    });
    const serialized = JSON.stringify(envelope);

    expect(envelope.publicCombatNote).toBe("The defender overcommitted.");
    expect(envelope.privateDiagnostics).toEqual([]);
    expect(envelope.calculationReferences).toEqual([]);
    expect(envelope.provenance.commandId).toBeUndefined();
    expect(envelope.provenance.sourceIds).toEqual([]);
    expect(envelope.subordinateEventReferences).toEqual([]);
    expect(serialized).not.toContain("adjudicationCode");
    expect(serialized).not.toContain("targetCalculation");
    expect(serialized).not.toContain('"source":"gm_review"');
  });

  it("projects the same explicit process identity for GM and player event fragments", () => {
    const roll = combatStepEventSchema.parse({
      ...event(),
      facts: {
        gmReview: {},
        involvedOutcome: { proposalId: "feint-1", side: "attacker" },
        publicOutcome: {},
        rollerPrivate: {},
      },
      type: "feint_roll",
    });
    const gm = projectCombatResultEnvelope({
      event: roll,
      identities,
      involved: true,
      ownRoll: true,
      viewer: "gm",
    });
    const player = projectCombatResultEnvelope({
      event: roll,
      identities,
      involved: true,
      ownRoll: true,
      viewer: "player",
    });

    expect(gm.actionInstanceId).toBe("feint-1");
    expect(player.actionInstanceId).toBe("feint-1");
  });

  it("does not treat a shared command as proof that round-end processes are one result", () => {
    const observationStatus = combatStepEventSchema.parse({
      ...event(),
      facts: {
        gmReview: {},
        involvedOutcome: {
          observationStatus: "progress",
          relationshipId: "observation:attacker:defender",
        },
        publicOutcome: {},
        rollerPrivate: {},
      },
      step: "round_summary",
      type: "observation",
    });
    const participantReview = combatStepEventSchema.parse({
      ...event(),
      facts: {
        gmReview: {},
        involvedOutcome: {},
        publicOutcome: {},
        rollerPrivate: {},
      },
      step: "round_summary",
      type: "participant_su_review",
    });

    expect(
      projectCombatResultEnvelope({
        event: observationStatus,
        identities,
        involved: true,
        ownRoll: true,
        viewer: "gm",
      }).actionInstanceId,
    ).toBeUndefined();
    expect(
      projectCombatResultEnvelope({
        event: participantReview,
        identities,
        involved: true,
        ownRoll: true,
        viewer: "gm",
      }).actionInstanceId,
    ).toBeUndefined();
  });

  it("uses the attack result as the shared attack/parry process identity", () => {
    const attack = combatStepEventSchema.parse({
      ...event(),
      attackResultId: "attack-result-1",
      facts: {
        gmReview: {},
        involvedOutcome: {},
        publicOutcome: {},
        rollerPrivate: {},
      },
      opportunityId: "opportunity-1",
      type: "attack",
    });
    const parry = combatStepEventSchema.parse({
      ...event(),
      attackResultId: "attack-result-1",
      facts: {
        gmReview: {},
        involvedOutcome: {},
        publicOutcome: {},
        rollerPrivate: {},
      },
      parryResultId: "attack-result-1:parry",
      type: "parry",
    });

    const project = (source: typeof attack) =>
      projectCombatResultEnvelope({
        event: source,
        identities,
        involved: true,
        ownRoll: true,
        viewer: "gm",
      }).actionInstanceId;

    expect(project(attack)).toBe("attack-result-1");
    expect(project(parry)).toBe("attack-result-1");
  });

  it("omits consequences tied to a participant identity hidden from the viewer", () => {
    const envelope = projectCombatResultEnvelope({
      event: event(),
      identities: [identities[0]!],
      involved: true,
      ownRoll: false,
      viewer: "player",
    });

    expect(envelope.standardConsequences).toEqual([]);
    expect(envelope.committedConsequences).toEqual([]);
    expect(envelope.adjustment).toBeUndefined();
  });

  it("adapts a legacy event without reconstructing absent consequence facts", () => {
    const legacy = combatStepEventSchema.parse({
      ...event(),
      completeness: "legacy_derived",
      facts: {
        gmReview: {},
        involvedOutcome: {},
        publicOutcome: {},
        rollerPrivate: {},
      },
      source: { kind: "legacy_result", sourceIds: ["legacy-result-1"] },
    });
    const envelope = projectCombatResultEnvelope({
      event: legacy,
      identities,
      involved: true,
      ownRoll: false,
      viewer: "player",
    });

    expect(envelope.conciseOutcome).toEqual({
      details: [],
      label: "Feint committed",
    });
    expect(envelope.standardConsequences).toEqual([]);
    expect(envelope.committedConsequences).toEqual([]);
    expect(envelope.publicCombatNote).toBeUndefined();
    expect(envelope.provenance.completeness).toBe("legacy_derived");
  });

  it("adapts only known legacy public-note paths without exposing generic GM review", () => {
    const legacyFeint = combatStepEventSchema.parse({
      ...event(),
      facts: {
        gmReview: {
          adjudicationCode: "private",
          notes: "The defender follows the false opening.",
        },
        involvedOutcome: {},
        publicOutcome: {},
        rollerPrivate: {},
      },
    });
    const legacyDamage = combatStepEventSchema.parse({
      ...event(),
      facts: {
        gmReview: {
          diagnosticCode: "private",
          review: { notes: "The shield splinters under the blow." },
        },
        involvedOutcome: {},
        publicOutcome: {},
        rollerPrivate: {},
      },
      type: "damage_committed",
    });
    const feintEnvelope = projectCombatResultEnvelope({
      event: legacyFeint,
      identities,
      involved: true,
      ownRoll: false,
      viewer: "player",
    });
    const damageEnvelope = projectCombatResultEnvelope({
      event: legacyDamage,
      identities,
      involved: true,
      ownRoll: false,
      viewer: "player",
    });

    expect(feintEnvelope.publicCombatNote).toBe("The defender follows the false opening.");
    expect(damageEnvelope.publicCombatNote).toBe("The shield splinters under the blow.");
    expect(JSON.stringify([feintEnvelope, damageEnvelope])).not.toContain("adjudicationCode");
    expect(JSON.stringify([feintEnvelope, damageEnvelope])).not.toContain("diagnosticCode");
  });

  it("records adjustment metadata only when committed consequences differ", () => {
    const standard = [{ key: "distance", label: "Distance", value: 2 }];

    expect(
      buildCombatResultAdjustmentMetadata({
        committedConsequences: standard,
        standardConsequences: standard,
      }),
    ).toBeUndefined();
    expect(
      buildCombatResultAdjustmentMetadata({
        committedConsequences: [{ key: "distance", label: "Distance", value: 3 }],
        standardConsequences: standard,
      }),
    ).toEqual({
      adjustedBy: "gm",
      entries: [
        {
          committedValue: 3,
          consequenceKey: "distance",
          label: "Distance",
          standardValue: 2,
        },
      ],
    });
  });

  it("rejects unrelated presentation fields instead of accepting an untyped result bag", () => {
    expect(() =>
      combatResultPresentationFactsSchema.parse({
        conciseOutcome: { label: "Feint committed" },
        unrelatedEncounterState: { participants: [] },
      }),
    ).toThrow();
  });
});
