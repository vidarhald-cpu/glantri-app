"use client";

import Link from "next/link";

import {
  campaignNoteAssociationKey,
  type CampaignNoteReference,
  type CampaignNoteReferenceType,
} from "@glantri/domain";

import {
  buildCampaignEncounterHref,
  buildCampaignScenarioHref,
  buildCampaignTaskHref,
} from "@/lib/campaigns/workspace";

/** Association groups in the order a GM usually reaches for them. */
export const campaignNoteAssociationGroups: Array<{
  type: CampaignNoteReferenceType;
  plural: string;
  singular: string;
}> = [
  { plural: "Scenarios", singular: "Scenario", type: "scenario" },
  { plural: "Encounters", singular: "Encounter", type: "encounter" },
  { plural: "PCs", singular: "PC", type: "character" },
  { plural: "NPCs", singular: "NPC", type: "npc" },
  { plural: "Artifacts", singular: "Artifact", type: "artifact" },
  { plural: "Campaign", singular: "Campaign", type: "campaign" },
];

const singularByType = new Map(
  [...campaignNoteAssociationGroups, { plural: "Tags", singular: "Tag", type: "tag" as const }].map(
    (group) => [group.type, group.singular],
  ),
);

export function campaignNoteAssociationTypeLabel(type: CampaignNoteReferenceType): string {
  return singularByType.get(type) ?? type;
}

/**
 * The canonical home of an associated object. The Campaign index references domain
 * objects; it never duplicates them, so every association leads back to the object's
 * own screen wherever one exists.
 */
export function campaignNoteAssociationHref(input: {
  association: CampaignNoteReference;
  campaignId: string;
}): string | undefined {
  const { association, campaignId } = input;
  switch (association.type) {
    case "scenario":
      return buildCampaignScenarioHref({ campaignId, scenarioId: association.id });
    case "encounter":
      return association.scenarioId
        ? buildCampaignEncounterHref({
            campaignId,
            encounterId: association.id,
            scenarioId: association.scenarioId,
          })
        : undefined;
    case "character":
      return `/characters/${encodeURIComponent(association.id)}`;
    case "npc":
      return buildCampaignTaskHref({ campaignId, section: "membership" });
    case "artifact":
      return "#campaign-artifacts";
    case "campaign":
      return buildCampaignTaskHref({ campaignId, section: "overview" });
    default:
      return undefined;
  }
}

const chipStyle = {
  background: "#eef1ec",
  border: "1px solid #d9ddd8",
  borderRadius: 999,
  display: "inline-flex",
  fontSize: "0.8125rem",
  gap: "0.35rem",
  lineHeight: 1.4,
  maxWidth: "100%",
  padding: "0.15rem 0.6rem",
} as const;

/**
 * Compact association chips. Object associations link to their canonical home; a
 * custom tag filters the Notes list instead, because a tag has no separate home.
 */
export function CampaignNoteAssociationChips({
  associations,
  campaignId,
  onSelectTag,
}: {
  associations: CampaignNoteReference[];
  campaignId: string;
  onSelectTag?: (tagId: string) => void;
}) {
  if (associations.length === 0) {
    return <small style={{ color: "#5d635c" }}>No associations</small>;
  }

  return (
    <ul
      aria-label="Note associations"
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "0.35rem",
        listStyle: "none",
        margin: 0,
        padding: 0,
      }}
    >
      {associations.map((association) => {
        const typeLabel = campaignNoteAssociationTypeLabel(association.type);
        const href = campaignNoteAssociationHref({ association, campaignId });
        return (
          <li key={campaignNoteAssociationKey(association)} style={{ maxWidth: "100%" }}>
            {association.type === "tag" ? (
              onSelectTag ? (
                <button
                  onClick={() => onSelectTag(association.id)}
                  style={{ ...chipStyle, cursor: "pointer" }}
                  title={`Show only Notes tagged ${association.label}`}
                  type="button"
                >
                  #{association.label}
                </button>
              ) : (
                <span style={chipStyle}>#{association.label}</span>
              )
            ) : href ? (
              <Link
                href={href}
                style={{ ...chipStyle, textDecoration: "none" }}
                title={`Open ${typeLabel}: ${association.label}`}
              >
                <span style={{ color: "#5d635c" }}>{typeLabel}</span>
                <span>{association.label}</span>
              </Link>
            ) : (
              <span style={chipStyle} title={`${typeLabel}: ${association.label}`}>
                <span style={{ color: "#5d635c" }}>{typeLabel}</span>
                <span>{association.label}</span>
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
