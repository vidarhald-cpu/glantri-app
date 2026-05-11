import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { GlantriCharacteristicKey, RolledCharacterProfile } from "@glantri/domain";

import { ResolveStatsStep } from "./ResolveStatsStep";

const stats: Record<GlantriCharacteristicKey, number> = {
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
};

describe("ResolveStatsStep", () => {
  it("renders the stat exchange controls when a profile is selected", () => {
    render(
      <ResolveStatsStep
        buildDecreaseStat="dex"
        buildDisabled={false}
        buildIncreaseStat="str"
        buildLimit={2}
        exchangeDisabled={false}
        exchangeFirstStat="str"
        exchangeLimit={2}
        exchangeSecondStat="dex"
        onBuildDecreaseStatChange={vi.fn()}
        onBuildIncreaseStatChange={vi.fn()}
        onBuildStats={vi.fn()}
        onExchangeFirstStatChange={vi.fn()}
        onExchangeSecondStatChange={vi.fn()}
        onExchangeStats={vi.fn()}
        onResetStatAdjustments={vi.fn()}
        selectedAdjustment={{ buildsUsed: 0, exchangesUsed: 0, stats }}
        selectedProfile={{}}
        selectedResolvedStats={stats}
        selectedRolledProfile={{ id: "profile-1", label: "Profile 1", rolledStats: stats } as RolledCharacterProfile}
      />,
    );

    expect(screen.getByRole("button", { name: "Swap" })).toBeInTheDocument();
  });
});
