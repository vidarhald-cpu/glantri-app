"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import type { PlayerCampaignHomeRecord } from "@glantri/domain";

import { loadPlayerCampaignHome } from "@/lib/api/campaignClient";
import { useSessionUser } from "@/lib/auth/SessionUserContext";
import {
  REMEMBERED_SELECTION_KEYS,
  useRememberedSelection,
} from "@/lib/browser/rememberedSelection";
import {
  canManageCampaignWorkspace,
  resolvePlayerCampaignResumeDestination,
} from "@/lib/campaigns/access";

export default function CampaignsResumePageContent() {
  const router = useRouter();
  const { currentUser, loading: sessionLoading } = useSessionUser();
  const restoreAttemptedRef = useRef(false);
  const [campaigns, setCampaigns] = useState<PlayerCampaignHomeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const rememberedCampaignSelection = useRememberedSelection(REMEMBERED_SELECTION_KEYS.campaignId);

  useEffect(() => {
    if (sessionLoading) {
      return;
    }

    if (!currentUser || canManageCampaignWorkspace(currentUser)) {
      setCampaigns([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    loadPlayerCampaignHome()
      .then((records) => {
        if (!cancelled) {
          setCampaigns(records);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCampaigns([]);
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

    if (!currentUser || canManageCampaignWorkspace(currentUser)) {
      router.replace("/campaigns");
      return;
    }

    const rememberedCampaignId = rememberedCampaignSelection.value;
    const destination = resolvePlayerCampaignResumeDestination({
      campaigns,
      rememberedCampaignId,
    });

    if (destination.clearRememberedCampaign) {
      rememberedCampaignSelection.setValue(undefined);
    }

    router.replace(destination.href);
  }, [campaigns, currentUser, loading, rememberedCampaignSelection, router, sessionLoading]);

  return <section>Opening campaigns...</section>;
}
