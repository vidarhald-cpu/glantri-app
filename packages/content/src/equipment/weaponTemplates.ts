import type { WeaponTemplate } from "@glantri/domain/equipment";

import { importedWeaponTemplates } from "./importedWeaponTemplates";
import { applyThemistogenesWeaponEnrichments } from "./themistogenesWeaponEnrichments";
import { applyThemistogenesWeaponFormulaNormalization } from "./themistogenesWeaponFormulaNormalization";
import { mergeThemistogenesThrownWeaponTemplates } from "./themistogenesThrownWeaponMerge";

export const weaponTemplates: WeaponTemplate[] = applyThemistogenesWeaponFormulaNormalization(
  mergeThemistogenesThrownWeaponTemplates(
    applyThemistogenesWeaponEnrichments(importedWeaponTemplates),
  ),
);

export const weaponTemplatesById = Object.fromEntries(
  weaponTemplates.map((template) => [template.id, template]),
);
