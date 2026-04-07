import { characterBuildSchema } from "@glantri/domain";
import { validateCharacterBuild } from "@glantri/rules-engine";

import {
  createPrismaCharacterRepository,
  type CharacterRecord,
  type CreateCharacterRecordInput
} from "../repositories/characterRepository";

export class CharacterValidationError extends Error {
  constructor(public readonly issues: string[]) {
    super("Character build validation failed.");
  }
}

export class CharacterService {
  constructor(private readonly repository = createPrismaCharacterRepository()) {}

  async saveCharacter(input: CreateCharacterRecordInput): Promise<CharacterRecord> {
    const build = characterBuildSchema.parse(input.build);
    const validation = validateCharacterBuild({
      build
    });

    if (!validation.valid) {
      throw new CharacterValidationError(
        validation.issues.map((issue: { message: string }) => issue.message)
      );
    }

    return this.repository.saveOwned({
      ...input,
      build,
      id: build.id,
      level: build.progression.level,
      name: build.name
    });
  }

  async listCharacters(ownerId: string): Promise<CharacterRecord[]> {
    return this.repository.listByOwner(ownerId);
  }

  async getOwnedCharacter(ownerId: string, characterId: string): Promise<CharacterRecord | null> {
    return this.repository.findOwnedById(ownerId, characterId);
  }
}
