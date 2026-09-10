import { AuthService } from "@glantri/database";
import type { AuthRole } from "@glantri/auth";
import { afterEach, describe, expect, it, vi } from "vitest";

import { buildApiServer } from "../app";
import { CanonicalContentService } from "../lib/adminContentService";

// Substitute only session storage: exercise the actual strict Admin gate and
// reference route without creating or accessing a database.
describe("Skill Reference strict Admin payload boundary", () => {
  afterEach(() => vi.restoreAllMocks());

  it.each([null, ["player"], ["game_master"], ["admin"]] as (AuthRole[] | null)[])(
    "projects reference metadata only for an Admin session (%j)",
    async (roles) => {
      const session = vi.spyOn(AuthService.prototype, "getCurrentUserForToken").mockResolvedValue(
        roles
          ? {
              id: "reference-test",
              email: "reference@test.local",
              displayName: "Reference test",
              roles,
            }
          : null,
      );
      const projection = vi.spyOn(CanonicalContentService.prototype, "getSkillReference");
      const app = buildApiServer();
      try {
        const response = await app.inject({
          method: "GET",
          url: "/api/admin/content/reference",
          headers: roles ? { cookie: "glantri_session=synthetic-reference-session" } : {},
        });
        if (roles?.includes("admin")) {
          expect(response.statusCode).toBe(200);
          expect(projection).toHaveBeenCalledOnce();
          expect(response.json().candidate.status).toBe("proposal");
          expect(response.json().candidate.referenceMetadata.schemaVersion).toBe(
            "skill-reference-metadata/v1",
          );
          expect(response.json().canonical).toBeNull();
        } else {
          expect(response.statusCode).toBe(roles ? 403 : 401);
          expect(response.json()).toEqual({
            error: roles ? "Admin role required." : "Authentication required.",
          });
          expect(projection).not.toHaveBeenCalled();
          expect(response.body).not.toMatch(
            /referenceMetadata|archSkills|learningHistories|professionReferences|competencies|packageDigest/,
          );
        }
        expect(session).toHaveBeenCalledTimes(roles ? 1 : 0);
      } finally {
        await app.close();
      }
    },
  );
});
