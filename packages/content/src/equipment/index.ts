export * from "./armorTemplates";
export * from "./gearTemplates";
export * from "./valuableTemplates";
export * from "./importedWeaponTemplates";
export * from "./themistogenesWeaponEnrichments";
export * from "./weaponTemplates";
export * from "./shieldTemplates";
export * from "./systemLocations";

import { armorTemplates } from "./armorTemplates";
import { gearTemplates } from "./gearTemplates";
import { shieldTemplates } from "./shieldTemplates";
import { valuableTemplates } from "./valuableTemplates";
import { weaponTemplates } from "./weaponTemplates";

export const equipmentTemplates = [
  ...weaponTemplates,
  ...shieldTemplates,
  ...armorTemplates,
  ...gearTemplates,
  ...valuableTemplates,
];
export const equipmentTemplatesById = Object.fromEntries(
  equipmentTemplates.map((template) => [template.id, template])
);
