import { WeaponTemplateSchema, parseCompetencyId } from "@glantri/domain/equipment";
import { describe, expect, it } from "vitest";

import canonicalContent from "../data/canonicalContent.json";
import { importedWeaponTemplates } from "./importedWeaponTemplates";
import {
  applyThemistogenesWeaponEnrichments,
  themistogenesCritErrata,
  themistogenesWeaponEnrichments,
  themistogenesWeaponSkillCompetencyIds,
} from "./themistogenesWeaponEnrichments";
import { weaponTemplates } from "./weaponTemplates";

import type { WeaponTemplate } from "@glantri/domain/equipment";

// P1.2 (#512): errata layer + competency authoring. Expected values below are deliberately
// written out as literals, independent of the source tables they guard.

const liveById = Object.fromEntries(weaponTemplates.map((template) => [template.id, template]));
const importedById = Object.fromEntries(
  importedWeaponTemplates.map((template) => [template.id, template]),
);

function mode(templateId: string, modeId: string) {
  const found = liveById[templateId]?.attackModes?.find((candidate) => candidate.id === modeId);
  if (!found) throw new Error(`missing ${templateId} ${modeId}`);
  return found;
}

/** Re-runs the enrichment with the given mutation applied to the manifest, then restores it. */
function enrichWithManifestMutation(mutate: () => void, restore: () => void): WeaponTemplate[] {
  mutate();
  try {
    return applyThemistogenesWeaponEnrichments(importedWeaponTemplates);
  } finally {
    restore();
  }
}

const catalogueIds = new Set(canonicalContent.skills.map((skill) => skill.id));
const catalogueNames = new Set(canonicalContent.skills.map((skill) => skill.name));

/** Returns every authored competencyRef that is not a catalogue id (for example a display name). */
function findNonCatalogueCompetencyRefs(templates: WeaponTemplate[]): string[] {
  return templates.flatMap((template) =>
    (template.attackModes ?? [])
      .filter((candidate) => candidate.competencyRef != null)
      .filter(
        (candidate) =>
          !catalogueIds.has(candidate.competencyRef as string) ||
          catalogueNames.has(candidate.competencyRef as string),
      )
      .map((candidate) => `${template.id}/${candidate.id}=${candidate.competencyRef}`),
  );
}

