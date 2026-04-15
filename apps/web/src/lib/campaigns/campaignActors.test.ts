import { describe, expect, it } from "vitest";

import type { ReusableEntity } from "@glantri/domain";

import { getCampaignActorMetadata, splitCampaignActors } from "./campaignActors";

function createEntity(input: Partial<ReusableEntity> & Pick<ReusableEntity, "id" | "name">): ReusableEntity {
  return {
    createdAt: input.createdAt ?? "2026-04-15T10:00:00.000Z",
    description: input.description,
    gmUserId: input.gmUserId ?? "gm-1",
    id: input.id,
    kind: input.kind ?? "npc",
    name: input.name,
    notes: input.notes,
    snapshot: input.snapshot,
    updatedAt: input.updatedAt ?? "2026-04-15T10:00:00.000Z"
  };
}

describe("campaignActors", () => {
  it("defaults legacy reusable entities to templates", () => {
    const metadata = getCampaignActorMetadata(
      createEntity({
        id: "legacy-1",
        name: "City Guard"
      })
    );

    expect(metadata.actorClass).toBe("template");
  });

  it("splits templates and campaign npcs using snapshot metadata", () => {
    const result = splitCampaignActors([
      createEntity({
        id: "template-1",
        name: "Merchant Clerk",
        snapshot: {
          actorClass: "template",
          roleLabel: "Shop staff"
        }
      }),
      createEntity({
        id: "npc-1",
        name: "Captain Harl",
        snapshot: {
          actorClass: "campaign_npc",
          allegiance: "Harbor watch"
        }
      })
    ]);

    expect(result.templates.map((entity) => entity.id)).toEqual(["template-1"]);
    expect(result.campaignNpcs.map((entity) => entity.id)).toEqual(["npc-1"]);
  });

  it("filters campaign npcs to the active campaign when campaign id is provided", () => {
    const result = splitCampaignActors(
      [
        createEntity({
          id: "npc-a",
          name: "Captain Harl",
          snapshot: {
            actorClass: "campaign_npc",
            campaignId: "campaign-a"
          }
        }),
        createEntity({
          id: "npc-b",
          name: "Steward Brenna",
          snapshot: {
            actorClass: "campaign_npc",
            campaignId: "campaign-b"
          }
        })
      ],
      "campaign-a"
    );

    expect(result.campaignNpcs.map((entity) => entity.id)).toEqual(["npc-a"]);
  });
});
