import { type CanonicalContent } from "@glantri/content";
import { equipmentTemplates } from "@glantri/content/equipment";
import type { ArmorTemplate, GearTemplate, ShieldTemplate, ValuableTemplate, WeaponTemplate } from "@glantri/domain";

import {
  isCatalogMeleeWeaponTemplate,
  isCatalogMissileWeaponTemplate
} from "../../../features/equipment/weaponCatalogTables";

export interface AdminOverviewStats {
  accountCount?: number;
  armorCount: number;
  documentsCount?: number;
  gearCount: number;
  languageCount: number;
  languageCountLabel: string;
  meleeWeaponCount: number;
  missileWeaponCount: number;
  professionCount: number;
  societyCount: number;
  societyAccessRowCount: number;
  shieldCount: number;
  skillCount: number;
  skillGroupCount: number;
  tablesCount?: number;
  valuablesCount: number;
}

export function buildAdminOverviewStats(content: CanonicalContent): AdminOverviewStats {
  const meleeWeaponCount = equipmentTemplates.filter(
    (template): template is WeaponTemplate =>
      template.category === "weapon" && isCatalogMeleeWeaponTemplate(template)
  ).length;
  const missileWeaponCount = equipmentTemplates.filter(
    (template): template is WeaponTemplate =>
      template.category === "weapon" && isCatalogMissileWeaponTemplate(template)
  ).length;
  const shieldCount = equipmentTemplates.filter(
    (template): template is ShieldTemplate => template.category === "shield"
  ).length;
  const armorCount = equipmentTemplates.filter(
    (template): template is ArmorTemplate => template.category === "armor"
  ).length;
  const gearCount = equipmentTemplates.filter(
    (template): template is GearTemplate => template.category === "gear"
  ).length;
  const valuablesCount = equipmentTemplates.filter(
    (template): template is ValuableTemplate => template.category === "valuables"
  ).length;

  return {
    accountCount: undefined,
    armorCount,
    documentsCount: undefined,
    gearCount,
    languageCount: content.languages.length,
    languageCountLabel: "Baseline / provisional languages",
    meleeWeaponCount,
    missileWeaponCount,
    professionCount: content.professions.length,
    societyCount: content.societies.length,
    societyAccessRowCount: content.societyLevels.length,
    shieldCount,
    skillCount: content.skills.length,
    skillGroupCount: content.skillGroups.length,
    tablesCount: undefined,
    valuablesCount
  };
}
