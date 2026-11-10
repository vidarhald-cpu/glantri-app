// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const client = vi.hoisted(() => ({
  bootstrapGameMasterRole: vi.fn(),
  getBootstrapGameMasterAvailability: vi.fn(),
  getCurrentSessionUser: vi.fn(),
  loginLocalUser: vi.fn(),
  registerLocalUser: vi.fn(),
}));

vi.mock("@/lib/api/authClient", () => client);
vi.mock("@/lib/auth/SessionUserContext", () => ({
  useSessionUser: () => ({ currentUser: null, setCurrentUser: vi.fn(), signOut: vi.fn() }),
}));

import AuthPage from "./page";

describe("auth page registration (#1112)", () => {
  beforeEach(() => {
    client.getCurrentSessionUser.mockResolvedValue(null);
    client.getBootstrapGameMasterAvailability.mockResolvedValue(false);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("shows the password rule and constrains the inputs", async () => {
    render(<AuthPage />);

    expect(await screen.findByText("Use at least 8 characters.")).toBeTruthy();
    const password = screen.getByLabelText(/Password/) as HTMLInputElement;
    expect(password.minLength).toBe(8);
    expect((screen.getByLabelText(/Email/) as HTMLInputElement).type).toBe("email");
  });

  it("shows the API validation message on a failed registration", async () => {
    client.registerLocalUser.mockRejectedValueOnce(
      new Error("Password must be at least 8 characters."),
    );
    render(<AuthPage />);

    fireEvent.click(await screen.findByRole("button", { name: "Register" }));

    await waitFor(() =>
      expect(screen.getByText("Password must be at least 8 characters.")).toBeTruthy(),
    );
  });
});
