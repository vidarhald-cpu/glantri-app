import type { AuthUser } from "@glantri/auth";

import type { LocalCharacterRecord } from "../offline/glantriDexie";
import { UNNAMED_CHARACTER_PLACEHOLDER } from "../offline/repositories/localCharacterRepository";

export type CharacterBrowserTypeFilter = "all" | "pc" | "npc";
export type CharacterBrowserOwnerFilter =
  | "all"
  | "mine"
  | "recorded_owner"
  | "no_recorded_owner";

export type CharacterBrowserAccessState = "openable" | "restricted";
export type CharacterBrowserOwnershipState = "mine" | "recorded_owner" | "no_recorded_owner";

export interface CharacterBrowserEntry {
  accessLabel: string;
  accessState: CharacterBrowserAccessState;
  canJoinScenario: boolean;
  canOpenSheet: boolean;
  id: string;
  lastSavedAt: string;
  name: string;
  ownerLabel: string;
  ownershipState: CharacterBrowserOwnershipState;
  professionLabel: string;
  record: LocalCharacterRecord;
  socialClassLabel: string;
  sourceLabel: "Local-only" | "Server-backed";
  type: "npc" | "pc";
}

function parseSortableDate(value: string | undefined): number {
  if (!value) {
    return 0;
  }

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function hasRecordedOwner(record: LocalCharacterRecord): boolean {
  return Boolean(record.creatorId || record.creatorDisplayName || record.creatorEmail);
}

function canOpenCharacter(record: LocalCharacterRecord, currentUser: AuthUser | null): boolean {
  if (!currentUser) {
    return false;
  }

  if (currentUser.roles.includes("game_master") || currentUser.roles.includes("admin")) {
    return true;
  }

  return record.creatorId === currentUser.id;
}

function deriveCharacterType(record: LocalCharacterRecord): "npc" | "pc" {
  if (record.syncStatus === "synced" || hasRecordedOwner(record)) {
    return "pc";
  }

  if (record.build.socialClass || record.build.societyId) {
    return "pc";
  }

  return "npc";
}

function deriveOwnershipState(
  record: LocalCharacterRecord,
  currentUser: AuthUser | null
): CharacterBrowserOwnershipState {
  if (record.creatorId && currentUser?.id === record.creatorId) {
    return "mine";
  }

  return hasRecordedOwner(record) ? "recorded_owner" : "no_recorded_owner";
}

function deriveOwnerLabel(record: LocalCharacterRecord, currentUser: AuthUser | null): string {
  if (record.creatorId && currentUser?.id === record.creatorId) {
    return "You";
  }

  if (record.creatorDisplayName && record.creatorEmail) {
    return `${record.creatorDisplayName} (${record.creatorEmail})`;
  }

  if (record.creatorDisplayName) {
    return record.creatorDisplayName;
  }

  if (record.creatorEmail) {
    return record.creatorEmail;
  }

  return "No recorded owner";
}

function deriveAccessState(
  record: LocalCharacterRecord,
  currentUser: AuthUser | null
): CharacterBrowserAccessState {
  return canOpenCharacter(record, currentUser) ? "openable" : "restricted";
}

function deriveAccessLabel(
  accessState: CharacterBrowserAccessState,
  record: LocalCharacterRecord
): string {
  if (accessState === "openable") {
    return record.syncStatus === "synced" ? "Openable here" : "Openable from local data";
  }

  return record.syncStatus === "synced"
    ? "Server-backed, not openable here"
    : "Local-only, not openable here";
}

export function buildCharacterBrowserEntries(
  records: LocalCharacterRecord[],
  currentUser: AuthUser | null
): CharacterBrowserEntry[] {
  return [...records]
    .sort(
      (left, right) =>
        parseSortableDate(right.updatedAt || right.finalizedAt) -
        parseSortableDate(left.updatedAt || left.finalizedAt)
    )
    .map((record) => {
      const accessState = deriveAccessState(record, currentUser);

      return {
        accessLabel: deriveAccessLabel(accessState, record),
        accessState,
        canJoinScenario: accessState === "openable" && record.syncStatus === "synced",
        canOpenSheet: accessState === "openable",
        id: record.id,
        lastSavedAt: record.updatedAt || record.finalizedAt,
        name: record.build.name.trim() || UNNAMED_CHARACTER_PLACEHOLDER,
        ownerLabel: deriveOwnerLabel(record, currentUser),
        ownershipState: deriveOwnershipState(record, currentUser),
        professionLabel: record.build.professionId ?? "Not set",
        record,
        socialClassLabel:
          record.build.socialClass ?? record.build.profile.socialClassResult ?? "Not set",
        sourceLabel: record.syncStatus === "synced" ? "Server-backed" : "Local-only",
        type: deriveCharacterType(record)
      };
    });
}

export function filterCharacterBrowserEntries(
  entries: CharacterBrowserEntry[],
  input: {
    currentUser: AuthUser | null;
    ownerFilter: CharacterBrowserOwnerFilter;
    typeFilter: CharacterBrowserTypeFilter;
  }
): CharacterBrowserEntry[] {
  return entries.filter((entry) => {
    if (input.typeFilter !== "all" && entry.type !== input.typeFilter) {
      return false;
    }

    switch (input.ownerFilter) {
      case "all":
        return true;
      case "mine":
        return entry.ownershipState === "mine";
      case "recorded_owner":
        return entry.ownershipState === "mine" || entry.ownershipState === "recorded_owner";
      case "no_recorded_owner":
        return entry.ownershipState === "no_recorded_owner";
    }
  });
}
