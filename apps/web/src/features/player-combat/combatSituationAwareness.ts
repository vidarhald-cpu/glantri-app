import type {
  CanonicalCombatModifierEffect,
  CombatEffect,
  CombatRoundStep,
  ContinuedContact,
  PlayerSafeCanonicalCombatModifierEffect,
  ScenarioCombatModifierBucket,
  ScenarioCombatModifierEntry,
  UnbalancedCombatCondition,
} from "@glantri/domain";
import {
  canonicalCombatModifierEffectSchema,
  playerSafeCanonicalCombatModifierEffectSchema,
} from "@glantri/domain";

export type CombatSituationLifecycleEffect =
  | CanonicalCombatModifierEffect
  | PlayerSafeCanonicalCombatModifierEffect;

export interface CombatSituationModifierRowInput {
  application?: ScenarioCombatModifierEntry["application"];
  canonicalLifecycle?: CombatSituationLifecycleEffect;
  id: string;
  scopeLabel?: string;
  sourceLabel?: string;
  value: number;
}

export interface CombatSituationModifierBucketInput {
  bucketKey: ScenarioCombatModifierBucket;
  derivedEntries?: readonly CombatSituationModifierRowInput[];
  entries: readonly ScenarioCombatModifierEntry[];
  label: string;
  total: number;
}

export interface CombatSituationContext {
  opponentParticipantId?: string;
  participantLabels?: Readonly<Record<string, string>>;
  phase?: "phase1" | "phase2";
  roundNumber?: number;
  step?: CombatRoundStep;
}

export interface CombatSituationDisplayRow {
  durationLabel?: string;
  id: string;
  label: string;
  scopeLabel?: string;
  valueLabel?: string;
}

export interface CombatSituationCalculationGroup {
  id: string;
  label: string;
  rows: CombatSituationDisplayRow[];
  totalLabel: string;
}

export interface CombatSituationAwarenessModel {
  calculationGroups: CombatSituationCalculationGroup[];
  conditions: CombatSituationDisplayRow[];
  empty: boolean;
  pending: CombatSituationDisplayRow[];
  provisional: boolean;
  restrictions: CombatSituationDisplayRow[];
}

const ACTIVE_STATES = new Set(["active"]);
const PENDING_STATES = new Set(["proposed", "provisional", "pending_review", "pending_activation"]);
const CONDITION_KINDS = new Set(["stunned", "continued_contact", "unbalanced", "condition"]);

function parseCanonicalEffect(value: unknown): CombatSituationLifecycleEffect | undefined {
  const parsed = canonicalCombatModifierEffectSchema.safeParse(value);
  if (parsed.success) return parsed.data;
  const playerSafe = playerSafeCanonicalCombatModifierEffectSchema.safeParse(value);
  return playerSafe.success ? playerSafe.data : undefined;
}

function formatSigned(value: number): string {
  return `${value >= 0 ? "+" : ""}${value}`;
}

function formatEffectValue(effect: CombatSituationLifecycleEffect): string | undefined {
  if (effect.payload.kind !== "numeric") return undefined;
  switch (effect.payload.unit) {
    case "percentage":
      return `${formatSigned(effect.payload.value)}%`;
    case "flat_db":
      return formatSigned(effect.payload.value);
    case "initiative_value":
      return formatSigned(effect.payload.value);
    case "damage":
      return `${effect.payload.value} HP`;
    case "bleed_rate":
      return `${effect.payload.value} HP/round`;
    case "integer_count":
      return String(effect.payload.value);
  }
}

function formatEntryValue(entry: CombatSituationModifierRowInput): string {
  const effectValue = entry.canonicalLifecycle
    ? formatEffectValue(entry.canonicalLifecycle)
    : undefined;
  if (effectValue !== undefined) return effectValue;
  return `${formatSigned(entry.value)}${entry.application !== "flat_db" ? "%" : ""}`;
}

