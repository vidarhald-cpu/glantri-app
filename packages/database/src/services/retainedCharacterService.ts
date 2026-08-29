import { createHash, randomUUID } from "node:crypto";

import { pilotSkillContentReleaseV1 } from "@glantri/content";
import {
  CHARACTER_ACQUISITION_LEDGER_VERSION,
  CHARACTER_MIGRATION_PREVIEW_VERSION,
  CHARACTER_REVISION_CONTRACT_VERSION,
  CHARACTER_SKILL_READ_MODEL_VERSION,
  PILOT_SKILL_CONTENT_DIGEST,
  PILOT_SKILL_CONTENT_RELEASE_ID,
  PILOT_SKILL_CONTENT_VERSION,
  PILOT_SKILL_RULES_RELEASE_ID,
  characterBuildSchema,
  type CharacterEffectiveSkillProjection,
  type CharacterEffectiveSkillReadModel,
  type CharacterLedgerAuthority,
  type CharacterLedgerEvent,
  type CharacterMigrationPreview,
  type CharacterProvenancePerspective,
  type CharacterRecord,
  type CharacterRevisionRecord,
  type CharacterVersionEnvelope,
  type HeadlessChargenFinalizeInput,
  type RetainedCharacterState,
} from "@glantri/domain";
import {
  calculateRetainedCharacterSkills,
  createRetainedCharacterStateFromPilotRelease,
  projectOwnerSafeRetainedCharacterSkills,
  projectRetainedCharacterRevision,
  RetainedCharacterRulesError,
  validateCharacterBuild,
  validateRetainedCharacterHeadlessChargen,
} from "@glantri/rules-engine";

import {
  createPrismaRetainedCharacterRepository,
  type RetainedCharacterRepository,
} from "../repositories/retainedCharacterRepository";
import { CharacterService, CharacterValidationError } from "./characterService";

export class RetainedCharacterMutationError extends Error {
  constructor(
    readonly code:
      | "retained_character_already_exists"
      | "retained_character_idempotency_conflict"
      | "retained_character_stale_revision"
      | "retained_character_unauthorized"
      | "retained_character_invalid_command",
    message: string,
    readonly currentRevisionId?: string | null,
  ) {
    super(message);
    this.name = "RetainedCharacterMutationError";
  }
}

export interface RetainedCharacterActor {
  isAdmin: boolean;
  userId: string;
}

interface RevisionWrite extends Omit<
  CharacterRevisionRecord,
  "createdAt" | "events" | "revisionState"
> {
  events: Array<Omit<CharacterLedgerEvent, "occurredAt">>;
}

interface IssuedMigrationPlan {
  characterId: string;
  expectedRevisionId: string;
  expiresAt: string;
  migrationId: string;
  previewDigest: `sha256:${string}`;
}

const issuedMigrationPlans = new Map<string, IssuedMigrationPlan>();

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entry]) => entry !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalize(entry)]),
    );
  }
  return value;
}

function digest(value: unknown): `sha256:${string}` {
  return `sha256:${createHash("sha256")
    .update(JSON.stringify(canonicalize(value)))
    .digest("hex")}`;
}

export function createPilotCharacterVersionEnvelope(input: {
  flexBudget: number;
  formationBudget: number;
  id: string;
}): CharacterVersionEnvelope {
  const values = {
    flexBudget: input.flexBudget,
    formationBudget: input.formationBudget,
    migrationPolicy: "accepted-release-maintenance" as const,
    progressionPolicy: "gm-authorized-history-advancement" as const,
    startingSpokenLanguageRule: "max(11,education)" as const,
    visibilityPolicy: "server-projected-provenance/v1" as const,
  };
  return {
    acquisitionLedgerVersion: CHARACTER_ACQUISITION_LEDGER_VERSION,
    characterRevisionVersion: CHARACTER_REVISION_CONTRACT_VERSION,
    chargenConfiguration: {
      contractVersion: "pilot-chargen-configuration/v1",
      digest: digest(values),
      id: input.id,
      values,
    },
    contentRelease: {
      contentVersion: PILOT_SKILL_CONTENT_VERSION,
      digest: PILOT_SKILL_CONTENT_DIGEST,
      id: PILOT_SKILL_CONTENT_RELEASE_ID,
    },
    skillReadModelVersion: CHARACTER_SKILL_READ_MODEL_VERSION,
    skillRules: {
      engineVersion: PILOT_SKILL_RULES_RELEASE_ID,
      id: PILOT_SKILL_RULES_RELEASE_ID,
      policy: "floor-strongest-explicit-directional-non-recursive/v1",
    },
  };
}

