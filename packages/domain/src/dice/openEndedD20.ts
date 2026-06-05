export interface OpenEndedD20Roll {
  dieResult: number;
  openEndedD10s: number[];
  rollD20: number;
}

function rollDie(sides: number, rng: () => number): number {
  return Math.floor(rng() * sides) + 1;
}

export function rollOpenEndedD20(rng: () => number = Math.random): OpenEndedD20Roll {
  const rollD20 = rollDie(20, rng);
  const openEndedD10s: number[] = [];
  let dieResult = rollD20;

  if (rollD20 === 20 || rollD20 === 1) {
    const direction = rollD20 === 20 ? 1 : -1;
    let keepRolling = true;

    while (keepRolling) {
      const d10 = rollDie(10, rng);
      openEndedD10s.push(d10);
      dieResult += direction * d10;
      keepRolling = d10 === 10;
    }
  }

  return { dieResult, openEndedD10s, rollD20 };
}

export function formatOpenEndedD20RollBreakdown(roll: OpenEndedD20Roll): string {
  if (roll.openEndedD10s.length === 0) {
    return String(roll.rollD20);
  }

  const separator = roll.rollD20 === 1 ? " - " : " + ";
  return `${roll.rollD20}${separator}${roll.openEndedD10s.join(separator)}`;
}
