import type {
  CombatResultAdjustmentMetadata,
  CombatResultCalculationReference,
  CombatResultConsequence,
  CombatResultEnvelope,
  CombatResultParticipant,
} from "@glantri/domain";

import type { CombatCalculationPresentation } from "./combatCalculationPresentation";

export interface CombatResultLedgerParticipantPresentation {
  readonly hidden: boolean;
  readonly id?: string;
  readonly label: string;
}

export interface CombatResultLedgerRowPresentation {
  readonly key: string;
  readonly text: string;
}

export interface CombatResultLedgerSubordinatePresentation {
  readonly actor?: CombatResultLedgerParticipantPresentation;
  readonly calculations: readonly CombatCalculationPresentation[];
  readonly completenessLabel?: string;
  readonly heading: string;
  readonly id: string;
  readonly outcomeRows: readonly CombatResultLedgerRowPresentation[];
  readonly resultEnvelopes: readonly CombatResultEnvelope[];
  readonly sequence: number;
  readonly sourceEventIds: readonly string[];
  readonly state: "pending" | "final";
  readonly summary: string;
  readonly target?: CombatResultLedgerParticipantPresentation;
}

export type CombatResultGroupCompleteness =
  | "complete"
  | "legacy_derived"
  | "incomplete"
  | "interleaved";

export interface CombatResultGroupPresentation {
  readonly actionInstanceId?: string;
  readonly actionType?: CombatResultEnvelope["actionType"];
  readonly actor?: CombatResultParticipant;
  readonly adjustment?: CombatResultAdjustmentMetadata;
  readonly calculationReferences: readonly CombatResultCalculationReference[];
  readonly committedConsequences: readonly CombatResultConsequence[];
  readonly completeness: CombatResultGroupCompleteness;
  readonly conciseOutcome?: CombatResultEnvelope["conciseOutcome"];
  readonly firstSequence: number;
  readonly groupId: string;
  readonly heading: string;
  readonly lastSequence: number;
  readonly provenance: {
    readonly groupingIdentity?: string;
    readonly groupingIdentitySource:
      | "action_instance"
      | "command"
      | "process"
      | "parent"
      | "legacy_separate";
    readonly resultIds: readonly string[];
    readonly sourceEventIds: readonly string[];
  };
  readonly publicCombatNotes: readonly string[];
  readonly rootResultId: string;
  readonly round?: number;
  readonly standardConsequences: readonly CombatResultConsequence[];
  readonly step?: CombatResultEnvelope["step"];
  readonly subordinateResults: readonly CombatResultLedgerSubordinatePresentation[];
  readonly targets: readonly CombatResultParticipant[];
  readonly visibility: readonly CombatResultEnvelope["visibility"][];
}

export interface CombatResultLedgerFragmentInput {
  readonly actionInstanceId?: string;
  readonly commandId?: string;
  readonly parentResultId?: string;
  readonly processId?: string;
  readonly result: CombatResultLedgerSubordinatePresentation;
  /** Stable display order after canonical sequence and process-local semantic ordering. */
  readonly sortOrder?: number;
}

interface GroupingIdentity {
  readonly key: string;
  readonly source: CombatResultGroupPresentation["provenance"]["groupingIdentitySource"];
  readonly value?: string;
}

function firstEnvelope(
  result: CombatResultLedgerSubordinatePresentation,
): CombatResultEnvelope | undefined {
  return result.resultEnvelopes[0];
}

