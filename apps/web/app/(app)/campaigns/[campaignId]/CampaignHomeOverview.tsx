import Link from "next/link";

import type { CampaignWorkspaceOverview } from "@glantri/domain";

import { buildCampaignWorkspaceHref } from "@/lib/campaigns/workspace";

const cardStyle = {
  border: "1px solid #d9ddd8",
  borderRadius: 12,
  display: "grid",
  gap: "0.65rem",
  padding: "1rem",
} as const;

function lifecycleLabel(status: string): string {
  if (status === "completed") return "Closed";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function CampaignHomeOverview({ overview }: { overview: CampaignWorkspaceOverview }) {
  const currentPcs = overview.roster.filter(
    (entry) =>
      entry.category === "pc" &&
      entry.sourceType === "character" &&
      (entry.membershipState ?? "current") === "current",
  );
  const formerPcs = overview.roster.filter(
    (entry) =>
      entry.category === "pc" &&
      entry.sourceType === "character" &&
      entry.membershipState === "former",
  );
  const prominentNpcs = overview.npcs.filter((npc) => npc.prominent);
  const historicalNpcs = overview.npcs.filter((npc) => npc.historical && !npc.prominent);

  return (
    <section aria-label="Campaign home" style={{ display: "grid", gap: "1rem" }}>
      <section style={{ ...cardStyle, background: "#f6f5ef" }}>
        <h2 style={{ margin: 0 }}>Current play</h2>
        {overview.currentContexts.length === 0 ? (
          <p style={{ margin: 0 }}>
            No active or paused Scenario. Draft preparation and Campaign history remain available.
          </p>
        ) : (
          <div
            style={{
              display: "grid",
              gap: "0.75rem",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))",
            }}
          >
            {overview.currentContexts.map((context) => (
              <article key={context.scenario.id} style={{ ...cardStyle, background: "white" }}>
                <div>
                  <strong>{context.scenario.name}</strong>
                  <div>{lifecycleLabel(context.scenario.status)}</div>
                </div>
                <Link
                  href={buildCampaignWorkspaceHref({
                    campaignId: overview.campaign.id,
                    scenarioId: context.scenario.id,
                    tab: "scenario",
                  })}
                >
                  Open Scenario
                </Link>
                {context.encounters.length === 0 ? (
                  <small>No active or paused Encounter.</small>
                ) : (
                  context.encounters.map((encounter) => (
                    <div key={encounter.id} style={{ display: "grid", gap: "0.2rem" }}>
                      <span>
                        {encounter.title} · {lifecycleLabel(encounter.status)}
                        {encounter.activeCombat ? " · Combat active" : ""}
                      </span>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
                        <Link
                          href={buildCampaignWorkspaceHref({
                            campaignId: overview.campaign.id,
                            encounterId: encounter.id,
                            scenarioId: context.scenario.id,
                            tab: "encounter",
                          })}
                        >
                          Open Encounter
                        </Link>
                        {encounter.activeCombat ? (
                          <Link
                            href={buildCampaignWorkspaceHref({
                              campaignId: overview.campaign.id,
                              encounterId: encounter.id,
                              scenarioId: context.scenario.id,
                              tab: "combat",
                            })}
                          >
                            Open Combat
                          </Link>
                        ) : null}
                      </div>
                    </div>
                  ))
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      <div
        style={{
          display: "grid",
          gap: "1rem",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
        }}
      >
        <section style={cardStyle}>
          <h2 style={{ margin: 0 }}>Party</h2>
          {currentPcs.length > 0 ? (
            <ul style={{ margin: 0, paddingLeft: "1.25rem" }}>
              {currentPcs.map((entry) => (
                <li key={entry.id}>{entry.labelSnapshot ?? "Campaign PC"}</li>
              ))}
            </ul>
          ) : (
            <p style={{ margin: 0 }}>No current PCs.</p>
          )}
          {formerPcs.length > 0 ? (
            <small>{formerPcs.length} former PC relationship(s).</small>
          ) : null}
        </section>

        <section style={cardStyle}>
          <h2 style={{ margin: 0 }}>Relevant NPCs</h2>
          {prominentNpcs.length > 0 ? (
            <ul style={{ margin: 0, paddingLeft: "1.25rem" }}>
              {prominentNpcs.map((npc) => (
                <li key={npc.id}>{npc.label}</li>
              ))}
            </ul>
          ) : (
            <p style={{ margin: 0 }}>No NPCs are currently marked as Campaign-relevant.</p>
          )}
          {historicalNpcs.length > 0 ? (
            <details>
              <summary>NPCs from Campaign history ({historicalNpcs.length})</summary>
              <ul>
                {historicalNpcs.map((npc) => (
                  <li key={npc.id}>{npc.label}</li>
                ))}
              </ul>
            </details>
          ) : null}
        </section>
      </div>

      <section style={cardStyle}>
        <h2 style={{ margin: 0 }}>Recent activity</h2>
        {overview.recentActivity.length === 0 ? (
          <p style={{ margin: 0 }}>No objective play activity has been recorded yet.</p>
        ) : (
          <ol style={{ display: "grid", gap: "0.5rem", margin: 0, paddingLeft: "1.25rem" }}>
            {overview.recentActivity.map((activity) => (
              <li key={activity.id}>
                <span>{activity.summary}</span>
                <div style={{ color: "#5e5a50", fontSize: "0.85rem" }}>
                  {activity.scenarioName}
                  {activity.encounterTitle ? ` · ${activity.encounterTitle}` : ""}
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </section>
  );
}
