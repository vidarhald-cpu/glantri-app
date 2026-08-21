import type { AuthUser } from "@glantri/auth";
import { characterBuildSchema, type CharacterBuild } from "@glantri/domain";

import {
  localDb,
  type CharacterRecoveryEnvelope,
  type CharacterRecoveryPatchEntry,
  type LegacyCharacterRecoveryRecord,
} from "../glantriDexie";

export interface CharacterRecoveryState {
  conflictPaths: string[];
  envelope: CharacterRecoveryEnvelope;
  recoveredBuild?: CharacterBuild;
}

export interface CreateCharacterRecoveryInput {
  account: AuthUser;
  attemptedBuild: CharacterBuild;
  baseBuild: CharacterBuild;
  baseRevision: string;
  characterId: string;
  sourceAction: string;
  sourceSurface: string;
}

const MISSING = Symbol("missing");

function recoveryId(accountId: string, characterId: string): string {
  return `${accountId}:${characterId}`;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function stableSerialize(value: unknown): string {
  if (value === undefined) {
    return "undefined";
  }

  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(",")}]`;
  }

  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => `${JSON.stringify(key)}:${stableSerialize(item)}`)
    .join(",")}}`;
}

function valuesEqual(left: unknown, right: unknown): boolean {
  return stableSerialize(left) === stableSerialize(right);
}

export function hashCharacterBuild(build: CharacterBuild): string {
  const serialized = stableSerialize(build);
  let hash = 2166136261;

  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function escapePathSegment(segment: string): string {
  return segment.replaceAll("~", "~0").replaceAll("/", "~1");
}

function unescapePathSegment(segment: string): string {
  return segment.replaceAll("~1", "/").replaceAll("~0", "~");
}

function appendPatchEntries(
  baseValue: unknown,
  attemptedValue: unknown,
  path: string,
  patch: CharacterRecoveryPatchEntry[],
): void {
  if (valuesEqual(baseValue, attemptedValue)) {
    return;
  }

  if (isPlainObject(baseValue) && isPlainObject(attemptedValue)) {
    const keys = new Set([...Object.keys(baseValue), ...Object.keys(attemptedValue)]);

    for (const key of [...keys].sort()) {
      const baseHasKey = Object.hasOwn(baseValue, key);
      const attemptedHasKey = Object.hasOwn(attemptedValue, key);
      const nextPath = `${path}/${escapePathSegment(key)}`;

      if (!attemptedHasKey) {
        patch.push({
          baseValue: baseValue[key],
          operation: "remove",
          path: nextPath,
        });
      } else if (!baseHasKey) {
        patch.push({
          attemptedValue: attemptedValue[key],
          operation: "set",
          path: nextPath,
        });
      } else {
        appendPatchEntries(baseValue[key], attemptedValue[key], nextPath, patch);
      }
    }

    return;
  }

  patch.push({
    attemptedValue,
    baseValue,
    operation: "set",
    path: path || "/",
  });
}

export function buildCharacterRecoveryPatch(
  baseBuild: CharacterBuild,
  attemptedBuild: CharacterBuild,
): CharacterRecoveryPatchEntry[] {
  const patch: CharacterRecoveryPatchEntry[] = [];
  appendPatchEntries(baseBuild, attemptedBuild, "", patch);
  return patch;
}

function pathSegments(path: string): string[] {
  if (path === "/") {
    return [];
  }

  return path
    .split("/")
    .slice(1)
    .map((segment) => unescapePathSegment(segment));
}

function getValueAtPath(value: unknown, path: string): unknown | typeof MISSING {
  let current = value;

  for (const segment of pathSegments(path)) {
    if (!isPlainObject(current) || !Object.hasOwn(current, segment)) {
      return MISSING;
    }

    current = current[segment];
  }

  return current;
}

function matchesPatchBase(
  currentValue: unknown | typeof MISSING,
  entry: CharacterRecoveryPatchEntry,
) {
  if (entry.baseValue === undefined && currentValue === MISSING) {
    return true;
  }

  return currentValue !== MISSING && valuesEqual(currentValue, entry.baseValue);
}

function matchesAttemptedValue(
  currentValue: unknown | typeof MISSING,
  entry: CharacterRecoveryPatchEntry,
) {
  if (entry.operation === "remove") {
    return currentValue === MISSING;
  }

  return currentValue !== MISSING && valuesEqual(currentValue, entry.attemptedValue);
}

function setValueAtPath(target: Record<string, unknown>, entry: CharacterRecoveryPatchEntry): void {
  const segments = pathSegments(entry.path);

  if (segments.length === 0) {
    throw new Error("A Character recovery patch cannot replace the whole Character.");
  }

  let current = target;

  for (const segment of segments.slice(0, -1)) {
    const next = current[segment];

    if (!isPlainObject(next)) {
      current[segment] = {};
    }

    current = current[segment] as Record<string, unknown>;
  }

  const lastSegment = segments.at(-1);

  if (!lastSegment) {
    return;
  }

  if (entry.operation === "remove") {
    delete current[lastSegment];
  } else {
    current[lastSegment] = structuredClone(entry.attemptedValue);
  }
}

export function applyCharacterRecoveryPatch(
  canonicalBuild: CharacterBuild,
  patch: CharacterRecoveryPatchEntry[],
): CharacterBuild {
  const recovered = structuredClone(canonicalBuild) as unknown as Record<string, unknown>;

  for (const entry of patch) {
    setValueAtPath(recovered, entry);
  }

  return characterBuildSchema.parse(recovered);
}

function createAttemptId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `attempt-${Date.now()}-${Math.random()}`;
}

