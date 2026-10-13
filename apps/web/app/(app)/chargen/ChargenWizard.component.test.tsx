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

/**
 * Reveal the collapsed Stats chooser (Forgejo #577).
 *
 * Step 1 arrives collapsed, so the rolled-profile radios exist only once the player expands the
 * section. This is navigation the player now performs; it changes nothing these cases assert.
 */
async function expandStats(user: ReturnType<typeof userEvent.setup>) {
  /* A collapsed Stats section with a profile already restored carries both the header toggle and
     the summary card's own `Expand stats` control, and either one opens it. */
  await waitFor(() => {
    expect(screen.getAllByRole("button", { name: "Expand stats" }).length).toBeGreaterThan(0);
  });
  await user.click(screen.getAllByRole("button", { name: "Expand stats" })[0]!);
}

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
      expect(screen.getByRole("heading", { name: "1. Stats" })).toBeInTheDocument();
    });
  }, 15_000);

  it("shows multiple rolled profile cards after starting chargen", async () => {
    const ChargenWizard = await importWizard();
    const user = userEvent.setup();

    render(<ChargenWizard />);

    await waitFor(() => screen.getByRole("button", { name: "Roll all dice" }));
    await user.click(screen.getByRole("button", { name: "Roll all dice" }));
    await expandStats(user);

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
    await expandStats(user);

    await waitFor(() => {
      expect(screen.getAllByRole("radio").length).toBeGreaterThan(0);
    });

    // Only the active step is rendered, so the stat adjustment panel on step 2 has to be opened.
    await user.click(screen.getByRole("button", { name: "2. Resolve stats" }));
    expect(screen.queryByText("Swap")).toBeNull();

    await user.click(screen.getByRole("button", { name: "1. Stats" }));
    const firstProfile = screen.getAllByRole("radio")[0]!;
    await user.click(firstProfile);
    await user.click(screen.getByRole("button", { name: "2. Resolve stats" }));

    await waitFor(() => {
      expect(screen.getByText("Swap")).toBeInTheDocument();
    });
  }, 15_000);

  it("renders only the active step and keeps entered values across step navigation", async () => {
    const ChargenWizard = await importWizard();
    const user = userEvent.setup();

    render(<ChargenWizard />);

    await waitFor(() => screen.getByRole("button", { name: "Roll all dice" }));
    await user.click(screen.getByRole("button", { name: "Roll all dice" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "1. Stats" })).toBeInTheDocument();
    });
    // Only the active step is mounted: no later step heading is in the document.
    expect(screen.queryByRole("heading", { name: "2. Resolve stats" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "11. Finalize character" }),
    ).not.toBeInTheDocument();

    await expandStats(user);
    await waitFor(() => {
      expect(screen.getAllByRole("radio").length).toBeGreaterThan(0);
    });
    const firstProfile = screen.getAllByRole("radio")[0]! as HTMLInputElement;
    const selectedProfileLabel =
      firstProfile.closest("label")?.querySelector("strong")?.textContent ?? "";
    expect(selectedProfileLabel).not.toBe("");
    await user.click(firstProfile);
    // Selecting a profile collapses the option list into the selected-profile card.
    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: "Expand stats" }).length).toBeGreaterThan(0);
    });

    // Enter a value on the last step, navigate to the first step, and come back.
    await user.click(screen.getByRole("button", { name: "11. Finalize character" }));
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "11. Finalize character" })).toBeInTheDocument();
    });
    expect(screen.queryByRole("heading", { name: "1. Stats" })).not.toBeInTheDocument();

    const nameField = screen.getByLabelText("Character name");
    await user.type(nameField, "Navigation survivor");
    expect((nameField as HTMLInputElement).value).toBe("Navigation survivor");

    await user.click(screen.getByRole("button", { name: "1. Stats" }));
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "1. Stats" })).toBeInTheDocument();
    });
    // The rolled profile selected before navigating is still selected.
    expect(screen.getAllByRole("button", { name: "Expand stats" }).length).toBeGreaterThan(0);
    expect(screen.getAllByText(selectedProfileLabel).length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: "11. Finalize character" }));
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "11. Finalize character" })).toBeInTheDocument();
    });
    // The typed name survived leaving and re-entering the step.
    expect((screen.getByLabelText("Character name") as HTMLInputElement).value).toBe(
      "Navigation survivor",
    );
  }, 20_000);

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
    expect(screen.queryByRole("heading", { name: "1. Stats" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Resume saved Character" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "1. Stats" })).toBeInTheDocument();
    });
    /* The restored profile is named by the collapsed section before anything is expanded. */
    expect(screen.getAllByText(profiles[0]!.label).length).toBeGreaterThan(0);
    await expandStats(user);

    await waitFor(() => {
      expect(
        screen.getAllByRole("radio").some((radio) => (radio as HTMLInputElement).checked),
      ).toBe(true);
    });
  }, 15_000);

  /**
   * The collapsed first arrival (Forgejo #577).
   *
   * Steps 1, 3 and 5 each arrive collapsed with no selection, behind an always-visible expand
   * control, and expanding chooses nothing. This is the wizard-level proof that the three chooser
   * flags start closed and that no step auto-selects on the player's behalf.
   */
  it("arrives at each chooser step collapsed, with a discoverable expand control", async () => {
    const ChargenWizard = await importWizard();
    const user = userEvent.setup();

    render(<ChargenWizard />);

    await waitFor(() => screen.getByRole("button", { name: "Roll all dice" }));
    await user.click(screen.getByRole("button", { name: "Roll all dice" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "1. Stats" })).toBeInTheDocument();
    });
    expect(screen.getByText("Expand stats to review the rolled profiles.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Expand stats" })).toBeInTheDocument();
    expect(screen.queryAllByRole("radio")).toHaveLength(0);

    /* Expanding reveals the chooser and selects nothing. */
    await user.click(screen.getByRole("button", { name: "Expand stats" }));
    await waitFor(() => {
      expect(screen.getAllByRole("radio").length).toBeGreaterThan(1);
    });
    expect(screen.getAllByRole("radio").some((radio) => (radio as HTMLInputElement).checked)).toBe(
      false,
    );
    expect(screen.getByRole("button", { name: "Collapse stats" })).toBeInTheDocument();
    await user.click(screen.getAllByRole("radio")[0]!);

    await user.click(screen.getByRole("button", { name: "3. Choose civilization" }));
    await waitFor(() => {
      expect(
        screen.getByText("Expand civilization to review the available civilizations."),
      ).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "Expand civilization" })).toBeInTheDocument();
    expect(screen.queryAllByRole("radio")).toHaveLength(0);

    await user.click(screen.getByRole("button", { name: "Expand civilization" }));
    await waitFor(() => {
      expect(screen.getAllByRole("radio").length).toBeGreaterThan(0);
    });
    expect(screen.getAllByRole("radio").some((radio) => (radio as HTMLInputElement).checked)).toBe(
      false,
    );
    const civilization = screen.getAllByRole("radio")[0]! as HTMLInputElement;
    const civilizationName =
      civilization.closest("label")?.querySelector("strong")?.textContent ?? "";
    expect(civilizationName).not.toBe("");
    await user.click(civilization);
    /* The collapsed civilization section names the choice. */
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Change civilization" })).toBeInTheDocument();
    });
    expect(screen.getAllByText(civilizationName).length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: "5. Choose profession" }));
    await waitFor(() => {
      expect(
        screen.getByText("Expand profession to review the available professions."),
      ).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "Expand profession" })).toBeInTheDocument();
    expect(screen.queryAllByRole("radio")).toHaveLength(0);
    /* The chooser's own controls are collapsed with it, and come back unchanged. */
    expect(screen.queryByLabelText("Search professions")).toBeNull();
    expect(screen.queryByLabelText("Kind of work")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Expand profession" }));
    await waitFor(() => {
      expect(screen.getByLabelText("Search professions")).toBeInTheDocument();
    });
    expect(screen.getByLabelText("Kind of work")).toBeInTheDocument();
    expect(screen.getAllByRole("radio").length).toBeGreaterThan(1);
    expect(screen.getAllByRole("radio").some((radio) => (radio as HTMLInputElement).checked)).toBe(
      false,
    );
  }, 30_000);

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
    expect(screen.queryByRole("heading", { name: "1. Stats" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Replace draft and roll" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "1. Stats" })).toBeInTheDocument();
    });
  }, 15_000);
});
