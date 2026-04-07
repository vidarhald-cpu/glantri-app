export * from "./armorTemplates";
export * from "./gearTemplates";
export * from "./weaponTemplates";
export * from "./shieldTemplates";
export * from "./systemLocations";

import { armorTemplates } from "./armorTemplates";
import { gearTemplates } from "./gearTemplates";
import { shieldTemplates } from "./shieldTemplates";
import { weaponTemplates } from "./weaponTemplates";

export const equipmentTemplates = [
  ...weaponTemplates,
  ...shieldTemplates,
  ...armorTemplates,
  ...gearTemplates,
];
export const equipmentTemplatesById = Object.fromEntries(
  equipmentTemplates.map((template) => [template.id, template])
);
