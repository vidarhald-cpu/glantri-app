import { z } from "zod";

import {
  activeCombatRoundStateSchema,
  combatRoundStateSchema,
  completedCombatRoundSchema,
  type ActiveCombatRoundState,
  type CombatRoundState,
  type CompletedCombatRound,
} from "./combatRoundManager";
import {
  encounterParticipantMembershipModeSchema,
  encounterParticipantSchema,
  encounterSessionSchema,
  encounterStatusSchema,
  encounterSessionRevisionSchema,
  encounterSessionSummarySchema,
  type EncounterParticipant,
  type EncounterParticipantMembershipMode,
  type EncounterStatus,
  type EncounterSessionRevision,
  type EncounterSessionSummary,
  type EncounterSession,
} from "./session";

const idSchema = z.string().min(1);
const revisionSchema = z.string().min(1);
const participantVisibilitySchema = z.record(idSchema, z.record(idSchema, z.boolean()));

export interface ArchivedCombatRoundsView {
  archivedRounds: CompletedCombatRound[];
  encounterId: string;
  revision: string;
  updatedAt: string;
  viewVersion: 1;
}

export interface CombatHistorySourceView {
  activeCombatState?: ActiveCombatRoundState;
  archivedRounds: CompletedCombatRound[];
  currentRound: number;
  encounterId: string;
  participantMembershipMode?: EncounterParticipantMembershipMode;
  participants: EncounterParticipant[];
  participantVisibility: Record<string, Record<string, boolean>>;
  revision: string;
  scenarioId?: string;
  status: EncounterStatus;
  updatedAt: string;
  viewVersion: 1;
}

export const encounterMetadataViewSchema = z
  .object({
    campaignId: idSchema.optional(),
    createdAt: z.string().min(1),
    encounterId: idSchema,
    revision: revisionSchema,
    scenarioId: idSchema.optional(),
    status: encounterStatusSchema,
    title: z.string().min(1),
    updatedAt: z.string().min(1),
    viewVersion: z.literal(1),
  })
  .strict()
  .superRefine((view, context) => {
    if (view.revision !== view.updatedAt) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Encounter metadata revision must match updatedAt.",
        path: ["revision"],
      });
    }
  });

export const encounterAccessMetadataViewSchema = z
  .object({
    metadata: encounterMetadataViewSchema,
    participantMembershipMode: encounterParticipantMembershipModeSchema.optional(),
    participants: z.array(encounterParticipantSchema),
    viewVersion: z.literal(1),
  })
  .strict();

export const activeCombatStateViewSchema = z
  .object({
    activeCombatState: activeCombatRoundStateSchema.optional(),
    currentRound: z.number().int().positive(),
    encounterId: idSchema,
    participantMembershipMode: encounterParticipantMembershipModeSchema.optional(),
    participants: z.array(encounterParticipantSchema),
    participantVisibility: participantVisibilitySchema,
    revision: revisionSchema,
    scenarioId: idSchema.optional(),
    status: encounterStatusSchema,
    updatedAt: z.string().min(1),
    viewVersion: z.literal(1),
  })
  .strict()
  .superRefine((view, context) => {
    if (view.revision !== view.updatedAt) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Active combat state revision must match updatedAt.",
        path: ["revision"],
      });
    }
    if (
      view.activeCombatState?.encounterId &&
      view.activeCombatState.encounterId !== view.encounterId
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Active combat state encounter identity does not match its read view.",
        path: ["activeCombatState", "encounterId"],
      });
    }
  });

export const archivedCombatRoundsViewSchema: z.ZodType<
  ArchivedCombatRoundsView,
  z.ZodTypeDef,
  unknown
> = z
  .object({
    archivedRounds: z.array(completedCombatRoundSchema),
    encounterId: idSchema,
    revision: revisionSchema,
    updatedAt: z.string().min(1),
    viewVersion: z.literal(1),
  })
  .strict()
  .superRefine((view, context) => {
    if (view.revision !== view.updatedAt) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Archived combat rounds revision must match updatedAt.",
        path: ["revision"],
      });
    }
    for (const [index, round] of view.archivedRounds.entries()) {
      if (round.encounterId && round.encounterId !== view.encounterId) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Archived round encounter identity does not match its read view.",
          path: ["archivedRounds", index, "encounterId"],
        });
      }
    }
  });

export const combatHistorySourceViewSchema: z.ZodType<
  CombatHistorySourceView,
  z.ZodTypeDef,
  unknown
