/**
 * #512 P1.3 — competency resolution for combat values.
 *
 * Measurement layer: every template below is the LIVE `equipmentTemplates` export of
 * `@glantri/content` (competencyRef authored by P1.2 on top of the imported JSON, which carries no
 * refs and no attackType), plus the virtual Punch and Kick templates. The skill catalogue is
 * `defaultCanonicalContent`.
 */
import { describe, expect, it } from "vitest";

import {
  defaultCanonicalContent,
  equipmentTemplates,
  kickTemplate,
  punchTemplate,
} from "@glantri/content";
import { characterBuildSchema, type WeaponTemplate } from "@glantri/domain";

import { buildCharacterSheetSummary } from "../sheets/buildCharacterSheetSummary";
import { defaultCombatAllocationState } from "./combatAllocationState";
import { buildCombatStateCharacterInputs } from "./characterInputs";
import {
  COMBAT_COMPETENCY_REFUSED,
  getDerivedDmbValue,
  getDerivedInitiativeValue,
  getDerivedObValue,
  isCombatCompetencyRefusal,
} from "./deriveCombatValues";
import baseline from "./competencyResolutionCharacterization.baseline.json";

const weaponTemplates = [...equipmentTemplates, punchTemplate, kickTemplate].filter(
  (template): template is WeaponTemplate => template.category === "weapon",
);
const byName = (name: string) => {
  const found = weaponTemplates.find((template) => template.name === name);
  if (!found) throw new Error(`Missing fixture weapon ${name}`);
  return found;
};

const FIREARMS = [
  "Arquebus",
  "Cartridge Pistol",
  "Cartridge Rifle",
  "Hand Cannon",
  "Musket",
  "Pistol",
];

/** Distinct ranks per competency id, so a wrong competency yields a visibly different number. */
const ranksById: Record<string, number> = {
  one_handed_concussion_axe: 3,
  one_handed_edged: 5,
  two_handed_concussion_axe: 7,
  two_handed_edged: 11,
  bow: 13,
  crossbow: 17,
  fencing: 19,
  lance: 23,
  longbow: 29,
  polearms: 31,
  sling: 37,
  throwing: 41,
  brawling: 43,
  dodge: 2,
  parry: 4,
};

function buildSheet(ranks: Record<string, number> = ranksById) {
  const build = characterBuildSchema.parse({
    equipment: { items: [] },
    id: "c",
    name: "C",
    profile: {
      distractionLevel: 3,
      id: "p",
      label: "C",
      rolledStats: {
        cha: 10,
        com: 10,
        con: 10,
        dex: 18,
        health: 10,
        int: 10,
        lck: 10,
        pow: 10,
        siz: 10,
        str: 20,
        will: 10,
      },
      societyLevel: 0,
    },
    progression: {
      chargenMode: "standard",
      educationPoints: 0,
      flexiblePointFactor: 1,
      level: 1,
      primaryPoolSpent: 0,
      primaryPoolTotal: 60,
      secondaryPoolSpent: 400,
      secondaryPoolTotal: 600,
      skillGroups: [],
      skills: Object.entries(ranks).map(([skillId, secondaryRanks]) => ({
        category: "secondary",
        categoryId: "combat",
        groupId: "basic_melee_training",
        secondaryRanks,
        skillId,
      })),
      specializations: [],
    },
    progressionState: { availablePoints: 0, checks: [], history: [], pendingAttempts: [] },
    statModifiers: {},
  });
  return buildCharacterSheetSummary({ build, content: defaultCanonicalContent });
}

const sheet = buildSheet();
const characterInputs = buildCombatStateCharacterInputs(sheet);

const ob = (template: WeaponTemplate, modeId: string, inputs = characterInputs) =>
  getDerivedObValue({
    allocationInputs: defaultCombatAllocationState,
    armorTemplate: null,
    characterInputs: inputs,
    mode: template.attackModes!.find((mode) => mode.id === modeId)!,
    template,
  });
const dmb = (template: WeaponTemplate, modeId: string) =>
  getDerivedDmbValue({
    armorTemplate: null,
    characterInputs,
    mode: template.attackModes!.find((mode) => mode.id === modeId)!,
    template,
  });
const initiative = (template: WeaponTemplate, modeId: string) =>
  getDerivedInitiativeValue({
    attackMode: template.attackModes!.find((mode) => mode.id === modeId)!,
    characterInputs,
    template,
  });

