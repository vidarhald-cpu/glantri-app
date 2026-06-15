import { describe, expect, it } from "vitest";

import { createEmptyPlayerEncounterCombatContext } from "@/lib/campaigns/playerEncounter";

import {
  applyDefaultPlayerCombatPhaseContext,
  buildPlayerCombatDefenseStats,
  buildPlayerCombatLoadoutSummary,
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
  am2: "C",
  attackMode: "C",
  attackMode2: "Thrust",
  combinedDb: "18",
  combinedDm: "0",
  combinedParry: "13",
  combinedSourceName: "Sword / shield",
  crit: "F",
  crit2: "E",
  damageClass: "edged",
  damageClass2: "pointed",
  db: "14",
  dmb: "8",
  dmb2: "6",
  dm: "0",
  initiative: "3",
  ob: "10",
  ob2: "9",
  parry: "7",
  secondCrit: "S",
  selectedWeapon: "Broad sword",
};

function buildLoadoutModel(input: {
  rows: Array<Array<string | number>>;
  valueLabel?: string;
  weaponRows?: Array<{
    currentItemLabel: string;
    damageClass1?: string | null;
    damageClass2?: string | null;
    modeLabel: string;
  }>;
}): Parameters<typeof buildPlayerCombatLoadoutSummary>[0]["loadoutModel"] {
  return {
    armorSummary: null,
    combatStatePanelModel: {
      capabilityRows: [],
      description: "",
      statsRows: [],
      title: "Combat State Panel",
      weaponRows: input.weaponRows as never,
      weaponModeTable: {
        columns: [
          "Mode",
          "Weapon",
          "I",
          "Attack 1",
          "OB",
          "DMB",
          "Crit 1",
          "Sec",
          "AM",
          "DB",
          "DM",
          "Parry",
          "Attack 2",
          "OB2",
          "DMB2",
          "Crit 2",
          "AM 2",
        ],
        description: "",
        rows: input.rows,
        title: "Weapons",
      },
    },
    encumbranceSkillsTable: null,
    fields: [
      {
        id: "primary",
        label: "Primary weapon",
        options: [],
        value: "primary-weapon",
        valueLabel: input.valueLabel ?? "Long sword",
      },
    ],
  } as Parameters<typeof buildPlayerCombatLoadoutSummary>[0]["loadoutModel"];
}

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

  it("maps Double Attack into phase 1 and phase 2 attacks", () => {
    const phase1Context = {
      ...createEmptyPlayerEncounterCombatContext(),
      targetParticipantId: "target-phase-1",
      targetLocation: "head" as const,
    };
    const phase2Context = {
      ...createEmptyPlayerEncounterCombatContext(),
      targetParticipantId: "target-phase-2",
      targetLocation: "rightArm" as const,
    };
    const defenseStats = buildPlayerCombatDefenseStats({
      mainHandParryItemLabel: "Broad sword",
      offHandParryItemLabel: "Medium shield",
      phaseContext: phase1Context,
      reference,
    });

    const phase1 = buildPlayerCombatPhasePanelModel({
      actionId: "double_attack",
      attackStats,
      defenseStats,
      phaseCard,
      phaseContext: phase1Context,
      phaseKey: "phase1",
      secondaryActionId: "",
    });
    const phase2 = buildPlayerCombatPhasePanelModel({
      actionId: "double_attack",
      attackStats,
      defenseStats,
      phaseCard: { ...phaseCard, phaseLabel: "Phase 2" },
      phaseContext: phase2Context,
      phaseKey: "phase2",
      secondaryActionId: "",
    });

    expect(phase1.showAttackStats).toBe(true);
    expect(phase1.showAttackLocationSelector).toBe(true);
    expect(phase1.phaseContext.targetParticipantId).toBe("target-phase-1");
    expect(phase1.phaseContext.targetLocation).toBe("head");
    expect(phase2.showAttackStats).toBe(true);
    expect(phase2.showAttackLocationSelector).toBe(true);
    expect(phase2.phaseContext.targetParticipantId).toBe("target-phase-2");
    expect(phase2.phaseContext.targetLocation).toBe("rightArm");
  });

  it("selects Attack 1 for Double Attack phase 1 and Attack 2 for phase 2 when available", () => {
    const loadoutModel = buildLoadoutModel({
      rows: [
        [
          "Primary",
          "Long sword",
          "3",
          "Slash",
          "9",
          "8",
          "F",
          "S",
          "C",
          "12",
          "0",
          "7",
          "Thrust",
          "8",
          "6",
          "E",
          "C",
        ],
      ],
      weaponRows: [
        {
          currentItemLabel: "Long sword",
          damageClass1: "edged",
          damageClass2: "pointed",
          modeLabel: "Primary",
        },
      ],
    });

    const phase1 = buildPlayerCombatLoadoutSummary({
      actionId: "double_attack",
      loadoutModel,
      phaseKey: "phase1",
      secondaryActionId: "",
    });
    const phase2 = buildPlayerCombatLoadoutSummary({
      actionId: "double_attack",
      loadoutModel,
      phaseKey: "phase2",
      secondaryActionId: "",
    });

    expect(phase1.attackStats).toMatchObject({
      attackMode: "C",
      dmb: "8",
      maxCrits: "F / S",
      ob: "9",
      weaponCriticalCode: "FS",
      weaponDamageClass: "edged",
      weaponName: "Long sword",
    });
    expect(phase2.attackStats).toMatchObject({
      attackMode: "C",
      dmb: "6",
      maxCrits: "E",
      ob: "8",
      weaponCriticalCode: "E",
      weaponDamageClass: "pointed",
      weaponName: "Long sword",
    });
  });

  it("falls back to Attack 1 for Double Attack phase 2 when no second attack row exists", () => {
    const loadoutModel = buildLoadoutModel({
      rows: [
        [
          "Primary",
          "Dagger",
          "2",
          "Slash",
          "7",
          "3",
          "A",
          "—",
          "A",
          "10",
          "0",
          "4",
          "—",
          "—",
          "—",
          "—",
          "—",
        ],
      ],
      valueLabel: "Dagger",
    });

    const phase2 = buildPlayerCombatLoadoutSummary({
      actionId: "double_attack",
      loadoutModel,
      phaseKey: "phase2",
      secondaryActionId: "",
    });

    expect(phase2.attackStats).toMatchObject({
      attackMode: "A",
      dmb: "3",
      maxCrits: "A",
      ob: "7",
      weaponName: "Dagger",
    });
  });

  it("does not expose a rollable attack source when the loadout has no weapon rows", () => {
    const summary = buildPlayerCombatLoadoutSummary({
      actionId: "double_attack",
      loadoutModel: buildLoadoutModel({ rows: [] }),
      phaseKey: "phase1",
      secondaryActionId: "",
    });

    expect(summary.attackStats).toBeNull();
  });

  it("maps Adjust Range - Attack into phase 1 range adjustment and phase 2 attack", () => {
    const phaseContext = createEmptyPlayerEncounterCombatContext();
    const defenseStats = buildPlayerCombatDefenseStats({
      mainHandParryItemLabel: "Broad sword",
      offHandParryItemLabel: "Medium shield",
      phaseContext,
      reference,
    });

    const phase1 = buildPlayerCombatPhasePanelModel({
      actionId: "adjust_range_attack",
      attackStats,
      defenseStats,
      phaseCard,
      phaseContext,
      phaseKey: "phase1",
      secondaryActionId: "",
    });
    const phase2 = buildPlayerCombatPhasePanelModel({
      actionId: "adjust_range_attack",
      attackStats,
      defenseStats,
      phaseCard: { ...phaseCard, phaseLabel: "Phase 2" },
      phaseContext: {
        ...phaseContext,
        targetParticipantId: "target-phase-2",
      },
      phaseKey: "phase2",
      secondaryActionId: "",
    });

    expect(phase1.phaseCard.title).toBe("Adjust range");
    expect(phase1.showAttackStats).toBe(false);
    expect(phase1.showAttackLocationSelector).toBe(false);
    expect(phase1.showDefenseContext).toBe(false);
    expect(phase2.showAttackStats).toBe(true);
    expect(phase2.showAttackLocationSelector).toBe(true);
    expect(phase2.phaseContext.targetParticipantId).toBe("target-phase-2");
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
    expect(phase1Defense?.sourceName).toBe("Sword / shield");
    expect(phase1Defense?.parry).toBe("13");
    expect(phase2Defense?.sourceName).toBe("Sword / shield");
    expect(phase2Defense?.parry).toBe("13");
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

  it("keeps phase-specific attack targets separable", () => {
    const phase1Context = {
      ...createEmptyPlayerEncounterCombatContext(),
      targetParticipantId: "target-phase-1",
    };
    const phase2Context = {
      ...createEmptyPlayerEncounterCombatContext(),
      targetParticipantId: "target-phase-2",
    };

    expect(applyDefaultPlayerCombatPhaseContext(phase1Context).targetParticipantId).toBe(
      "target-phase-1",
    );
    expect(applyDefaultPlayerCombatPhaseContext(phase2Context).targetParticipantId).toBe(
      "target-phase-2",
    );
  });
});
