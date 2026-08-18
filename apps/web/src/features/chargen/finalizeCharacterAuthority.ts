import type { AuthUser } from "@glantri/auth";
import type { CharacterBuild, CharacterRecord } from "@glantri/domain";

import type { LocalCharacterRecord } from "../../lib/offline/glantriDexie";
import type { SaveLocalCharacterInput } from "../../lib/offline/repositories/localCharacterRepository";

export async function persistAuthenticatedFinalizedCharacter(
  input: {
    build: CharacterBuild;
    currentUser: AuthUser;
  },
  dependencies: {
    saveCharacterToServer: (build: CharacterBuild) => Promise<CharacterRecord>;
    saveLocalCharacter: (input: SaveLocalCharacterInput) => Promise<LocalCharacterRecord>;
  },
): Promise<LocalCharacterRecord> {
  const serverRecord = await dependencies.saveCharacterToServer(input.build);

  return dependencies.saveLocalCharacter({
    build: serverRecord.build,
    createdAt: serverRecord.createdAt,
    creatorDisplayName: input.currentUser.displayName,
    creatorEmail: input.currentUser.email,
    creatorId: input.currentUser.id,
    finalizedAt: serverRecord.createdAt,
    serverUpdatedAt: serverRecord.updatedAt,
    syncStatus: "synced",
    updatedAt: serverRecord.updatedAt,
  });
}
