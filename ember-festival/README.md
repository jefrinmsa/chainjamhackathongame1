# Ember Festival — Chain Jam Vol. 1 Entry

> An on-chain slot machine game with painterly firework burst-reveal mechanics, built on the **Chain.wtf Casino SDK**.

[![Chain Jam Vol. 1](https://img.shields.io/badge/Chain%20Jam-Vol.%201%20Entry-ff5500?style=for-the-badge)](https://jam.chain.wtf)
[![RTP Math](https://img.shields.io/badge/RTP-95.00%25%20--%2095.22%25%20(Verified)-gold?style=for-the-badge)](#declared-rtp-math-compiler-verified)

---

## 1. Game Concept

**Ember Festival** re-imagines traditional slot reels as a night sky celebration. Players choose a festival atmosphere, place their wager, and ignite an on-chain firework rocket. The burst reveals their win tier through organic, hand-crafted particle animations rendered on HTML5 Canvas and backed by a procedural Web Audio synthesizer.

### Core Features
- **Visual Rarity System**: Each payout tier is instantly readable within ~0.5s through organic palette richness, bloom scale, and stroke style:
  - **Fizzle (0x Dud)**: A quick hollow fizzle ending in drifting painterly smoke puffs.
  - **Small Bloom (1.2x – 1.5x)**: A tight, warm 18-particle radial blossom.
  - **Bright Burst (1.8x – 3x)**: Saturated dual-layer bloom with bright golden core sparks.
  - **Cascade (3x – 10x)**: Concentric expanding shockwave rings branching outward.
  - **Golden Willow (6x – 80x)**: Wide weeping golden filaments arcing and gently falling under gravity and wind sway.
  - **Phoenix Finale (500x)**: Full-screen event with hesitation flash, slow-mo heartbeat, deep sub-bass boom, secondary shockwave, and ascending phoenix fire-tails.
- **Dual Night Configurations**: Toggle between low-volatility *Calm Night* and high-volatility jackpot *Meteor Shower*.
- **Procedural Audio Engine**: Web Audio API synthesizer generating real-time resonant pops, whooshes, willow crackles, and sub-bass impacts with zero static sample latency.
- **Dual Play Modes**: Plays seamlessly in the Chain.wtf Casino host iframe or standalone as an interactive demo outside the iframe.

---

## 2. Declared RTP Math (Compiler-Verified)

Both paytables are verified by the `@chain/casino-sdk` contract compiler (`compileConfiguration`), ensuring mathematically exact on-chain odds and payouts.

### Config A: Calm Night (`calm-night.csv`)
*Low-volatility, steady festival vibes. Frequent wins with modest multipliers.*

- **Declared RTP**: **95.22%** (compiler-verified)
- **Hit Rate**: **44.90%** (1 win per 2.23 launches)
- **Top Multiplier**: **6.0x**
- **Prize Denominator**: `5` (`gameData = 0x00`)

| Multiplier | Prize Units | Weight | Probability | Tier Name | Visual Reveal |
| :---: | :---: | :---: | :---: | :---: | :--- |
| **0x** | `0` | 55,100 | 55.10% | Fizzle | Drifting grey smoke puff |
| **1.2x** | `6` | 19,800 | 19.80% | Small Bloom | Warm orange blossom |
| **1.8x** | `9` | 13,200 | 13.20% | Bright Burst | Saturated gold burst |
| **3.0x** | `15` | 7,900 | 7.90% | Cascade | Concentric shockwave ripple |
| **6.0x** | `30` | 4,000 | 4.00% | Golden Willow | Weeping golden gravity filaments |
| **Total** | — | **100,000** | **100.00%** | — | **Expected Return: 95.22%** |

---

### Config B: Meteor Shower (`meteor-shower.csv`)
*High-volatility jackpot sky. Lower hit frequency with massive 500x Phoenix top prize.*

- **Declared RTP**: **95.00%** (compiler-verified)
- **Hit Rate**: **22.83%** (1 win per 4.38 launches)
- **Top Multiplier**: **500.0x**
- **Prize Denominator**: `2` (`gameData = 0x01`)

| Multiplier | Prize Units | Weight | Probability | Tier Name | Visual Reveal |
| :---: | :---: | :---: | :---: | :---: | :--- |
| **0x** | `0` | 771,690 | 77.169% | Fizzle | Drifting grey smoke puff |
| **1.5x** | `3` | 150,000 | 15.000% | Small Bloom | Crimson bloom |
| **3.0x** | `6` | 60,000 | 6.000% | Bright Burst | Violet-gold burst |
| **10.0x** | `20` | 15,000 | 1.500% | Cascade | Triple-ring expanding shockwave |
| **80.0x** | `160` | 3,000 | 0.300% | Golden Willow | Dense weeping gold trails |
| **500.0x** | `1,000` | 310 | 0.031% | Phoenix Finale | Screen-wide hesitation flash & shockwave |
| **Total** | — | **1,000,000** | **100.00%** | — | **Expected Return: 95.00%** |

---

## 3. How to Run Locally

### Prerequisites
- [Node.js](https://nodejs.org/) v18+ and `npm`
- [Foundry](https://getfoundry.sh/) (`anvil`) if running the local blockchain node

### 1. Install Dependencies
```bash
# In the repository root
npm install

# In frontend directory
cd ember-festival/frontend
npm install
```

### 2. Run Local Chain.wtf Slots Stack (Simulator)
From the `casino-sdk` root:
```bash
cd casino-sdk
npm run start:slots
```
This boots:
1. Local Anvil blockchain with the Casino Facet and Verify Network VRF
2. Host harness simulator at `http://localhost:3300`

### 3. Start Frontend Development Server
In a separate terminal:
```bash
cd ember-festival/frontend
npm run dev
```
Open `http://localhost:3300/?game=http://localhost:3500` to play inside the official SDK simulator harness.

### 4. Standalone Playable Demo (Outside iframe)
Per the jam requirements, Ember Festival runs standalone outside the iframe with full betting mechanics, demo credits, authentic CSV odds simulation, and interactive preview keys (1–6):
```bash
cd ember-festival/frontend
npm run build
npm run preview
```
Visit `http://localhost:3500` directly in any web browser.

---

## 4. Jam Integration & Compliance Checklist

- [x] **Chain Jam Widget Snippet**: Embedded in `<head>` via `<script async src="https://jam.chain.wtf/widget.js"></script>` per instructions.
- [x] **Unobstructed Layout**: Widget floating position pinned above the betting dock (`bottom: calc(18vh + 12px) !important; right: 16px !important;`) so it never overlaps controls, balance, or the Launch button.
- [x] **Production Build**: Verified with `vite build` (`dist/` generated cleanly in 12s, 0 errors).
- [x] **Source Access**: Clean repository with zero committed `node_modules`, no private keys, and comprehensive `.gitignore`.
- [x] **Manifest**: `game.manifest.json` configured with `openSession: true`, `mode: full-iframe`, and `resize: true`.
