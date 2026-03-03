// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — DEMO RUNNER  (v2 — FULL REWRITE)
// pzo_engine/src/demo/run-demo.ts
//
// Entry point for the guided tutorial demo.
//
// ── WHAT THIS DEMO IS ──────────────────────────────────────────────────────────
// An INTERACTIVE TUTORIAL that teaches players how Point Zero One works.
// It is NOT a stress test. It is NOT a headless bench runner.
// It is a NARRATIVE WALK-THROUGH of the game's core mechanics — executed
// against real game logic (runReducer, game/types, game/core) so that
// every number a player sees in this demo matches what they'll see in production.
//
// ── WHAT CHANGED FROM v1 ──────────────────────────────────────────────────────
// v1 (dead): Imported from non-existent '../engine/game-engine' and '../engine/deck'.
//            Used a flat 720-tick generic loop with no mode, no CORD, no sovereignty.
//            Had no tutorial beats. Had no mode-specific AI. Dead code — never worked.
//
// v2 (this file):
//   ✦ Imports from real paths: game/types, game/core, game/runtime, game/sovereignty
//   ✦ DemoOrchestrator wraps the real runReducer — same state machine as production
//   ✦ DemoNarrator handles all terminal display — rich ANSI panels
//   ✦ DemoAI plays each mode with mode-specific strategy to teach core loops
//   ✦ Tutorial beats fire at predetermined ticks — explain mechanics in context
//   ✦ All 4 modes supported: EMPIRE, PREDATOR, SYNDICATE, PHANTOM
//   ✦ Real CORD score calculation via game/sovereignty/cordCalculator
//   ✦ Real proof hash via game/sovereignty/proofHash
//   ✦ CLI menu for mode selection
//   ✦ Deterministic seeds per mode for reproducible teaching runs
//
// ── HOW TO RUN ────────────────────────────────────────────────────────────────
//   cd /path/to/pzo_engine
//   npx ts-node src/demo/run-demo.ts                 # menu-driven mode select
//   npx ts-node src/demo/run-demo.ts -- --mode EMPIRE  # direct mode select
//   npx ts-node src/demo/run-demo.ts -- --mode all     # run all 4 modes
//   npx ts-node src/demo/run-demo.ts -- --mode PREDATOR --fast  # silent fast
//
// ── ARCHITECTURE ──────────────────────────────────────────────────────────────
//   run-demo.ts          → CLI entry, mode select, run loop
//   DemoOrchestrator.ts  → State machine (wraps runReducer, no React deps)
//   DemoAI.ts            → Mode-specific AI decisions with teaching rationale
//   DemoNarrator.ts      → All terminal display (colors, panels, beats)
//   demo-config.ts       → Seeds, beat definitions, AI configs
//
// Density6 LLC · Point Zero One · Confidential
// ═══════════════════════════════════════════════════════════════════════════════

import * as readline from 'readline';
import type { GameMode } from '../../../pzo-web/src/game/types/modes';
import { DemoOrchestrator, type DemoRunState } from './DemoOrchestrator';
import { DemoNarrator }                         from './DemoNarrator';
import { DemoAI }                               from './DemoAI';
import {
  DEMO_TICK_BUDGET,
  DEMO_TICK_DELAY_MS,
  DEMO_REPORT_EVERY,
} from './demo-config';

// ─── CLI Arguments ─────────────────────────────────────────────────────────────
interface CliArgs {
  mode: GameMode | 'all' | null;
  fast: boolean;
  help: boolean;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const modeIdx = args.indexOf('--mode');
  const rawMode = modeIdx >= 0 ? args[modeIdx + 1]?.toUpperCase() : null;
  const validModes: GameMode[] = ['EMPIRE', 'PREDATOR', 'SYNDICATE', 'PHANTOM'];

  const mode = rawMode === 'ALL'
    ? 'all'
    : validModes.includes(rawMode as GameMode)
      ? rawMode as GameMode
      : null;

  return {
    mode,
    fast: args.includes('--fast'),
    help: args.includes('--help') || args.includes('-h'),
  };
}