describe("the id bridge: combatSkillXpByCompetencyId", () => {
  it("is keyed by SkillDefinition.id and agrees with the name-keyed map for every weapon competency", () => {
    for (const [id, xp] of Object.entries(characterInputs.combatSkillXpByCompetencyId)) {
      const definition = defaultCanonicalContent.skills.find((skill) => skill.id === id);
      expect(definition, `${id} is not a catalogue skill id`).toBeDefined();
      expect(characterInputs.combatSkillXpByName[definition!.name]).toBe(xp);
    }
    for (const id of Object.keys(ranksById)) {
      expect(characterInputs.combatSkillXpByCompetencyId[id], `${id} missing`).toEqual(
        expect.any(Number),
      );
    }
  });

  it("does not contain display names (a name must never resolve a competency)", () => {
    expect(characterInputs.combatSkillXpByCompetencyId["1-h edged"]).toBeUndefined();
    expect(characterInputs.combatSkillXpByCompetencyId["Throwing"]).toBeUndefined();
    expect(characterInputs.combatSkillXpByCompetencyId["one_handed_edged"]).toBe(
      characterInputs.combatSkillXpByName["1-h edged"],
    );
  });

  it("every competencyRef authored on a live mode is a catalogue skill id the sheet can hold", () => {
    const refs = new Set(
      weaponTemplates.flatMap((template) =>
        (template.attackModes ?? []).flatMap((mode) =>
          mode.competencyRef ? [mode.competencyRef] : [],
        ),
      ),
    );
    expect(refs.size).toBeGreaterThanOrEqual(13);
    for (const ref of refs) {
      expect(characterInputs.combatSkillXpByCompetencyId[ref], `${ref} unresolved`).toEqual(
        expect.any(Number),
      );
    }
  });
});

describe("explicit refusal of a mode with no competency reference", () => {
  it("fixture: the six Firearms modes (and only they, among shipped weapons) carry no competencyRef", () => {
    const unreferenced = weaponTemplates
      .filter((template) => (template.attackModes ?? []).some((mode) => !mode.competencyRef))
      .map((template) => template.name)
      .sort();
    expect(unreferenced).toEqual(FIREARMS);
  });

  it.each(FIREARMS)(
    "%s: OB, DMB and initiative are refused, not zero, not a name fallback",
    (name) => {
      const template = byName(name);
      const mode = template.attackModes![0]!;
      expect(mode.competencyRef ?? null).toBeNull();
      // A character who HOLDS the skill the template names must still be refused.
      const holder = buildCombatStateCharacterInputs(buildSheet({ ...ranksById }));
      expect(holder.combatSkillXpByName[template.weaponSkill] ?? null).toBeNull();
      const withName = {
        ...holder,
        combatSkillXpByName: { ...holder.combatSkillXpByName, [template.weaponSkill]: 40 },
      };
      for (const inputs of [characterInputs, withName]) {
        expect(ob(template, mode.id, inputs)).toBe(COMBAT_COMPETENCY_REFUSED);
        expect(
          getDerivedDmbValue({ armorTemplate: null, characterInputs: inputs, mode, template }),
        ).toBe(COMBAT_COMPETENCY_REFUSED);
        expect(
          getDerivedInitiativeValue({ attackMode: mode, characterInputs: inputs, template }),
        ).toBe(COMBAT_COMPETENCY_REFUSED);
        // The template-level call (no mode named) resolves through the first mode and is refused too.
        expect(getDerivedInitiativeValue({ characterInputs: inputs, template })).toBe(
          COMBAT_COMPETENCY_REFUSED,
        );
      }
      expect(isCombatCompetencyRefusal(COMBAT_COMPETENCY_REFUSED)).toBe(true);
      expect(isCombatCompetencyRefusal(0)).toBe(false);
      expect(isCombatCompetencyRefusal("—")).toBe(false);
    },
  );

  it("refuses with no character at all, rather than answering from the template", () => {
    const musket = byName("Musket");
    expect(
      getDerivedObValue({
        allocationInputs: defaultCombatAllocationState,
        armorTemplate: null,
        mode: musket.attackModes![0]!,
        template: musket,
      }),
    ).toBe(COMBAT_COMPETENCY_REFUSED);
  });
});

