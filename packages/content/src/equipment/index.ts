export * from "./armorTemplates";
export * from "./weaponTemplates";
export * from "./shieldTemplates";
export * from "./systemLocations";

import { armorTemplates } from "./armorTemplates";
import { shieldTemplates } from "./shieldTemplates";
import { weaponTemplates } from "./weaponTemplates";

export const equipmentTemplates = [...weaponTemplates, ...shieldTemplates, ...armorTemplates];
export const equipmentTemplatesById = Object.fromEntries(
  equipmentTemplates.map((template) => [template.id, template])
);
