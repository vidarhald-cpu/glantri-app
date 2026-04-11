import type {
  WeaponAttackMode,
  WeaponTemplate,
  WeaponTemplateManualEnrichment,
} from "@glantri/domain/equipment";
import {
  getCanonicalMeleeModeFromAttackLabel,
  getCanonicalMeleeModeFromCrit,
  getCanonicalMeleeModeLabel,
} from "@glantri/domain";

export interface WeaponAttackModeEnrichment {
  label?: string | null;
  note?: string | null;
}

export interface WeaponTemplateEnrichment {
  notes?: string[];
  attackModes?: Record<string, WeaponAttackModeEnrichment>;
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

export const themistogenesWeaponEnrichments: Record<string, WeaponTemplateEnrichment> = {
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

function getRawSourceValue(
  template: WeaponTemplate,
  sourceKey: string,
): string | null {
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
    trimToNull(template.primaryAttackType) ??
    getRawSourceValue(template, "primaryAttackLabel");
  const primaryModeFamily =
    getCanonicalMeleeModeFromAttackLabel(primaryAttackLabel) ??
    getCanonicalMeleeModeFromCrit(template.crit1);
  const secondaryCrit = getRawSourceValue(template, "crit2") ?? template.crit2 ?? null;
  const secondaryModeFamily = getCanonicalMeleeModeFromCrit(secondaryCrit);
  const secondCrit = getRawSourceValue(template, "secondCrit") ?? template.secondCrit ?? null;
  const hasSecondaryMode = hasWeaponOneSecondaryModeSignal(template);

  const nextModes: WeaponAttackMode[] = [];

  for (const mode of template.attackModes) {
    if (mode.id === "mode-1") {
      nextModes.push({
        ...mode,
        label:
          primaryAttackLabel ??
          mode.label ??
          getCanonicalMeleeModeLabel(primaryModeFamily),
        canonicalMeleeMode:
          primaryModeFamily ?? getCanonicalMeleeModeFromCrit(mode.crit),
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
): { attackModes: WeaponAttackMode[] | null | undefined; overrides: Array<{ modeId: string; fields: string[]; note?: string | null }> } {
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

    if (modeEnrichment.label !== undefined && modeEnrichment.label !== mode.label) {
      nextMode = {
        ...nextMode,
        label: modeEnrichment.label,
      };
      fields.push("label");
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
    return overrides.some((override) => override.modeId === "mode-1" && override.fields.includes("label"));
  }
  if (warning.includes("mode-2") && warning.includes("secondary attack label")) {
    const secondaryMode = template.attackModes?.find((mode) => mode.id === "mode-2");
    return (
      secondaryMode == null ||
      secondaryMode.label != null ||
      overrides.some((override) => override.modeId === "mode-2" && override.fields.includes("label"))
    );
  }
  return false;
}

export function applyThemistogenesWeaponEnrichments(
  templates: WeaponTemplate[],
): WeaponTemplate[] {
  return templates.map((template) => {
    const enrichment = themistogenesWeaponEnrichments[template.id];
    const canonicallyMappedTemplate: WeaponTemplate = {
      ...template,
      attackModes: applyCanonicalWeaponOneMeleeMapping(template),
    };
    const { attackModes, overrides } = applyAttackModeEnrichment(
      canonicallyMappedTemplate.attackModes,
      enrichment,
    );
    const enrichedTemplateWithModes: WeaponTemplate = {
      ...canonicallyMappedTemplate,
      attackModes,
    };
    const resolvedWarnings = (template.importWarnings ?? []).filter((warning) =>
      isWarningResolvedByOverride(warning, enrichedTemplateWithModes, overrides),
    );
    const unresolvedWarnings = (template.importWarnings ?? []).filter(
      (warning) => !isWarningResolvedByOverride(warning, enrichedTemplateWithModes, overrides),
    );

    const manualEnrichment: WeaponTemplateManualEnrichment | null =
      enrichment || overrides.length > 0 || resolvedWarnings.length > 0 || unresolvedWarnings.length > 0
        ? {
            source: "themistogenes-manual-v1",
            notes: enrichment?.notes ?? null,
            attackModeOverrides: overrides.length > 0 ? overrides : null,
            resolvedImportWarnings: resolvedWarnings.length > 0 ? resolvedWarnings : null,
            unresolvedImportWarnings: unresolvedWarnings.length > 0 ? unresolvedWarnings : null,
          }
        : null;

    const primaryMode = attackModes?.find((mode) => mode.id === "mode-1");
    const secondaryMode = attackModes?.find((mode) => mode.id === "mode-2");

    return {
      ...template,
      attackModes,
      primaryAttackType: primaryMode?.label ?? template.primaryAttackType ?? null,
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
