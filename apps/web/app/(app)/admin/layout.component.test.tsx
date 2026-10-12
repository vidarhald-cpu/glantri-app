// @vitest-environment happy-dom
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthRole } from "@glantri/auth";

import AdminLayout from "./layout";

const mocks = vi.hoisted(() => ({
  session: {
    currentUser: null as { id: string; roles: string[] } | null,
    loading: false,
  },
}));
vi.mock("@/lib/auth/SessionUserContext", () => ({ useSessionUser: () => mocks.session }));
// Isolate the authorization boundary: the shell mounts the admin content provider,
// so a sentinel proves whether the gate admitted the subtree at all.
vi.mock("./AdminLayoutShell", () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="admin-shell">{children}</div>
  ),
}));

function renderAdmin(roles: AuthRole[] | null) {
  mocks.session.currentUser = roles ? { id: `${roles.join("-")}-account`, roles } : null;
  return render(
    <AdminLayout>
      <div data-testid="admin-child">Admin surface</div>
    </AdminLayout>,
  );
}

beforeEach(() => {
  mocks.session.currentUser = null;
  mocks.session.loading = false;
});

describe("Admin route authorization boundary", () => {
  it.each([[["admin"]], [["game_master"]], [["player", "game_master"]]] as [AuthRole[]][])(
    "admits the admin subtree for %j",
    (roles) => {
      renderAdmin(roles);
      expect(screen.getByTestId("admin-shell")).toBeTruthy();
      expect(screen.getByTestId("admin-child")).toBeTruthy();
    },
  );

  it("denies a player-only account without mounting the admin subtree", () => {
    renderAdmin(["player"]);
    expect(screen.getByRole("heading", { name: "Admin access required" })).toBeVisible();
    expect(screen.queryByTestId("admin-shell")).toBeNull();
    expect(screen.queryByTestId("admin-child")).toBeNull();
  });

  it("asks an unauthenticated visitor to sign in without mounting the admin subtree", () => {
    renderAdmin(null);
    expect(screen.getByRole("heading", { name: "Login required" })).toBeVisible();
    expect(screen.queryByTestId("admin-shell")).toBeNull();
    expect(screen.queryByTestId("admin-child")).toBeNull();
  });

  it("withholds the admin subtree while the session is still loading", () => {
    mocks.session.loading = true;
    mocks.session.currentUser = null;
    render(
      <AdminLayout>
        <div data-testid="admin-child">Admin surface</div>
      </AdminLayout>,
    );
    expect(screen.queryByTestId("admin-shell")).toBeNull();
    expect(screen.queryByTestId("admin-child")).toBeNull();
  });
});
