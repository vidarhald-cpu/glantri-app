import { describe, expect, it } from "vitest";
import type {
  CombatLogEventPresentation,
  CombatLogProjection,
  CombatRoundState,
  CombatStepEvent,
} from "@glantri/domain";

import {
  createDefaultCombatLogSelection,
  reconcileCombatLogSelection,
  resolveCombatLogPresentationTargetEvents,
  selectCombatLogEvent,
} from "./combatLogSelection";

function logEvent(input: {
  id: string;
  sequence: number;
  targetId?: string;
  targetKind?: CombatLogEventPresentation["presentationTargetKind"];
}): CombatLogEventPresentation {
  return {
    category: input.sequence === 0 ? "round" : "attack",
    encounterId: "encounter-1",
    id: input.id,
    phase: "phase1",
    presentationTargetId: input.targetId,
    presentationTargetKind: input.targetKind,
    presentationTargetSourceId: input.targetId?.split(":").at(-1),
    roundNumber: 1,
    sequence: input.sequence,
    sourceEventIds: [`source-${input.sequence}`],
    sourceRevision: "revision-1",
    state: "final",
    summary: input.id,
    summaryFacts:
      input.sequence === 0
        ? { kind: "round_opened", roundNumber: 1 }
        : { kind: "attack_resolved", outcome: "hit" },
  };
}

function projection(
  events: readonly CombatLogEventPresentation[],
  sourceRevision = "revision-1",
  encounterId = "encounter-1",
): CombatLogProjection {
  return { encounterId, events, sourceRevision };
}

function stepEvent(input: {
  attackResultId?: string;
  id: string;
  parryResultId?: string;
  sequence: number;
  type: CombatStepEvent["type"];
}): CombatStepEvent {
  return {
    attackResultId: input.attackResultId,
    combatEffectIds: [],
    completeness: "complete",
    encounterId: "encounter-1",
    facts: { gmReview: {}, involvedOutcome: {}, publicOutcome: {}, rollerPrivate: {} },
    id: input.id,
    missingFacts: [],
    occurredAt: null,
    parryResultId: input.parryResultId,
    roundNumber: 1,
    schemaVersion: 1,
    sequence: input.sequence,
    source: { kind: "canonical", sourceIds: [] },
    status: "recorded",
    step: "phase_1_actions",
    type: input.type,
    visibility: { identityRefs: [], involvedParticipantIds: [], outcomeScope: "public" },
  };
}

