// ─────────────────────────────────────────────────────────────────────
// Web Audio API procedural sound synthesis for Ember Festival.
//
// Designed with authentic acoustic cues:
// - Sharp supersonic initial crack
// - Rich sub-bass atmospheric thump
// - Sustained crackle / brocade sizzle tails
// - Phoenix Finale: Cinematic vacuum-suck silence into thunderous boom
//
// TODO: replace these procedural sounds with high-fidelity recorded sound
//       assets in production.
// ─────────────────────────────────────────────────────────────────────

import type { TierName } from '../types/game.ts';

let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext();
  if (audioCtx.state === 'suspended') void audioCtx.resume();
  return audioCtx;
}

/** White noise buffer, cached. */
let noiseBuffer: AudioBuffer | null = null;
function getNoiseBuffer(ctx: AudioContext): AudioBuffer {
  if (noiseBuffer) return noiseBuffer;
  const length = ctx.sampleRate * 2;
  noiseBuffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  return noiseBuffer;
}

// ── Launch Whoosh ──────────────────────────────────────────────────────
// Pitch-swept bandpass noise with trailing whistle over ~0.65 s.
// TODO: replace with real whoosh sound asset
export function playLaunchWhoosh(): void {
  const ctx = getCtx();
  const now = ctx.currentTime;

  // Air rushing noise
  const noise = ctx.createBufferSource();
  noise.buffer = getNoiseBuffer(ctx);

  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.Q.value = 3.5;
  bp.frequency.setValueAtTime(180, now);
  bp.frequency.exponentialRampToValueAtTime(2800, now + 0.6);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.4, now + 0.1);
  gain.gain.linearRampToValueAtTime(0.5, now + 0.4);
  gain.gain.linearRampToValueAtTime(0, now + 0.65);

  noise.connect(bp).connect(gain).connect(ctx.destination);
  noise.start(now);
  noise.stop(now + 0.7);

  // High whistle harmonic
  const whistle = ctx.createOscillator();
  whistle.type = 'sine';
  whistle.frequency.setValueAtTime(700, now + 0.15);
  whistle.frequency.exponentialRampToValueAtTime(2200, now + 0.6);

  const whistleGain = ctx.createGain();
  whistleGain.gain.setValueAtTime(0, now);
  whistleGain.gain.setValueAtTime(0.08, now + 0.2);
  whistleGain.gain.exponentialRampToValueAtTime(0.001, now + 0.62);

  whistle.connect(whistleGain).connect(ctx.destination);
  whistle.start(now + 0.15);
  whistle.stop(now + 0.65);
}

// ── Tier-Specific Burst Sounds ─────────────────────────────────────────

/**
 * Damp dud pop with weak escaping gas hiss — Fizzle (0x).
 * Instantly conveys disappointment / miss.
 */
// TODO: replace with real fizzle sound asset
export function playFizzle(): void {
  const ctx = getCtx();
  const now = ctx.currentTime;

  // Weak hollow "plop"
  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(140, now);
  osc.frequency.exponentialRampToValueAtTime(45, now + 0.18);

  const oscGain = ctx.createGain();
  oscGain.gain.setValueAtTime(0.25, now);
  oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

  osc.connect(oscGain).connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.25);

  // Escaping smoke hiss
  const noise = ctx.createBufferSource();
  noise.buffer = getNoiseBuffer(ctx);

  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(1200, now);
  lp.frequency.exponentialRampToValueAtTime(300, now + 0.35);

  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.12, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

  noise.connect(lp).connect(noiseGain).connect(ctx.destination);
  noise.start(now);
  noise.stop(now + 0.4);
}

