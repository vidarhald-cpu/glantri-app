import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import type {
  CharacterBuild,
  CharacterMigrationPreview,
  CharacterRecord,
  CharacterRevisionRecord,
} from "@glantri/domain";

import type { RetainedCharacterRepository } from "../repositories/retainedCharacterRepository";
import type { CharacterService } from "./characterService";
import {
  createPilotCharacterVersionEnvelope,
  RetainedCharacterService,
} from "./retainedCharacterService";

function build(characterId: string): CharacterBuild {
  return {
    equipment: { items: [] },
    id: characterId,
    name: "In-memory retained Character",
    profile: {
      description: "Coverage fixture",
      distractionLevel: 3,
      id: `profile:${characterId}`,
      label: "Coverage profile",
      rolledStats: {
        cha: 10,
        com: 10,
        con: 10,
        dex: 10,
        health: 10,
        int: 10,
        lck: 10,
        pow: 10,
        siz: 10,
        str: 10,
        will: 10,
      },
      societyLevel: 0,
    },
    progression: {
      chargenMode: "standard",
      educationPoints: 0,
      flexiblePointFactor: 1,
      level: 1,
      primaryPoolSpent: 0,
      primaryPoolTotal: 60,
      secondaryPoolSpent: 0,
      secondaryPoolTotal: 26,
      skillGroups: [],
      skills: [],
      specializations: [],
    },
    progressionState: {
      availablePoints: 0,
      checks: [],
      history: [],
      pendingAttempts: [],
    },
  };
}

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

function withClientRecomputedDigest(preview: CharacterMigrationPreview): CharacterMigrationPreview {
  const { previewDigest: _previewDigest, ...base } = preview;
  return {
    ...base,
    previewDigest: `sha256:${createHash("sha256")
      .update(JSON.stringify(canonicalize(base)))
      .digest("hex")}`,
  };
}

function inMemoryServices() {
  const characters = new Map<string, CharacterRecord>();
  const revisions = new Map<string, CharacterRevisionRecord[]>();
  let membership: Awaited<ReturnType<RetainedCharacterRepository["findActiveCampaignMembership"]>> =
    null;
  const now = "2026-08-29T10:00:00.000Z";

  function materialize(
    write: Parameters<RetainedCharacterRepository["createFinalized"]>[0]["revision"],
    priorEvents: CharacterRevisionRecord["events"] = [],
  ): CharacterRevisionRecord {
    return {
      ...write,
      createdAt: now,
      events: [...priorEvents, ...write.events.map((event) => ({ ...event, occurredAt: now }))],
      revisionState: "current",
    };
  }

  const repository: RetainedCharacterRepository = {
    async appendRevision({ expectedRevisionId, revision }) {
      const history = revisions.get(revision.characterId) ?? [];
      const current = history.at(-1) ?? null;
      const replay = history.find(
        (candidate) => candidate.commandIdempotencyKey === revision.commandIdempotencyKey,
      );
      if (replay) {
        if (replay.commandDigest !== revision.commandDigest) {
          throw new Error("retained_character_idempotency_conflict");
        }
        return { kind: "idempotent", revision: replay };
      }
      if (current?.id !== expectedRevisionId) {
        return { currentRevisionId: current?.id ?? null, kind: "stale" };
      }
      const committed = materialize(revision, current.events);
      for (const candidate of history) candidate.revisionState = "historical";
      history.push(committed);
      revisions.set(revision.characterId, history);
      const character = characters.get(revision.characterId)!;
      characters.set(revision.characterId, {
        ...character,
        retainedRevision: {
          characterId: revision.characterId,
          characterRevisionId: committed.id,
          characterRevisionSequence: committed.sequence,
          contentDigest: committed.versionEnvelope.contentRelease.digest,
          contentReleaseId: committed.versionEnvelope.contentRelease.id,
          readModelDigest: committed.effectiveSkills.calculationDigest,
          rulesVersion: committed.versionEnvelope.skillRules.id,
          snapshotContractVersion: "character-revision-snapshot/v1",
        },
      });
      return { kind: "committed", revision: committed };
    },
    async createFinalized({ build: characterBuild, ownerId, revision }) {
      const committed = materialize(revision);
      revisions.set(characterBuild.id, [committed]);
      characters.set(characterBuild.id, {
        build: characterBuild,
        createdAt: now,
        id: characterBuild.id,
        level: characterBuild.progression.level,
        name: characterBuild.name,
        ownerId,
        retainedRevision: {
          characterId: revision.characterId,
          characterRevisionId: committed.id,
          characterRevisionSequence: committed.sequence,
          contentDigest: committed.versionEnvelope.contentRelease.digest,
          contentReleaseId: committed.versionEnvelope.contentRelease.id,
          readModelDigest: committed.effectiveSkills.calculationDigest,
          rulesVersion: committed.versionEnvelope.skillRules.id,
          snapshotContractVersion: "character-revision-snapshot/v1",
        },
        updatedAt: now,
      });
      return committed;
    },
    async findActiveCampaignMembership() {
      return membership;
    },
    async findByCommand(characterId, commandIdempotencyKey) {
      return (
        revisions
          .get(characterId)
          ?.find((revision) => revision.commandIdempotencyKey === commandIdempotencyKey) ?? null
      );
    },
    async findCurrent(characterId) {
      return revisions.get(characterId)?.at(-1) ?? null;
    },
    async findRevision(characterId, revisionId) {
      return revisions.get(characterId)?.find((revision) => revision.id === revisionId) ?? null;
    },
  };
  const characterService = {
    getCharacterById: async (characterId: string) => characters.get(characterId) ?? null,
  } as CharacterService;

  return {
    revisionCount(characterId: string) {
      return revisions.get(characterId)?.length ?? 0;
    },
    service: new RetainedCharacterService(repository, characterService),
    setMembership(value: typeof membership) {
      membership = value;
    },
  };
}