function groupingIdentity(fragment: CombatResultLedgerFragmentInput): GroupingIdentity {
  const envelopeIdentity = fragment.result.resultEnvelopes.find(
    (envelope) => envelope.actionInstanceId,
  )?.actionInstanceId;
  if (envelopeIdentity) {
    return {
      key: `action:${envelopeIdentity}`,
      source: "action_instance",
      value: envelopeIdentity,
    };
  }
  if (fragment.actionInstanceId) {
    return {
      key: `action:${fragment.actionInstanceId}`,
      source: "action_instance",
      value: fragment.actionInstanceId,
    };
  }
  if (fragment.commandId) {
    return { key: `command:${fragment.commandId}`, source: "command", value: fragment.commandId };
  }
  if (fragment.processId) {
    return { key: `process:${fragment.processId}`, source: "process", value: fragment.processId };
  }
  if (fragment.parentResultId) {
    return {
      key: `parent:${fragment.parentResultId}`,
      source: "parent",
      value: fragment.parentResultId,
    };
  }
  return {
    key: `event:${fragment.result.id}`,
    source: "legacy_separate",
  };
}

function groupHeading(results: readonly CombatResultLedgerSubordinatePresentation[]): string {
  const types = new Set(
    results.flatMap((result) => result.resultEnvelopes.map((envelope) => envelope.actionType)),
  );
  if ([...types].some((type) => type.startsWith("feint_"))) return "Feint";
  if ([...types].some((type) => type.startsWith("adjust_distance_"))) return "Adjust Distance";
  if (
    [...types].some(
      (type) =>
        type === "hit_location" ||
        type === "critical" ||
        type === "damage_proposed" ||
        type === "damage_committed",
    )
  ) {
    return "Damage";
  }
  if ([...types].some((type) => type === "attack" || type === "parry")) return "Attack";
  return results[0]?.heading ?? "Combat result";
}

function deduplicateCalculations(
  results: readonly CombatResultLedgerSubordinatePresentation[],
): CombatResultLedgerSubordinatePresentation[] {
  const seen = new Set<string>();
  return results.map((result) => ({
    ...result,
    calculations: result.calculations.filter((calculation) => {
      if (seen.has(calculation.calculationId)) return false;
      seen.add(calculation.calculationId);
      return true;
    }),
  }));
}

function lastEnvelopeWith<T>(
  envelopes: readonly CombatResultEnvelope[],
  select: (envelope: CombatResultEnvelope) => T | undefined,
): T | undefined {
  for (let index = envelopes.length - 1; index >= 0; index -= 1) {
    const value = select(envelopes[index]!);
    if (value !== undefined) return value;
  }
  return undefined;
}

function completeness(envelopes: readonly CombatResultEnvelope[]): CombatResultGroupCompleteness {
  if (envelopes.some((envelope) => envelope.provenance.completeness === "incomplete")) {
    return "incomplete";
  }
  if (envelopes.some((envelope) => envelope.provenance.completeness === "legacy_derived")) {
    return "legacy_derived";
  }
  return "complete";
}

