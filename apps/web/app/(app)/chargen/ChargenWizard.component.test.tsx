import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_CHARGEN_RULE_SET } from "@glantri/domain";
import { createChargenProgression, generateProfiles } from "@glantri/rules-engine";
import { localDb } from "@/lib/offline/glantriDexie";
import { getCurrentSessionUser } from "@/lib/api/localServiceClient";
import { ChargenSessionRepository } from "@/lib/offline/repositories/chargenSessionRepository";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));

vi.mock("@/lib/api/localServiceClient", () => ({
  getCurrentSessionUser: vi.fn().mockResolvedValue({
    email: "combined@example.test",
    id: "combined-player-gm",
    roles: ["player", "game_master"],
  }),
  loadActiveChargenRuleSet: vi.fn().mockResolvedValue(DEFAULT_CHARGEN_RULE_SET),
  saveCharacterToServer: vi.fn().mockResolvedValue({ id: "test-char-id" }),
}));

vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false } as Response));

async function importWizard() {
  const mod = await import("./ChargenWizard");
  return mod.default;
}

let testAccountIndex = 0;
let currentTestAccountId = "";

describe("ChargenWizard component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    testAccountIndex += 1;
    currentTestAccountId = `combined-player-gm-${testAccountIndex}`;
    vi.mocked(getCurrentSessionUser).mockResolvedValue({
      email: `combined-${testAccountIndex}@example.test`,
      id: currentTestAccountId,
      roles: ["player", "game_master"],
    });
  });

  afterEach(async () => {
    cleanup();
    await localDb.chargenSessions.clear();
  });

  it("renders the entry button and starts chargen on click", async () => {
    const ChargenWizard = await importWizard();
    const user = userEvent.setup();

    render(<ChargenWizard />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Roll all dice" })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Roll all dice" }));

    await waitFor(() => {
      expect(screen.getByText("1. Stats")).toBeInTheDocument();
    });
  }, 15_000);

  it("shows multiple rolled profile cards after starting chargen", async () => {
    const ChargenWizard = await importWizard();
    const user = userEvent.setup();

    render(<ChargenWizard />);

    await waitFor(() => screen.getByRole("button", { name: "Roll all dice" }));
    await user.click(screen.getByRole("button", { name: "Roll all dice" }));

    await waitFor(() => {
      const profileCards = screen.getAllByRole("radio");
      expect(profileCards.length).toBeGreaterThan(1);
    });
  }, 15_000);

  it("selects a profile and unlocks the stat adjustment panel", async () => {
    const ChargenWizard = await importWizard();
    const user = userEvent.setup();

    render(<ChargenWizard />);

    await waitFor(() => screen.getByRole("button", { name: "Roll all dice" }));
    await user.click(screen.getByRole("button", { name: "Roll all dice" }));

    await waitFor(() => {
      expect(screen.getAllByRole("radio").length).toBeGreaterThan(0);
    });

    expect(screen.queryByText("Swap")).toBeNull();

    const firstProfile = screen.getAllByRole("radio")[0]!;
    await user.click(firstProfile);

    await waitFor(() => {
      expect(screen.getByText("Swap")).toBeInTheDocument();
    });
  }, 15_000);

  it("waits for an explicit Resume and restores the saved profile", async () => {
    const profiles = generateProfiles({ ruleSet: DEFAULT_CHARGEN_RULE_SET });
    await new ChargenSessionRepository().save({
      characterName: "Resume me",
      ownerId: currentTestAccountId,
      progression: createChargenProgression(),
      rolledProfiles: profiles,
      selectedProfile: profiles[0],
    });
    const ChargenWizard = await importWizard();
    const user = userEvent.setup();

    render(<ChargenWizard />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Resume saved Character" })).toBeInTheDocument();
    });
    expect(screen.queryByText("1. Stats")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Resume saved Character" }));

    await waitFor(() => {
      expect(screen.getByText("1. Stats")).toBeInTheDocument();
      expect(
        screen.getAllByRole("radio").some((radio) => (radio as HTMLInputElement).checked),
      ).toBe(true);
    });
  }, 15_000);

  it("keeps a historical draft readable and requires confirmation before starting new", async () => {
    await new ChargenSessionRepository().save({
      characterName: "Historical synthetic draft",
      ownerId: currentTestAccountId,
      progression: createChargenProgression(),
      selectedProfessionId: "profession:historical-only",
    });
    const ChargenWizard = await importWizard();
    const user = userEvent.setup();

    render(<ChargenWizard />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Historical Chargen draft" })).toBeInTheDocument();
    });
    expect(screen.getAllByText("Historical synthetic draft")).not.toHaveLength(0);

    await user.click(screen.getByRole("button", { name: "Create new Character" }));
    expect(screen.queryByText("1. Stats")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Replace draft and roll" }));

    await waitFor(() => {
      expect(screen.getByText("1. Stats")).toBeInTheDocument();
    });
  }, 15_000);
});
