export type RuleTableRollOrder = "ascending" | "descending";

export interface ClosedDieRuleTableBand<TKey extends string = string> {
  fullLabel: string;
  key: TKey;
  maxRoll: number;
  minRoll: number;
  notes?: string;
  shortLabel: string;
}

export interface ClosedDieRuleTable<TKey extends string = string> {
  bands: readonly ClosedDieRuleTableBand<TKey>[];
  dieLabel: string;
  id: string;
  notes?: readonly string[];
  rollOrder: RuleTableRollOrder;
  sides: number;
  title: string;
}

export interface ExpandedClosedDieRuleTableRow<TKey extends string = string>
  extends ClosedDieRuleTableBand<TKey> {
  roll: number;
}

export function assertClosedDieRoll(table: ClosedDieRuleTable, roll: number): void {
  if (!Number.isInteger(roll) || roll < 1 || roll > table.sides) {
    throw new RangeError(`${table.title} roll must be a closed ${table.dieLabel} value from 1 to ${table.sides}.`);
  }
}

export function expandClosedDieRuleTable<TKey extends string>(
  table: ClosedDieRuleTable<TKey>,
): ExpandedClosedDieRuleTableRow<TKey>[] {
  return table.bands.flatMap((band) => {
    const rows: ExpandedClosedDieRuleTableRow<TKey>[] = [];

    if (table.rollOrder === "descending") {
      for (let roll = band.maxRoll; roll >= band.minRoll; roll -= 1) {
        rows.push({ ...band, roll });
      }

      return rows;
    }

    for (let roll = band.minRoll; roll <= band.maxRoll; roll += 1) {
      rows.push({ ...band, roll });
    }

    return rows;
  });
}

export function resolveClosedDieRuleTableRoll<TKey extends string>(
  table: ClosedDieRuleTable<TKey>,
  roll: number,
): ClosedDieRuleTableBand<TKey> {
  assertClosedDieRoll(table, roll);

  const match = table.bands.find((band) => roll >= band.minRoll && roll <= band.maxRoll);

  if (!match) {
    throw new RangeError(`${table.title} roll ${roll} does not resolve to a known table band.`);
  }

  return match;
}

export function getClosedDieRuleTableBandDistance(band: ClosedDieRuleTableBand, roll: number): number {
  if (roll >= band.minRoll && roll <= band.maxRoll) {
    return 0;
  }

  return Math.min(Math.abs(roll - band.minRoll), Math.abs(roll - band.maxRoll));
}
