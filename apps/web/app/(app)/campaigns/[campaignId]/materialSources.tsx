"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";

import type { CampaignMapSummary, Scenario } from "@glantri/domain";
import type { CanonicalEquipmentItem } from "@glantri/domain/equipment";

import { ArtifactPanel } from "@/features/artifacts";
import { loadArtifacts, type ArtifactListResult } from "@/lib/api/artifactClient";
import { loadCampaignItems, type CampaignItemsResponse } from "@/lib/api/equipmentClient";
import { loadCampaignMap, loadCampaignMaps, type CampaignMapListResult } from "@/lib/api/mapClient";
import { buildCampaignScenarioHref, buildCampaignWorkspaceHref } from "@/lib/campaigns/workspace";

export type MaterialView = "all" | "scenario" | "unattached" | "shared-artifacts";

/** The list and Inspector consume this shape without knowing its source domains. */
export interface MaterialEntry {
  key: string;
  category: string;
  categoryLabel: string;
  title: string;
  description: string;
  searchText: string;
  scenarioIds: string[];
  facets: Record<string, string>;
  views: MaterialView[];
  renderInspector: () => ReactNode;
}

export interface MaterialSource {
  category: string;
  label: string;
  filters?: Array<{
    key: string;
    label: string;
    options: Array<{ value: string; label: string }>;
  }>;
  load: (context: MaterialSourceContext) => Promise<MaterialEntry[]>;
}

export interface MaterialSourceContext {
  campaignId: string;
  scenarios: Scenario[];
  onMaterialChanged: () => void;
}

function scenarioNames(scenarios: Scenario[], ids: string[]): string[] {
  return ids.map((id) => scenarios.find((scenario) => scenario.id === id)?.name ?? "Scenario");
}

function scenarioLinks(campaignId: string, scenarios: Scenario[], ids: string[]) {
  return ids.length ? (
    <ul>
      {ids.map((id) => (
        <li key={id}>
          <Link href={buildCampaignScenarioHref({ campaignId, scenarioId: id })}>
            {scenarios.find((scenario) => scenario.id === id)?.name ?? "Open Scenario"}
          </Link>
        </li>
      ))}
    </ul>
  ) : (
    <p>No recorded Scenario use.</p>
  );
}

/** The payload already carries fail-closed, resolved Artifact audience. */
export function artifactEntriesFromPayload(
  payload: ArtifactListResult,
  context: MaterialSourceContext,
): MaterialEntry[] {
  if (payload.mode !== "gm") throw new Error("Campaign Material is available to the GM only.");
  return payload.artifacts.map((artifact) => {
    const referenceIds = payload.references
      .filter(
        (reference) => reference.artifactId === artifact.id && reference.state !== "withdrawn",
      )
      .map((reference) => reference.scenarioId);
    const scenarioIds = [
      ...new Set([
        ...referenceIds,
        ...context.scenarios
          .filter(
            (scenario) =>
              scenario.mapAssetId === artifact.id ||
              scenario.liveState?.session.availableObjects.some(
                (object) =>
                  object.sourceKind === "campaign_asset" && object.sourceId === artifact.id,
              ),
          )
          .map((scenario) => scenario.id),
      ]),
    ];
    // Match the existing campaign-published Artifact query's readiness and lifecycle
    // gates. Audience itself is already resolved by the API and is only consumed here.
    const shared =
      artifact.audience === "campaign" &&
      artifact.storageState === "ready" &&
      artifact.lifecycle !== "deleted";
    return {
      key: `artifact:${artifact.id}`,
      category: "artifact",
      categoryLabel: "Artifact",
      title: artifact.title,
      description: artifact.description ?? "",
      searchText: [
        artifact.title,
        artifact.description,
        artifact.artifactKind,
        ...scenarioNames(context.scenarios, scenarioIds),
      ]
        .join(" ")
        .toLowerCase(),
      scenarioIds,
      facets: {
        artifactKind: artifact.artifactKind,
        artifactLifecycle: artifact.lifecycle,
        artifactAccess: artifact.audience,
      },
      views: [
        "all",
        ...(scenarioIds.length ? ["scenario" as const] : ["unattached" as const]),
        ...(shared ? ["shared-artifacts" as const] : []),
      ],
      renderInspector: () => (
        <>
          <p>
            {artifact.audience === "campaign" ? "Campaign access" : "GM only"} ·{" "}
            {artifact.artifactKind}
          </p>
          <h4>Where used</h4>
          {scenarioLinks(context.campaignId, context.scenarios, scenarioIds)}
          <ArtifactPanel
            campaignId={context.campaignId}
            focusedArtifactId={artifact.id}
            onChanged={context.onMaterialChanged}
            readOnlyAssociations
            scenarios={context.scenarios}
          />
        </>
      ),
    };
  });
}

function itemName(item: CanonicalEquipmentItem, payload: CampaignItemsResponse): string {
  return (
    item.displayName ||
    (item.templateId ? payload.state.templatesById[item.templateId]?.name : undefined) ||
    "Descriptive Item"
  );
}

