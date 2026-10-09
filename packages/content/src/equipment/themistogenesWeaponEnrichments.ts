import type {
  MissileWeaponProfile,
  WeaponAttackMode,
  WeaponTemplate,
  WeaponTemplateManualEnrichment,
} from "@glantri/domain/equipment";
import {
  getCanonicalMeleeModeFromAttackLabel,
  getCanonicalMeleeModeFromCrit,
  getCanonicalMeleeModeLabel,
  parseCompetencyId,
} from "@glantri/domain";

/** #512 approval provenance for a Product-Owner-ratified workbook erratum. */
export interface WeaponCritErratumApproval {
  /** Forgejo issue that carries the ratification. */
  issue: number;
  /** Human-readable pointer to the ruling, for example the issue comment that records it. */
  ruling: string;
}

/**
 * A reviewable, Product-Owner-approved correction of a source crit code (rung 1 of the mode-style
 * precedence: erratum, then explicit label, then crit-derived fallback).
 *
 * The correction is applied to the crit INPUT. `canonicalMeleeMode` is then derived from the
 * corrected crit by the single existing derivation, so the severity-family letter is preserved and
 * no special case exists in the derivation. Only the secondary (`mode-2`) crit is supported: it is
 * the only mode whose style is carried by the crit code alone.
 *
 * `original` is verified against the observed source value; a mismatch throws, so a stale
 * erratum can never silently apply or silently do nothing.
 */
export interface WeaponCritErratum {
  original: string;
  corrected: string;
  approval: WeaponCritErratumApproval;
}

export interface WeaponAttackModeEnrichment {
  allowsRepeatedRoundAttack?: boolean;
  label?: string | null;
  note?: string | null;
  critErratum?: WeaponCritErratum;
}

export interface WeaponTemplateEnrichment {
  notes?: string[];
  attackModes?: Record<string, WeaponAttackModeEnrichment>;
  disarmCapability?: "none" | "trap";
  disarmGripClass?: "one_handed" | "two_handed";
  disarmControlOverride?: number;
  missileProfile?: MissileWeaponProfile;
}

export interface ThemistogenesWeaponEnrichmentReport {
  totalTemplates: number;
  templatesWithManualEnrichment: number;
  rawWarningCount: number;
  resolvedWarningCount: number;
  unresolvedWarningCount: number;
  resolvedWarningCategories: Record<string, number>;
  unresolvedWarningCategories: Record<string, number>;
}

function fromIds(
  ids: string[],
  enrichment: WeaponTemplateEnrichment,
): Record<string, WeaponTemplateEnrichment> {
  return Object.fromEntries(ids.map((id) => [id, enrichment]));
}

const throwMode1Ids = [
  "weapon-template-t-knife",
  "weapon-template-t-dagger",
  "weapon-template-t-th-dagger",
  "weapon-template-shuriken",
  "weapon-template-t-hatchet",
  "weapon-template-t-wood-axe",
  "weapon-template-t-hand-axe",
  "weapon-template-t-javelin",
  "weapon-template-t-spear",
];

const shotMode1Ids = [
  "weapon-template-sling",
  "weapon-template-bow",
  "weapon-template-composite-bow",
  "weapon-template-long-bow",
  "weapon-template-musket",
  "weapon-template-arquebus",
  "weapon-template-cartridge-rifle",
  "weapon-template-pistol",
  "weapon-template-cartridge-pistol",
  "weapon-template-hand-cannon",
  "weapon-template-hand-crossbow",
  "weapon-template-mini-crossbow",
  "weapon-template-crossbow",
  "weapon-template-heavy-crossbow",
  "weapon-template-ballista",
];

const repeatedThrustMode1Ids = [
  "weapon-template-dagger",
  "weapon-template-fencing-sword",
  "weapon-template-rapier",
  "weapon-template-1-h-spear",
  "weapon-template-2-h-javelin",
  "weapon-template-1-h-javelin",
  "weapon-template-spear",
];

const repeatedThrustMode2Ids = ["weapon-template-broad-sword"];

