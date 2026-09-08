// @vitest-environment happy-dom

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import AdminLayoutShell from "./AdminLayoutShell";

const mocks = vi.hoisted(() => ({ pathname: "/admin/skills/reference" }));

vi.mock("next/navigation", () => ({
  usePathname: () => mocks.pathname,
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("@/lib/admin/AdminContentContext", () => ({
  AdminContentProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="legacy-admin-content-provider">{children}</div>
  ),
}));

describe("AdminLayoutShell provider isolation", () => {
  beforeEach(() => {
    mocks.pathname = "/admin/skills/reference";
  });

  it("does not mount the legacy provider on direct Skill Reference navigation", () => {
    render(
      <AdminLayoutShell>
        <div>Reference route child</div>
      </AdminLayoutShell>,
    );

    expect(screen.getByText("Reference route child")).toBeVisible();
    expect(screen.queryByTestId("legacy-admin-content-provider")).toBeNull();
  });

  it("preserves the legacy provider for the Legacy Catalogue route", () => {
    mocks.pathname = "/admin/skills";
    render(
      <AdminLayoutShell>
        <div>Legacy route child</div>
      </AdminLayoutShell>,
    );

    expect(screen.getByTestId("legacy-admin-content-provider")).toContainElement(
      screen.getByText("Legacy route child"),
    );
  });
});
