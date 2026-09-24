import { z } from "zod";

import type { CombatLogSummaryFacts } from "./combatLogProjection";
import { getHitLocationFullLabel, hitLocationSchema } from "./hitLocation";
import {
  combatStepEventIdentityRoleSchema,
  combatStepEventHiddenIdentityFallbackSchema,
  combatStepEventOutcomeScopeSchema,
  combatStepEventStatusSchema,
  combatStepEventTypeSchema,
  type CombatStepEvent,
  type CombatStepEventType,
} from "./combatStepEventSchema";

/**
 * Player-safe Situation Activity projection for Combat.
 *
 * `docs/product/combat-panel-contract.md` §12.7 binds Situation Activity to concise, player-safe,
 * narratively meaningful outcomes and excludes round and phase bookkeeping. §12.13 requires the
 * selection to be expressed as a **positive publish list** asserted against every member of
 * `combatStepEventTypeSchema`, so that a member added later fails loudly rather than leaking
 * through a deny list.
 *
 * Suppression is enforced twice on the server, never in a component or a view-model:
 * on the **write side** (`encounterService` / `encounterRepository` no longer forward or persist
 * a suppressed event as an Activity row) and on the **read side**
 * (`projectScenarioObjectiveHistory` selects on the stored `payloadJson.eventKind`). The read-side
 * gate is what covers legacy rows, which §12.19 forbids migrating or backfilling.
 */

/**
 * The published `eventKind` for a GM-adjudicated Item interaction outcome. It is a payload
 * classification rather than a `combatStepEventTypeSchema` member, and it is written by
 * `combatItemInteractionService`, which A2 follows rather than redesigns.
 */
export const COMBAT_ACTIVITY_ITEM_RESOLUTION_EVENT_KIND = "item_resolution";

/** §12.13 publish list — 17 of the 41 `combatStepEventTypeSchema` members. */
export const COMBAT_ACTIVITY_PUBLISHED_EVENT_TYPES = [
  "attack",
  "parry",
  "damage_committed",
  "hit_location",
  "critical",
  "observation",
  "health_check",
  "task_resolved",
  "feint_result",
  "feint_committed",
  "break_off_result",
  "break_off_committed",
  "adjust_distance_result",
  "adjust_distance_committed",
  "disarm_result",
  "disarm_committed",
  "distance_control_result",
] as const satisfies readonly CombatStepEventType[];

/** §12.13 suppression list — the remaining 24 members. Recorded for the exhaustiveness test. */
export const COMBAT_ACTIVITY_SUPPRESSED_EVENT_TYPES = [
  "declaration",
  "combat_experience",
  "modifier_review",
  "initiative",
  "action_skipped",
  "missile_readiness",
  "damage_proposed",
  "participant_su_review",
  "effect_review",
  "round_boundary",
  "feint_feasibility",
  "feint_roll",
  "feint_impossible",
  "break_off_review",
  "break_off_roll",
  "adjust_distance_response",
  "adjust_distance_adjustment",
  "adjust_distance_roll",
  "disarm_opened",
  "disarm_roll",
  "distance_control_roll",
  "distance_control_applied",
  "offensive_parry_brawling",
  "continued_contact_maintenance",
] as const satisfies readonly CombatStepEventType[];

const publishedEventTypes: ReadonlySet<string> = new Set(COMBAT_ACTIVITY_PUBLISHED_EVENT_TYPES);

/**
 * Write-side gate. Only these `CombatStepEvent`s become Activity rows at all.
 */
export function isCombatStepEventPublishedToActivity(eventType: string): boolean {
  return publishedEventTypes.has(eventType);
}

/**
 * Read-side gate for a persisted `encounter_combat_outcome` row, keyed on the row's structured
 * `eventKind`. Unknown kinds are suppressed, which is the positive-list discipline: a kind nobody
 * classified is never published to a player.
 */
export function isCombatActivityEventKindPublished(eventKind: string): boolean {
  return (
    eventKind === COMBAT_ACTIVITY_ITEM_RESOLUTION_EVENT_KIND ||
    isCombatStepEventPublishedToActivity(eventKind)
  );
}

