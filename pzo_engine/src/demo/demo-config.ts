// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — DEMO CONFIGURATION
// pzo_engine/src/demo/demo-config.ts
//
// Authoritative settings for the guided tutorial runner.
// Every seed is deterministic — same seed = same demo experience every time.
// Density6 LLC · Point Zero One · Confidential
// ═══════════════════════════════════════════════════════════════════════════════

import type { GameMode } from '../../../pzo-web/src/game/types/modes';

// ── Deterministic seeds per mode (tuned for dramatic teaching moments) ─────────
export const DEMO_SEEDS: Record<GameMode, string> = {
  EMPIRE:    'EMPIRE-DEMO-9041',    // triggers bleed at tick 120 — teaches recovery arc
  PREDATOR:  'PREDATOR-DEMO-3317',  // spawns rival CIPHER_9 early — teaches counterplay
  SYNDICATE: 'SYNDICATE-DEMO-7782', // defection event at tick 180 — teaches trust arc
  PHANTOM:   'PHANTOM-DEMO-5509',   // ghost gap closes tick 240 — teaches legend pressure
};

// ── Tutorial run length (shorter than real runs — focus on core loop) ──────────
export const DEMO_TICK_BUDGET    = 360;     // 6 minutes of simulated time
export const DEMO_TICK_DELAY_MS  = 0;       // 0 = instant sim, >0 = real-time playback
export const DEMO_REPORT_EVERY   = 30;      // print status every N ticks

// ── Freedom threshold scaled down for demo (easier to reach FREEDOM outcome) ──
export const DEMO_FREEDOM_THRESHOLD = 150_000;  // vs 500_000 in full game

// ── Version strings ────────────────────────────────────────────────────────────
export const DEMO_CLIENT_VERSION  = 'demo-1.0.0';
export const DEMO_ENGINE_VERSION  = '2.0.0';
export const DEMO_PLAYER_ID       = 'demo-sovereign-001';

// ── AI behavior per mode ───────────────────────────────────────────────────────
export interface ModeAIConfig {
  /** How aggressively the AI plays cards (0–1) */
  aggression: number;
  /** Card types to prioritize for this mode */
  priorityTypes: string[];
  /** Whether AI deliberately triggers crisis to teach recovery */
  teachCrisis: boolean;
  /** Tick at which AI deliberately enters distress state */
  forcedCrisisTick: number | null;
}

export const MODE_AI_CONFIGS: Record<GameMode, ModeAIConfig> = {
  EMPIRE: {
    aggression:       0.45,
    priorityTypes:    ['MACRO', 'HEDGE', 'LONG'],
    teachCrisis:      true,
    forcedCrisisTick: 96,   // forces bleed at tick 96 to teach bleed mechanics
  },
  PREDATOR: {
    aggression:       0.75,
    priorityTypes:    ['SHORT', 'MACRO', 'COUNTER'],
    teachCrisis:      false,
    forcedCrisisTick: null,
  },
  SYNDICATE: {
    aggression:       0.35,
    priorityTypes:    ['LONG', 'AID', 'MACRO'],
    teachCrisis:      true,
    forcedCrisisTick: 144,  // triggers defection window to teach trust mechanics
  },
  PHANTOM: {
    aggression:       0.55,
    priorityTypes:    ['LONG', 'HEDGE', 'MACRO'],
    teachCrisis:      false,
    forcedCrisisTick: null,
  },
};

// ── Tutorial beat definitions — what to explain at which ticks ─────────────────
export interface TutorialBeat {
  tick:       number;
  title:      string;
  body:       string;
  pauseMs:    number;  // how long to pause demo for player to read
}

