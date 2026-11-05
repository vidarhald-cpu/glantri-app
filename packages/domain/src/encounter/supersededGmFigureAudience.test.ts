import { describe, expect, it } from "vitest";

import { SUPERSEDED_GM_FIGURE_FIELD, withoutSupersededGmFigure } from "../index";

/**
 * #931. The one definition of "this field does not appear in a player-reachable body", used by
 * the two read paths a by-response-key sweep measured it arriving on: the scenario player
 * projection's denylist-sanitised combat context, and a declaration event's whole `phaseContexts`
 * inside an open combat-history fact bucket.
 */
describe("withoutSupersededGmFigure (#931)", () => {
  it("removes the field at the depth the measured leaks carried it", () => {
    // The shape the combat-history sweep reported, four levels down inside an open fact bucket.
    const facts = {
      actionId: "double_attack",
      phaseContexts: {
        phase2: {
          modifierBuckets: {
            situationDb: [
              {
                id: "generated:attack-phase-penalty:round:1:participant:aria:phase2:attack_2:db-parry",
                notes: "Double Attack second attack cancelled: DB/Parry -2% in phase2",
                supersededGmFigure: {
                  text: "committed weapon attack: DB/Parry -4% in phase2",
                  value: -1,
                },
                value: -2,
              },
              { id: "untouched", value: -1 },
            ],
          },
        },
      },
    };
    // The instrument is alive before the assertion that it is gone.
    expect(JSON.stringify(facts)).toContain(SUPERSEDED_GM_FIGURE_FIELD);

    const projected = withoutSupersededGmFigure(facts);

    expect(JSON.stringify(projected)).not.toContain(SUPERSEDED_GM_FIGURE_FIELD);
    // Everything the reader is entitled to survives, including the row and its own text.
    expect(projected.phaseContexts.phase2.modifierBuckets.situationDb).toEqual([
      {
        id: "generated:attack-phase-penalty:round:1:participant:aria:phase2:attack_2:db-parry",
        notes: "Double Attack second attack cancelled: DB/Parry -2% in phase2",
        value: -2,
      },
      { id: "untouched", value: -1 },
    ]);
    expect(projected.actionId).toBe("double_attack");
    // The input is not mutated: the GM's own read runs off the same objects.
    expect(JSON.stringify(facts)).toContain(SUPERSEDED_GM_FIGURE_FIELD);
  });

  it("removes it at the top level and inside arrays of arrays", () => {
    expect(withoutSupersededGmFigure({ supersededGmFigure: { value: -1 }, value: -2 })).toEqual({
      value: -2,
    });
    expect(
      withoutSupersededGmFigure([[{ supersededGmFigure: { value: -1 }, id: "a" }], [{ id: "b" }]]),
    ).toEqual([[{ id: "a" }], [{ id: "b" }]]);
  });

  it("returns a body that never had the field by reference, so a clean read is not rebuilt", () => {
    const clean = { modifierBuckets: { situationDb: [{ id: "a", value: -2 }] } };
    expect(withoutSupersededGmFigure(clean)).toBe(clean);
    expect(withoutSupersededGmFigure(clean).modifierBuckets).toBe(clean.modifierBuckets);
  });

  it("leaves primitives, null and undefined alone", () => {
    expect(withoutSupersededGmFigure(undefined)).toBeUndefined();
    expect(withoutSupersededGmFigure(null)).toBeNull();
    expect(withoutSupersededGmFigure("supersededGmFigure")).toBe("supersededGmFigure");
    expect(withoutSupersededGmFigure(-1)).toBe(-1);
  });

  it("removes only its own field and nothing adjacent to it", () => {
    const entry = {
      canonicalLifecycle: { kind: "numeric" },
      notes: "kept",
      supersededGmFigure: { value: -1 },
      supersededGmFigureNote: "a different key, kept",
      value: -2,
    };
    expect(withoutSupersededGmFigure(entry)).toEqual({
      canonicalLifecycle: { kind: "numeric" },
      notes: "kept",
      supersededGmFigureNote: "a different key, kept",
      value: -2,
    });
  });
});