function assertSupportedVersionEnvelope(envelope: CharacterVersionEnvelope): void {
  const expectedConfigurationDigest = digest(envelope.chargenConfiguration.values);
  if (
    envelope.acquisitionLedgerVersion !== CHARACTER_ACQUISITION_LEDGER_VERSION ||
    envelope.characterRevisionVersion !== CHARACTER_REVISION_CONTRACT_VERSION ||
    envelope.skillReadModelVersion !== CHARACTER_SKILL_READ_MODEL_VERSION ||
    envelope.contentRelease.id !== PILOT_SKILL_CONTENT_RELEASE_ID ||
    envelope.contentRelease.contentVersion !== PILOT_SKILL_CONTENT_VERSION ||
    envelope.contentRelease.digest !== PILOT_SKILL_CONTENT_DIGEST ||
    envelope.skillRules.id !== PILOT_SKILL_RULES_RELEASE_ID ||
    envelope.skillRules.engineVersion !== PILOT_SKILL_RULES_RELEASE_ID ||
    envelope.skillRules.policy !== "floor-strongest-explicit-directional-non-recursive/v1" ||
    envelope.chargenConfiguration.contractVersion !== "pilot-chargen-configuration/v1" ||
    envelope.chargenConfiguration.digest !== expectedConfigurationDigest
  ) {
    throw new RetainedCharacterMutationError(
      "retained_character_invalid_command",
      "No accepted mapping manifest is available for the requested rules or content release.",
    );
  }
}

function buildEffectiveSkills(input: {
  characterId: string;
  revisionId: string;
  state: RetainedCharacterState;
  versionEnvelope: CharacterVersionEnvelope;
}): CharacterEffectiveSkillReadModel {
  const { rows } = calculateRetainedCharacterSkills(input.state);
  return {
    calculationDigest: digest({ rows, versionEnvelope: input.versionEnvelope }),
    characterId: input.characterId,
    characterRevisionId: input.revisionId,
    rows,
    versionEnvelope: input.versionEnvelope,
  };
}

function event(input: {
  actorUserId: string | null;
  authority: CharacterLedgerAuthority;
  characterId: string;
  component: CharacterLedgerEvent["component"];
  eventKind: CharacterLedgerEvent["eventKind"];
  idempotencyKey: string;
  phase: CharacterLedgerEvent["phase"];
  publicExplanation: string;
  revisionId: string;
  sequence: number;
  sourceId: string;
  sourceKind: string;
  sourceLabel: string;
  targetId: string;
  targetKind: CharacterLedgerEvent["targetKind"];
  valueAfter: number | null;
  valueBefore: number | null;
  versionEnvelope: CharacterVersionEnvelope;
  economics?: Record<string, unknown>;
  prerequisiteEvidence?: Record<string, unknown>;
  protectedProvenance?: Record<string, unknown>;
  visibility?: CharacterLedgerEvent["visibility"];
}): Omit<CharacterLedgerEvent, "occurredAt"> {
  return {
    actorUserId: input.actorUserId,
    authority: input.authority,
    characterId: input.characterId,
    characterRevisionId: input.revisionId,
    component: input.component,
    economics: input.economics,
    eventId: randomUUID(),
    eventKind: input.eventKind,
    idempotencyKey: `${input.idempotencyKey}:event:${input.sequence}`,
    phase: input.phase,
    prerequisiteEvidence: input.prerequisiteEvidence,
    protectedProvenance: input.protectedProvenance,
    publicExplanation: input.publicExplanation,
    sequence: input.sequence,
    sourceId: input.sourceId,
    sourceKind: input.sourceKind,
    sourceLabel: input.sourceLabel,
    targetId: input.targetId,
    targetKind: input.targetKind,
    valueAfter: input.valueAfter,
    valueBefore: input.valueBefore,
    valueDelta:
      input.valueAfter == null || input.valueBefore == null
        ? null
        : input.valueAfter - input.valueBefore,
    versionEnvelope: input.versionEnvelope,
    visibility: input.visibility ?? "owner_and_gm",
  };
}

