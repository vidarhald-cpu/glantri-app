import { CharacterRecoveryRepository } from "../offline/repositories/characterRecoveryRepository";

const characterRecoveryRepository = new CharacterRecoveryRepository();

export async function purgeCharacterRecoveryOnLogout(accountId: string): Promise<void> {
  await characterRecoveryRepository.purgeForAccount(accountId);
}
