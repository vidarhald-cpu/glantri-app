import type { EquipmentTemplate } from "./types";

/** Only existing valuables and explicitly supported ammunition accept authored quantities. */
export function supportsEquipmentQuantity(template: EquipmentTemplate): boolean {
  return template.category === "valuables" || isSupportedAmmunitionTemplate(template);
}

export function isSupportedAmmunitionTemplate(template: EquipmentTemplate): boolean {
  const family = "ammunitionProfile" in template ? template.ammunitionProfile?.family : undefined;
  return family === "arrow" || family === "crossbow_bolt" || family === "sling_projectile";
}
