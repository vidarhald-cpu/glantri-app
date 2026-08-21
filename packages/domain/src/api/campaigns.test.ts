import { describe, expect, it } from "vitest";

import { campaignCharacterRosterCandidateSchema } from "./campaigns";

describe("Campaign Character roster candidate projection", () => {
  it("accepts only the approved privacy-safe candidate fields", () => {
    const candidate = {
      alreadyRostered: true,
      id: "character-1",
      name: "Ari",
      ownerLabel: "Player One",
    };

    expect(campaignCharacterRosterCandidateSchema.parse(candidate)).toEqual(candidate);
    expect(() =>
      campaignCharacterRosterCandidateSchema.parse({
        ...candidate,
        build: { progression: { level: 1 } },
        email: "player@example.test",
        ownerId: "player-1",
        updatedAt: "2026-08-21T00:00:00.000Z",
      }),
    ).toThrow();
  });
});
