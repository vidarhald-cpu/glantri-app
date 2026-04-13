import type { EquipmentTemplate } from "@glantri/domain";

const legacyShieldTemplateIds = new Set([
  "shield-template-buckler",
  "shield-template-round-shield",
]);

const legacyArmorTemplateIds = new Set(["armor-template-mail-hauberk"]);

function isHiddenThrownTemplateArtifact(template: EquipmentTemplate): boolean {
  if (template.category !== "weapon") {
    return false;
  }

  if (template.name.startsWith("T. ")) {
    return true;
  }

  return (
    template.id.startsWith("weapon-template-t-") &&
    template.sourceMetadata?.sheet === "Weapon2"
  );
}

export function shouldShowInEquipmentLocationDropdown(
  template: EquipmentTemplate,
): boolean {
  if (isHiddenThrownTemplateArtifact(template)) {
    return false;
  }

  if (template.category === "shield") {
    return !legacyShieldTemplateIds.has(template.id);
  }

  if (template.category === "armor") {
    return !legacyArmorTemplateIds.has(template.id);
  }

  return true;
}

export function getPlayerFacingEquipmentLocationTemplateOptions(
  templatesById: Record<string, EquipmentTemplate>,
): EquipmentTemplate[] {
  return Object.values(templatesById)
    .filter(shouldShowInEquipmentLocationDropdown)
    .sort((left, right) => left.name.localeCompare(right.name));
}
