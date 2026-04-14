import type { EquipmentTemplate } from "@glantri/domain";

import {
  hasLoadoutThrownWeaponStats,
  isLoadoutMissileWeaponTemplate,
} from "./loadoutWeaponOptions";
import { getPlayerFacingEquipmentTemplateName } from "./playerFacingTemplateOptions";

export type InventoryTemplateFilter =
  | "all"
  | "weapons"
  | "missile"
  | "throwing"
  | "armor"
  | "gear"
  | "valuables";

export interface InventoryTemplateGroup {
  category: string;
  label: string;
  templates: EquipmentTemplate[];
}

export function filterInventoryTemplateOptions(
  templateOptions: EquipmentTemplate[],
  filter: InventoryTemplateFilter,
): EquipmentTemplate[] {
  switch (filter) {
    case "all":
      return templateOptions;
    case "weapons":
      return templateOptions.filter(
        (template) =>
          template.category === "weapon" &&
          !isLoadoutMissileWeaponTemplate(template) &&
          !hasLoadoutThrownWeaponStats(template),
      );
    case "missile":
      return templateOptions.filter((template) => isLoadoutMissileWeaponTemplate(template));
    case "throwing":
      return templateOptions.filter((template) => hasLoadoutThrownWeaponStats(template));
    case "armor":
      return templateOptions.filter((template) => template.category === "armor");
    case "gear":
      return templateOptions.filter((template) => template.category === "gear");
    case "valuables":
      return templateOptions.filter((template) => template.category === "valuables");
    default:
      return templateOptions;
  }
}

function getTemplateCategoryLabel(category: string): string {
  switch (category) {
    case "weapon":
      return "Weapons";
    case "shield":
      return "Shields";
    case "armor":
      return "Armor";
    case "gear":
      return "Gear";
    case "valuables":
      return "Valuables";
    default:
      return category;
  }
}

export function buildInventoryTemplateGroups(
  templateOptions: EquipmentTemplate[],
): InventoryTemplateGroup[] {
  const grouped = new Map<string, EquipmentTemplate[]>();

  for (const template of templateOptions) {
    const current = grouped.get(template.category) ?? [];
    current.push(template);
    grouped.set(template.category, current);
  }

  const weaponTemplates = grouped.get("weapon") ?? [];
  const missileWeaponTemplates = weaponTemplates.filter(
    (template) => template.category === "weapon" && template.handlingClass === "missile",
  );
  const meleeWeaponTemplates = weaponTemplates.filter(
    (template) => template.category === "weapon" && template.handlingClass !== "missile",
  );

  return [
    {
      category: "weapon",
      label: getTemplateCategoryLabel("weapon"),
      templates: meleeWeaponTemplates,
    },
    {
      category: "missile-weapon",
      label: "Missile weapons",
      templates: missileWeaponTemplates,
    },
    ...["shield", "armor", "gear", "valuables"].map((category) => ({
      category,
      label: getTemplateCategoryLabel(category),
      templates: grouped.get(category) ?? [],
    })),
  ]
    .map((group) => ({
      ...group,
      templates: [...group.templates].sort((left, right) =>
        getPlayerFacingEquipmentTemplateName(left).localeCompare(getPlayerFacingEquipmentTemplateName(right)),
      ),
    }))
    .filter((group) => group.templates.length > 0);
}
