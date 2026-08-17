import { describe, expect, it } from "vitest";

import { WeaponTemplateSchema } from "./schemas";
import { resolvePreferredAttackMode } from "./weapon";
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