describe("combatLogSelection", () => {
  const round = logEvent({ id: "round", sequence: 0 });
  const attack = logEvent({
    id: "attack",
    sequence: 1,
    targetId: "combat-presentation:attack:attack-1",
    targetKind: "attack",
  });
  const newer = logEvent({
    id: "damage",
    sequence: 2,
    targetId: "combat-presentation:damage:damage-1",
    targetKind: "damage",
  });

  it("defaults to the newest event with a presentation target", () => {
    expect(createDefaultCombatLogSelection(projection([round, attack, newer]))).toMatchObject({
      mode: "automatic",
      selectedCombatLogEventId: "damage",
      selectedPresentationTargetId: "combat-presentation:damage:damage-1",
    });
  });

  it("records manual target selection and explicit targetless selection", () => {
    const events = projection([round, attack]);
    expect(selectCombatLogEvent({ eventId: "attack", projection: events })).toMatchObject({
      mode: "explicit",
      selectedPresentationTargetId: "combat-presentation:attack:attack-1",
    });
    expect(selectCombatLogEvent({ eventId: "round", projection: events })).toEqual({
      encounterId: "encounter-1",
      mode: "explicit",
      selectedCombatLogEventId: "round",
      selectedPresentationTargetId: undefined,
      sourceRevision: "revision-1",
    });
  });

  it("retains a selected target across a newer accepted revision", () => {
    const current = selectCombatLogEvent({
      eventId: "attack",
      projection: projection([round, attack]),
    });
    expect(
      reconcileCombatLogSelection({
        current,
        projection: projection([round, attack, newer], "revision-2"),
      }),
    ).toMatchObject({
      mode: "explicit",
      selectedCombatLogEventId: "attack",
      selectedPresentationTargetId: "combat-presentation:attack:attack-1",
      sourceRevision: "revision-2",
    });
  });

  it("retains target identity when the corresponding canonical log row is replaced", () => {
    const current = selectCombatLogEvent({
      eventId: "attack",
      projection: projection([attack]),
    });
    const replacement = { ...attack, id: "attack-final", sequence: 3 };

    expect(
      reconcileCombatLogSelection({
        current,
        projection: projection([replacement], "revision-2"),
      }),
    ).toMatchObject({
      selectedCombatLogEventId: "attack-final",
      selectedPresentationTargetId: "combat-presentation:attack:attack-1",
    });
  });

  it("clears an undone target without jumping to an unrelated result", () => {
    const current = selectCombatLogEvent({
      eventId: "attack",
      projection: projection([round, attack]),
    });
    expect(
      reconcileCombatLogSelection({
        current,
        projection: projection([round, newer], "revision-2"),
      }),
    ).toEqual({
      encounterId: "encounter-1",
      mode: "cleared",
      sourceRevision: "revision-2",
    });
  });

  it("defaults again on reload or encounter replacement, but not after a clear", () => {
    const refreshed = projection([round, attack, newer], "revision-3");
    expect(createDefaultCombatLogSelection(refreshed).selectedCombatLogEventId).toBe("damage");

    const cleared = {
      encounterId: "encounter-1",
      mode: "cleared" as const,
      sourceRevision: "revision-2",
    };
    const retainedClear = reconcileCombatLogSelection({ current: cleared, projection: refreshed });
    expect(retainedClear.mode).toBe("cleared");
    expect(retainedClear.selectedCombatLogEventId).toBeUndefined();
    expect(
      reconcileCombatLogSelection({
        current: cleared,
        projection: projection([newer], "revision-1", "encounter-2"),
      }).selectedCombatLogEventId,
    ).toBe("damage");
  });

  it("defaults when the first target arrives, and rejects a missing manual event", () => {
    const emptyDefault = createDefaultCombatLogSelection(projection([round]));
    expect(
      reconcileCombatLogSelection({
        current: emptyDefault,
        projection: projection([round, attack], "revision-2"),
      }).selectedCombatLogEventId,
    ).toBe("attack");
    const missing = selectCombatLogEvent({
      eventId: "missing",
      projection: projection([round, attack]),
    });
    expect(missing.mode).toBe("cleared");
    expect(missing.selectedCombatLogEventId).toBeUndefined();
  });

  it("retains and then clears an explicitly selected targetless event", () => {
    const current = selectCombatLogEvent({ eventId: "round", projection: projection([round]) });
    expect(
      reconcileCombatLogSelection({
        current,
        projection: projection([round, attack], "revision-2"),
      }),
    ).toMatchObject({ mode: "explicit", selectedCombatLogEventId: "round" });
    expect(
      reconcileCombatLogSelection({
        current,
        projection: projection([attack], "revision-2"),
      }).mode,
    ).toBe("cleared");
  });

  it("resolves only source facts attached to the selected attack target", () => {
    const attackSource = stepEvent({
      attackResultId: "attack-1",
      id: "source-1",
      sequence: 1,
      type: "attack",
    });
    const parrySource = stepEvent({
      attackResultId: "attack-1",
      id: "parry-source",
      parryResultId: "parry-1",
      sequence: 2,
      type: "parry",
    });
    const staleAttack = stepEvent({
      attackResultId: "old-attack",
      id: "stale-attack",
      sequence: 3,
      type: "attack",
    });
    const targetedAttack = { ...attack, attackResultId: "attack-1" };
    const selected = selectCombatLogEvent({
      eventId: "attack",
      projection: projection([round, targetedAttack]),
    });
    const roundState = {
      events: [staleAttack, parrySource, attackSource],
      roundNumber: 1,
    } as unknown as CombatRoundState;

    expect(
      resolveCombatLogPresentationTargetEvents({
        projection: projection([round, targetedAttack]),
        roundStates: [roundState],
        selection: selected,
      }).map((event) => event.id),
    ).toEqual(["source-1", "parry-source"]);
  });

  it("returns no outcome facts for a selected event without a target", () => {
    const events = projection([round, attack]);
    expect(
      resolveCombatLogPresentationTargetEvents({
        projection: events,
        roundStates: [{ events: [], roundNumber: 1 } as unknown as CombatRoundState],
        selection: selectCombatLogEvent({ eventId: "round", projection: events }),
      }),
    ).toEqual([]);
  });

  it("keeps maneuver outcome selection scoped to its proposal", () => {
    const maneuver = {
      ...logEvent({
        id: "distance-contest",
        sequence: 4,
        targetId: "combat-presentation:maneuver:proposal-1",
        targetKind: "maneuver",
      }),
      proposalId: "proposal-1",
    };
    const proposalRoll = {
      ...stepEvent({ id: "dodge-roll", sequence: 1, type: "adjust_distance_roll" }),
      facts: {
        gmReview: {},
        involvedOutcome: { proposalId: "proposal-1" },
        publicOutcome: {},
        rollerPrivate: { rollD20: 8 },
      },
    };
    const oldManeuver = {
      ...stepEvent({ id: "old-dodge", sequence: 2, type: "adjust_distance_roll" }),
      facts: {
        gmReview: {},
        involvedOutcome: { proposalId: "old-proposal" },
        publicOutcome: {},
        rollerPrivate: { rollD20: 19 },
      },
    };
    const events = projection([round, maneuver]);

    expect(
      resolveCombatLogPresentationTargetEvents({
        projection: events,
        roundStates: [
          {
            events: [oldManeuver, proposalRoll],
            roundNumber: 1,
          } as unknown as CombatRoundState,
        ],
        selection: selectCombatLogEvent({ eventId: maneuver.id, projection: events }),
      }).map((event) => event.id),
    ).toEqual(["dodge-roll"]);
  });
});
