import type { AuthUser } from "@glantri/auth";

import type { LocalCharacterRecord } from "../offline/glantriDexie";

export function canPresentRetainedLocalCharacter(input: {
  currentUser: AuthUser | null;
  hasServerAccess: boolean;
  record: LocalCharacterRecord;
}): boolean {
  if (!input.currentUser) {
    return false;
  }

  return input.hasServerAccess;
}