function printHelp(): void {
  console.log(`
POINT ZERO ONE — Demo Runner v2
────────────────────────────────
Usage:
  npx ts-node src/demo/run-demo.ts [options]

Options:
  --mode <MODE>   Run a specific mode (EMPIRE | PREDATOR | SYNDICATE | PHANTOM | all)
  --fast          Skip delays, instant simulation
  --help          Show this help

Examples:
  npx ts-node src/demo/run-demo.ts
  npx ts-node src/demo/run-demo.ts -- --mode EMPIRE
  npx ts-node src/demo/run-demo.ts -- --mode all --fast
  `);
}

// ─── Menu: select mode interactively ──────────────────────────────────────────
async function selectMode(): Promise<GameMode> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  console.log('\n  Select a game mode to demo:\n');
  console.log('  \x1b[35m[1]\x1b[0m  \x1b[1mEMPIRE\x1b[0m     — Build from nothing. Survive the bleed.');
  console.log('  \x1b[31m[2]\x1b[0m  \x1b[1mPREDATOR\x1b[0m   — Counter haters. Protect your psyche.');
  console.log('  \x1b[34m[3]\x1b[0m  \x1b[1mSYNDICATE\x1b[0m  — Trust your allies. Defection kills runs.');
  console.log('  \x1b[36m[4]\x1b[0m  \x1b[1mPHANTOM\x1b[0m    — Race your ghost. Beat your dynasty.');
  console.log('');

  return new Promise((resolve) => {
    rl.question('  Enter 1–4: ', (answer) => {
      rl.close();
      const map: Record<string, GameMode> = { '1': 'EMPIRE', '2': 'PREDATOR', '3': 'SYNDICATE', '4': 'PHANTOM' };
      const mode = map[answer.trim()] ?? 'EMPIRE';
      console.log(`\n  → ${mode} selected.\n`);
      resolve(mode);
    });
  });
}

// ─── SLEEP ─────────────────────────────────────────────────────────────────────
const sleep = (ms: number): Promise<void> => new Promise(r => setTimeout(r, ms));

