import { characterBuildSchema } from "@glantri/domain";
import { defaultCanonicalContent } from "@glantri/content";
import { describe, expect, it } from "vitest";

import { buildEquipmentLoadoutModuleModel } from "@/features/equipment/loadoutModule";
import {
  EMPTY_SCENARIO_COMBAT_EQUIPMENT_STATE,
  buildPlayerCombatLoadoutSummary,
} from "@/features/player-combat/playerCombatPhaseModel";

// The snapshot the local development bootstrap actually authors, imported from the seed itself so
// this test cannot drift from it. The relative path is deliberate: `@glantri/database` exports only
// its package root, which loads Prisma, and this module is pure data with no imports at all.
import { TRAINING_BANDIT_DEMO_SNAPSHOT } from "../../../../../packages/database/scripts/trainingBanditDemoSnapshot";

/**
 * #672 — the seeded *"Training Bandit"* Template must stay able to fight.
 *
 * CI never runs the local development seed (`.forgejo/workflows/ci.yml` invokes no `db:seed`), so
 * no end-to-end test over the seeded database row can protect this. This unit test binds the
 * authored snapshot directly instead.
 *
 * **The mutation this guards against:** reverting the snapshot to the health-only shape it carried
 * before #672 (`{ health: { currentHp: 12, maxHp: 12 } }`, or any other snapshot lacking a
 * `profile` and a `progression`). `characterBuildSchema` then fails on `id`, `name`, `profile` and
 * `progression`; `buildEquipmentLoadoutModuleModel` early-returns an empty model because
 * `characterContext` is null; `combatStatePanelModel` is null, so there are no brawling rows; and
 * `buildPlayerCombatAttackSourceOptions` offers nothing. Every assertion below fails.
 */
const PUNCH_SOURCE_ID = "unarmed:virtual-weapon-template-punch";
const KICK_SOURCE_ID = "unarmed:virtual-weapon-template-kick";

function buildSeededBanditLoadoutSummary() {
  const parsed = characterBuildSchema.parse(TRAINING_BANDIT_DEMO_SNAPSHOT.build);
  const loadoutModel = buildEquipmentLoadoutModuleModel({
    characterContext: { content: defaultCanonicalContent, record: { build: parsed } },
    characterId: parsed.id,
    // No equipment of any kind: the seeded Template carries none, and the attack must resolve
    // through the intrinsic brawling sources rather than through a weapon.
    state: EMPTY_SCENARIO_COMBAT_EQUIPMENT_STATE,
    throwingWeaponItemId: null,
  });
  return { loadoutModel, parsed };
}

describe("the seeded Training Bandit Template can fight (#672)", () => {
  it("authors a snapshot whose build the domain schema accepts", () => {
    const result = characterBuildSchema.safeParse(TRAINING_BANDIT_DEMO_SNAPSHOT.build);
    expect(result.success).toBe(true);
  });

  it("carries the authored demo statistics", () => {
    const { parsed } = buildSeededBanditLoadoutSummary();

    // All eleven characteristics, since the schema requires every one of them.
    expect(parsed.profile.rolledStats).toEqual({
      cha: 10,
      com: 10,
      con: 10,
      dex: 10,
      health: 10,
      int: 10,
      lck: 10,
      pow: 10,
      siz: 10,
      str: 10,
      will: 10,
    });
    expect(parsed.profile.distractionLevel).toBe(4);

    const brawling = parsed.progression.skills.find((skill) => skill.skillId === "brawling");
    expect(brawling).toBeDefined();
    expect(brawling?.ranks).toBe(9);
    expect(brawling?.grantedRanks).toBe(9);
    expect(brawling?.level).toBe(9);
  });

  it("names a canonical skill and profession rather than an invented one", () => {
    const { parsed } = buildSeededBanditLoadoutSummary();
    const brawling = parsed.progression.skills.find((skill) => skill.skillId === "brawling");

    expect(defaultCanonicalContent.skills.some((skill) => skill.id === brawling?.skillId)).toBe(
      true,
    );
    expect(
      defaultCanonicalContent.professions.some(
        (profession) => profession.id === parsed.professionId,
      ),
    ).toBe(true);
  });

  it("offers exactly the two intrinsic unarmed attack sources, with no equipment", () => {
    const { loadoutModel } = buildSeededBanditLoadoutSummary();

    // The model must be present at all: a snapshot without a parseable build empties it, which is
    // precisely the #672 defect.
    expect(loadoutModel.combatStatePanelModel).not.toBeNull();

    const summary = buildPlayerCombatLoadoutSummary({
      actionId: "attack_parry",
      allowUnarmedFallback: true,
      loadoutModel,
      phaseKey: "phase1",
      secondaryActionId: "",
    });

    expect(summary.attackSourceOptions.map((option) => option.id)).toEqual([
      PUNCH_SOURCE_ID,
      KICK_SOURCE_ID,
    ]);
    expect(summary.attackSourceOptions.map((option) => option.label)).toEqual([
      "Punch · Unarmed",
      "Kick · Unarmed",
    ]);
    // Intrinsic sources, not items: nothing here depends on an Item instance or a weapon slot.
    expect(summary.attackSourceOptions.every((option) => option.sourceKind === "unarmed")).toBe(
      true,
    );
  });

  it("resolves a usable offensive bonus through Brawling rather than a token one", () => {
    const { loadoutModel } = buildSeededBanditLoadoutSummary();
    const rows = loadoutModel.combatStatePanelModel?.weaponRows ?? [];
    const punch = rows.find((row) => row.templateId === "virtual-weapon-template-punch");
    const kick = rows.find((row) => row.templateId === "virtual-weapon-template-kick");

    // The authored Brawling rank is what makes this opponent able to fight. With no ranks these
    // rows derive OB 1 and 0; the assertion is deliberately on the competency contributing a
    // materially larger bonus, so dropping the rank count fails here too.
    expect(Number(punch?.ob1)).toBeGreaterThan(1);
    expect(Number(kick?.ob1)).toBeGreaterThan(0);
  });
});
