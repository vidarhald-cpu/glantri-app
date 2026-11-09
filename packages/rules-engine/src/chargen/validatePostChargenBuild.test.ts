import { describe, expect, it } from "vitest";
import { getApprovedV2RuntimeContent } from "@glantri/content";
import type { CharacterBuild } from "@glantri/domain";

import {
  approveCharacterProgressionCheck,
  buyCharacterProgressionAttempt,
  grantCharacterProgressionPoints,
  requestCharacterProgressionCheck,
  resolveCharacterProgressionAttempts,
} from "../advancement/advanceCharacter";
import { buildCharacterSheetSummary } from "../sheets/buildCharacterSheetSummary";
import { applyRelationshipMinimumGrants } from "../skills/deriveSkillRelationships";
import {
  allocateChargenPoint,
  createChargenProgression,
  finalizeChargenDraft,
} from "./primaryAllocation";
import {
  OWNER_DIRECT_VALUE_CHANGE_MESSAGE,
  validatePostChargenBuild,
} from "./validatePostChargenBuild";
import { validateTargetChargenBuild } from "./validateTargetChargenBuild";

/*
 * Forgejo #1068 (WO-1068-S1). A target Character after Chargen keeps the basic rules and the
 * frozen Chargen totals, and only a GM or admin may type values (Product Owner rulings, #1068
 * comments 24480 and 24529). The fixture is the V2 Soldier on the issued-missile route that
 * `characters.targetChargen.integration.test.ts` finalizes, so it is a build today's Chargen
 * accepts.
 */

const content = getApprovedV2RuntimeContent();

const PROFILE = {
  distractionLevel: 2,
  id: "issue1068-synthetic",
  label: "Synthetic",
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
} as unknown as CharacterBuild["profile"];

function chargenBuild(): CharacterBuild {
  const progression = {
    ...createChargenProgression(),
    chargenSelections: {
      selectedCoreRouteId: "profession:soldier:core:missile",
      selectedGroupSlots: [{ groupId: "M04", selectedSkillIds: ["bow"], slotId: "missile-family" }],
      selectedLanguageIds: [],
      selectedSkillIds: [],
    },
  } as ReturnType<typeof createChargenProgression>;
  const context = {
    content,
    professionId: "profession:soldier",
    profile: PROFILE,
    societyId: "pastoral_clan_nomadic",
    societyLevel: 1,
  };
  const purchase = allocateChargenPoint({
    ...context,
    progression,
    targetId: "M04",
    targetType: "group",
  });
  expect(purchase.error).toBeUndefined();
  const result = finalizeChargenDraft({
    ...context,
    name: "Synthetic #1068 archer",
    progression: purchase.progression,
  });
  expect(result.errors).toEqual([]);
  return result.build!;
}

function post(build: CharacterBuild, storedBuild: CharacterBuild, directValueEdit = true) {
  return validatePostChargenBuild({ build, content, directValueEdit, storedBuild });
}

function skillValue(build: CharacterBuild, skillId: string): number {
  return (
    buildCharacterSheetSummary({ build, content }).draftView.skills.find(
      (skill) => skill.skillId === skillId,
    )?.effectiveSkillNumber ?? 0
  );
}

/** Raise a skill the way Edit Character now does: above the Chargen purchase, in grantedRanks. */
function withGmRaise(build: CharacterBuild, skillId: string, by: number): CharacterBuild {
  const next = structuredClone(build);
  const row = next.progression.skills.find((skill) => skill.skillId === skillId)!;
  row.grantedRanks += by;
  row.ranks += by;
  // Edit Character recomputes the derived grants a raise feeds, as every setter does.
  next.progression = applyRelationshipMinimumGrants({ content, progression: next.progression });
  return next;
}

