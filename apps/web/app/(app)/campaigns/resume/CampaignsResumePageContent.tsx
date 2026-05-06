"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import type { AccessibleCampaignRecord } from "../../../../src/lib/api/localServiceClient";
import { useSessionUser } from "../../../../src/lib/auth/SessionUserContext";
import {
  REMEMBERED_SELECTION_KEYS,
  readRememberedSelection,
  useRememberedSelection,
} from "../../../../src/lib/browser/rememberedSelection";
import {
  loadCampaignBrowserRecordsForUser,
  resolveCampaignResumeDestination,
} from "../../../../src/lib/campaigns/access";
import {
  getCampaignWorkspaceSelectionKeys,
  getPlayerEncounterParticipantSelectionKey,
} from "../../../../src/lib/campaigns/RememberedCampaignWorkspaceEffect";

export default function CampaignsResumePageContent() {
  const router = useRouter();
  const { currentUser, loading: sessionLoading } = useSessionUser();
  const restoreAttemptedRef = useRef(false);
  const [campaigns, setCampaigns] = useState<AccessibleCampaignRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const rememberedCampaignSelection = useRememberedSelection(
    REMEMBERED_SELECTION_KEYS.campaignId,
  );

  useEffect(() => {
    if (sessionLoading) {
      return;
    }

    let cancelled = false;

    loadCampaignBrowserRecordsForUser(currentUser)
      .then((records) => {
        if (!cancelled) {
          setCampaigns(records);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [currentUser, sessionLoading]);

  useEffect(() => {
    if (
      sessionLoading ||
      loading ||
      !rememberedCampaignSelection.hydrated ||
      restoreAttemptedRef.current
    ) {
      return;
    }

    restoreAttemptedRef.current = true;

    const rememberedCampaignId = rememberedCampaignSelection.value;

    const workspaceSelectionKeys = rememberedCampaignId
      ? getCampaignWorkspaceSelectionKeys(rememberedCampaignId)
      : null;
    const rememberedScenarioId = workspaceSelectionKeys
      ? readRememberedSelection(workspaceSelectionKeys.scenarioId)
      : undefined;
    const rememberedEncounterId = workspaceSelectionKeys
      ? readRememberedSelection(workspaceSelectionKeys.encounterId)
      : undefined;
    const rememberedTab = workspaceSelectionKeys
      ? readRememberedSelection(workspaceSelectionKeys.workspaceTab)
      : undefined;
    const rememberedParticipantId =
      rememberedCampaignId && rememberedScenarioId
        ? readRememberedSelection(
            getPlayerEncounterParticipantSelectionKey({
              campaignId: rememberedCampaignId,
              scenarioId: rememberedScenarioId,
            }),
          )
        : undefined;

    const destination = resolveCampaignResumeDestination({
      accessibleCampaigns: campaigns,
      rememberedCampaignId,
      rememberedEncounterId,
      rememberedParticipantId,
      rememberedScenarioId,
      rememberedTab,
    });

    if (destination.clearRememberedCampaign) {
      rememberedCampaignSelection.setValue(undefined);
    }

    router.replace(destination.href);
  }, [campaigns, currentUser, loading, rememberedCampaignSelection, router, sessionLoading]);

  return <section>Opening campaigns...</section>;
}
