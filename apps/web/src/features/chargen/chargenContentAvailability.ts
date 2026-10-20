import { validateCanonicalContent, type CanonicalContent } from "@glantri/content";

import type { CachedContentRecord } from "@/lib/offline/glantriDexie";

import {
  createTargetCompetencyChargenSource,
  getTargetCompetencyActivationBlockers,
  type TargetCompetencyChargenSource,
} from "./targetCompetencyContent";

/**
 * Chargen's persisted content cache is keyed by browser origin, so a record written by an earlier
 * build can outlive the catalogue it was written against. `buildTargetRuntimeContent` deliberately
 * rejects a source with unresolved linked-stat mappings, so a snapshot that predates a competency
 * reclassification throws. These helpers run the existing activation-blocker check *before* runtime
 * content is constructed, so an incompatible snapshot is a recoverable state rather than a throw.
 */

/** Why a content snapshot cannot be used to construct Chargen runtime content. */
export type ChargenContentRejectionReason = "activation-blockers" | "schema-invalid";

/**
 * Non-player-facing evidence about a rejected snapshot. Blocker identities are development, GM and
 * admin diagnostics; they are never surfaced in player-facing copy.
 */
export interface ChargenContentDiagnostics {
  blockers: readonly string[];
  reason: ChargenContentRejectionReason;
  recordUpdatedAt?: string;
  recordVersion?: string;
  skillCount?: number;
}

export type ChargenContentEvaluation =
  | {
      status: "usable";
      content: CanonicalContent;
      source: TargetCompetencyChargenSource;
    }
  | {
      status: "unusable";
      diagnostics: ChargenContentDiagnostics;
    };

/** Cache key holding the snapshot Chargen builds its runtime content from. */
export const CHARGEN_CONTENT_CACHE_KEY = "canonical-content";

/**
 * Key retaining the most recent rejected snapshot so the failure stays reproducible after the
 * unusable record is evicted. Chargen never reads runtime content from this key.
 */
export const CHARGEN_STALE_CONTENT_DIAGNOSTIC_KEY = "canonical-content:rejected-snapshot";

/** An explicitly empty catalogue. Used only to keep derivations total while Chargen renders its
 *  unavailable state; it is never offered as a substitute catalogue. */
export const EMPTY_CHARGEN_CONTENT: CanonicalContent = {
  civilizations: [],
  languages: [],
  professionFamilies: [],
  professionSkills: [],
  professions: [],
  skillGroups: [],
  skills: [],
  societies: [],
  societyBandSkillAccess: [],
  societyLevels: [],
  specializations: [],
};

/**
 * Validates one already schema-valid content snapshot with the existing Target activation-blocker
 * mechanism. A snapshot with blockers is unusable; nothing is substituted in its place.
 */
export function evaluateChargenContent(content: CanonicalContent): ChargenContentEvaluation {
  const source = createTargetCompetencyChargenSource(content);
  const blockers = getTargetCompetencyActivationBlockers(source);

  if (blockers.length > 0) {
    return {
      status: "unusable",
      diagnostics: {
        blockers,
        reason: "activation-blockers",
        skillCount: content.skills.length,
      },
    };
  }

  return { content, source, status: "usable" };
}

/**
 * Evaluates a persisted cache record. Schema validation failures are reported rather than thrown,
 * so a record written by an earlier build cannot abort hydration.
 */
export function evaluateCachedChargenContent(
  record: CachedContentRecord | undefined,
): ChargenContentEvaluation | undefined {
  if (!record) {
    return undefined;
  }

  let validated: CanonicalContent;

  try {
    validated = validateCanonicalContent(record.value);
  } catch {
    return {
      status: "unusable",
      diagnostics: {
        blockers: [],
        reason: "schema-invalid",
        recordUpdatedAt: record.updatedAt,
        recordVersion: record.version,
      },
    };
  }

  const evaluation = evaluateChargenContent(validated);

  if (evaluation.status === "unusable") {
    return {
      status: "unusable",
      diagnostics: {
        ...evaluation.diagnostics,
        recordUpdatedAt: record.updatedAt,
        recordVersion: record.version,
      },
    };
  }

  return evaluation;
}

/** Formats rejected-snapshot evidence for the development/GM console. Not player-facing copy. */
export function formatChargenContentDiagnostics(
  diagnostics: ChargenContentDiagnostics,
  origin: "cached snapshot" | "current authoritative content",
): string {
  const parts = [
    `Chargen rejected ${origin}: ${diagnostics.reason}.`,
    diagnostics.blockers.length > 0
      ? `Unresolved linked-stat competencies: ${diagnostics.blockers.join(", ")}.`
      : undefined,
    diagnostics.recordVersion ? `Record version: ${diagnostics.recordVersion}.` : undefined,
    diagnostics.recordUpdatedAt ? `Record updated: ${diagnostics.recordUpdatedAt}.` : undefined,
    diagnostics.skillCount === undefined
      ? undefined
      : `Skills in snapshot: ${diagnostics.skillCount}.`,
  ];

  return parts.filter((part): part is string => Boolean(part)).join(" ");
}
