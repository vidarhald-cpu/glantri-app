"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import type { Campaign } from "@glantri/domain";

import { loadCampaigns } from "../../../../src/lib/api/localServiceClient";
import {
  REMEMBERED_SELECTION_KEYS,
  useRememberedSelection,
} from "../../../../src/lib/browser/rememberedSelection";
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
      router.replace(
        buildCampaignWorkspaceHref({
          campaignId: rememberedCampaignId,
          tab: "campaign",
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
