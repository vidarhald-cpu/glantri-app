import { describe, expect, it } from "vitest";

import type { CharacterRevisionRecord } from "@glantri/domain";

import {
  calculateRetainedCharacterSkills,
  createRetainedCharacterStateFromPilotRelease,
  projectRetainedCharacterRevision,
  validateRetainedCharacterHeadlessChargen,
} from "./retainedCharacterSkillReadModel";

describe("retained Character Pilot v1 composition", () => {
  it.each([
    ["character:pilot:glantrian-retainer-veteran", "skill:sword", 6, 49],
    ["character:pilot:mogrebi-temple-physician", "skill:medicine", 6, 40],
    ["character:pilot:nkolian-caravan-scout", "skill:wayfinding", 6, 54],
  ])("reconstructs %s from the canonical release", (pilotCharacterId, skillId, level, cost) => {
    const state = createRetainedCharacterStateFromPilotRelease({
      characterId: `saved:${pilotCharacterId}`,
      pilotCharacterId,
    });
    const calculated = calculateRetainedCharacterSkills(state);

    expect(calculated.rows.find((row) => row.competencyId === skillId)?.effectiveLevel).toBe(level);
    expect(calculated.pilotResult.totalCost).toBe(cost);
    expect(
      validateRetainedCharacterHeadlessChargen({
        flexBudget: 26,
        formationBudget: 60,
        state,
      }),
    ).toMatchObject({ totalCost: cost });
  });

  it("keeps every overlapping history and identifies the suppressed contribution", () => {
    const state = createRetainedCharacterStateFromPilotRelease({
      characterId: "hybrid",
      pilotCharacterId: "character:pilot:nkolian-caravan-scout",
    });
    const row = calculateRetainedCharacterSkills(state).rows.find(
      (candidate) => candidate.competencyId === "skill:wayfinding",
    )!;

    expect(row.groupCandidates).toHaveLength(2);
    expect(row.strongestHistoryContribution).toBe(3);
    expect(row.suppressedOverlaps).toHaveLength(1);
    expect(row.suppressedOverlaps[0]).toMatchObject({
      level: 2,
      selectedAsStrongest: false,
      usefulIncrementalCompetence: 0,
    });
  });

  it("stacks direct acquisition on the strongest history and preserves non-recursive floors", () => {
    const veteran = createRetainedCharacterStateFromPilotRelease({
      characterId: "veteran",
      pilotCharacterId: "character:pilot:glantrian-retainer-veteran",
    });
    const rows = calculateRetainedCharacterSkills(veteran).rows;
    expect(rows.find((row) => row.competencyId === "skill:sword")).toMatchObject({
      acquiredBase: 6,
      directAcquisition: 2,
      effectiveLevel: 6,
      strongestHistoryContribution: 4,
    });
    expect(rows.find((row) => row.competencyId === "skill:knife-dagger")).toMatchObject({
      acquiredBase: 0,
      effectiveLevel: 3,
      relationshipDerivedContribution: 3,
    });
  });

  it("does not create Specialization ownership from a relationship candidate", () => {
    const physician = createRetainedCharacterStateFromPilotRelease({
      characterId: "physician",
      pilotCharacterId: "character:pilot:mogrebi-temple-physician",
    });
    physician.specializationAcquisitions = [];
    const row = calculateRetainedCharacterSkills(physician).rows.find(
      (candidate) => candidate.competencyId === "spec:diagnostic-medicine",
    )!;

    expect(row.relationshipCandidates[0]?.candidateCompetence).toBe(3);
    expect(row.specialization).toMatchObject({ acquiredRanks: 0, owned: false });
    expect(row.effectiveLevel).toBe(0);
  });

  it("keeps Profession changes mechanically inert", () => {
    const state = createRetainedCharacterStateFromPilotRelease({
      characterId: "physician",
      pilotCharacterId: "character:pilot:mogrebi-temple-physician",
    });
    const before = calculateRetainedCharacterSkills(state).rows;
    const after = calculateRetainedCharacterSkills({
      ...state,
      professionId: "profession:context-only-change",
    }).rows;
    expect(after).toEqual(before);
  });

  it("removes protected provenance and hidden source counts from player-safe projections", () => {
    const state = createRetainedCharacterStateFromPilotRelease({
      characterId: "investigator",
      pilotCharacterId: "character:pilot:iest-dockside-investigator",
    });
    const { rows } = calculateRetainedCharacterSkills(state);
    const revision = {
      characterId: "investigator",
      effectiveSkills: { characterId: "investigator", rows },
      events: [
        {
          protectedProvenance: { contact: "Copper Latch" },
          sourceLabel: "Night-Entry Crew",
          visibility: "owner_and_gm",
        },
      ],
      id: "revision-1",
      migrationLineage: { status: "current" },
      revisionState: "current",
    } as unknown as CharacterRevisionRecord;

    const owner = projectRetainedCharacterRevision(revision, "owner")!;
    const gm = projectRetainedCharacterRevision(revision, "current_campaign_gm")!;
    const admin = projectRetainedCharacterRevision(revision, "admin")!;
    const player = projectRetainedCharacterRevision(revision, "entitled_player")!;
    expect(owner.events?.[0]?.protectedProvenance).toBeUndefined();
    expect(JSON.stringify(owner)).not.toMatch(/Copper Latch|Night-Entry Crew/);
    expect(owner.events?.[0]).toMatchObject({
      publicExplanation: "Acquisition retained from a protected source.",
      sourceId: "protected-source",
      sourceKind: "protected",
      sourceLabel: "Protected source",
    });
    expect(gm.events?.[0]?.protectedProvenance).toEqual({ contact: "Copper Latch" });
    expect(admin.events?.[0]?.protectedProvenance).toEqual({ contact: "Copper Latch" });
    expect(player.events).toBeUndefined();
    expect(JSON.stringify(player)).not.toMatch(
      /Copper Latch|Night-Entry Crew|groupCandidates":\[\{/,
    );
    expect(projectRetainedCharacterRevision(revision, "uninvolved_player")).toBeNull();
  });
});
