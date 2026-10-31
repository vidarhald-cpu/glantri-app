import { z } from "zod";

import {
  isCombatActivityEventKindPublished,
  readCombatActivityFacts,
  renderCombatActivitySummary,
  type CombatActivityViewer,
} from "../encounter/combatActivityProjection";
import { projectCombatGenericActionsForPlayer } from "../encounter/combatGenericAction";
import { buildPlayerSafeCombatScopeForUser } from "../encounter/combatPlayerVisibility";
import {
  encounterStatusSchema,
  isUserAssignedToEncounterMembership,
  isUserEntitledToTerminalEncounterHistory,
  type EncounterSession,
} from "../encounter/session";
import {
  campaignAssetTypeSchema,
  scenarioAvailableObjectSourceKindSchema,
  scenarioParticipantRoleSchema,
  scenarioParticipantSourceTypeSchema,
  scenarioStatusSchema,
  type Scenario,
  type ScenarioEventLog,
  type ScenarioParticipant,
} from "./scenario";
import { resolveScenarioParticipantDisclosure } from "./scenarioParticipantDisclosure";

const idSchema = z.string().min(1);
const timestampSchema = z.string().min(1);

export const scenarioObjectiveHistoryEventTypeSchema = z.enum([
  "participant_added",
  "participant_activated",
  "participant_deactivated",
  "encounter_created",
  "encounter_participants_updated",
  "encounter_started",
  "encounter_resumed",
  "encounter_paused",
  "encounter_closed",
  "encounter_archived",
  "equipment_reconciled",
  "item_transferred",
  "encounter_skill_outcome",
  "encounter_combat_outcome",
]);

export const scenarioSessionAvailableObjectSchema = z.object({
  canPickUp: z.boolean().default(false),
  description: z.string().optional(),
  id: idSchema,
  name: z.string().min(1),
  referenceType: z.string().min(1),
  sourceKind: scenarioAvailableObjectSourceKindSchema,
});

export const scenarioSessionParticipantPresenceSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("scenario") }),
  z.object({
    encounterId: idSchema,
    encounterName: z.string().min(1),
    kind: z.literal("encounter"),
  }),
]);

export const scenarioSessionParticipantSchema = z.object({
  displayName: z.string().min(1),
  equipment: z
    .object({
      canReconcile: z.boolean().default(false),
      message: z.string().min(1),
      status: z.enum(["current", "stale", "unavailable"]),
    })
    .optional(),
  id: idSchema,
  isControlledByViewer: z.boolean().default(false),
  presence: scenarioSessionParticipantPresenceSchema,
  role: scenarioParticipantRoleSchema,
  sourceType: scenarioParticipantSourceTypeSchema,
});

export const scenarioSessionEncounterSchema = z.object({
  id: idSchema,
  kind: z.enum(["combat", "roleplay"]),
  outcome: z.string().optional(),
  status: encounterStatusSchema,
  title: z.string().min(1),
  updatedAt: timestampSchema,
});

export const scenarioSessionHistoryEventSchema = z.object({
  actorParticipantId: idSchema.optional(),
  createdAt: timestampSchema,
  encounterId: idSchema.optional(),
  eventKind: z.string().min(1),
  id: idSchema,
  scenarioId: idSchema,
  sequence: z.number().int().positive(),
  summary: z.string().min(1),
  type: scenarioObjectiveHistoryEventTypeSchema,
});

export const scenarioBlackboardBoundarySchema = z.object({
  availableObjectIds: z.array(idSchema),
  campaignId: idSchema,
  scenarioId: idSchema,
});

export const scenarioSessionViewSchema = z.object({
  availableObjects: z.array(scenarioSessionAvailableObjectSchema),
  blackboard: scenarioBlackboardBoundarySchema,
  encounters: z.array(scenarioSessionEncounterSchema),
  gmPrivateNotes: z.string().optional(),
  history: z.array(scenarioSessionHistoryEventSchema),
  participants: z.array(scenarioSessionParticipantSchema),
  revision: timestampSchema,
  scenario: z.object({
    campaignId: idSchema,
    description: z.string(),
    id: idSchema,
    name: z.string().min(1),
    status: scenarioStatusSchema,
  }),
  viewerMode: z.enum(["gm", "player"]),
});