const trapDisarmWeaponIds = [
  "weapon-template-main-gauche",
  "weapon-template-swordbreaker",
  "weapon-template-rapier",
  "weapon-template-fencing-sword",
];

const missileProfiles: Record<string, MissileWeaponProfile> = {
  "weapon-template-sling": {
    ammoFamily: "sling_projectile",
    canRemainReady: false,
    family: "sling",
    fullNormalCycleRounds: 3,
    preparationModel: "continuous_fragile",
    rapidShotAllowed: true,
    standardPreparationRounds: 2,
  },
  "weapon-template-bow": {
    ammoFamily: "arrow",
    canRemainReady: false,
    family: "short_bow",
    fullNormalCycleRounds: 2,
    preparationModel: "continuous_fragile",
    rapidShotAllowed: true,
    standardPreparationRounds: 1,
  },
  "weapon-template-composite-bow": {
    ammoFamily: "arrow",
    canRemainReady: false,
    family: "composite_bow",
    fullNormalCycleRounds: 2,
    preparationModel: "continuous_fragile",
    rapidShotAllowed: true,
    standardPreparationRounds: 1,
  },
  "weapon-template-long-bow": {
    ammoFamily: "arrow",
    canRemainReady: false,
    family: "long_bow",
    fullNormalCycleRounds: 2,
    preparationModel: "continuous_fragile",
    rapidShotAllowed: true,
    standardPreparationRounds: 1,
  },
  "weapon-template-hand-crossbow": {
    ammoFamily: "crossbow_bolt",
    canRemainReady: true,
    family: "hand_crossbow",
    fullNormalCycleRounds: 4,
    preparationModel: "staged_persistent",
    rapidShotAllowed: false,
    standardPreparationRounds: 3,
  },
  "weapon-template-crossbow": {
    ammoFamily: "crossbow_bolt",
    canRemainReady: true,
    family: "crossbow",
    fullNormalCycleRounds: 8,
    preparationModel: "staged_persistent",
    rapidShotAllowed: false,
    standardPreparationRounds: 7,
  },
  "weapon-template-heavy-crossbow": {
    ammoFamily: "crossbow_bolt",
    canRemainReady: true,
    family: "heavy_crossbow",
    fullNormalCycleRounds: 10,
    preparationModel: "staged_persistent",
    rapidShotAllowed: false,
    standardPreparationRounds: 9,
  },
};

export const themistogenesWeaponEnrichments: Record<string, WeaponTemplateEnrichment> = {
  ...fromIds(repeatedThrustMode1Ids, {
    attackModes: {
      "mode-1": {
        allowsRepeatedRoundAttack: true,
        note: "Manual rules enrichment: this melee thrust mode may be used twice in one round.",
      },
    },
  }),
  ...fromIds(repeatedThrustMode2Ids, {
    attackModes: {
      "mode-2": {
        allowsRepeatedRoundAttack: true,
        note: "Manual rules enrichment: this melee thrust mode may be used twice in one round.",
      },
    },
  }),
  ...fromIds(throwMode1Ids, {
    attackModes: {
      "mode-1": {
        label: "Throw",
        note: "Manual enrichment: Weapon2 rows omit an explicit attack label for thrown weapons.",
      },
    },
  }),
  ...fromIds(shotMode1Ids, {
    attackModes: {
      "mode-1": {
        label: "Shot",
        note: "Manual enrichment: Weapon2 rows omit an explicit attack label for projectile weapons.",
      },
    },
  }),
};

for (const id of trapDisarmWeaponIds) {
  const current = themistogenesWeaponEnrichments[id] ?? {};
  themistogenesWeaponEnrichments[id] = {
    ...current,
    disarmCapability: "trap",
    notes: [
      ...(current.notes ?? []),
      "Approved Disarm V1 specialist capability (combat source p. 8).",
    ],
  };
}

for (const [id, missileProfile] of Object.entries(missileProfiles)) {
  const current = themistogenesWeaponEnrichments[id] ?? {};
  themistogenesWeaponEnrichments[id] = {
    ...current,
    missileProfile,
    notes: [
      ...(current.notes ?? []),
      "Approved Missile Weapons V1 preparation/readiness calibration (#290).",
    ],
  };
}

