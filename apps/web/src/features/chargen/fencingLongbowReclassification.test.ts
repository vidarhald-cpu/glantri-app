/**
 * Acceptance cases for Forgejo #389 — Fencing and Longbow as base combat Skills, F30/F41 re-derived,
 * M04/M05 pools widened, and the `specializationBridge` mechanism deleted.
 *
 * Controlling record: `docs/decisions/rules/0010-competency-classification-and-group-taught-specializations.md`
 * rulings 1, 2, 4, 5 and "Preserved relationship semantics", plus the 2026-09-27 Product Owner
 * rulings recorded there.
 *
 * Every claim here uses the REAL consumer construction that `useChargenWizardState.tsx` uses —
 * `withCompetencyContentV2(buildTargetRuntimeContent(createTargetCompetencyChargenSource(...)))` —
 * never the legacy 59-group catalogue, which no Chargen path loaded and which was retired with its
 * accessor in Forgejo #387.
 *
 * THE FAILURE MODE THIS FILE EXISTS FOR IS DISAPPEARANCE, NOT DUPLICATION. Deleting the bridge alone
 * would have removed the synthetic Longbow Specialization row while `specializationOfSkillId` still
 * excluded `longbow` from every base-Skill surface, so Longbow would have silently vanished from the
 * application rather than appearing twice.
 */
import { describe, expect, it } from "vitest";
import { defaultCanonicalContent, withCompetencyContentV2 } from "@glantri/content";
import { characterBuildSchema } from "@glantri/domain";
import {
  allocateChargenPoint,
  buildChargenDraftView,
  buildCombatStateCharacterInputs,
  createChargenProgression,
  finalizeChargenDraft,
  resolveAttackModeCompetency,
} from "@glantri/rules-engine";
import { weaponTemplates as liveWeaponTemplates } from "@glantri/content/equipment";
import { characterPayload } from "../../../e2e/character-fixture";
import {
  buildTargetRuntimeContent,
  createTargetCompetencyChargenSource,
} from "./targetCompetencyContent";

const content = withCompetencyContentV2(
  buildTargetRuntimeContent(createTargetCompetencyChargenSource(defaultCanonicalContent)),
);
const group = (id: string) => content.skillGroups.find((row) => row.id === id)!;
const members = (id: string) => (group(id).skillMemberships ?? []).map((row) => row.skillId);
const slotCandidates = (id: string) =>
  (group(id).selectionSlots ?? []).flatMap((slot) => slot.candidateSkillIds);

