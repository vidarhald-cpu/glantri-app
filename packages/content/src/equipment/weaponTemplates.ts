import type { WeaponTemplate } from "@glantri/domain/equipment";

import { importedWeaponTemplates } from "./importedWeaponTemplates";
import { applyThemistogenesWeaponEnrichments } from "./themistogenesWeaponEnrichments";

export const weaponTemplates: WeaponTemplate[] = applyThemistogenesWeaponEnrichments(
  importedWeaponTemplates,
);

export const weaponTemplatesById = Object.fromEntries(
  weaponTemplates.map((template) => [template.id, template]),
);
