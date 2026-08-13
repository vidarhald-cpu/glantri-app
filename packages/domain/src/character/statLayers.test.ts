import { describe, expect, it } from "vitest";

import type { CharacterBuild } from "./build";
import { deriveCharacterStatLayers } from "./statLayers";

function createBuild(): CharacterBuild {
  const rolledStats = {
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
  };

  return {
    equipment: { items: [] },
    id: "character-1",
    name: "Golden Character",
    profile: {
      distractionLevel: 2,
      id: "profile-1",
      label: "Golden profile",
      resolvedStats: { ...rolledStats, str: 13 },
      rolledStats,
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
    progressionState: {
      availablePoints: 0,
      checks: [],
      history: [],
      pendingAttempts: [],
    },
  };
}

describe("deriveCharacterStatLayers", () => {
  it("keeps rolled 12, chargen-adjusted Original 13, and permanent Developed/Current 14 distinct", () => {
    const build = {
      ...createBuild(),
      developedStatModifiers: { str: 1 },
    };

    const layers = deriveCharacterStatLayers(build);

    expect(layers.rolledOrBase?.str).toBe(12);
    expect(layers.original.str).toBe(13);
    expect(layers.developed.str).toBe(14);
    expect(layers.current.str).toBe(14);
  });

  it("combines persisted and read-time Current changes without making them permanent", () => {
    const build = {
      ...createBuild(),
      currentStatModifiers: { str: -2 },
      developedStatModifiers: { str: 1 },
    };

    const layers = deriveCharacterStatLayers(build, { str: 3 });

    expect(layers.original.str).toBe(13);
    expect(layers.developed.str).toBe(14);
    expect(layers.current.str).toBe(15);
  });

  it("recovers Current to Developed when temporary changes are removed and keeps one-roll modifiers separate", () => {
    const build = {
      ...createBuild(),
      developedStatModifiers: { str: 1 },
    };
    const tacticalOneRollModifier = 3;
    const layers = deriveCharacterStatLayers(build);

    expect(layers.current.str).toBe(14);
    expect(layers.current.str + tacticalOneRollModifier).toBe(17);
    expect(deriveCharacterStatLayers(build).current.str).toBe(14);
  });

  it("preserves legacy Current adjustments but does not guess ambiguous rolled/base provenance", () => {
    const build = createBuild();
    delete build.profile.statLayerVersion;
    build.statModifiers = { str: 2 };

    const layers = deriveCharacterStatLayers(build);

    expect(layers.compatibility).toBe("legacy-unknown-base");
    expect(layers.rolledOrBase).toBeUndefined();
    expect(layers.original.str).toBe(13);
    expect(layers.current.str).toBe(15);
  });
});