export function itemEntriesFromPayload(
  payload: CampaignItemsResponse,
  context: MaterialSourceContext,
): MaterialEntry[] {
  const holderNames = new Map(
    payload.characters.map((character) => [character.id, character.name]),
  );
  return Object.values(payload.state.itemsById).map((item) => {
    const scenarioIds = context.scenarios
      .filter((scenario) =>
        scenario.liveState?.session.availableObjects.some(
          (object) => object.sourceKind === "campaign_item" && object.sourceId === item.id,
        ),
      )
      .map((scenario) => scenario.id);
    const title = itemName(item, payload);
    const holder = item.holderCharacterId
      ? (holderNames.get(item.holderCharacterId) ?? "Character")
      : undefined;
    return {
      key: `item:${item.id}`,
      category: "item",
      categoryLabel: "Item",
      title,
      description: item.notes ?? "",
      searchText: [
        title,
        item.notes,
        item.category,
        holder,
        ...scenarioNames(context.scenarios, scenarioIds),
      ]
        .join(" ")
        .toLowerCase(),
      scenarioIds,
      facets: {},
      views: [
        "all",
        ...(scenarioIds.length ? ["scenario" as const] : []),
        ...(!scenarioIds.length && !item.holderCharacterId ? ["unattached" as const] : []),
      ],
      renderInspector: () => (
        <>
          {item.notes ? <p>{item.notes}</p> : null}
          <p>{holder ? `Held by ${holder}` : "Unassigned in this Campaign"}</p>
          <h4>Where used</h4>
          {scenarioLinks(context.campaignId, context.scenarios, scenarioIds)}
          <Link
            href={`${buildCampaignWorkspaceHref({ campaignId: context.campaignId, tab: "items" })}&itemId=${encodeURIComponent(item.id)}`}
          >
            Open Item editor
          </Link>
        </>
      ),
    };
  });
}

function MapMaterialInspector({
  campaignId,
  map,
}: {
  campaignId: string;
  map: CampaignMapSummary;
}) {
  const [background, setBackground] = useState<{ title: string } | null>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    let active = true;
    void loadCampaignMap(campaignId, map.id)
      .then((result) => {
        if (active && result.mode === "gm") setBackground(result.map.background ?? null);
      })
      .catch((caught) => {
        if (active)
          setError(caught instanceof Error ? caught.message : "Map details are unavailable.");
      });
    return () => {
      active = false;
    };
  }, [campaignId, map.id]);

  return (
    <>
      {map.description ? <p>{map.description}</p> : null}
      <p>Map role: {map.role.replaceAll("_", " ")}</p>
      <h4>Artifact association</h4>
      {error ? (
        <p role="alert">{error}</p>
      ) : background === undefined ? (
        <p>Loading Map associations…</p>
      ) : background ? (
        <p>Background: {background.title}</p>
      ) : (
        <p>No background Artifact selected.</p>
      )}
      <p>Current Maps have no direct Scenario association in this workbench.</p>
      <Link href={buildCampaignWorkspaceHref({ campaignId, tab: "maps", mapId: map.id })}>
        Open Map editor
      </Link>
    </>
  );
}

export function mapEntriesFromPayload(
  payload: CampaignMapListResult,
  context: MaterialSourceContext,
): MaterialEntry[] {
  if (payload.mode !== "gm") throw new Error("Campaign Material is available to the GM only.");
  return payload.maps.map((map) => ({
    key: `map:${map.id}`,
    category: "map",
    categoryLabel: "Map",
    title: map.name,
    description: map.description,
    searchText: [map.name, map.description, map.role].join(" ").toLowerCase(),
    scenarioIds: [],
    facets: {},
    views: ["all", "unattached"],
    renderInspector: () => <MapMaterialInspector campaignId={context.campaignId} map={map} />,
  }));
}

/** A future canonical source only registers another adapter here. */
export const materialSources: MaterialSource[] = [
  {
    category: "artifact",
    label: "Artifacts",
    filters: [
      {
        key: "artifactKind",
        label: "Artifact kind",
        options: ["image", "map", "portrait", "document", "handout"].map((value) => ({
          value,
          label: value.charAt(0).toUpperCase() + value.slice(1),
        })),
      },
      {
        key: "artifactLifecycle",
        label: "Artifact lifecycle",
        options: [
          { value: "active", label: "Active" },
          { value: "archived", label: "Retired" },
        ],
      },
      {
        key: "artifactAccess",
        label: "Artifact access",
        options: [
          { value: "gm_private", label: "GM only" },
          { value: "campaign", label: "Shared with Campaign players" },
        ],
      },
    ],
    load: async (context) =>
      artifactEntriesFromPayload(await loadArtifacts(context.campaignId), context),
  },
  {
    category: "item",
    label: "Items",
    load: async (context) =>
      itemEntriesFromPayload(await loadCampaignItems(context.campaignId), context),
  },
  {
    category: "map",
    label: "Maps",
    load: async (context) =>
      mapEntriesFromPayload(await loadCampaignMaps(context.campaignId), context),
  },
];
