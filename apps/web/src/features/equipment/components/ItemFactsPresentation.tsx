import type { CanonicalEquipmentItem, EquipmentTemplate } from "@glantri/domain/equipment";

import { buildItemPresentationSections } from "../itemPresentation";

export function ItemFactsPresentation({
  item,
  showVisibility = false,
  template,
}: {
  item: Pick<CanonicalEquipmentItem, "id"> & {
    itemFacts?: CanonicalEquipmentItem["itemFacts"];
    mechanicalOverrides?: CanonicalEquipmentItem["mechanicalOverrides"];
  };
  showVisibility?: boolean;
  template?: EquipmentTemplate;
}) {
  const sections = buildItemPresentationSections(item, template);
  if (sections.length === 0) return null;

  return (
    <div style={{ display: "grid", gap: "0.75rem" }}>
      {sections.map((section) => (
        <section
          key={section.id}
          style={{
            borderLeft: "3px solid #8ea5a0",
            display: "grid",
            gap: "0.4rem",
            paddingLeft: "0.75rem",
          }}
        >
          <strong>{section.title}</strong>
          {section.entries.map((entry, index) => (
            <div key={`${entry.label}:${index}`} style={{ display: "grid", gap: "0.15rem" }}>
              <span>
                {entry.label}
                {showVisibility ? (
                  <small style={{ color: "#5e5a50", marginLeft: "0.5rem" }}>
                    {entry.visibility === "revealed" ? "Revealed to holder" : "GM only"}
                  </small>
                ) : null}
              </span>
              {entry.detail ? <small style={{ color: "#5e5a50" }}>{entry.detail}</small> : null}
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
