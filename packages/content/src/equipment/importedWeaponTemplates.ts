import type { WeaponTemplate } from "@glantri/domain/equipment";

import rawWeaponTemplates from "../data/weaponTemplates.json";

export const importedWeaponTemplates = rawWeaponTemplates as unknown as WeaponTemplate[];
export const importedWeaponTemplatesById = Object.fromEntries(
  importedWeaponTemplates.map((template) => [template.id, template]),
);
