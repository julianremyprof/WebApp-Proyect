/**
 * Coin reward logic for practices (spec section 6).
 *
 * Rules recap:
 * - Tiers: 1 (71-80%), 2 (81-90%), 3 (91-100%).
 * - Tier 1 pays +1 coin the first time it's reached, +0 after.
 * - Tier 2 pays +2 coins the first time it's reached, +0 after.
 * - Tier 3 pays +3 coins the first time, then +1 coin on every later
 *   attempt that also scores 91%+.
 * - A student can never be paid for a LOWER tier than the highest tier
 *   they have already reached on that practice (e.g. scoring 75% after
 *   already reaching Tier 2 pays +0, not +1).
 * - Tests never award coins (enforced separately by
 *   `activities.coin_rewards_enabled`, which the DB constrains to false
 *   for kind = 'test').
 *
 * This function is intentionally pure and side-effect free so it can be
 * unit tested without a database, and so the API route (the only caller)
 * stays a thin wrapper that persists the result inside one transaction.
 */

export type Tier = 1 | 2 | 3;

export interface RewardHistoryRow {
  tier: Tier;
}

export interface CoinRewardResult {
  /** Coins to award for this attempt. */
  coinsAwarded: number;
  /** Tier this specific score falls into, if any (null when < 71%). */
  tierReached: Tier | null;
  /** True if this is the first time `tierReached` was ever earned. */
  isFirstTimeForTier: boolean;
  /** Updated reward history to persist (upsert into practice_reward_history). */
  historyUpdates: Array<{ tier: Tier; incrementTimesEarned: boolean }>;
}

function tierForScore(scorePercent: number): Tier | null {
  if (scorePercent >= 91) return 3;
  if (scorePercent >= 81) return 2;
  if (scorePercent >= 71) return 1;
  return null;
}

/**
 * @param scorePercent - 0-100 score for this attempt.
 * @param existingHistory - every tier row the student has already earned
 *   for this specific practice (from `practice_reward_history`).
 */
export function computeCoinReward(
  scorePercent: number,
  existingHistory: RewardHistoryRow[],
): CoinRewardResult {
  const tierReached = tierForScore(scorePercent);

  if (tierReached === null) {
    return { coinsAwarded: 0, tierReached: null, isFirstTimeForTier: false, historyUpdates: [] };
  }

  const highestEarnedTier = existingHistory.reduce<Tier | 0>(
    (max, row) => (row.tier > max ? row.tier : max),
    0,
  );
  const alreadyEarnedThisTier = existingHistory.some((row) => row.tier === tierReached);

  // Never pay for a tier at or below one already reached, EXCEPT tier 3,
  // which keeps paying (+1) every time it's re-reached.
  if (tierReached < highestEarnedTier) {
    return { coinsAwarded: 0, tierReached, isFirstTimeForTier: false, historyUpdates: [] };
  }

  if (tierReached === 3) {
    if (!alreadyEarnedThisTier) {
      return {
        coinsAwarded: 3,
        tierReached: 3,
        isFirstTimeForTier: true,
        historyUpdates: [{ tier: 3, incrementTimesEarned: false }],
      };
    }
    return {
      coinsAwarded: 1,
      tierReached: 3,
      isFirstTimeForTier: false,
      historyUpdates: [{ tier: 3, incrementTimesEarned: true }],
    };
  }

  // Tiers 1 and 2: one-time payout only.
  if (alreadyEarnedThisTier) {
    return { coinsAwarded: 0, tierReached, isFirstTimeForTier: false, historyUpdates: [] };
  }

  const coinsAwarded = tierReached === 2 ? 2 : 1;
  return {
    coinsAwarded,
    tierReached,
    isFirstTimeForTier: true,
    historyUpdates: [{ tier: tierReached, incrementTimesEarned: false }],
  };
}
