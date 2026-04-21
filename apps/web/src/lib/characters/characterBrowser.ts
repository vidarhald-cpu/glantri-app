import type { AuthUser } from "@glantri/auth";

import type { ServerCharacterRecord } from "../api/localServiceClient";
import type { LocalCharacterRecord } from "../offline/glantriDexie";
import { UNNAMED_CHARACTER_PLACEHOLDER } from "../offline/repositories/localCharacterRepository";

export type CharacterBrowserTypeFilter = "all" | "pc" | "npc";
export type CharacterBrowserSourceFilter = "all" | "server" | "local";
export type CharacterBrowserOwnerFilter = "all" | `owner:${string}` | "owner:none";

export type CharacterBrowserAccessState = "openable" | "restricted";

export interface CharacterBrowserEntry {
  accessLabel: string;
  accessState: CharacterBrowserAccessState;
  canJoinScenario: boolean;
  canOpenSheet: boolean;
  id: string;
  lastSavedAt: string;
  name: string;
  ownerFilterValue: CharacterBrowserOwnerFilter;
  ownerLabel: string;
  professionLabel: string;
  record: LocalCharacterRecord;
  socialClassLabel: string;
  sourceFilterValue: CharacterBrowserSourceFilter;
  sourceLabel: "Local-only" | "Server-backed";
  type: "npc" | "pc";
}

export interface CharacterBrowserOwnerOption {
  label: string;
  value: CharacterBrowserOwnerFilter;
}

export function canBrowseAllCharacterOwners(currentUser: AuthUser | null): boolean {
  return Boolean(
    currentUser &&
      (currentUser.roles.includes("game_master") || currentUser.roles.includes("admin"))
  );
}

function parseSortableDate(value: string | undefined): number {
  if (!value) {
    return 0;
  }

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
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
  if (record.build.professionId || record.build.socialClass || record.build.societyId) {
    return "pc";
  }

  return "npc";
}