function formatDuration(effect: CombatSituationLifecycleEffect): string | undefined {
  const duration = effect.lifecycle.duration;
  switch (duration.kind) {
    case "phase":
      return duration.phase === "phase1" ? "Phase 1" : "Phase 2";
    case "rounds":
      return `${duration.remaining} ${duration.remaining === 1 ? "round" : "rounds"}`;
    case "attack_opportunity_count":
      return `${duration.remaining} ${duration.remaining === 1 ? "attack" : "attacks"}`;
    case "until_check":
      return "Check required";
    case "until_condition":
      return "Until cleared";
    case "relationship":
      return undefined;
    case "manual":
    case "indefinite":
      return undefined;
    case "legacy_untyped":
      return undefined;
  }
}

function categoryBucket(
  effect: CombatSituationLifecycleEffect,
): ScenarioCombatModifierBucket | undefined {
  if (effect.payload.kind !== "numeric") return undefined;
  switch (effect.payload.category) {
    case "general_fatigue":
      return "general";
    case "initiative":
      return "situation_initiative";
    case "skill_ob":
      return "situation_ob_skill";
    case "db_parry":
      return "situation_db";
    default:
      return undefined;
  }
}

function fallbackSourceLabel(entry: ScenarioCombatModifierEntry): string {
  if (entry.sourceActionId === "parry") return "Parry";
  if (entry.sourceType === "feint" || entry.sourceRule?.startsWith("feint")) return "Feint";
  if (entry.sourceRule?.includes("adjust-distance") || entry.sourceRule?.startsWith("distance-")) {
    return "Distance";
  }
  if (entry.sourceRule?.includes("offensive-parry")) return "Offensive Parry";
  if (entry.sourceType === "character_effect") {
    return entry.notes?.trim() || "Combat effect";
  }
  return entry.notes?.trim() || "Situational";
}

function opponentScope(
  effect: CombatSituationLifecycleEffect | undefined,
  context: CombatSituationContext,
): string | undefined {
  const opponentId =
    effect?.applicability.opponentParticipantId ?? effect?.applicability.targetParticipantId;
  if (!opponentId) return undefined;
  const label = context.participantLabels?.[opponentId] ?? opponentId;
  return `Against ${label}`;
}

function effectMatchesContext(
  effect: CombatSituationLifecycleEffect,
  context: CombatSituationContext,
): boolean {
  const applicability = effect.applicability;
  if (applicability.roundNumber && applicability.roundNumber !== context.roundNumber) return false;
  if (applicability.phase && applicability.phase !== context.phase) return false;
  if (applicability.step && applicability.step !== context.step) return false;
  const opponentId = applicability.opponentParticipantId ?? applicability.targetParticipantId;
  if (opponentId && opponentId !== context.opponentParticipantId) return false;
  return true;
}

function dedupeEffects(
  effects: readonly CombatSituationLifecycleEffect[],
): CombatSituationLifecycleEffect[] {
  const byId = new Map<string, CombatSituationLifecycleEffect>();
  for (const effect of effects) {
    const existing = byId.get(effect.id);
    if (
      !existing ||
      ("version" in effect && effect.version > ("version" in existing ? existing.version : 0))
    ) {
      byId.set(effect.id, effect);
    }
  }
  return [...byId.values()];
}

function calculationEntry(input: {
  context: CombatSituationContext;
  entry: CombatSituationModifierRowInput;
}): CombatSituationDisplayRow {
  const effect = input.entry.canonicalLifecycle;
  return {
    durationLabel: effect ? formatDuration(effect) : undefined,
    id: effect?.id ?? input.entry.id,
    label: effect?.publicLabel ?? input.entry.sourceLabel ?? "Combat modifier",
    scopeLabel: opponentScope(effect, input.context) ?? input.entry.scopeLabel,
    valueLabel: formatEntryValue(input.entry),
  };
}

