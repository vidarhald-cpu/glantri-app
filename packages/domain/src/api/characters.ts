import type { CharacterBuild } from "../character/build";
import type { CharacterRevisionSnapshotReference } from "../character/retainedCharacter";

export interface CharacterRecord {
  build: CharacterBuild;
  createdAt: string;
  id: string;
  level: number;
  name: string;
  owner?: {
    displayName?: string | null;
    email: string;
    id: string;
  } | null;
  ownerId?: string | null;
  retainedRevision?: CharacterRevisionSnapshotReference | null;
  updatedAt: string;
}