function initialEvents(input: {
  actorUserId: string;
  characterId: string;
  commandKey: string;
  revisionId: string;
  state: RetainedCharacterState;
  versionEnvelope: CharacterVersionEnvelope;
}): RevisionWrite["events"] {
  const fixture = pilotSkillContentReleaseV1.characters.find(
    (candidate) => candidate.id === input.state.pilotCharacterId,
  )!;
  const accessEvidence = fixture.accessExceptionIds.length
    ? { accessExceptionIds: fixture.accessExceptionIds }
    : undefined;
  const calculation = calculateRetainedCharacterSkills(input.state).pilotResult;
  const competencyById = new Map<string, (typeof pilotSkillContentReleaseV1.competencies)[number]>(
    pilotSkillContentReleaseV1.competencies.map((competency) => [competency.id, competency]),
  );
  const specializationById = new Map<
    string,
    (typeof pilotSkillContentReleaseV1.specializations)[number]
  >(
    pilotSkillContentReleaseV1.specializations.map((specialization) => [
      specialization.id,
      specialization,
    ]),
  );
  const result: RevisionWrite["events"] = [];
  const push = (entry: Omit<Parameters<typeof event>[0], "sequence">) =>
    result.push(event({ ...entry, sequence: result.length + 1 }));

  for (const grant of input.state.grants) {
    push({
      actorUserId: input.actorUserId,
      authority: "owner",
      characterId: input.characterId,
      component: "explicit_grant",
      eventKind: "background_competence_granted",
      idempotencyKey: input.commandKey,
      phase: "chargen",
      publicExplanation: "Starting spoken language granted by background.",
      revisionId: input.revisionId,
      sourceId: grant.sourceId,
      sourceKind: grant.sourceKind,
      sourceLabel: "Background language",
      targetId: grant.competencyId,
      targetKind: "spoken-language",
      valueAfter: grant.ranks,
      valueBefore: 0,
      versionEnvelope: input.versionEnvelope,
    });
  }
  for (const history of input.state.histories) {
    push({
      actorUserId: input.actorUserId,
      authority: "owner",
      characterId: input.characterId,
      component: "history",
      economics: {
        finalBundleCost: calculation.groupBundle.bundleCost,
        memberSnapshot: history.competencyIds,
        pricingPolicy: "pilot-v1-final-bundle-one-ceiling",
        weightedUsefulIncrement: calculation.groupBundle.weightedUsefulIncrement,
      },
      eventKind: "learning_history_acquired",
      idempotencyKey: input.commandKey,
      phase: "chargen",
      protectedProvenance: accessEvidence,
      publicExplanation: `Acquired ${history.definitionLabel} at level ${history.level}.`,
      revisionId: input.revisionId,
      sourceId: history.definitionId,
      sourceKind: "learning_history",
      sourceLabel: history.definitionLabel,
      targetId: history.instanceId,
      targetKind: "history",
      valueAfter: history.level,
      valueBefore: 0,
      versionEnvelope: input.versionEnvelope,
    });
  }
  for (const acquisition of input.state.directAcquisitions) {
    const definition = competencyById.get(acquisition.competencyId)!;
    push({
      actorUserId: input.actorUserId,
      authority: "owner",
      characterId: input.characterId,
      component: "direct",
      economics: {
        amountPaid: definition.weight * acquisition.ranks,
        ranks: acquisition.ranks,
        weight: definition.weight,
      },
      eventKind: "direct_skill_acquired",
      idempotencyKey: input.commandKey,
      phase: "chargen",
      prerequisiteEvidence: accessEvidence,
      protectedProvenance: accessEvidence,
      publicExplanation: `Acquired ${acquisition.ranks} direct ranks.`,
      revisionId: input.revisionId,
      sourceId: input.state.backgroundId,
      sourceKind: "individual_training",
      sourceLabel: "Chargen training",
      targetId: acquisition.competencyId,
      targetKind: "skill",
      valueAfter: acquisition.ranks,
      valueBefore: 0,
      versionEnvelope: input.versionEnvelope,
    });
  }
  for (const acquisition of input.state.specializationAcquisitions) {
    const definition = specializationById.get(acquisition.competencyId)!;
    const specializationResult = calculation.byCompetencyId[acquisition.competencyId]!;
    push({
      actorUserId: input.actorUserId,
      authority: "owner",
      characterId: input.characterId,
      component: "specialization",
      economics: {
        amountPaid: 2 + definition.acquisitionWeight * acquisition.ranks,
        initiationCost: 2,
        ranks: acquisition.ranks,
        weight: definition.acquisitionWeight,
      },
      eventKind: "specialization_acquired",
      idempotencyKey: input.commandKey,
      phase: "chargen",
      prerequisiteEvidence: {
        explicitlyAcquired: true,
        prerequisites: specializationResult.specialization?.prerequisites,
      },
      publicExplanation: `Explicitly acquired ${acquisition.ranks} Specialization ranks.`,
      revisionId: input.revisionId,
      sourceId: input.state.backgroundId,
      sourceKind: "individual_training",
      sourceLabel: "Chargen specialization",
      targetId: acquisition.competencyId,
      targetKind: "specialization",
      valueAfter: acquisition.ranks,
      valueBefore: 0,
      versionEnvelope: input.versionEnvelope,
    });
  }
  return result;
}

