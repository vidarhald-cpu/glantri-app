import { z } from "zod";

import type { CombatLogSummaryFacts } from "./combatLogProjection";
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
 * The structured event facts A2 persists so that the player-facing sentence can be produced per
 * viewer at projection time instead of being frozen into one stored string.
 *
 * Deliberately excluded: `facts.gmReview`, `facts.rollerPrivate` and `facts.involvedOutcome`.
 * Only `facts.publicOutcome` is carried, because it is public-scope by construction, so a defect
 * in the read-side projection cannot leak GM-only or roller-private material into a player payload.
 * `summaryFacts` is the Combat Log's own `CombatLogSummaryFacts`, so Activity derives from the same
 * facts the Combat Log uses rather than becoming a second, independently drifting summariser.
 */
export const combatActivityFactsSchema = z.object({
  eventType: combatStepEventTypeSchema,
  identities: z.array(combatActivityIdentitySchema).default([]),
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

function eventTypeSentence(input: {
  actor: string;
  facts: CombatActivityFacts;
  target: string | undefined;
}): string {
  const publicOutcome = input.facts.publicOutcome;
  const targetText = input.target ?? "an opponent";
  switch (input.facts.eventType) {
    case "hit_location": {
      const location =
        stringFact(publicOutcome, "locationName") ?? stringFact(publicOutcome, "location");
      return `${capitalize(targetText)} was struck${location ? ` in the ${location}` : ""}.`;
    }
    case "critical": {
      const title =
        stringFact(publicOutcome, "criticalTitle") ?? stringFact(publicOutcome, "title");
      return `${capitalize(targetText)} suffered a critical result${title ? `: ${title}` : ""}.`;
    }
    case "observation":
      return `${capitalize(input.actor)} observed ${targetText}.`;
    case "health_check": {
      const survived = booleanFact(publicOutcome, "survived");
      return `${capitalize(input.actor)} made a health check${
        survived === undefined ? "" : survived ? " and held on" : " and collapsed"
      }.`;
    }
    case "break_off_result":
    case "break_off_committed": {
      const succeeded =
        booleanFact(publicOutcome, "success") ?? booleanFact(publicOutcome, "succeeded");
      return `${capitalize(input.actor)} ${
        succeeded === undefined
          ? "resolved a break-off"
          : succeeded
            ? "broke off from"
            : "failed to break off from"
      }${succeeded === undefined ? "" : ` ${targetText}`}.`;
    }
    case "disarm_result":
    case "disarm_committed": {
      const succeeded =
        booleanFact(publicOutcome, "success") ?? booleanFact(publicOutcome, "succeeded");
      return `${capitalize(input.actor)} ${
        succeeded === undefined
          ? "resolved a disarm against"
          : succeeded
            ? "disarmed"
            : "failed to disarm"
      } ${targetText}.`;
    }
    case "distance_control_result": {
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
  return (
    summaryFactsSentence({ actor, facts: input.facts, target }) ??
    eventTypeSentence({ actor, facts: input.facts, target })
  );
}