describe("#389 — Fencing and Longbow are base combat Skills", () => {
  it("lists both in the Chargen catalogue's Skills and in neither its Specializations", () => {
    for (const id of ["fencing", "longbow"]) {
      expect(content.chargenCatalogue!.skillIds).toContain(id);
      expect(content.chargenCatalogue!.specializationIds).not.toContain(id);
      const skill = content.skills.find((row) => row.id === id);
      expect(skill, `${id} vanished from the base-Skill surface`).toBeDefined();
      expect(skill!.specializationOfSkillId).toBeUndefined();
      expect(content.specializations.find((row) => row.id === id)).toBeUndefined();
      expect(skill).not.toHaveProperty("minimumParentLevel");
    }
  });

  it("gives Fencing one-handed edged's linked stats and no elevated Society Level, sorted just after it", () => {
    const edged = content.skills.find((row) => row.id === "one_handed_edged")!;
    const fencing = content.skills.find((row) => row.id === "fencing")!;

    // Ruled 2026-09-27: linked stats STR/DEX, the same as one-handed edged; no elevated generic
    // Society-Level restriction, so it takes one-handed edged's value.
    expect(fencing.linkedStats).toEqual(edged.linkedStats);
    expect(fencing.linkedStats).toEqual(["str", "dex"]);
    expect(fencing.societyLevel).toBe(edged.societyLevel);
    // Ruled: sorted immediately after one-handed edged in Combat ordering.
    expect(fencing.sortOrder).toBe(edged.sortOrder + 1);
    // No Fencing relationship coefficient is approved in either direction.
    expect(fencing.dependencies ?? []).toEqual([]);
  });

  it("preserves Longbow's authored helpful Bow dependency exactly as authored", () => {
    const authored = defaultCanonicalContent.skills.find(
      (row) => row.id === "longbow",
    )!.dependencies;
    expect(authored).toEqual([{ skillId: "bow", strength: "helpful" }]);
    expect(content.skills.find((row) => row.id === "longbow")!.dependencies).toEqual(authored);
  });

  it("teaches Fencing + Dodge + Parry in F30 and charges no one-handed edged", () => {
    expect(members("F30")).toEqual(["fencing", "dodge", "parry"]);
    expect(members("F30")).not.toContain("one_handed_edged");
    expect(group("F30").specializationIds ?? []).toEqual([]);
  });

  it("teaches Longbow + Hunting in F41 and charges no Bow", () => {
    expect(members("F41")).toEqual(["longbow", "skill:hunting"]);
    expect(members("F41")).not.toContain("bow");
    expect(group("F41").specializationIds ?? []).toEqual([]);
  });

  it("offers Longbow in the M04 and M05 pools without disturbing their approved counts", () => {
    for (const [id, chooseCount] of [
      ["M04", 1],
      ["M05", 3],
    ] as const) {
      expect(slotCandidates(id)).toContain("longbow");
      expect(group(id).selectionSlots).toHaveLength(1);
      expect(group(id).selectionSlots![0]!.chooseCount).toBe(chooseCount);
    }
  });

  it("leaves the legacy missile groups' candidate pools untouched", () => {
    for (const [id, slotId] of [
      ["basic_missile_training", "missile_weapon_choice"],
      ["advanced_missile_training", "advanced_missile_weapon_choices"],
    ] as const) {
      const legacy = defaultCanonicalContent.skillGroups.find((row) => row.id === id)!;
      const slot = legacy.selectionSlots!.find((row) => row.id === slotId)!;
      expect(slot.candidateSkillIds).toEqual(["throwing", "sling", "bow", "crossbow"]);
      expect(slot.candidateSkillIds).not.toContain("longbow");
    }
  });

  it("reaches Longbow as a soldier through M04, with no Hunting and no F41 route", () => {
    const base = characterBuildSchema.parse(characterPayload("synthetic", "Synthetic").build);
    const context = {
      content,
      professionId: "profession:soldier",
      profile: base.profile,
      societyId: "pastoral_clan_nomadic",
      societyLevel: 1,
    };
    const progression = {
      ...createChargenProgression(),
      chargenSelections: {
        selectedCoreRouteId: "profession:soldier:core:missile",
        selectedLanguageIds: [],
        selectedSkillIds: [],
        selectedGroupSlots: [
          { groupId: "M04", slotId: "missile-family", selectedSkillIds: ["longbow"] },
        ],
      },
    };

    // F41 is NOT a Soldier route: the military longbow path must not pull in the civilian hunting
    // apprenticeship merely to obtain Longbow.
    expect(
      allocateChargenPoint({ ...context, progression, targetType: "group", targetId: "F41" }).error,
    ).toBe("This skill group is not part of the selected profession and society access.");

    const bought = allocateChargenPoint({
      ...context,
      progression,
      targetType: "group",
      targetId: "M04",
    });
    expect(bought.error).toBeUndefined();

    const finalizedDraft = finalizeChargenDraft({
      ...context,
      progression: bought.progression,
      name: "Military longbow specialist",
    });
    expect(finalizedDraft.errors).toEqual([]);

    const draftView = buildChargenDraftView({ ...context, progression: bought.progression });
    const rows = draftView.skills.map((row) => row.skillId);
    expect(rows).toContain("longbow");
    // No Hunting was acquired to reach the longbow.
    expect(rows).not.toContain("skill:hunting");
    expect(draftView.specializations.some((row) => row.specializationId === "longbow")).toBe(false);
  });

  it("resolves Fencing and Longbow through each mode's competencyRef and changes no ordinary weapon template", () => {
    /* Layer: the LIVE `weaponTemplates` export of `@glantri/content/equipment` (competencyRef
       authored by #512 P1.2), not the imported `weaponTemplates.json`, which carries no refs. */
    const templates = liveWeaponTemplates as unknown as {
      attackModes?: { attackType?: string | null; competencyRef?: string | null }[];
      id: string;
      name: string;
      weaponSkill?: string | null;
    }[];
    const authored = templates.filter((row) =>
      ["Fencing", "Longbow"].includes(row.weaponSkill ?? ""),
    );
    expect(authored.map((row) => row.weaponSkill).sort()).toEqual([
      "Fencing",
      "Fencing",
      "Fencing",
      "Fencing",
      "Fencing",
      "Longbow",
    ]);

    /* `skillId` is the catalogue SkillDefinition id, the key a mode's competencyRef resolves by. */
    const characterInputs = buildCombatStateCharacterInputs({
      adjustedStats: { con: 10, dex: 10, siz: 10, str: 10 },
      draftView: {
        skills: [
          { effectiveSkillNumber: 7, name: "Fencing", skillId: "fencing" },
          { effectiveSkillNumber: 5, name: "Longbow", skillId: "longbow" },
          { effectiveSkillNumber: 3, name: "1-h edged", skillId: "one_handed_edged" },
          { effectiveSkillNumber: 4, name: "Bow", skillId: "bow" },
        ],
      },
    } as unknown as Parameters<typeof buildCombatStateCharacterInputs>[0]);

    expect(characterInputs.combatSkillXpByCompetencyId["fencing"]).toBe(7);
    expect(characterInputs.combatSkillXpByCompetencyId["longbow"]).toBe(5);
    for (const template of authored)
      for (const mode of template.attackModes ?? [])
        expect(
          resolveAttackModeCompetency({ attackMode: mode as never, characterInputs }),
        ).toMatchObject({
          skillXp: template.weaponSkill === "Fencing" ? 7 : 5,
          status: "resolved",
        });

    // Ordinary one-handed edged and bow templates keep resolving to their own competence.
    for (const [weaponSkill, expected] of [
      ["1-h edged", 3],
      ["Bow", 4],
    ] as const) {
      const ordinary = templates.filter((row) => row.weaponSkill === weaponSkill);
      expect(ordinary.length).toBeGreaterThan(0);
      for (const template of ordinary)
        /* A thrown mode attacks with its own competency (Throwing), not the weapon's. */
        for (const mode of (template.attackModes ?? []).filter(
          (candidate) => candidate.attackType !== "thrown",
        ))
          expect(
            resolveAttackModeCompetency({ attackMode: mode as never, characterInputs }),
          ).toMatchObject({ skillXp: expected, status: "resolved" });
    }
  });

  it("publishes no specializationBridge anywhere in the runtime model", () => {
    for (const row of [...content.skills, ...content.specializations])
      expect(row).not.toHaveProperty("specializationBridge");
  });
});