describe("validatePostChargenBuild (#1068)", () => {
  it("accepts the finalized Chargen build unchanged, as Chargen does", () => {
    const build = chargenBuild();
    expect(validateTargetChargenBuild(build, content)).toEqual([]);
    expect(post(build, build)).toEqual([]);
    expect(post(build, build, false)).toEqual([]);
  });

  it("lets a GM raise a skill past Chargen limits without re-pricing it (ruling 1)", () => {
    const stored = chargenBuild();
    const raised = withGmRaise(stored, "bow", 7);
    expect(validateTargetChargenBuild(raised, content)).toContain(
      "Invalid unpurchased competency ranks: bow.",
    );
    expect(post(raised, stored)).toEqual([]);
    expect(skillValue(raised, "bow")).toBe(skillValue(stored, "bow") + 7);
  });

  it("lets a GM add a skill and remove a Chargen Learning Group (rulings 1 and 7)", () => {
    const stored = chargenBuild();
    const next = structuredClone(stored);
    const deception = content.skills.find((skill) => skill.id === "skill:deception")!;
    next.progression.skills.push({
      category: deception.category,
      grantedRanks: 3,
      level: 0,
      primaryRanks: 0,
      ranks: 3,
      relationshipGrantedRanks: 0,
      secondaryRanks: 0,
      skillId: deception.id,
      targetDefinition: deception,
    } as CharacterBuild["progression"]["skills"][number]);
    expect(post(next, stored)).toEqual([]);
    const withoutGroup = structuredClone(stored);
    withoutGroup.progression.skillGroups = [];
    // The derived grants the Group fed are recomputed, so the rows that held them are refreshed too.
    for (const skill of withoutGroup.progression.skills) {
      skill.relationshipGrantedRanks = 0;
      delete skill.relationshipGrantSourceName;
      delete skill.relationshipGrantSourceSkillId;
      delete skill.relationshipGrantSourceType;
      skill.ranks = skill.grantedRanks + skill.primaryRanks + skill.secondaryRanks;
    }
    withoutGroup.progression.skills = withoutGroup.progression.skills.filter((s) => s.ranks > 0);
    expect(post(withoutGroup, stored)).toEqual([]);
  });

  it("freezes the Chargen totals (ruling 2)", () => {
    const stored = chargenBuild();
    const next = withGmRaise(stored, "bow", 1);
    next.progression.secondaryPoolSpent += 1;
    expect(post(next, stored)).toContain(
      "The Chargen skill-point totals cannot change after Chargen.",
    );
  });

  it("locks Original and keeps stats within 1–25 (rulings 1 and 3)", () => {
    const stored = chargenBuild();
    const original = structuredClone(stored);
    original.profile.rolledStats.str = 14;
    expect(post(original, stored)).toContain("Original stats are locked after Chargen.");
    const developed = structuredClone(stored);
    developed.developedStatModifiers = { str: 3 };
    expect(post(developed, stored)).toEqual([]);
    developed.developedStatModifiers = { str: 16 };
    expect(post(developed, stored)).toContain("Stat str must be a whole number from 1 to 25.");
    const current = structuredClone(stored);
    current.currentStatModifiers = { dex: -10 };
    expect(post(current, stored)).toContain("Stat dex must be a whole number from 1 to 25.");
  });

  it("still refuses ids outside the target catalogue, duplicates and broken totals", () => {
    const stored = chargenBuild();
    const legacy = structuredClone(stored);
    legacy.progression.skills.push({
      category: "ordinary",
      grantedRanks: 1,
      groupId: "literate_foundation",
      level: 0,
      primaryRanks: 0,
      ranks: 1,
      secondaryRanks: 0,
      skillId: "literacy",
    } as CharacterBuild["progression"]["skills"][number]);
    expect(post(legacy, stored)).toContain("Unknown target competency literacy.");
    const forgedProfession = structuredClone(stored);
    forgedProfession.professionId = "profession:soldier:forged";
    expect(post(forgedProfession, stored)).toContain("Unknown target Profession or track.");
    const duplicate = structuredClone(stored);
    duplicate.progression.skills.push(structuredClone(duplicate.progression.skills[0]!));
    expect(post(duplicate, stored)).toContain("Duplicate target purchase identity.");
    const inconsistent = structuredClone(stored);
    inconsistent.progression.skills[0]!.ranks += 5;
    expect(post(inconsistent, stored)).toContain(
      `Inconsistent competency ranks: ${inconsistent.progression.skills[0]!.skillId}.`,
    );
    const unknownGroup = structuredClone(stored);
    unknownGroup.progression.skillGroups[0]!.groupId = "basic_melee_training";
    delete unknownGroup.progression.skillGroups[0]!.targetDefinition;
    expect(post(unknownGroup, stored)).toContain(
      "Unknown target Learning Group basic_melee_training.",
    );
  });

  it("refuses an owner's direct raise of a skill or a stat (ruling 6)", () => {
    const stored = chargenBuild();
    expect(post(withGmRaise(stored, "bow", 1), stored, false)).toEqual([
      OWNER_DIRECT_VALUE_CHANGE_MESSAGE,
    ]);
    const stat = structuredClone(stored);
    stat.developedStatModifiers = { str: 1 };
    expect(post(stat, stored, false)).toEqual([OWNER_DIRECT_VALUE_CHANGE_MESSAGE]);
    const renamed = structuredClone(stored);
    renamed.name = "Renamed by the owner";
    expect(post(renamed, stored, false)).toEqual([]);
  });

  describe("an owner's resolved Progression", () => {
    /** The GM granted points and approved a Bow check; that is the stored record. */
    function gmApproved(raisedBy = 0): CharacterBuild {
      const chargen = raisedBy ? withGmRaise(chargenBuild(), "bow", raisedBy) : chargenBuild();
      const requested = requestCharacterProgressionCheck({
        build: grantCharacterProgressionPoints({ amount: 10, build: chargen }),
        content,
        targetId: "bow",
        targetType: "skill",
      });
      return approveCharacterProgressionCheck({
        build: requested,
        content,
        targetId: "bow",
        targetType: "skill",
      });
    }

    function buyAndResolve(stored: CharacterBuild, roll: number) {
      const bought = buyCharacterProgressionAttempt({
        build: stored,
        content,
        targetId: "bow",
        targetType: "skill",
      });
      expect(bought.error).toBeUndefined();
      return resolveCharacterProgressionAttempts({
        build: bought.build,
        content,
        rng: () => roll,
      }).build;
    }

    it("stores a success outside the Chargen purchase fields and the frozen totals", () => {
      const stored = gmApproved();
      const resolved = buyAndResolve(stored, 0.9);
      const history = resolved.progressionState.history;
      expect(history).toHaveLength(1);
      expect(history[0]).toMatchObject({ success: true, targetId: "bow" });
      expect(post(resolved, stored, false)).toEqual([]);
      expect(skillValue(resolved, "bow")).toBe(skillValue(stored, "bow") + 1);
      const before = stored.progression.skills.find((s) => s.skillId === "bow");
      const after = resolved.progression.skills.find((s) => s.skillId === "bow")!;
      expect(after.primaryRanks).toBe(before?.primaryRanks ?? 0);
      expect(after.secondaryRanks).toBe(before?.secondaryRanks ?? 0);
      expect(after.grantedRanks).toBe((before?.grantedRanks ?? 0) + 1);
      expect(resolved.progression.primaryPoolSpent).toBe(stored.progression.primaryPoolSpent);
      expect(resolved.progression.secondaryPoolSpent).toBe(stored.progression.secondaryPoolSpent);
      const summary = buildCharacterSheetSummary({ build: resolved, content });
      expect(summary.skillPoints.original).toBe(
        buildCharacterSheetSummary({ build: stored, content }).skillPoints.original,
      );
      expect(summary.skillPoints.successfulProgressionGains).toBe(history[0]!.cost);
    });

    it("stores a failure with no value change", () => {
      const stored = gmApproved(5);
      const threshold = skillValue(stored, "bow");
      expect(threshold).toBeGreaterThan(1);
      const resolved = buyAndResolve(stored, 0);
      expect(resolved.progressionState.history[0]).toMatchObject({ success: false });
      expect(post(resolved, stored, false)).toEqual([]);
      expect(skillValue(resolved, "bow")).toBe(threshold);
    });

    it("refuses a forged success, a self-approval and minted points", () => {
      const stored = gmApproved();
      const resolved = buyAndResolve(stored, 0.9);

      const unbacked = chargenBuild();
      expect(post(resolved, unbacked, false)).toEqual([OWNER_DIRECT_VALUE_CHANGE_MESSAGE]);

      const requestedOnly = requestCharacterProgressionCheck({
        build: grantCharacterProgressionPoints({ amount: 10, build: chargenBuild() }),
        content,
        targetId: "bow",
        targetType: "skill",
      });
      const selfApproved = approveCharacterProgressionCheck({
        build: requestedOnly,
        content,
        targetId: "bow",
        targetType: "skill",
      });
      expect(post(selfApproved, requestedOnly, false)).toEqual([OWNER_DIRECT_VALUE_CHANGE_MESSAGE]);
      expect(post(selfApproved, requestedOnly, true)).toEqual([]);

      const minted = grantCharacterProgressionPoints({ amount: 5, build: stored });
      expect(post(minted, stored, false)).toEqual([OWNER_DIRECT_VALUE_CHANGE_MESSAGE]);

      const doubled = structuredClone(resolved);
      const bow = doubled.progression.skills.find((s) => s.skillId === "bow")!;
      bow.grantedRanks += 1;
      bow.ranks += 1;
      expect(post(doubled, stored, false)).toEqual([OWNER_DIRECT_VALUE_CHANGE_MESSAGE]);

      const rewritten = structuredClone(resolved);
      const later = buyAndResolve(gmApproved(), 0);
      rewritten.progressionState.history[0]!.cost = 0;
      expect(post(rewritten, stored, false)).toEqual([OWNER_DIRECT_VALUE_CHANGE_MESSAGE]);
      expect(post(later, resolved, false)).toEqual([OWNER_DIRECT_VALUE_CHANGE_MESSAGE]);
    });
  });
});
