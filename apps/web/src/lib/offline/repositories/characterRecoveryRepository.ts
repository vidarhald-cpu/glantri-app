import type { AuthUser } from "@glantri/auth";
import { characterBuildSchema, type CharacterBuild } from "@glantri/domain";

import {
  localDb,
  type CharacterRecoveryCandidate,
  type CharacterRecoveryEnvelope,
  type CharacterRecoveryPatchEntry,
  type LegacyCharacterRecoveryRecord,
  type MalformedCharacterRecoveryCandidateRecord,
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
  expectedAttemptId?: string;
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

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isCharacterRecoveryPatchEntry(value: unknown): value is CharacterRecoveryPatchEntry {
  if (!isPlainObject(value)) {
    return false;
  }

  return (
    (value.operation === "remove" || value.operation === "set") &&
    isNonEmptyString(value.path) &&
    value.path.startsWith("/") &&
    value.path !== "/"
  );
}

function isCharacterRecoveryCandidate(value: unknown): value is CharacterRecoveryCandidate {
  if (!isPlainObject(value) || !isPlainObject(value.saveAttempt)) {
    return false;
  }

  const saveAttempt = value.saveAttempt;
  return (
    isNonEmptyString(value.baseHash) &&
    isNonEmptyString(value.baseRevision) &&
    isNonEmptyString(value.createdAt) &&
    Array.isArray(value.patch) &&
    value.patch.length > 0 &&
    value.patch.every(isCharacterRecoveryPatchEntry) &&
    (value.reconciliation === "conflict" || value.reconciliation === "ready") &&
    (value.relationshipToPrimary === "disjoint" || value.relationshipToPrimary === "overlapping") &&
    (value.revisionToken === undefined || isNonEmptyString(value.revisionToken)) &&
    isNonEmptyString(saveAttempt.attemptedAt) &&
    (saveAttempt.completedAt === undefined || isNonEmptyString(saveAttempt.completedAt)) &&
    (saveAttempt.errorCode === undefined || typeof saveAttempt.errorCode === "string") &&
    isNonEmptyString(saveAttempt.id) &&
    (saveAttempt.outcome === "conflict" ||
      saveAttempt.outcome === "failed" ||
      saveAttempt.outcome === "pending" ||
      saveAttempt.outcome === "unknown") &&
    isNonEmptyString(value.sourceAction) &&
    isNonEmptyString(value.sourceSurface) &&
    isNonEmptyString(value.updatedAt)
  );
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

export function getCharacterRecoveryCandidateRevision(
  candidate: CharacterRecoveryCandidate,
): string {
  return candidate.revisionToken ?? candidate.saveAttempt.id;
}

export class CharacterRecoveryAttemptChangedError extends Error {
  constructor(
    readonly currentAttemptId?: string,
    readonly retainedCandidateAttemptId?: string,
  ) {
    super(
      "Unsaved Character changes were updated in another tab. Both attempts are retained for deliberate review.",
    );
    this.name = "CharacterRecoveryAttemptChangedError";
  }
}

function patchesOverlap(
  primaryPatch: CharacterRecoveryPatchEntry[],
  candidatePatch: CharacterRecoveryPatchEntry[],
): boolean {
  return primaryPatch.some((primaryEntry) =>
    candidatePatch.some(
      (candidateEntry) =>
        primaryEntry.path === candidateEntry.path ||
        primaryEntry.path.startsWith(`${candidateEntry.path}/`) ||
        candidateEntry.path.startsWith(`${primaryEntry.path}/`),
    ),
  );
}

function candidateRelationship(
  primaryPatch: CharacterRecoveryPatchEntry[],
  candidatePatch: CharacterRecoveryPatchEntry[],
): CharacterRecoveryCandidate["relationshipToPrimary"] {
  return patchesOverlap(primaryPatch, candidatePatch) ? "overlapping" : "disjoint";
}

function withCandidateRelationships(
  primaryPatch: CharacterRecoveryPatchEntry[],
  candidates: CharacterRecoveryCandidate[],
): CharacterRecoveryCandidate[] {
  return candidates.map((candidate) => {
    const relationshipToPrimary = candidateRelationship(primaryPatch, candidate.patch);

    return relationshipToPrimary === candidate.relationshipToPrimary
      ? candidate
      : {
          ...candidate,
          relationshipToPrimary,
          revisionToken: createAttemptId(),
          updatedAt: new Date().toISOString(),
        };
  });
}

function validateCompetingCandidates(envelope: CharacterRecoveryEnvelope): {
  envelope: CharacterRecoveryEnvelope;
  quarantine: MalformedCharacterRecoveryCandidateRecord[];
} {
  const rawCandidates = (envelope as unknown as { competingCandidates?: unknown })
    .competingCandidates;

  if (rawCandidates === undefined) {
    return { envelope, quarantine: [] };
  }

  const candidateValues = Array.isArray(rawCandidates) ? rawCandidates : [rawCandidates];
  const validCandidates: CharacterRecoveryCandidate[] = [];
  const quarantine: MalformedCharacterRecoveryCandidateRecord[] = [];
  const quarantinedAt = new Date().toISOString();

  candidateValues.forEach((candidate, index) => {
    if (isCharacterRecoveryCandidate(candidate)) {
      validCandidates.push(candidate);
      return;
    }

    quarantine.push({
      accountId: envelope.accountId,
      characterId: envelope.characterId,
      id: `characterRecoveries:${envelope.id}:${quarantinedAt}:${index}:${createAttemptId()}`,
      quarantinedAt,
      record: candidate,
      sourceStore: "characterRecoveries",
      updatedAt: envelope.updatedAt,
    });
  });

  if (quarantine.length === 0) {
    return { envelope, quarantine };
  }

  return {
    envelope: {
      ...envelope,
      competingCandidates: validCandidates.length > 0 ? validCandidates : undefined,
    },
    quarantine,
  };
}

async function getValidatedEnvelope(id: string): Promise<CharacterRecoveryEnvelope | undefined> {
  const stored = await localDb.characterRecoveries.get(id);

  if (!stored) {
    return undefined;
  }

  const validated = validateCompetingCandidates(stored);

  if (validated.quarantine.length > 0) {
    await localDb.legacyCharacterRecoveries.bulkPut(validated.quarantine);
    await localDb.characterRecoveries.put(validated.envelope);
  }

  return validated.envelope;
}

function withRecoveryWriteTransaction<T>(operation: () => Promise<T>): Promise<T> {
  return localDb.transaction(
    "rw",
    localDb.characterRecoveries,
    localDb.legacyCharacterRecoveries,
    operation,
  );
}

function promoteCandidate(
  envelope: CharacterRecoveryEnvelope,
  candidate: CharacterRecoveryCandidate,
  remainingCandidates: CharacterRecoveryCandidate[],
): CharacterRecoveryEnvelope {
  return {
    ...envelope,
    baseHash: candidate.baseHash,
    baseRevision: candidate.baseRevision,
    competingCandidates:
      remainingCandidates.length > 0
        ? withCandidateRelationships(candidate.patch, remainingCandidates)
        : undefined,
    createdAt: candidate.createdAt,
    patch: candidate.patch,
    reconciliation: candidate.reconciliation,
    saveAttempt: candidate.saveAttempt,
    sourceAction: candidate.sourceAction,
    sourceSurface: candidate.sourceSurface,
    updatedAt: candidate.updatedAt,
  };
}

function reconcilePatch(
  patch: CharacterRecoveryPatchEntry[],
  canonicalBuild: CharacterBuild,
): { conflictPaths: string[]; patch: CharacterRecoveryPatchEntry[] } {
  const unresolvedPatch: CharacterRecoveryPatchEntry[] = [];
  const conflictPaths: string[] = [];

  for (const entry of patch) {
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

  return { conflictPaths, patch: unresolvedPatch };
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

    const result = await withRecoveryWriteTransaction(async () => {
      const now = new Date().toISOString();
      const existing = await getValidatedEnvelope(id);

      if (existing?.saveAttempt.id !== input.expectedAttemptId) {
        const candidateAttemptId = createAttemptId();
        const candidate: CharacterRecoveryCandidate = {
          baseHash: hashCharacterBuild(baseBuild),
          baseRevision: input.baseRevision,
          createdAt: now,
          patch,
          reconciliation: "ready",
          relationshipToPrimary: existing
            ? candidateRelationship(existing.patch, patch)
            : "disjoint",
          revisionToken: createAttemptId(),
          saveAttempt: {
            attemptedAt: now,
            completedAt: now,
            errorCode: "competing_recovery",
            id: candidateAttemptId,
            outcome: "conflict",
          },
          sourceAction: input.sourceAction,
          sourceSurface: input.sourceSurface,
          updatedAt: now,
        };

        if (existing) {
          await localDb.characterRecoveries.put({
            ...existing,
            competingCandidates: [...(existing.competingCandidates ?? []), candidate],
          });
        } else {
          await localDb.characterRecoveries.put({
            accountDisplayName: input.account.displayName,
            accountEmail: input.account.email,
            accountId: input.account.id,
            baseHash: candidate.baseHash,
            baseRevision: candidate.baseRevision,
            characterId: input.characterId,
            createdAt: candidate.createdAt,
            id,
            patch: candidate.patch,
            reconciliation: candidate.reconciliation,
            saveAttempt: candidate.saveAttempt,
            sourceAction: candidate.sourceAction,
            sourceSurface: candidate.sourceSurface,
            updatedAt: candidate.updatedAt,
          });
        }

        return {
          competingCandidateAttemptId: candidateAttemptId,
          currentAttemptId: existing?.saveAttempt.id,
        };
      }

      const existingCandidates = existing?.competingCandidates ?? [];

      const envelope: CharacterRecoveryEnvelope = {
        accountDisplayName: input.account.displayName,
        accountEmail: input.account.email,
        accountId: input.account.id,
        baseHash: hashCharacterBuild(baseBuild),
        baseRevision: input.baseRevision,
        characterId: input.characterId,
        competingCandidates:
          existingCandidates.length > 0
            ? withCandidateRelationships(patch, existingCandidates)
            : undefined,
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
      return { envelope };
    });

    if ("competingCandidateAttemptId" in result) {
      throw new CharacterRecoveryAttemptChangedError(
        result.currentAttemptId,
        result.competingCandidateAttemptId,
      );
    }

    return result.envelope;
  }

  async delete(accountId: string, characterId: string): Promise<void> {
    await localDb.characterRecoveries.delete(recoveryId(accountId, characterId));
  }

  async deleteAttempt(accountId: string, characterId: string, attemptId: string): Promise<boolean> {
    return withRecoveryWriteTransaction(async () => {
      const id = recoveryId(accountId, characterId);
      const envelope = await getValidatedEnvelope(id);

      if (!envelope || envelope.saveAttempt.id !== attemptId) {
        return false;
      }

      const [nextCandidate, ...remainingCandidates] = envelope.competingCandidates ?? [];

      if (nextCandidate) {
        await localDb.characterRecoveries.put(
          promoteCandidate(envelope, nextCandidate, remainingCandidates),
        );
      } else {
        await localDb.characterRecoveries.delete(id);
      }
      return true;
    });
  }

  async completeAttempt(
    accountId: string,
    characterId: string,
    attemptId: string,
    canonicalBuild: CharacterBuild,
    canonicalRevision: string,
  ): Promise<CharacterRecoveryEnvelope | undefined> {
    const deleted = await this.deleteAttempt(accountId, characterId, attemptId);

    if (!deleted) {
      return this.get(accountId, characterId);
    }

    const remaining = await this.get(accountId, characterId);

    if (!remaining) {
      return undefined;
    }

    const reconciled = await this.reconcile(
      accountId,
      characterId,
      canonicalBuild,
      canonicalRevision,
      remaining.saveAttempt.id,
    );

    return reconciled?.envelope ?? this.get(accountId, characterId);
  }

  async deleteCandidate(
    accountId: string,
    characterId: string,
    expectedPrimaryAttemptId: string,
    candidateAttemptId: string,
    expectedCandidateRevision: string,
  ): Promise<boolean> {
    return withRecoveryWriteTransaction(async () => {
      const envelope = await getValidatedEnvelope(recoveryId(accountId, characterId));

      if (!envelope || envelope.saveAttempt.id !== expectedPrimaryAttemptId) {
        return false;
      }

      const candidates = envelope.competingCandidates ?? [];
      const candidateIndex = candidates.findIndex(
        (candidate) =>
          candidate.saveAttempt.id === candidateAttemptId &&
          getCharacterRecoveryCandidateRevision(candidate) === expectedCandidateRevision,
      );

      if (candidateIndex < 0) {
        return false;
      }

      const retainedCandidates = candidates.filter((_, index) => index !== candidateIndex);

      await localDb.characterRecoveries.put({
        ...envelope,
        competingCandidates: retainedCandidates.length > 0 ? retainedCandidates : undefined,
      });
      return true;
    });
  }

  async get(
    accountId: string,
    characterId: string,
  ): Promise<CharacterRecoveryEnvelope | undefined> {
    return withRecoveryWriteTransaction(() =>
      getValidatedEnvelope(recoveryId(accountId, characterId)),
    );
  }

  async listLegacyQuarantineForAccount(
    accountId: string,
    characterId: string,
  ): Promise<LegacyCharacterRecoveryRecord[]> {
    const records = await localDb.legacyCharacterRecoveries
      .where("[accountId+characterId]")
      .equals([accountId, characterId])
      .toArray();
    return records.filter(
      (record): record is LegacyCharacterRecoveryRecord =>
        record.sourceStore !== "characterRecoveries",
    );
  }

  async listMalformedCandidateQuarantineForAccount(
    accountId: string,
    characterId: string,
  ): Promise<MalformedCharacterRecoveryCandidateRecord[]> {
    const records = await localDb.legacyCharacterRecoveries
      .where("[accountId+characterId]")
      .equals([accountId, characterId])
      .toArray();
    return records.filter(
      (record): record is MalformedCharacterRecoveryCandidateRecord =>
        record.sourceStore === "characterRecoveries",
    );
  }

  async markAttemptOutcome(
    accountId: string,
    characterId: string,
    attemptId: string,
    outcome: "conflict" | "failed" | "unknown",
    errorCode?: string,
  ): Promise<CharacterRecoveryEnvelope | undefined> {
    return withRecoveryWriteTransaction(async () => {
      const envelope = await getValidatedEnvelope(recoveryId(accountId, characterId));

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
    expectedAttemptId?: string,
  ): Promise<CharacterRecoveryState | undefined> {
    return withRecoveryWriteTransaction(async () => {
      const envelope = await getValidatedEnvelope(recoveryId(accountId, characterId));

      if (
        !envelope ||
        (expectedAttemptId !== undefined && envelope.saveAttempt.id !== expectedAttemptId)
      ) {
        return undefined;
      }

      const baseHash = hashCharacterBuild(canonicalBuild);
      const primaryState = reconcilePatch(envelope.patch, canonicalBuild);
      const reconciledCandidates = (envelope.competingCandidates ?? []).flatMap(
        (candidate): CharacterRecoveryCandidate[] => {
          const candidateState = reconcilePatch(candidate.patch, canonicalBuild);

          if (candidateState.patch.length === 0) {
            return [];
          }

          const reconciliation: CharacterRecoveryCandidate["reconciliation"] =
            candidateState.conflictPaths.length > 0 ? "conflict" : "ready";
          const relationshipToPrimary = candidateRelationship(
            primaryState.patch,
            candidateState.patch,
          );
          const hasSemanticChange =
            candidate.baseHash !== baseHash ||
            candidate.baseRevision !== canonicalRevision ||
            candidate.reconciliation !== reconciliation ||
            candidate.relationshipToPrimary !== relationshipToPrimary ||
            !valuesEqual(candidate.patch, candidateState.patch);

          return [
            hasSemanticChange
              ? {
                  ...candidate,
                  baseHash,
                  baseRevision: canonicalRevision,
                  patch: candidateState.patch,
                  reconciliation,
                  relationshipToPrimary,
                  revisionToken: createAttemptId(),
                  updatedAt: new Date().toISOString(),
                }
              : candidate,
          ];
        },
      );

      if (primaryState.patch.length === 0) {
        const [nextCandidate, ...remainingCandidates] = reconciledCandidates;

        if (!nextCandidate) {
          await localDb.characterRecoveries.delete(envelope.id);
          return undefined;
        }

        const promoted = promoteCandidate(envelope, nextCandidate, remainingCandidates);
        await localDb.characterRecoveries.put(promoted);
        const promotedConflictPaths = reconcilePatch(promoted.patch, canonicalBuild).conflictPaths;
        return {
          conflictPaths: promotedConflictPaths,
          envelope: promoted,
          recoveredBuild:
            promotedConflictPaths.length === 0
              ? applyCharacterRecoveryPatch(canonicalBuild, promoted.patch)
              : undefined,
        };
      }

      const conflictPaths = primaryState.conflictPaths;
      const reconciliation = conflictPaths.length > 0 ? "conflict" : "ready";
      const relatedCandidates = reconciledCandidates;
      const hasSemanticChange =
        envelope.baseHash !== baseHash ||
        envelope.baseRevision !== canonicalRevision ||
        envelope.reconciliation !== reconciliation ||
        !valuesEqual(envelope.patch, primaryState.patch) ||
        !valuesEqual(envelope.competingCandidates ?? [], relatedCandidates);
      const reconciled: CharacterRecoveryEnvelope = hasSemanticChange
        ? {
            ...envelope,
            baseHash,
            baseRevision: canonicalRevision,
            competingCandidates: relatedCandidates.length > 0 ? relatedCandidates : undefined,
            patch: primaryState.patch,
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
            ? applyCharacterRecoveryPatch(canonicalBuild, primaryState.patch)
            : undefined,
      };
    });
  }
}
