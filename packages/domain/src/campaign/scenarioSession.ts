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

const playerSafeHistoryTypes = new Set<ScenarioObjectiveHistoryEventType>(
  scenarioObjectiveHistoryEventTypeSchema.options,
);

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
const gmOperationalHistoryTypes = new Set<ScenarioObjectiveHistoryEventType>([
  // Scenario membership: additions and removals.
  "participant_added",
  "participant_activated",
  "participant_deactivated",
  // Encounter membership: the same boundary, one level down.
  "encounter_participants_updated",
  // Implementation/maintenance, named explicitly in the ruling.
  "equipment_reconciled",
]);

/**
 * Whether an objective-history event type is GM operational state rather than
 * player history (#788). Exported so the boundary has one definition and the
 * player surface cannot acquire a second.
 */
export function isGmOperationalScenarioHistoryEventType(
  type: ScenarioObjectiveHistoryEventType,
): boolean {
  return gmOperationalHistoryTypes.has(type);
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

function eventIdentifiesExcludedParticipant(input: {
  event: ScenarioEventLog;
  participantIds: ReadonlySet<string>;
  participantNames: ReadonlySet<string>;
}): boolean {
  if (input.event.participantId && input.participantIds.has(input.event.participantId)) return true;
  if (valueReferencesParticipant(input.event.payload, input.participantIds)) return true;

  const normalizedSummary = input.event.summary.toLocaleLowerCase();
  return [...input.participantNames].some((name) =>
    normalizedSummary.includes(name.toLocaleLowerCase()),
  );
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
      if (!parsedType.success || !playerSafeHistoryTypes.has(parsedType.data)) return [];

      // #788. Deliberately placed before every other narrowing and gated on the
      // viewer alone: a membership or maintenance row must not become
      // player-visible because of a participant's visibility settings, an
      // audience payload, or anything else a player can influence. The GM
      // branch is untouched, so the audit record stays complete.
      if (input.viewerMode === "player" && gmOperationalHistoryTypes.has(parsedType.data)) {
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
  const controlledParticipantIds = new Set(
    input.participants
      .filter(
        (participant) => participant.isActive && participant.controlledByUserId === input.userId,
      )
      .map((participant) => participant.id),
  );
  const excludedParticipants =
    input.viewerMode === "player"
      ? input.participants.filter(
          (participant) =>
            !controlledParticipantIds.has(participant.id) &&
            (participant.visibilityOverrides?.visibility === "hidden" ||
              participant.visibilityOverrides?.visibility === "gm_only"),
        )
      : [];
  const excludedParticipantIds = new Set(excludedParticipants.map((participant) => participant.id));
  const excludedParticipantNames = new Set(
    excludedParticipants.map((participant) => participant.snapshot.displayName),
  );
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
  const accessibleEncounterIds = new Set(accessibleEncounters.map((encounter) => encounter.id));
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
      (excludedParticipantIds.has(participant.id) ||
        (activeEncounter && !accessibleEncounterIds.has(activeEncounter.id)))
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
      excludedParticipantIds,
      excludedParticipantNames,
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