/** Crisp peony bloom crackle — Small Bloom. */
// TODO: replace with real crackle sound asset
export function playSmallBloom(): void {
  const ctx = getCtx();
  const now = ctx.currentTime;

  // Clean, crisp acoustic snap
  const snap = ctx.createOscillator();
  snap.type = 'sine';
  snap.frequency.setValueAtTime(600, now);
  snap.frequency.exponentialRampToValueAtTime(120, now + 0.15);

  const snapGain = ctx.createGain();
  snapGain.gain.setValueAtTime(0.35, now);
  snapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

  snap.connect(snapGain).connect(ctx.destination);
  snap.start(now);
  snap.stop(now + 0.22);

  // Subtle sparkle tail
  const noise = ctx.createBufferSource();
  noise.buffer = getNoiseBuffer(ctx);

  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 4500;

  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.15, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

  noise.connect(hp).connect(noiseGain).connect(ctx.destination);
  noise.start(now);
  noise.stop(now + 0.4);
}

/** Punchy two-tone explosion with secondary crackle — Bright Burst. */
// TODO: replace with real bright burst sound asset
export function playBrightBurst(): void {
  const ctx = getCtx();
  const now = ctx.currentTime;

  // Solid bass thud
  const thud = ctx.createOscillator();
  thud.type = 'sine';
  thud.frequency.setValueAtTime(240, now);
  thud.frequency.exponentialRampToValueAtTime(60, now + 0.3);

  const thudGain = ctx.createGain();
  thudGain.gain.setValueAtTime(0.45, now);
  thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

  thud.connect(thudGain).connect(ctx.destination);
  thud.start(now);
  thud.stop(now + 0.38);

  // Double crackle burst
  [0, 0.08].forEach((offset, idx) => {
    const noise = ctx.createBufferSource();
    noise.buffer = getNoiseBuffer(ctx);

    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 3200 + idx * 1200;
    bp.Q.value = 2.0;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.28, now + offset);
    gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.3);

    noise.connect(bp).connect(gain).connect(ctx.destination);
    noise.start(now + offset);
    noise.stop(now + offset + 0.35);
  });
}

/** Concentric ripple sequence sound — Cascade. */
// TODO: replace with real cascade sound asset
export function playCascade(): void {
  const ctx = getCtx();
  const now = ctx.currentTime;

  // 3 escalating concentric ripple pops at 0s, 0.14s, 0.28s
  const ripples = [
    { offset: 0, freq: 380, volume: 0.35, noiseFreq: 2800 },
    { offset: 0.14, freq: 300, volume: 0.42, noiseFreq: 2200 },
    { offset: 0.28, freq: 210, volume: 0.52, noiseFreq: 1600 },
  ];

  ripples.forEach((r, idx) => {
    // Tonal body pop
    const pop = ctx.createOscillator();
    pop.type = 'sine';
    pop.frequency.setValueAtTime(r.freq, now + r.offset);
    pop.frequency.exponentialRampToValueAtTime(75, now + r.offset + 0.22);

    const popGain = ctx.createGain();
    popGain.gain.setValueAtTime(r.volume, now + r.offset);
    popGain.gain.exponentialRampToValueAtTime(0.001, now + r.offset + 0.26);

    pop.connect(popGain).connect(ctx.destination);
    pop.start(now + r.offset);
    pop.stop(now + r.offset + 0.28);

    // Resonant water-like shimmer sweep
    const noise = ctx.createBufferSource();
    noise.buffer = getNoiseBuffer(ctx);

    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(r.noiseFreq, now + r.offset);
    bp.frequency.exponentialRampToValueAtTime(800, now + r.offset + 0.35);
    bp.Q.value = 2.0;

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.18 + idx * 0.06, now + r.offset);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + r.offset + 0.38);

    noise.connect(bp).connect(noiseGain).connect(ctx.destination);
    noise.start(now + r.offset);
    noise.stop(now + r.offset + 0.40);
  });
}

/**
 * Deep Kamuro bass thump + long, luxurious weeping golden sizzle — Golden Willow.
 * Rich 2+ second acoustic trail.
 */