describe("RetainedCharacterService", () => {
  it("finalizes, reloads, projects, and idempotently replays without a database", async () => {
    const { service } = inMemoryServices();
    const command = {
      build: build("memory-veteran"),
      configuration: { flexBudget: 26, formationBudget: 60, id: "memory-pilot" },
      idempotencyKey: "memory-finalize",
      pilotCharacterId: "character:pilot:glantrian-retainer-veteran",
    };
    const first = await service.finalizeHeadless({
      actor: { isAdmin: false, userId: "owner" },
      command,
    });

    await expect(
      service.finalizeHeadless({
        actor: { isAdmin: false, userId: "owner" },
        command,
      }),
    ).resolves.toEqual(first);
    await expect(service.getRevision(first.character.id, first.revision.id)).resolves.toEqual(
      first.revision,
    );
    await expect(
      service.getCurrentProjection({
        characterId: first.character.id,
        perspective: "owner",
      }),
    ).resolves.toMatchObject({
      characterRevisionId: first.revision.id,
      perspective: "owner",
      provenanceDetail: "owner_safe",
    });
    await expect(
      service.finalizeHeadless({
        actor: { isAdmin: false, userId: "owner" },
        command: {
          ...command,
          build: build("over-budget"),
          configuration: { ...command.configuration, flexBudget: 0, formationBudget: 0 },
          idempotencyKey: "over-budget-finalize",
        },
      }),
    ).rejects.toMatchObject({ code: "retained_character_invalid_command" });
  });

  it("advances history and enforces rostered migration authority and rollback lineage", async () => {
    const { service, setMembership } = inMemoryServices();
    const finalized = await service.finalizeHeadless({
      actor: { isAdmin: false, userId: "owner" },
      command: {
        build: build("memory-physician"),
        configuration: { flexBudget: 26, formationBudget: 60, id: "memory-pilot" },
        idempotencyKey: "memory-physician-finalize",
        pilotCharacterId: "character:pilot:mogrebi-temple-physician",
      },
    });
    setMembership({
      campaignId: "campaign-a",
      campaignStatus: "active",
      gmUserId: "gm",
      rosterEntryId: "roster-a",
    });
    const history = finalized.revision.state.histories[0]!;
    const advanced = await service.advanceLearningHistory({
      actor: { isAdmin: false, userId: "gm" },
      characterId: finalized.character.id,
      expectedRevisionId: finalized.revision.id,
      historyInstanceId: history.instanceId,
      idempotencyKey: "memory-history-advance",
      reason: "GM-approved study.",
      targetLevel: history.level + 1,
    });
    const contextual = await service.changeProfessionContext({
      actor: { isAdmin: false, userId: "owner" },
      characterId: finalized.character.id,
      expectedRevisionId: advanced.id,
      idempotencyKey: "memory-profession",
      professionId: "profession:physician-emeritus",
      reason: "Context only.",
    });
    expect(contextual.effectiveSkills.rows).toEqual(advanced.effectiveSkills.rows);

    const preview = await service.previewMigration({
      actor: { isAdmin: false, userId: "owner" },
      characterId: finalized.character.id,
      expectedRevisionId: contextual.id,
      migrationId: "migration:memory",
      targetEnvelope: createPilotCharacterVersionEnvelope({
        flexBudget: 26,
        formationBudget: 60,
        id: "memory-maintenance",
      }),
    });
    expect(preview.planId).toEqual(expect.any(String));
    await expect(
      service.applyMigration({
        actor: { isAdmin: false, userId: "owner" },
        characterId: finalized.character.id,
        idempotencyKey: "memory-owner-apply",
        preview,
      }),
    ).rejects.toMatchObject({ code: "retained_character_unauthorized" });
    await expect(
      service.applyMigration({
        actor: { isAdmin: false, userId: "gm" },
        characterId: finalized.character.id,
        idempotencyKey: "memory-forged-apply",
        preview: {
          ...preview,
          targetEnvelope: {
            ...preview.targetEnvelope,
            chargenConfiguration: {
              ...preview.targetEnvelope.chargenConfiguration,
              values: {
                ...preview.targetEnvelope.chargenConfiguration.values,
                flexBudget: 999,
              },
            },
          },
        },
      }),
    ).rejects.toMatchObject({ code: "retained_character_invalid_command" });
    const migrated = await service.applyMigration({
      actor: { isAdmin: false, userId: "gm" },
      characterId: finalized.character.id,
      idempotencyKey: "memory-gm-apply",
      preview,
    });
    const rolledBack = await service.rollbackMigration({
      actor: { isAdmin: false, userId: "gm" },
      characterId: finalized.character.id,
      expectedRevisionId: migrated.id,
      idempotencyKey: "memory-gm-rollback",
      migrationRevisionId: migrated.id,
    });
    expect(rolledBack).toMatchObject({
      migrationLineage: {
        rollbackOfRevisionId: migrated.id,
        sourceRevisionId: contextual.id,
        status: "rollback_applied",
      },
      parentRevisionId: migrated.id,
    });
  });

  it("authorizes every retained command before replay or stale-revision disclosure", async () => {
    const { service, setMembership } = inMemoryServices();
    const command = {
      build: build("memory-private"),
      configuration: { flexBudget: 26, formationBudget: 60, id: "memory-private-pilot" },
      idempotencyKey: "memory-private-finalize",
      pilotCharacterId: "character:pilot:iest-dockside-investigator",
    };
    const finalized = await service.finalizeHeadless({
      actor: { isAdmin: false, userId: "owner" },
      command,
    });
    await expect(
      service.finalizeHeadless({
        actor: { isAdmin: false, userId: "outsider" },
        command,
      }),
    ).rejects.toMatchObject({
      code: "retained_character_unauthorized",
      currentRevisionId: undefined,
    });

    const outsider = { isAdmin: false, userId: "outsider" };
    const history = finalized.revision.state.histories[0]!;
    await expect(
      service.advanceLearningHistory({
        actor: outsider,
        characterId: finalized.character.id,
        expectedRevisionId: "known-stale-revision",
        historyInstanceId: history.instanceId,
        idempotencyKey: "known-command-key",
        reason: "Probe",
        targetLevel: history.level + 1,
      }),
    ).rejects.toMatchObject({ code: "retained_character_unauthorized" });
    await expect(
      service.changeProfessionContext({
        actor: outsider,
        characterId: finalized.character.id,
        expectedRevisionId: "known-stale-revision",
        idempotencyKey: "known-command-key",
        professionId: "profession:probe",
        reason: "Probe",
      }),
    ).rejects.toMatchObject({ code: "retained_character_unauthorized" });
    await expect(
      service.previewMigration({
        actor: outsider,
        characterId: finalized.character.id,
        expectedRevisionId: "known-stale-revision",
        migrationId: "migration:probe",
        targetEnvelope: finalized.revision.versionEnvelope,
      }),
    ).rejects.toMatchObject({ code: "retained_character_unauthorized" });

    setMembership({
      campaignId: "campaign-private",
      campaignStatus: "active",
      gmUserId: "gm",
      rosterEntryId: "roster-private",
    });
    const preview = await service.previewMigration({
      actor: { isAdmin: false, userId: "owner" },
      characterId: finalized.character.id,
      expectedRevisionId: finalized.revision.id,
      migrationId: "migration:private",
      targetEnvelope: finalized.revision.versionEnvelope,
    });
    await expect(
      service.applyMigration({
        actor: outsider,
        characterId: finalized.character.id,
        idempotencyKey: "known-command-key",
        preview,
      }),
    ).rejects.toMatchObject({ code: "retained_character_unauthorized" });
    await expect(
      service.rollbackMigration({
        actor: outsider,
        characterId: finalized.character.id,
        expectedRevisionId: "known-stale-revision",
        idempotencyKey: "known-command-key",
        migrationRevisionId: "known-migration-revision",
      }),
    ).rejects.toMatchObject({ code: "retained_character_unauthorized" });
  });

  it("binds migration preview identity to the requested Character before mutation", async () => {
    const { revisionCount, service } = inMemoryServices();
    const actor = { isAdmin: false, userId: "owner" };
    const finalizedA = await service.finalizeHeadless({
      actor,
      command: {
        build: build("memory-migration-a"),
        configuration: { flexBudget: 26, formationBudget: 60, id: "memory-a" },
        idempotencyKey: "finalize-memory-a",
        pilotCharacterId: "character:pilot:mogrebi-temple-physician",
      },
    });
    const finalizedB = await service.finalizeHeadless({
      actor,
      command: {
        build: build("memory-migration-b"),
        configuration: { flexBudget: 26, formationBudget: 60, id: "memory-b" },
        idempotencyKey: "finalize-memory-b",
        pilotCharacterId: "character:pilot:mogrebi-temple-physician",
      },
    });
    const preview = await service.previewMigration({
      actor,
      characterId: finalizedA.character.id,
      expectedRevisionId: finalizedA.revision.id,
      migrationId: "migration:bound-a",
      targetEnvelope: createPilotCharacterVersionEnvelope({
        flexBudget: 26,
        formationBudget: 60,
        id: "memory-a-maintenance",
      }),
    });

    await expect(
      service.applyMigration({
        actor,
        characterId: finalizedB.character.id,
        idempotencyKey: "route-b",
        preview,
      }),
    ).rejects.toMatchObject({ code: "retained_character_invalid_command" });
    await expect(
      service.applyMigration({
        actor,
        characterId: finalizedA.character.id,
        idempotencyKey: "source-b",
        preview: withClientRecomputedDigest({
          ...preview,
          expectedRevisionId: finalizedB.revision.id,
        }),
      }),
    ).rejects.toMatchObject({ code: "retained_character_invalid_command" });
    await expect(
      service.applyMigration({
        actor,
        characterId: finalizedA.character.id,
        idempotencyKey: "tampered-plan",
        preview: withClientRecomputedDigest({
          ...preview,
          migrationId: "migration:tampered",
        }),
      }),
    ).rejects.toMatchObject({ code: "retained_character_invalid_command" });
    await expect(
      service.applyMigration({
        actor,
        characterId: finalizedA.character.id,
        idempotencyKey: "forged-plan-identity",
        preview: withClientRecomputedDigest({
          ...preview,
          planId: "client-forged-plan-id",
        }),
      }),
    ).rejects.toMatchObject({ code: "retained_character_invalid_command" });
    expect(revisionCount(finalizedA.character.id)).toBe(1);
    expect(revisionCount(finalizedB.character.id)).toBe(1);

    await expect(
      service.applyMigration({
        actor,
        characterId: finalizedA.character.id,
        idempotencyKey: "valid-bound-a",
        preview,
      }),
    ).resolves.toMatchObject({
      migrationLineage: { sourceRevisionId: finalizedA.revision.id },
    });
  });
});
