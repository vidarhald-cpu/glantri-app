import type { CharacterBuild } from "../character/build";
import type { CharacterRevisionSnapshotReference } from "../character/retainedCharacter";

/**
 * Marks a Character whose stored catalogue snapshot no longer matches the live catalogue
 * mechanically (Forgejo #764).
 *
 * The list endpoint fails soft per Character: a Character that does not validate is still
 * returned and still carries its reasons, so the invalid state stays visible and reported
 * rather than being silently swallowed, and one bad Character no longer denies the owner
 * the whole list. Absent or null means the snapshot validated.
 *
 * This is a read-time observation only. Nothing refreshes, rewrites or self-heals the
 * persisted snapshot.
 */
export interface CharacterSnapshotIntegrityMark {
  reasons: readonly string[];
  status: "snapshot-mismatch";
}

export interface CharacterRecord {
  build: CharacterBuild;
  createdAt: string;
  id: string;
  level: number;
  name: string;
  snapshotIntegrity?: CharacterSnapshotIntegrityMark | null;
  owner?: {
    displayName?: string | null;
    email: string;
    id: string;
  } | null;
  ownerId?: string | null;
  retainedRevision?: CharacterRevisionSnapshotReference | null;
  updatedAt: string;
}