// TODO: replace with real golden willow sound asset
export function playGoldenWillow(): void {
  const ctx = getCtx();
  const now = ctx.currentTime;

  // Deep resonant chest-thump
  const sub = ctx.createOscillator();
  sub.type = 'sine';
  sub.frequency.setValueAtTime(110, now);
  sub.frequency.exponentialRampToValueAtTime(38, now + 0.7);

  const subGain = ctx.createGain();
  subGain.gain.setValueAtTime(0.55, now);
  subGain.gain.linearRampToValueAtTime(0.3, now + 0.2);
  subGain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

  sub.connect(subGain).connect(ctx.destination);
  sub.start(now);
  sub.stop(now + 1.3);

  // Sizzling golden rain noise tail (2.5s)
  const sizzle = ctx.createBufferSource();
  sizzle.buffer = getNoiseBuffer(ctx);

  const sizzleBP = ctx.createBiquadFilter();
  sizzleBP.type = 'bandpass';
  sizzleBP.frequency.value = 5200;
  sizzleBP.Q.value = 1.2;

  const sizzleGain = ctx.createGain();
  sizzleGain.gain.setValueAtTime(0.25, now + 0.05);
  sizzleGain.gain.linearRampToValueAtTime(0.18, now + 0.8);
  sizzleGain.gain.exponentialRampToValueAtTime(0.001, now + 2.4);

  sizzle.connect(sizzleBP).connect(sizzleGain).connect(ctx.destination);
  sizzle.start(now + 0.05);
  sizzle.stop(now + 2.5);

  // Twinkling micro-crackle clusters
  for (let i = 0; i < 5; i++) {
    const t = 0.2 + i * 0.35;
    const crackle = ctx.createBufferSource();
    crackle.buffer = getNoiseBuffer(ctx);

    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 6500;

    const cGain = ctx.createGain();
    cGain.gain.setValueAtTime(0.09, now + t);
    cGain.gain.exponentialRampToValueAtTime(0.001, now + t + 0.2);

    crackle.connect(hp).connect(cGain).connect(ctx.destination);
    crackle.start(now + t);
    crackle.stop(now + t + 0.25);
  }
}

/**
 * Anticipation beat for Phoenix Finale:
 * Brief 260ms rising vacuum suction tone right before the burst triggers.
 */
// TODO: replace with real phoenix slow-mo sound asset
export function playPhoenixSlowMo(): void {
  const ctx = getCtx();
  const now = ctx.currentTime;

  // Rising vacuum sub drone over 260ms
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(80, now);
  osc.frequency.exponentialRampToValueAtTime(320, now + 0.22);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.08, now);
  gain.gain.linearRampToValueAtTime(0.42, now + 0.20);
  // Sharp cut to silence right before detonation
  gain.gain.setValueAtTime(0, now + 0.25);

  osc.connect(gain).connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.26);
}

/** Secondary escalating wave sound for Phoenix Finale at 340ms */
export function playPhoenixSecondWave(): void {
  const ctx = getCtx();
  const now = ctx.currentTime;

  // Secondary punch
  const punch = ctx.createOscillator();
  punch.type = 'sawtooth';
  punch.frequency.setValueAtTime(160, now);
  punch.frequency.exponentialRampToValueAtTime(50, now + 0.4);

  const punchGain = ctx.createGain();
  punchGain.gain.setValueAtTime(0.35, now);
  punchGain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

  punch.connect(punchGain).connect(ctx.destination);
  punch.start(now);
  punch.stop(now + 0.65);

  // Sparkling harmonic shimmer
  [880, 1318.5, 1760].forEach((freq, idx) => {
    const partial = ctx.createOscillator();
    partial.type = 'sine';
    partial.frequency.setValueAtTime(freq, now);
    partial.frequency.linearRampToValueAtTime(freq * 0.95, now + 1.8);

    const pGain = ctx.createGain();
    pGain.gain.setValueAtTime(0.07 / (idx + 1), now);
    pGain.gain.exponentialRampToValueAtTime(0.001, now + 1.8);

    partial.connect(pGain).connect(ctx.destination);
    partial.start(now);
    partial.stop(now + 1.9);
  });
}