> = z
  .object({
    activeCombatState: activeCombatRoundStateSchema.optional(),
    archivedRounds: z.array(completedCombatRoundSchema),
    currentRound: z.number().int().positive(),
    encounterId: idSchema,
    participantMembershipMode: encounterParticipantMembershipModeSchema.optional(),
    participants: z.array(encounterParticipantSchema),
    participantVisibility: participantVisibilitySchema,
    revision: revisionSchema,
    scenarioId: idSchema.optional(),
    status: encounterStatusSchema,
    updatedAt: z.string().min(1),
    viewVersion: z.literal(1),
  })
  .strict()
  .superRefine((view, context) => {
    if (view.revision !== view.updatedAt) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Combat history source revision must match updatedAt.",
        path: ["revision"],
      });
    }
    if (
      view.activeCombatState?.encounterId &&
      view.activeCombatState.encounterId !== view.encounterId
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Active combat state encounter identity does not match its history source.",
        path: ["activeCombatState", "encounterId"],
      });
    }
    for (const [index, round] of view.archivedRounds.entries()) {
      if (round.encounterId && round.encounterId !== view.encounterId) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Archived round encounter identity does not match its history source.",
          path: ["archivedRounds", index, "encounterId"],
        });
      }
    }
  });

export const fullEncounterReadViewSchema = z
  .object({
    encounter: encounterSessionSchema,
    encounterId: idSchema,
    revision: revisionSchema,
    updatedAt: z.string().min(1),
    viewVersion: z.literal(1),
  })
  .strict()
  .superRefine((view, context) => {
    if (
      view.encounter.id !== view.encounterId ||
      view.encounter.updatedAt !== view.revision ||
      view.updatedAt !== view.revision
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Full encounter read identity does not match its encounter.",
        path: ["encounter"],
      });
    }
  });

export type EncounterMetadataView = z.infer<typeof encounterMetadataViewSchema>;
export type EncounterAccessMetadataView = z.infer<typeof encounterAccessMetadataViewSchema>;
export type ActiveCombatStateView = z.infer<typeof activeCombatStateViewSchema>;
export type FullEncounterReadView = z.infer<typeof fullEncounterReadViewSchema>;

/**
 * Narrow participant/membership facts used by access and visibility helpers.
 * This is deliberately not an EncounterSession compatibility alias.
 */
export interface EncounterParticipantReadSource {
  participantMembershipMode?: z.infer<typeof encounterParticipantMembershipModeSchema>;
  participants: z.infer<typeof encounterParticipantSchema>[];
  scenarioId?: string;
  status: z.infer<typeof encounterStatusSchema>;
}

interface PersistedEncounterReadMetadataInput {
  campaignId?: string | null;
  createdAt: string;
  encounterId: string;
  revision: string;
  scenarioId?: string | null;
  status: string;
  title: string;
}

