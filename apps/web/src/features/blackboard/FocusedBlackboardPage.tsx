"use client";

import { useRouter, useSearchParams } from "next/navigation";

import { BlackboardWorkspace } from "./BlackboardWorkspace";
import {
  buildCampaignBlackboardHref,
  buildFocusedBlackboardHref,
  readBlackboardInspectionRoute,
} from "./blackboardInspectionRoute";

interface FocusedBlackboardPageProps {
  campaignId: string;
}

export function FocusedBlackboardPage({ campaignId }: FocusedBlackboardPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const state = readBlackboardInspectionRoute(searchParams);
  const artifactInspection = searchParams.get("inspection") === "artifact";

  return (
    <BlackboardWorkspace
      artifactInspection={artifactInspection}
      campaignId={campaignId}
      isGameMaster={false}
      onExitArtifact={() => router.push(buildFocusedBlackboardHref(campaignId, state))}
      onExitFocused={() => router.push(buildCampaignBlackboardHref(campaignId, state))}
      onInspectArtifact={(entryId) =>
        router.push(buildFocusedBlackboardHref(campaignId, { ...state, entryId }, true))
      }
      onRouteChange={(next) => router.replace(buildFocusedBlackboardHref(campaignId, next))}
      presentation="focused"
      routeCategory={state.category}
      routeEntryId={state.entryId}
      routePinned={state.pinned}
      routeQuery={state.query}
    />
  );
}
