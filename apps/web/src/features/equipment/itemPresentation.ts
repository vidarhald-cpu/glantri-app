import type {
  CanonicalEquipmentItem,
  EquipmentTemplate,
  ItemFactVisibility,
} from "@glantri/domain/equipment";

export interface ItemPresentationEntry {
  detail?: string;
  label: string;
  visibility: ItemFactVisibility;
}

export interface ItemPresentationSection {
  entries: ItemPresentationEntry[];
  id: "template_differences" | "active_mechanics" | "descriptive_traits" | "unsupported";
  title: string;
}

function words(value: string): string {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function signed(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

export function buildItemPresentationSections(
  item: Pick<CanonicalEquipmentItem, "id"> & { itemFacts?: CanonicalEquipmentItem["itemFacts"] },
  template: EquipmentTemplate,
): ItemPresentationSection[] {
  if (!item.itemFacts) return [];
  const initiative = item.itemFacts.templateOverrides[0];
  const standardInitiative = template.category === "weapon" ? template.initiative : undefined;

  return [
    {
      entries:
        initiative && typeof standardInitiative === "number"
          ? [
              {
                label: `Initiative ${initiative.value} (standard ${standardInitiative})`,
                visibility: initiative.visibility,
              },
            ]
          : [],
      id: "template_differences",
      title: "Differences from standard",
    },
    {
      entries: item.itemFacts.activeMechanics.map((fact) => ({
        detail: "Applied at final attack OB for all attack modes.",
        label: `Final attack OB ${signed(fact.value)}`,
        visibility: fact.visibility,
      })),
      id: "active_mechanics",
      title: "Active mechanics",
    },
    {
      entries: item.itemFacts.descriptiveTraits.map((fact) => ({
        detail: fact.text,
        label: words(fact.category),
        visibility: fact.visibility,
      })),
      id: "descriptive_traits",
      title: "Descriptive traits",
    },
    {
      entries: item.itemFacts.unsupportedCapabilities.map((fact) => ({
        detail: [fact.rulesText, fact.usageText].filter(Boolean).join(" · "),
        label: fact.name,
        visibility: fact.visibility,
      })),
      id: "unsupported",
      title: "Recorded capabilities — not calculated or tracked by the app",
    },
  ].filter((section) => section.entries.length > 0) as ItemPresentationSection[];
}
