/* ─────────────────────────────────────────────────────────────────────
 * App.tsx — Ember Festival game shell.
 *
 * Session lifecycle follows the real SDK example pattern:
 *   idle → opening → waiting (in-flight) → animating → settled
 *
 * The Round object stores `configName` so we always decode the settled
 * gameState with the correct per-config prizeDenominator and tier table.
 * ─────────────────────────────────────────────────────────────────── */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { formatUnits, type Hex, parseUnits } from 'viem';
import { computeMaxWager, SessionPhase } from '@chain/casino-sdk/guest';
import { useCasinoHost } from './hooks/useCasinoHost.ts';
import { BurstReveal } from './components/BurstReveal.tsx';
import { BettingDock } from './components/BettingDock.tsx';
import {
  type BetConfigName,
  BET_CONFIGS,
  type Round,
  type TierName,
  settledPrizeUnits,
  resolveTier,
  computePayout,
  topMultiplierX,
} from './types/game.ts';

export function App() {
  const { hostApi, snapshot, isStandalone } = useCasinoHost();
  const [configName, setConfigName] = useState<BetConfigName>('calm-night');
  const [wagerInput, setWagerInput] = useState('1');
  const [round, setRound] = useState<Round | null>(null);
  const [previewTier, setPreviewTier] = useState<TierName | null>(null);
  const [selectedPreview, setSelectedPreview] = useState<TierName | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const hostApiRef = useRef(hostApi);
  hostApiRef.current = hostApi;

  // ── Double-click guard: ref lock prevents re-entry while openSession is pending
  const launchLock = useRef(false);

  const decimals = snapshot?.token.decimals ?? 18;
  const symbol = snapshot?.token.symbol ?? '';
  const balance =
    snapshot?.balances.smartVaultBalance === undefined
      ? undefined
      : BigInt(snapshot.balances.smartVaultBalance);

  // ── Max wager uses the currently selected config's top multiplier ────
  const maxWager = useMemo(() => {
    const result = computeMaxWager(snapshot, {
      maxMultiplierX: topMultiplierX(configName),
    });
    return result.kind === 'limit' ? result.maxWager : undefined;
  }, [snapshot, configName]);

  // ── Settle from snapshot (mirrors the real App.tsx pattern) ──────────
  //
  // Case 3 (forfeited / cancelled): If the host sends a FORFEITED or
  // CANCELLED phase — whether via forfeitExpiredSession, cancelStuckRandomness,
  // or any other host-side action — we clear the round and show an error
  // message so the UI never gets stuck in the 'waiting' state.
  useEffect(
    function settleFromSnapshot() {
      if (!round || round.status !== 'waiting' || !snapshot) return;
      const row = snapshot.sessions.items.find(
        item => item.sessionKey === round.sessionKey,
      );
      if (!row) return;

      // Case 3: Forfeited or cancelled by host — escape hatch so UI never sticks
      if (
        row.phase === SessionPhase.FORFEITED ||
        row.phase === SessionPhase.CANCELLED
      ) {
        const phaseName = row.phase === SessionPhase.FORFEITED ? 'forfeited' : 'cancelled';
        setError(
          `Round ${phaseName} by the host. Your wager is handled per on-chain rules.`,
        );
        setRound(null);
        launchLock.current = false; // release lock so player can try again
        return;
      }

      // Read prize from the 4-byte gameState
      const prizeUnits = settledPrizeUnits(row.raw.gameState);
      if (
        !(row.isSettled || row.phase === SessionPhase.SETTLED) ||
        prizeUnits === undefined
      )
        return;

      // Resolve tier using the config that opened THIS session
      const resolved = resolveTier(round.configName, prizeUnits);

      setRound({
        ...round,
        status: 'animating',
        sessionId: row.sessionId,
        prizeUnits,
        payout:
          row.payout === undefined
            ? computePayout(round.configName, round.wager, prizeUnits)
            : BigInt(row.payout),
        tierName: resolved?.tierName,
        multiplierLabel: resolved?.multiplierLabel,
      });
    },
    [snapshot, round],
  );

  // ── Animation done → reveal outcome ──────────────────────────────────
  const handleAnimationDone = useCallback(() => {
    if (previewTier) {
      setPreviewTier(null);
      return;
    }
    setRound(current => {
      if (!current || current.status !== 'animating') return current;
      // Call revealOutcome so the host credits the payout to its balance UI
      if (current.sessionId) {
        void hostApiRef.current
          ?.revealOutcome({ sessionId: current.sessionId })
          .catch(() => {});
      }
      return { ...current, status: 'settled' };
    });
  }, [previewTier]);

  // ── Keyboard shortcuts (Keys 1-6) for judges / visual inspection ─────
  useEffect(() => {
    const tiers: TierName[] = [
      'Fizzle',
      'Small Bloom',
      'Bright Burst',
      'Cascade',
      'Golden Willow',
      'Phoenix Finale',
    ];
    const onKeyDown = (e: KeyboardEvent) => {
      if (round || e.target instanceof HTMLInputElement) return;
      if (e.key >= '1' && e.key <= '6') {
        const idx = parseInt(e.key, 10) - 1;
        const t = tiers[idx];
        setSelectedPreview(t);
        setPreviewTier(t);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [round]);

  const handlePreviewClick = useCallback((t: TierName) => {
    if (round) return;
    setSelectedPreview(t);
    setPreviewTier(t);
  }, [round]);

  // ── Launch (open session) ────────────────────────────────────────────
  const wager = useMemo(() => {
    try {
      const parsed = parseUnits(wagerInput.trim(), decimals);
      return parsed > 0n ? parsed : null;
    } catch {
      return null;
    }
  }, [wagerInput, decimals]);

  // Case 1: Compute insufficient-balance flag so Launch is disabled with a reason
  const insufficientBalance = wager !== null && balance !== undefined && wager > balance;

  const launch = useCallback(async () => {
    // Case 2: Double-click guard — if already launching, bail immediately
    if (launchLock.current) return;
    if (!hostApi || wager === null) return;
    // Case 1: Don't even try if balance is too low
    if (insufficientBalance) return;

    launchLock.current = true; // lock instantly before any async work
    setError(null);
    setSelectedPreview(null);
    setPreviewTier(null);

    const config = BET_CONFIGS[configName];
    const pendingKey = `pending:${Date.now()}`;

    setRound({
      configName,
      sessionKey: pendingKey,
      wager,
      status: 'opening',
    });

    try {
      const { sessionKey } = await hostApi.openSession({
        wager: wager.toString(),
        gameData: config.gameData,
      });
      setRound(current =>
        current?.sessionKey === pendingKey
          ? { ...current, sessionKey, status: 'waiting' }
          : current,
      );
    } catch (cause) {
      setRound(null);
      launchLock.current = false; // release lock on failure so player can retry
      setError(
        cause instanceof Error ? cause.message : 'Failed to open the round.',
      );
    }
  }, [hostApi, wager, configName, insufficientBalance]);

  // ── Dismiss settled round ────────────────────────────────────────────
  const dismiss = useCallback(() => {
    setRound(null);
    launchLock.current = false; // Case 2: release lock on dismiss so player can launch again
  }, []);

  // ── Render ───────────────────────────────────────────────────────────

  if (!hostApi || !snapshot) {
    return (
      <div className="connecting">
        <div className="connecting-spinner" />
        <p>Connecting to host…</p>
      </div>
    );
  }

  const walletReady = snapshot.wallet.status === 'ready';
  const inFlight = round !== null && round.status !== 'settled';
  const animating = round?.status === 'animating';

  // The tier to animate — active during 'animating' phase or dev preview
  const burstTier = round?.status === 'animating' ? round.tierName : (previewTier ?? undefined);

  // History from snapshot
  const history = snapshot.sessions.items
    .filter(
      item =>
        item.gameAddress === snapshot.integration.gameAddress &&
        item.isSettled &&
        item.raw.gameState !== undefined &&
        item.raw.gameState.length === 10,
    )
    .slice(0, 8);

  return (
    <div className="shell">
      {/* Header */}
      <header className="header">
        <div className="title-wrap">
          <h1 className="title">Ember Festival</h1>
          {isStandalone && (
            <span className="demo-chip" title="Playable standalone demo outside chain.wtf iframe">
              Playable Demo
            </span>
          )}
        </div>
        <div className="header-right">
          <div className="preview-pills" title="Preview Firework Tiers (Keys 1-6)">
            <span className="preview-label">Preview:</span>
            {[
              { id: 'Fizzle', label: '0x Dud' },
              { id: 'Small Bloom', label: 'Bloom' },
              { id: 'Bright Burst', label: 'Burst' },
              { id: 'Cascade', label: 'Cascade' },
              { id: 'Golden Willow', label: 'Willow' },
              { id: 'Phoenix Finale', label: 'Phoenix 🔥', isPhoenix: true },
            ].map(b => {
              const isSelected = selectedPreview === b.id;
              return (
                <button
                  key={b.id}
                  className={`preview-btn ${b.isPhoenix ? 'preview-btn--phoenix' : ''} ${isSelected ? 'preview-btn--active' : ''}`}
                  onClick={() => handlePreviewClick(b.id as TierName)}
                  disabled={!!round}
                >
                  {b.label}
                </button>
              );
            })}
          </div>
          <button
            className="sound-toggle"
            onClick={() => setSoundEnabled(s => !s)}
            aria-label={soundEnabled ? 'Mute sound' : 'Unmute sound'}
          >
            {soundEnabled ? '🔊' : '🔇'}
          </button>
        </div>
      </header>

      {/* Canvas stage */}
      <main className="stage">
        <BurstReveal
          tier={burstTier}
          onAnimationDone={handleAnimationDone}
          soundEnabled={soundEnabled}
        />

        {/* Settled result overlay */}
        {round?.status === 'settled' && round.tierName && (
          <div className="result-overlay" onClick={dismiss}>
            <div className="result-card">
              <span className="result-tier">{round.tierName}</span>
              <span className="result-multiplier">{round.multiplierLabel}</span>
              {round.payout !== undefined && round.payout > 0n && (
                <span className="result-payout">
                  +{formatUnits(round.payout, decimals)} {symbol}
                </span>
              )}
              {round.prizeUnits === 0n && (
                <span className="result-payout result-payout--miss">No win</span>
              )}
              <span className="result-dismiss">Tap to continue</span>
            </div>
          </div>
        )}

        {/* Session history */}
        {history.length > 0 && (
          <div className="history">
            {history.map(item => {
              // Determine which config was used from gameData
              const gd = item.raw.gameData;
              const itemConfigName: BetConfigName =
                gd === '0x01' ? 'meteor-shower' : 'calm-night';
              const units = settledPrizeUnits(item.raw.gameState as Hex);
              const resolved =
                units !== undefined
                  ? resolveTier(itemConfigName, units)
                  : undefined;
              return (
                <div key={item.sessionKey} className="history-row">
                  <span className="history-id">#{item.sessionId}</span>
                  <span className="history-tier">
                    {resolved?.tierName ?? 'unknown'}
                  </span>
                  <span className="history-payout">
                    {resolved?.multiplierLabel ?? '—'}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Betting dock */}
      <BettingDock
        configName={configName}
        onConfigChange={setConfigName}
        wagerInput={wagerInput}
        onWagerChange={setWagerInput}
        symbol={symbol}
        decimals={decimals}
        balance={balance}
        maxWager={maxWager}
        inFlight={inFlight}
        walletReady={walletReady}
        onLaunch={() => void launch()}
        error={error}
        animating={animating ?? false}
      />
    </div>
  );
}