export function formatCharacterRecoveryField(path: string): string {
  const knownLabels: Record<string, string> = {
    "/age": "Age",
    "/gender": "Gender",
    "/inventoryNotes": "Inventory notes",
    "/name": "Character name",
    "/profile/notes": "Character notes",
    "/title": "Title",
  };
  const exact = knownLabels[path];

  if (exact) {
    return exact;
  }

  const segments = pathSegments(path);
  const leaf = segments.at(-1) ?? "Character field";
  return leaf
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replaceAll("_", " ")
    .replace(/^./, (character) => character.toUpperCase());
}

export class CharacterRecoveryRepository {
  async createAttempt(
    input: CreateCharacterRecoveryInput,
  ): Promise<CharacterRecoveryEnvelope | undefined> {
    const baseBuild = characterBuildSchema.parse(input.baseBuild);
    const attemptedBuild = characterBuildSchema.parse(input.attemptedBuild);
    const patch = buildCharacterRecoveryPatch(baseBuild, attemptedBuild);
    const id = recoveryId(input.account.id, input.characterId);

    if (patch.length === 0) {
      return undefined;
    }

    return localDb.transaction("rw", localDb.characterRecoveries, async () => {
      const now = new Date().toISOString();
      const existing = await localDb.characterRecoveries.get(id);
      const envelope: CharacterRecoveryEnvelope = {
        accountDisplayName: input.account.displayName,
        accountEmail: input.account.email,
        accountId: input.account.id,
        baseHash: hashCharacterBuild(baseBuild),
        baseRevision: input.baseRevision,
        characterId: input.characterId,
        createdAt: existing?.createdAt ?? now,
        id,
        patch,
        reconciliation: "ready",
        saveAttempt: {
          attemptedAt: now,
          id: createAttemptId(),
          outcome: "pending",
        },
        sourceAction: input.sourceAction,
        sourceSurface: input.sourceSurface,
        updatedAt: now,
      };

      await localDb.characterRecoveries.put(envelope);
      return envelope;
    });
  }

  async delete(accountId: string, characterId: string): Promise<void> {
    await localDb.characterRecoveries.delete(recoveryId(accountId, characterId));
  }

  async deleteAttempt(accountId: string, characterId: string, attemptId: string): Promise<boolean> {
    return localDb.transaction("rw", localDb.characterRecoveries, async () => {
      const id = recoveryId(accountId, characterId);
      const envelope = await localDb.characterRecoveries.get(id);

      if (!envelope || envelope.saveAttempt.id !== attemptId) {
        return false;
      }

      await localDb.characterRecoveries.delete(id);
      return true;
    });
  }

