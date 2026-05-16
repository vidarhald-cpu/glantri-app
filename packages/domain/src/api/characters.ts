import type { CharacterBuild } from "../character/build";

export interface CharacterRecord {
  build: CharacterBuild;
  createdAt: string;
  id: string;
  level: number;
  name: string;
  owner?:
    | {
        displayName?: string | null;
        email: string;
        id: string;
      }
    | null;
  ownerId?: string | null;
  updatedAt: string;
}
