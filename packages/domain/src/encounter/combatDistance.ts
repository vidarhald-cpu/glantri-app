import { z } from "zod";

import { createCombatParticipantPairKey } from "./combatModifierContributions";

const idSchema = z.string().min(1);

export const combatDistanceSchema = z.union([
  z.literal(0),
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
  z.literal(6),
  z.literal(7),
  z.literal(8),
]);
export type CombatDistance = z.infer<typeof combatDistanceSchema>;

export const combatDistanceSourceSchema = z.enum([
  "gm_set",
  "default_weapon_reach",
  "round_end_review",
  "maneuver",
]);
export type CombatDistanceSource = z.infer<typeof combatDistanceSourceSchema>;

export const combatDistanceEdgeSchema = z.object({
  distance: combatDistanceSchema,
  lastChangedPhase: z.string().min(1).optional(),
  lastChangedRound: z.number().int().positive().optional(),
  notes: z.string().min(1).optional(),
  pairKey: idSchema,
  participantAId: idSchema,
  participantBId: idSchema,
  source: combatDistanceSourceSchema,
});
export type CombatDistanceEdge = z.infer<typeof combatDistanceEdgeSchema>;

export const combatDistanceStateSchema = z
  .object({
    edges: z.record(idSchema, combatDistanceEdgeSchema).default({}),
  })
  .default({ edges: {} });
export type CombatDistanceState = z.infer<typeof combatDistanceStateSchema>;

export interface CombatDistanceWeaponLike {
  preferredDistances?: readonly unknown[] | null;
  range?: unknown;
}

export interface CombatDistanceParticipantAliasLike {
  characterId?: string | null;
  id?: string | null;
  participantId?: string | null;
  scenarioParticipantId?: string | null;
}

export interface CombatDistanceDefaultResult {
  distance: CombatDistance;
  notes?: string;
}

function validateParticipantId(id: string, label: string): string {
  const trimmed = id.trim();

  if (!trimmed) {
    throw new RangeError(`${label} is required.`);
  }

  return trimmed;
}

function parseCombatDistance(value: unknown, label = "Distance"): CombatDistance {
  const parsed = typeof value === "string" && value.trim() !== "" ? Number(value) : value;

  if (typeof parsed !== "number" || !Number.isInteger(parsed) || parsed < 0 || parsed > 8) {
    throw new RangeError(`${label} must be an integer from 0 to 8.`);
  }

  return combatDistanceSchema.parse(parsed);
}

export function makeDistancePairKey(participantAId: string, participantBId: string): string {
  const participantA = validateParticipantId(participantAId, "Participant A id");
  const participantB = validateParticipantId(participantBId, "Participant B id");

  return createCombatParticipantPairKey(participantA, participantB);
}

function normalizeDistancePair(input: { participantAId: string; participantBId: string }): {
  pairKey: string;
  participantAId: string;
  participantBId: string;
} {
  const pairKey = makeDistancePairKey(input.participantAId, input.participantBId);
  const [participantAId, participantBId] = pairKey.split("::");

  if (!participantAId || !participantBId) {
    throw new RangeError("Unable to normalize combat distance pair.");
  }

  return { pairKey, participantAId, participantBId };
}

export function getDistanceBetween(
  state: CombatDistanceState | undefined,
  participantAId: string,
  participantBId: string,
): CombatDistance | undefined {
  const pairKey = makeDistancePairKey(participantAId, participantBId);

  return combatDistanceStateSchema.parse(state ?? {}).edges[pairKey]?.distance;
}

export function getDistanceEdgeBetween(
  state: CombatDistanceState | undefined,
  participantAId: string,
  participantBId: string,
): CombatDistanceEdge | undefined {
  const pairKey = makeDistancePairKey(participantAId, participantBId);

  return combatDistanceStateSchema.parse(state ?? {}).edges[pairKey];
}

export function getCombatDistanceParticipantAliases(
  participant: CombatDistanceParticipantAliasLike | undefined | null,
): string[] {
  return [
    participant?.participantId,
    participant?.id,
    participant?.scenarioParticipantId,
    participant?.scenarioParticipantId
      ? `scenario-${participant.scenarioParticipantId}`
      : undefined,
    participant?.characterId,
  ].filter(
    (entry, index, aliases): entry is string =>
      typeof entry === "string" && entry.trim().length > 0 && aliases.indexOf(entry) === index,
  );
}