const combatActivityIdentitySchema = z.object({
  hiddenIdentityFallback: combatStepEventHiddenIdentityFallbackSchema.optional(),
  /** Scenario participant id. Omitted when the encounter participant cannot be mapped. */
  participantId: z.string().min(1).optional(),
  role: combatStepEventIdentityRoleSchema,
});
export type CombatActivityIdentity = z.infer<typeof combatActivityIdentitySchema>;

/**
 * Per-type whitelist of `facts.involvedOutcome` fields carried into the persisted Activity facts.
 *
 * Nine emitters in `combatRoundManager` record the **terminal result** of a publicly witnessed
 * Combat contest under `facts.involvedOutcome` and leave `facts.publicOutcome` empty, so carrying
 * `publicOutcome` alone left every one of these published outcomes rendered without its result —
 * a disarm whose success is unstated, a hit with no location, a critical with no grade. §12.13
 * requires the recap source to become "cleaner without becoming poorer", and §11.2 makes Activity
 * the exclusive AI session-summary source, so an outcome stripped of its result is a silent hole.
 *
 * Each field below is **public in substance**: it is the observable consequence of a contest the
 * involved audience witnessed, never a roll, a stat, a difficulty, a modifier, a GM note or a
 * hidden intent. Deliberately **not** whitelisted, even where the same `involvedOutcome` record
 * carries them: `difference` and `tableRowId` (raw contest margin and rule-table mechanics),
 * `attackerObModifier` / `defenderDbParryModifier` (mechanical state), `attemptId`,
 * `noDirectDamage`, `proposedDistance`, `targetLocation` (the attacker's *intended* location,
 * which is private aim rather than observed result) and every bleed-rate field.
 *
 * `facts.gmReview` and `facts.rollerPrivate` remain excluded wholesale and are never whitelisted,
 * and `facts.involvedOutcome` itself is never carried wholesale — only these named fields, with
 * only primitive values, so a read-side defect still cannot leak GM-only or roller-private
 * material. The digest travels inside the same row the audience projection already gates: a row
 * whose `outcomeScope` is not `public` carries `audienceParticipantIds` and reaches no other
 * viewer, and `gm_only` reaches no player at all.
 */
export const COMBAT_ACTIVITY_INVOLVED_OUTCOME_WHITELIST = {
  break_off_committed: ["escaped"],
  break_off_result: ["escaped"],
  critical: ["criticalGrade"],
  disarm_committed: ["disarmed", "unbalanced"],
  disarm_result: ["disarmed", "unbalanced"],
  distance_control_result: ["outcome", "winnerParticipantId"],
  health_check: ["success"],
  hit_location: ["selectedHitLocation"],
} as const satisfies Partial<Record<CombatStepEventType, readonly string[]>>;

/**
 * Whitelisted keys holding an encounter participant id. They are mapped onto the scenario
 * participant id the Activity audience checks already speak, and dropped when unmappable, so no
 * raw encounter-scoped identifier is persisted into an Activity row.
 */
const COMBAT_ACTIVITY_PARTICIPANT_ID_DIGEST_KEYS: ReadonlySet<string> = new Set([
  "winnerParticipantId",
]);

const combatActivityDigestValueSchema = z.union([z.boolean(), z.number(), z.string()]);

/**
 * The structured event facts A2 persists so that the player-facing sentence can be produced per
 * viewer at projection time instead of being frozen into one stored string.
 *
 * Deliberately excluded: `facts.gmReview` and `facts.rollerPrivate`, wholesale and without
 * exception. `facts.publicOutcome` is carried because it is public-scope by construction, and
 * `facts.involvedOutcome` is carried **only** through the named per-type whitelist above, never
 * wholesale. `summaryFacts` is the Combat Log's own `CombatLogSummaryFacts`, so Activity derives
 * from the same facts the Combat Log uses rather than becoming a second, independently drifting
 * summariser.
 */
