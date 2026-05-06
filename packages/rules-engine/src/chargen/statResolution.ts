import type {
  GlantriCharacteristicBlock,
  GlantriCharacteristicKey,
  RolledCharacterProfile
} from "@glantri/domain";

import { glantriCharacteristicOrder } from "@glantri/domain";
import {
  getDexteritySizeModifier,
  getGlantriStatModifier
} from "../stats/characteristicGms";
import { STANDARD_CHARGEN_METHOD_POLICY, type ChargenMethodPolicy } from "./policy";

export interface ChargenStatAdjustmentState {
  buildsUsed: number;
  exchangesUsed: number;
  stats: GlantriCharacteristicBlock;
}

export interface ChargenAdjustmentResult {
  error?: string;
  state: ChargenStatAdjustmentState;
}

function cloneStats(stats: GlantriCharacteristicBlock): GlantriCharacteristicBlock {
  return { ...stats };
}

export function createChargenStatAdjustmentState(
  stats: GlantriCharacteristicBlock
): ChargenStatAdjustmentState {
  return {
    buildsUsed: 0,
    exchangesUsed: 0,
    stats: cloneStats(stats)
  };
}

export function resolveGlantriCharacterStats(
  stats: GlantriCharacteristicBlock
): GlantriCharacteristicBlock {
  return {
    cha: stats.cha + getGlantriStatModifier(stats.com),
    com: stats.com,
    con: stats.con,
    dex: stats.dex + getDexteritySizeModifier(stats.siz),
    health: stats.health + getGlantriStatModifier(stats.con),
    int: stats.int,
    lck: stats.lck,
    pow: stats.pow,
    siz: stats.siz,
    str: stats.str + getGlantriStatModifier(stats.siz),
    will: stats.will
  };
}

export function getResolvedProfileStats(
  profile: RolledCharacterProfile | undefined
): GlantriCharacteristicBlock | undefined {
  if (!profile) {
    return undefined;
  }

  return profile.resolvedStats ?? profile.rolledStats;
}

export function applyChargenStatExchange(input: {
  firstStat: GlantriCharacteristicKey;
  policy?: Pick<ChargenMethodPolicy, "maxExchanges">;
  secondStat: GlantriCharacteristicKey;
  state: ChargenStatAdjustmentState;
}): ChargenAdjustmentResult {
  const policy = input.policy ?? STANDARD_CHARGEN_METHOD_POLICY;

  if (input.firstStat === input.secondStat) {
    return {
      error: "Choose two different stats to exchange.",
      state: input.state
    };
  }

  if (input.state.exchangesUsed >= policy.maxExchanges) {
    return {
      error: `You can exchange stats at most ${policy.maxExchanges} times.`,
      state: input.state
    };
  }

  const stats = cloneStats(input.state.stats);
  const firstValue = stats[input.firstStat];
  stats[input.firstStat] = stats[input.secondStat];
  stats[input.secondStat] = firstValue;

  return {
    state: {
      buildsUsed: input.state.buildsUsed,
      exchangesUsed: input.state.exchangesUsed + 1,
      stats
    }
  };
}

export function applyChargenStatBuild(input: {
  decreaseStat: GlantriCharacteristicKey;
  increaseStat: GlantriCharacteristicKey;
  policy?: Pick<ChargenMethodPolicy, "maxBuilds">;
  state: ChargenStatAdjustmentState;
}): ChargenAdjustmentResult {
  const policy = input.policy ?? STANDARD_CHARGEN_METHOD_POLICY;

  if (input.decreaseStat === input.increaseStat) {
    return {
      error: "Choose different stats when building.",
      state: input.state
    };
  }

  if (input.state.buildsUsed >= policy.maxBuilds) {
    return {
      error: `You can build stats at most ${policy.maxBuilds} times.`,
      state: input.state
    };
  }

  const currentDecrease = input.state.stats[input.decreaseStat];
  const currentIncrease = input.state.stats[input.increaseStat];

  if (currentDecrease - 2 < 1) {
    return {
      error: `${input.decreaseStat.toUpperCase()} cannot be reduced below 1.`,
      state: input.state
    };
  }

  if (currentIncrease + 1 > 25) {
    return {
      error: `${input.increaseStat.toUpperCase()} cannot be increased above 25.`,
      state: input.state
    };
  }

  const stats = cloneStats(input.state.stats);
  stats[input.decreaseStat] -= 2;
  stats[input.increaseStat] += 1;

  return {
    state: {
      buildsUsed: input.state.buildsUsed + 1,
      exchangesUsed: input.state.exchangesUsed,
      stats
    }
  };
}

export function buildResolvedProfile(input: {
  adjustedStats: GlantriCharacteristicBlock;
  profile: RolledCharacterProfile;
}): RolledCharacterProfile {
  return {
    ...input.profile,
    resolvedStats: resolveGlantriCharacterStats(input.adjustedStats),
    rolledStats: Object.fromEntries(
      glantriCharacteristicOrder.map((key) => [key, input.adjustedStats[key]])
    ) as GlantriCharacteristicBlock
  };
}