describe("thrown use comes from the mode's authored attackType, never from a slot", () => {
  const bow = byName("Short bow");
  const dagger = byName("Dagger");

  it("a bow resolves with Bow (id bow) however a caller might label its slot", () => {
    const expected = ob(bow, "mode-1");
    expect(typeof expected).toBe("number");
    const lowThrowing = buildCombatStateCharacterInputs(buildSheet({ ...ranksById, throwing: 2 }));
    const highBow = buildCombatStateCharacterInputs(buildSheet({ ...ranksById, bow: 30 }));
    // The legacy slot flag is gone from the API; passing it must change nothing.
    const withLegacyFlag = getDerivedObValue({
      allocationInputs: defaultCombatAllocationState,
      armorTemplate: null,
      characterInputs,
      mode: bow.attackModes![0]!,
      template: bow,
      treatAsThrownUse: true,
    } as never);
    expect(withLegacyFlag).toBe(expected);
    expect(ob(bow, "mode-1", lowThrowing)).toBe(expected);
    expect(ob(bow, "mode-1", highBow)).not.toBe(expected);
  });

  it("per-mode competency varies on one weapon: Dagger mode-1 melee vs mode-3 thrown", () => {
    const [m1, m2, m3] = ["mode-1", "mode-2", "mode-3"].map(
      (id) => dagger.attackModes!.find((mode) => mode.id === id)!,
    );
    expect([m1.competencyRef, m2.competencyRef, m3.competencyRef]).toEqual([
      "one_handed_edged",
      "one_handed_edged",
      "throwing",
    ]);
    expect([m1.attackType, m3.attackType]).toEqual(["melee", "thrown"]);

    const moreThrowing = buildCombatStateCharacterInputs(
      buildSheet({ ...ranksById, throwing: 90 }),
    );
    const moreEdged = buildCombatStateCharacterInputs(
      buildSheet({ ...ranksById, one_handed_edged: 60 }),
    );
    // mode-3 follows Throwing and ignores 1-h edged; mode-1 does the opposite.
    expect(ob(dagger, "mode-3", moreThrowing)).not.toBe(ob(dagger, "mode-3"));
    expect(ob(dagger, "mode-3", moreEdged)).toBe(ob(dagger, "mode-3"));
    expect(ob(dagger, "mode-1", moreEdged)).not.toBe(ob(dagger, "mode-1"));
    expect(ob(dagger, "mode-1", moreThrowing)).toBe(ob(dagger, "mode-1"));
  });

  it("a thrown mode takes the thrown path for DMB (Str GM + dmb) and initiative", () => {
    const mode = dagger.attackModes!.find((candidate) => candidate.id === "mode-3")!;
    expect(dmb(dagger, "mode-3")).toBe(characterInputs.strengthGm! + mode.dmb!);
    expect(initiative(dagger, "mode-3")).toBe(
      (mode.initiative ?? dagger.initiative ?? 0) + characterInputs.dexterityGm!,
    );
  });
});

describe("intrinsic unarmed sources resolve through Brawling (#590)", () => {
  // #590 made Punch and Kick declarable without equipment. The ruling requires that resolution use
  // the existing Brawling competency, so pin it by moving ranks: only Brawling may move the number.
  it.each([punchTemplate, kickTemplate])("$name follows Brawling and nothing else", (template) => {
    const mode = template.attackModes![0]!;
    expect(mode.competencyRef).toBe("brawling");
    expect(mode.canonicalMeleeMode).toBe("strike");

    const baselineOb = ob(template, mode.id);
    expect(typeof baselineOb).toBe("number");

    const moreBrawling = buildCombatStateCharacterInputs(
      buildSheet({ ...ranksById, brawling: 91 }),
    );
    expect(ob(template, mode.id, moreBrawling)).not.toBe(baselineOb);

    // Every other weapon competency on the sheet, including the ones a slot-based or name-based
    // resolution might reach for, leaves the unarmed number exactly where it was.
    for (const competencyId of Object.keys(ranksById).filter((id) => id !== "brawling")) {
      const moved = buildCombatStateCharacterInputs(
        buildSheet({ ...ranksById, [competencyId]: 97 }),
      );
      expect(ob(template, mode.id, moved), `${competencyId} moved the unarmed OB`).toBe(baselineOb);
    }
  });
});

describe("no behaviour change for weapons that already resolved correctly (characterization)", () => {
  // Captured from the unmodified baseline 10a846b5 on this fixed character: every non-thrown mode
  // with a non-throwing slot and every thrown mode with the throwing slot, Firearms excluded.
  const expected = baseline as unknown as Record<
    string,
    number | string | { dmb: number | string; initiative: number | string; ob: number | string }
  >;

  it("reproduces every baseline OB, DMB and initiative exactly", () => {
    const keys = Object.keys(expected);
    expect(keys.length).toBeGreaterThanOrEqual(120);
    const byId = new Map(weaponTemplates.map((template) => [template.id, template]));
    for (const key of keys) {
      const [templateId, rest] = key.split("|");
      const template = byId.get(templateId!)!;
      expect(template, key).toBeDefined();
      const want = expected[key]!;
      if (rest === "template-initiative") {
        expect(getDerivedInitiativeValue({ characterInputs, template }), key).toBe(want);
        continue;
      }
      const wanted = want as {
        dmb: number | string;
        initiative: number | string;
        ob: number | string;
      };
      expect(ob(template, rest!), `${key} ob`).toBe(wanted.ob);
      expect(dmb(template, rest!), `${key} dmb`).toBe(wanted.dmb);
      expect(initiative(template, rest!), `${key} initiative`).toBe(wanted.initiative);
    }
  });
});