export const combatActivityFactsSchema = z.object({
  eventType: combatStepEventTypeSchema,
  identities: z.array(combatActivityIdentitySchema).default([]),
  /** Whitelisted, per-type, primitive-only projection of `facts.involvedOutcome`. */
  involvedOutcomeDigest: z.record(z.string(), combatActivityDigestValueSchema).default({}),
  outcomeScope: combatStepEventOutcomeScopeSchema,
  publicOutcome: z.record(z.string(), z.unknown()).default({}),
  status: combatStepEventStatusSchema,
  /** Present only for the event types the Combat Log itself projects. */
  summaryFacts: z.unknown().optional(),
});
export type CombatActivityFacts = z.infer<typeof combatActivityFactsSchema>;

export const COMBAT_ACTIVITY_FACTS_PAYLOAD_KEY = "activityFacts";

function fallbackForRole(
  role: CombatActivityIdentity["role"],
): CombatActivityIdentity["hiddenIdentityFallback"] {
  return role === "target" || role === "defender" ? "unseen_target" : "unseen_attacker";
}

function pushIdentity(
  identities: CombatActivityIdentity[],
  identity: CombatActivityIdentity,
): void {
  if (
    identities.some(
      (entry) => entry.role === identity.role && entry.participantId === identity.participantId,
    )
  ) {
    return;
  }
  identities.push(identity);
}

/**
 * Projects the whitelisted `facts.involvedOutcome` fields for one event type. Only primitive
 * values are carried: a nested object could smuggle an unreviewed field under a whitelisted key.
 */
function buildInvolvedOutcomeDigest(input: {
  event: CombatStepEvent;
  toScenarioParticipantId: (participantId: string | undefined) => string | undefined;
}): Record<string, boolean | number | string> {
  const whitelist = (
    COMBAT_ACTIVITY_INVOLVED_OUTCOME_WHITELIST as Partial<
      Record<CombatStepEventType, readonly string[]>
    >
  )[input.event.type];
  if (!whitelist) return {};
  const digest: Record<string, boolean | number | string> = {};
  for (const key of whitelist) {
    const value = input.event.facts.involvedOutcome[key];
    if (COMBAT_ACTIVITY_PARTICIPANT_ID_DIGEST_KEYS.has(key)) {
      const scenarioParticipantId =
        typeof value === "string" ? input.toScenarioParticipantId(value) : undefined;
      if (scenarioParticipantId) digest[key] = scenarioParticipantId;
      continue;
    }
    if (typeof value === "boolean") digest[key] = value;
    else if (typeof value === "number" && Number.isFinite(value)) digest[key] = value;
    else if (typeof value === "string" && value.length > 0) digest[key] = value;
  }
  return digest;
}

/**
 * Builds the persisted structured facts for one published `CombatStepEvent`.
 *
 * `toScenarioParticipantId` maps encounter participant ids onto the scenario participant ids the
 * Activity projection and its audience checks already speak.
 */
export function buildCombatActivityFacts(input: {
  event: CombatStepEvent;
  summaryFacts?: CombatLogSummaryFacts;
  toScenarioParticipantId: (participantId: string | undefined) => string | undefined;
}): CombatActivityFacts {
  const identities: CombatActivityIdentity[] = [];
  for (const ref of input.event.visibility.identityRefs) {
    pushIdentity(identities, {
      hiddenIdentityFallback: ref.hiddenIdentityFallback ?? fallbackForRole(ref.role),
      ...(input.toScenarioParticipantId(ref.participantId)
        ? { participantId: input.toScenarioParticipantId(ref.participantId) }
        : {}),
      role: ref.role,
    });
  }
  const derived: { participantId?: string; role: CombatActivityIdentity["role"] }[] = [
    { participantId: input.event.attackerParticipantId, role: "attacker" },
    { participantId: input.event.defenderParticipantId, role: "defender" },
    {
      participantId: input.event.actorParticipantId ?? input.event.ownerParticipantId,
      role: "actor",
    },
    { participantId: input.event.targetParticipantId, role: "target" },
  ];
  for (const entry of derived) {
    if (!entry.participantId) continue;
    const scenarioParticipantId = input.toScenarioParticipantId(entry.participantId);
    if (!scenarioParticipantId) continue;
    if (identities.some((identity) => identity.participantId === scenarioParticipantId)) continue;
    pushIdentity(identities, {
      hiddenIdentityFallback: fallbackForRole(entry.role),
      participantId: scenarioParticipantId,
      role: entry.role,
    });
  }

  return combatActivityFactsSchema.parse({
    eventType: input.event.type,
    identities,
    involvedOutcomeDigest: buildInvolvedOutcomeDigest({
      event: input.event,
      toScenarioParticipantId: input.toScenarioParticipantId,
    }),
    outcomeScope: input.event.visibility.outcomeScope,
    publicOutcome: input.event.facts.publicOutcome,
    status: input.event.status,
    ...(input.summaryFacts ? { summaryFacts: input.summaryFacts } : {}),
  });
}