export type ScenarioObjectiveHistoryEventType = z.infer<
  typeof scenarioObjectiveHistoryEventTypeSchema
>;
export type ScenarioSessionAvailableObject = z.infer<typeof scenarioSessionAvailableObjectSchema>;
export type ScenarioSessionParticipant = z.infer<typeof scenarioSessionParticipantSchema>;
export type ScenarioSessionParticipantEquipment = NonNullable<
  ScenarioSessionParticipant["equipment"]
>;
export type ScenarioSessionView = z.infer<typeof scenarioSessionViewSchema>;

/**
 * Forgejo #788 — Scenario membership changes and implementation/maintenance
 * events are **GM operational state**, not player history.
 *
 * Product Owner ruling of 2026-10-26, verbatim on the issue: "scenario
 * membership changes are GM operational state and must not automatically
 * appear in player Activity/history. Participant additions/removals are
 * GM-only unless the GM explicitly publishes/reveals the event to players. The
 * same boundary applies to implementation/maintenance events such as equipment
 * reconciliation: these are not player history."
 *
 * This is a **read-side audience boundary only**. Every row is still written,
 * still carries its original `createdAt` and `sequence`, and still reaches the
 * GM projection in full: the suppression below is gated on
 * `viewerMode === "player"` and never on the stored record, so the audit
 * history is unchanged and lossless (requirement 4). Nothing here authors
 * replacement prose, so no automatic narrative is invented (requirement 5).
 *
 * Requirement 2 — becoming player-visible on explicit GM publication — has no
 * carrier today. No Scenario event-log row has a publication or reveal state,
 * and no GM surface can set one; designing that affordance is a product
 * decision and is deliberately **not** attempted here. The boundary below is
 * therefore unconditional for players, which is the fail-closed side of the
 * requirement rather than a substitute for it.
 */
/**
 * Forgejo #799 — the audience classification of the **type** axis, stated
 * positively and totally.
 *
 * Previously the type axis was a deny-list: the "player safe" set was the
 * whole enum and filtered nothing, so an event type added to
 * `scenarioObjectiveHistoryEventTypeSchema` later was player-visible until
 * somebody remembered to classify it. QA measured that on #788/PR #791: adding
 * `participant_removed` to the enum returned it to a player with every test
 * still green. That is the same omission failure mode the Product Owner's #788
 * ruling forbids one level up.
 *
 * This record is **total over the enum**, so TypeScript rejects a new event
 * type that carries no classification, and the lookup below is **fail
 * closed**: a type with no entry is treated as GM operational and suppressed
 * for players rather than leaking through. That matches the `eventKind`
 * narrowing in `projectScenarioObjectiveHistory`, which has always been a
 * positive publish list.
 *
 * The classification of every type that exists today is unchanged by #799.
 */
const scenarioHistoryEventTypeAudience: Record<
  ScenarioObjectiveHistoryEventType,
  "gm_operational" | "player_history"
> = {
  // Scenario membership: additions and (de)activations.
  participant_added: "gm_operational",
  participant_activated: "gm_operational",
  participant_deactivated: "gm_operational",
  // Encounter membership: the same boundary, one level down.
  encounter_participants_updated: "gm_operational",
  // Implementation/maintenance, named explicitly in the ruling.
  equipment_reconciled: "gm_operational",
  // Objective Scenario and Encounter facts that are legitimately player
  // history. Each still passes the later per-row narrowings (audience,
  // excluded participants, combat `eventKind` and outcome scope).
  encounter_created: "player_history",
  encounter_started: "player_history",
  encounter_resumed: "player_history",
  encounter_paused: "player_history",
  encounter_closed: "player_history",
  encounter_archived: "player_history",
  item_transferred: "player_history",
  encounter_skill_outcome: "player_history",
  encounter_combat_outcome: "player_history",
};

/**
 * Whether an objective-history event type is GM operational state rather than
 * player history (#788). Exported so the boundary has one definition and the
 * player surface cannot acquire a second.
 *
 * Fail closed (#799): only a type explicitly classified as `player_history`
 * is player history. Anything else — including a type added to the enum and
 * left unclassified — is GM operational, so a new type is suppressed for
 * players by default instead of disclosed by default.
 */
