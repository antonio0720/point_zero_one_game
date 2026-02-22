// ============================================================
// POINT ZERO ONE DIGITAL — Demo Runner
// Simulates a full run with AI auto-play for local testing
// ============================================================

import { GameEngine } from '../engine/game-engine';
import { GameState } from '../engine/types';
import { CARD_REGISTRY } from '../engine/deck';

const FAST_FORWARD = true;   // true = instant sim, false = real-time
const PLAYER_ID    = 'demo-player-001';
const DEMO_SEED    = 42;     // deterministic run

// ─── TERMINAL COLORS ─────────────────────────────────────────
const C = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  green:  '\x1b[32m',
  red:    '\x1b[31m',
  yellow: '\x1b[33m',
  cyan:   '\x1b[36m',
  magenta:'\x1b[35m',
  gray:   '\x1b[90m',
};

function fmt(n: number, prefix = '$'): string {
  const colored = n >= 0 ? C.green : C.red;
  return `${colored}${prefix}${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${C.reset}`;
}

function bar(value: number, max: number, width = 20, char = '█'): string {
  const filled = Math.round((value / max) * width);
  return C.cyan + char.repeat(filled) + C.gray + '░'.repeat(width - filled) + C.reset;
}

// ─── SIMPLE AI STRATEGY ──────────────────────────────────────
function aiDecide(state: GameState): { action: 'play' | 'draw' | 'pass'; cardId?: string; symbol?: string } {
  const { run, energy, market } = state;
  const hand = run.deck.hand;

  // Find best priced asset
  const symbols = [...market.assets.keys()];
  const trending = symbols.sort((a, b) => {
    const pa = market.assets.get(a)!.priceChange;
    const pb = market.assets.get(b)!.priceChange;
    return Math.abs(pb) - Math.abs(pa);
  })[0];

  // Play if we have energy and playable cards
  const playable = hand.filter(c => c.cost <= energy);
  if (playable.length > 0 && Math.random() < 0.3) {
    // Pick highest leverage card we can afford
    const best = playable.sort((a, b) => b.leverage - a.leverage)[0];
    const priceChange = market.assets.get(trending)?.priceChange ?? 0;
    // Match card direction to market trend
    const goLong = priceChange >= 0;
    const preferred = playable.find(c =>
      goLong ? (c.type === 'LONG' || c.type === 'MACRO') : (c.type === 'SHORT' || c.type === 'HEDGE')
    ) ?? best;
    return { action: 'play', cardId: preferred.id, symbol: trending };
  }

  // Draw if hand is low
  if (hand.length < 3 && run.deck.drawPile.length > 0) {
    return { action: 'draw' };
  }

  return { action: 'pass' };
}

// ─── MAIN DEMO ───────────────────────────────────────────────
async function runDemo(): Promise<void> {
  const engine = new GameEngine();

  // Subscribe to events
  engine.events.on('*', (event) => {
    switch (event.type) {
      case 'CRISIS_TRIGGERED':
        console.log(`\n${C.red}${C.bold}⚠  CRISIS TRIGGERED — Drawdown: ${(event.data.drawdown as number * 100).toFixed(1)}%${C.reset}`);
        break;
      case 'LIQUIDATION':
        console.log(`${C.red}💀 LIQUIDATED: ${(event.data.positions as string[]).length} position(s)${C.reset}`);
        break;
      case 'CARD_PLAYED':
        console.log(`${C.magenta}🃏 ${event.data.card} → ${event.data.symbol}${C.reset}`);
        break;
      case 'RUN_COMPLETE':
        const d = event.data as Record<string, string | number>;
        console.log(`\n${C.bold}${C.cyan}╔══════════════════════════════╗${C.reset}`);
        console.log(`${C.bold}${C.cyan}  RUN COMPLETE${C.reset}`);
        console.log(`${C.bold}${C.cyan}  Score:       ${C.yellow}${d.score}${C.reset}`);
        console.log(`${C.bold}${C.cyan}  Final ROI:   ${d.roi}${C.reset}`);
        console.log(`${C.bold}${C.cyan}  Max Drawdown:${d.maxDrawdown}${C.reset}`);
        console.log(`${C.bold}${C.cyan}╚══════════════════════════════╝${C.reset}\n`);
        break;
    }
  });

  // Start run
  console.log(`\n${C.bold}${C.cyan}POINT ZERO ONE DIGITAL${C.reset}`);
  console.log(`${C.gray}Financial Roguelike Engine v1.0${C.reset}`);
  console.log(`${C.gray}Seed: ${DEMO_SEED} | Duration: 12 min | Ticks: 720${C.reset}\n`);

  let state = engine.createRun(PLAYER_ID, DEMO_SEED);

  // Initial draw
  state = engine.drawCards(state, 5);

  const REPORT_INTERVAL = 60; // print status every 60 ticks

  // Run loop
  for (let t = 0; t < 720; t++) {
    state = engine.tick(state);

    // AI action
    const decision = aiDecide(state);
    if (decision.action === 'play' && decision.cardId && decision.symbol) {
      state = engine.playCard(state, decision.cardId, decision.symbol);
    } else if (decision.action === 'draw') {
      state = engine.drawCards(state, 2);
    }

    // Periodic status report
    if (t % REPORT_INTERVAL === 0 && t > 0) {
      const { portfolio, currentTick, phase } = state.run;
      const minuteLeft = ((720 - currentTick) / 60).toFixed(1);
      const equity = portfolio.totalEquity;
      const pnl = equity - 10_000;
      const roi = (pnl / 10_000 * 100).toFixed(2);

      console.log(
        `T${String(currentTick).padStart(3,'0')} ` +
        `[${phase.padEnd(10)}] ` +
        `Equity: ${fmt(equity)} ` +
        `PnL: ${fmt(pnl)} (${roi}%) ` +
        `Energy: ${bar(state.energy, state.maxEnergy, 10)} ` +
        `Positions: ${portfolio.positions.size} ` +
        `${minuteLeft}m left`
      );
    }

    if (state.run.phase === 'COMPLETE') break;

    if (!FAST_FORWARD) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  // Final state
  if (state.run.phase !== 'COMPLETE') {
    state = engine.finalizeRun(state);
  }

  console.log(`${C.gray}Actions logged: ${state.actionLog.length}${C.reset}`);
  console.log(`${C.gray}Cards played:   ${state.actionLog.filter(a => a.type === 'PLAY_CARD').length}${C.reset}`);
  console.log(`${C.gray}Cards drawn:    ${state.actionLog.filter(a => a.type === 'DRAW').length}${C.reset}`);
}

runDemo().catch(console.error);
