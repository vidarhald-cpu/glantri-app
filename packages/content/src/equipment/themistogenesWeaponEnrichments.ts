import type {
  WeaponAttackMode,
  WeaponTemplate,
  WeaponTemplateManualEnrichment,
} from "@glantri/domain/equipment";

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

const slashMode2Ids = [
  "weapon-template-knife",
  "weapon-template-short-sword",
  "weapon-template-dirk",
  "weapon-template-rapier",
  "weapon-template-fencing-sword",
  "weapon-template-main-gauche",
  "weapon-template-swordbreaker",
];

const thrustMode2Ids = [
  "weapon-template-dagger",
  "weapon-template-falchion",
  "weapon-template-broad-sword",
  "weapon-template-cutlass",
  "weapon-template-scimitar",
  "weapon-template-longsword",
  "weapon-template-great-sword",
  "weapon-template-1-h-javelin",
  "weapon-template-1-h-spear",
  "weapon-template-2-h-javelin",
  "weapon-template-spear",
  "weapon-template-halberd",
  "weapon-template-sabre",
];

const strikeMode2Ids = [
  "weapon-template-morning-star",
  "weapon-template-hatchet",
  "weapon-template-wood-axe",
  "weapon-template-hand-axe",
  "weapon-template-battle-axe",
  "weapon-template-quarterstaff",
  "weapon-template-pole-axe",
  "weapon-template-lance",
];

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
  ...fromIds(slashMode2Ids, {
    attackModes: {
      "mode-2": {
        label: "Slash",
        note: "Manual enrichment: workbook provides mode-2 numbers and crits but no explicit secondary label.",
      },
    },
  }),
  ...fromIds(thrustMode2Ids, {
    attackModes: {
      "mode-2": {
        label: "Thrust",
        note: "Manual enrichment: workbook provides mode-2 numbers and crits but no explicit secondary label.",
      },
    },
  }),
  ...fromIds(strikeMode2Ids, {
    attackModes: {
      "mode-2": {
        label: "Strike",
        note: "Manual enrichment: workbook provides mode-2/blunt follow-up data without an explicit label.",
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
  overrides: Array<{ modeId: string; fields: string[] }>,
): boolean {
  if (warning.includes("mode-1") && warning.includes("attack label")) {
    return overrides.some((override) => override.modeId === "mode-1" && override.fields.includes("label"));
  }
  if (warning.includes("mode-2") && warning.includes("secondary attack label")) {
    return overrides.some((override) => override.modeId === "mode-2" && override.fields.includes("label"));
  }
  return false;
}

export function applyThemistogenesWeaponEnrichments(
  templates: WeaponTemplate[],
): WeaponTemplate[] {
  return templates.map((template) => {
    const enrichment = themistogenesWeaponEnrichments[template.id];
    if (!enrichment) {
      return template;
    }

    const { attackModes, overrides } = applyAttackModeEnrichment(template.attackModes, enrichment);
    const resolvedWarnings = (template.importWarnings ?? []).filter((warning) =>
      isWarningResolvedByOverride(warning, overrides),
    );
    const unresolvedWarnings = (template.importWarnings ?? []).filter(
      (warning) => !isWarningResolvedByOverride(warning, overrides),
    );

    const manualEnrichment: WeaponTemplateManualEnrichment = {
      source: "themistogenes-manual-v1",
      notes: enrichment.notes ?? null,
      attackModeOverrides: overrides.length > 0 ? overrides : null,
      resolvedImportWarnings: resolvedWarnings.length > 0 ? resolvedWarnings : null,
      unresolvedImportWarnings: unresolvedWarnings.length > 0 ? unresolvedWarnings : null,
    };

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