function buildRevision(input: {
  actorUserId: string;
  authority: CharacterLedgerAuthority;
  characterId: string;
  command: unknown;
  commandKey: string;
  events: (revisionId: string) => RevisionWrite["events"];
  migrationLineage: CharacterRevisionRecord["migrationLineage"];
  parentRevisionId: string | null;
  reason: string;
  sequence: number;
  state: RetainedCharacterState;
  versionEnvelope: CharacterVersionEnvelope;
}): RevisionWrite {
  const id = randomUUID();
  const effectiveSkills = buildEffectiveSkills({
    characterId: input.characterId,
    revisionId: id,
    state: input.state,
    versionEnvelope: input.versionEnvelope,
  });
  const commandDigest = digest(input.command);
  const base = {
    actorUserId: input.actorUserId,
    characterId: input.characterId,
    commandDigest,
    commandIdempotencyKey: input.commandKey,
    effectiveSkills,
    id,
    migrationLineage: input.migrationLineage,
    parentRevisionId: input.parentRevisionId,
    reason: input.reason,
    sequence: input.sequence,
    state: input.state,
    versionEnvelope: input.versionEnvelope,
  };
  const events = input.events(id);
  return {
    ...base,
    events,
    revisionDigest: digest({ ...base, events }),
  };
}

export class RetainedCharacterService {
  constructor(
    private readonly repository: RetainedCharacterRepository = createPrismaRetainedCharacterRepository(),
    private readonly characterService = new CharacterService(),
  ) {}

  async finalizeHeadless(input: {
    actor: RetainedCharacterActor;
    command: HeadlessChargenFinalizeInput;
  }): Promise<{ character: CharacterRecord; revision: CharacterRevisionRecord }> {
    const build = characterBuildSchema.parse(input.command.build);
    let existingCharacter = await this.characterService.getCharacterById(build.id);
    if (existingCharacter) {
      await this.assertCharacterLifecycleAuthority(input.actor, build.id);
    }
    const validation = validateCharacterBuild({ build });
    if (!validation.valid) {
      throw new CharacterValidationError(validation.issues.map((issue) => issue.message));
    }
    let state: RetainedCharacterState;
    try {
      state = createRetainedCharacterStateFromPilotRelease({
        characterId: build.id,
        pilotCharacterId: input.command.pilotCharacterId,
      });
      validateRetainedCharacterHeadlessChargen({
        flexBudget: input.command.configuration.flexBudget,
        formationBudget: input.command.configuration.formationBudget,
        state,
      });
    } catch (error) {
      if (error instanceof RetainedCharacterRulesError) {
        throw new RetainedCharacterMutationError(
          "retained_character_invalid_command",
          error.message,
        );
      }
      throw error;
    }
    const envelope = createPilotCharacterVersionEnvelope(input.command.configuration);
    const commandPayload = { ...input.command, build };
    const commandDigest = digest(commandPayload);
    const replay = await this.repository.findByCommand(build.id, input.command.idempotencyKey);
    if (replay) {
      if (!existingCharacter) {
        await this.assertCharacterLifecycleAuthority(input.actor, build.id);
        existingCharacter = await this.characterService.getCharacterById(build.id);
      }
      if (replay.commandDigest === commandDigest) {
        return { character: existingCharacter!, revision: replay };
      }
      throw new RetainedCharacterMutationError(
        "retained_character_idempotency_conflict",
        "This idempotency key was already used for different finalization input.",
        replay.id,
      );
    }
    const current = await this.repository.findCurrent(build.id);
    if (current) {
      if (!existingCharacter) {
        await this.assertCharacterLifecycleAuthority(input.actor, build.id);
      }
      throw new RetainedCharacterMutationError(
        "retained_character_already_exists",
        "A retained Character already exists with this identity.",
        current.id,
      );
    }
    const revision = buildRevision({
      actorUserId: input.actor.userId,
      authority: "owner",
      characterId: build.id,
      command: commandPayload,
      commandKey: input.command.idempotencyKey,
      events: (revisionId) =>
        initialEvents({
          actorUserId: input.actor.userId,
          characterId: build.id,
          commandKey: input.command.idempotencyKey,
          revisionId,
          state,
          versionEnvelope: envelope,
        }),
      migrationLineage: { status: "current" },
      parentRevisionId: null,
      reason: "Headless Chargen finalization",
      sequence: 1,
      state,
      versionEnvelope: envelope,
    });
    try {
      const committed = await this.repository.createFinalized({
        build,
        ownerId: input.actor.userId,
        revision,
      });
      const character = await this.characterService.getCharacterById(build.id);
      return { character: character!, revision: committed };
    } catch (error) {
      const concurrent = await this.repository.findCurrent(build.id);
      if (concurrent) {
        await this.assertCharacterLifecycleAuthority(input.actor, build.id);
      }
      if (
        concurrent?.commandIdempotencyKey === input.command.idempotencyKey &&
        concurrent.commandDigest === commandDigest
      ) {
        return {
          character: (await this.characterService.getCharacterById(build.id))!,
          revision: concurrent,
        };
      }
      if (!concurrent) throw error;
      throw new RetainedCharacterMutationError(
        "retained_character_already_exists",
        "A retained Character already exists with this identity.",
        concurrent?.id,
      );
    }
  }

