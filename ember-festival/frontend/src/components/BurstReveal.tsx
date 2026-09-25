/* ─────────────────────────────────────────────────────────────────────
 * BurstReveal — Painterly Canvas Firework Engine for Ember Festival.
 *
 * Tier Specifications:
 * - Fizzle: Charcoal ink smoke dud with weak escaping ember
 * - Small Bloom: Harmonious single-tone apricot peony
 * - Bright Burst: High-contrast two-tone (fuchsia + chartreuse) chrysanthemum
 * - Cascade: ONE anchored parent burst with 3 branching daughter shells
 *            radiating outward and popping a beat later into cascading waterfalls
 * - Golden Willow: Brocade Kamuro weeping willow tree shape — golden strands
 *                  arc outward then drift DOWNWARD slowly with ~14% screen-dim
 * - Phoenix Finale: 260ms slow-mo hesitation beat with rising tone, massive
 *                   bloom radius, full-screen opacity flash pulse, escalating
 *                   secondary wave at 340ms, and edge-to-edge Phoenix comets
 * ─────────────────────────────────────────────────────────────────── */

import { useEffect, useRef, useCallback } from 'react';
import type { BetConfigName, TierName } from '../types/game.ts';
import {
  playLaunchWhoosh,
  playTierSound,
  playPhoenixSlowMo,
  playPhoenixDetonation,
  playPhoenixSecondWave,
} from '../utils/audio.ts';

// ── Particle Data Structures ──────────────────────────────────────────

/** Primary elongated brush-dab spark */
type BrushSpark = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  coreColor: string;
  alpha: number;
  age: number;
  lifetime: number;
  drag: number;
  gravity: number;
  wobbleFreq: number;
  wobblePhase: number;
  wobbleAmp: number;
  trailRate: number;
};

/** Weeping continuous filament ribbon (Kamuro willow) */
type WillowRibbon = {
  history: Array<{ x: number; y: number; alpha: number }>;
  maxHistory: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  age: number;
  lifetime: number;
  gravity: number;
  drag: number;
  swayFreq: number;
  swayPhase: number;
  swayAmp: number;
  twinkleTimer: number;
};

/** Radiating daughter star branching from the anchored main Cascade burst */
type CascadeBranch = {
  startX: number;
  startY: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  coreColor: string;
  age: number;
  detonateDelay: number;
  exploded: boolean;
};

/** Expanding watercolor / charcoal smoke puff (Fizzle) */
type InkSmokePuff = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  maxRadius: number;
  color: string;
  alpha: number;
  age: number;
  lifetime: number;
  rotation: number;
  rotationSpeed: number;
};

/** Flying Phoenix wing comet that explodes into secondary blooms */
type PhoenixComet = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  age: number;
  lifetime: number;
  exploded: boolean;
};

/** Tiny flickering ember / falling glitter star */
type GlitterStar = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  alpha: number;
  twinkleSpeed: number;
  twinklePhase: number;
  decay: number;
};

// ── Tier Configuration ────────────────────────────────────────────────

type TierConfig = {
  screenDim: number;
  slowMoDuration: number;
  shakeDuration: number;
  flashDuration: number;
};

const TIER_CONFIGS: Record<TierName, TierConfig> = {
  'Fizzle': {
    screenDim: 0,
    slowMoDuration: 0,
    shakeDuration: 0,
    flashDuration: 0,
  },
  'Small Bloom': {
    screenDim: 0.05,
    slowMoDuration: 0,
    shakeDuration: 0,
    flashDuration: 0.08,
  },
  'Bright Burst': {
    screenDim: 0.10,
    slowMoDuration: 0,
    shakeDuration: 0,
    flashDuration: 0.12,
  },
  'Cascade': {
    screenDim: 0.15,
    slowMoDuration: 0,
    shakeDuration: 0,
    flashDuration: 0.16,
  },
  'Golden Willow': {
    screenDim: 0.14, // ~10-15% screen dim so golden strands pop against dark frame
    slowMoDuration: 0,
    shakeDuration: 0,
    flashDuration: 0.16,
  },
  'Phoenix Finale': {
    screenDim: 0.70,
    slowMoDuration: 0.26, // 260ms hesitation beat with rising tone
    shakeDuration: 0.45,
    flashDuration: 0.22, // brief opacity pulse, not blinding
  },
};

// ── Animation State ───────────────────────────────────────────────────

type AnimPhase = 'idle' | 'launch' | 'slowmo' | 'burst' | 'done';

type EngineState = {
  phase: AnimPhase;
  phaseStart: number;
  tier: TierName;
  rocketX: number;
  rocketY: number;
  rocketTargetY: number;
  rocketSpeed: number;
  sparks: BrushSpark[];
  willows: WillowRibbon[];
  cascadeBranches: CascadeBranch[];
  smokePuffs: InkSmokePuff[];
  comets: PhoenixComet[];
  glitters: GlitterStar[];
  dimAlpha: number;
  flashAlpha: number;
  shakeTime: number;
  shakeIntensity: number;
  soundPlayed: boolean;
  secondaryWaveFired: boolean;
  burstOriginX: number;
  burstOriginY: number;
};

export type BurstRevealProps = {
  tier: TierName | undefined;
  onAnimationDone: () => void;
  soundEnabled: boolean;
  configName?: BetConfigName;
};