export function getDistanceEdgeBetweenParticipantAliases(input: {
  participantA: CombatDistanceParticipantAliasLike | undefined | null;
  participantB: CombatDistanceParticipantAliasLike | undefined | null;
  state: CombatDistanceState | undefined;
}): CombatDistanceEdge | undefined {
  const current = combatDistanceStateSchema.parse(input.state ?? {});
  const participantAAliases = getCombatDistanceParticipantAliases(input.participantA);
  const participantBAliases = getCombatDistanceParticipantAliases(input.participantB);

  for (const participantAId of participantAAliases) {
    for (const participantBId of participantBAliases) {
      if (participantAId === participantBId) {
        continue;
      }

      const pairKey = makeDistancePairKey(participantAId, participantBId);
      const edge = current.edges[pairKey];

      if (edge) {
        return edge;
      }
    }
  }

  return undefined;
}

export function setDistanceBetween(input: {
  distance: CombatDistance | number | string;
  lastChangedPhase?: string;
  lastChangedRound?: number;
  notes?: string;
  participantAId: string;
  participantBId: string;
  source: CombatDistanceSource;
  state?: CombatDistanceState;
}): CombatDistanceState {
  const current = combatDistanceStateSchema.parse(input.state ?? {});
  const pair = normalizeDistancePair(input);
  const edge = combatDistanceEdgeSchema.parse({
    ...pair,
    distance: parseCombatDistance(input.distance),
    lastChangedPhase: input.lastChangedPhase,
    lastChangedRound: input.lastChangedRound,
    notes: input.notes?.trim() || undefined,
    source: input.source,
  });

  return combatDistanceStateSchema.parse({
    edges: {
      ...current.edges,
      [pair.pairKey]: edge,
    },
  });
}

export function listDistanceEdgesForParticipant(
  state: CombatDistanceState | undefined,
  participantId: string,
): CombatDistanceEdge[] {
  const id = validateParticipantId(participantId, "Participant id");
  const current = combatDistanceStateSchema.parse(state ?? {});

  return Object.values(current.edges)
    .filter((edge) => edge.participantAId === id || edge.participantBId === id)
    .sort((left, right) => left.pairKey.localeCompare(right.pairKey));
}

function normalizePreferredDistanceValues(values: readonly unknown[]): CombatDistance[] {
  const distances = new Set<CombatDistance>();

  for (const value of values) {
    try {
      distances.add(parseCombatDistance(value, "Preferred distance"));
    } catch {
      // Ignore malformed legacy/source values. The caller reports missing metadata
      // if nothing usable remains.
    }
  }

  return [...distances].sort((left, right) => left - right);
}

function parseRangeStringPreferredDistances(range: string): CombatDistance[] {
  const values = range.match(/\d+(?:\.\d+)?/g) ?? [];

  return normalizePreferredDistanceValues(values);
}

export function getWeaponPreferredDistances(
  weapon: CombatDistanceWeaponLike | undefined | null,
): CombatDistance[] {
  if (!weapon) {
    return [];
  }

  if (Array.isArray(weapon.preferredDistances)) {
    const preferredDistances = normalizePreferredDistanceValues(weapon.preferredDistances);

    if (preferredDistances.length > 0) {
      return preferredDistances;
    }
  }

  if (typeof weapon.range === "string") {
    return parseRangeStringPreferredDistances(weapon.range);
  }

  if (typeof weapon.range === "number") {
    return normalizePreferredDistanceValues([weapon.range]);
  }

  return [];
}

export function getLongestPreferredDistance(
  weapon: CombatDistanceWeaponLike | undefined | null,
): CombatDistance | undefined {
  const distances = getWeaponPreferredDistances(weapon);

  return distances.at(-1);
}

