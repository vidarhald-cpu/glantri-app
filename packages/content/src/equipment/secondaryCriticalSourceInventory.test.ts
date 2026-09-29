import { describe, expect, it } from "vitest";

import { weaponTemplates } from "./weaponTemplates";

/**
 * Source-inventory guards for the Secondary Critical `Sec` field (Forgejo #411 regression examples
 * R11, R14 and R15). They assert what the enriched runtime catalogue actually carries, so the
 * runtime's fail-closed behaviour cannot be mistaken for a data accident.
 *
 * Authority: `docs/rules/secondary-critical-sec-grammar.md` §1 (the twelve populated `Weapon1!Q`
 * rows), §4.5 (`Sec` is sparse and hand-authored), §4.7 (no missile `Second crit.` column) and
 * §4.8 (no unarmed or shield row authors one).
 */

/** `docs/rules/secondary-critical-sec-grammar.md` §1, `Weapon1!Q` populated rows. */
const AUTHORED_SEC_BY_WEAPON = {
  "1-h Spear": "AS",
  "2-h Javelin": "AS",
  "2-h Spear": "BS",
  "Battle Axe": "DC",
  "Great sword": "DC",
  Halberd: "DC",
  "Hand axe": "CC",
  Hatchet: "AC",
  Lance: "DC",
  "Morning star": "AP",
  "Pole axe": "DC",
  "Wood axe": "AC",
} as const;

function modesOf(weaponName: string) {
  const template = weaponTemplates.find((candidate) => candidate.name === weaponName);

  if (!template) throw new Error(`Missing weapon template ${weaponName}.`);

  return template.attackModes ?? [];
}

describe("Sec source inventory", () => {
  it("attaches every authored Sec code to the main attack mode only (R14)", () => {
    for (const [weaponName, code] of Object.entries(AUTHORED_SEC_BY_WEAPON)) {
      const modes = modesOf(weaponName);
      const mainMode = modes.find((mode) => mode.id === "mode-1");

      expect(mainMode?.secondCrit).toBe(code);
      for (const mode of modes.filter((candidate) => candidate.id !== "mode-1")) {
        expect(mode.secondCrit ?? null).toBeNull();
      }
    }
  });

  it("gives no Sec code to a thrown attack mode (R15)", () => {
    const thrownModes = weaponTemplates.flatMap((template) =>
      (template.attackModes ?? []).filter((mode) => mode.label === "Throw"),
    );

    expect(thrownModes.length).toBeGreaterThan(0);
    for (const mode of thrownModes) {
      expect(mode.secondCrit ?? null).toBeNull();
    }
  });

  it("treats a blank Sec as an authored absence even at Crit 1 grade F (R11)", () => {
    for (const weaponName of ["Heavy mace", "Maul", "1-h Javelin"]) {
      const mainMode = modesOf(weaponName).find((mode) => mode.id === "mode-1");

      expect(mainMode?.crit?.charAt(0)).toBe("F");
      expect(mainMode?.secondCrit ?? null).toBeNull();
    }
  });

  it("authors no Sec code anywhere outside the twelve melee rows", () => {
    const authored = new Set<string>();

    for (const template of weaponTemplates) {
      for (const mode of template.attackModes ?? []) {
        if (mode.secondCrit) authored.add(template.name);
      }
    }

    expect([...authored].sort()).toStrictEqual(Object.keys(AUTHORED_SEC_BY_WEAPON).sort());
  });
});
