import { describe, expect, it } from "vitest";

import { WeaponTemplateSchema } from "./schemas";
import {
  deriveWeaponDisarmControlRating,
  resolvePreferredAttackMode,
  resolveWeaponDisarmMismatch,
  resolveWeaponDisarmProfile,
} from "./weapon";
import type { WeaponTemplate } from "./types";

function weapon(attackModes: WeaponTemplate["attackModes"]): WeaponTemplate {
  return WeaponTemplateSchema.parse({
    attackModes,
    baseEncumbrance: 1,
    category: "weapon",
    defaultMaterial: "steel",
    handlingClass: "one_handed",
    id: "weapon-test",
    name: "Test weapon",
    specificityTypeDefault: "specific",
    tags: [],
    weaponClass: "sword",
    weaponSkill: "Sword",
  });
}

describe("resolvePreferredAttackMode", () => {
  const testWeapon = weapon([
    {
      canonicalMeleeMode: "strike",
      id: "strike",
      isPrimaryAttack: true,
      label: "Strike",
      order: 2,
      provenance: "manual",
    },
    {
      allowsRepeatedRoundAttack: true,
      canonicalMeleeMode: "thrust",
      id: "thrust",
      label: "Thrust",
      order: 1,
      provenance: "manual",
    },
    {
      canonicalMeleeMode: null,
      id: "throw",
      label: "Throw",
      order: 3,
      provenance: "manual",
    },
  ]);

  it("preserves a legal explicit mode before main/default and canonical order", () => {
    expect(
      resolvePreferredAttackMode({ selectedModeId: "thrust", weapon: testWeapon }).mode?.id,
    ).toBe("thrust");
    expect(resolvePreferredAttackMode({ weapon: testWeapon }).mode?.id).toBe("strike");
  });

  it("falls back to the first eligible repeated mode for same-source Attack 2", () => {
    const resolution = resolvePreferredAttackMode({
      requireRepeatedRoundAttack: true,
      selectedModeId: "strike",
      weapon: testWeapon,
    });

    expect(resolution.mode?.id).toBe("thrust");
    expect(resolution.reason).toBe("selected_mode_invalid");
    expect(resolution.legalModes.map((mode) => mode.id)).toEqual(["thrust"]);
  });

  it("keeps thrown modes distinct and fails safely when no melee mode is eligible", () => {
    const thrownOnly = weapon([
      {
        allowsRepeatedRoundAttack: false,
        attackType: "thrown",
        canonicalMeleeMode: null,
        id: "throw",
        label: "Throw",
        provenance: "manual",
      },
    ]);

    expect(
      resolvePreferredAttackMode({ requireRepeatedRoundAttack: true, weapon: thrownOnly }),
    ).toMatchObject({ legalModes: [], reason: "no_legal_modes" });
    expect(resolvePreferredAttackMode({ weapon: thrownOnly })).toMatchObject({
      legalModes: [],
      reason: "no_legal_modes",
    });
    expect(
      resolvePreferredAttackMode({
        allowThrownAttack: true,
        selectedModeId: "throw",
        weapon: thrownOnly,
      }),
    ).toMatchObject({ mode: { id: "throw" } });
  });

  it("does not treat an untyped non-melee mode as thrown", () => {
    const unresolved = weapon([
      {
        canonicalMeleeMode: null,
        id: "unresolved",
        label: "Unknown",
        provenance: "manual",
      },
    ]);

    expect(
      resolvePreferredAttackMode({
        allowThrownAttack: true,
        selectedModeId: "unresolved",
        weapon: unresolved,
      }),
    ).toMatchObject({ legalModes: [], reason: "no_legal_modes" });
  });

  it("parses legacy modes without order, main, or repeated capability conservatively", () => {
    const legacy = weapon([
      {
        canonicalMeleeMode: "thrust",
        id: "legacy-mode",
        label: "Thrust",
        provenance: "imported",
      },
    ]);

    expect(resolvePreferredAttackMode({ weapon: legacy }).mode?.id).toBe("legacy-mode");
    expect(
      resolvePreferredAttackMode({ requireRepeatedRoundAttack: true, weapon: legacy }).mode,
    ).toBeUndefined();
  });
});

describe("Disarm weapon-control profile", () => {
  it("clamps Encumbrance tiers, adds two-hand control, and protects gap boundaries", () => {
    expect(
      deriveWeaponDisarmControlRating({ baseEncumbrance: 0, gripClass: "one_handed" }),
    ).toEqual({
      controlRating: 1,
      encumbranceTier: 1,
    });
    expect(
      deriveWeaponDisarmControlRating({ baseEncumbrance: 15, gripClass: "two_handed" }),
    ).toEqual({
      controlRating: 6,
      encumbranceTier: 5,
    });
    expect(
      deriveWeaponDisarmControlRating({ baseEncumbrance: 99, gripClass: "one_handed" }),
    ).toEqual({
      controlRating: 5,
      encumbranceTier: 5,
    });
    expect(resolveWeaponDisarmMismatch({ actingControlRating: 1, targetControlRating: 4 })).toEqual(
      {
        feasible: true,
        gap: 3,
        modifier: -9,
      },
    );
    expect(resolveWeaponDisarmMismatch({ actingControlRating: 1, targetControlRating: 5 })).toEqual(
      {
        feasible: false,
        gap: 4,
        modifier: -12,
      },
    );
    expect(resolveWeaponDisarmMismatch({ actingControlRating: 5, targetControlRating: 1 })).toEqual(
      {
        feasible: true,
        gap: 0,
        modifier: 0,
      },
    );
  });

  it("uses typed Item add/remove and control overrides without weapon-name inference", () => {
    const template = weapon([]);
    const added = resolveWeaponDisarmProfile({
      itemFacts: {
        activeMechanics: [],
        descriptiveTraits: [],
        templateOverrides: [
          {
            id: "capability",
            kind: "weapon_disarm_capability_override",
            scope: "all_attack_modes",
            value: "trap",
            visibility: "revealed",
          },
          {
            id: "control",
            kind: "weapon_disarm_control_override",
            scope: "all_attack_modes",
            unit: "control_rating",
            value: 4,
            visibility: "revealed",
          },
        ],
        unsupportedCapabilities: [],
        version: 1,
      },
      template,
    });
    expect(added).toMatchObject({ capability: "trap", controlRating: 4 });

    const removed = resolveWeaponDisarmProfile({
      itemFacts: {
        activeMechanics: [],
        descriptiveTraits: [],
        templateOverrides: [
          {
            id: "damaged-trap",
            kind: "weapon_disarm_capability_override",
            scope: "all_attack_modes",
            value: "none",
            visibility: "revealed",
          },
        ],
        unsupportedCapabilities: [],
        version: 1,
      },
      template: { ...template, disarmCapability: "trap" },
    });
    expect(removed.capability).toBe("none");

    const hidden = resolveWeaponDisarmProfile({
      itemFacts: {
        activeMechanics: [],
        descriptiveTraits: [],
        templateOverrides: [
          {
            id: "hidden-trap",
            kind: "weapon_disarm_capability_override",
            scope: "all_attack_modes",
            value: "trap",
            visibility: "gm_only",
          },
        ],
        unsupportedCapabilities: [],
        version: 1,
      },
      template,
    });
    expect(hidden.capability).toBe("none");
  });
});