describe("P1.2 crit errata (obligations 1, 2)", () => {
  it("records exactly the two ratified errata, both mode-2, with #512 provenance", () => {
    expect(
      themistogenesCritErrata.map(({ templateId, modeId, erratum }) => ({
        templateId,
        modeId,
        original: erratum.original,
        corrected: erratum.corrected,
        issue: erratum.approval.issue,
      })),
    ).toEqual([
      {
        templateId: "weapon-template-dagger",
        modeId: "mode-2",
        original: "DP",
        corrected: "DS",
        issue: 512,
      },
      {
        templateId: "weapon-template-quarterstaff",
        modeId: "mode-2",
        original: "DC",
        corrected: "DP",
        issue: 512,
      },
    ]);
  });

  it("applies the Dagger mode-2 erratum DP->DS (workbook raw cell is what the derivation reads)", () => {
    const raw = importedById["weapon-template-dagger"];
    // Precondition that makes the contract's "silent no-op" trap real: the raw cell wins.
    expect(raw.sourceMetadata?.rawRow?.[raw.sourceMetadata?.sourceColumns?.crit2 as string]).toBe(
      "DP",
    );
    expect(mode("weapon-template-dagger", "mode-2")).toMatchObject({
      crit: "DS",
      canonicalMeleeMode: "slash",
      label: "Slash",
    });
    expect(liveById["weapon-template-dagger"].crit2).toBe("DS");
  });

  it("applies the Quarterstaff mode-2 erratum DC->DP", () => {
    const raw = importedById["weapon-template-quarterstaff"];
    expect(raw.sourceMetadata?.rawRow?.[raw.sourceMetadata?.sourceColumns?.crit2 as string]).toBe(
      "DC",
    );
    expect(mode("weapon-template-quarterstaff", "mode-2")).toMatchObject({
      crit: "DP",
      canonicalMeleeMode: "thrust",
      label: "Thrust",
    });
    expect(liveById["weapon-template-quarterstaff"].crit2).toBe("DP");
  });

  it("preserves the severity-family letter D in both errata", () => {
    for (const { templateId, erratum } of themistogenesCritErrata) {
      expect(erratum.original[0]).toBe("D");
      expect(erratum.corrected[0]).toBe("D");
      expect(mode(templateId, "mode-2").crit?.[0]).toBe("D");
    }
  });

  it("leaves mode-1 of both errata weapons and the raw provenance untouched", () => {
    expect(mode("weapon-template-dagger", "mode-1")).toMatchObject({
      crit: "EP",
      canonicalMeleeMode: "thrust",
    });
    expect(mode("weapon-template-quarterstaff", "mode-1")).toMatchObject({
      crit: "DC",
      canonicalMeleeMode: "strike",
    });
    expect(importedById["weapon-template-dagger"].crit2).toBe("DP");
    expect(importedById["weapon-template-quarterstaff"].crit2).toBe("DC");
  });

  it("FAILS-IF-REMOVED: without the erratum the uncorrected values come back", () => {
    for (const [templateId, uncorrectedCrit, uncorrectedMode] of [
      ["weapon-template-dagger", "DP", "thrust"],
      ["weapon-template-quarterstaff", "DC", "strike"],
    ] as const) {
      const entry = themistogenesWeaponEnrichments[templateId];
      const saved = entry.attackModes!["mode-2"].critErratum;
      const without = enrichWithManifestMutation(
        () => delete entry.attackModes!["mode-2"].critErratum,
        () => {
          entry.attackModes!["mode-2"].critErratum = saved;
        },
      );
      const stripped = without
        .find((template) => template.id === templateId)
        ?.attackModes?.find((candidate) => candidate.id === "mode-2");
      expect(stripped).toMatchObject({
        crit: uncorrectedCrit,
        canonicalMeleeMode: uncorrectedMode,
      });
      // and with it restored the correction is present again
      expect(mode(templateId, "mode-2").crit).not.toBe(uncorrectedCrit);
    }
  });

  it("throws when the source crit no longer matches the erratum's original (no silent no-op)", () => {
    const entry = themistogenesWeaponEnrichments["weapon-template-dagger"];
    const saved = entry.attackModes!["mode-2"].critErratum!;
    expect(() =>
      enrichWithManifestMutation(
        () => {
          entry.attackModes!["mode-2"].critErratum = { ...saved, original: "DC" };
        },
        () => {
          entry.attackModes!["mode-2"].critErratum = saved;
        },
      ),
    ).toThrow(/erratum expects source crit "DC" but observed "DP"/);
  });

  it("throws when an erratum would change the severity-family letter", () => {
    const entry = themistogenesWeaponEnrichments["weapon-template-dagger"];
    const saved = entry.attackModes!["mode-2"].critErratum!;
    expect(() =>
      enrichWithManifestMutation(
        () => {
          entry.attackModes!["mode-2"].critErratum = { ...saved, corrected: "ES" };
        },
        () => {
          entry.attackModes!["mode-2"].critErratum = saved;
        },
      ),
    ).toThrow(/severity-family/);
  });

  it("records the erratum in the template's manual-enrichment provenance", () => {
    expect(liveById["weapon-template-dagger"].manualEnrichment?.attackModeOverrides).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          modeId: "mode-2",
          fields: expect.arrayContaining(["crit"]),
          note: expect.stringContaining("DP -> DS (#512)"),
        }),
      ]),
    );
    expect(liveById["weapon-template-quarterstaff"].manualEnrichment?.attackModeOverrides).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          modeId: "mode-2",
          fields: expect.arrayContaining(["crit"]),
          note: expect.stringContaining("DC -> DP (#512)"),
        }),
      ]),
    );
  });
});

describe("P1.2 mode-1 label/crit disagreements are NOT errata (obligation 3)", () => {
  const disagreements = [
    ["weapon-template-horsemans-pick", "EP"],
    ["weapon-template-footmans-pick", "FP"],
    ["weapon-template-hatchet", "DS"],
    ["weapon-template-wood-axe", "ES"],
    ["weapon-template-hand-axe", "FS"],
    ["weapon-template-battle-axe", "FS"],
    ["weapon-template-halberd", "FS"],
    ["weapon-template-pole-axe", "FS"],
  ] as const;

  it("keeps all eight on strike with the authored Strike label and untouched crit", () => {
    expect(disagreements).toHaveLength(8);
    for (const [templateId, crit] of disagreements) {
      expect(mode(templateId, "mode-1")).toMatchObject({
        label: "Strike",
        canonicalMeleeMode: "strike",
        crit,
      });
      expect(
        themistogenesWeaponEnrichments[templateId]?.attackModes?.["mode-1"]?.critErratum,
      ).toBeUndefined();
    }
  });

  it("finds exactly these eight disagreements among live melee mode-1s", () => {
    const styleByLetter: Record<string, string> = { S: "slash", C: "strike", P: "thrust" };
    const found = weaponTemplates
      .flatMap((template) => (template.attackModes ?? []).map((m) => ({ template, m })))
      .filter(
        ({ m }) =>
          m.id === "mode-1" &&
          m.attackType === "melee" &&
          m.label != null &&
          styleByLetter[m.crit?.[1] ?? ""] !== m.canonicalMeleeMode,
      )
      .map(({ template }) => template.id)
      .sort();
    expect(found).toEqual(disagreements.map(([id]) => id).sort());
  });
});