export const TUTORIAL_BEATS_GLOBAL: TutorialBeat[] = [
  {
    tick:    0,
    title:   'WELCOME TO POINT ZERO ONE',
    body:    'You start with $28,000 cash. Income: $2,100/mo. Expenses: $4,800/mo.\nYour net is negative. The game forces financial acceleration — not comfort.',
    pauseMs: 2000,
  },
  {
    tick:    12,
    title:   'FIRST MONTHLY SETTLEMENT',
    body:    'Settlements fire every 12 ticks. Cash drains. Cards refill.\nPlay income cards BEFORE settlement to offset the bleed.',
    pauseMs: 1500,
  },
  {
    tick:    24,
    title:   'CARD ENGINE ONLINE',
    body:    'Cards are weapons. Each has a Cost (energy), Timing Class, and Effect.\nFATED cards trigger automatically. TACTICAL cards require your decision.',
    pauseMs: 1500,
  },
  {
    tick:    60,
    title:   'PRESSURE SYSTEM',
    body:    'Pressure rises with debt, threats, and missed settlements.\nAt 85% → CRISIS tier. Tick rate accelerates. Decision windows shrink.',
    pauseMs: 1500,
  },
  {
    tick:    120,
    title:   'SHIELD LAYERS',
    body:    'You have 4 shield layers (L1–L4). Each absorbs one attack class.\nL4 breach → temporary card lock. Repair costs cash and takes ticks.',
    pauseMs: 1500,
  },
  {
    tick:    240,
    title:   'CORD SCORE',
    body:    'CORD = Consistency + Outcome + Risk + Decisiveness.\nYour proof-of-play hash is generated from this run. Immutable.\nHigher CORD = better leaderboard rank + sovereignty badge.',
    pauseMs: 2000,
  },
];

export const TUTORIAL_BEATS_BY_MODE: Record<GameMode, TutorialBeat[]> = {
  EMPIRE: [
    {
      tick:    96,
      title:   'BLEED MODE ACTIVATED',
      body:    'When cash < expenses × 2 for 3 consecutive months, BLEED triggers.\nSeverity: WATCH → CRITICAL → TERMINAL.\nOnly a COMEBACK SURGE card or income growth resolves it.',
      pauseMs: 2500,
    },
    {
      tick:    180,
      title:   'ISOLATION TAX',
      body:    'In EMPIRE, playing LONG cards while isolated costs an Isolation Tax.\nExpand your holdings to reduce isolation and cut the tax rate.',
      pauseMs: 1500,
    },
  ],
  PREDATOR: [
    {
      tick:    48,
      title:   'HATER BOT SPAWNED',
      body:    'PREDATOR mode activates hater bots. They file sabotage actions.\nYou have 5 ticks to counter. Miss the window → sabotage lands.',
      pauseMs: 2000,
    },
    {
      tick:    90,
      title:   'PSYCHE METER',
      body:    'Psyche decays under pressure. At 20% → TILT state.\nUnder TILT: card costs +25%, counterplay windows −2 ticks.\nPlay RECOVERY cards to restore psyche before it spirals.',
      pauseMs: 2000,
    },
    {
      tick:    150,
      title:   'BATTLE BUDGET',
      body:    'Battle Budget = your sabotage ammunition. It refills monthly.\nSaving BB gives you counterplay power. Spending it fires back at rivals.',
      pauseMs: 1500,
    },
  ],
  SYNDICATE: [
    {
      tick:    60,
      title:   'TRUST SCORE',
      body:    'SYNDICATE runs are multiplayer. Trust Score governs your allies.\nBreaching an AID contract drops trust by 40 points.\nBelow 30 Trust → defection risk activates.',
      pauseMs: 2000,
    },
    {
      tick:    144,
      title:   'DEFECTION SEQUENCE',
      body:    'A defection event opens a Rescue Window.\nYour allies can bail you out — but they read your trust history.\nHigh trust = rescue likely. Low trust = you play solo.',
      pauseMs: 2500,
    },
    {
      tick:    240,
      title:   'SHARED TREASURY',
      body:    'In SYNDICATE, your cash pool is partially shared with allies.\nDraining the treasury for solo plays triggers a TRUST_UPDATE.\nBalance personal gain vs collective solvency.',
      pauseMs: 1500,
    },
  ],
  PHANTOM: [
    {
      tick:    30,
      title:   'GHOST RUN ACTIVE',
      body:    'PHANTOM mode loads your historical best run as a Ghost.\nGap Indicator shows + or − vs your ghost\'s equity at this tick.\nAhead of ghost = LEGEND PRESSURE fires on opponents.',
      pauseMs: 2000,
    },
    {
      tick:    120,
      title:   'LEGEND DECAY',
      body:    'Your Legend Score decays if you stop posting personal bests.\nDecay rate: 0.3% per tick behind ghost.\nPost a new record to reset decay and trigger Community Heat.',
      pauseMs: 1500,
    },
    {
      tick:    200,
      title:   'DYNASTY CHALLENGE',
      body:    'Dynasty Challenges stack. Each is a historical record to beat.\nComplete 3 dynasty challenges in one run → PHANTOM SOVEREIGN badge.',
      pauseMs: 2000,
    },
  ],
};