const persistedCombatReadSessionSchema = z
  .object({
    combatRoundState: z.unknown().optional(),
    currentRound: z.number().int().positive().default(1),
    participantMembershipMode: encounterParticipantMembershipModeSchema.optional(),
    participants: z.array(encounterParticipantSchema).default([]),
    roleplayState: z
      .object({
        visibility: participantVisibilitySchema.default({}),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

function parseMetadata(input: PersistedEncounterReadMetadataInput): EncounterMetadataView {
  return encounterMetadataViewSchema.parse({
    campaignId: input.campaignId ?? undefined,
    createdAt: input.createdAt,
    encounterId: input.encounterId,
    revision: input.revision,
    scenarioId: input.scenarioId ?? undefined,
    status: input.status,
    title: input.title,
    updatedAt: input.revision,
    viewVersion: 1,
  });
}

function splitPersistedCombatState(value: unknown): {
  activeCombatState?: Record<string, unknown>;
  archivedRounds: unknown;
} {
  if (value === undefined || value === null) {
    return { archivedRounds: [] };
  }

  const persistedState = z.record(z.unknown()).parse(value);
  const { rounds, ...activeState } = persistedState;

  return {
    activeCombatState: activeState,
    archivedRounds: rounds ?? [],
  };
}

export function buildEncounterMetadataView(
  input: PersistedEncounterReadMetadataInput,
): EncounterMetadataView {
  return parseMetadata(input);
}

export function buildEncounterSessionSummaryFromMetadataView(
  metadata: EncounterMetadataView,
  options?: { viewerAssigned?: boolean },
): EncounterSessionSummary {
  return encounterSessionSummarySchema.parse({
    campaignId: metadata.campaignId,
    createdAt: metadata.createdAt,
    id: metadata.encounterId,
    scenarioId: metadata.scenarioId,
    status: metadata.status,
    title: metadata.title,
    updatedAt: metadata.updatedAt,
    viewerAssigned: options?.viewerAssigned,
  });
}

export function buildEncounterSessionRevisionFromMetadataView(
  metadata: EncounterMetadataView,
): EncounterSessionRevision {
  return encounterSessionRevisionSchema.parse({
    encounterId: metadata.encounterId,
    revision: metadata.revision,
    status: metadata.status,
    updatedAt: metadata.updatedAt,
  });
}

export function buildEncounterAccessMetadataViewFromPersistedSession(input: {
  metadata: PersistedEncounterReadMetadataInput;
  sessionJson: unknown;
}): EncounterAccessMetadataView {
  const metadata = parseMetadata(input.metadata);
  const session = persistedCombatReadSessionSchema.parse(input.sessionJson ?? {});

  return encounterAccessMetadataViewSchema.parse({
    metadata,
    participantMembershipMode: session.participantMembershipMode,
    participants: session.participants,
    viewVersion: 1,
  });
}

export function buildActiveCombatStateViewFromPersistedSession(input: {
  metadata: PersistedEncounterReadMetadataInput;
  sessionJson: unknown;
}): ActiveCombatStateView {
  const metadata = parseMetadata(input.metadata);
  const session = persistedCombatReadSessionSchema.parse(input.sessionJson ?? {});
  const splitState = splitPersistedCombatState(session.combatRoundState);

  return activeCombatStateViewSchema.parse({
    activeCombatState: splitState.activeCombatState,
    currentRound: session.currentRound,
    encounterId: metadata.encounterId,
    participantMembershipMode: session.participantMembershipMode,
    participants: session.participants,
    participantVisibility: session.roleplayState?.visibility ?? {},
    revision: metadata.revision,
    scenarioId: metadata.scenarioId,
    status: metadata.status,
    updatedAt: metadata.updatedAt,
    viewVersion: 1,
  });
}

export function buildArchivedCombatRoundsViewFromPersistedSession(input: {
  metadata: PersistedEncounterReadMetadataInput;
  sessionJson: unknown;
}): ArchivedCombatRoundsView {
  const metadata = parseMetadata(input.metadata);
  const session = persistedCombatReadSessionSchema.parse(input.sessionJson ?? {});
  const splitState = splitPersistedCombatState(session.combatRoundState);

  return archivedCombatRoundsViewSchema.parse({
    archivedRounds: splitState.archivedRounds,
    encounterId: metadata.encounterId,
    revision: metadata.revision,
    updatedAt: metadata.updatedAt,
    viewVersion: 1,
  });
}

export function buildCombatHistorySourceViewFromPersistedSession(input: {
  metadata: PersistedEncounterReadMetadataInput;
  sessionJson: unknown;
}): CombatHistorySourceView {
  const metadata = parseMetadata(input.metadata);
  const session = persistedCombatReadSessionSchema.parse(input.sessionJson ?? {});
  const splitState = splitPersistedCombatState(session.combatRoundState);

  return combatHistorySourceViewSchema.parse({
    activeCombatState: splitState.activeCombatState,
    archivedRounds: splitState.archivedRounds,
    currentRound: session.currentRound,
    encounterId: metadata.encounterId,
    participantMembershipMode: session.participantMembershipMode,
    participants: session.participants,
    participantVisibility: session.roleplayState?.visibility ?? {},
    revision: metadata.revision,
    scenarioId: metadata.scenarioId,
    status: metadata.status,
    updatedAt: metadata.updatedAt,
    viewVersion: 1,
  });
}

export function buildFullEncounterReadView(encounter: EncounterSession): FullEncounterReadView {
  return fullEncounterReadViewSchema.parse({
    encounter,
    encounterId: encounter.id,
    revision: encounter.updatedAt,
    updatedAt: encounter.updatedAt,
    viewVersion: 1,
  });
}

export function materializeCombatHistoryRoundState(
  source: CombatHistorySourceView,
): CombatRoundState | undefined {
  if (!source.activeCombatState) {
    return undefined;
  }

  return combatRoundStateSchema.parse({
    ...source.activeCombatState,
    encounterId: source.encounterId,
    rounds: source.archivedRounds,
  });
}

export function withCombatHistoryRoundState(input: {
  source: CombatHistorySourceView;
  state: CombatRoundState;
}): CombatHistorySourceView {
  const { rounds, ...activeCombatState } = combatRoundStateSchema.parse(input.state);

  return combatHistorySourceViewSchema.parse({
    ...input.source,
    activeCombatState: {
      ...activeCombatState,
      encounterId: input.source.encounterId,
    },
    archivedRounds: rounds,
  });
}

export function buildCombatHistorySourceViewFromState(input: {
  participantMembershipMode?: z.infer<typeof encounterParticipantMembershipModeSchema>;
  participants?: z.infer<typeof encounterParticipantSchema>[];
  revision: string;
  scenarioId?: string;
  state: CombatRoundState;
  status?: z.infer<typeof encounterStatusSchema>;
}): CombatHistorySourceView {
  const encounterId = input.state.encounterId;
  if (!encounterId) {
    throw new Error("Combat history source requires an encounter identity.");
  }
  const { rounds, ...activeCombatState } = combatRoundStateSchema.parse(input.state);

  return combatHistorySourceViewSchema.parse({
    activeCombatState,
    archivedRounds: rounds,
    currentRound: input.state.roundNumber,
    encounterId,
    participantMembershipMode: input.participantMembershipMode,
    participants: input.participants ?? [],
    participantVisibility: {},
    revision: input.revision,
    scenarioId: input.scenarioId,
    status: input.status ?? "active",
    updatedAt: input.revision,
    viewVersion: 1,
  });
}
