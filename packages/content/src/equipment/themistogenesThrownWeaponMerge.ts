import type { WeaponAttackMode, WeaponTemplate } from "@glantri/domain/equipment";

const approvedThrownBaseTemplateByThrownTemplateId: Record<string, string> = {
  "weapon-template-t-knife": "weapon-template-knife",
  "weapon-template-t-dagger": "weapon-template-dagger",
  "weapon-template-t-hatchet": "weapon-template-hatchet",
  "weapon-template-t-wood-axe": "weapon-template-wood-axe",
  "weapon-template-t-hand-axe": "weapon-template-hand-axe",
  "weapon-template-t-javelin": "weapon-template-1-h-javelin",
  "weapon-template-t-spear": "weapon-template-spear",
};

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
    attackType: "thrown",
    allowsRepeatedRoundAttack: false,
    canonicalMeleeMode: null,
    id: "mode-3",
    isPrimaryAttack: false,
    initiative: template.initiative,
    order: 2,
    range: template.range,
    sourceMetadata: template.sourceMetadata,
    notes:
      [thrownMode.notes, buildMergedThrownModeNote(template)].filter(Boolean).join(" | ") || null,
  };
}

function getApprovedThrownBaseTemplateId(template: WeaponTemplate): string | null {
  if (template.sourceMetadata?.sheet !== "Weapon2") return null;
  return approvedThrownBaseTemplateByThrownTemplateId[template.id] ?? null;
}

export function mergeThemistogenesThrownWeaponTemplates(
  templates: WeaponTemplate[],
): WeaponTemplate[] {
  const baseTemplatesById = new Map(
    templates
      .filter((template) => template.sourceMetadata?.sheet === "Weapon1")
      .map((template) => [template.id, template] as const),
  );

  const thrownTemplatesByBaseId = new Map<string, WeaponTemplate>();
  for (const template of templates) {
    const baseId = getApprovedThrownBaseTemplateId(template);
    if (baseId && baseTemplatesById.has(baseId)) thrownTemplatesByBaseId.set(baseId, template);
  }

  return templates.flatMap((template) => {
    const baseId = getApprovedThrownBaseTemplateId(template);
    if (baseId && baseTemplatesById.has(baseId)) {
      return [];
    }

    const thrownTemplate = thrownTemplatesByBaseId.get(template.id);
    if (!thrownTemplate) {
      return [template];
    }

    const mergedMode = getMergedThrownMode(thrownTemplate);
    if (!mergedMode) {
      return [template];
    }

    const attackModes = [
      ...(template.attackModes ?? []).filter((mode) => mode.id !== "mode-3"),
      mergedMode,
    ];
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
