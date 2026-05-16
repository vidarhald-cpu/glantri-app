import type { GearTemplate } from "@glantri/domain/equipment";

import rawGearTemplates from "../data/gearTemplates.json";

export const gearTemplates = rawGearTemplates as unknown as GearTemplate[];
export const gearTemplatesById = Object.fromEntries(
  gearTemplates.map((template) => [template.id, template]),
);