export function isGmOperationalScenarioHistoryEventType(
  type: ScenarioObjectiveHistoryEventType,
): boolean {
  return scenarioHistoryEventTypeAudience[type] !== "player_history";
}

function readEventPayload(event: ScenarioEventLog): Record<string, unknown> {
  return event.payload && typeof event.payload === "object" && !Array.isArray(event.payload)
    ? (event.payload as Record<string, unknown>)
    : {};
}

function eventAudienceParticipantIds(event: ScenarioEventLog): string[] | undefined {
  const audience = readEventPayload(event).audienceParticipantIds;
  return Array.isArray(audience) && audience.every((value) => typeof value === "string")
    ? audience
    : undefined;
}

function eventEncounterId(event: ScenarioEventLog): string | undefined {
  const value = readEventPayload(event).encounterId;
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function eventActorParticipantId(event: ScenarioEventLog): string | undefined {
  const value = readEventPayload(event).actorParticipantId;
  return typeof value === "string" && value.length > 0 ? value : event.participantId;
}

function eventKind(event: ScenarioEventLog): string {
  const value = readEventPayload(event).eventKind;
  return typeof value === "string" && value.length > 0 ? value : event.eventType;
}

type ObjectiveHistoryContext = {
  encounters: EncounterSession[];
  participants: ScenarioParticipant[];
  userId: string;
};

/**
 * Produces the player-facing Activity sentence for this viewer from the structured facts stored on
 * the row (combat-panel-contract.md 12.13, ruling A2-Q1). A GM-adjudicated outcome keeps its
 * GM-authored text; an automatic outcome is rendered per viewer, so no single stored string is
 * cross-viewer authority. Rows written before A2 carry no structured facts and keep their stored
 * summary — 12.19 forbids rewriting them.
 */
function projectCombatOutcomeSummary(input: {
  event: ScenarioEventLog;
  participantDisplayNames: ReadonlyMap<string, string>;
  viewerMode: "gm" | "player";
  visibleParticipantIdsForEncounter: (encounterId: string | undefined) => ReadonlySet<string>;
  controlledParticipantIds: ReadonlySet<string>;
}): string {
  if (readEventPayload(input.event).gmAuthoredSummary === true) return input.event.summary;
  const facts = readCombatActivityFacts(input.event.payload);
  if (!facts) return input.event.summary;
  const viewer: CombatActivityViewer =
    input.viewerMode === "gm"
      ? { kind: "gm" }
      : {
          controlledParticipantIds: input.controlledParticipantIds,
          kind: "player",
          visibleParticipantIds: input.visibleParticipantIdsForEncounter(
            eventEncounterId(input.event),
          ),
        };
  return renderCombatActivitySummary({
    facts,
    participantDisplayNames: input.participantDisplayNames,
    viewer,
  });
}

function canViewCurrentItemOutcome(
  event: ScenarioEventLog,
  context: ObjectiveHistoryContext | undefined,
): boolean {
  if (!context || !eventAudienceParticipantIds(event)?.length) return false;
  const payload = readEventPayload(event);
  const encounter = context.encounters.find((entry) => entry.id === eventEncounterId(event));
  const state = encounter?.combatRoundState;
  if (!encounter || !state || typeof payload.actionId !== "string") return false;
  const action = [state, ...state.rounds]
    .flatMap((round) => round.genericActions)
    .find((entry) => entry.id === payload.actionId);
  if (action?.preset !== "item_interaction" || action.status !== "completed") return false;
  const owner = encounter.participants.find(
    (participant) =>
      participant.id === action.ownerParticipantId ||
      participant.scenarioParticipantId === action.ownerParticipantId,
  );
  if (
    !owner?.scenarioParticipantId ||
    owner.scenarioParticipantId !== eventActorParticipantId(event)
  ) {
    return false;
  }
  const scope = buildPlayerSafeCombatScopeForUser({
    // Terminal history uses the existing read-only relationship interpretation;
    // active-control resolution deliberately rejects an archived Encounter.
    encounter:
      encounter.status === "archived" &&
      isUserEntitledToTerminalEncounterHistory({
        encounter,
        scenarioParticipants: context.participants,
        userId: context.userId,
      })
        ? { ...encounter, status: "completed" }
        : encounter,
    scenarioParticipants: context.participants,
    userId: context.userId,
  });
  const [visibleAction] = projectCombatGenericActionsForPlayer({
    actions: [action],
    controlledParticipantIds: scope.controlledEncounterParticipantIds,
    visibleParticipantIds: scope.visibleParticipantIds,
  });
  return visibleAction?.resolution?.text === event.summary;
}

function valueReferencesParticipant(value: unknown, participantIds: ReadonlySet<string>): boolean {
  if (typeof value === "string") return participantIds.has(value);
  if (Array.isArray(value)) {
    return value.some((entry) => valueReferencesParticipant(entry, participantIds));
  }
  if (!value || typeof value !== "object") return false;
  return Object.values(value).some((entry) => valueReferencesParticipant(entry, participantIds));
}

/**
 * A character that can be part of a name. A display-name occurrence flanked by
 * one of these on either side is a substring of a longer word, not a mention.
 */
const NAME_CHARACTER = /[\p{L}\p{N}]/u;

function escapeForRegExp(value: string): string {
  return value.replaceAll(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

/**
 * Case-insensitive occurrences of a display name in stored prose, each one
 * flanked by a non-name character (or a string boundary) on both sides.
 *
 * Matching is done with a case-insensitive `RegExp` rather than by lower-casing
 * both strings, because lower-casing can change a string's length and would
 * then shift the indices the flanking-character checks below read.
 */
function displayNameOccurrences(
  summary: string,
  name: string,
): { readonly end: number; readonly start: number }[] {
  const trimmed = name.trim();
  if (trimmed.length === 0) return [];
  const occurrences: { readonly end: number; readonly start: number }[] = [];
  for (const match of summary.matchAll(new RegExp(escapeForRegExp(trimmed), "giu"))) {
    const start = match.index;
    const end = start + match[0].length;
    const before = start === 0 ? "" : summary.charAt(start - 1);
    const after = end >= summary.length ? "" : summary.charAt(end);
    if (NAME_CHARACTER.test(before) || NAME_CHARACTER.test(after)) continue;
    occurrences.push({ end, start });
  }
  return occurrences;
}

/**
 * Whether stored prose names a participant this viewer is denied (#798 L5).
 *
 * The scan is load-bearing and cannot be dropped: the `encounter_skill_outcome`
 * row written by `encounterRoutes.ts` (`summary: "<name> used <skill>: …"`) is
 * persisted through `encounterRepository.updateEncounter`, whose payload is
 * `{ audienceParticipantIds, encounterId }` with no `participantId` column —
 * and `audienceParticipantIds` is deliberately outside the id scan above. For
 * that row the prose is the **only** identifying content, so removing the scan
 * would reopen L5. It is made precise instead.
 *
 * **One rule: name boundaries.** A suppressed name suppresses the row when it
 * occurs as a name — flanked by a non-name character or a string boundary — and
 * not otherwise. That is what the raw `summary.includes(name)` test got wrong:
 * `includes` made short names match ordinary English in the production
 * templates (`Ed` inside `used`, `Started`, `Paused`; `Bat` inside `combat`;
 * `Guard` inside `guardrail`), so hiding or staging an NPC with a short name, or
 * merely splitting the party, withheld the player's own Activity rows, which
 * carry no identifying content at all.
 *
 * **Accepted cost (#798 F6, Product Owner ruling).** An earlier form of this
 * function also carried a covering rule: an occurrence lying inside a strictly
 * longer *visible* participant's name was attributed to that visible
 * participant and did not suppress. That rule is removed. `visibleNames` was
 * every active non-suppressed participant's `snapshot.displayName`, and a
 * display name is player-writable — `PUT /characters/:id` followed by the
 * non-GM branch of `POST /scenarios/:scenarioId/participants/character` needs no
 * GM action — so a player who knew a hidden participant's name could enter a
 * covering name such as `Lurking Shade used` and recover that participant's own
 * `encounter_skill_outcome` rows from another player's Activity.
 *
 * The cost of removing it is over-suppression, in the safe direction: when a
 * hidden participant's display name is a word-boundary substring of a **visible**
 * participant's name, the visible participant's own rows are withheld from
 * players too. `Gate Guard Captain used Persuade: success.` is withheld while a
 * `Guard` is hidden. The same fail-closed outcome already applied to equal-length
 * collisions, including a collision with the viewer's own name.
 */
function summaryIdentifiesExcludedParticipant(input: {
  excludedNames: ReadonlySet<string>;
  summary: string;
}): boolean {
  const excludedNames = [...input.excludedNames].filter((name) => name.trim().length > 0);
  if (excludedNames.length === 0) return false;
  return excludedNames.some((name) => displayNameOccurrences(input.summary, name).length > 0);
}

function eventIdentifiesExcludedParticipant(input: {
  event: ScenarioEventLog;
  participantIds: ReadonlySet<string>;
  participantNames: ReadonlySet<string>;
}): boolean {
  if (input.event.participantId && input.participantIds.has(input.event.participantId)) return true;
  // The payload is scanned for any reference to an excluded participant, which
  // is what suppresses a row whose `actorParticipantId` would otherwise resolve
  // through the roster in the same body (#798 L6).
  //
  // `audienceParticipantIds` is excluded from that scan, and only it. It is the
  // row's delivery list, never emitted in any projection, and it is enforced
  // separately below against the viewer's own controlled participants. Scanning
  // it suppressed rows the viewer is *in the audience of* merely because a
  // co-recipient is hidden — measured on `encounter_started` for an Encounter
  // the player is a member of, whose audience is every member. That withheld a
  // row carrying no identifying content at all, which is over-suppression
  // rather than confidentiality.
  const { audienceParticipantIds: _audience, ...identifyingPayload } = readEventPayload(
    input.event,
  );
  if (valueReferencesParticipant(identifyingPayload, input.participantIds)) return true;

  return summaryIdentifiesExcludedParticipant({
    excludedNames: input.participantNames,
    summary: input.event.summary,
  });
}

export function projectScenarioObjectiveHistory(input: {
  controlledParticipantIds: ReadonlySet<string>;
  eventLogs: ScenarioEventLog[];
  excludedParticipantIds?: ReadonlySet<string>;
  excludedParticipantNames?: ReadonlySet<string>;
  itemOutcomeContext?: {
    encounters: EncounterSession[];
    participants: ScenarioParticipant[];
    userId: string;
  };
  viewerMode: "gm" | "player";
}): z.infer<typeof scenarioSessionHistoryEventSchema>[] {
  const participantDisplayNames = new Map(
    (input.itemOutcomeContext?.participants ?? []).map((participant) => [
      participant.id,
      participant.snapshot.displayName,
    ]),
  );
  const visibleParticipantIdsByEncounterId = new Map<string, ReadonlySet<string>>();
  const visibleParticipantIdsForEncounter = (
    encounterId: string | undefined,
  ): ReadonlySet<string> => {
    const context = input.itemOutcomeContext;
    if (!encounterId || !context) return new Set<string>();
    const cached = visibleParticipantIdsByEncounterId.get(encounterId);
    if (cached) return cached;
    const encounter = context.encounters.find((entry) => entry.id === encounterId);
    const visible = encounter
      ? buildPlayerSafeCombatScopeForUser({
          encounter,
          scenarioParticipants: context.participants,
          userId: context.userId,
        }).visibleParticipantIds
      : new Set<string>();
    visibleParticipantIdsByEncounterId.set(encounterId, visible);
    return visible;
  };

  return [...input.eventLogs]
    .sort(
      (left, right) =>
        (left.sequence ?? Number.MAX_SAFE_INTEGER) - (right.sequence ?? Number.MAX_SAFE_INTEGER) ||
        left.createdAt.localeCompare(right.createdAt) ||
        left.id.localeCompare(right.id),
    )
    .flatMap((event) => {
      const parsedType = scenarioObjectiveHistoryEventTypeSchema.safeParse(event.eventType);
      if (!parsedType.success) return [];

      // #788. Deliberately placed before every other narrowing and gated on the
      // viewer alone: a membership or maintenance row must not become
      // player-visible because of a participant's visibility settings, an
      // audience payload, or anything else a player can influence. The GM
      // branch is untouched, so the audit record stays complete.
      // #799: the single definition of the type axis, consulted here so the
      // player surface cannot acquire a second. It is fail closed, so an
      // unclassified type is suppressed rather than disclosed.
      if (
        input.viewerMode === "player" &&
        isGmOperationalScenarioHistoryEventType(parsedType.data)
      ) {
        return [];
      }

      // Read-side narrowing, keyed on the structured classification every stored row already
      // carries (combat-panel-contract.md 12.7/12.13/12.19). This is a positive publish list: an
      // `eventKind` nobody classified is suppressed for players rather than leaking through.
      // GM audit keeps the complete legacy record.
      if (
        input.viewerMode === "player" &&
        parsedType.data === "encounter_combat_outcome" &&
        !isCombatActivityEventKindPublished(eventKind(event))
      ) {
        return [];
      }

      // A gm_only outcome is never player-safe, whatever its event type. GM audit still keeps it.
      if (
        input.viewerMode === "player" &&
        parsedType.data === "encounter_combat_outcome" &&
        readCombatActivityFacts(event.payload)?.outcomeScope === "gm_only"
      ) {
        return [];
      }

      if (
        input.viewerMode === "player" &&
        parsedType.data === "encounter_combat_outcome" &&
        eventKind(event) === "item_resolution" &&
        !canViewCurrentItemOutcome(event, input.itemOutcomeContext)
      ) {
        return [];
      }

      if (
        input.viewerMode === "player" &&
        eventIdentifiesExcludedParticipant({
          event,
          participantIds: input.excludedParticipantIds ?? new Set(),
          participantNames: input.excludedParticipantNames ?? new Set(),
        })
      ) {
        return [];
      }

      const audience = eventAudienceParticipantIds(event);
      if (
        input.viewerMode === "player" &&
        audience &&
        !audience.some((participantId) => input.controlledParticipantIds.has(participantId))
      ) {
        return [];
      }

      return [
        scenarioSessionHistoryEventSchema.parse({
          ...(eventActorParticipantId(event)
            ? { actorParticipantId: eventActorParticipantId(event) }
            : {}),
          createdAt: event.createdAt,
          ...(eventEncounterId(event) ? { encounterId: eventEncounterId(event) } : {}),
          eventKind: eventKind(event),
          id: event.id,
          scenarioId: event.scenarioId,
          sequence: event.sequence ?? input.eventLogs.indexOf(event) + 1,
          summary:
            parsedType.data === "encounter_combat_outcome"
              ? projectCombatOutcomeSummary({
                  controlledParticipantIds: input.controlledParticipantIds,
                  event,
                  participantDisplayNames,
                  viewerMode: input.viewerMode,
                  visibleParticipantIdsForEncounter,
                })
              : event.summary,
          type: parsedType.data,
        }),
      ];
    });
}

export function buildScenarioSessionView(input: {
  availableObjects: ScenarioSessionAvailableObject[];
  encounters: EncounterSession[];
  equipmentByParticipantId?: Readonly<Record<string, ScenarioSessionParticipantEquipment>>;
  eventLogs: ScenarioEventLog[];
  participants: ScenarioParticipant[];
  scenario: Scenario;
  userId: string;
  viewerMode: "gm" | "player";
}): ScenarioSessionView {
  // Issue #798. The GM's reachable hide control writes the per-viewer
  // `roleplayState.visibility` matrix; `ScenarioParticipant.visibilityOverrides`,
  // which this function used to filter on, has no production write path and so
  // the filter was inert. The resolver reads the matrix the GM actually writes,
  // maps it into `ScenarioParticipant.id` space, and answers the deliberate
  // empty-matrix fail-open default in exactly one place.
  const disclosure = resolveScenarioParticipantDisclosure({
    encounters: input.encounters,
    participants: input.participants,
    userId: input.userId,
    viewerMode: input.viewerMode,
  });
  const controlledParticipantIds = disclosure.controlledParticipantIds;
  const accessibleEncounters = input.encounters.filter(
    (encounter) =>
      encounter.status !== "archived" &&
      (input.viewerMode === "gm" ||
        isUserAssignedToEncounterMembership({
          encounter,
          scenarioParticipants: input.participants,
          userId: input.userId,
        })),
  );
  // Presence wording only. Participant suppression is the resolver's decision
  // and is deliberately not conditioned on Encounter status: the previous
  // `status === "active"` coupling meant pausing, completing or archiving an
  // Encounter restored disclosure of its occupants as `presence: {kind:"scenario"}`.
  const activeEncounterByParticipantId = new Map<string, EncounterSession>();

  for (const encounter of input.encounters) {
    if (encounter.status !== "active" || encounter.participantMembershipMode !== "explicit") {
      continue;
    }
    for (const participant of encounter.participants) {
      if (participant.scenarioParticipantId) {
        activeEncounterByParticipantId.set(participant.scenarioParticipantId, encounter);
      }
    }
  }

  const participants = input.participants.flatMap((participant) => {
    if (!participant.isActive) return [];
    const activeEncounter = activeEncounterByParticipantId.get(participant.id);
    const controlled = controlledParticipantIds.has(participant.id);
    if (
      input.viewerMode === "player" &&
      !controlled &&
      disclosure.suppressedParticipantIds.has(participant.id)
    ) {
      return [];
    }

    return [
      scenarioSessionParticipantSchema.parse({
        displayName: participant.snapshot.displayName,
        ...(input.equipmentByParticipantId?.[participant.id]
          ? { equipment: input.equipmentByParticipantId[participant.id] }
          : {}),
        id: participant.id,
        isControlledByViewer: controlled,
        presence: activeEncounter
          ? {
              encounterId: activeEncounter.id,
              encounterName: activeEncounter.title,
              kind: "encounter",
            }
          : { kind: "scenario" },
        role: participant.role,
        sourceType: participant.sourceType,
      }),
    ];
  });

  return scenarioSessionViewSchema.parse({
    availableObjects: input.availableObjects,
    blackboard: {
      availableObjectIds: input.availableObjects.map((object) => object.id),
      campaignId: input.scenario.campaignId,
      scenarioId: input.scenario.id,
    },
    encounters: accessibleEncounters.map((encounter) => ({
      id: encounter.id,
      kind: encounter.kind,
      outcome: encounter.playerOutcome,
      status: encounter.status,
      title: encounter.title,
      updatedAt: encounter.updatedAt,
    })),
    gmPrivateNotes:
      input.viewerMode === "gm" ? input.scenario.liveState?.session.gmPrivateNotes : undefined,
    history: projectScenarioObjectiveHistory({
      controlledParticipantIds,
      eventLogs: input.eventLogs,
      excludedParticipantIds: disclosure.suppressedParticipantIdAliases,
      excludedParticipantNames: disclosure.suppressedParticipantNames,
      itemOutcomeContext: {
        encounters: input.encounters,
        participants: input.participants,
        userId: input.userId,
      },
      viewerMode: input.viewerMode,
    }),
    participants,
    revision: input.scenario.updatedAt,
    scenario: {
      campaignId: input.scenario.campaignId,
      description: input.scenario.description,
      id: input.scenario.id,
      name: input.scenario.name,
      status: input.scenario.status,
    },
    viewerMode: input.viewerMode,
  });
}

export type PlayerSafeScenario = Omit<Scenario, "liveState"> & {
  liveState?: Omit<NonNullable<Scenario["liveState"]>, "session">;
};

export function buildPlayerSafeScenario(scenario: Scenario): PlayerSafeScenario {
  if (!scenario.liveState) return scenario;
  const { session: _session, ...playerLiveState } = scenario.liveState;
  return {
    ...scenario,
    liveState: playerLiveState,
  };
}

export function formatScenarioAvailableObjectReferenceType(input: {
  assetType?: z.infer<typeof campaignAssetTypeSchema>;
  sourceKind: z.infer<typeof scenarioAvailableObjectSourceKindSchema>;
}): string {
  if (input.sourceKind === "campaign_item") return "Item";
  if (input.sourceKind === "reusable_entity") return "Reference";
  return input.assetType
    ? input.assetType[0]!.toUpperCase() + input.assetType.slice(1)
    : "Reference";
}
