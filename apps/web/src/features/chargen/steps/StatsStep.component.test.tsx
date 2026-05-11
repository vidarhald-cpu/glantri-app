import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

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
});