  async get(
    accountId: string,
    characterId: string,
  ): Promise<CharacterRecoveryEnvelope | undefined> {
    return localDb.characterRecoveries.get(recoveryId(accountId, characterId));
  }

  async listLegacyQuarantineForAccount(
    accountId: string,
    characterId: string,
  ): Promise<LegacyCharacterRecoveryRecord[]> {
    return localDb.legacyCharacterRecoveries
      .where("[accountId+characterId]")
      .equals([accountId, characterId])
      .toArray();
  }

  async markAttemptOutcome(
    accountId: string,
    characterId: string,
    attemptId: string,
    outcome: "conflict" | "failed" | "unknown",
    errorCode?: string,
  ): Promise<CharacterRecoveryEnvelope | undefined> {
    return localDb.transaction("rw", localDb.characterRecoveries, async () => {
      const envelope = await this.get(accountId, characterId);

      if (!envelope || envelope.saveAttempt.id !== attemptId) {
        return undefined;
      }

      const now = new Date().toISOString();
      const updated: CharacterRecoveryEnvelope = {
        ...envelope,
        reconciliation: outcome === "conflict" ? "conflict" : envelope.reconciliation,
        saveAttempt: {
          ...envelope.saveAttempt,
          completedAt: now,
          errorCode,
          outcome,
        },
        updatedAt: now,
      };

      await localDb.characterRecoveries.put(updated);
      return updated;
    });
  }

  async purgeForAccount(accountId: string): Promise<void> {
    const rows = await localDb.characterRecoveries
      .where("accountId")
      .equals(accountId)
      .primaryKeys();

    if (rows.length > 0) {
      await localDb.characterRecoveries.bulkDelete(rows);
    }

    const legacyRows = await localDb.legacyCharacterRecoveries
      .where("accountId")
      .equals(accountId)
      .primaryKeys();

    if (legacyRows.length > 0) {
      await localDb.legacyCharacterRecoveries.bulkDelete(legacyRows);
    }
  }

  async reconcile(
    accountId: string,
    characterId: string,
    canonicalBuild: CharacterBuild,
    canonicalRevision: string,
  ): Promise<CharacterRecoveryState | undefined> {
    return localDb.transaction("rw", localDb.characterRecoveries, async () => {
      const envelope = await this.get(accountId, characterId);

      if (!envelope) {
        return undefined;
      }

      const unresolvedPatch: CharacterRecoveryPatchEntry[] = [];
      const conflictPaths: string[] = [];

      for (const entry of envelope.patch) {
        const currentValue = getValueAtPath(canonicalBuild, entry.path);

        if (matchesAttemptedValue(currentValue, entry)) {
          continue;
        }

        if (matchesPatchBase(currentValue, entry)) {
          unresolvedPatch.push({
            ...entry,
            baseValue: currentValue === MISSING ? undefined : structuredClone(currentValue),
          });
        } else {
          unresolvedPatch.push(entry);
          conflictPaths.push(entry.path);
        }
      }

      if (unresolvedPatch.length === 0) {
        await localDb.characterRecoveries.delete(envelope.id);
        return undefined;
      }

      const baseHash = hashCharacterBuild(canonicalBuild);
      const reconciliation = conflictPaths.length > 0 ? "conflict" : "ready";
      const hasSemanticChange =
        envelope.baseHash !== baseHash ||
        envelope.baseRevision !== canonicalRevision ||
        envelope.reconciliation !== reconciliation ||
        !valuesEqual(envelope.patch, unresolvedPatch);
      const reconciled: CharacterRecoveryEnvelope = hasSemanticChange
        ? {
            ...envelope,
            baseHash,
            baseRevision: canonicalRevision,
            patch: unresolvedPatch,
            reconciliation,
            updatedAt: new Date().toISOString(),
          }
        : envelope;

      if (hasSemanticChange) {
        await localDb.characterRecoveries.put(reconciled);
      }

      return {
        conflictPaths,
        envelope: reconciled,
        recoveredBuild:
          conflictPaths.length === 0
            ? applyCharacterRecoveryPatch(canonicalBuild, unresolvedPatch)
            : undefined,
      };
    });
  }
}