describe("P1.2 competency authoring (obligations 4, 5)", () => {
  const expectedIdBySkill: Record<string, string> = {
    "1-h conc./axe": "one_handed_concussion_axe",
    "1-h edged": "one_handed_edged",
    "2-h conc./axe": "two_handed_concussion_axe",
    "2-h edged": "two_handed_edged",
    Bow: "bow",
    Crossbow: "crossbow",
    Fencing: "fencing",
    Lance: "lance",
    Longbow: "longbow",
    Polearms: "polearms",
    Sling: "sling",
    Throwing: "throwing",
  };
  const firearms = [
    "Arquebus",
    "Cartridge Pistol",
    "Cartridge Rifle",
    "Hand Cannon",
    "Musket",
    "Pistol",
  ];

  it("reconciles the contract counts: 86 imported modes = 80 live + 6 pruned Second-crit-only modes", () => {
    const imported = importedWeaponTemplates.flatMap((template) => template.attackModes ?? []);
    const importedFirearms = importedWeaponTemplates.filter(
      (template) => template.weaponSkill === "Firearms",
    );
    expect(imported).toHaveLength(86);
    expect(
      imported.length - importedFirearms.flatMap((template) => template.attackModes ?? []).length,
    ).toBe(80);
    expect(importedFirearms.map((template) => template.name).sort()).toEqual(firearms);

    const live = weaponTemplates.flatMap((template) => template.attackModes ?? []);
    expect(live).toHaveLength(80);
    expect(live.filter((m) => m.competencyRef != null)).toHaveLength(74);
    const byType = (type: string) => live.filter((m) => m.attackType === type).length;
    expect([byType("melee"), byType("missile"), byType("thrown")]).toEqual([56, 15, 9]);
  });

  it("authors the expected catalogue id for every non-Firearms mode, including merged thrown modes", () => {
    for (const template of weaponTemplates) {
      if (template.weaponSkill === "Firearms") continue;
      for (const m of template.attackModes ?? []) {
        // A merged thrown mode-3 attacks with Throwing, whatever the base weapon's skill is.
        const expected =
          m.attackType === "thrown" ? "throwing" : expectedIdBySkill[template.weaponSkill ?? ""];
        expect(expected, `${template.id}/${m.id}`).toBeDefined();
        expect(m.competencyRef, `${template.id}/${m.id}`).toBe(expected);
      }
    }
  });

  it("every authored competencyRef is a catalogue id and none is a display name", () => {
    expect(findNonCatalogueCompetencyRefs(weaponTemplates)).toEqual([]);
    for (const id of Object.values(themistogenesWeaponSkillCompetencyIds)) {
      expect(catalogueIds.has(id), id).toBe(true);
      expect(catalogueNames.has(id), id).toBe(false);
    }
  });

  it("FAILS-IF-NAME-AUTHORED: the guard flags a display name even though the brand accepts it", () => {
    // The brand is compile-time only: the display name parses and brands cleanly.
    expect(() => parseCompetencyId("1-h edged")).not.toThrow();
    const poisoned = weaponTemplates.map((template) =>
      template.id === "weapon-template-short-sword"
        ? {
            ...template,
            attackModes: template.attackModes?.map((m) => ({
              ...m,
              competencyRef: parseCompetencyId("1-h edged"),
            })),
          }
        : template,
    );
    expect(findNonCatalogueCompetencyRefs(poisoned)).toEqual([
      "weapon-template-short-sword/mode-1=1-h edged",
      "weapon-template-short-sword/mode-2=1-h edged",
    ]);
    // A syntactically plausible but non-catalogue id is flagged too.
    const unknown = weaponTemplates.map((template) => ({
      ...template,
      attackModes: template.attackModes?.map((m) => ({
        ...m,
        competencyRef: m.competencyRef ? parseCompetencyId("one-handed-edged") : m.competencyRef,
      })),
    }));
    expect(findNonCatalogueCompetencyRefs(unknown).length).toBe(74);
  });

  it("leaves exactly the six Firearms modes without a competency reference, and they stay valid", () => {
    const unresolved = weaponTemplates.flatMap((template) =>
      (template.attackModes ?? []).filter((m) => m.competencyRef == null).map(() => template.name),
    );
    expect(unresolved.sort()).toEqual(firearms);
    for (const template of weaponTemplates.filter((t) => firearms.includes(t.name))) {
      expect(template.weaponSkill).toBe("Firearms");
      for (const m of template.attackModes ?? []) {
        expect("competencyRef" in m).toBe(false);
      }
      expect(WeaponTemplateSchema.safeParse(template).success).toBe(true);
    }
  });

  it("refuses an unknown weapon skill instead of falling back", () => {
    const unknownSkill = { ...importedWeaponTemplates[0], weaponSkill: "Underwater basketry" };
    expect(() => applyThemistogenesWeaponEnrichments([unknownSkill])).toThrow(
      /no competency id authored/,
    );
  });
});
