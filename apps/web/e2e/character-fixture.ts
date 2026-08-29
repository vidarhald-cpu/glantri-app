import type { APIRequestContext } from "@playwright/test";

export function characterPayload(id: string, name: string) {
  return {
    build: {
      equipment: { items: [] },
      currentStatModifiers: {},
      developedStatModifiers: { str: 1 },
      id,
      name,
      profile: {
        description: "",
        distractionLevel: 3,
        id: `profile-${id}`,
        label: "Profile",
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
          str: 12,
          will: 10,
        },
        resolvedStats: {
          cha: 10,
          com: 10,
          con: 10,
          dex: 10,
          health: 10,
          int: 10,
          lck: 10,
          pow: 10,
          siz: 10,
          str: 13,
          will: 10,
        },
        societyLevel: 0,
        statLayerVersion: 1,
      },
      progression: {
        chargenMode: "standard",
        educationPoints: 0,
        flexiblePointFactor: 1,
        level: 1,
        primaryPoolSpent: 0,
        primaryPoolTotal: 60,
        secondaryPoolSpent: 0,
        secondaryPoolTotal: 0,
        skillGroups: [],
        skills: [],
        specializations: [],
      },
      progressionState: { availablePoints: 0, checks: [], history: [], pendingAttempts: [] },
    },
  };
}

export async function createCharacterForE2e(input: {
  apiUrl: string;
  id: string;
  name: string;
  request: APIRequestContext;
}): Promise<void> {
  const response = await input.request.post(`${input.apiUrl}/characters`, {
    data: characterPayload(input.id, input.name),
  });
  if (!response.ok()) {
    throw new Error(`Unable to create E2E Character ${input.id}: ${await response.text()}`);
  }
}