// ── Color Interpolation Helpers ───────────────────────────────────────
function lerpVal(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function lerpColor(c1: [number, number, number], c2: [number, number, number], t: number): string {
  const r = Math.round(c1[0] + (c2[0] - c1[0]) * t);
  const g = Math.round(c1[1] + (c2[1] - c1[1]) * t);
  const b = Math.round(c1[2] + (c2[2] - c1[2]) * t);
  return `rgb(${r}, ${g}, ${b})`;
}

export function BurstReveal({
  tier,
  onAnimationDone,
  soundEnabled,
  configName = 'calm-night',
}: BurstRevealProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<EngineState | null>(null);
  const rafRef = useRef<number>(0);
  const onDoneRef = useRef(onAnimationDone);
  onDoneRef.current = onAnimationDone;

  // Mode transition state (0 = calm-night, 1 = meteor-shower)
  const targetMode = configName === 'meteor-shower' ? 1 : 0;
  const modeTransitionRef = useRef(targetMode);
  const targetModeRef = useRef(targetMode);
  targetModeRef.current = targetMode;

  // Active launch/burst ambient fade factor (1 = idle ambient visible, 0 = hidden during burst)
  const ambientFadeRef = useRef(1.0);

  // Tiered ambient meteors for Meteor Shower mode
  type AmbientMeteor = {
    x: number;
    y: number;
    vx: number;
    vy: number;
    length: number;
    width: number;
    age: number;
    lifetime: number;
    color: string;
    coreColor: string;
    rarity: 'common' | 'uncommon' | 'rare';
  };
  const meteorsRef = useRef<AmbientMeteor[]>([]);
  const meteorTimerRef = useRef(1.2 + Math.random() * 2.0);

  // Starfield backdrop with drift
  type AmbientStar = {
    baseX: number;
    baseY: number;
    r: number;
    a: number;
    pulseSpeed: number;
    driftVx: number;
    driftVy: number;
  };
  const starsRef = useRef<AmbientStar[]>([]);

  const initStars = useCallback((w: number, h: number) => {
    const stars: AmbientStar[] = [];
    for (let i = 0; i < 180; i++) {
      stars.push({
        baseX: Math.random() * w,
        baseY: Math.random() * h * 0.88,
        r: Math.random() * 1.4 + 0.35,
        a: Math.random() * 0.55 + 0.25,
        pulseSpeed: 1.5 + Math.random() * 3.5,
        driftVx: (Math.random() - 0.5) * 2.8,
        driftVy: (Math.random() - 0.5) * 0.9,
      });
    }
    starsRef.current = stars;
  }, []);

  // ── Painterly Rendering Helpers ─────────────────────────────────────

  /**
   * Renders a calligraphic, elongated watercolor/ink brush stroke.
   * Aligns with velocity vector, stretching and tapering organically.
   */
  const drawBrushStroke = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      x: number,
      y: number,
      vx: number,
      vy: number,
      radius: number,
      color: string,
      coreColor: string,
      alpha: number,
    ) => {
      const speed = Math.hypot(vx, vy);
      const angle = Math.atan2(vy, vx);
      const stretch = Math.min(1 + speed * 0.018, 3.8);

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.scale(stretch, 1);

      // Outer soft feathered bleed
      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
      grad.addColorStop(0, coreColor.replace(')', `, ${alpha * 0.95})`).replace('hsl', 'hsla'));
      grad.addColorStop(0.35, color.replace(')', `, ${alpha * 0.75})`).replace('hsl', 'hsla'));
      grad.addColorStop(0.7, color.replace(')', `, ${alpha * 0.25})`).replace('hsl', 'hsla'));
      grad.addColorStop(1, 'transparent');

      ctx.beginPath();
      ctx.ellipse(0, 0, radius, radius * 0.65, 0, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();

      // Incandescent core spark
      if (alpha > 0.4) {
        ctx.beginPath();
        ctx.arc(radius * 0.2, 0, radius * 0.35, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.85})`;
        ctx.fill();
      }

      ctx.restore();
    },
    [],
  );

  /**
   * Renders a weeping golden willow filament ribbon with continuous history.
   */
  const drawWillowRibbon = useCallback(
    (ctx: CanvasRenderingContext2D, ribbon: WillowRibbon) => {
      const pts = ribbon.history;
      if (pts.length < 2) return;

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);

      for (let i = 1; i < pts.length; i++) {
        const xc = (pts[i - 1].x + pts[i].x) / 2;
        const yc = (pts[i - 1].y + pts[i].y) / 2;
        ctx.quadraticCurveTo(pts[i - 1].x, pts[i - 1].y, xc, yc);
      }

      const life = 1 - ribbon.age / ribbon.lifetime;
      const headAlpha = Math.max(0, life * 0.9);

      ctx.strokeStyle = ribbon.color.replace(')', `, ${headAlpha})`).replace('hsl', 'hsla');
      ctx.lineWidth = Math.max(0.7, ribbon.radius * life);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();

      // Sparkling head bead
      if (life > 0.15) {
        ctx.beginPath();
        ctx.arc(pts[0].x, pts[0].y, ribbon.radius * 0.85 * life, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 250, 215, ${headAlpha})`;
        ctx.fill();
      }

      ctx.restore();
    },
    [],
  );

  /**
   * Renders organic calligraphy smoke clouds for Fizzle duds.
   */
  const drawSmokePuff = useCallback((ctx: CanvasRenderingContext2D, puff: InkSmokePuff) => {
    ctx.save();
    ctx.translate(puff.x, puff.y);
    ctx.rotate(puff.rotation);

    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, puff.radius);
    grad.addColorStop(0, puff.color.replace(')', `, ${puff.alpha * 0.65})`).replace('hsl', 'hsla'));
    grad.addColorStop(0.45, puff.color.replace(')', `, ${puff.alpha * 0.35})`).replace('hsl', 'hsla'));
    grad.addColorStop(0.8, puff.color.replace(')', `, ${puff.alpha * 0.1})`).replace('hsl', 'hsla'));
    grad.addColorStop(1, 'transparent');

    ctx.beginPath();
    ctx.ellipse(0, 0, puff.radius, puff.radius * 0.75, 0, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.restore();
  }, []);

  // ── Tier Spawners ───────────────────────────────────────────────────

  const spawnFizzle = useCallback((cx: number, cy: number): Partial<EngineState> => {
    const smokePuffs: InkSmokePuff[] = [];
    const colors = [
      'hsl(28, 12%, 25%)',
      'hsl(32, 18%, 32%)',
      'hsl(20, 10%, 20%)',
      'hsl(35, 14%, 28%)',
    ];

    for (let i = 0; i < 7; i++) {
      const angle = (Math.PI * 2 * i) / 7 + (Math.random() - 0.5) * 0.6;
      const speed = 12 + Math.random() * 22;
      smokePuffs.push({
        x: cx + (Math.random() - 0.5) * 10,
        y: cy + (Math.random() - 0.5) * 10,
        vx: Math.cos(angle) * speed + 8,
        vy: Math.sin(angle) * speed - 15,
        radius: 12 + Math.random() * 8,
        maxRadius: 40 + Math.random() * 25,
        color: colors[i % colors.length],
        alpha: 0.7,
        age: 0,
        lifetime: 0.85 + Math.random() * 0.4,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.8,
      });
    }

    const glitters: GlitterStar[] = [];
    for (let i = 0; i < 6; i++) {
      glitters.push({
        x: cx + (Math.random() - 0.5) * 8,
        y: cy + (Math.random() - 0.5) * 8,
        vx: (Math.random() - 0.5) * 35,
        vy: 10 + Math.random() * 45,
        radius: 1.8 + Math.random() * 1.5,
        color: 'hsl(18, 70%, 45%)',
        alpha: 0.8,
        twinkleSpeed: 4,
        twinklePhase: Math.random() * Math.PI,
        decay: 2.2,
      });
    }

    return { smokePuffs, glitters, sparks: [], willows: [], comets: [], cascadeBranches: [] };
  }, []);

  const spawnSmallBloom = useCallback((cx: number, cy: number): Partial<EngineState> => {
    const sparks: BrushSpark[] = [];
    const count = 42;
    const colors = [
      { body: 'hsl(16, 92%, 60%)', core: 'hsl(35, 100%, 75%)' },
      { body: 'hsl(28, 95%, 62%)', core: 'hsl(45, 100%, 80%)' },
      { body: 'hsl(350, 85%, 66%)', core: 'hsl(25, 100%, 78%)' },
    ];

    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.2;
      const speed = 75 + Math.random() * 85;
      const col = colors[i % colors.length];

      sparks.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: 5 + Math.random() * 2.5,
        color: col.body,
        coreColor: col.core,
        alpha: 1,
        age: 0,
        lifetime: 0.85 + Math.random() * 0.3,
        drag: 0.94,
        gravity: 36,
        wobbleFreq: 6,
        wobblePhase: Math.random() * Math.PI * 2,
        wobbleAmp: 14,
        trailRate: 0.2,
      });
    }

    return { sparks, willows: [], smokePuffs: [], comets: [], glitters: [], cascadeBranches: [] };
  }, []);

  const spawnBrightBurst = useCallback((cx: number, cy: number): Partial<EngineState> => {
    const sparks: BrushSpark[] = [];
    const outerCount = 60;
    const outerColors = [
      { body: 'hsl(322, 90%, 60%)', core: 'hsl(335, 100%, 75%)' },
      { body: 'hsl(280, 88%, 65%)', core: 'hsl(300, 100%, 80%)' },
      { body: 'hsl(340, 92%, 58%)', core: 'hsl(350, 100%, 75%)' },
    ];

    for (let i = 0; i < outerCount; i++) {
      const angle = (Math.PI * 2 * i) / outerCount + (Math.random() - 0.5) * 0.18;
      const speed = 120 + Math.random() * 95;
      const col = outerColors[i % outerColors.length];

      sparks.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: 6.5 + Math.random() * 2.5,
        color: col.body,
        coreColor: col.core,
        alpha: 1,
        age: 0,
        lifetime: 1.15 + Math.random() * 0.35,
        drag: 0.95,
        gravity: 32,
        wobbleFreq: 8,
        wobblePhase: Math.random() * Math.PI * 2,
        wobbleAmp: 22,
        trailRate: 0.3,
      });
    }

    const innerCount = 30;
    const innerColors = [
      { body: 'hsl(145, 92%, 62%)', core: 'hsl(80, 100%, 85%)' },
      { body: 'hsl(50, 100%, 65%)', core: 'hsl(60, 100%, 90%)' },
    ];

    for (let i = 0; i < innerCount; i++) {
      const angle = (Math.PI * 2 * i) / innerCount + (Math.random() - 0.5) * 0.25;
      const speed = 40 + Math.random() * 45;
      const col = innerColors[i % innerColors.length];

      sparks.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: 5 + Math.random() * 2,
        color: col.body,
        coreColor: col.core,
        alpha: 1,
        age: 0,
        lifetime: 1.35 + Math.random() * 0.25,
        drag: 0.93,
        gravity: 24,
        wobbleFreq: 5,
        wobblePhase: Math.random() * Math.PI * 2,
        wobbleAmp: 10,
        trailRate: 0.4,
      });
    }

    return { sparks, willows: [], smokePuffs: [], comets: [], glitters: [], cascadeBranches: [] };
  }, []);

  /**
   * 1. CASCADE — Concentric ripple expansion:
   * 3 concentric bloom rings expanding outward from the SAME center point in sequence
   * (Ring 1 at T=0, Ring 2 slightly larger at T=+140ms, Ring 3 largest and last at T=+280ms).
   * Noticeably larger max radius, more particles, longer duration than Bright Burst.
   */
  const spawnCascade = useCallback((cx: number, cy: number): Partial<EngineState> => {
    const sparks: BrushSpark[] = [];
    const glitters: GlitterStar[] = [];

    // Ring 1: Inner core ripple (T = 0ms) — 36 particles, compact core
    const r1Count = 36;
    for (let i = 0; i < r1Count; i++) {
      const angle = (Math.PI * 2 * i) / r1Count + (Math.random() - 0.5) * 0.15;
      const speed = 90 + Math.random() * 35;
      sparks.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: 5.5 + Math.random() * 2,
        color: 'hsl(175, 95%, 68%)',
        coreColor: 'hsl(180, 100%, 96%)',
        alpha: 1,
        age: 0,
        lifetime: 1.6 + Math.random() * 0.3,
        drag: 0.955,
        gravity: 28,
        wobbleFreq: 6,
        wobblePhase: Math.random() * Math.PI * 2,
        wobbleAmp: 14,
        trailRate: 0.35,
      });
    }

    // Ring 2: Mid ripple (T = +140ms, expanding noticeably larger) — 54 particles
    const r2Count = 54;
    for (let i = 0; i < r2Count; i++) {
      const angle = (Math.PI * 2 * i) / r2Count + (Math.random() - 0.5) * 0.18;
      const speed = 155 + Math.random() * 45;
      sparks.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: 6.5 + Math.random() * 2.5,
        color: 'hsl(196, 96%, 64%)',
        coreColor: 'hsl(210, 100%, 94%)',
        alpha: 1,
        age: -0.14, // triggers a beat later from the same center point
        lifetime: 1.8 + Math.random() * 0.35,
        drag: 0.96,
        gravity: 30,
        wobbleFreq: 6,
        wobblePhase: Math.random() * Math.PI * 2,
        wobbleAmp: 18,
        trailRate: 0.4,
      });
    }

    // Ring 3: Outermost mega ripple (T = +280ms, largest and last!) — 76 particles
    const r3Count = 76;
    for (let i = 0; i < r3Count; i++) {
      const angle = (Math.PI * 2 * i) / r3Count + (Math.random() - 0.5) * 0.2;
      const speed = 220 + Math.random() * 55; // huge max radius!
      sparks.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: 7.5 + Math.random() * 3,
        color: 'hsl(265, 95%, 75%)',
        coreColor: 'hsl(185, 100%, 92%)',
        alpha: 1,
        age: -0.28, // largest and last ripple
        lifetime: 2.1 + Math.random() * 0.4,
        drag: 0.965,
        gravity: 32,
        wobbleFreq: 7,
        wobblePhase: Math.random() * Math.PI * 2,
        wobbleAmp: 22,
        trailRate: 0.45,
      });
    }

    return { sparks, willows: [], smokePuffs: [], comets: [], glitters, cascadeBranches: [] };
  }, []);

  /**
   * 2. GOLDEN WILLOW — Organic weeping willow tree shape:
   * - Strand lengths VARY randomly (some short, some medium, some very long)
   * - Arcs outward then falls DOWNWARD under gentle accelerating gravity with subtle sway
   * - Lingering duration 2-3x longer than Bright Burst (~3.2s - 4.5s)
   * - Background dims ~15% for the duration so strands pop against dark frame
   */
  const spawnGoldenWillow = useCallback((cx: number, cy: number): Partial<EngineState> => {
    const willows: WillowRibbon[] = [];
    const glitters: GlitterStar[] = [];
    const count = 92;
    const goldColors = [
      'hsl(43, 100%, 64%)',
      'hsl(38, 96%, 54%)',
      'hsl(48, 100%, 78%)',
      'hsl(28, 92%, 46%)',
    ];

    for (let i = 0; i < count; i++) {
      // Wide canopy dome: angles span from ~-20° below horizontal-right
      // through top to ~-20° below horizontal-left for a broad umbrella shape
      const angle = -0.35 + ((Math.PI + 0.70) * i) / count + (Math.random() - 0.5) * 0.28;

      // STRAND LENGTH VARIATION: randomize speeds and lifetimes widely!
      // ~30% short inner strands, ~40% medium strands, ~30% long weeping strands
      const randTier = Math.random();
      let speed: number;
      let lifetime: number;
      let maxHistory: number;
      let radius: number;

      if (randTier < 0.3) {
        // Short inner strand — still wide-flung
        speed = 100 + Math.random() * 50;
        lifetime = 2.6 + Math.random() * 0.5;
        maxHistory = 16 + Math.floor(Math.random() * 6);
        radius = 2.2 + Math.random() * 0.8;
      } else if (randTier < 0.7) {
        // Medium arching strand — generous reach
        speed = 160 + Math.random() * 50;
        lifetime = 3.4 + Math.random() * 0.6;
        maxHistory = 24 + Math.floor(Math.random() * 8);
        radius = 2.8 + Math.random() * 1.0;
      } else {
        // Long cascading weeping strand — reaches far out and down!
        speed = 220 + Math.random() * 60;
        lifetime = 4.2 + Math.random() * 0.6;
        maxHistory = 34 + Math.floor(Math.random() * 12);
        radius = 3.4 + Math.random() * 1.2;
      }

      const vx = Math.cos(angle) * speed;
      // Mild upward impulse — just enough lift so strands arc then fall
      const vy = -Math.sin(angle) * speed * 0.55 - (8 + Math.random() * 12);

      willows.push({
        history: [{ x: cx, y: cy, alpha: 1 }],
        maxHistory,
        vx,
        vy,
        radius,
        color: goldColors[i % goldColors.length],
        age: 0,
        lifetime,
        gravity: 32, // softer pull for graceful arcs before weeping down
        drag: 0.975, // relaxed drag — strands spread far outward before falling
        swayFreq: 3 + Math.random() * 3,
        swayPhase: Math.random() * Math.PI * 2,
        swayAmp: 14 + Math.random() * 12,
        twinkleTimer: Math.random() * 0.3,
      });
    }

    return { willows, sparks: [], smokePuffs: [], comets: [], cascadeBranches: [], glitters };
  }, []);

  /**
   * 3. PHOENIX FINALE — Top prize transcendent moment:
   * 260ms hesitation beat, noticeably larger bloom radius, escalating 2nd wave
   * at 340ms, full-screen opacity pulse flash, and sweeping Phoenix comets.
   */
  const spawnPhoenixFinale = useCallback((cx: number, cy: number, w: number, h: number): Partial<EngineState> => {
    const sparks: BrushSpark[] = [];
    const willows: WillowRibbon[] = [];
    const comets: PhoenixComet[] = [];
    const glitters: GlitterStar[] = [];

    // Wave 1: Central blazing solar explosion (160 high-velocity sparks, massive bloom radius)
    const centralCount = 160;
    const centralColors = [
      { body: 'hsl(5, 96%, 58%)', core: 'hsl(48, 100%, 96%)' },   // solar vermilion
      { body: 'hsl(42, 100%, 64%)', core: 'hsl(52, 100%, 94%)' }, // 24k gold
      { body: 'hsl(348, 95%, 55%)', core: 'hsl(30, 100%, 88%)' }, // ruby crimson
      { body: 'hsl(278, 92%, 70%)', core: 'hsl(290, 100%, 95%)' },// celestial violet
    ];

    for (let i = 0; i < centralCount; i++) {
      const angle = (Math.PI * 2 * i) / centralCount + (Math.random() - 0.5) * 0.25;
      // Noticeably larger bloom radius: speeds up to 260px/s!
      const speed = 140 + Math.random() * 220;
      const col = centralColors[i % centralColors.length];

      sparks.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: 8 + Math.random() * 4.5,
        color: col.body,
        coreColor: col.core,
        alpha: 1,
        age: 0,
        lifetime: 2.4 + Math.random() * 0.8,
        drag: 0.968,
        gravity: 22,
        wobbleFreq: 7,
        wobblePhase: Math.random() * Math.PI * 2,
        wobbleAmp: 28,
        trailRate: 0.45,
      });
    }

    // 8 Phoenix Wing Comets sweeping across to screen edges
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8 + Math.PI / 8;
      const speed = Math.min(w, h) * 0.72; // edge-to-edge sweep
      comets.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: i % 2 === 0 ? 'hsl(45, 100%, 65%)' : 'hsl(8, 98%, 62%)',
        age: 0,
        lifetime: 0.48,
        exploded: false,
      });
    }

    // Sky-wide drifting ember rain
    for (let i = 0; i < 90; i++) {
      glitters.push({
        x: Math.random() * w,
        y: cy - 120 + Math.random() * 240,
        vx: (Math.random() - 0.5) * 45,
        vy: 15 + Math.random() * 40,
        radius: 1.6 + Math.random() * 2.2,
        color: 'hsl(46, 100%, 78%)',
        alpha: 0.92,
        twinkleSpeed: 5 + Math.random() * 6,
        twinklePhase: Math.random() * Math.PI * 2,
        decay: 0.32 + Math.random() * 0.25,
      });
    }

    return {
      sparks,
      willows,
      comets,
      cascadeBranches: [],
      glitters,
      smokePuffs: [],
      secondaryWaveFired: false,
      burstOriginX: cx,
      burstOriginY: cy,
    };
  }, []);

  // ── Spawn Tier Handler ──────────────────────────────────────────────

  const triggerBurst = useCallback(
    (tierName: TierName, cx: number, cy: number, w: number, h: number) => {
      const anim = engineRef.current;
      if (!anim) return;

      const cfg = TIER_CONFIGS[tierName];
      anim.phase = 'burst';
      anim.phaseStart = performance.now();
      anim.flashAlpha = cfg.flashDuration > 0 ? (tierName === 'Phoenix Finale' ? 0.55 : 0.8) : 0;
      anim.shakeTime = cfg.shakeDuration;
      anim.shakeIntensity = cfg.shakeDuration > 0 ? 12 : 0;

      let result: Partial<EngineState> = {};
      switch (tierName) {
        case 'Fizzle':
          result = spawnFizzle(cx, cy);
          break;
        case 'Small Bloom':
          result = spawnSmallBloom(cx, cy);
          break;
        case 'Bright Burst':
          result = spawnBrightBurst(cx, cy);
          break;
        case 'Cascade':
          result = spawnCascade(cx, cy);
          break;
        case 'Golden Willow':
          result = spawnGoldenWillow(cx, cy);
          break;
        case 'Phoenix Finale':
          result = spawnPhoenixFinale(cx, cy, w, h);
          break;
      }

      Object.assign(anim, result);

      if (soundEnabled) {
        if (tierName === 'Phoenix Finale') {
          playPhoenixDetonation();
        } else {
          playTierSound(tierName);
        }
      }
    },
    [
      spawnFizzle,
      spawnSmallBloom,
      spawnBrightBurst,
      spawnCascade,
      spawnGoldenWillow,
      spawnPhoenixFinale,
      soundEnabled,
    ],
  );

  // ── Initiate on `tier` prop change ──────────────────────────────────

  useEffect(() => {
    if (!tier) {
      engineRef.current = null;
      return;
    }

    const cfg = TIER_CONFIGS[tier];
    engineRef.current = {
      phase: 'launch',
      phaseStart: performance.now(),
      tier,
      rocketX: 0.5,
      rocketY: 1.05,
      rocketTargetY: tier === 'Phoenix Finale' ? 0.38 : 0.32 + Math.random() * 0.12,
      rocketSpeed: tier === 'Phoenix Finale' ? 1.25 : 1.35,
      sparks: [],
      willows: [],
      cascadeBranches: [],
      smokePuffs: [],
      comets: [],
      glitters: [],
      dimAlpha: 0,
      flashAlpha: 0,
      shakeTime: 0,
      shakeIntensity: 0,
      soundPlayed: false,
      secondaryWaveFired: false,
      burstOriginX: 0,
      burstOriginY: 0,
    };

    if (soundEnabled) {
      playLaunchWhoosh();
    }
  }, [tier, soundEnabled]);

  // ── Main Render & Physics Loop ──────────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      const rw = rect.width || window.innerWidth;
      const rh = rect.height || window.innerHeight;
      canvas.width = rw * dpr;
      canvas.height = rh * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (starsRef.current.length === 0 && rw > 0) initStars(rw, rh);
    };
    resize();
    window.addEventListener('resize', resize);

    let last = performance.now();

    const loop = (now: number) => {
      rafRef.current = requestAnimationFrame(loop);
      const dt = Math.min((now - last) / 1000, 0.04);
      last = now;

      const rect = canvas.getBoundingClientRect();
      const w = rect.width || window.innerWidth;
      const h = rect.height || window.innerHeight;
      if (w <= 0 || h <= 0) return;

      if (starsRef.current.length === 0) {
        initStars(w, h);
      }

      const anim = engineRef.current;

      // ── Handle Screen Shake ──────────────────────────────────────────
      ctx.save();
      if (anim && anim.shakeTime > 0) {
        anim.shakeTime -= dt;
        const currentIntensity = anim.shakeIntensity * (anim.shakeTime / 0.45);
        const sx = (Math.random() - 0.5) * currentIntensity * 2;
        const sy = (Math.random() - 0.5) * currentIntensity * 2;
        ctx.translate(sx, sy);
      }

      // ── Mode Transition Crossfade (smooth 300-500ms ease) ───────────
      const targetM = targetModeRef.current;
      const modeDiff = targetM - modeTransitionRef.current;
      modeTransitionRef.current += modeDiff * Math.min(dt * 5.0, 1.0);
      const mode = Math.max(0, Math.min(1, modeTransitionRef.current));

      // ── Draw Night Sky Background ────────────────────────────────────
      // Calm Night (deep indigo/violet) vs Meteor Shower (charged deep crimson-amber-violet)
      const stop0 = lerpColor([3, 5, 14], [14, 3, 16], mode);
      const stop1 = lerpColor([8, 11, 32], [26, 8, 28], mode);
      const stop2 = lerpColor([14, 18, 52], [42, 12, 34], mode);
      const stop3 = lerpColor([24, 18, 48], [54, 18, 30], mode);

      const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
      skyGrad.addColorStop(0, stop0);
      skyGrad.addColorStop(0.5, stop1);
      skyGrad.addColorStop(0.85, stop2);
      skyGrad.addColorStop(1, stop3);
      ctx.fillStyle = skyGrad;
      ctx.fillRect(-20, -20, w + 40, h + 40);

      // ── Faint Distant Cloud Wisps (drifting smoothly across upper sky) ─
      const cloudLayers = [
        {
          yRatio: 0.18,
          width: 520,
          height: 60,
          speed: 8.5,
          calmColor: 'rgba(95, 75, 160, 0.085)',
          meteorColor: 'rgba(175, 60, 90, 0.11)',
        },
        {
          yRatio: 0.32,
          width: 620,
          height: 75,
          speed: 13.0,
          calmColor: 'rgba(75, 60, 135, 0.07)',
          meteorColor: 'rgba(155, 50, 80, 0.095)',
        },
      ];
      for (const cloud of cloudLayers) {
        const cycle = w + cloud.width * 2;
        const cloudX = ((now * 0.001 * cloud.speed) % cycle) - cloud.width;
        const cloudY = h * cloud.yRatio;

        const cloudGrad = ctx.createRadialGradient(
          cloudX,
          cloudY,
          0,
          cloudX,
          cloudY,
          cloud.width * 0.5,
        );
        const cloudCol = mode < 0.5 ? cloud.calmColor : cloud.meteorColor;
        cloudGrad.addColorStop(0, cloudCol);
        cloudGrad.addColorStop(0.55, cloudCol);
        cloudGrad.addColorStop(1, 'transparent');

        ctx.save();
        ctx.fillStyle = cloudGrad;
        ctx.beginPath();
        ctx.ellipse(cloudX, cloudY, cloud.width * 0.5, cloud.height, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // ── Starfield with subtle twinkle & slow parallax drift ──────────
      const starDim = anim ? anim.dimAlpha * 0.8 : 0;
      for (const star of starsRef.current) {
        const pulse = 0.6 + Math.sin(now * 0.0025 * star.pulseSpeed) * 0.4;
        const effectiveAlpha = Math.max(0, star.a * pulse - starDim);
        if (effectiveAlpha <= 0) continue;

        let sx = (star.baseX + star.driftVx * (now * 0.001)) % w;
        if (sx < 0) sx += w;
        let sy = (star.baseY + star.driftVy * (now * 0.001)) % (h * 0.88);
        if (sy < 0) sy += h * 0.88;

        ctx.beginPath();
        ctx.arc(sx, sy, star.r, 0, Math.PI * 2);
        const starR = Math.round(lerpVal(220, 255, mode));
        const starG = Math.round(lerpVal(235, 230, mode));
        const starB = Math.round(lerpVal(255, 210, mode));
        ctx.fillStyle = `rgba(${starR}, ${starG}, ${starB}, ${effectiveAlpha})`;
        ctx.fill();
      }

      // ── Active Launch/Burst Ambient Fade ────────────────────────────
      const isBurstActive = anim && anim.phase !== 'idle' && anim.phase !== 'done';
      const targetAmbientFade = isBurstActive ? 0.0 : 1.0;
      ambientFadeRef.current += (targetAmbientFade - ambientFadeRef.current) * Math.min(dt * 6.0, 1.0);
      const ambientFade = ambientFadeRef.current;

      // ── Calm Night: Soft Atmospheric Moon (upper sky, serene breathing halo) ──
      const moonAlpha = (1 - mode) * ambientFade;
      if (moonAlpha > 0.01) {
        const moonX = w * 0.17;
        const moonY = h * 0.16;
        const moonRadius = Math.max(14, Math.min(22, w * 0.024));
        const moonPulse = 0.93 + Math.sin(now * 0.000628) * 0.07; // 10s subtle breath cycle

        ctx.save();
        // Outer soft atmospheric halo
        const moonHalo = ctx.createRadialGradient(
          moonX,
          moonY,
          moonRadius * 0.6,
          moonX,
          moonY,
          moonRadius * 4.2 * moonPulse,
        );
        moonHalo.addColorStop(0, `rgba(240, 235, 255, ${0.18 * moonAlpha * moonPulse})`);
        moonHalo.addColorStop(0.35, `rgba(180, 160, 245, ${0.08 * moonAlpha * moonPulse})`);
        moonHalo.addColorStop(0.7, `rgba(110, 80, 200, ${0.025 * moonAlpha})`);
        moonHalo.addColorStop(1, 'transparent');

        ctx.fillStyle = moonHalo;
        ctx.beginPath();
        ctx.arc(moonX, moonY, moonRadius * 4.2 * moonPulse, 0, Math.PI * 2);
        ctx.fill();

        // Inner soft luminous moon disk
        const moonDisk = ctx.createRadialGradient(
          moonX - moonRadius * 0.28,
          moonY - moonRadius * 0.28,
          moonRadius * 0.1,
          moonX,
          moonY,
          moonRadius,
        );
        moonDisk.addColorStop(0, `rgba(255, 252, 242, ${0.94 * moonAlpha})`);
        moonDisk.addColorStop(0.65, `rgba(242, 236, 218, ${0.88 * moonAlpha})`);
        moonDisk.addColorStop(1, `rgba(215, 200, 185, ${0.65 * moonAlpha})`);

        ctx.fillStyle = moonDisk;
        ctx.beginPath();
        ctx.arc(moonX, moonY, moonRadius, 0, Math.PI * 2);
        ctx.fill();

        // Soft subtle crescent/limb shadow for organic depth
        ctx.beginPath();
        ctx.arc(moonX + moonRadius * 0.35, moonY - moonRadius * 0.15, moonRadius * 0.88, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(14, 18, 50, ${0.14 * moonAlpha})`;
        ctx.fill();

        ctx.restore();
      }

      // ── Meteor Shower: Tiered Ambient Streaking Meteors ───────────────
      const meteorActiveAlpha = mode * ambientFade;
      if (meteorActiveAlpha > 0.02) {
        meteorTimerRef.current -= dt;
        if (meteorTimerRef.current <= 0) {
          const spawnInterval = (1.8 + Math.random() * 2.6) / (0.4 + 0.6 * mode);
          meteorTimerRef.current = spawnInterval;

          const rand = Math.random();
          let rarity: 'common' | 'uncommon' | 'rare' = 'common';
          let len = 52 + Math.random() * 32;
          let width = 1.4;
          let spd = 620 + Math.random() * 220;
          let lifetime = 0.42 + Math.random() * 0.20;
          let color = 'hsl(45, 90%, 82%)';
          let coreColor = '#ffffff';

          if (rand < 0.06) {
            // RARE (6%): Large, luminous fireball bolide with ember sparks
            rarity = 'rare';
            len = 160 + Math.random() * 70;
            width = 3.6;
            spd = 380 + Math.random() * 120;
            lifetime = 0.85 + Math.random() * 0.25;
            color = 'hsl(28, 100%, 65%)';
            coreColor = 'hsl(52, 100%, 96%)';
          } else if (rand < 0.26) {
            // UNCOMMON (20%): Medium bright streak with warm apricot/gold core
            rarity = 'uncommon';
            len = 95 + Math.random() * 45;
            width = 2.4;
            spd = 490 + Math.random() * 160;
            lifetime = 0.60 + Math.random() * 0.22;
            color = 'hsl(38, 100%, 75%)';
            coreColor = 'hsl(55, 100%, 96%)';
          }

          const startX = Math.random() * w * 0.90;
          const startY = Math.random() * h * 0.38;
          // Varied trajectory angle: ~22° to 52° diagonal
          const angle = Math.PI * 0.20 + (Math.random() - 0.5) * 0.32;

          meteorsRef.current.push({
            x: startX,
            y: startY,
            vx: Math.cos(angle) * spd,
            vy: Math.sin(angle) * spd,
            length: len,
            width,
            age: 0,
            lifetime,
            color,
            coreColor,
            rarity,
          });
        }
      }

      // Update & Render Ambient Meteors
      for (let i = meteorsRef.current.length - 1; i >= 0; i--) {
        const m = meteorsRef.current[i];
        m.age += dt;
        if (m.age >= m.lifetime) {
          meteorsRef.current.splice(i, 1);
          continue;
        }

        m.x += m.vx * dt;
        m.y += m.vy * dt;

        const progress = m.age / m.lifetime;
        const fade = Math.sin(progress * Math.PI) * meteorActiveAlpha;
        if (fade <= 0.01) continue;

        const speed = Math.hypot(m.vx, m.vy);
        const tailX = m.x - (m.vx / speed) * m.length;
        const tailY = m.y - (m.vy / speed) * m.length;

        // Rare bolide emits micro glitter sparks
        if (m.rarity === 'rare' && Math.random() < 0.35 && anim) {
          anim.glitters.push({
            x: m.x - (m.vx / speed) * (Math.random() * m.length * 0.4),
            y: m.y - (m.vy / speed) * (Math.random() * m.length * 0.4),
            vx: (Math.random() - 0.5) * 15,
            vy: (Math.random() - 0.5) * 15,
            radius: 1.6 + Math.random() * 1.2,
            color: 'hsl(35, 100%, 75%)',
            alpha: 0.8 * fade,
            twinkleSpeed: 10,
            twinklePhase: Math.random() * Math.PI,
            decay: 2.8,
          });
        }

        // Streak line with gradient
        const streakGrad = ctx.createLinearGradient(m.x, m.y, tailX, tailY);
        streakGrad.addColorStop(0, m.coreColor.replace(')', `, ${0.98 * fade})`).replace('hsl', 'hsla'));
        streakGrad.addColorStop(0.20, m.color.replace(')', `, ${0.85 * fade})`).replace('hsl', 'hsla'));
        streakGrad.addColorStop(0.70, m.color.replace(')', `, ${0.25 * fade})`).replace('hsl', 'hsla'));
        streakGrad.addColorStop(1, 'transparent');

        ctx.save();
        ctx.strokeStyle = streakGrad;
        ctx.lineWidth = m.width;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(m.x, m.y);
        ctx.lineTo(tailX, tailY);
        ctx.stroke();

        // Luminous incandescent meteor head
        if (m.rarity === 'rare') {
          const headGlow = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, 10);
          headGlow.addColorStop(0, `rgba(255, 255, 255, ${fade})`);
          headGlow.addColorStop(0.4, `rgba(255, 180, 80, ${0.6 * fade})`);
          headGlow.addColorStop(1, 'transparent');
          ctx.fillStyle = headGlow;
          ctx.beginPath();
          ctx.arc(m.x, m.y, 10, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.arc(m.x, m.y, m.width * 0.9, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 255, 255, ${fade})`;
          ctx.fill();
        }
        ctx.restore();
      }

      // ── Horizon Atmospheric Glow (pulsing, mode-reactive) ────────────
      // Calm: 10s cycle (0.000628 rad/ms); Meteor: 6.5s cycle (0.000966 rad/ms)
      const pulseRate = lerpVal(0.000628, 0.000966, mode);
      const horizonPulse = 0.72 + Math.sin(now * pulseRate) * 0.28;
      const horizonGrad = ctx.createLinearGradient(0, h * 0.80, 0, h);
      horizonGrad.addColorStop(0, 'transparent');

      const glowAlpha1 = lerpVal(0.07, 0.14, mode) * horizonPulse;
      const glowAlpha2 = lerpVal(0.08, 0.18, mode) * horizonPulse;
      const glowCol1 = mode < 0.5 ? `rgba(105, 72, 170, ${glowAlpha1})` : `rgba(195, 55, 110, ${glowAlpha1})`;
      const glowCol2 = mode < 0.5 ? `rgba(175, 92, 48, ${glowAlpha2})` : `rgba(240, 115, 45, ${glowAlpha2})`;

      horizonGrad.addColorStop(0.55, glowCol1);
      horizonGrad.addColorStop(1, glowCol2);
      ctx.fillStyle = horizonGrad;
      ctx.fillRect(0, h * 0.80, w, h * 0.20);

      if (!anim || anim.phase === 'idle') {
        ctx.restore();
        return;
      }

      const elapsed = (now - anim.phaseStart) / 1000;
      const cfg = TIER_CONFIGS[anim.tier];
      const cx = anim.rocketX * w;

      // ── Phase: Launch (Ascending Shell) ──────────────────────────────
      if (anim.phase === 'launch') {
        const distRemaining = anim.rocketY - anim.rocketTargetY;
        const speedMultiplier = Math.max(0.35, Math.min(1.2, distRemaining * 2.2));
        anim.rocketY -= dt * anim.rocketSpeed * speedMultiplier;
        const ry = anim.rocketY * h;

        // Blazing rocket ember comet tail
        const tailCount = anim.tier === 'Phoenix Finale' ? 5 : 3;
        for (let i = 0; i < tailCount; i++) {
          anim.glitters.push({
            x: cx + (Math.random() - 0.5) * 5,
            y: ry + Math.random() * 12,
            vx: (Math.random() - 0.5) * 16,
            vy: 20 + Math.random() * 50,
            radius: 2 + Math.random() * 2.5,
            color: anim.tier === 'Phoenix Finale' ? 'hsl(45, 100%, 75%)' : 'hsl(28, 95%, 62%)',
            alpha: 0.85,
            twinkleSpeed: 8,
            twinklePhase: Math.random() * Math.PI,
            decay: 2.6,
          });
        }

        // Rocket head spark
        drawBrushStroke(
          ctx,
          cx,
          ry,
          0,
          -100,
          anim.tier === 'Phoenix Finale' ? 9 : 6,
          'hsl(35, 100%, 65%)',
          'hsl(48, 100%, 95%)',
          0.95,
        );

        if (anim.rocketY <= anim.rocketTargetY) {
          if (cfg.slowMoDuration > 0) {
            anim.phase = 'slowmo';
            anim.phaseStart = now;
            if (soundEnabled) playPhoenixSlowMo();
          } else {
            triggerBurst(anim.tier, cx, ry, w, h);
          }
        }
      }

      // ── Phase: Slow-Mo Hesitation Beat (Phoenix Finale, 260ms) ────────
      if (anim.phase === 'slowmo') {
        const beatProgress = elapsed / cfg.slowMoDuration;
        const ry = anim.rocketY * h;

        // Sky dims into pitch darkness
        anim.dimAlpha = Math.min(0.70, beatProgress * 0.8);

        // Radiant solar heartbeat rings expanding from apex
        const ringRadius = beatProgress * 80;
        const ringAlpha = (1 - beatProgress) * 0.8;

        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, ry, ringRadius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255, 235, 180, ${ringAlpha})`;
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // White-hot solar nucleus
        const nucleusPulse = 1 + Math.sin(beatProgress * Math.PI * 4) * 0.25;
        drawBrushStroke(
          ctx,
          cx,
          ry,
          0,
          0,
          14 * nucleusPulse,
          'hsl(35, 100%, 60%)',
          'hsl(50, 100%, 98%)',
          1,
        );
        ctx.restore();

        if (beatProgress >= 1) {
          triggerBurst(anim.tier, cx, ry, w, h);
        }
      }

      // ── Phase: Burst Simulation ──────────────────────────────────────
      if (anim.phase === 'burst') {
        // Sky dimming overlay
        if (cfg.screenDim > 0) {
          anim.dimAlpha = Math.min(anim.dimAlpha + dt * 2.5, cfg.screenDim);
        }

        // Full-screen opacity pulse light flash (brief, not blinding)
        if (anim.flashAlpha > 0) {
          anim.flashAlpha = Math.max(0, anim.flashAlpha - dt * (1 / cfg.flashDuration));
          ctx.fillStyle = `rgba(255, 250, 235, ${anim.flashAlpha * 0.65})`;
          ctx.fillRect(-20, -20, w + 40, h + 40);
        }

        // Ambient dimming
        if (anim.dimAlpha > 0) {
          ctx.fillStyle = `rgba(3, 4, 10, ${anim.dimAlpha})`;
          ctx.fillRect(-20, -20, w + 40, h + 40);
        }

        // Additive blending for radiant explosive fireworks luminosity
        ctx.globalCompositeOperation = 'lighter';

        // ── PHOENIX FINALE: Escalating Secondary Wave at 340ms ────────
        if (anim.tier === 'Phoenix Finale' && elapsed >= 0.34 && !anim.secondaryWaveFired) {
          anim.secondaryWaveFired = true;
          // Second subtle flash pulse
          anim.flashAlpha = 0.40;
          anim.shakeTime = 0.25;
          anim.shakeIntensity = 8;
          if (soundEnabled) playPhoenixSecondWave();

          // Spawns 110 additional incandescent solar-white & gold sparks
          const secColors = [
            { body: 'hsl(48, 100%, 75%)', core: 'hsl(55, 100%, 96%)' },
            { body: 'hsl(35, 100%, 68%)', core: 'hsl(45, 100%, 94%)' },
            { body: 'hsl(0, 95%, 65%)', core: 'hsl(40, 100%, 92%)' },
          ];
          for (let i = 0; i < 110; i++) {
            const ang = (Math.PI * 2 * i) / 110 + (Math.random() - 0.5) * 0.2;
            const spd = 130 + Math.random() * 180;
            const col = secColors[i % secColors.length];
            anim.sparks.push({
              x: anim.burstOriginX,
              y: anim.burstOriginY,
              vx: Math.cos(ang) * spd,
              vy: Math.sin(ang) * spd,
              radius: 7 + Math.random() * 3.5,
              color: col.body,
              coreColor: col.core,
              alpha: 1,
              age: 0,
              lifetime: 2.2 + Math.random() * 0.6,
              drag: 0.965,
              gravity: 24,
              wobbleFreq: 6,
              wobblePhase: Math.random() * Math.PI,
              wobbleAmp: 22,
              trailRate: 0.4,
            });
          }
        }

        // ── PHOENIX: Update & Render Flying Phoenix Wing Comets ────────
        for (const comet of anim.comets) {
          comet.age += dt;
          if (comet.age >= comet.lifetime && !comet.exploded) {
            comet.exploded = true;
            // Detonate secondary starburst at perimeter destination!
            for (let k = 0; k < 18; k++) {
              const ang = (Math.PI * 2 * k) / 18 + Math.random() * 0.3;
              const spd = 45 + Math.random() * 55;
              anim.sparks.push({
                x: comet.x,
                y: comet.y,
                vx: Math.cos(ang) * spd,
                vy: Math.sin(ang) * spd,
                radius: 5 + Math.random() * 2,
                color: comet.color,
                coreColor: 'hsl(50, 100%, 92%)',
                alpha: 1,
                age: 0,
                lifetime: 1.1 + Math.random() * 0.3,
                drag: 0.95,
                gravity: 28,
                wobbleFreq: 6,
                wobblePhase: Math.random() * Math.PI,
                wobbleAmp: 16,
                trailRate: 0.3,
              });
            }
          }

          if (!comet.exploded) {
            comet.x += comet.vx * dt;
            comet.y += comet.vy * dt;
            comet.vx *= 0.96;
            comet.vy *= 0.96;

            anim.glitters.push({
              x: comet.x,
              y: comet.y,
              vx: (Math.random() - 0.5) * 20,
              vy: (Math.random() - 0.5) * 20,
              radius: 3,
              color: comet.color,
              alpha: 0.9,
              twinkleSpeed: 8,
              twinklePhase: Math.random() * Math.PI,
              decay: 2.2,
            });

            drawBrushStroke(
              ctx,
              comet.x,
              comet.y,
              comet.vx,
              comet.vy,
              10,
              comet.color,
              'hsl(50, 100%, 98%)',
              1,
            );
          }
        }

        // ── GOLDEN WILLOW: Update & Render Weeping Ribbons ─────────────
        let aliveWillows = 0;
        for (const ribbon of anim.willows) {
          ribbon.age += dt;
          if (ribbon.age >= ribbon.lifetime) continue;
          aliveWillows++;

          // Willow physics: horizontal drag halts spread, gravity pulls strands downward,
          // gentle sinusoidal sway for organic wind-drift
          const sway = Math.sin(ribbon.age * ribbon.swayFreq + ribbon.swayPhase) * ribbon.swayAmp * dt;
          ribbon.vx = ribbon.vx * ribbon.drag + sway;
          ribbon.vy += ribbon.gravity * dt;

          const head = ribbon.history[0];
          const newX = head.x + ribbon.vx * dt;
          const newY = head.y + ribbon.vy * dt;

          ribbon.history.unshift({ x: newX, y: newY, alpha: 1 });
          if (ribbon.history.length > ribbon.maxHistory) ribbon.history.pop();

          ribbon.twinkleTimer -= dt;
          if (ribbon.twinkleTimer <= 0 && Math.random() < 0.28) {
            ribbon.twinkleTimer = 0.15 + Math.random() * 0.25;
            anim.glitters.push({
              x: newX,
              y: newY,
              vx: (Math.random() - 0.5) * 10,
              vy: (Math.random() - 0.5) * 10,
              radius: 1.8 + Math.random() * 1.5,
              color: 'hsl(48, 100%, 82%)',
              alpha: 0.95,
              twinkleSpeed: 12,
              twinklePhase: Math.random() * Math.PI,
              decay: 1.8,
            });
          }

          drawWillowRibbon(ctx, ribbon);
        }

        // ── BRUSH SPARKS: Update & Render ──────────────────────────────
        let aliveSparks = 0;
        for (const p of anim.sparks) {
          p.age += dt;
          if (p.age < 0) continue;
          if (p.age >= p.lifetime) continue;
          aliveSparks++;

          const wobble = Math.sin(p.age * p.wobbleFreq + p.wobblePhase) * p.wobbleAmp * dt;
          p.vx += wobble;
          p.vy += p.gravity * dt;
          p.vx *= p.drag;
          p.vy *= p.drag;

          p.x += p.vx * dt;
          p.y += p.vy * dt;

          const life = 1 - p.age / p.lifetime;
          p.alpha = life * life;

          if (Math.random() < p.trailRate * life) {
            anim.glitters.push({
              x: p.x,
              y: p.y,
              vx: p.vx * 0.2 + (Math.random() - 0.5) * 10,
              vy: p.vy * 0.2 + (Math.random() - 0.5) * 10,
              radius: p.radius * 0.35,
              color: p.color,
              alpha: p.alpha * 0.7,
              twinkleSpeed: 6,
              twinklePhase: Math.random() * Math.PI,
              decay: 2.0,
            });
          }

          drawBrushStroke(ctx, p.x, p.y, p.vx, p.vy, p.radius * (0.8 + life * 0.4), p.color, p.coreColor, p.alpha);
        }

        // ── INK SMOKE PUFFS (Fizzle) ───────────────────────────────────
        ctx.globalCompositeOperation = 'source-over';
        let aliveSmoke = 0;
        for (const puff of anim.smokePuffs) {
          puff.age += dt;
          if (puff.age >= puff.lifetime) continue;
          aliveSmoke++;

          puff.x += puff.vx * dt;
          puff.y += puff.vy * dt;
          puff.rotation += puff.rotationSpeed * dt;

          const progress = puff.age / puff.lifetime;
          puff.radius = puff.maxRadius * Math.sin((progress * Math.PI) / 2);
          puff.alpha = Math.max(0, (1 - progress) * (1 - progress));

          drawSmokePuff(ctx, puff);
        }

        // Check completion condition
        const activeEntities = aliveSparks + aliveWillows + aliveSmoke;
        if (activeEntities === 0 && elapsed > 0.45) {
          anim.phase = 'done';
          onDoneRef.current();
        }
      }

      // ── DRIFTING EMBER SPARKS & GLITTER STARS ──────────────────────
      ctx.globalCompositeOperation = 'lighter';
      for (let i = anim.glitters.length - 1; i >= 0; i--) {
        const g = anim.glitters[i];
        g.alpha -= g.decay * dt;
        if (g.alpha <= 0) {
          anim.glitters.splice(i, 1);
          continue;
        }

        g.x += g.vx * dt;
        g.y += g.vy * dt;
        g.vy += 12 * dt;
        g.vx *= 0.98;

        const twinkle = 0.6 + Math.sin(now * 0.01 * g.twinkleSpeed + g.twinklePhase) * 0.4;
        const a = g.alpha * twinkle;

        ctx.beginPath();
        ctx.arc(g.x, g.y, g.radius, 0, Math.PI * 2);
        ctx.fillStyle = g.color.replace(')', `, ${a})`).replace('hsl', 'hsla');
        ctx.fill();
      }

      ctx.restore();
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [
    initStars,
    drawBrushStroke,
    drawWillowRibbon,
    drawSmokePuff,
    triggerBurst,
    soundEnabled,
  ]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        display: 'block',
      }}
    />
  );
}
