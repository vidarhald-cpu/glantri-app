import type { RolledCharacterProfile } from "@glantri/domain";

export interface SelectProfileInput {
  profileId: string;
  profiles: RolledCharacterProfile[];
}

export function selectProfile(input: SelectProfileInput): RolledCharacterProfile | undefined {
  return input.profiles.find((profile) => profile.id === input.profileId);
}