function totalLabel(input: {
  entries: readonly CombatSituationModifierRowInput[];
  total: number;
}): string {
  const allPercentage =
    input.entries.length > 0 &&
    input.entries.every((entry) =>
      entry.canonicalLifecycle?.payload.kind === "numeric"
        ? entry.canonicalLifecycle.payload.unit === "percentage"
        : entry.application !== "flat_db",
    );
  return `${formatSigned(input.total)}${allPercentage ? "%" : ""}`;
}

export function buildCombatSituationAwarenessModel(input: {
  context?: CombatSituationContext;
  lifecycleEffects?: readonly CombatSituationLifecycleEffect[];
  pendingEntries?: readonly ScenarioCombatModifierEntry[];
  provisional?: boolean;
  rows: readonly CombatSituationModifierBucketInput[];
}): CombatSituationAwarenessModel {
  const context = input.context ?? {};
  const rowEffects = input.rows.flatMap((bucket) => [
    ...bucket.entries.flatMap((entry) => {
      const effect = parseCanonicalEffect(entry.canonicalLifecycle);
      return effect ? [effect] : [];
    }),
    ...(bucket.derivedEntries ?? []).flatMap((entry) =>
      entry.canonicalLifecycle ? [entry.canonicalLifecycle] : [],
    ),
  ]);
  const effects = dedupeEffects([...(input.lifecycleEffects ?? []), ...rowEffects]);
  const representedEffectIds = new Set(rowEffects.map((effect) => effect.id));

  const calculationGroups = input.rows.flatMap((bucket) => {
    const sourceEntries: CombatSituationModifierRowInput[] = [
      ...bucket.entries.flatMap((entry): CombatSituationModifierRowInput[] => {
        const canonicalLifecycle = parseCanonicalEffect(entry.canonicalLifecycle);
        if (
          (entry.sourcePhase && entry.sourcePhase !== context.phase) ||
          (canonicalLifecycle &&
            (!ACTIVE_STATES.has(canonicalLifecycle.lifecycle.state) ||
              !effectMatchesContext(canonicalLifecycle, context)))
        ) {
          return [];
        }
        return [
          {
            application: entry.application,
            canonicalLifecycle,
            id: entry.id,
            scopeLabel:
              entry.sourcePhase === "phase1"
                ? "Phase 1"
                : entry.sourcePhase === "phase2"
                  ? "Phase 2"
                  : undefined,
            sourceLabel: canonicalLifecycle?.publicLabel ?? fallbackSourceLabel(entry),
            value: entry.value,
          },
        ];
      }),
      ...(bucket.derivedEntries ?? []).filter(
        (entry) =>
          !entry.canonicalLifecycle ||
          (ACTIVE_STATES.has(entry.canonicalLifecycle.lifecycle.state) &&
            effectMatchesContext(entry.canonicalLifecycle, context)),
      ),
      ...effects.flatMap((effect): CombatSituationModifierRowInput[] => {
        if (
          representedEffectIds.has(effect.id) ||
          categoryBucket(effect) !== bucket.bucketKey ||
          !ACTIVE_STATES.has(effect.lifecycle.state) ||
          !effectMatchesContext(effect, context) ||
          effect.payload.kind !== "numeric" ||
          effect.payload.value === 0
        ) {
          return [];
        }
        representedEffectIds.add(effect.id);
        return [
          {
            application: effect.payload.unit === "percentage" ? "percentage" : undefined,
            canonicalLifecycle: effect,
            id: effect.id,
            value: effect.payload.value,
          },
        ];
      }),
    ].filter((entry) => entry.value !== 0);
    const unique = [
      ...new Map(
        sourceEntries.map((entry) => [entry.canonicalLifecycle?.id ?? entry.id, entry]),
      ).values(),
    ];
    if (unique.length === 0) return [];
    return [
      {
        id: bucket.bucketKey,
        label: bucket.label,
        rows: unique.map((entry) => calculationEntry({ context, entry })),
        totalLabel: totalLabel({ entries: unique, total: bucket.total }),
      },
    ];
  });

  const conditions: CombatSituationDisplayRow[] = [];
  const restrictions: CombatSituationDisplayRow[] = [];
  const pending: CombatSituationDisplayRow[] = [];
  for (const effect of effects) {
    if (!effectMatchesContext(effect, context)) continue;
    const display: CombatSituationDisplayRow = {
      durationLabel: formatDuration(effect),
      id: effect.id,
      label: effect.publicLabel,
      scopeLabel: opponentScope(effect, context),
      valueLabel: formatEffectValue(effect),
    };
    if (PENDING_STATES.has(effect.lifecycle.state)) {
      pending.push(display);
      continue;
    }
    if (!ACTIVE_STATES.has(effect.lifecycle.state)) continue;
    if (effect.payload.kind === "restriction") {
      (CONDITION_KINDS.has(effect.payload.effectKind) ? conditions : restrictions).push(display);
      continue;
    }
    if (
      effect.payload.category === "bleed_rate" ||
      effect.payload.category === "damage" ||
      effect.payload.contributionScope === "state"
    ) {
      conditions.push(display);
    }
  }

  for (const entry of input.pendingEntries ?? []) {
    const lifecycle = parseCanonicalEffect(entry.canonicalLifecycle);
    if (lifecycle && pending.some((row) => row.id === lifecycle.id)) {
      continue;
    }
    pending.push({
      id: lifecycle?.id ?? entry.id,
      label: lifecycle?.publicLabel ?? fallbackSourceLabel(entry),
      valueLabel: lifecycle
        ? formatEffectValue(lifecycle)
        : `${formatSigned(entry.value)}${entry.application !== "flat_db" ? "%" : ""}`,
    });
  }

  const byLabel = (left: CombatSituationDisplayRow, right: CombatSituationDisplayRow) =>
    left.label.localeCompare(right.label) || left.id.localeCompare(right.id);
  conditions.sort(byLabel);
  restrictions.sort(byLabel);
  pending.sort(byLabel);

  return {
    calculationGroups,
    conditions,
    empty:
      calculationGroups.length === 0 &&
      conditions.length === 0 &&
      restrictions.length === 0 &&
      pending.length === 0,
    pending,
    provisional: input.provisional === true,
    restrictions,
  };
}

