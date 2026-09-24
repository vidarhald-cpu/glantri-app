import { getApprovedTargetDefinitions, getApprovedV2RuntimeContent } from "@glantri/content";
import { isDeepStrictEqual } from "node:util";

import { characterBuildSchema } from "@glantri/domain";
import { validateCharacterBuild, validateTargetChargenBuild } from "@glantri/rules-engine";

import {
  createPrismaCharacterRepository,
  type CharacterRecord,
  type CharacterRepository,
  type CreateCharacterRecordInput,
} from "../repositories/characterRepository";

export class CharacterValidationError extends Error {
  constructor(public readonly issues: string[]) {
    super("Character build validation failed.");
  }
}

export class CharacterMutationConflictError extends Error {
  constructor(
    public readonly code: "character_already_exists" | "stale_character",
    message: string,
    public readonly currentCharacter?: CharacterRecord,
  ) {
    super(message);
    this.name = "CharacterMutationConflictError";
  }
}

/** `CharacterBuild.equipment` remains readable history, never current equipment authority. */
export class LegacyCharacterEquipmentWriteError extends Error {
  constructor() {
    super(
      "CharacterBuild.equipment is legacy history and cannot be used to change current equipment.",
    );
    this.name = "LegacyCharacterEquipmentWriteError";
  }
}

function assertNoLegacyEquipmentWrite(
  build: ReturnType<typeof characterBuildSchema.parse>,
  existingBuild?: ReturnType<typeof characterBuildSchema.parse>,
): void {
  if (existingBuild) {
    if (!isDeepStrictEqual(build.equipment, existingBuild.equipment)) {
      throw new LegacyCharacterEquipmentWriteError();
    }
    return;
  }
  if (build.equipment.items.length > 0) throw new LegacyCharacterEquipmentWriteError();
}

function sortNewestFirst(characters: CharacterRecord[]): CharacterRecord[] {
  return [...characters].sort(
    (left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt),
  );
}

function isIdempotentFinalization(
  character: CharacterRecord,
  build: CreateCharacterRecordInput["build"],
  ownerId?: string | null,
): boolean {
  return character.ownerId === (ownerId ?? null) && isDeepStrictEqual(character.build, build);
}

export class CharacterService {
  constructor(
    private readonly repository: CharacterRepository = createPrismaCharacterRepository(),
  ) {}

  async saveCharacter(input: CreateCharacterRecordInput): Promise<CharacterRecord> {
    const build = characterBuildSchema.parse(input.build);
    assertNoLegacyEquipmentWrite(build);
    const targetErrors = validateTargetChargenBuild(build, getApprovedV2RuntimeContent());
    if (targetErrors.length) throw new CharacterValidationError(targetErrors);
    if (build.professionId?.startsWith("profession:")) {
      const trusted = getApprovedV2RuntimeContent();
      const profession = trusted.professions.find((p) => p.id === build.professionId)!;
      for (const group of build.progression.skillGroups)
        group.targetDefinition = structuredClone(
          trusted.skillGroups.find((g) => g.id === group.groupId)!,
        );
      build.targetChargen = {
        familyId: profession.familyId,
        trackId: profession.id === profession.familyId ? undefined : profession.id,
        professionName: profession.name,
        sourceDigest: trusted.chargenCatalogue!.professionSourceDigest!,
        groupSourceDigest: trusted.chargenCatalogue!.groupSourceDigest!,
      };
    }
    const trustedTargets = getApprovedTargetDefinitions();
    const validation = validateCharacterBuild({
      availableSkills: trustedTargets.skills,
      availableSpecializations: trustedTargets.specializations,
      build,
    });

    if (!validation.valid) {
      throw new CharacterValidationError(
        validation.issues.map((issue: { message: string }) => issue.message),
      );
    }

    const existingCharacter = await this.repository.findById(build.id);

    if (existingCharacter) {
      if (isIdempotentFinalization(existingCharacter, build, input.ownerId)) {
        return existingCharacter;
      }

      throw new CharacterMutationConflictError(
        "character_already_exists",
        "A finalized character already exists with this id. Reload the server character before continuing.",
      );
    }

    try {
      return await this.repository.createOwned({
        ...input,
        build,
        id: build.id,
        level: build.progression.level,
        name: build.name,
      });
    } catch (error) {
      const concurrentCharacter = await this.repository.findById(build.id);

      if (concurrentCharacter) {
        if (isIdempotentFinalization(concurrentCharacter, build, input.ownerId)) {
          return concurrentCharacter;
        }

        throw new CharacterMutationConflictError(
          "character_already_exists",
          "A finalized character already exists with this id. Reload the server character before continuing.",
        );
      }

      throw error;
    }
  }

