import { describe, expect, it } from "vitest";

import type { CharacterBuild } from "@glantri/domain";

import {
  applyEncounterWeaponArmorModifier,
  lookupEncounterArmorAtLocation,
  resolveEncounterHitLocation,
} from "./resolveEncounterDamage";

// ---------------------------------------------------------------------------
// Minimal helpers to construct the narrow slice of CharacterBuild that the
// encounter damage helpers actually read — only equipment.items is needed.
// ---------------------------------------------------------------------------

function makeBuild(
  items: CharacterBuild["equipment"]["items"],
): Pick<CharacterBuild, "equipment"> {
  return { equipment: { items } };
}

describe("resolveEncounterHitLocation", () => {
  it("returns the aimed location directly when a specific location is declared", () => {
    expect(
      resolveEncounterHitLocation({
        declaredTargetLocation: "head",
        hitLocationRoll: 50,
      }),
    ).toEqual({ aimedLocation: "head", resolvedLocation: "head" });

    expect(
      resolveEncounterHitLocation({
        declaredTargetLocation: "torso",
        hitLocationRoll: 5,
      }),
    ).toEqual({ aimedLocation: "torso", resolvedLocation: "torso" });
  });

  it("maps 'any' declarations to the correct body part based on the roll", () => {
    // roll 1–10 → head
    expect(
      resolveEncounterHitLocation({ declaredTargetLocation: "any", hitLocationRoll: 5 }),
    ).toMatchObject({ aimedLocation: "any", resolvedLocation: "head", roll: 5 });

    // roll 11–50 → torso
    expect(
      resolveEncounterHitLocation({ declaredTargetLocation: "any", hitLocationRoll: 11 }),
    ).toMatchObject({ resolvedLocation: "torso" });
    expect(
      resolveEncounterHitLocation({ declaredTargetLocation: "any", hitLocationRoll: 50 }),
    ).toMatchObject({ resolvedLocation: "torso" });

    // roll 51–75 → arm
    expect(
      resolveEncounterHitLocation({ declaredTargetLocation: "any", hitLocationRoll: 51 }),
    ).toMatchObject({ resolvedLocation: "arm" });
    expect(
      resolveEncounterHitLocation({ declaredTargetLocation: "any", hitLocationRoll: 75 }),
    ).toMatchObject({ resolvedLocation: "arm" });

    // roll 76–100 → leg
    expect(
      resolveEncounterHitLocation({ declaredTargetLocation: "any", hitLocationRoll: 76 }),
    ).toMatchObject({ resolvedLocation: "leg" });
    expect(
      resolveEncounterHitLocation({ declaredTargetLocation: "any", hitLocationRoll: 100 }),
    ).toMatchObject({ resolvedLocation: "leg" });
  });

  it("clamps out-of-range rolls to 1–100 before mapping", () => {
    // 0 → clamped to 1 → head
    expect(
      resolveEncounterHitLocation({ declaredTargetLocation: "any", hitLocationRoll: 0 }),
    ).toMatchObject({ resolvedLocation: "head", roll: 1 });

    // 200 → clamped to 100 → leg
    expect(
      resolveEncounterHitLocation({ declaredTargetLocation: "any", hitLocationRoll: 200 }),
    ).toMatchObject({ resolvedLocation: "leg", roll: 100 });
  });

  it("does not include a roll field when a specific location is declared", () => {
    const result = resolveEncounterHitLocation({
      declaredTargetLocation: "arm",
      hitLocationRoll: 60,
    });

    expect(result).not.toHaveProperty("roll");
  });
});

describe("lookupEncounterArmorAtLocation", () => {
  it("returns armorValue 0 with no label when no build is provided", () => {
    expect(
      lookupEncounterArmorAtLocation({ resolvedLocation: "torso" }),
    ).toEqual({ armorValue: 0 });
  });

  it("returns armorValue 0 when the build has no equipped armor items", () => {
    const build = makeBuild([
      {
        id: "w1",
        equipped: true,
        itemType: "weapon",
        name: "Longsword",
        armorValue: 0,
        shieldBonus: 0,
        weaponBonus: 3,
        slot: "main-hand",
      },
    ]);

    expect(
      lookupEncounterArmorAtLocation({ build: build as CharacterBuild, resolvedLocation: "torso" }),
    ).toEqual({ armorValue: 0 });
  });

  it("returns armorValue 0 when armor items exist but are not equipped", () => {
    const build = makeBuild([
      {
        id: "a1",
        equipped: false,
        itemType: "armor",
        name: "Mail Hauberk",
        armorLabel: "Mail",
        armorValue: 4,
        shieldBonus: 0,
        weaponBonus: 0,
        slot: "pack",
      },
    ]);

    expect(
      lookupEncounterArmorAtLocation({ build: build as CharacterBuild, resolvedLocation: "torso" }),
    ).toEqual({ armorValue: 0 });
  });

  it("sums armorValue across all equipped armor items and includes a label", () => {
    const build = makeBuild([
      {
        id: "a1",
        equipped: true,
        itemType: "armor",
        name: "Mail Hauberk",
        armorLabel: "Mail",
        armorValue: 4,
        shieldBonus: 0,
        weaponBonus: 0,
        slot: "body",
      },
      {
        id: "a2",
        equipped: true,
        itemType: "armor",
        name: "Leather Pauldrons",
        armorLabel: "Leather",
        armorValue: 1,
        shieldBonus: 0,
        weaponBonus: 0,
        slot: "body",
      },
    ]);

    const result = lookupEncounterArmorAtLocation({
      build: build as CharacterBuild,
      resolvedLocation: "torso",
    });

    expect(result.armorValue).toBe(5);
    expect(result.armorLabel).toContain("Mail");
    expect(result.armorLabel).toContain("Leather");
  });

  it("uses item name as label fallback when armorLabel is absent", () => {
    const build = makeBuild([
      {
        id: "a1",
        equipped: true,
        itemType: "armor",
        name: "Leather Jerkin",
        armorValue: 2,
        shieldBonus: 0,
        weaponBonus: 0,
        slot: "body",
      },
    ]);

    const result = lookupEncounterArmorAtLocation({
      build: build as CharacterBuild,
      resolvedLocation: "torso",
    });

    expect(result.armorValue).toBe(2);
    expect(result.armorLabel).toContain("Leather Jerkin");
  });
});

describe("applyEncounterWeaponArmorModifier", () => {
  it("returns weapon bonus minus armor value", () => {
    expect(applyEncounterWeaponArmorModifier({ armorValue: 2, weaponBonus: 5 })).toBe(3);
    expect(applyEncounterWeaponArmorModifier({ armorValue: 0, weaponBonus: 3 })).toBe(3);
  });

  it("returns a negative result when armor exceeds weapon bonus", () => {
    expect(applyEncounterWeaponArmorModifier({ armorValue: 5, weaponBonus: 3 })).toBe(-2);
  });

  it("returns 0 when both values are 0", () => {
    expect(applyEncounterWeaponArmorModifier({ armorValue: 0, weaponBonus: 0 })).toBe(0);
  });

  it("returns the full weapon bonus when armor is 0 (unarmored defender)", () => {
    expect(applyEncounterWeaponArmorModifier({ armorValue: 0, weaponBonus: 4 })).toBe(4);
  });
});