// ─── RUN A SINGLE DEMO ────────────────────────────────────────────────────────
async function runSingleDemo(mode: GameMode, fast: boolean): Promise<void> {
  const narrator = new DemoNarrator(mode);
  const orch     = new DemoOrchestrator(mode);

  // Initialize (loads runReducer dynamically)
  await orch.init();

  // Splash + mode intro
  narrator.printBootSplash();
  narrator.printModeIntro(mode);

  if (!fast) await sleep(1500);

  // Build initial state
  let state: DemoRunState = orch.buildInitialState();

  // Seed the AI with the same rng as orchestrator
  const { seededRng } = await import('../../../pzo-web/src/game/core/rng');
  const aiRng         = seededRng(`AI-${mode}`);
  const ai            = new DemoAI(mode, aiRng);

  // Initial card draw
  const initialHand = orch.drawCards(3);
  state._hand       = initialHand;
  state._cardsDrawn = 3;

  // ─── MAIN TICK LOOP ─────────────────────────────────────────────────────────
  let runComplete = false;

  for (let tick = 0; tick < DEMO_TICK_BUDGET && !runComplete; tick++) {

    // 1. Execute tick (settlements, pressure, energy regen, beat checks)
    const { state: nextState, beats, events } = orch.tick(state, tick);
    state = nextState;

    // 2. Fire tutorial beats
    for (const beat of beats) {
      narrator.printTutorialBeat(beat);
      if (!fast) await sleep(beat.pauseMs);
    }

    // 3. AI decision
    const decision = ai.decide(state, tick, state._energy, state._hand);

    if (decision.action === 'PLAY_CARD' && decision.cardId) {
      const card = state._hand.find(c => c.id === decision.cardId);
      if (card && state._energy >= card.cost) {
        state = orch.playCard(state, card, tick);
        if (decision.urgent || tick % DEMO_REPORT_EVERY === 0) {
          narrator.printCardPlayed(
            decision.cardName ?? card.name,
            decision.reasoning,
            card.cost,
          );
        }
      }
    } else if (decision.action === 'DRAW_CARD') {
      const drawn       = orch.drawCards(1);
      state._hand       = [...state._hand, ...drawn];
      state._cardsDrawn++;
    }

    // 4. Log engine events to terminal
    for (const evt of events) {
      if (evt.startsWith('SETTLEMENT')) {
        const net = state.income - state.expenses;
        const xp  = Math.floor(state._settlementCount * 12);
        narrator.printMonthlySettlement(tick, state.income, state.expenses, net, xp);
        if (!fast) await sleep(200);
      }
      if (evt.startsWith('PRESSURE_CRISIS')) {
        narrator.printCrisisWarning(state._pressureScore, 'CRITICAL');
      }
      if (evt === 'FREEDOM_ACHIEVED' || evt === 'BANKRUPT') {
        runComplete = true;
      }
    }

    // 5. Mode-specific event display
    if (mode === 'EMPIRE') {
      const bleedActive  = state.modeExt?.empire?.bleedActive ?? false;
      const wasBleedLast = tick > 0 && bleedActive;
      if (bleedActive && !wasBleedLast) {
        narrator.printBleedActivated(
          state.modeExt?.empire?.bleedSeverity ?? 'WATCH',
          state.income - state.expenses,
        );
      }
    }

    if (mode === 'PHANTOM') {
      const ghostDelta  = state.modeExt?.phantom?.ghostDelta  ?? 0;
      const legendScore = state.modeExt?.phantom?.legendScore ?? 100;
      if (tick > 0 && tick % DEMO_REPORT_EVERY === 0) {
        narrator.printGhostDelta(ghostDelta, legendScore);
      }
    }

    // 6. Periodic status report
    if (tick > 0 && tick % DEMO_REPORT_EVERY === 0) {
      narrator.printTickStatus({
        tick,
        totalTicks:  DEMO_TICK_BUDGET,
        cash:        state.cash,
        netWorth:    state.netWorth,
        cashflow:    state.income - state.expenses,
        pressure:    state._pressureScore,
        phase:       state.phase,
        shieldPct:   (state.shields ?? 4) / 4,
        cardsInHand: state._hand.length,
        energy:      state._energy,
        maxEnergy:   state._maxEnergy,
      });
    }

    // 7. End condition check
    if (state.phase === 'FREEDOM' || state.phase === 'BANKRUPT' || state.phase === 'COMPLETE') {
      runComplete = true;
    }

    // Delay for real-time playback
    if (!fast && DEMO_TICK_DELAY_MS > 0) {
      await sleep(DEMO_TICK_DELAY_MS);
    }
  }

  // ─── FINALIZE ───────────────────────────────────────────────────────────────
  const result = orch.finalize(state, DEMO_TICK_BUDGET);

  narrator.printRunComplete({
    outcome:   result.outcome,
    cordScore: result.cordScore,
    cordTier:  result.cordTier,
    finalCash: state.cash,
    finalNW:   state.netWorth,
    totalXP:   result.totalXP,
    cardsPlayed: result.cardsPlayed,
    ticksRun:  result.ticksRun,
    proofHash: result.proofHash,
    grade:     result.grade,
    mode,
  });

  narrator.printDemoStats({
    cardsPlayed:     state._cardsPlayed,
    cardsDrawn:      state._cardsDrawn,
    beatsFired:      result.beatsTriggered.length,
    crisisEvents:    state._crisisCount,
    shieldBreaches:  state._shieldBreaches,
    settlementCount: state._settlementCount,
  });

  // Post-run CTA
  console.log(`\x1b[36m  Ready to play? Run the full game:\x1b[0m`);
  console.log(`\x1b[37m  cd pzo-web && npm run dev\x1b[0m\n`);
}

// ─── RUN ALL MODES ────────────────────────────────────────────────────────────
async function runAllModes(fast: boolean): Promise<void> {
  const modes: GameMode[] = ['EMPIRE', 'PREDATOR', 'SYNDICATE', 'PHANTOM'];
  for (const mode of modes) {
    await runSingleDemo(mode, fast);
    if (!fast) await sleep(1000);
    console.log('\n' + '═'.repeat(60) + '\n');
  }
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  const args = parseArgs();

  if (args.help) {
    printHelp();
    return;
  }

  let mode: GameMode | 'all' = args.mode ?? await selectMode();

  if (mode === 'all') {
    await runAllModes(args.fast);
  } else {
    await runSingleDemo(mode, args.fast);
  }
}

main().catch((err) => {
  console.error('\x1b[31m[DEMO ERROR]\x1b[0m', err);
  process.exit(1);
});