export function getNearestPreferredDistance(
  distance: CombatDistance | number,
  preferredDistances: readonly (CombatDistance | number)[],
): CombatDistance | undefined {
  const actualDistance = parseCombatDistance(distance);
  const normalizedPreferred = normalizePreferredDistanceValues(preferredDistances);

  if (normalizedPreferred.length === 0) {
    return undefined;
  }

  return normalizedPreferred.reduce((nearest, candidate) => {
    const nearestDelta = Math.abs(actualDistance - nearest);
    const candidateDelta = Math.abs(actualDistance - candidate);

    if (candidateDelta < nearestDelta) {
      return candidate;
    }

    if (candidateDelta === nearestDelta) {
      return Math.max(nearest, candidate) as CombatDistance;
    }

    return nearest;
  }, normalizedPreferred[0] as CombatDistance);
}

export function calculateDistanceObPenalty(
  distance: CombatDistance | number,
  preferredDistances: readonly (CombatDistance | number)[],
): number {
  const actualDistance = parseCombatDistance(distance);
  const nearest = getNearestPreferredDistance(actualDistance, preferredDistances);

  if (nearest === undefined || nearest === actualDistance) {
    return 0;
  }

  return -2 * Math.abs(actualDistance - nearest);
}

export function getDefaultCombatDistanceForWeapons(input: {
  participantAWeapons?: readonly (CombatDistanceWeaponLike | undefined | null)[];
  participantBWeapons?: readonly (CombatDistanceWeaponLike | undefined | null)[];
}): CombatDistanceDefaultResult {
  const preferredDistances = [
    ...(input.participantAWeapons ?? []),
    ...(input.participantBWeapons ?? []),
  ].flatMap((weapon) => getWeaponPreferredDistances(weapon));
  const longestPreferredDistance = preferredDistances.sort((left, right) => left - right).at(-1);

  if (longestPreferredDistance !== undefined) {
    return {
      distance: longestPreferredDistance,
    };
  }

  return {
    distance: 2,
    notes:
      "Weapon preferred distance metadata was missing or invalid; defaulted to melee distance 2.",
  };
}

export function buildDefaultCombatDistanceEdge(input: {
  lastChangedPhase?: string;
  lastChangedRound?: number;
  participantAId: string;
  participantAWeapons?: readonly (CombatDistanceWeaponLike | undefined | null)[];
  participantBId: string;
  participantBWeapons?: readonly (CombatDistanceWeaponLike | undefined | null)[];
}): CombatDistanceEdge {
  const pair = normalizeDistancePair(input);
  const defaultDistance = getDefaultCombatDistanceForWeapons(input);

  return combatDistanceEdgeSchema.parse({
    ...pair,
    distance: defaultDistance.distance,
    lastChangedPhase: input.lastChangedPhase,
    lastChangedRound: input.lastChangedRound,
    notes: defaultDistance.notes,
    source: "default_weapon_reach",
  });
}

export function ensureDistanceEdgesForParticipantPairs(input: {
  lastChangedPhase?: string;
  lastChangedRound?: number;
  participantIds: readonly string[];
  refreshFallbackDefaultEdges?: boolean;
  state?: CombatDistanceState;
  weaponsByParticipantId?: Record<string, readonly (CombatDistanceWeaponLike | undefined | null)[]>;
}): CombatDistanceState {
  let nextState = combatDistanceStateSchema.parse(input.state ?? {});

  for (let leftIndex = 0; leftIndex < input.participantIds.length; leftIndex += 1) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < input.participantIds.length;
      rightIndex += 1
    ) {
      const participantAId = input.participantIds[leftIndex];
      const participantBId = input.participantIds[rightIndex];

      if (!participantAId || !participantBId) {
        continue;
      }

      const pairKey = makeDistancePairKey(participantAId, participantBId);

      const existingEdge = nextState.edges[pairKey];

      if (
        existingEdge &&
        (!input.refreshFallbackDefaultEdges ||
          existingEdge.source !== "default_weapon_reach" ||
          !existingEdge.notes?.includes("metadata was missing or invalid"))
      ) {
        continue;
      }

      const edge = buildDefaultCombatDistanceEdge({
        lastChangedPhase: input.lastChangedPhase,
        lastChangedRound: input.lastChangedRound,
        participantAId,
        participantAWeapons: input.weaponsByParticipantId?.[participantAId],
        participantBId,
        participantBWeapons: input.weaponsByParticipantId?.[participantBId],
      });

      nextState = combatDistanceStateSchema.parse({
        edges: {
          ...nextState.edges,
          [edge.pairKey]: edge,
        },
      });
    }
  }

  return nextState;
}