  async finalizeHeadlessProjected(input: {
    actor: RetainedCharacterActor;
    command: HeadlessChargenFinalizeInput;
  }): Promise<{ character: CharacterRecord; revision: CharacterEffectiveSkillProjection }> {
    const finalized = await this.finalizeHeadless(input);
    return {
      character: finalized.character,
      revision: await this.projectAuthorizedRevision({
        actor: input.actor,
        characterId: finalized.character.id,
        revision: finalized.revision,
      }),
    };
  }

  async getCurrentProjection(input: {
    characterId: string;
    perspective: CharacterProvenancePerspective;
  }): Promise<CharacterEffectiveSkillProjection | null> {
    const revision = await this.repository.findCurrent(input.characterId);
    return revision ? projectRetainedCharacterRevision(revision, input.perspective) : null;
  }

  async getRevision(
    characterId: string,
    revisionId: string,
  ): Promise<CharacterRevisionRecord | null> {
    return this.repository.findRevision(characterId, revisionId);
  }

  async projectAuthorizedRevision(input: {
    actor: RetainedCharacterActor;
    characterId: string;
    revision: CharacterRevisionRecord;
  }): Promise<CharacterEffectiveSkillProjection> {
    await this.assertCharacterLifecycleAuthority(input.actor, input.characterId);
    const authority = await this.authorityFor(input.actor, input.characterId);
    const perspective: CharacterProvenancePerspective =
      authority === "admin"
        ? "admin"
        : authority === "campaign_gm"
          ? "current_campaign_gm"
          : "owner";
    return projectRetainedCharacterRevision(input.revision, perspective)!;
  }

  async advanceLearningHistory(input: {
    actor: RetainedCharacterActor;
    characterId: string;
    expectedRevisionId: string;
    historyInstanceId: string;
    idempotencyKey: string;
    reason: string;
    targetLevel: number;
  }): Promise<CharacterRevisionRecord> {
    await this.assertLearningHistoryAdvanceAuthority(input.actor, input.characterId);
    const replay = await this.findIdempotent(input.characterId, input.idempotencyKey, input);
    if (replay) return replay;
    const current = await this.requireCurrent(input.characterId, input.expectedRevisionId);
    const history = current.state.histories.find(
      (candidate) => candidate.instanceId === input.historyInstanceId,
    );
    if (!history || input.targetLevel <= history.level || !Number.isInteger(input.targetLevel)) {
      throw new RetainedCharacterMutationError(
        "retained_character_invalid_command",
        "The learning-history target must be a higher whole-number level.",
      );
    }
    const state = structuredClone(current.state);
    const nextHistory = state.histories.find(
      (candidate) => candidate.instanceId === input.historyInstanceId,
    )!;
    const beforeLevel = nextHistory.level;
    const beforeCost = calculateRetainedCharacterSkills(current.state).pilotResult.groupBundle
      .bundleCost;
    nextHistory.level = input.targetLevel;
    const afterCost = calculateRetainedCharacterSkills(state).pilotResult.groupBundle.bundleCost;
    const authority = input.actor.isAdmin ? "admin" : "campaign_gm";
    const revision = buildRevision({
      actorUserId: input.actor.userId,
      authority,
      characterId: input.characterId,
      command: input,
      commandKey: input.idempotencyKey,
      events: (revisionId) => [
        event({
          actorUserId: input.actor.userId,
          authority,
          characterId: input.characterId,
          component: "history",
          economics: {
            marginalCost: Math.max(0, afterCost - beforeCost),
            pinnedRulesVersion: current.versionEnvelope.skillRules.id,
          },
          eventKind: "learning_history_advanced",
          idempotencyKey: input.idempotencyKey,
          phase: "post_chargen",
          publicExplanation: input.reason,
          revisionId,
          sequence: 1,
          sourceId: history.definitionId,
          sourceKind: "learning_history",
          sourceLabel: history.definitionLabel,
          targetId: history.instanceId,
          targetKind: "history",
          valueAfter: input.targetLevel,
          valueBefore: beforeLevel,
          versionEnvelope: current.versionEnvelope,
        }),
      ],
      migrationLineage: { status: "current" },
      parentRevisionId: current.id,
      reason: "GM-authorized learning-history advancement",
      sequence: current.sequence + 1,
      state,
      versionEnvelope: current.versionEnvelope,
    });
    return this.append(current.id, revision);
  }

