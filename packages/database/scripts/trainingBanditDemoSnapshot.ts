// Demo seed content for Forgejo #672 and #690. See the doc comment below: these numbers
// characterize the seeded Training Bandit only and are not a rule, canonical content, or precedent.
/**
 * The seeded *"Training Bandit"* Template's combat statistics (Forgejo #672, #690).
 *
 * ## These numbers are demo content for this seed. They are not a rule.
 *
 * The Product Owner authored the values below **specifically to characterize this one seeded
 * sparring opponent**, under the control-plane rulings of 2026-10-17 on Forgejo #672 and
 * 2026-10-18 on Forgejo #690. They are **not** a general NPC rule, **not** canonical content, and
 * **must not be cited as precedent** for any other NPC, Template or generator — in particular not
 * for the humanoid NPC generator path, which the #672 ruling explicitly deferred (#674).
 *
 * Verbatim from the Product Owner, on the two competency ranks here:
 *
 * > Brawling = 9 and Dodge = 9 are literal authored values for the single seeded Training Bandit
 * > only. They establish no default, equality relationship, XP rule, generation rule, Template
 * > rule, generic NPC rule, or relationship to weapon competency. Do not reuse or derive these
 * > values anywhere else.
 *
 * ## The two nines are not a relationship
 *
 * That the Dodge rank reads the same as the Brawling rank is **coincidence of authorship**.
 * Neither is derived from the other, neither constrains the other, and the match carries no
 * meaning whatsoever. Do not introduce a shared constant, a helper, a comment or a test that ties
 * them together, and do not treat either as a default or fallback for anything — there is no
 * "if unset then 9" anywhere, and none may be added. Either value may change on its own without
 * the other following.
 *
 * Accepted content supplies **no** characteristic values and **no** competency ranks for any NPC:
 * `canonicalContent.json` carries professions, skills, groups and societies, but no statistics,
 * and `glantriCharacteristicBlockSchema` requires all eleven characteristics with no defaults. So
 * these values could not be derived and had to be authored:
 *
 * | Field | Value | Why it is here |
 * | --- | --- | --- |
 * | every characteristic | `10` | authored for the demo seed |
 * | `profile.distractionLevel` | `4` | authored for the demo seed |
 * | Brawling competency | `9` | authored; it is what makes the opponent able to attack |
 * | Dodge competency | `9` | authored; it is what makes the opponent able to be attacked |
 * | health | derived | see below |
 *
 * Everything *else* here is the established envelope, not a new choice: it mirrors
 * `buildGeneratedNpcCharacterBuild` in `apps/web/src/lib/campaigns/campaignActors.ts`, which is
 * the shipped path that already projects an NPC onto a `CharacterBuild`. Both skill identities —
 * `brawling` and `dodge`, their `secondary` category, their `combat` category id and their group
 * ids — and the `bandit` profession are canonical
 * (`packages/content/src/data/canonicalContent.json`).
 *
 * ## Why Dodge is here at all (#690)
 *
 * Attack resolution needs a defence bonus for the defender, and `resolveCombatDefenseCalculation`
 * derives one only when `dodgeCombatSkillXp` is present — which `buildCombatStateCharacterInputs`
 * reads from the build's own Dodge competency. With Brawling alone the seeded opponent could
 * declare an action but no attack against it could ever resolve, which is the #690 blocker. The
 * authored rank below closes that, and nothing else about the snapshot changes.
 *
 * ## Why a `build` at all, and why this is not pseudo-Character state
 *
 * `snapshot.build` is a **first-class Template slot in the domain layer**:
 * `createParticipantSnapshotFromEntity` reads it through `readEntitySnapshotBuild`
 * (`packages/domain/src/campaign/scenario.ts`), whose first branch is exactly "use
 * `snapshot.build` when it carries a `profile` and a `progression`". Without one, that helper
 * falls through to its last branch and copies the whole snapshot verbatim into the `build` slot,
 * where `characterBuildSchema` rejects it on `id`/`name`/`profile`/`progression` — and the chain
 * then yields no attack sources at all, which is the #672 defect. No Character record is created
 * or implied here.
 *
 * ## Health is derived, deliberately
 *
 * The previous snapshot set `health.maxHp: 12`, and that value **never took effect**: nothing
 * reads `snapshot.health`, and `createParticipantSnapshotFromEntity` computes
 * `maxHp = input.maxHp ?? (characterBuild ? calculateCharacterGeneralHitpoints(characterBuild) : 10)`,
 * so temporary actors were silently created with `10`. The ruling settles this by letting hit
 * points derive from the build rather than restating an inert number.
 */
export const TRAINING_BANDIT_DEMO_SNAPSHOT = {
  build: {
    equipment: { items: [] },
    id: "seed-training-bandit",
    name: "Training Bandit",
    professionId: "bandit",
    profile: {
      description: "Seeded sparring opponent for local development.",
      // Authored demo value (#672). Not a rule, and not a canonical characteristic set.
      distractionLevel: 4,
      id: "seed-training-bandit:profile",
      label: "Training Bandit",
      // Authored demo values (#672): every characteristic is 10. Not a canonical NPC baseline.
      rolledStats: {
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
      secondaryPoolSpent: 0,
      secondaryPoolTotal: 0,
      skillGroups: [],
      skills: [
        {
          // Skill identity is canonical; only the rank count is authored demo content (#672).
          category: "secondary",
          categoryId: "combat",
          grantedRanks: 9,
          groupId: "combat_group",
          groupIds: ["combat_group", "basic_melee_training", "advanced_melee_training"],
          level: 9,
          primaryRanks: 0,
          ranks: 9,
          secondaryRanks: 0,
          skillId: "brawling",
        },
        {
          // Skill identity is canonical; only the rank count is authored demo content (#690).
          // This rank stands on its own. It is not derived from, tied to, or constrained by the
          // Brawling rank above — the matching numbers are coincidence of authorship, not a rule —
          // and it is not a default for any other actor, Template, generator or fixture.
          category: "secondary",
          categoryId: "combat",
          grantedRanks: 9,
          groupId: "basic_melee_training",
          groupIds: [
            "basic_melee_training",
            "advanced_melee_training",
            "mounted_warrior_training",
            "combat_group",
          ],
          level: 9,
          primaryRanks: 0,
          ranks: 9,
          secondaryRanks: 0,
          skillId: "dodge",
        },
      ],
      specializations: [],
    },
    progressionState: {
      availablePoints: 0,
      checks: [],
      history: [],
      pendingAttempts: [],
    },
    societyLevel: 0,
  },
} as const;
