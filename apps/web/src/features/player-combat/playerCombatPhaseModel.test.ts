import { describe, expect, it } from "vitest";

import { createEmptyPlayerEncounterCombatContext } from "@/lib/campaigns/playerEncounter";

import {
  applyDefaultPlayerCombatPhaseContext,
  buildPlayerCombatDefenseStats,
  buildPlayerCombatPhasePanelModel,
  DEFAULT_MAIN_HAND_PARRY_DIRECTION,
  DEFAULT_OFF_HAND_PARRY_DIRECTION,
  type PlayerCombatLoadoutReference,
} from "./playerCombatPhaseModel";

const phaseCard = {
  description: "",
  phaseLabel: "Phase 1",
  stats: [],
  title: "",
};

const attackStats = {
  attackMode: "C",
  dmb: "8",
  initiative: "3",
  maxCrits: "FS",
  ob: "10",
  weaponName: "Broad sword",
};

const reference: PlayerCombatLoadoutReference = {
  am: "C",
  attackMode: "C",
  combinedDb: "18",
  combinedDm: "0",
  crit: "F",
  db: "14",
  dmb: "8",
  dm: "0",
  initiative: "3",
  ob: "10",
  parry: "incomplete",
  secondCrit: "S",
  selectedWeapon: "Broad sword",
};

describe("player combat phase model", () => {
  it("maps Attack - Parry into phase 1 attack/defense and phase 2 defense", () => {
    const phaseContext = createEmptyPlayerEncounterCombatContext();
    const defenseStats = buildPlayerCombatDefenseStats({
      mainHandParryItemLabel: "Broad sword",
      offHandParryItemLabel: "Medium shield",
      phaseContext,
      reference,
    });

    const phase1 = buildPlayerCombatPhasePanelModel({
      actionId: "attack_parry",
      attackStats,
      defenseStats,
      phaseCard,
      phaseContext,
      phaseKey: "phase1",
      secondaryActionId: "",
    });
    const phase2 = buildPlayerCombatPhasePanelModel({
      actionId: "attack_parry",
      attackStats,
      defenseStats,
      phaseCard: { ...phaseCard, phaseLabel: "Phase 2" },
      phaseContext,
      phaseKey: "phase2",
      secondaryActionId: "",
    });

    expect(phase1.showAttackStats).toBe(true);
    expect(phase1.showAttackLocationSelector).toBe(true);
    expect(phase1.showDefenseContext).toBe(true);
    expect(phase2.showAttackStats).toBe(false);
    expect(phase2.showAttackLocationSelector).toBe(false);
    expect(phase2.showDefenseContext).toBe(true);
  });

  it("maps Parry - Attack into separate phase 1 defense and phase 2 attack/defense", () => {
    const phaseContext = createEmptyPlayerEncounterCombatContext();
    const defenseStats = buildPlayerCombatDefenseStats({
      mainHandParryItemLabel: "Broad sword",
      offHandParryItemLabel: "Medium shield",
      phaseContext,
      reference,
    });

    const phase1 = buildPlayerCombatPhasePanelModel({
      actionId: "parry_attack",
      attackStats,
      defenseStats,
      phaseCard,
      phaseContext,
      phaseKey: "phase1",
      secondaryActionId: "",
    });
    const phase2 = buildPlayerCombatPhasePanelModel({
      actionId: "parry_attack",
      attackStats,
      defenseStats,
      phaseCard: { ...phaseCard, phaseLabel: "Phase 2" },
      phaseContext,
      phaseKey: "phase2",
      secondaryActionId: "",
    });

    expect(phase1.showAttackStats).toBe(false);
    expect(phase1.showAttackLocationSelector).toBe(false);
    expect(phase1.showDefenseContext).toBe(true);
    expect(phase2.showAttackStats).toBe(true);
    expect(phase2.showAttackLocationSelector).toBe(true);
    expect(phase2.showDefenseContext).toBe(true);
  });

  it("keeps phase contexts separable for phase-specific parry directions", () => {
    const phase1Context = {
      ...createEmptyPlayerEncounterCombatContext(),
      mainHandParryDirection: "left" as const,
    };
    const phase2Context = {
      ...createEmptyPlayerEncounterCombatContext(),
      mainHandParryDirection: "right" as const,
    };

    const phase1Defense = buildPlayerCombatDefenseStats({
      mainHandParryItemLabel: "Broad sword",
      offHandParryItemLabel: "Medium shield",
      phaseContext: phase1Context,
      reference,
    });
    const phase2Defense = buildPlayerCombatDefenseStats({
      mainHandParryItemLabel: "Broad sword",
      offHandParryItemLabel: "Medium shield",
      phaseContext: phase2Context,
      reference,
    });

    expect(phase1Context.mainHandParryDirection).toBe("left");
    expect(phase2Context.mainHandParryDirection).toBe("right");
    expect(phase1Defense?.sourceName).toBe("Medium shield");
    expect(phase2Defense?.sourceName).toBe("Medium shield");
  });

  it("defaults blank phase parry directions without overwriting saved values", () => {
    const emptyContext = createEmptyPlayerEncounterCombatContext();
    const defaultedContext = applyDefaultPlayerCombatPhaseContext(emptyContext);
    const savedContext = applyDefaultPlayerCombatPhaseContext({
      ...createEmptyPlayerEncounterCombatContext(),
      mainHandParryDirection: "right" as const,
      offHandParryDirection: "right_forward" as const,
    });

    expect(defaultedContext.mainHandParryDirection).toBe(DEFAULT_MAIN_HAND_PARRY_DIRECTION);
    expect(defaultedContext.offHandParryDirection).toBe(DEFAULT_OFF_HAND_PARRY_DIRECTION);
    expect(emptyContext.mainHandParryDirection).toBeUndefined();
    expect(emptyContext.offHandParryDirection).toBeUndefined();
    expect(savedContext.mainHandParryDirection).toBe("right");
    expect(savedContext.offHandParryDirection).toBe("right_forward");
  });

  it("keeps phase-specific aimed target locations separable", () => {
    const phase1Context = {
      ...createEmptyPlayerEncounterCombatContext(),
      targetLocation: "head" as const,
    };
    const phase2Context = {
      ...createEmptyPlayerEncounterCombatContext(),
      targetLocation: "rightArm" as const,
    };

    expect(applyDefaultPlayerCombatPhaseContext(phase1Context).targetLocation).toBe("head");
    expect(applyDefaultPlayerCombatPhaseContext(phase2Context).targetLocation).toBe("rightArm");
  });
});