export function collectCanonicalCombatSituationEffects(input: {
  combatEffects?: readonly CombatEffect[];
  continuedContacts?: readonly ContinuedContact[];
  ownerParticipantId?: string;
  ownerParticipantIds?: readonly string[];
  unbalancedConditions?: readonly UnbalancedCombatCondition[];
}): CanonicalCombatModifierEffect[] {
  const ownerParticipantIds = new Set(
    [input.ownerParticipantId, ...(input.ownerParticipantIds ?? [])].filter((id): id is string =>
      Boolean(id),
    ),
  );
  const belongsToOwner = (participantId: string) =>
    ownerParticipantIds.size === 0 || ownerParticipantIds.has(participantId);
  const effects = [
    ...(input.combatEffects ?? []).flatMap((effect) => {
      const lifecycle = parseCanonicalEffect(effect.canonicalLifecycle);
      return lifecycle && belongsToOwner(lifecycle.ownerParticipantId) ? [lifecycle] : [];
    }),
    ...(input.continuedContacts ?? []).flatMap((contact) =>
      contact.canonicalLifecycle &&
      (belongsToOwner(contact.controllerParticipantId) ||
        belongsToOwner(contact.affectedParticipantId))
        ? [parseCanonicalEffect(contact.canonicalLifecycle)].filter(
            (effect): effect is CanonicalCombatModifierEffect => Boolean(effect),
          )
        : [],
    ),
    ...(input.unbalancedConditions ?? []).flatMap((condition) =>
      condition.canonicalLifecycle && belongsToOwner(condition.affectedParticipantId)
        ? [parseCanonicalEffect(condition.canonicalLifecycle)].filter(
            (effect): effect is CanonicalCombatModifierEffect => Boolean(effect),
          )
        : [],
    ),
  ];
  return dedupeEffects(effects).filter(
    (effect): effect is CanonicalCombatModifierEffect => "createdAt" in effect,
  );
}
