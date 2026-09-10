import type { BlackboardCategory } from "@glantri/domain";

export interface BlackboardInspectionRouteState {
  category?: BlackboardCategory;
  entryId?: string;
  pinned?: "pinned" | "unpinned";
  query: string;
}

const categories: BlackboardCategory[] = ["clue_fact", "document_text", "image_map", "recap"];

export function readBlackboardInspectionRoute(
  searchParams: Pick<URLSearchParams, "get">,
): BlackboardInspectionRouteState {
  const category = searchParams.get("blackboardCategory");
  const pinned = searchParams.get("blackboardPinned");
  return {
    category: categories.includes(category as BlackboardCategory)
      ? (category as BlackboardCategory)
      : undefined,
    entryId: searchParams.get("entryId") ?? undefined,
    pinned: pinned === "pinned" || pinned === "unpinned" ? pinned : undefined,
    query: searchParams.get("blackboardQuery")?.trim() ?? "",
  };
}

function appendBlackboardState(
  searchParams: URLSearchParams,
  state: BlackboardInspectionRouteState,
): void {
  if (state.entryId) searchParams.set("entryId", state.entryId);
  if (state.query) searchParams.set("blackboardQuery", state.query);
  if (state.category) searchParams.set("blackboardCategory", state.category);
  if (state.pinned) searchParams.set("blackboardPinned", state.pinned);
}

export function buildFocusedBlackboardHref(
  campaignId: string,
  state: BlackboardInspectionRouteState,
  inspectArtifact = false,
): string {
  const searchParams = new URLSearchParams();
  appendBlackboardState(searchParams, state);
  if (inspectArtifact && state.entryId) searchParams.set("inspection", "artifact");
  const query = searchParams.toString();
  return `/campaigns/${encodeURIComponent(campaignId)}/blackboard${query ? `?${query}` : ""}`;
}

export function buildCampaignBlackboardHref(
  campaignId: string,
  state: BlackboardInspectionRouteState,
): string {
  const searchParams = new URLSearchParams({ tab: "blackboard" });
  appendBlackboardState(searchParams, state);
  return `/campaigns/${encodeURIComponent(campaignId)}?${searchParams.toString()}`;
}
