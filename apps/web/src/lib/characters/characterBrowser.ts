import type { AuthUser } from "@glantri/auth";

import type { LocalCharacterRecord } from "../offline/glantriDexie";
import { UNNAMED_CHARACTER_PLACEHOLDER } from "../offline/repositories/localCharacterRepository";

export type CharacterBrowserTypeFilter = "all" | "pc" | "npc";
export type CharacterBrowserOwnerFilter = "all" | "gm" | "player" | "mine";

export interface CharacterBrowserEntry {
  id: string;
  lastSavedAt: string;
  name: string;
  ownerCategory: "gm" | "player";
  ownerLabel: string;
  professionLabel: string;
  record: LocalCharacterRecord;
  socialClassLabel: string;
  sourceLabel: "Local only" | "Server synced";
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

function deriveCharacterType(record: LocalCharacterRecord): "npc" | "pc" {
  if (record.syncStatus === "synced" || hasRecordedOwner(record)) {
    return "pc";
  }

  if (record.build.socialClass || record.build.societyId) {
    return "pc";
  }

  return "npc";
}

function deriveOwnerCategory(record: LocalCharacterRecord): "gm" | "player" {
  return hasRecordedOwner(record) ? "player" : "gm";
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

  return "GM-owned";
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
    .map((record) => ({
      id: record.id,
      lastSavedAt: record.updatedAt || record.finalizedAt,
      name: record.build.name.trim() || UNNAMED_CHARACTER_PLACEHOLDER,
      ownerCategory: deriveOwnerCategory(record),
      ownerLabel: deriveOwnerLabel(record, currentUser),
      professionLabel: record.build.professionId ?? "Not set",
      record,
      socialClassLabel: record.build.socialClass ?? record.build.profile.socialClassResult ?? "Not set",
      sourceLabel: record.syncStatus === "synced" ? "Server synced" : "Local only",
      type: deriveCharacterType(record)
    }));
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
      case "gm":
        return entry.ownerCategory === "gm";
      case "player":
        return entry.ownerCategory === "player";
      case "mine":
        return input.currentUser != null && entry.record.creatorId === input.currentUser.id;
    }
  });
}