/** Reads the persisted facts back off a `ScenarioEventLog.payloadJson`, tolerating their absence. */
export function readCombatActivityFacts(payload: unknown): CombatActivityFacts | undefined {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return undefined;
  const raw = (payload as Record<string, unknown>)[COMBAT_ACTIVITY_FACTS_PAYLOAD_KEY];
  const parsed = combatActivityFactsSchema.safeParse(raw);
  return parsed.success ? parsed.data : undefined;
}

export type CombatActivityViewer =
  | { readonly kind: "gm" }
  | {
      readonly controlledParticipantIds: ReadonlySet<string>;
      readonly kind: "player";
      readonly visibleParticipantIds: ReadonlySet<string>;
    };

function identityFallbackText(fallback: CombatActivityIdentity["hiddenIdentityFallback"]): string {
  if (fallback === "unseen_attacker") return "an unseen attacker";
  if (fallback === "unseen_target") return "an unseen target";
  return "another combatant";
}

function resolveIdentity(input: {
  identity: CombatActivityIdentity | undefined;
  participantDisplayNames: ReadonlyMap<string, string>;
  viewer: CombatActivityViewer;
}): string | undefined {
  const identity = input.identity;
  if (!identity) return undefined;
  const participantId = identity.participantId;
  if (input.viewer.kind === "gm") {
    return (participantId && input.participantDisplayNames.get(participantId)) ?? "a combatant";
  }
  if (participantId && input.viewer.controlledParticipantIds.has(participantId)) return "you";
  if (participantId && input.viewer.visibleParticipantIds.has(participantId)) {
    return input.participantDisplayNames.get(participantId) ?? "another combatant";
  }
  return identityFallbackText(identity.hiddenIdentityFallback);
}

function findIdentity(
  facts: CombatActivityFacts,
  roles: readonly CombatActivityIdentity["role"][],
): CombatActivityIdentity | undefined {
  for (const role of roles) {
    const match = facts.identities.find((identity) => identity.role === role);
    if (match) return match;
  }
  return undefined;
}

function capitalize(text: string): string {
  return text.charAt(0).toLocaleUpperCase() + text.slice(1);
}

function possessive(name: string): string {
  if (name === "you") return "your";
  return name.endsWith("s") ? `${name}’` : `${name}’s`;
}

function booleanFact(facts: Record<string, unknown>, key: string): boolean | undefined {
  const value = facts[key];
  return typeof value === "boolean" ? value : undefined;
}

