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
  /** Duration known from player-visible entry fields; used only when no canonical lifecycle is present. */
  durationLabel?: string;
  id: string;
  scopeLabel?: string;
  sourceLabel?: string;
  value: number;
}

export interface CombatSituationModifierBucketInput {
  bucketKey: ScenarioCombatModifierBucket;
  derivedEntries?: readonly CombatSituationModifierRowInput[];
  /** Duration labels by entry id, from `buildEntryDurationLabels`. Absent entries have no known duration. */
  durationLabels?: Readonly<Record<string, string>>;
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
  /**
   * At least one row in this group carries a value this surface could not render, so the
   * rows beneath the total do not visibly account for all of it. The total itself is
   * still the authoritative figure the engine applies and is never adjusted for this.
   *
   * This is structured state deliberately. Encoding the condition into `totalLabel`'s
   * string would corrupt the authoritative number and would leave the condition
   * detectable only by parsing copy back out again.
   */
  breakdownIncomplete: boolean;
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

/**
 * The player-facing indication that the data carried a value this surface does not
 * recognize. This is an error state, not an absence, and it must read as visibly
 * distinct from both.
 *
 * It is deliberately **not** `"—"`: that glyph already means "no value" here —
 * `hasDisplayValue` in `playerCombatPhaseModel.ts` returns `false` for it — so reusing
 * it would make unrecognized input indistinguishable from legitimate absence. It is
 * also not `"Unavailable"`, which this codebase already uses for data that is
 * legitimately missing or withheld (`FeintSkillPreview`, `currentActionPresentation`),
 * and which would reproduce the same conflation one word further along.
 *
 * It joins the existing player-facing `"Unknown X"` vocabulary (`"Unknown item"` in
 * `features/equipment`, `"Unknown participant"` and `"Unknown skill"` in
 * `features/roleplay`): a word, never a number, and never mistakable for a real value.
 */
const UNRENDERABLE_VALUE_LABEL = "Unknown value";

/**
 * The player-facing indication that a calculation group's total is still the figure the
 * engine actually applies, while the rows beneath it do not visibly account for all of
 * it because at least one contribution could not be rendered.
 *
 * It states **both** facts the ruling on this condition requires: the number is exact,
 * and its decomposition is not complete. It does so tersely: each fact is named once, and
 * dropping either half would leave the other unstated.
 *
 * It is deliberately **not** `UNRENDERABLE_VALUE_LABEL`. That is a row-level statement
 * about one value; this is a group-level statement about the relationship between the
 * total and the rows. Reusing one string for both would collapse two different claims
 * into one. It is also not `"—"` (absence on this surface) and not `"Unavailable"`
 * (legitimately missing or withheld data elsewhere in this codebase) — the total is
 * neither absent nor withheld.
 *
 * `"incomplete"` is the codebase's existing word for partially-known presentation
 * (`"Incomplete history"` in `combat-history/view-models/buildCombatEventResultModel`,
 * `"Combat state incomplete"` in `currentActionPresentation`), so this joins a family
 * rather than inventing a vocabulary.
 */
export const INCOMPLETE_BREAKDOWN_LABEL = "Exact total; incomplete breakdown.";

/**
 * The three distinct outcomes of rendering a canonical effect's value.
 *
 * A single `string | undefined` return cannot express them, and that conflation is the
 * defect this type exists to close: `no_effect_value` and `unrenderable` are both
 * "no string", but only the first may fall through to the ordinary entry rendering.
 *
 * - `rendered` — the payload is numeric and its unit has an explicit rendering.
 * - `no_effect_value` — the payload is not numeric, so the effect carries no value of
 *   its own. Legitimate and expected, not an error.
 * - `unrenderable` — the payload is numeric but its unit is not one this surface knows
 *   how to state. Only reachable when data escapes the type boundary, and an error.
 */
type EffectValueRendering =
  | { kind: "no_effect_value" }
  | { kind: "rendered"; label: string }
  | { kind: "unrenderable" };

/**
 * Renders the player-facing value for a canonical lifecycle effect.
 *
 * Every member of `CanonicalCombatModifierUnit` must have an explicit `case` arm. The
 * `default` arm binds the narrowed `unit` to `never`, so adding a payload unit without a
 * case arm is a compile-time failure.
 *
 * The `never` binding is erased at runtime, so it cannot protect against malformed,
 * downlevel or hand-edited persisted data. The `default` arm therefore also returns an
 * explicit `unrenderable` outcome at runtime. Callers must not substitute another
 * semantic value for it: an unrecognized unit renders `UNRENDERABLE_VALUE_LABEL`, never
 * a number drawn from a different source.
 */
function renderEffectValue(effect: CombatSituationLifecycleEffect): EffectValueRendering {
  // Deliberate non-value: a restriction payload carries no numeric value to state, which
  // is expected rather than an error, so the ordinary entry rendering may still apply.
  if (effect.payload.kind !== "numeric") return { kind: "no_effect_value" };
  const payload = effect.payload;
  switch (payload.unit) {
    case "percentage":
      return { kind: "rendered", label: `${formatSigned(payload.value)}%` };
    case "flat_db":
      return { kind: "rendered", label: formatSigned(payload.value) };
    case "initiative_value":
      return { kind: "rendered", label: formatSigned(payload.value) };
    case "damage":
      return { kind: "rendered", label: `${payload.value} HP` };
    case "bleed_rate":
      return { kind: "rendered", label: `${payload.value}/10 HP per round` };
    case "integer_count":
      return { kind: "rendered", label: String(payload.value) };
    default: {
      // Compile-time half of the guard: this binding fails to compile if a unit has no
      // case arm. It is erased at runtime, so the `unrenderable` return below is the
      // runtime half and the two are not interchangeable.
      const exhaustive: never = payload.unit;
      void exhaustive;
      return { kind: "unrenderable" };
    }
  }
}

/**
 * The effect-derived value label for a display row, or `undefined` when the effect
 * carries no value of its own.
 *
 * An unrecognized unit resolves to the explicit unknown-value indication rather
 * than to `undefined`, so it is visibly distinct on the surface from both a legitimate
 * absence and a rendered value.
 */
export function formatEffectValue(effect: CombatSituationLifecycleEffect): string | undefined {
  const rendering = renderEffectValue(effect);
  switch (rendering.kind) {
    case "rendered":
      return rendering.label;
    case "unrenderable":
      return UNRENDERABLE_VALUE_LABEL;
    case "no_effect_value":
      return undefined;
    default: {
      const exhaustive: never = rendering;
      return exhaustive;
    }
  }
}

/**
 * Whether this entry's value could not be rendered.
 *
 * Detection reads the canonical `unrenderable` outcome from `renderEffectValue`. It must
 * never be derived by comparing a rendered label against `UNRENDERABLE_VALUE_LABEL`: that
 * copy has already changed twice, and a string comparison would have silently stopped
 * detecting on each change while continuing to pass a label-shaped test.
 */
function hasUnrenderableValue(entry: CombatSituationModifierRowInput): boolean {
  const effect = entry.canonicalLifecycle;
  if (!effect) return false;
  return renderEffectValue(effect).kind === "unrenderable";
}

function formatEntryValue(entry: CombatSituationModifierRowInput): string {
  const entryValueLabel = `${formatSigned(entry.value)}${entry.application !== "flat_db" ? "%" : ""}`;
  if (!entry.canonicalLifecycle) return entryValueLabel;
  const rendering = renderEffectValue(entry.canonicalLifecycle);
  switch (rendering.kind) {
    case "rendered":
      return rendering.label;
    // An unrecognized unit must not fall back to `entry.value`: that is a different value
    // from a different source, with a suffix guessed from `entry.application`, and it
    // would read as a plausible figure while being wrong.
    case "unrenderable":
      return UNRENDERABLE_VALUE_LABEL;
    // A non-numeric payload has no value of its own, so the ordinary entry rendering is
    // the correct answer rather than a substitution.
    case "no_effect_value":
      return entryValueLabel;
    default: {
      const exhaustive: never = rendering;
      return exhaustive;
    }
  }
}

/**
 * Renders the player-facing duration chip for a canonical lifecycle effect.
 *
 * Every member of `CanonicalCombatModifierDuration["kind"]` must have an explicit
 * `case` arm. The `default` arm below binds the narrowed `duration` to `never`, so
 * adding a duration kind without a case arm is a compile-time failure rather than a
 * silent `undefined` and a missing chip on the Situation surface.
 *
 * The arms returning `undefined` are deliberate blanks, not forgotten cases: a named
 * arm returning `undefined` records the intent, whereas falling off the end of the
 * switch records nothing.
 */
export function formatDuration(effect: CombatSituationLifecycleEffect): string | undefined {
  const duration = effect.lifecycle.duration;
  switch (duration.kind) {
    case "phase":
      return duration.phase === "phase1" ? "Phase 1" : "Phase 2";
    case "rounds":
      return `${duration.remaining} ${duration.remaining === 1 ? "round" : "rounds"}`;
    // Remainder-only state runs from creation through that same round's Round End and is absent
    // when the next round begins. It is deliberately not encoded as `rounds` with `remaining: 1`,
    // so its chip must not read as "1 round" either.
    case "remainder_of_round":
      return "Rest of this round";
    // An instantaneous outcome resolves where it is created and never persists across a boundary.
    // It is still reachable here: `formatDuration` runs for every collected effect, including
    // effects in a pending state and effects still live within their creation round.
    case "instantaneous":
      return "Instantaneous";
    case "attack_opportunity_count":
      return `${duration.remaining} ${duration.remaining === 1 ? "attack" : "attacks"}`;
    case "until_check":
      return "Check required";
    case "until_condition":
      return "Until cleared";
    // Deliberate blank: no duration chip is intended for a relationship-bound effect.
    case "relationship":
      return undefined;
    // Deliberate blank: no duration chip is intended for a GM-removable or open-ended
    // effect, which has no remaining duration to state.
    case "manual":
    case "indefinite":
      return undefined;
    // Deliberate blank: no duration chip is intended for a legacy untyped duration,
    // which carries no remaining duration to state.
    case "legacy_untyped":
      return undefined;
    default: {
      const exhaustive: never = duration;
      return exhaustive;
    }
  }
}

/**
 * The subset of a Combat effect that duration presentation reads. Every field is already carried
 * by the player-facing Combat effect; the canonical lifecycle is read only to defer to it.
 */
export interface EntryDurationSourceEffect {
  canonicalLifecycle?: unknown;
  combatWide?: boolean;
  criticalRuntime?: unknown;
  duration?: string;
  id: string;
  initiativePhase?: string;
}

/** The round-count pattern the Round End review itself ticks down on `CombatEffect.duration`. */
const ROUND_COUNT_DURATION_PATTERN = /\b(\d+)\s*(?:r|rnd|round|rounds)\b/i;

/**
 * A player-facing duration for one modifier row, built only from fields the player already
 * receives, or `undefined` when no duration is genuinely known. A missing chip is always
 * preferred to a guessed one.
 *
 * Precedence mirrors the Round End review: a bounded round count in the effect's `duration`
 * text (which that review ticks down each round) comes first, then the absolute
 * `expiresAtRound` (active through that round, inclusive), then any other authored duration text
 * verbatim.
 *
 * Deliberately unknown, and so `undefined`:
 * - an entry that carries a canonical lifecycle (the canonical `formatDuration` owns those);
 * - the `durationRounds` entry field alone: for entries it is the total at creation and is not
 *   counted down, so it cannot say what remains;
 * - the duration text of a phase-scoped effect or one with critical runtime state: the Round End
 *   review does not tick that text, so it can be stale.
 */
export function formatEntryDuration(input: {
  entry: ScenarioCombatModifierEntry;
  roundNumber?: number;
  sourceEffect?: EntryDurationSourceEffect;
}): string | undefined {
  const { entry, roundNumber, sourceEffect } = input;
  if (entry.canonicalLifecycle || sourceEffect?.canonicalLifecycle) return undefined;

  const expiry = (): string | undefined => {
    const expiresAtRound = entry.expiresAtRound;
    if (expiresAtRound === undefined) return undefined;
    if (roundNumber !== undefined && expiresAtRound < roundNumber) return undefined;
    return roundNumber === expiresAtRound ? "Ends this round" : `Through round ${expiresAtRound}`;
  };

  if (!sourceEffect) return expiry();

  const textIsTicked =
    sourceEffect.initiativePhase === undefined &&
    sourceEffect.combatWide !== false &&
    sourceEffect.criticalRuntime === undefined;
  const text = textIsTicked ? sourceEffect.duration?.trim() : undefined;
  const rounds = text ? ROUND_COUNT_DURATION_PATTERN.exec(text) : null;
  if (rounds?.[1]) {
    const count = Number.parseInt(rounds[1], 10);
    if (count > 0) return `${count} ${count === 1 ? "round" : "rounds"}`;
  }
  return expiry() ?? (text || undefined);
}

export function buildEntryDurationLabels(input: {
  combatEffects?: readonly EntryDurationSourceEffect[];
  entries: readonly ScenarioCombatModifierEntry[];
  roundNumber?: number;
}): Record<string, string> {
  const effectsById = new Map((input.combatEffects ?? []).map((effect) => [effect.id, effect]));
  const labels: Record<string, string> = {};
  for (const entry of input.entries) {
    const sourceEffect = entry.sourceEffectId ? effectsById.get(entry.sourceEffectId) : undefined;
    const label = formatEntryDuration({ entry, roundNumber: input.roundNumber, sourceEffect });
    if (label) labels[entry.id] = label;
  }
  return labels;
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
    durationLabel: effect ? formatDuration(effect) : input.entry.durationLabel,
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
  pendingRows?: readonly CombatSituationDisplayRow[];
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
            durationLabel: bucket.durationLabels?.[entry.id],
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
        breakdownIncomplete: unique.some(hasUnrenderableValue),
        id: bucket.bucketKey,
        label: bucket.label,
        rows: unique.map((entry) => calculationEntry({ context, entry })),
        // Unchanged by `breakdownIncomplete`: the total stays exactly the authoritative
        // figure supplied by the engine, rendered exactly as before.
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
  for (const row of input.pendingRows ?? []) {
    if (!pending.some((existing) => existing.id === row.id)) pending.push(row);
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