  async changeProfessionContext(input: {
    actor: RetainedCharacterActor;
    characterId: string;
    expectedRevisionId: string;
    idempotencyKey: string;
    professionId: string;
    reason: string;
  }): Promise<CharacterRevisionRecord> {
    await this.assertCharacterLifecycleAuthority(input.actor, input.characterId);
    const replay = await this.findIdempotent(input.characterId, input.idempotencyKey, input);
    if (replay) return replay;
    const current = await this.requireCurrent(input.characterId, input.expectedRevisionId);
    const state = { ...current.state, professionId: input.professionId };
    const authority = await this.authorityFor(input.actor, input.characterId);
    const revision = buildRevision({
      actorUserId: input.actor.userId,
      authority,
      characterId: input.characterId,
      command: input,
      commandKey: input.idempotencyKey,
      events: (revisionId) => [
        event({
          actorUserId: input.actor.userId,
          authority,
          characterId: input.characterId,
          component: "context",
          eventKind: "profession_context_changed",
          idempotencyKey: input.idempotencyKey,
          phase: "post_chargen",
          publicExplanation: input.reason,
          revisionId,
          sequence: 1,
          sourceId: current.state.professionId,
          sourceKind: "profession_context",
          sourceLabel: current.state.professionId,
          targetId: input.professionId,
          targetKind: "character",
          valueAfter: null,
          valueBefore: null,
          versionEnvelope: current.versionEnvelope,
        }),
      ],
      migrationLineage: { status: "current" },
      parentRevisionId: current.id,
      reason: "Profession context changed; mechanics preserved",
      sequence: current.sequence + 1,
      state,
      versionEnvelope: current.versionEnvelope,
    });
    return this.append(current.id, revision);
  }

  async previewMigration(input: {
    actor: RetainedCharacterActor;
    characterId: string;
    expectedRevisionId: string;
    migrationId: string;
    targetEnvelope: CharacterVersionEnvelope;
  }): Promise<CharacterMigrationPreview> {
    await this.assertCharacterLifecycleAuthority(input.actor, input.characterId);
    const current = await this.requireCurrent(input.characterId, input.expectedRevisionId);
    const authority = await this.authorityFor(input.actor, input.characterId);
    assertSupportedVersionEnvelope(input.targetEnvelope);
    const rawAfter = buildEffectiveSkills({
      characterId: current.characterId,
      revisionId: current.id,
      state: current.state,
      versionEnvelope: input.targetEnvelope,
    });
    const before =
      authority === "owner"
        ? projectOwnerSafeRetainedCharacterSkills(current, current.effectiveSkills)
        : current.effectiveSkills;
    const after =
      authority === "owner" ? projectOwnerSafeRetainedCharacterSkills(current, rawAfter) : rawAfter;
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const base = {
      after,
      before,
      characterId: current.characterId,
      expiresAt,
      expectedRevisionId: current.id,
      migrationId: input.migrationId,
      mutatesCharacter: false as const,
      planId: randomUUID(),
      targetEnvelope: input.targetEnvelope,
      version: CHARACTER_MIGRATION_PREVIEW_VERSION,
      warnings: [
        "Historical acquisitions, Scenario snapshots, and accepted rolls remain unchanged.",
      ],
    };
    const preview = { ...base, previewDigest: digest(base) };
    this.rememberIssuedMigrationPlan(preview);
    return preview;
  }

  async applyMigration(input: {
    actor: RetainedCharacterActor;
    characterId: string;
    idempotencyKey: string;
    preview: CharacterMigrationPreview;
  }): Promise<CharacterRevisionRecord> {
    const authority = await this.assertMigrationApplyAuthority(input.actor, input.characterId);
    if (input.preview.characterId !== input.characterId) {
      throw new RetainedCharacterMutationError(
        "retained_character_invalid_command",
        "The migration preview does not match the requested Character.",
      );
    }
    const replay = await this.findIdempotent(input.characterId, input.idempotencyKey, input);
    if (replay) return replay;
    this.assertIssuedMigrationPlan(input.preview);
    const current = await this.requireCurrent(input.characterId, input.preview.expectedRevisionId);
    assertSupportedVersionEnvelope(input.preview.targetEnvelope);
    if (input.preview.expiresAt <= new Date().toISOString()) {
      throw new RetainedCharacterMutationError(
        "retained_character_invalid_command",
        "The migration preview expired; create a new preview.",
      );
    }
    const { previewDigest: _previewDigest, ...previewBase } = input.preview;
    if (digest(previewBase) !== input.preview.previewDigest) {
      throw new RetainedCharacterMutationError(
        "retained_character_invalid_command",
        "The migration preview digest does not match its contents.",
      );
    }
    const expectedAfter = buildEffectiveSkills({
      characterId: current.characterId,
      revisionId: current.id,
      state: current.state,
      versionEnvelope: input.preview.targetEnvelope,
    });
    const expectedSafeBefore = projectOwnerSafeRetainedCharacterSkills(
      current,
      current.effectiveSkills,
    );
    const expectedSafeAfter = projectOwnerSafeRetainedCharacterSkills(current, expectedAfter);
    const previewUsesFullProjection =
      digest(input.preview.before) === digest(current.effectiveSkills) &&
      digest(input.preview.after) === digest(expectedAfter);
    const previewUsesOwnerSafeProjection =
      digest(input.preview.before) === digest(expectedSafeBefore) &&
      digest(input.preview.after) === digest(expectedSafeAfter);
    if (
      input.preview.version !== CHARACTER_MIGRATION_PREVIEW_VERSION ||
      input.preview.mutatesCharacter !== false ||
      input.preview.before.characterId !== input.characterId ||
      input.preview.after.characterId !== input.characterId ||
      input.preview.before.characterRevisionId !== current.id ||
      input.preview.after.characterRevisionId !== current.id ||
      (!previewUsesFullProjection && !previewUsesOwnerSafeProjection)
    ) {
      throw new RetainedCharacterMutationError(
        "retained_character_invalid_command",
        "The migration preview no longer matches the retained Character calculation.",
      );
    }
    const revision = buildRevision({
      actorUserId: input.actor.userId,
      authority,
      characterId: current.characterId,
      command: input,
      commandKey: input.idempotencyKey,
      events: (revisionId) => [
        event({
          actorUserId: input.actor.userId,
          authority,
          characterId: current.characterId,
          component: "migration",
          economics: { historicalCostsRetained: true, previewDigest: input.preview.previewDigest },
          eventKind: "migration_applied",
          idempotencyKey: input.idempotencyKey,
          phase: "migration",
          publicExplanation: "Applied accepted Character catalogue/rules maintenance.",
          revisionId,
          sequence: 1,
          sourceId: current.versionEnvelope.contentRelease.id,
          sourceKind: "migration",
          sourceLabel: input.preview.migrationId,
          targetId: input.preview.targetEnvelope.contentRelease.id,
          targetKind: "character",
          valueAfter: current.sequence + 1,
          valueBefore: current.sequence,
          versionEnvelope: input.preview.targetEnvelope,
        }),
      ],
      migrationLineage: {
        migrationId: input.preview.migrationId,
        sourceRevisionId: current.id,
        status: "migration_applied",
      },
      parentRevisionId: current.id,
      reason: "Required catalogue/rules migration applied",
      sequence: current.sequence + 1,
      state: current.state,
      versionEnvelope: input.preview.targetEnvelope,
    });
    return this.append(current.id, revision);
  }

