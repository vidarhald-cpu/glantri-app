import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { RolledCharacterProfile } from "@glantri/domain";
import type { RolledProfileSummary } from "@glantri/rules-engine";

import { StatsStep } from "./StatsStep";

const profile = {
  distractionLevel: 2,
  id: "profile-1",
  label: "Profile 1",
  rolledStats: {
    cha: 10,
    com: 10,
    con: 10,
    dex: 10,
    health: 10,
    int: 10,
    lck: 10,
    pow: 10,
    siz: 10,
    str: 10,
    will: 10,
  },
  socialClassRoll: 42,
} as RolledCharacterProfile;

const summary = {
  characteristics: [{ key: "str", label: "Str", value: 10 }],
  distractionLevel: 2,
  totalCharacteristicSum: 110,
} as RolledProfileSummary;

afterEach(cleanup);

/* The collapsed section is what a first arrival at step 1 now shows (#577). */
function renderStep(overrides: Partial<Parameters<typeof StatsStep>[0]> = {}) {
  const props = {
    formatProfileSocialBand: () => "2",
    onExpandStats: vi.fn(),
    onProfileSelect: vi.fn(),
    onToggleStats: vi.fn(),
    selectedProfileId: undefined,
    selectedRolledProfile: undefined,
    selectedRolledProfileSummary: undefined,
    showRolledProfileOptions: false,
    sortedRolledProfiles: [{ profile, summary }],
    ...overrides,
  } as Parameters<typeof StatsStep>[0];
  return { props, ...render(<StatsStep {...props} />) };
}

describe("StatsStep", () => {
  it("renders rolled profile choices and reports selection", async () => {
    const onProfileSelect = vi.fn();
    const user = userEvent.setup();

    render(
      <StatsStep
        formatProfileSocialBand={() => "2"}
        onExpandStats={vi.fn()}
        onProfileSelect={onProfileSelect}
        onToggleStats={vi.fn()}
        selectedProfileId={undefined}
        selectedRolledProfile={undefined}
        selectedRolledProfileSummary={undefined}
        showRolledProfileOptions
        sortedRolledProfiles={[{ profile, summary }]}
      />,
    );

    await user.click(screen.getByRole("radio"));

    expect(onProfileSelect).toHaveBeenCalledWith("profile-1");
  });

  it("collapses to a placeholder and a discoverable expand control when nothing is selected", () => {
    renderStep();

    expect(screen.getByText("Expand stats to review the rolled profiles.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Expand stats" })).toBeInTheDocument();
    /* Nothing from the chooser is rendered, which is the whole point of the collapsed arrival. */
    expect(screen.queryByRole("radio")).toBeNull();
  });

  it("reveals the unchanged chooser when expanded, and selects nothing by itself", async () => {
    const onToggleStats = vi.fn();
    const user = userEvent.setup();
    renderStep({ onToggleStats });

    await user.click(screen.getByRole("button", { name: "Expand stats" }));
    expect(onToggleStats).toHaveBeenCalledTimes(1);

    cleanup();
    renderStep({ showRolledProfileOptions: true });

    expect(screen.getByRole("button", { name: "Collapse stats" })).toBeInTheDocument();
    expect(screen.getByRole("radio")).not.toBeChecked();
    expect(screen.queryByText("Expand stats to review the rolled profiles.")).toBeNull();
  });

  it("names the selected profile in the collapsed state", () => {
    renderStep({
      selectedProfileId: profile.id,
      selectedRolledProfile: profile,
      selectedRolledProfileSummary: summary,
    });

    expect(screen.getByText("Profile 1")).toBeInTheDocument();
    expect(screen.getByText("Total 110")).toBeInTheDocument();
    expect(screen.queryByText("Expand stats to review the rolled profiles.")).toBeNull();
    expect(screen.queryByRole("radio")).toBeNull();
  });
});