for (const [id, sourceRow] of [
  ["weapon-template-1-h-javelin", 27],
  ["weapon-template-1-h-spear", 28],
] as const) {
  const current = themistogenesWeaponEnrichments[id] ?? {};
  themistogenesWeaponEnrichments[id] = {
    ...current,
    disarmGripClass: "one_handed",
    notes: [
      ...(current.notes ?? []),
      `Source-backed one-handed polearm normalization (Weapon1 row ${sourceRow}).`,
    ],
  };
}

const critErratumApproval: WeaponCritErratumApproval = {
  issue: 512,
  ruling:
    "Product Owner mode-2 errata, ratified under #512 (melee mode-style precedence ruling, 2026-10-06, issue comment 12816).",
};

/** The complete set of ratified source-crit errata. Exactly two, both mode-2, both preserving severity `D`. */
export const themistogenesCritErrata: ReadonlyArray<{
  templateId: string;
  modeId: "mode-2";
  erratum: WeaponCritErratum;
}> = [
  {
    templateId: "weapon-template-dagger",
    modeId: "mode-2",
    erratum: { original: "DP", corrected: "DS", approval: critErratumApproval },
  },
  {
    templateId: "weapon-template-quarterstaff",
    modeId: "mode-2",
    erratum: { original: "DC", corrected: "DP", approval: critErratumApproval },
  },
];

for (const { templateId, modeId, erratum } of themistogenesCritErrata) {
  const current = themistogenesWeaponEnrichments[templateId] ?? {};
  themistogenesWeaponEnrichments[templateId] = {
    ...current,
    attackModes: {
      ...current.attackModes,
      [modeId]: {
        ...current.attackModes?.[modeId],
        critErratum: erratum,
        note: `Approved source-crit erratum ${erratum.original} -> ${erratum.corrected} (#${erratum.approval.issue}).`,
      },
    },
  };
}

/**
 * Catalogue competency ids (NOT display names) per workbook weapon skill. The keys are the
 * workbook `weaponSkill` strings used only to address a row; every VALUE is the stable catalogue
 * `id` (`canonicalContent` skill ids). Firearms is deliberately absent: no Firearms competency
 * exists in this phase and there is no name-string fallback, so those modes stay unresolved.
 */
