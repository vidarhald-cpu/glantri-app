import type { ArmorTemplate } from "@glantri/domain/equipment";

import rawArmorTemplates from "../data/armorTemplates.json";

export const armorTemplates = rawArmorTemplates as unknown as ArmorTemplate[];
export const armorTemplatesById = Object.fromEntries(
  armorTemplates.map((template) => [template.id, template]),
);
