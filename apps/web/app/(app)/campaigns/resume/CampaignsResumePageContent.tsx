"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import type { Campaign } from "@glantri/domain";

import { loadCampaigns } from "../../../../src/lib/api/localServiceClient";
import {
  REMEMBERED_SELECTION_KEYS,
  readRememberedSelection,
  useRememberedSelection,
} from "../../../../src/lib/browser/rememberedSelection";
import {
  getCampaignWorkspaceSelectionKeys,
  getPlayerEncounterParticipantSelectionKey,
} from "../../../../src/lib/campaigns/RememberedCampaignWorkspaceEffect";
import { buildCampaignWorkspaceHref } from "../../../../src/lib/campaigns/workspace";

export default function CampaignsResumePageContent() {
  const router = useRouter();
  const restoreAttemptedRef = useRef(false);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const rememberedCampaignSelection = useRememberedSelection(
    REMEMBERED_SELECTION_KEYS.campaignId,
  );

  useEffect(() => {
    let cancelled = false;

    loadCampaigns()
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
  }, []);

  useEffect(() => {
    if (loading || !rememberedCampaignSelection.hydrated || restoreAttemptedRef.current) {
      return;
    }

    restoreAttemptedRef.current = true;

    const rememberedCampaignId = rememberedCampaignSelection.value;

    if (rememberedCampaignId && campaigns.some((campaign) => campaign.id === rememberedCampaignId)) {
      const workspaceSelectionKeys = getCampaignWorkspaceSelectionKeys(rememberedCampaignId);
      const rememberedScenarioId = readRememberedSelection(workspaceSelectionKeys.scenarioId);
      const rememberedEncounterId = readRememberedSelection(workspaceSelectionKeys.encounterId);
      const rememberedTab = readRememberedSelection(workspaceSelectionKeys.workspaceTab);
      const rememberedParticipantId = rememberedScenarioId
        ? readRememberedSelection(
            getPlayerEncounterParticipantSelectionKey({
              campaignId: rememberedCampaignId,
              scenarioId: rememberedScenarioId,
            }),
          )
        : undefined;

      router.replace(
        buildCampaignWorkspaceHref({
          campaignId: rememberedCampaignId,
          encounterId: rememberedEncounterId,
          participantId:
            rememberedTab === "player-encounter" ? rememberedParticipantId : undefined,
          scenarioId: rememberedScenarioId,
          tab:
            rememberedTab === "campaign" ||
            rememberedTab === "scenario" ||
            rememberedTab === "gm-encounter" ||
            rememberedTab === "player-encounter"
              ? rememberedTab
              : "campaign",
        }),
      );
      return;
    }

    if (rememberedCampaignId) {
      rememberedCampaignSelection.setValue(undefined);
    }

    router.replace("/campaigns");
  }, [campaigns, loading, rememberedCampaignSelection, router]);

  return <section>Opening campaigns...</section>;
}