function deriveOwnerDescriptor(record: LocalCharacterRecord, currentUser: AuthUser | null): {
  filterValue: CharacterBrowserOwnerFilter;
  label: string;
} {
  if (record.creatorId) {
    const identity = record.creatorEmail ?? record.creatorDisplayName ?? record.creatorId;
    const suffix = currentUser?.id === record.creatorId ? " (You)" : "";

    return {
      filterValue: `owner:${record.creatorId}`,
      label: record.creatorDisplayName && record.creatorEmail
        ? `${record.creatorDisplayName} (${record.creatorEmail})${suffix}`
        : `${identity}${suffix}`
    };
  }

  if (record.creatorEmail) {
    return {
      filterValue: `owner:${record.creatorEmail}`,
      label: record.creatorDisplayName
        ? `${record.creatorDisplayName} (${record.creatorEmail})`
        : record.creatorEmail
    };
  }

  if (record.creatorDisplayName) {
    return {
      filterValue: `owner:${record.creatorDisplayName}`,
      label: record.creatorDisplayName
    };
  }

  return {
    filterValue: "owner:none",
    label: "No recorded owner"
  };
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

function normalizeServerCharacterRecord(record: ServerCharacterRecord): LocalCharacterRecord {
  return {
    build: record.build,
    createdAt: record.createdAt,
    creatorDisplayName: record.owner?.displayName ?? undefined,
    creatorEmail: record.owner?.email ?? undefined,
    creatorId: record.ownerId ?? record.owner?.id ?? undefined,
    finalizedAt: record.createdAt,
    id: record.id,
    syncStatus: "synced",
    updatedAt: record.updatedAt
  };
}

function mergeCharacterRecords(input: {
  localRecords: LocalCharacterRecord[];
  serverRecords: ServerCharacterRecord[];
}): LocalCharacterRecord[] {
  const mergedById = new Map<string, LocalCharacterRecord>();

  for (const localRecord of input.localRecords) {
    mergedById.set(localRecord.id, localRecord);
  }

  for (const serverRecord of input.serverRecords) {
    const normalizedServerRecord = normalizeServerCharacterRecord(serverRecord);
    const existing = mergedById.get(serverRecord.id);

    mergedById.set(serverRecord.id, {
      ...existing,
      ...normalizedServerRecord,
      build: normalizedServerRecord.build,
      createdAt: existing?.createdAt ?? normalizedServerRecord.createdAt,
      creatorDisplayName:
        normalizedServerRecord.creatorDisplayName ?? existing?.creatorDisplayName,
      creatorEmail: normalizedServerRecord.creatorEmail ?? existing?.creatorEmail,
      creatorId: normalizedServerRecord.creatorId ?? existing?.creatorId,
      finalizedAt: existing?.finalizedAt ?? normalizedServerRecord.finalizedAt,
      syncStatus: "synced",
      updatedAt: normalizedServerRecord.updatedAt
    });
  }

  return [...mergedById.values()];
}

export function buildCharacterBrowserEntries(input: {
  currentUser: AuthUser | null;
  localRecords: LocalCharacterRecord[];
  serverRecords: ServerCharacterRecord[];
}): CharacterBrowserEntry[] {
  return mergeCharacterRecords({
    localRecords: input.localRecords,
    serverRecords: input.serverRecords
  })
    .sort(
      (left, right) =>
        parseSortableDate(right.updatedAt || right.finalizedAt) -
        parseSortableDate(left.updatedAt || left.finalizedAt)
    )
    .map((record) => {
      const accessState = deriveAccessState(record, input.currentUser);
      const owner = deriveOwnerDescriptor(record, input.currentUser);

      return {
        accessLabel: deriveAccessLabel(accessState, record),
        accessState,
        canJoinScenario: accessState === "openable" && record.syncStatus === "synced",
        canOpenSheet: accessState === "openable",
        id: record.id,
        lastSavedAt: record.updatedAt || record.finalizedAt,
        name: record.build.name.trim() || UNNAMED_CHARACTER_PLACEHOLDER,
        ownerFilterValue: owner.filterValue,
        ownerLabel: owner.label,
        professionLabel: record.build.professionId ?? "Not set",
        record,
        socialClassLabel:
          record.build.socialClass ?? record.build.profile.socialClassResult ?? "Not set",
        sourceFilterValue: record.syncStatus === "synced" ? "server" : "local",
        sourceLabel: record.syncStatus === "synced" ? "Server-backed" : "Local-only",
        type: deriveCharacterType(record)
      };
    });
}

export function buildCharacterBrowserOwnerOptions(
  entries: CharacterBrowserEntry[]
): CharacterBrowserOwnerOption[] {
  const options = new Map<CharacterBrowserOwnerFilter, CharacterBrowserOwnerOption>();

  options.set("all", { label: "All owners", value: "all" });

  for (const entry of entries) {
    if (entry.ownerFilterValue === "all") {
      continue;
    }

    if (!options.has(entry.ownerFilterValue)) {
      options.set(entry.ownerFilterValue, {
        label: entry.ownerLabel,
        value: entry.ownerFilterValue
      });
    }
  }

  const allOwners = [...options.values()];
  const fixed = allOwners.filter((option) => option.value === "all");
  const dynamic = allOwners
    .filter((option) => option.value !== "all")
    .sort((left, right) => left.label.localeCompare(right.label));

  return [...fixed, ...dynamic];
}

export function filterCharacterBrowserEntries(
  entries: CharacterBrowserEntry[],
  input: {
    ownerFilter: CharacterBrowserOwnerFilter;
    sourceFilter: CharacterBrowserSourceFilter;
    typeFilter: CharacterBrowserTypeFilter;
  }
): CharacterBrowserEntry[] {
  return entries.filter((entry) => {
    if (input.typeFilter !== "all" && entry.type !== input.typeFilter) {
      return false;
    }

    if (input.sourceFilter !== "all" && entry.sourceFilterValue !== input.sourceFilter) {
      return false;
    }

    if (input.ownerFilter !== "all" && entry.ownerFilterValue !== input.ownerFilter) {
      return false;
    }

    return true;
  });
}
