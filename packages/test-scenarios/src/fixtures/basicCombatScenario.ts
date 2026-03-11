export const basicCombatScenario = {
  id: "basic-combat-001",
  description: "Minimal fixture for validating baseline OB/DB/parry flow.",
  attacker: {
    id: "char-attacker-1",
    name: "Ari",
    level: 1
  },
  defender: {
    id: "char-defender-1",
    name: "Brom",
    level: 1
  },
  weapon: {
    id: "weapon-1",
    name: "Training Sword",
    type: "melee",
    baseOB: 25
  }
} as const;
