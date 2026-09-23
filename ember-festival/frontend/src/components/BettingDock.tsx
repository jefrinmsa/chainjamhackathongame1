/* ─────────────────────────────────────────────────────────────────────
 * BettingDock — bottom dock with night-type toggle, bet stepper,
 * and launch button.
 *
 * Fades to ~20% opacity the instant launch is tapped; returns to full
 * opacity once the outcome is settled and revealed.
 * ─────────────────────────────────────────────────────────────────── */

import { useCallback } from 'react';
import { formatUnits, parseUnits } from 'viem';
import type { BetConfigName } from '../types/game.ts';

export type BettingDockProps = {
  configName: BetConfigName;
  onConfigChange: (name: BetConfigName) => void;
  wagerInput: string;
  onWagerChange: (value: string) => void;
  symbol: string;
  decimals: number;
  balance: bigint | undefined;
  maxWager: bigint | undefined;
  inFlight: boolean;
  walletReady: boolean;
  onLaunch: () => void;
  error: string | null;
  /** true while the burst animation is playing; dock fades to 20% */
  animating: boolean;
};

export function BettingDock({
  configName,
  onConfigChange,
  wagerInput,
  onWagerChange,
  symbol,
  decimals,
  balance,
  maxWager,
  inFlight,
  walletReady,
  onLaunch,
  error,
  animating,
}: BettingDockProps) {
  // ── Wager validation ─────────────────────────────────────────────────
  let wager: bigint | null = null;
  try {
    const parsed = parseUnits(wagerInput.trim(), decimals);
    wager = parsed > 0n ? parsed : null;
  } catch {
    wager = null;
  }

  const insufficientBalance = wager !== null && balance !== undefined && wager > balance;
  const aboveMax = wager !== null && maxWager !== undefined && wager > maxWager;
  const canLaunch = walletReady && !inFlight && wager !== null && !insufficientBalance && !aboveMax;

  const reason = !walletReady
    ? 'Connect your wallet in the host app to play.'
    : error
      ? error
      : insufficientBalance
        ? 'Insufficient balance.'
        : aboveMax && maxWager !== undefined
          ? `Max bet: ${formatUnits(maxWager, decimals)} ${symbol}`
          : null;

  // ── Bet stepper ──────────────────────────────────────────────────────
  const stepBet = useCallback(
    (direction: 1 | -1) => {
      const current = parseFloat(wagerInput) || 0;
      // Step logic: halve or double
      const next = direction === 1 ? current * 2 || 1 : current / 2;
      if (next <= 0) return;
      onWagerChange(String(next));
    },
    [wagerInput, onWagerChange],
  );

  return (
    <div
      className="betting-dock"
      style={{ opacity: animating ? 0.2 : 1 }}
    >
      {/* Night-type toggle */}
      <div className="dock-section dock-toggle">
        <button
          className={`toggle-btn ${configName === 'calm-night' ? 'toggle-btn--active' : ''}`}
          onClick={() => onConfigChange('calm-night')}
          disabled={inFlight}
          title="Calm Night — frequent small wins, top prize 6x"
        >
          <span className="toggle-icon">🌙</span>
          <span className="toggle-label">Calm Night</span>
        </button>
        <button
          className={`toggle-btn ${configName === 'meteor-shower' ? 'toggle-btn--active' : ''}`}
          onClick={() => onConfigChange('meteor-shower')}
          disabled={inFlight}
          title="Meteor Shower — rare huge wins, top prize 500x"
        >
          <span className="toggle-icon">☄️</span>
          <span className="toggle-label">Meteor Shower</span>
        </button>
      </div>

      {/* Bet amount stepper */}
      <div className="dock-section dock-bet">
        <button className="step-btn" onClick={() => stepBet(-1)} disabled={inFlight} aria-label="Halve bet">
          −
        </button>
        <div className="bet-input-wrap">
          <input
            className="bet-input"
            value={wagerInput}
            onChange={e => onWagerChange(e.target.value)}
            inputMode="decimal"
            disabled={inFlight}
            aria-label="Bet amount"
          />
          <span className="bet-symbol">{symbol}</span>
        </div>
        <button className="step-btn" onClick={() => stepBet(1)} disabled={inFlight} aria-label="Double bet">
          +
        </button>
      </div>

      {/* Balance display */}
      <div className="dock-section dock-balance">
        <span className="balance-label">Balance</span>
        <span className="balance-value">
          {balance === undefined ? '—' : formatUnits(balance, decimals)} {symbol}
        </span>
      </div>

      {/* Launch button */}
      <div className="dock-section dock-launch">
        <button
          className="launch-btn"
          onClick={onLaunch}
          disabled={!canLaunch}
        >
          {inFlight ? (
            <span className="launch-text">Launching…</span>
          ) : (
            <>
              <span className="launch-icon">🚀</span>
              <span className="launch-text">Launch</span>
            </>
          )}
        </button>
      </div>

      {/* Error / reason */}
      {reason && <p className="dock-reason">{reason}</p>}
    </div>
  );
}
