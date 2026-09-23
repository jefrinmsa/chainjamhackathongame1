import type { Hex } from 'viem';

// ── Bet Configuration Names ────────────────────────────────────────────
export type BetConfigName = 'calm-night' | 'meteor-shower';

// ── Per-Config Constants ───────────────────────────────────────────────
// Derived from compileConfiguration on the real CSVs:
//   calm-night.csv  prizes: 0, 1.2, 1.8, 3, 6  → prizeDenominator = 5
//   meteor-shower.csv prizes: 0, 1.5, 3, 10, 80, 500 → prizeDenominator = 2

export const BET_CONFIGS = {
  'calm-night': {
    index: 0,
    gameData: '0x00' as Hex,
    prizeDenominator: 5n,
    /** Maps prizeUnits → tier name. Keys are the exact prizeUnits from the compiled CSV. */
    tiers: new Map<bigint, TierName>([
      [0n, 'Fizzle'],
      [6n, 'Small Bloom'],      // 1.2 × 5 = 6
      [9n, 'Bright Burst'],     // 1.8 × 5 = 9
      [15n, 'Cascade'],         // 3   × 5 = 15
      [30n, 'Golden Willow'],   // 6   × 5 = 30
    ]),
    /** Maps prizeUnits → display multiplier string */
    multiplierLabels: new Map<bigint, string>([
      [0n, '0x'],
      [6n, '1.2x'],
      [9n, '1.8x'],
      [15n, '3x'],
      [30n, '6x'],
    ]),
  },
  'meteor-shower': {
    index: 1,
    gameData: '0x01' as Hex,
    prizeDenominator: 2n,
    tiers: new Map<bigint, TierName>([
      [0n, 'Fizzle'],
      [3n, 'Small Bloom'],       // 1.5 × 2 = 3
      [6n, 'Bright Burst'],      // 3   × 2 = 6
      [20n, 'Cascade'],          // 10  × 2 = 20
      [160n, 'Golden Willow'],   // 80  × 2 = 160
      [1000n, 'Phoenix Finale'], // 500 × 2 = 1000
    ]),
    multiplierLabels: new Map<bigint, string>([
      [0n, '0x'],
      [3n, '1.5x'],
      [6n, '3x'],
      [20n, '10x'],
      [160n, '80x'],
      [1000n, '500x'],
    ]),
  },
} as const satisfies Record<BetConfigName, BetConfig>;

// ── Tier Names ─────────────────────────────────────────────────────────
export type TierName =
  | 'Fizzle'
  | 'Small Bloom'
  | 'Bright Burst'
  | 'Cascade'
  | 'Golden Willow'
  | 'Phoenix Finale';

// ── Bet Config Shape ───────────────────────────────────────────────────
export type BetConfig = {
  index: number;
  gameData: Hex;
  prizeDenominator: bigint;
  tiers: Map<bigint, TierName>;
  multiplierLabels: Map<bigint, string>;
};

// ── Round State ────────────────────────────────────────────────────────
// Tracks which config was used to open the session, so settled decoding
// uses the correct prizeDenominator and tier table.
export type Round = {
  /** Which bet config opened this session. */
  configName: BetConfigName;
  sessionKey: string;
  wager: bigint;
  status: 'opening' | 'waiting' | 'animating' | 'settled';
  sessionId?: string;
  prizeUnits?: bigint;
  payout?: bigint;
  tierName?: TierName;
  multiplierLabel?: string;
};

// ── Helpers ────────────────────────────────────────────────────────────

/**
 * The settled game state is 4 bytes holding the prize in units of the
 * configuration's prize denominator. Anything shorter is a session still
 * in flight. Matches the pattern in the real App.tsx:
 *   gameState.length === 10  →  "0x" + 8 hex chars = 4 bytes
 */
export function settledPrizeUnits(gameState: Hex | undefined): bigint | undefined {
  if (gameState === undefined || gameState.length !== 10) return undefined;
  // Use BigInt on the hex string directly (viem hexToBigInt equivalent)
  return BigInt(gameState);
}

/**
 * Resolve the tier name for a settled session, using the config that was
 * selected when the session was opened. Returns undefined for unknown
 * prizeUnits (should not happen with a valid title).
 */
export function resolveTier(
  configName: BetConfigName,
  prizeUnits: bigint,
): { tierName: TierName; multiplierLabel: string } | undefined {
  const config = BET_CONFIGS[configName];
  const tierName = config.tiers.get(prizeUnits);
  const multiplierLabel = config.multiplierLabels.get(prizeUnits);
  if (tierName === undefined || multiplierLabel === undefined) return undefined;
  return { tierName, multiplierLabel };
}

/**
 * Compute payout from prizeUnits using the session's own config denominator:
 *   payout = wager × prizeUnits / prizeDenominator  (rounded down)
 */
export function computePayout(
  configName: BetConfigName,
  wager: bigint,
  prizeUnits: bigint,
): bigint {
  const { prizeDenominator } = BET_CONFIGS[configName];
  return (wager * prizeUnits) / prizeDenominator;
}

/**
 * Top prize multiplier for a given config (used for computeMaxWager).
 */
export function topMultiplierX(configName: BetConfigName): number {
  const config = BET_CONFIGS[configName];
  const maxUnits = Math.max(...[...config.tiers.keys()].map(Number));
  return maxUnits / Number(config.prizeDenominator);
}
