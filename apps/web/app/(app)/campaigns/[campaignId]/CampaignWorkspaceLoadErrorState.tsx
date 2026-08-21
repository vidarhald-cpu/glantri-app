import { CAMPAIGN_WORKSPACE_LOAD_ERROR_MESSAGE } from "@/lib/campaigns/campaignWorkspaceLoading";

interface CampaignWorkspaceLoadErrorStateProps {
  onRetry: () => void;
  retrying: boolean;
}

const panelStyle = {
  border: "1px solid #d9ddd8",
  borderRadius: 12,
  display: "grid",
  gap: "0.75rem",
  padding: "1rem",
} as const;

export default function CampaignWorkspaceLoadErrorState({
  onRetry,
  retrying,
}: CampaignWorkspaceLoadErrorStateProps) {
  return (
    <section aria-live="polite" style={panelStyle}>
      <strong>Campaign could not be loaded</strong>
      <div>{CAMPAIGN_WORKSPACE_LOAD_ERROR_MESSAGE}</div>
      <div>
        <button disabled={retrying} onClick={onRetry} type="button">
          {retrying ? "Trying again…" : "Try again"}
        </button>
      </div>
    </section>
  );
}
