import { describe, expect, it } from "vitest";

import {
  buildCampaignBlackboardHref,
  buildFocusedBlackboardHref,
  readBlackboardInspectionRoute,
} from "./blackboardInspectionRoute";

describe("Blackboard inspection routes", () => {
  it("preserves safe Blackboard identity and search context across the inspection stack", () => {
    const state = {
      category: "image_map" as const,
      entryId: "entry/map 1",
      pinned: "unpinned" as const,
      query: "western pass",
    };

    expect(buildFocusedBlackboardHref("campaign 1", state, true)).toBe(
      "/campaigns/campaign%201/blackboard?entryId=entry%2Fmap+1&blackboardQuery=western+pass&blackboardCategory=image_map&blackboardPinned=unpinned&inspection=artifact",
    );
    expect(buildCampaignBlackboardHref("campaign 1", state)).toBe(
      "/campaigns/campaign%201?tab=blackboard&entryId=entry%2Fmap+1&blackboardQuery=western+pass&blackboardCategory=image_map&blackboardPinned=unpinned",
    );
  });

  it("drops malformed filters and never creates Artifact inspection without an entry", () => {
    const params = new URLSearchParams({
      blackboardCategory: "private_notes",
      blackboardPinned: "all",
      blackboardQuery: "  bell  ",
    });
    const state = readBlackboardInspectionRoute(params);

    expect(state).toEqual({
      category: undefined,
      entryId: undefined,
      pinned: undefined,
      query: "bell",
    });
    expect(buildFocusedBlackboardHref("campaign-1", state, true)).toBe(
      "/campaigns/campaign-1/blackboard?blackboardQuery=bell",
    );
  });
});
