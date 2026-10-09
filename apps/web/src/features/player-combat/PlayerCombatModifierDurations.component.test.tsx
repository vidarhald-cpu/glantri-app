import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { CombatEffect, ScenarioCombatModifierEntry } from "@glantri/domain";

import { formatEntryDuration } from "./combatSituationAwareness";
import { buildPlayerCombatModifierRows, PlayerCombatModifierPanel } from "./PlayerCombatPanels";

afterEach(() => {
  cleanup();
});

const NOW = "2026-01-01T00:00:00.000Z";

/** A player-shaped Combat effect: the projection omits `canonicalLifecycle` and `canonicalTransitions`. */
function playerEffect(overrides: Partial<CombatEffect> & Pick<CombatEffect, "id">): CombatEffect {
  return {
    combatModifierBucket: "general",
    createdAt: NOW,
    damage: 0,
    effectGroup: "general",
    generalDamage: 0,
    modifierValue: -10,
    sourceEventId: `event-${overrides.id}`,
    status: "active",
    targetParticipantId: "scenario-1",
    type: "general_modifier",
    updatedAt: NOW,
    ...overrides,
  } as CombatEffect;
}

function contextEntry(
  overrides: Partial<ScenarioCombatModifierEntry> & Pick<ScenarioCombatModifierEntry, "id">,
): ScenarioCombatModifierEntry {
  return { application: "percentage", scope: "until", value: -10, ...overrides };
}

/** Renders exactly what the live player page renders: read-only, rows built for the player. */
function renderPlayerPanel(input: {
  currentRound?: number;
  effects?: CombatEffect[];
  includeEntryDurations?: boolean;
  obSkill?: ScenarioCombatModifierEntry[];
}) {
  const rows = buildPlayerCombatModifierRows({
    combatContext: {
      modifierBuckets: {
        general: [],
        situationDb: [],
        situationInitiative: [],
        situationObSkill: input.obSkill ?? [],
      },
    },
    combatEffects: {
      effects: input.effects ?? [],
      events: (input.effects ?? []).map((effect) => ({
        createdAt: NOW,
        description: `Source of ${effect.id}`,
        id: effect.sourceEventId,
        sourceLabel: "Manual combat effect",
        sourceType: "gm_adjustment" as const,
        targetParticipantId: "scenario-1",
      })),
    },
    currentRound: input.currentRound ?? 3,
    includeAllPhases: true,
    includeEntryDurations: input.includeEntryDurations ?? true,
    ownerParticipantId: "scenario-1",
  });
  return render(
    <PlayerCombatModifierPanel
      context={{ roundNumber: input.currentRound ?? 3 }}
      readOnly
      rows={rows}
    />,
  );
}

function rowText(container: HTMLElement, label: string): string {
  const row = Array.from(container.querySelectorAll("div")).find(
    (element) =>
      element.children.length >= 2 &&
      element.firstElementChild?.textContent === label &&
      element.style.gridTemplateColumns !== "",
  );
  if (!row) throw new Error(`No modifier row labelled "${label}".`);
  return row.textContent ?? "";
}

describe("read-only player modifier panel durations", () => {
  it("shows the remaining round count of an effect whose duration text the Round End review ticks", () => {
    const { container } = renderPlayerPanel({
      effects: [playerEffect({ description: "Winded", duration: "3 rounds", id: "winded" })],
    });

    expect(rowText(container, "Winded")).toContain("3 rounds");
  });

  it("shows an absolute expiry relative to the current round", () => {
    const { container } = renderPlayerPanel({
      currentRound: 5,
      obSkill: [
        contextEntry({ expiresAtRound: 5, id: "feint-now", notes: "Feint now" }),
        contextEntry({ expiresAtRound: 7, id: "feint-later", notes: "Feint later" }),
      ],
    });

    expect(rowText(container, "Feint now")).toContain("Ends this round");
    expect(rowText(container, "Feint later")).toContain("Through round 7");
  });

  it("shows authored non-numeric duration text verbatim rather than interpreting it", () => {
    const { container } = renderPlayerPanel({
      effects: [playerEffect({ description: "Dazed", duration: "until rested", id: "dazed" })],
    });

    expect(rowText(container, "Dazed")).toContain("until rested");
  });

  it("renders no duration, and no placeholder, where none is genuinely known", () => {
    const { container } = renderPlayerPanel({
      currentRound: 3,
      effects: [
        // Phase-scoped: the Round End review does not tick its duration text, so it may be stale.
        playerEffect({
          description: "Phase scoped",
          duration: "2 rounds",
          id: "phase-scoped",
          initiativePhase: "phase1",
        }),
        playerEffect({ description: "No duration", id: "none" }),
      ],
      obSkill: [
        // `durationRounds` alone is the total at creation, never what remains.
        contextEntry({ durationRounds: 4, id: "total-only", notes: "Total only" }),
      ],
    });

    for (const label of ["Phase scoped", "No duration", "Total only"]) {
      const text = rowText(container, label);
      expect(text).not.toMatch(/round|Round|undefined|NaN|null/);
    }
    expect(container.textContent).not.toMatch(/undefined|NaN|null|0 rounds/);
    // Already past its last round: no duration is stated for it.
    expect(
      formatEntryDuration({
        entry: contextEntry({ expiresAtRound: 2, id: "past" }),
        roundNumber: 3,
      }),
    ).toBeUndefined();
  });

  it("adds nothing when the caller does not opt in", () => {
    const { container } = renderPlayerPanel({
      effects: [playerEffect({ description: "Winded", duration: "3 rounds", id: "winded" })],
      includeEntryDurations: false,
    });

    expect(rowText(container, "Winded")).not.toContain("3 rounds");
  });

  it("reads only fields the player already receives", () => {
    const read = new Set<string>();
    const spy = <T extends object>(value: T): T =>
      new Proxy(value, {
        get(target, property, receiver) {
          if (typeof property === "string") read.add(property);
          return Reflect.get(target, property, receiver);
        },
      });
    const entry = spy(
      contextEntry({
        canonicalTransitions: [],
        expiresAtRound: 6,
        id: "probe",
        sourceDuration: "2 rounds",
        sourceEffectId: "probe-effect",
      }),
    );
    const effect = spy({
      duration: "2 rounds",
      gmOverride: { reason: "private" },
      id: "probe-effect",
      privateDiagnostic: "private",
    });

    expect(formatEntryDuration({ entry, roundNumber: 3, sourceEffect: effect })).toBe("2 rounds");
    expect(
      formatEntryDuration({
        entry: spy(contextEntry({ expiresAtRound: 6, id: "p2" })),
        roundNumber: 3,
      }),
    ).toBe("Through round 6");

    for (const privateField of [
      "canonicalTransitions",
      "gmOverride",
      "privateDiagnostic",
      "createdByUserId",
      "sourceProcessId",
    ]) {
      expect(read.has(privateField)).toBe(false);
    }
    expect([...read].sort()).toEqual(
      [
        "canonicalLifecycle",
        "combatWide",
        "criticalRuntime",
        "duration",
        "expiresAtRound",
        "initiativePhase",
        "sourceEffectId",
      ].filter((field) => read.has(field)),
    );
  });
});
