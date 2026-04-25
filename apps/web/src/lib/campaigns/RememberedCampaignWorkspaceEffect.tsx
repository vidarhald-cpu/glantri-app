"use client";

import { useEffect } from "react";

import {
  buildRememberedScopedSelectionKey,
  REMEMBERED_SELECTION_KEYS,
  writeRememberedSelection,
} from "../browser/rememberedSelection";
import type { CampaignWorkspaceTabId } from "./workspace";

interface RememberedCampaignWorkspaceEffectProps {
  campaignId: string;
  encounterId?: string | null;
  scenarioId?: string | null;
  tab: CampaignWorkspaceTabId;
}

function buildCampaignWorkspaceSelectionKeys(campaignId: string) {
  return {
    encounterId: buildRememberedScopedSelectionKey({
      baseKey: REMEMBERED_SELECTION_KEYS.encounterId,
      scopeParts: [campaignId],
    }),
    scenarioId: buildRememberedScopedSelectionKey({
      baseKey: REMEMBERED_SELECTION_KEYS.scenarioId,
      scopeParts: [campaignId],
    }),
    workspaceTab: buildRememberedScopedSelectionKey({
      baseKey: REMEMBERED_SELECTION_KEYS.workspaceTab,
      scopeParts: [campaignId],
    }),
  };
}

export function getCampaignWorkspaceSelectionKeys(campaignId: string) {
  return buildCampaignWorkspaceSelectionKeys(campaignId);
}

export default function RememberedCampaignWorkspaceEffect({
  campaignId,
  encounterId,
  scenarioId,
  tab,
}: RememberedCampaignWorkspaceEffectProps) {
  useEffect(() => {
    const keys = buildCampaignWorkspaceSelectionKeys(campaignId);

    writeRememberedSelection(REMEMBERED_SELECTION_KEYS.campaignId, campaignId);
    writeRememberedSelection(keys.scenarioId, scenarioId);
    writeRememberedSelection(keys.workspaceTab, tab);

    if (encounterId !== undefined) {
      writeRememberedSelection(keys.encounterId, encounterId);
    }
  }, [campaignId, encounterId, scenarioId, tab]);

  return null;
}
