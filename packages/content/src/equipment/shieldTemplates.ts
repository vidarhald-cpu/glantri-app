import type { ShieldTemplate } from "@glantri/domain/equipment";

import rawShieldTemplates from "../data/shieldTemplates.json";

export const shieldTemplates = rawShieldTemplates as unknown as ShieldTemplate[];
export const shieldTemplatesById = Object.fromEntries(
  shieldTemplates.map((template) => [template.id, template]),
);