  async rollbackMigration(input: {
    actor: RetainedCharacterActor;
    characterId: string;
    expectedRevisionId: string;
    idempotencyKey: string;
    migrationRevisionId: string;
  }): Promise<CharacterRevisionRecord> {
    const authority = await this.assertMigrationApplyAuthority(input.actor, input.characterId);
    const replay = await this.findIdempotent(input.characterId, input.idempotencyKey, input);
    if (replay) return replay;
    const current = await this.requireCurrent(input.characterId, input.expectedRevisionId);
    if (current.id !== input.migrationRevisionId || !current.migrationLineage.sourceRevisionId) {
      throw new RetainedCharacterMutationError(
        "retained_character_invalid_command",
        "Exact rollback is available only while the migration revision is current.",
      );
    }
    const source = await this.repository.findRevision(
      input.characterId,
      current.migrationLineage.sourceRevisionId,
    );
    if (!source) {
      throw new RetainedCharacterMutationError(
        "retained_character_invalid_command",
        "The retained source revision is unavailable.",
      );
    }
    const revision = buildRevision({
      actorUserId: input.actor.userId,
      authority,
      characterId: input.characterId,
      command: input,
      commandKey: input.idempotencyKey,
      events: (revisionId) => [
        event({
          actorUserId: input.actor.userId,
          authority,
          characterId: input.characterId,
          component: "migration",
          eventKind: "migration_rollback_applied",
          idempotencyKey: input.idempotencyKey,
          phase: "migration",
          publicExplanation: "Applied an audited rollback to the retained pre-migration state.",
          revisionId,
          sequence: 1,
          sourceId: current.id,
          sourceKind: "migration",
          sourceLabel: current.migrationLineage.migrationId ?? "migration",
          targetId: source.id,
          targetKind: "character",
          valueAfter: current.sequence + 1,
          valueBefore: current.sequence,
          versionEnvelope: source.versionEnvelope,
        }),
      ],
      migrationLineage: {
        rollbackOfRevisionId: current.id,
        sourceRevisionId: source.id,
        status: "rollback_applied",
      },
      parentRevisionId: current.id,
      reason: "Migration rollback applied as a new revision",
      sequence: current.sequence + 1,
      state: source.state,
      versionEnvelope: source.versionEnvelope,
    });
    return this.append(current.id, revision);
  }

  private async append(expectedRevisionId: string, revision: RevisionWrite) {
    try {
      const result = await this.repository.appendRevision({ expectedRevisionId, revision });
      if (result.kind === "stale") {
        throw new RetainedCharacterMutationError(
          "retained_character_stale_revision",
          "The Character changed. Reload and create a new preview before retrying.",
          result.currentRevisionId,
        );
      }
      return result.revision;
    } catch (error) {
      if (error instanceof RetainedCharacterMutationError) throw error;
      if (error instanceof Error && error.message === "retained_character_idempotency_conflict") {
        throw new RetainedCharacterMutationError(
          "retained_character_idempotency_conflict",
          "This idempotency key was already used for a different command.",
        );
      }
      if (error instanceof Error && error.message === "retained_character_stale_revision") {
        throw new RetainedCharacterMutationError(
          "retained_character_stale_revision",
          "The Character changed. Reload and create a new preview before retrying.",
        );
      }
      throw error;
    }
  }

