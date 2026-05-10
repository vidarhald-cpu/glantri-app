import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_CHARGEN_RULE_SET } from "@glantri/domain";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() })
}));

vi.mock("@/lib/api/localServiceClient", () => ({
  getCurrentSessionUser: vi.fn().mockResolvedValue(null),
  loadActiveChargenRuleSet: vi.fn().mockResolvedValue(DEFAULT_CHARGEN_RULE_SET),
  saveCharacterToServer: vi.fn().mockResolvedValue({ id: "test-char-id" })
}));

vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false } as Response));

async function importWizard() {
  const mod = await import("./ChargenWizard");
  return mod.default;
}

describe("ChargenWizard component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
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
});