export const themistogenesWeaponSkillCompetencyIds: Readonly<Record<string, string>> = {
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

/** Workbook weapon skills that intentionally carry no competency reference (refusal-path fixtures). */
export const themistogenesUnresolvedWeaponSkills: ReadonlyArray<string> = ["Firearms"];

function resolveWeaponSkillCompetencyId(skill: string | null | undefined) {
  if (skill != null && Object.hasOwn(themistogenesWeaponSkillCompetencyIds, skill)) {
    return parseCompetencyId(themistogenesWeaponSkillCompetencyIds[skill]);
  }
  if (skill != null && themistogenesUnresolvedWeaponSkills.includes(skill)) {
    return null;
  }
  throw new Error(
    `Weapon skill "${skill}" has no competency id authored and is not a declared unresolved skill.`,
  );
}

function getSecondaryCritErratum(template: WeaponTemplate): WeaponCritErratum | null {
  const enrichment = themistogenesWeaponEnrichments[template.id];
  if (enrichment?.attackModes?.["mode-1"]?.critErratum) {
    throw new Error(`${template.id}: crit errata are only supported on mode-2.`);
  }
  return enrichment?.attackModes?.["mode-2"]?.critErratum ?? null;
}

function applyCritErratum(
  location: string,
  observed: string | null | undefined,
  erratum: WeaponCritErratum,
): string {
  if (observed !== erratum.original) {
    throw new Error(
      `${location}: erratum expects source crit "${erratum.original}" but observed "${observed}".`,
    );
  }
  if (erratum.corrected[0] !== erratum.original[0]) {
    throw new Error(`${location}: erratum must preserve the severity-family letter.`);
  }
  return erratum.corrected;
}

function resolveWarningCategory(warning: string): string {
  if (warning.includes("no explicit secondary attack label column")) {
    return "missing_secondary_attack_label";
  }
  if (warning.includes("no explicit attack label column on Weapon2")) {
    return "missing_weapon2_attack_label";
  }
  if (warning.includes("DMB")) {
    return "non_numeric_dmb_preserved_raw";
  }
  if (warning.includes("encumbrance")) {
    return "non_numeric_encumbrance_compat";
  }
  if (warning.includes("damage class")) {
    return "unresolved_damage_class";
  }
  if (warning.includes("parry")) {
    return "non_numeric_parry";
  }
  return "other";
}

function trimToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function getRawSourceValue(template: WeaponTemplate, sourceKey: string): string | null {
  const sourceColumn = template.sourceMetadata?.sourceColumns?.[sourceKey];
  if (!sourceColumn) {
    return null;
  }

  return trimToNull(template.sourceMetadata?.rawRow?.[sourceColumn]);
}

function hasWeaponOneSecondaryModeSignal(template: WeaponTemplate): boolean {
  return [
    getRawSourceValue(template, "ob2"),
    getRawSourceValue(template, "dmb2"),
    getRawSourceValue(template, "armorMod2"),
    getRawSourceValue(template, "crit2"),
  ].some((value) => value != null);
}

function applyCanonicalWeaponOneMeleeMapping(
  template: WeaponTemplate,
): WeaponAttackMode[] | null | undefined {
  if (template.sourceMetadata?.sheet !== "Weapon1" || !template.attackModes) {
    return template.attackModes;
  }

  const primaryAttackLabel =
    trimToNull(template.primeAttackType) ??
    trimToNull(template.primaryAttackType) ??
    getRawSourceValue(template, "primaryAttackLabel");
  const primaryModeFamily =
    getCanonicalMeleeModeFromAttackLabel(primaryAttackLabel) ??
    getCanonicalMeleeModeFromCrit(template.crit1);
  const secondaryCritErratum = getSecondaryCritErratum(template);
  const observedSecondaryCrit = getRawSourceValue(template, "crit2") ?? template.crit2 ?? null;
  // The workbook raw cell (`rawRow[sourceColumns.crit2]`) wins over `template.crit2`, so the
  // erratum must intercept this resolved value; overriding `template.crit2` alone would be a no-op.
  const secondaryCrit = secondaryCritErratum
    ? applyCritErratum(`${template.id} crit2`, observedSecondaryCrit, secondaryCritErratum)
    : observedSecondaryCrit;
  const secondaryModeFamily = getCanonicalMeleeModeFromCrit(secondaryCrit);
  const secondCrit = getRawSourceValue(template, "secondCrit") ?? template.secondCrit ?? null;
  const hasSecondaryMode = hasWeaponOneSecondaryModeSignal(template);

  const nextModes: WeaponAttackMode[] = [];

  for (const mode of template.attackModes) {
    if (mode.id === "mode-1") {
      nextModes.push({
        ...mode,
        label: primaryAttackLabel ?? mode.label ?? getCanonicalMeleeModeLabel(primaryModeFamily),
        canonicalMeleeMode: primaryModeFamily ?? getCanonicalMeleeModeFromCrit(mode.crit),
        isPrimaryAttack: true,
        secondCrit,
      });
      continue;
    }

    if (mode.id === "mode-2") {
      if (!hasSecondaryMode) {
        continue;
      }

      nextModes.push({
        ...mode,
        label: getCanonicalMeleeModeLabel(secondaryModeFamily) ?? mode.label,
        ...(secondaryCritErratum
          ? {
              crit: applyCritErratum(`${template.id} mode-2 crit`, mode.crit, secondaryCritErratum),
            }
          : {}),
        canonicalMeleeMode:
          secondaryModeFamily ??
          getCanonicalMeleeModeFromAttackLabel(mode.label) ??
          getCanonicalMeleeModeFromCrit(mode.crit),
        isPrimaryAttack: false,
        secondCrit: null,
      });
      continue;
    }

    nextModes.push(mode);
  }

  return nextModes;
}

function applyAttackModeEnrichment(
  modes: WeaponAttackMode[] | null | undefined,
  enrichment: WeaponTemplateEnrichment | undefined,
): {
  attackModes: WeaponAttackMode[] | null | undefined;
  overrides: Array<{ modeId: string; fields: string[]; note?: string | null }>;
} {
  if (!modes || !enrichment?.attackModes) {
    return { attackModes: modes, overrides: [] };
  }

  const overrides: Array<{ modeId: string; fields: string[]; note?: string | null }> = [];
  const attackModes = modes.map((mode) => {
    const modeEnrichment = enrichment.attackModes?.[mode.id];
    if (!modeEnrichment) {
      return mode;
    }

    const fields: string[] = [];
    let nextMode = mode;

    if (
      modeEnrichment.allowsRepeatedRoundAttack !== undefined &&
      modeEnrichment.allowsRepeatedRoundAttack !== mode.allowsRepeatedRoundAttack
    ) {
      nextMode = {
        ...nextMode,
        allowsRepeatedRoundAttack: modeEnrichment.allowsRepeatedRoundAttack,
      };
      fields.push("allowsRepeatedRoundAttack");
    }

    if (modeEnrichment.label !== undefined && modeEnrichment.label !== mode.label) {
      nextMode = {
        ...nextMode,
        label: modeEnrichment.label,
      };
      fields.push("label");
    }

    if (modeEnrichment.critErratum) {
      // Already applied to the crit input upstream; recorded here so it is visible in provenance.
      fields.push("crit");
    }

    if (fields.length > 0) {
      overrides.push({
        modeId: mode.id,
        fields,
        note: modeEnrichment.note ?? null,
      });
    }

    return nextMode;
  });

  return { attackModes, overrides };
}

function isWarningResolvedByOverride(
  warning: string,
  template: WeaponTemplate,
  overrides: Array<{ modeId: string; fields: string[] }>,
): boolean {
  if (warning.includes("mode-1") && warning.includes("attack label")) {
    return overrides.some(
      (override) => override.modeId === "mode-1" && override.fields.includes("label"),
    );
  }
  if (warning.includes("mode-2") && warning.includes("secondary attack label")) {
    const secondaryMode = template.attackModes?.find((mode) => mode.id === "mode-2");
    return (
      secondaryMode == null ||
      secondaryMode.label != null ||
      overrides.some(
        (override) => override.modeId === "mode-2" && override.fields.includes("label"),
      )
    );
  }
  return false;
}

export function applyThemistogenesWeaponEnrichments(templates: WeaponTemplate[]): WeaponTemplate[] {
  return templates.map((template) => {
    const enrichment = themistogenesWeaponEnrichments[template.id];
    const primeAttackType =
      trimToNull(template.primeAttackType) ??
      trimToNull(template.primaryAttackType) ??
      getRawSourceValue(template, "primaryAttackLabel");
    const canonicallyMappedTemplate: WeaponTemplate = {
      ...template,
      attackModes: applyCanonicalWeaponOneMeleeMapping(template),
    };
    const { attackModes, overrides } = applyAttackModeEnrichment(
      canonicallyMappedTemplate.attackModes,
      enrichment,
    );
    const competencyRef = resolveWeaponSkillCompetencyId(template.weaponSkill);
    const orderedAttackModes = attackModes?.map((mode, index) => ({
      ...mode,
      ...(mode.competencyRef == null && competencyRef != null ? { competencyRef } : {}),
      attackType:
        mode.attackType ??
        (canonicallyMappedTemplate.handlingClass === "thrown"
          ? "thrown"
          : canonicallyMappedTemplate.handlingClass === "missile"
            ? "missile"
            : "melee"),
      initiative: mode.initiative ?? canonicallyMappedTemplate.initiative,
      isPrimaryAttack:
        mode.isPrimaryAttack ??
        (attackModes.some((candidate) => candidate.isPrimaryAttack === true) ? false : index === 0),
      order: mode.order ?? index,
      range: mode.range ?? canonicallyMappedTemplate.range,
      sourceMetadata: mode.sourceMetadata ?? canonicallyMappedTemplate.sourceMetadata,
    }));
    const enrichedTemplateWithModes: WeaponTemplate = {
      ...canonicallyMappedTemplate,
      attackModes: orderedAttackModes,
    };
    const resolvedWarnings = (template.importWarnings ?? []).filter((warning) =>
      isWarningResolvedByOverride(warning, enrichedTemplateWithModes, overrides),
    );
    const unresolvedWarnings = (template.importWarnings ?? []).filter(
      (warning) => !isWarningResolvedByOverride(warning, enrichedTemplateWithModes, overrides),
    );

    const manualEnrichment: WeaponTemplateManualEnrichment | null =
      enrichment ||
      overrides.length > 0 ||
      resolvedWarnings.length > 0 ||
      unresolvedWarnings.length > 0
        ? {
            source: "themistogenes-manual-v1",
            notes: enrichment?.notes ?? null,
            attackModeOverrides: overrides.length > 0 ? overrides : null,
            resolvedImportWarnings: resolvedWarnings.length > 0 ? resolvedWarnings : null,
            unresolvedImportWarnings: unresolvedWarnings.length > 0 ? unresolvedWarnings : null,
          }
        : null;

    const primaryMode = orderedAttackModes?.find((mode) => mode.id === "mode-1");
    const secondaryMode = orderedAttackModes?.find((mode) => mode.id === "mode-2");

    const secondaryCritErratum = getSecondaryCritErratum(template);

    return {
      ...template,
      ...(secondaryCritErratum
        ? { crit2: applyCritErratum(`${template.id} crit2`, template.crit2, secondaryCritErratum) }
        : {}),
      attackModes: orderedAttackModes,
      disarmCapability: enrichment?.disarmCapability ?? template.disarmCapability ?? "none",
      disarmControlOverride:
        enrichment?.disarmControlOverride ?? template.disarmControlOverride ?? null,
      disarmGripClass: enrichment?.disarmGripClass ?? template.disarmGripClass ?? null,
      missileProfile: enrichment?.missileProfile ?? template.missileProfile ?? null,
      primeAttackType,
      primaryAttackType:
        primeAttackType ?? primaryMode?.label ?? template.primaryAttackType ?? null,
      secondaryAttackType: secondaryMode?.label ?? template.secondaryAttackType ?? null,
      importWarnings: unresolvedWarnings.length > 0 ? unresolvedWarnings : null,
      manualEnrichment,
    };
  });
}

export function buildThemistogenesWeaponEnrichmentReport(
  importedTemplates: WeaponTemplate[],
  enrichedTemplates: WeaponTemplate[],
): ThemistogenesWeaponEnrichmentReport {
  const resolvedWarningCategories: Record<string, number> = {};
  const unresolvedWarningCategories: Record<string, number> = {};

  let rawWarningCount = 0;
  let resolvedWarningCount = 0;
  let unresolvedWarningCount = 0;
  let templatesWithManualEnrichment = 0;

  for (let index = 0; index < enrichedTemplates.length; index += 1) {
    const imported = importedTemplates[index];
    const enriched = enrichedTemplates[index];

    rawWarningCount += imported.importWarnings?.length ?? 0;

    if (enriched.manualEnrichment) {
      templatesWithManualEnrichment += 1;
    }

    for (const warning of enriched.manualEnrichment?.resolvedImportWarnings ?? []) {
      resolvedWarningCount += 1;
      const category = resolveWarningCategory(warning);
      resolvedWarningCategories[category] = (resolvedWarningCategories[category] ?? 0) + 1;
    }

    for (const warning of enriched.importWarnings ?? []) {
      unresolvedWarningCount += 1;
      const category = resolveWarningCategory(warning);
      unresolvedWarningCategories[category] = (unresolvedWarningCategories[category] ?? 0) + 1;
    }
  }

  return {
    totalTemplates: enrichedTemplates.length,
    templatesWithManualEnrichment,
    rawWarningCount,
    resolvedWarningCount,
    unresolvedWarningCount,
    resolvedWarningCategories,
    unresolvedWarningCategories,
  };
}
