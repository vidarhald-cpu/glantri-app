import { z } from "zod";

import {
  encounterStatusSchema,
  isUserAssignedToEncounterMembership,
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
export type ScenarioSessionView = z.infer<typeof scenarioSessionViewSchema>;

const playerSafeHistoryTypes = new Set<ScenarioObjectiveHistoryEventType>(
  scenarioObjectiveHistoryEventTypeSchema.options,
);

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
  viewerMode: "gm" | "player";
}): z.infer<typeof scenarioSessionHistoryEventSchema>[] {
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
          summary: event.summary,
          type: parsedType.data,
        }),
      ];
    });
}

export function buildScenarioSessionView(input: {
  availableObjects: ScenarioSessionAvailableObject[];
  encounters: EncounterSession[];
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
