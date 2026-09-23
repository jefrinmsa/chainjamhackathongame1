import {
  type HostApiV1,
  type HostSnapshotV1,
  SessionPhase,
} from '@chain/casino-sdk/guest';
import type { Hex } from 'viem';

const DEMO_GAME_ADDRESS = '0x000000000000000000000000000000000000dEaD' as `0x${string}`;

/**
 * Creates a standalone mock host that simulates on-chain sessions,
 * VRF randomness with exact CSV mathematical weights, and token balances.
 */
export function createDemoHost(onSnapshot: (snapshot: HostSnapshotV1) => void): {
  hostApi: HostApiV1;
  getSnapshot: () => HostSnapshotV1;
} {
  let balance = 1000n * 10n ** 18n; // 1,000 DEMO
  let sessionCounter = 1;
  const sessions: HostSnapshotV1['sessions']['items'] = [];

  function buildSnapshot(): HostSnapshotV1 {
    return {
      apiVersion: 1,
      integration: {
        chainId: 31337,
        slug: 'ember-festival',
        gameAddress: DEMO_GAME_ADDRESS,
        manifest: {
          schemaVersion: 1,
          gameId: 'EmberFestivalGame',
          apiVersion: 1,
          defaultLocale: 'en',
          locales: {
            en: {
              name: 'Ember Festival',
              description:
                'Pick a night sky and launch a firework — the burst reveals your payout tier from a weighted paytable.',
            },
          },
        },
      },
      wallet: {
        address: '0x1111111111111111111111111111111111111111',
        status: 'ready',
      },
      token: {
        symbol: 'DEMO',
        decimals: 18,
      },
      balances: {
        smartVaultBalance: balance.toString(),
      },
      casino: {
        availableLiquidity: (500_000n * 10n ** 18n).toString(),
        maxBetRiskBps: 500,
        maxAllowedReservedProfit: (50_000n * 10n ** 18n).toString(),
        maxBetAmount: (100n * 10n ** 18n).toString(),
      },
      sessions: {
        items: [...sessions],
      },
      ui: {
        locale: 'en',
        theme: 'dark',
      },
    };
  }

  function randomTxHash(): Hex {
    let hash = '0x';
    const chars = '0123456789abcdef';
    for (let i = 0; i < 64; i++) {
      hash += chars[Math.floor(Math.random() * chars.length)];
    }
    return hash as Hex;
  }

  const hostApi: HostApiV1 = {
    async openSession({ wager, gameData }) {
      const wagerBigInt = BigInt(wager);

      // Auto-refill demo balance if it gets too low
      if (balance < wagerBigInt) {
        balance = 1000n * 10n ** 18n;
      }

      balance -= wagerBigInt;
      const sessionKey = `demo-${Date.now()}-${sessionCounter}`;
      const txHash = randomTxHash();
      const currentId = sessionCounter++;

      const pendingSession = {
        sessionId: String(currentId),
        sessionKey,
        gameAddress: DEMO_GAME_ADDRESS,
        phase: SessionPhase.WAITING_RANDOMNESS,
        phaseName: 'WAITING_RANDOMNESS' as const,
        wager,
        isSettled: false,
        openedAt: Date.now(),
        lastEventTimestamp: Date.now(),
        raw: {
          gameData: gameData as Hex,
          openTransactionHash: txHash,
        },
      };

      sessions.unshift(pendingSession);
      onSnapshot(buildSnapshot());

      // Simulate on-chain VRF fulfillment delay
      setTimeout(() => {
        let prizeUnits: bigint;

        if (gameData === '0x01') {
          // Meteor Shower (total weight 1,000,000)
          const roll = Math.floor(Math.random() * 1_000_000);
          if (roll < 771690) {
            prizeUnits = 0n; // 0x (Fizzle)
          } else if (roll < 921690) {
            prizeUnits = 3n; // 1.5x (Small Bloom)
          } else if (roll < 981690) {
            prizeUnits = 6n; // 3x (Bright Burst)
          } else if (roll < 996690) {
            prizeUnits = 20n; // 10x (Cascade)
          } else if (roll < 999690) {
            prizeUnits = 160n; // 80x (Golden Willow)
          } else {
            prizeUnits = 1000n; // 500x (Phoenix Finale!)
          }
        } else {
          // Calm Night (total weight 100,000)
          const roll = Math.floor(Math.random() * 100_000);
          if (roll < 55100) {
            prizeUnits = 0n; // 0x (Fizzle)
          } else if (roll < 74900) {
            prizeUnits = 6n; // 1.2x (Small Bloom)
          } else if (roll < 88100) {
            prizeUnits = 9n; // 1.8x (Bright Burst)
          } else if (roll < 96000) {
            prizeUnits = 15n; // 3x (Cascade)
          } else {
            prizeUnits = 30n; // 6x (Golden Willow)
          }
        }

        // Calculate payout using the respective denominator
        const denominator = gameData === '0x01' ? 2n : 5n;
        const payout = (wagerBigInt * prizeUnits) / denominator;
        balance += payout;

        // 4-byte hex gameState ("0x" + 8 hex digits)
        const hexPrize = prizeUnits.toString(16).padStart(8, '0');
        const gameState = `0x${hexPrize}` as Hex;

        const settleTxHash = randomTxHash();

        // Update the session in place
        const idx = sessions.findIndex(s => s.sessionKey === sessionKey);
        if (idx !== -1) {
          sessions[idx] = {
            ...sessions[idx],
            phase: SessionPhase.SETTLED,
            phaseName: 'SETTLED',
            isSettled: true,
            payout: payout.toString(),
            settledAt: Date.now(),
            lastEventTimestamp: Date.now(),
            raw: {
              ...sessions[idx].raw,
              gameState,
              settleTransactionHash: settleTxHash,
            },
          };
        }

        onSnapshot(buildSnapshot());
      }, 400);

      return { sessionKey, transactionHash: txHash };
    },

    async submitAction() {
      return { transactionHash: randomTxHash() };
    },

    async cancelStuckRandomness() {
      return { transactionHash: randomTxHash() };
    },

    async revealOutcome() {
      // no-op
    },

    async reportContentSize() {
      // no-op
    },
  };

  return { hostApi, getSnapshot: buildSnapshot };
}
