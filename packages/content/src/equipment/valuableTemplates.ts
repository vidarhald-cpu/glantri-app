import type { ValuableTemplate } from "@glantri/domain/equipment";

import rawValuableTemplates from "../data/valuableTemplates.json";

export const valuableTemplates = rawValuableTemplates as unknown as ValuableTemplate[];
export const valuableTemplatesById = Object.fromEntries(
  valuableTemplates.map((template) => [template.id, template]),
);
