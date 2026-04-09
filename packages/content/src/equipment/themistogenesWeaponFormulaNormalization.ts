import type {
  WeaponAttackMode,
  WeaponDamageModifierFormula,
  WeaponEncumbranceFormula,
  WeaponFormulaNormalizationEntry,
  WeaponTemplate,
  WeaponTemplateFormulaNormalization,
} from "@glantri/domain/equipment";

export interface ThemistogenesWeaponFormulaNormalizationReport {
  totalTemplates: number;
  templatesWithFormulaNormalization: number;
  rawWarningCount: number;
  resolvedWarningCount: number;
  unresolvedWarningCount: number;
  resolvedWarningCategories: Record<string, number>;
  unresolvedWarningCategories: Record<string, number>;
}

const FORMULA_NORMALIZATION_SOURCE = "themistogenes-formula-v1";

function resolveWarningCategory(warning: string): string {
  if (warning.includes("DMB")) {
    return "non_numeric_dmb_preserved_raw";
  }
  if (warning.includes("ammo encumbrance")) {
    return "non_numeric_ammo_encumbrance_preserved_raw";
  }
  if (warning.includes("encumbrance")) {
    return "non_numeric_encumbrance_compat";
  }
  return "other";
}

function parseNumber(value: string): number | null {
  if (!value.trim()) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseDmbFormula(raw: string | null | undefined): WeaponDamageModifierFormula | null {
  const trimmed = raw?.trim();
  if (!trimmed) {
    return null;
  }

  const numericValue = parseNumber(trimmed);
  if (numericValue != null) {
    return {
      kind: "numeric",
      raw: trimmed,
      numericValue,
    };
  }

  if (/^var(?:iable)?$/i.test(trimmed)) {
    return {
      kind: "special",
      raw: trimmed,
      specialValue: trimmed,
      note: "Source marks this damage modifier as variable rather than numeric.",
    };
  }

  const diceMatch = /^(?<count>\d+)d(?<sides>\d+)(?:(?<flatSign>[+-])(?<flatValue>\d+))?(?:\s*\+\s*(?<text>[A-Za-z][A-Za-z0-9_-]*))?$/i.exec(
    trimmed.replace(/\s+/g, ""),
  );
  if (diceMatch?.groups) {
    const flatMagnitude = diceMatch.groups.flatValue ? Number(diceMatch.groups.flatValue) : null;
    const flatModifier =
      flatMagnitude == null
        ? null
        : diceMatch.groups.flatSign === "-"
          ? -flatMagnitude
          : flatMagnitude;

    return {
      kind: "dice",
      raw: trimmed,
      diceCount: Number(diceMatch.groups.count),
      diceSides: Number(diceMatch.groups.sides),
      flatModifier,
      textModifier: diceMatch.groups.text ?? null,
    };
  }

  return {
    kind: "unresolved",
    raw: trimmed,
    note: "Normalization layer could not safely interpret this DMB expression.",
  };
}

function parseEncumbranceFormula(raw: string | null | undefined): WeaponEncumbranceFormula | null {
  const trimmed = raw?.trim();
  if (!trimmed) {
    return null;
  }

  const numericValue = parseNumber(trimmed);
  if (numericValue != null) {
    return {
      kind: "numeric",
      raw: trimmed,
      numericValue,
    };
  }

  const ammoLinkedMatch = /^(?<base>\d+(?:\.\d+)?)\s*\+\s*(?<ammo>\d+(?:\.\d+)?)$/.exec(trimmed);
  if (ammoLinkedMatch?.groups) {
    return {
      kind: "ammo_linked",
      raw: trimmed,
      baseValue: Number(ammoLinkedMatch.groups.base),
      ammoValue: Number(ammoLinkedMatch.groups.ammo),
      note: "Source appears to encode weapon and projectile encumbrance together.",
    };
  }

  if (/^[A-Za-z][A-Za-z0-9 /_-]*$/.test(trimmed)) {
    return {
      kind: "special",
      raw: trimmed,
      specialValue: trimmed,
    };
  }

  return {
    kind: "unresolved",
    raw: trimmed,
    note: "Normalization layer could not safely interpret this encumbrance value.",
  };
}

function buildNormalizationEntry(input: {
  fieldPath: string;
  kind: WeaponFormulaNormalizationEntry["kind"];
  raw: string;
  normalizedAs: string;
  note?: string | null;
}): WeaponFormulaNormalizationEntry {
  return {
    fieldPath: input.fieldPath,
    kind: input.kind,
    raw: input.raw,
    normalizedAs: input.normalizedAs,
    note: input.note ?? null,
  };
}

function normalizeAttackModes(
  attackModes: WeaponAttackMode[] | null | undefined,
): { attackModes: WeaponAttackMode[] | null | undefined; normalizedFields: WeaponFormulaNormalizationEntry[] } {
  if (!attackModes) {
    return {
      attackModes,
      normalizedFields: [],
    };
  }

  const normalizedFields: WeaponFormulaNormalizationEntry[] = [];
  const normalizedModes = attackModes.map((mode) => {
    const formula = parseDmbFormula(mode.dmbRaw);
    if (!formula || formula.kind === "numeric") {
      return mode;
    }

    if (formula.kind !== "unresolved") {
      normalizedFields.push(
        buildNormalizationEntry({
          fieldPath: `attackModes.${mode.id}.dmb`,
          kind: "dmb",
          raw: formula.raw,
          normalizedAs: formula.kind,
          note: formula.note,
        }),
      );
    }

    return {
      ...mode,
      dmbFormula: formula,
    };
  });

  return {
    attackModes: normalizedModes,
    normalizedFields,
  };
}

function isDmbWarningResolved(warning: string, template: WeaponTemplate): boolean {
  const match = /mode-(?<modeId>\d+): DMB '(?<raw>.+)' preserved as raw source text\.$/.exec(warning);
  const groups = match?.groups;
  if (!groups) {
    return false;
  }

  const mode = template.attackModes?.find((candidate) => candidate.id === `mode-${groups.modeId}`);
  return mode?.dmbFormula != null && mode.dmbFormula.kind !== "unresolved";
}

function isEncumbranceWarningResolved(warning: string, template: WeaponTemplate): boolean {
  if (warning.includes("ammo encumbrance")) {
    return template.ammoEncumbranceFormula != null && template.ammoEncumbranceFormula.kind !== "unresolved";
  }

  if (warning.includes("encumbrance")) {
    return template.baseEncumbranceFormula != null && template.baseEncumbranceFormula.kind !== "unresolved";
  }

  return false;
}

function splitWarnings(
  warnings: string[] | null | undefined,
  template: WeaponTemplate,
): { resolvedWarnings: string[]; unresolvedWarnings: string[] } {
  const resolvedWarnings: string[] = [];
  const unresolvedWarnings: string[] = [];

  for (const warning of warnings ?? []) {
    const resolved =
      (warning.includes("DMB") && isDmbWarningResolved(warning, template)) ||
      (warning.includes("encumbrance") && isEncumbranceWarningResolved(warning, template));

    if (resolved) {
      resolvedWarnings.push(warning);
      continue;
    }

    unresolvedWarnings.push(warning);
  }

  return { resolvedWarnings, unresolvedWarnings };
}

export function applyThemistogenesWeaponFormulaNormalization(
  templates: WeaponTemplate[],
): WeaponTemplate[] {
  return templates.map((template) => {
    const { attackModes, normalizedFields } = normalizeAttackModes(template.attackModes);
    const baseEncumbranceFormula = parseEncumbranceFormula(
      template.sourceMetadata?.rawRow?.[template.sourceMetadata.sourceColumns.encumbrance],
    );
    const ammoEncumbranceFormula = parseEncumbranceFormula(template.ammoEncumbranceRaw);

    if (baseEncumbranceFormula && baseEncumbranceFormula.kind !== "numeric" && baseEncumbranceFormula.kind !== "unresolved") {
      normalizedFields.push(
        buildNormalizationEntry({
          fieldPath: "baseEncumbrance",
          kind: "encumbrance",
          raw: baseEncumbranceFormula.raw,
          normalizedAs: baseEncumbranceFormula.kind,
          note: baseEncumbranceFormula.note,
        }),
      );
    }

    if (ammoEncumbranceFormula && ammoEncumbranceFormula.kind !== "numeric" && ammoEncumbranceFormula.kind !== "unresolved") {
      normalizedFields.push(
        buildNormalizationEntry({
          fieldPath: "ammoEncumbrance",
          kind: "ammo_encumbrance",
          raw: ammoEncumbranceFormula.raw,
          normalizedAs: ammoEncumbranceFormula.kind,
          note: ammoEncumbranceFormula.note,
        }),
      );
    }

    const nextTemplate: WeaponTemplate = {
      ...template,
      attackModes,
      baseEncumbranceFormula:
        baseEncumbranceFormula && baseEncumbranceFormula.kind !== "numeric"
          ? baseEncumbranceFormula
          : null,
      ammoEncumbranceFormula:
        ammoEncumbranceFormula && ammoEncumbranceFormula.kind !== "numeric"
          ? ammoEncumbranceFormula
          : null,
    };
    const { resolvedWarnings, unresolvedWarnings } = splitWarnings(template.importWarnings, nextTemplate);

    const formulaNormalization: WeaponTemplateFormulaNormalization | null =
      normalizedFields.length > 0 || resolvedWarnings.length > 0 || unresolvedWarnings.length > 0
        ? {
            source: FORMULA_NORMALIZATION_SOURCE,
            normalizedFields: normalizedFields.length > 0 ? normalizedFields : null,
            resolvedImportWarnings: resolvedWarnings.length > 0 ? resolvedWarnings : null,
            unresolvedImportWarnings: unresolvedWarnings.length > 0 ? unresolvedWarnings : null,
            notes: null,
          }
        : null;

    return {
      ...nextTemplate,
      importWarnings: unresolvedWarnings.length > 0 ? unresolvedWarnings : null,
      formulaNormalization,
    };
  });
}

export function buildThemistogenesWeaponFormulaNormalizationReport(
  preNormalizedTemplates: WeaponTemplate[],
  normalizedTemplates: WeaponTemplate[],
): ThemistogenesWeaponFormulaNormalizationReport {
  const resolvedWarningCategories: Record<string, number> = {};
  const unresolvedWarningCategories: Record<string, number> = {};

  let rawWarningCount = 0;
  let resolvedWarningCount = 0;
  let unresolvedWarningCount = 0;
  let templatesWithFormulaNormalization = 0;

  for (let index = 0; index < normalizedTemplates.length; index += 1) {
    const preNormalized = preNormalizedTemplates[index];
    const normalized = normalizedTemplates[index];

    rawWarningCount += preNormalized.importWarnings?.length ?? 0;

    if (normalized.formulaNormalization?.normalizedFields?.length) {
      templatesWithFormulaNormalization += 1;
    }

    for (const warning of normalized.formulaNormalization?.resolvedImportWarnings ?? []) {
      resolvedWarningCount += 1;
      const category = resolveWarningCategory(warning);
      resolvedWarningCategories[category] = (resolvedWarningCategories[category] ?? 0) + 1;
    }

    for (const warning of normalized.importWarnings ?? []) {
      unresolvedWarningCount += 1;
      const category = resolveWarningCategory(warning);
      unresolvedWarningCategories[category] = (unresolvedWarningCategories[category] ?? 0) + 1;
    }
  }

  return {
    totalTemplates: normalizedTemplates.length,
    templatesWithFormulaNormalization,
    rawWarningCount,
    resolvedWarningCount,
    unresolvedWarningCount,
    resolvedWarningCategories,
    unresolvedWarningCategories,
  };
}
