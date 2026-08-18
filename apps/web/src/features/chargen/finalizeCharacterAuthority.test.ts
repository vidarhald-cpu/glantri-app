import { describe, expect, it, vi } from "vitest";

import type { AuthUser } from "@glantri/auth";
import type { CharacterBuild, CharacterRecord } from "@glantri/domain";

import { persistAuthenticatedFinalizedCharacter } from "./finalizeCharacterAuthority";

describe("persistAuthenticatedFinalizedCharacter", () => {
  const currentUser: AuthUser = {
    email: "owner@example.com",
    id: "owner-1",
    roles: ["player"],
  };
  const build = { id: "character-1", name: "Changed draft" } as CharacterBuild;

  it("waits for canonical server confirmation before saving local finalization", async () => {
    const serverRecord = {
      build,
      createdAt: "2026-08-13T08:00:00.000Z",
      id: build.id,
      level: 1,
      name: build.name,
      ownerId: currentUser.id,
      updatedAt: "2026-08-13T08:01:00.000Z",
    } as CharacterRecord;
    const saveCharacterToServer = vi.fn().mockResolvedValue(serverRecord);
    const saveLocalCharacter = vi.fn().mockImplementation(async (input) => ({
      ...input,
      createdAt: input.createdAt,
      finalizedAt: input.finalizedAt,
      id: input.build.id,
    }));

    await persistAuthenticatedFinalizedCharacter(
      { build, currentUser },
      { saveCharacterToServer, saveLocalCharacter },
    );

    expect(saveCharacterToServer).toHaveBeenCalledWith(build);
    expect(saveLocalCharacter).toHaveBeenCalledWith(
      expect.objectContaining({
        build,
        creatorId: currentUser.id,
        serverUpdatedAt: serverRecord.updatedAt,
        syncStatus: "synced",
      }),
    );
    expect(saveCharacterToServer.mock.invocationCallOrder[0]).toBeLessThan(
      saveLocalCharacter.mock.invocationCallOrder[0],
    );
  });

  it("preserves the chargen draft path when the server reports a divergent collision", async () => {
    const conflict = new Error("A finalized character already exists with this id.");
    const saveCharacterToServer = vi.fn().mockRejectedValue(conflict);
    const saveLocalCharacter = vi.fn();

    await expect(
      persistAuthenticatedFinalizedCharacter(
        { build, currentUser },
        { saveCharacterToServer, saveLocalCharacter },
      ),
    ).rejects.toBe(conflict);
    expect(saveLocalCharacter).not.toHaveBeenCalled();
  });
});