/**
 * Screen-wide transcendent detonation for Phoenix Finale.
 * Thunderous sub-bass boom, explosive shockwave, soaring harmonic shimmer.
 */
// TODO: replace with real phoenix finale sound asset
export function playPhoenixDetonation(): void {
  const ctx = getCtx();
  const now = ctx.currentTime;

  // Massive 32 Hz sub-bass seismic impact
  const sub = ctx.createOscillator();
  sub.type = 'sine';
  sub.frequency.setValueAtTime(80, now);
  sub.frequency.exponentialRampToValueAtTime(28, now + 1.2);

  const subGain = ctx.createGain();
  subGain.gain.setValueAtTime(0.85, now);
  subGain.gain.linearRampToValueAtTime(0.5, now + 0.4);
  subGain.gain.exponentialRampToValueAtTime(0.001, now + 3.0);

  sub.connect(subGain).connect(ctx.destination);
  sub.start(now);
  sub.stop(now + 3.2);

  // Mid-range punch (sawtooth body)
  const punch = ctx.createOscillator();
  punch.type = 'sawtooth';
  punch.frequency.setValueAtTime(140, now);
  punch.frequency.exponentialRampToValueAtTime(42, now + 0.8);

  const punchGain = ctx.createGain();
  punchGain.gain.setValueAtTime(0.45, now);
  punchGain.gain.exponentialRampToValueAtTime(0.001, now + 1.4);

  punch.connect(punchGain).connect(ctx.destination);
  punch.start(now);
  punch.stop(now + 1.5);

  // Explosive blast noise with wide dispersion
  const blast = ctx.createBufferSource();
  blast.buffer = getNoiseBuffer(ctx);

  const blastBP = ctx.createBiquadFilter();
  blastBP.type = 'bandpass';
  blastBP.frequency.value = 1800;
  blastBP.Q.value = 0.8;

  const blastGain = ctx.createGain();
  blastGain.gain.setValueAtTime(0.6, now);
  blastGain.gain.exponentialRampToValueAtTime(0.001, now + 2.5);

  blast.connect(blastBP).connect(blastGain).connect(ctx.destination);
  blast.start(now);
  blast.stop(now + 2.6);

  // Soaring triumphant harmonics (Phoenix song shimmer)
  const chords = [523.25, 659.25, 783.99, 1046.5, 1318.5]; // C Major majestic
  chords.forEach((freq, idx) => {
    const partial = ctx.createOscillator();
    partial.type = 'sine';
    partial.frequency.setValueAtTime(freq, now + 0.05);
    partial.frequency.linearRampToValueAtTime(freq * 0.98, now + 3.2);

    const pGain = ctx.createGain();
    const vol = 0.09 / (idx * 0.4 + 1);
    pGain.gain.setValueAtTime(0, now);
    pGain.gain.setValueAtTime(vol, now + 0.08);
    pGain.gain.exponentialRampToValueAtTime(0.001, now + 3.2);

    partial.connect(pGain).connect(ctx.destination);
    partial.start(now + 0.05);
    partial.stop(now + 3.3);
  });
}

// ── Public API ─────────────────────────────────────────────────────────

/** Play the burst sound for the given tier. */
export function playTierSound(tier: TierName): void {
  switch (tier) {
    case 'Fizzle':
      playFizzle();
      break;
    case 'Small Bloom':
      playSmallBloom();
      break;
    case 'Bright Burst':
      playBrightBurst();
      break;
    case 'Cascade':
      playCascade();
      break;
    case 'Golden Willow':
      playGoldenWillow();
      break;
    case 'Phoenix Finale':
      playPhoenixDetonation();
      break;
  }
}
