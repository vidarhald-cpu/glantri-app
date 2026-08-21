import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CAMPAIGN_WORKSPACE_LOAD_ERROR_MESSAGE } from "@/lib/campaigns/campaignWorkspaceLoading";

import CampaignWorkspaceLoadErrorState from "./CampaignWorkspaceLoadErrorState";

describe("CampaignWorkspaceLoadErrorState", () => {
  it("shows one recoverable load error without access-denial or internal diagnostics", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();

    render(<CampaignWorkspaceLoadErrorState onRetry={onRetry} retrying={false} />);

    expect(screen.getByText("Campaign could not be loaded")).toBeVisible();
    expect(screen.getByText(CAMPAIGN_WORKSPACE_LOAD_ERROR_MESSAGE)).toBeVisible();
    expect(screen.queryByText(/Campaign unavailable|not accessible/i)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/prisma|database|scenarioRepository|findMany|constraint|stack/i),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("prevents duplicate retries while a reload is in progress", () => {
    render(<CampaignWorkspaceLoadErrorState onRetry={vi.fn()} retrying />);

    expect(screen.getByRole("button", { name: "Trying again…" })).toBeDisabled();
  });
});