function stringFact(facts: Record<string, unknown>, key: string): string | undefined {
  const value = facts[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function numberFact(facts: Record<string, unknown>, key: string): number | undefined {
  const value = facts[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function summaryFactsSentence(input: {
  actor: string;
  facts: CombatActivityFacts;
  target: string | undefined;
}): string | undefined {
  const parsed = input.facts.summaryFacts;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return undefined;
  const record = parsed as Record<string, unknown>;
  const kind = record.kind;
  const targetText = input.target ? ` ${input.target}` : "";
  if (kind === "attack_resolved") {
    const outcome = stringFact(record, "outcome") ?? "resolved";
    const weaponName = stringFact(record, "weaponName");
    return `${capitalize(input.actor)} attacked${targetText || " an opponent"}${
      weaponName ? ` with ${weaponName}` : ""
    }. The attack ${outcome}.`;
  }
  if (kind === "defense_resolved") {
    const outcome = stringFact(record, "outcome") ?? "resolved";
    return `${capitalize(possessive(input.actor))} parry ${outcome}.`;
  }
  if (kind === "damage_committed") {
    const amount = numberFact(record, "amount");
    const source = stringFact(record, "source");
    const subject = input.target ?? input.actor;
    return `${capitalize(subject)} suffered ${amount ?? "unspecified"} damage${
      source === "bleeding" ? " from bleeding" : ""
    }.`;
  }
  if (kind === "contest_resolved") {
    const contest = stringFact(record, "contest")?.replaceAll("_", " ") ?? "contest";
    const outcome = stringFact(record, "outcome") ?? "resolved";
    return `${capitalize(input.actor)} ${outcome} the ${contest} contest${targetText ? ` against${targetText}` : ""}.`;
  }
  if (kind === "distance_changed") {
    const previousDistance = numberFact(record, "previousDistance");
    const nextDistance = numberFact(record, "nextDistance");
    return `Distance between ${input.actor} and ${input.target ?? "an opponent"} changed from ${previousDistance ?? "?"} to ${nextDistance ?? "?"}.`;
  }
  if (kind === "task_resolved") {
    const rollOutcome = stringFact(record, "rollOutcome");
    return `${capitalize(input.actor)} resolved a Combat Task${rollOutcome ? ` — ${rollOutcome}` : ""}.`;
  }
  return undefined;
}

function hitLocationText(digest: Record<string, unknown>): string | undefined {
  const parsed = hitLocationSchema.safeParse(stringFact(digest, "selectedHitLocation"));
  return parsed.success ? getHitLocationFullLabel(parsed.data).toLocaleLowerCase() : undefined;
}

/**
 * The sentence for a published outcome the Combat Log does not project. Its result comes from the
 * whitelisted `involvedOutcomeDigest`, because that is where the emitters in `combatRoundManager`
 * actually record it; `publicOutcome` is kept as a secondary source so an emitter that does record
 * a public-scope result keeps working.
 */
function eventTypeSentence(input: {
  actor: string;
  facts: CombatActivityFacts;
  resolveParticipant: (participantId: string) => string;
  target: string | undefined;
}): string {
  const publicOutcome = input.facts.publicOutcome;
  const digest = input.facts.involvedOutcomeDigest;
  const targetText = input.target ?? "an opponent";
  switch (input.facts.eventType) {
    case "hit_location": {
      const location =
        hitLocationText(digest) ??
        stringFact(publicOutcome, "locationName") ??
        stringFact(publicOutcome, "location");
      return `${capitalize(targetText)} ${targetText === "you" ? "were" : "was"} struck${
        location ? ` in the ${location}` : ""
      }.`;
    }
    case "critical": {
      const grade = stringFact(digest, "criticalGrade");
      const title =
        stringFact(publicOutcome, "criticalTitle") ?? stringFact(publicOutcome, "title");
      return `${capitalize(targetText)} suffered a${
        grade ? ` grade ${grade.toLocaleUpperCase()}` : ""
      } critical result${title ? `: ${title}` : ""}.`;
    }
    case "observation":
      return `${capitalize(input.actor)} observed ${targetText}.`;
    case "health_check": {
      const succeeded = booleanFact(digest, "success") ?? booleanFact(publicOutcome, "survived");
      return `${capitalize(input.actor)} made a health check${
        succeeded === undefined ? "" : succeeded ? " and succeeded" : " and failed"
      }.`;
    }
    case "break_off_result":
    case "break_off_committed": {
      const escaped =
        booleanFact(digest, "escaped") ??
        booleanFact(publicOutcome, "success") ??
        booleanFact(publicOutcome, "succeeded");
      return `${capitalize(input.actor)} ${
        escaped === undefined
          ? "resolved a break-off"
          : escaped
            ? "broke off from"
            : "failed to break off from"
      }${escaped === undefined ? "" : ` ${targetText}`}.`;
    }
    case "disarm_result":
    case "disarm_committed": {
      const disarmed =
        booleanFact(digest, "disarmed") ??
        booleanFact(publicOutcome, "success") ??
        booleanFact(publicOutcome, "succeeded");
      const unbalanced = booleanFact(digest, "unbalanced") === true;
      if (disarmed === undefined) {
        return `${capitalize(input.actor)} resolved a disarm against ${targetText}.`;
      }
      if (disarmed) {
        return `${capitalize(input.actor)} disarmed ${targetText}${
          unbalanced ? " and left them unbalanced" : ""
        }.`;
      }
      return `${capitalize(input.actor)} failed to disarm ${targetText}${
        unbalanced ? " but left them unbalanced" : ""
      }.`;
    }
    case "distance_control_result": {
      const winnerParticipantId = stringFact(digest, "winnerParticipantId");
      if (winnerParticipantId) {
        return `${capitalize(input.resolveParticipant(winnerParticipantId))} won the distance contest.`;
      }
      const outcome = stringFact(digest, "outcome");
      if (outcome === "tie") return "The distance contest ended in a tie.";
      if (outcome === "uncontested") {
        return `${capitalize(input.actor)} set the distance uncontested.`;
      }
      if (outcome === "gm_override") return "The GM set the distance.";
      if (outcome === "controller_choice") {
        return `${capitalize(input.actor)} chose the distance.`;
      }
      const won = booleanFact(publicOutcome, "won") ?? booleanFact(publicOutcome, "success");
      return `${capitalize(input.actor)} ${
        won === undefined
          ? "resolved the distance contest"
          : won
            ? "won the distance contest"
            : "lost the distance contest"
      }.`;
    }
    case "feint_result":
    case "feint_committed": {
      const succeeded =
        booleanFact(publicOutcome, "success") ?? booleanFact(publicOutcome, "succeeded");
      return `${capitalize(possessive(input.actor))} feint ${
        succeeded === undefined ? "resolved" : succeeded ? "succeeded" : "failed"
      }.`;
    }
    case "adjust_distance_result":
    case "adjust_distance_committed":
      return `${capitalize(input.actor)} adjusted distance to ${targetText}.`;
    case "task_resolved":
      return `${capitalize(input.actor)} resolved a Combat Task.`;
    case "attack":
      return `${capitalize(input.actor)} attacked ${targetText}.`;
    case "parry":
      return `${capitalize(possessive(input.actor))} parry resolved.`;
    case "damage_committed":
      return `${capitalize(targetText)} suffered damage.`;
    default:
      return `${capitalize(input.actor)} acted.`;
  }
}

/**
 * Produces the player-facing Activity sentence for one viewer from the persisted structured facts.
 * No stored rendered string is treated as cross-viewer authority: two viewers with different
 * identity entitlement receive different authorized sentences from the same stored facts.
 */
export function renderCombatActivitySummary(input: {
  facts: CombatActivityFacts;
  participantDisplayNames: ReadonlyMap<string, string>;
  viewer: CombatActivityViewer;
}): string {
  // A parry is recorded from the defender's side: the parrying participant is the sentence's
  // subject and the attacker is its counterpart.
  const defensive = input.facts.eventType === "parry";
  const actorIdentity = findIdentity(
    input.facts,
    defensive ? ["defender", "actor", "roller"] : ["actor", "attacker", "roller"],
  );
  const targetIdentity = findIdentity(
    input.facts,
    defensive ? ["attacker", "target"] : ["target", "defender"],
  );
  const actor =
    resolveIdentity({
      identity: actorIdentity,
      participantDisplayNames: input.participantDisplayNames,
      viewer: input.viewer,
    }) ?? "a combatant";
  const target = resolveIdentity({
    identity: targetIdentity,
    participantDisplayNames: input.participantDisplayNames,
    viewer: input.viewer,
  });
  // A participant named only by a whitelisted digest field still resolves through the same
  // entitlement projection as every other identity: a viewer who may not identify them receives
  // the neutral fallback, never a display name.
  const resolveParticipant = (participantId: string): string =>
    resolveIdentity({
      identity: input.facts.identities.find(
        (identity) => identity.participantId === participantId,
      ) ?? { hiddenIdentityFallback: "omit", participantId, role: "actor" },
      participantDisplayNames: input.participantDisplayNames,
      viewer: input.viewer,
    }) ?? "another combatant";
  return (
    summaryFactsSentence({ actor, facts: input.facts, target }) ??
    eventTypeSentence({ actor, facts: input.facts, resolveParticipant, target })
  );
}
