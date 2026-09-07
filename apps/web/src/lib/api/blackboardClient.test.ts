import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createBlackboardEntry,
  loadBlackboard,
  loadBlackboardCapabilities,
  loadBlackboardArtifactCandidates,
  moveBlackboardEntry,
  retractBlackboardEntry,
  searchBlackboard,
} from "./blackboardClient";

const fetchMock = vi.fn();

describe("blackboardClient", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("loads only the Campaign Blackboard and safe Artifact candidates", async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ catalogue: [], layout: { placements: [], version: 0 }, tombstones: [] }),
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            entries: [{ canCorrect: true, canRemove: true, entryId: "entry-1" }],
          }),
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            artifacts: [
              {
                altText: "A route through the hills",
                artifactKind: "map",
                id: "artifact-1",
                mediaType: "image/png",
                title: "Hill map",
              },
            ],
          }),
        ),
      );

    await expect(loadBlackboard("campaign-1")).resolves.toMatchObject({ catalogue: [] });
    await expect(loadBlackboardCapabilities("campaign-1")).resolves.toEqual({
      entries: [{ canCorrect: true, canRemove: true, entryId: "entry-1" }],
    });
    await expect(loadBlackboardArtifactCandidates("campaign-1")).resolves.toHaveLength(1);
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "http://localhost:4000/campaigns/campaign-1/blackboard",
      "http://localhost:4000/campaigns/campaign-1/blackboard/capabilities",
      "http://localhost:4000/campaigns/campaign-1/artifacts/blackboard-candidates",
    ]);
  });

  it("uses the Blackboard mutation guard and exact optimistic versions", async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            entry: {
              category: "clue_fact",
              entryVersion: 1,
              fact: "The bell rings twice.",
              id: "entry-1",
              state: "Current",
              title: "Bell signal",
              updatedAt: "2026-08-28T10:00:00.000Z",
              updatedByLabel: "Player",
            },
          }),
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            entry: {
              id: "entry-1",
              removedAt: "2026-08-28T10:01:00.000Z",
              removedByLabel: "Player",
              state: "Removed",
            },
          }),
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ catalogue: [], layout: { placements: [], version: 4 }, tombstones: [] }),
        ),
      );

    await createBlackboardEntry({
      campaignId: "campaign-1",
      content: { category: "clue_fact", fact: "The bell rings twice.", title: "Bell signal" },
    });
    await retractBlackboardEntry({
      campaignId: "campaign-1",
      entryId: "entry-1",
      expectedEntryVersion: 1,
    });
    await moveBlackboardEntry({
      campaignId: "campaign-1",
      expectedLayoutVersion: 3,
      placement: {
        entryId: "entry-1",
        height: 180,
        layer: 1,
        rowVersion: 2,
        updatedAt: "2026-08-28T10:00:00.000Z",
        updatedByLabel: "Player",
        width: 260,
        x: 0,
        y: 0,
      },
      x: 280,
      y: 0,
    });

    for (const [, init] of fetchMock.mock.calls) {
      expect(new Headers(init.headers).get("x-glantri-blackboard-mutation")).toBe("1");
      expect(init.credentials).toBe("include");
    }
    expect(JSON.parse(fetchMock.mock.calls[1]?.[1].body)).toEqual({ expectedEntryVersion: 1 });
    expect(JSON.parse(fetchMock.mock.calls[2]?.[1].body)).toMatchObject({
      expectedLayoutVersion: 3,
      expectedRowVersion: 2,
      x: 280,
    });
  });

  it("encodes server-side search and filter parameters", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          results: [
            { category: "image_map", entryId: "entry-1", pinned: true, title: "Hill route" },
          ],
        }),
      ),
    );

    await expect(
      searchBlackboard("campaign-1", {
        category: "image_map",
        pinned: "pinned",
        q: "hill route",
      }),
    ).resolves.toMatchObject({ results: [{ entryId: "entry-1" }] });
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "http://localhost:4000/campaigns/campaign-1/blackboard/search?q=hill+route&category=image_map&pinned=pinned",
    );
  });
});
