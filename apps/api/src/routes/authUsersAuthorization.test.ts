import { AuthService } from "@glantri/database";
import type { AuthRole } from "@glantri/auth";
import { afterEach, describe, expect, it, vi } from "vitest";

import { buildApiServer } from "../app";

// Substitute only session storage and the account listing: exercise the actual
// Admin/GM gate on GET /auth/users without creating or accessing a database.
describe("Account listing Admin/GM boundary", () => {
  afterEach(() => vi.restoreAllMocks());

  const accounts = [
    {
      id: "player-account",
      email: "player@test.local",
      displayName: "Player account",
      roles: ["player"] as AuthRole[],
    },
    {
      id: "gm-account",
      email: "gm@test.local",
      displayName: "GM account",
      roles: ["game_master"] as AuthRole[],
    },
  ];

  it.each([null, ["player"], ["game_master"], ["admin"], ["player", "game_master"]] as (
    | AuthRole[]
    | null
  )[])("lists accounts only for an Admin or GM session (%j)", async (roles) => {
    const session = vi.spyOn(AuthService.prototype, "getCurrentUserForToken").mockResolvedValue(
      roles
        ? {
            id: "users-test",
            email: "users@test.local",
            displayName: "Users test",
            roles,
          }
        : null,
    );
    const listing = vi.spyOn(AuthService.prototype, "listUsers").mockResolvedValue(accounts);
    const app = buildApiServer();

    try {
      const response = await app.inject({
        method: "GET",
        url: "/auth/users",
        headers: roles ? { cookie: "glantri_session=synthetic-users-session" } : {},
      });

      const allowed = roles?.includes("admin") || roles?.includes("game_master");

      if (allowed) {
        expect(response.statusCode).toBe(200);
        expect(listing).toHaveBeenCalledOnce();
        expect(response.json().users).toEqual(accounts);
      } else {
        expect(response.statusCode).toBe(roles ? 403 : 401);
        expect(response.json()).toEqual({
          error: roles ? "Admin or GM role required." : "Authentication required.",
        });
        // No account data may reach a player-only or anonymous caller.
        expect(listing).not.toHaveBeenCalled();
        expect(response.body).not.toMatch(/player@test\.local|gm@test\.local|displayName/);
      }

      expect(session).toHaveBeenCalledTimes(roles ? 1 : 0);
    } finally {
      await app.close();
    }
  });
});
