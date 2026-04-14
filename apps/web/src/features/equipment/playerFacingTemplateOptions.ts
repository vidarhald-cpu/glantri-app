import type { EquipmentTemplate } from "@glantri/domain";

const legacyShieldTemplateIds = new Set([
  "shield-template-buckler",
  "shield-template-round-shield",
]);

const legacyArmorTemplateIds = new Set(["armor-template-mail-hauberk"]);
const allowedStandaloneThrownTemplateIds = new Set(["weapon-template-t-th-dagger"]);

export function getPlayerFacingEquipmentTemplateName(template: EquipmentTemplate): string {
  if (template.id === "weapon-template-t-th-dagger") {
    return "Throwing dagger";
  }

  return template.name;
}

function isHiddenThrownTemplateArtifact(template: EquipmentTemplate): boolean {
  if (template.category !== "weapon") {
    return false;
  }

  if (allowedStandaloneThrownTemplateIds.has(template.id)) {
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
    .sort((left, right) =>
      getPlayerFacingEquipmentTemplateName(left).localeCompare(getPlayerFacingEquipmentTemplateName(right)),
    );
}