  async listCharacters(ownerId?: string): Promise<CharacterRecord[]> {
    return ownerId ? this.repository.listByOwner(ownerId) : this.repository.listAll();
  }

  async listAccessibleCharacters(input: {
    isAdmin: boolean;
    isGameMaster: boolean;
    userId: string;
  }): Promise<CharacterRecord[]> {
    if (input.isAdmin) {
      return this.repository.listAll();
    }

    const ownedCharacters = await this.repository.listByOwner(input.userId);

    if (!input.isGameMaster) {
      return ownedCharacters;
    }

    const campaignCharacters = await this.repository.listInGmCampaigns(input.userId);
    const accessibleById = new Map(
      [...ownedCharacters, ...campaignCharacters].map((character) => [character.id, character]),
    );

    return sortNewestFirst([...accessibleById.values()]);
  }

  async getCharacterById(characterId: string): Promise<CharacterRecord | null> {
    return this.repository.findById(characterId);
  }

  async getCharacterByIdInGmCampaigns(
    gmUserId: string,
    characterId: string,
  ): Promise<CharacterRecord | null> {
    return this.repository.findInGmCampaigns(gmUserId, characterId);
  }

  async getOwnedCharacter(ownerId: string, characterId: string): Promise<CharacterRecord | null> {
    return this.repository.findOwnedById(ownerId, characterId);
  }

  async saveExistingCharacter(input: {
    build: CreateCharacterRecordInput["build"];
    characterId: string;
    expectedUpdatedAt: string;
  }): Promise<CharacterRecord | null> {
    const existingCharacter = await this.repository.findById(input.characterId);

    if (!existingCharacter) {
      return null;
    }

    const build = characterBuildSchema.parse(input.build);
    assertNoLegacyEquipmentWrite(build, characterBuildSchema.parse(existingCharacter.build));
    const targetErrors = validateTargetChargenBuild(build, getApprovedV2RuntimeContent());
    if (targetErrors.length) throw new CharacterValidationError(targetErrors);
    if (build.professionId?.startsWith("profession:")) {
      const trusted = getApprovedV2RuntimeContent();
      const profession = trusted.professions.find((p) => p.id === build.professionId)!;
      for (const group of build.progression.skillGroups)
        group.targetDefinition = structuredClone(
          trusted.skillGroups.find((g) => g.id === group.groupId)!,
        );
      build.targetChargen = {
        familyId: profession.familyId,
        trackId: profession.id === profession.familyId ? undefined : profession.id,
        professionName: profession.name,
        sourceDigest: trusted.chargenCatalogue!.professionSourceDigest!,
        groupSourceDigest: trusted.chargenCatalogue!.groupSourceDigest!,
      };
    }
    const trustedTargets = getApprovedTargetDefinitions();
    const validation = validateCharacterBuild({
      availableSkills: trustedTargets.skills,
      availableSpecializations: trustedTargets.specializations,
      build,
    });

    if (!validation.valid) {
      throw new CharacterValidationError(
        validation.issues.map((issue: { message: string }) => issue.message),
      );
    }

    if (existingCharacter.updatedAt !== input.expectedUpdatedAt) {
      throw new CharacterMutationConflictError(
        "stale_character",
        "The character changed on the server. Reload it before saving this draft.",
        existingCharacter,
      );
    }

    const savedCharacter = await this.repository.updateVersioned({
      build,
      expectedUpdatedAt: input.expectedUpdatedAt,
      id: input.characterId,
      level: build.progression.level,
      name: build.name,
      ownerId: existingCharacter.ownerId ?? null,
    });

    if (savedCharacter) {
      return savedCharacter;
    }

    throw new CharacterMutationConflictError(
      "stale_character",
      "The character changed on the server. Reload it before saving this draft.",
      (await this.repository.findById(input.characterId)) ?? undefined,
    );
  }

  async deleteExistingCharacter(input: {
    characterId: string;
    expectedUpdatedAt: string;
  }): Promise<CharacterRecord | null> {
    const existingCharacter = await this.repository.findById(input.characterId);

    if (!existingCharacter) {
      return null;
    }

    if (existingCharacter.updatedAt !== input.expectedUpdatedAt) {
      throw new CharacterMutationConflictError(
        "stale_character",
        "The character changed on the server. Reload it before deleting it.",
        existingCharacter,
      );
    }

    if (await this.repository.deleteVersioned(input.characterId, input.expectedUpdatedAt)) {
      return existingCharacter;
    }

    throw new CharacterMutationConflictError(
      "stale_character",
      "The character changed on the server. Reload it before deleting it.",
      (await this.repository.findById(input.characterId)) ?? undefined,
    );
  }
}
