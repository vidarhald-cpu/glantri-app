"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type { PlayerCampaignHomeRecord } from "@glantri/domain";

import { loadPlayerCampaignHome } from "@/lib/api/campaignClient";
import {
  buildPlayerCampaignResumeHref,
  getPlayerCampaignResumeLabel,
} from "@/lib/campaigns/workspace";

export type PlayerCampaignHomeState =
  | { status: "loading" }
  | { status: "unavailable" }
  | { record: PlayerCampaignHomeRecord | undefined; status: "ready" };

/**
 * Loads the player's own Campaign Home record for one Campaign, so the Campaign
 * landing can carry the former Campaign Home page's *Your character*, *Current
 * scenario* and `Continue ...` content (#849). It reads the same
 * `/campaigns/player-home` projection that page read and invents no data of its
 * own. It is requested only while `enabled`, which the shell sets for a player
 * on the Campaign landing.
 */
export function usePlayerCampaignHome(input: {
  campaignId: string;
  enabled: boolean;
}): PlayerCampaignHomeState {
  const { campaignId, enabled } = input;
  const [state, setState] = useState<PlayerCampaignHomeState>({ status: "loading" });

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let cancelled = false;
    setState({ status: "loading" });

    loadPlayerCampaignHome()
      .then((records) => {
        if (!cancelled) {
          setState({
            record: records.find((record) => record.campaign.id === campaignId),
            status: "ready",
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setState({ status: "unavailable" });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [campaignId, enabled]);

  return state;
}

export interface PlayerScenarioContext {
  characters: string[];
  /** The Encounter the server names as current, whatever its status. */
  encounterTitle?: string;
}

/** Scenario id to the Characters played there and the current Encounter, from the Campaign Home record. */
export function buildPlayerScenarioContext(
  state: PlayerCampaignHomeState,
): Record<string, PlayerScenarioContext> {
  if (state.status !== "ready" || !state.record) {
    return {};
  }

  return Object.fromEntries(
    state.record.scenarios.map(({ characters, encounter, scenario }) => [
      scenario.id,
      {
        characters: characters.map((character) => character.name),
        encounterTitle: encounter?.title,
      },
    ]),
  );
}

/**
 * The folded Campaign Home content that is not already a Scenario card: the
 * player's own Character(s) and the one resume action. The Scenario listing
 * itself stays in `CurrentScenarioContextPanel`, so the landing carries one
 * Scenario list rather than two.
 */
export function PlayerCampaignHomeSummary({ state }: { state: PlayerCampaignHomeState }) {
  if (state.status === "loading") {
    return null;
  }

  if (state.status === "unavailable") {
    return (
      <div role="status">
        Your Characters and the way back into play could not be loaded. Reload the page to try
        again.
      </div>
    );
  }

  const record = state.record;
  if (!record) {
    return null;
  }

  const characterLabel = record.characters.length === 1 ? "Your character" : "Your characters";
  const showResume = record.resume.tab !== "campaign";

  return (
    <section aria-label="Your play" style={{ display: "grid", gap: "0.75rem" }}>
      <div>
        <strong>{characterLabel}</strong>
        <div>
          {record.characters.length > 0
            ? record.characters.map((character) => character.name).join(", ")
            : "No controlled character is currently available."}
        </div>
      </div>
      {showResume ? (
        <div>
          <Link
            href={buildPlayerCampaignResumeHref(record)}
            style={{
              background: "#2f5d62",
              borderRadius: 8,
              color: "white",
              display: "inline-block",
              fontWeight: 700,
              padding: "0.7rem 1rem",
              textDecoration: "none",
            }}
          >
            {getPlayerCampaignResumeLabel(record)}
          </Link>
        </div>
      ) : null}
    </section>
  );
}