function buildGroup(input: {
  fragments: readonly CombatResultLedgerFragmentInput[];
  identity: GroupingIdentity;
  segment: number;
}): CombatResultGroupPresentation {
  const results = deduplicateCalculations(input.fragments.map((fragment) => fragment.result));
  const envelopes = results.flatMap((result) => result.resultEnvelopes);
  const first = results[0]!;
  const last = results.at(-1)!;
  const latestConsequences:
    | {
        adjustment?: CombatResultAdjustmentMetadata;
        committed: readonly CombatResultConsequence[];
        standard: readonly CombatResultConsequence[];
      }
    | undefined = lastEnvelopeWith(envelopes, (envelope) =>
    envelope.committedConsequences.length || envelope.standardConsequences.length
      ? {
          adjustment: envelope.adjustment,
          committed: envelope.committedConsequences,
          standard: envelope.standardConsequences,
        }
      : undefined,
  );
  const resultIds = [...new Set(envelopes.map((envelope) => envelope.resultId))];
  const sourceEventIds = [...new Set(results.flatMap((result) => result.sourceEventIds))];
  const publicCombatNotes = [
    ...new Set(
      envelopes.flatMap((envelope) =>
        envelope.publicCombatNote ? [envelope.publicCombatNote] : [],
      ),
    ),
  ];
  const groupId =
    input.identity.source === "legacy_separate"
      ? `combat-result-group:${first.id}`
      : `combat-result-group:${input.identity.key}${
          input.segment > 0 ? `:segment:${first.sequence}` : ""
        }`;
  const rootEnvelope = firstEnvelope(first);
  return {
    actionInstanceId:
      input.identity.source === "action_instance" ? input.identity.value : undefined,
    actionType: rootEnvelope?.actionType,
    actor: lastEnvelopeWith(envelopes, (envelope) => envelope.actor),
    adjustment: latestConsequences?.adjustment,
    calculationReferences: [
      ...new Map(
        envelopes
          .flatMap((envelope) => envelope.calculationReferences)
          .map((reference) => [
            `${reference.kind}:${reference.sourceId}:${reference.ownerParticipantId ?? ""}`,
            reference,
          ]),
      ).values(),
    ],
    committedConsequences: latestConsequences?.committed ?? [],
    completeness: completeness(envelopes),
    conciseOutcome: lastEnvelopeWith(envelopes, (envelope) => envelope.conciseOutcome),
    firstSequence: first.sequence,
    groupId,
    heading: groupHeading(results),
    lastSequence: last.sequence,
    provenance: {
      groupingIdentity: input.identity.value,
      groupingIdentitySource: input.identity.source,
      resultIds: resultIds.length ? resultIds : [first.id],
      sourceEventIds,
    },
    publicCombatNotes,
    rootResultId: rootEnvelope?.resultId ?? first.id,
    round: rootEnvelope?.round,
    standardConsequences: latestConsequences?.standard ?? [],
    step: rootEnvelope?.step,
    subordinateResults: results,
    targets:
      lastEnvelopeWith(envelopes, (envelope) =>
        envelope.targets.length ? envelope.targets : undefined,
      ) ?? [],
    visibility: envelopes.map((envelope) => envelope.visibility),
  };
}

/**
 * Builds atomic result groups without inferring identity from actor, target, labels, steps, or
 * adjacency. A repeated identity separated by another group becomes a new visible segment so
 * true canonical interleaving is not concealed.
 */
export function buildCombatResultGroups(
  fragments: readonly CombatResultLedgerFragmentInput[],
): CombatResultGroupPresentation[] {
  const ordered = [...fragments].sort(
    (left, right) =>
      (left.sortOrder ?? left.result.sequence) - (right.sortOrder ?? right.result.sequence) ||
      left.result.sequence - right.result.sequence ||
      left.result.id.localeCompare(right.result.id),
  );
  const groups: CombatResultGroupPresentation[] = [];
  let current:
    | {
        fragments: CombatResultLedgerFragmentInput[];
        identity: GroupingIdentity;
        segment: number;
      }
    | undefined;
  const completedSegments = new Map<string, number>();

  const flush = () => {
    if (!current) return;
    groups.push(buildGroup(current));
    completedSegments.set(current.identity.key, current.segment + 1);
    current = undefined;
  };

  for (const fragment of ordered) {
    const identity = groupingIdentity(fragment);
    if (current?.identity.key === identity.key) {
      current.fragments.push(fragment);
      continue;
    }
    flush();
    current = {
      fragments: [fragment],
      identity,
      segment: completedSegments.get(identity.key) ?? 0,
    };
  }
  flush();
  const interleavedIdentities = new Set(
    groups
      .filter((group) => group.provenance.groupingIdentitySource !== "legacy_separate")
      .flatMap((group) =>
        group.provenance.groupingIdentity ? [group.provenance.groupingIdentity] : [],
      )
      .filter(
        (identity, index, identities) =>
          identities.indexOf(identity) !== identities.lastIndexOf(identity),
      ),
  );
  return groups.map((group) =>
    group.provenance.groupingIdentity &&
    interleavedIdentities.has(group.provenance.groupingIdentity)
      ? { ...group, completeness: "interleaved" }
      : group,
  );
}
