import type { WeaponAttackMode, WeaponTemplate } from "@glantri/domain/equipment";

function buildMergedThrownModeNote(template: WeaponTemplate): string {
  const parts = [
    `Workbook thrown mode from ${template.name}`,
    template.sourceMetadata?.sheet && template.sourceMetadata?.row
      ? `(${template.sourceMetadata.sheet} row ${template.sourceMetadata.row})`
      : null,
    template.range ? `range ${template.range}` : null,
    template.initiative != null ? `initiative ${template.initiative}` : null,
  ].filter((part): part is string => Boolean(part));

  return parts.join(", ");
}

function getMergedThrownMode(template: WeaponTemplate): WeaponAttackMode | null {
  const thrownMode = template.attackModes?.find((mode) => mode.id === "mode-1") ?? null;
  if (!thrownMode) {
    return null;
  }

  return {
    ...thrownMode,
    id: "mode-3",
    isPrimaryAttack: false,
    notes: [thrownMode.notes, buildMergedThrownModeNote(template)].filter(Boolean).join(" | ") || null,
  };
}

function getSafeThrownBaseName(template: WeaponTemplate, baseNames: Set<string>): string | null {
  if (
    template.sourceMetadata?.sheet !== "Weapon2" ||
    !template.name.startsWith("T. ")
  ) {
    return null;
  }

  const baseName = template.name.slice(3).trim();
  return baseNames.has(baseName) ? baseName : null;
}

export function mergeThemistogenesThrownWeaponTemplates(
  templates: WeaponTemplate[],
): WeaponTemplate[] {
  const baseTemplatesByName = new Map(
    templates
      .filter((template) => template.sourceMetadata?.sheet === "Weapon1")
      .map((template) => [template.name, template] as const),
  );
  const baseNames = new Set(baseTemplatesByName.keys());

  const thrownTemplatesByBaseName = new Map<string, WeaponTemplate>();
  for (const template of templates) {
    const baseName = getSafeThrownBaseName(template, baseNames);
    if (!baseName) {
      continue;
    }

    thrownTemplatesByBaseName.set(baseName, template);
  }

  return templates.flatMap((template) => {
    const baseName = getSafeThrownBaseName(template, baseNames);
    if (baseName) {
      return [];
    }

    const thrownTemplate = thrownTemplatesByBaseName.get(template.name);
    if (!thrownTemplate) {
      return [template];
    }

    const mergedMode = getMergedThrownMode(thrownTemplate);
    if (!mergedMode) {
      return [template];
    }

    const attackModes = [...(template.attackModes ?? []).filter((mode) => mode.id !== "mode-3"), mergedMode];
    const tags = Array.from(new Set([...template.tags, "thrown"]));
    const importWarnings = [
      ...(template.importWarnings ?? []),
      ...(thrownTemplate.importWarnings ?? []),
      `Merged ${thrownTemplate.name} into ${template.name} as thrown mode.`,
    ];

    return [
      {
        ...template,
        attackModes,
        tags,
        importWarnings,
      },
    ];
  });
}