  private rememberIssuedMigrationPlan(preview: CharacterMigrationPreview): void {
    const now = new Date().toISOString();
    for (const [planId, plan] of issuedMigrationPlans) {
      if (plan.expiresAt <= now) issuedMigrationPlans.delete(planId);
    }
    issuedMigrationPlans.set(preview.planId, {
      characterId: preview.characterId,
      expectedRevisionId: preview.expectedRevisionId,
      expiresAt: preview.expiresAt,
      migrationId: preview.migrationId,
      previewDigest: preview.previewDigest,
    });
  }

  private assertIssuedMigrationPlan(preview: CharacterMigrationPreview): void {
    const issued = issuedMigrationPlans.get(preview.planId);
    if (issued && issued.expiresAt <= new Date().toISOString()) {
      issuedMigrationPlans.delete(preview.planId);
      throw new RetainedCharacterMutationError(
        "retained_character_invalid_command",
        "The migration preview expired; create a new preview.",
      );
    }
    if (
      !issued ||
      issued.characterId !== preview.characterId ||
      issued.expectedRevisionId !== preview.expectedRevisionId ||
      issued.expiresAt !== preview.expiresAt ||
      issued.migrationId !== preview.migrationId ||
      issued.previewDigest !== preview.previewDigest
    ) {
      throw new RetainedCharacterMutationError(
        "retained_character_invalid_command",
        "The migration preview is not the exact server-issued plan.",
      );
    }
  }

  private async findIdempotent(
    characterId: string,
    idempotencyKey: string,
    command: unknown,
  ): Promise<CharacterRevisionRecord | null> {
    const replay = await this.repository.findByCommand(characterId, idempotencyKey);
    if (!replay) return null;
    if (replay.commandDigest !== digest(command)) {
      throw new RetainedCharacterMutationError(
        "retained_character_idempotency_conflict",
        "This idempotency key was already used for a different command.",
        replay.id,
      );
    }
    return replay;
  }

  private async requireCurrent(characterId: string, expectedRevisionId: string) {
    const current = await this.repository.findCurrent(characterId);
    if (!current || current.id !== expectedRevisionId) {
      throw new RetainedCharacterMutationError(
        "retained_character_stale_revision",
        "The Character changed. Reload and create a new preview before retrying.",
        current?.id,
      );
    }
    return current;
  }

  private async authorityFor(
    actor: RetainedCharacterActor,
    characterId: string,
  ): Promise<CharacterLedgerAuthority> {
    if (actor.isAdmin) return "admin";
    const membership = await this.repository.findActiveCampaignMembership(characterId);
    return membership?.gmUserId === actor.userId ? "campaign_gm" : "owner";
  }

  private async assertCharacterLifecycleAuthority(
    actor: RetainedCharacterActor,
    characterId: string,
  ): Promise<void> {
    if (actor.isAdmin) return;
    const [character, membership] = await Promise.all([
      this.characterService.getCharacterById(characterId),
      this.repository.findActiveCampaignMembership(characterId),
    ]);
    if (character?.ownerId !== actor.userId && membership?.gmUserId !== actor.userId) {
      throw new RetainedCharacterMutationError(
        "retained_character_unauthorized",
        "Character not found.",
      );
    }
  }

  private async assertLearningHistoryAdvanceAuthority(
    actor: RetainedCharacterActor,
    characterId: string,
  ): Promise<void> {
    if (actor.isAdmin) return;
    const membership = await this.repository.findActiveCampaignMembership(characterId);
    if (membership?.gmUserId !== actor.userId) {
      throw new RetainedCharacterMutationError(
        "retained_character_unauthorized",
        "Character not found.",
      );
    }
  }

  private async assertMigrationApplyAuthority(
    actor: RetainedCharacterActor,
    characterId: string,
  ): Promise<CharacterLedgerAuthority> {
    if (actor.isAdmin) return "admin";
    const [character, membership] = await Promise.all([
      this.characterService.getCharacterById(characterId),
      this.repository.findActiveCampaignMembership(characterId),
    ]);
    if (membership) {
      if (membership.gmUserId === actor.userId) return "campaign_gm";
    } else if (character?.ownerId === actor.userId) {
      return "owner";
    }
    throw new RetainedCharacterMutationError(
      "retained_character_unauthorized",
      "The current Campaign GM must apply required maintenance for a rostered Character.",
    );
  }
}
