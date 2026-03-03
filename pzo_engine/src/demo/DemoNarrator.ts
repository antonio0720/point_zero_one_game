// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — DEMO NARRATOR
// pzo_engine/src/demo/DemoNarrator.ts
//
// Terminal display layer for the guided demo runner.
// Handles all console output — colors, bars, panels, event callouts.
// Zero business logic here. Pure presentation.
// Density6 LLC · Point Zero One · Confidential
// ═══════════════════════════════════════════════════════════════════════════════

import type { GameMode }    from '../../../pzo-web/src/game/types/modes';
import type { RunOutcome }  from '../../../pzo-web/src/game/types/cord';
import type { TutorialBeat } from './demo-config';

// ─── ANSI Color Palette ────────────────────────────────────────────────────────
export const C = {
  reset:   '\x1b[0m',
  bold:    '\x1b[1m',
  dim:     '\x1b[2m',
  green:   '\x1b[32m',
  red:     '\x1b[31m',
  yellow:  '\x1b[33m',
  cyan:    '\x1b[36m',
  magenta: '\x1b[35m',
  blue:    '\x1b[34m',
  white:   '\x1b[37m',
  gray:    '\x1b[90m',
  bgRed:   '\x1b[41m',
  bgCyan:  '\x1b[46m',
  bgBlue:  '\x1b[44m',
  // Mode accent colors
  empire:    '\x1b[35m',   // magenta
  predator:  '\x1b[31m',   // red
  syndicate: '\x1b[34m',   // blue
  phantom:   '\x1b[36m',   // cyan
} as const;

// Mode display names + accents
const MODE_META: Record<GameMode, { label: string; color: string; icon: string }> = {
  EMPIRE:    { label: 'EMPIRE',    color: C.empire,    icon: '♔' },
  PREDATOR:  { label: 'PREDATOR',  color: C.predator,  icon: '⚔' },
  SYNDICATE: { label: 'SYNDICATE', color: C.syndicate, icon: '⬡' },
  PHANTOM:   { label: 'PHANTOM',   color: C.phantom,   icon: '◈' },
};

// ─── Formatting Utilities ──────────────────────────────────────────────────────
export function fmtMoney(n: number): string {
  const abs = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  const color = n >= 0 ? C.green : C.red;
  const sign  = n >= 0 ? '+' : '−';
  return `${color}${n < 0 ? '' : ''}$${abs}${C.reset}`;
}

export function fmtMoneyShort(n: number): string {
  const color = n >= 0 ? C.green : C.red;
  if (Math.abs(n) >= 1_000_000) return `${color}$${(n / 1_000_000).toFixed(2)}M${C.reset}`;
  if (Math.abs(n) >= 1_000)     return `${color}$${(n / 1_000).toFixed(1)}k${C.reset}`;
  return `${color}$${n}${C.reset}`;
}

export function fmtPct(n: number): string {
  const color = n >= 0 ? C.green : C.red;
  return `${color}${n >= 0 ? '+' : ''}${(n * 100).toFixed(1)}%${C.reset}`;
}

export function bar(value: number, max: number, width = 16, fillChar = '█', emptyChar = '░'): string {
  const clamped = Math.max(0, Math.min(value, max));
  const filled  = Math.round((clamped / max) * width);
  return C.cyan + fillChar.repeat(filled) + C.gray + emptyChar.repeat(width - filled) + C.reset;
}

export function pressureBar(value: number): string {
  const pct = Math.max(0, Math.min(value, 1));
  const width = 16;
  const filled = Math.round(pct * width);
  const color = pct >= 0.85 ? C.red : pct >= 0.6 ? C.yellow : C.green;
  return color + '█'.repeat(filled) + C.gray + '░'.repeat(width - filled) + C.reset;
}

function hr(width = 60, char = '─'): string {
  return C.gray + char.repeat(width) + C.reset;
}

// ─── NARRATOR CLASS ───────────────────────────────────────────────────────────
export class DemoNarrator {

  private readonly mode: GameMode;
  private readonly accent: string;
  private readonly icon: string;

  constructor(mode: GameMode) {
    this.mode   = mode;
    this.accent = MODE_META[mode].color;
    this.icon   = MODE_META[mode].icon;
  }

  // ── Boot splash ─────────────────────────────────────────────────────────────
  printBootSplash(): void {
    const meta = MODE_META[this.mode];
    console.log('\n');
    console.log(`${C.bold}${C.cyan}╔══════════════════════════════════════════════════════════╗${C.reset}`);
    console.log(`${C.bold}${C.cyan}║                                                          ║${C.reset}`);
    console.log(`${C.bold}${C.cyan}║   ${C.white}P O I N T   Z E R O   O N E${C.cyan}                          ║${C.reset}`);
    console.log(`${C.bold}${C.cyan}║   ${C.gray}Sovereign Simulation · Financial Roguelike${C.cyan}            ║${C.reset}`);
    console.log(`${C.bold}${C.cyan}║                                                          ║${C.reset}`);
    console.log(`${C.bold}${C.cyan}║   ${this.accent}${C.bold}${meta.icon}  MODE: ${meta.label.padEnd(40)}${C.cyan}║${C.reset}`);
    console.log(`${C.bold}${C.cyan}║   ${C.gray}Density6 LLC · All Rights Reserved${C.cyan}                   ║${C.reset}`);
    console.log(`${C.bold}${C.cyan}╚══════════════════════════════════════════════════════════╝${C.reset}`);
    console.log('');
  }

  // ── Tutorial beat callout ────────────────────────────────────────────────────
  printTutorialBeat(beat: TutorialBeat): void {
    console.log('\n');
    console.log(`${C.bold}${this.accent}╔═══ 📖 TUTORIAL BEAT — T${beat.tick} ${'═'.repeat(30)}╗${C.reset}`);
    console.log(`${C.bold}${C.white}    ${beat.title}${C.reset}`);
    console.log(`${C.gray}${'─'.repeat(60)}${C.reset}`);
    const lines = beat.body.split('\n');
    for (const line of lines) {
      console.log(`    ${C.white}${line}${C.reset}`);
    }
    console.log(`${C.bold}${this.accent}╚${'═'.repeat(58)}╝${C.reset}`);
    console.log('');
  }

  // ── Tick status line ─────────────────────────────────────────────────────────
  printTickStatus(params: {
    tick:       number;
    totalTicks: number;
    cash:       number;
    netWorth:   number;
    cashflow:   number;
    pressure:   number;
    phase:      string;
    shieldPct:  number;
    cardsInHand: number;
    energy:     number;
    maxEnergy:  number;
  }): void {
    const { tick, totalTicks, cash, netWorth, cashflow, pressure, phase, shieldPct, cardsInHand, energy, maxEnergy } = params;
    const phasePad  = phase.padEnd(10).slice(0, 10);
    const tickPad   = String(tick).padStart(3, '0');
    const tickLeft  = ((totalTicks - tick) / 60).toFixed(1);
    const pPhase    = pressure >= 0.85 ? `${C.red}${phasePad}${C.reset}` : pressure >= 0.6 ? `${C.yellow}${phasePad}${C.reset}` : `${C.green}${phasePad}${C.reset}`;

    process.stdout.write(
      `${C.gray}T${tickPad}${C.reset} ` +
      `[${pPhase}] ` +
      `Cash:${fmtMoneyShort(cash)} ` +
      `NW:${fmtMoneyShort(netWorth)} ` +
      `CF:${fmtMoneyShort(cashflow)} ` +
      `P:${pressureBar(pressure)} ` +
      `⛨${bar(shieldPct, 1, 8)} ` +
      `E:${C.cyan}${energy}/${maxEnergy}${C.reset} ` +
      `🃏${C.magenta}${cardsInHand}${C.reset} ` +
      `${C.gray}${tickLeft}m left${C.reset}\n`
    );
  }

  // ── Card played event ────────────────────────────────────────────────────────
  printCardPlayed(cardName: string, effect: string, costEnergy: number): void {
    console.log(`  ${C.magenta}🃏 CARD${C.reset} ${C.bold}${cardName}${C.reset} ${C.gray}(−${costEnergy}E)${C.reset} → ${C.cyan}${effect}${C.reset}`);
  }

  // ── Event callouts ────────────────────────────────────────────────────────────
  printCrisisWarning(drawdown: number, severity: string): void {
    console.log(`\n${C.bgRed}${C.bold}  ⚠ CRISIS — ${severity} | Drawdown: ${(drawdown * 100).toFixed(1)}%  ${C.reset}`);
  }

  printBleedActivated(severity: string, cashflow: number): void {
    console.log(`\n${C.red}${C.bold}  🩸 BLEED ACTIVATED — ${severity} | Cashflow: ${fmtMoney(cashflow)}${C.reset}`);
    console.log(`  ${C.gray}Play COMEBACK_SURGE or increase income to resolve.${C.reset}`);
  }

  printBleedResolved(durationTicks: number): void {
    console.log(`\n${C.green}${C.bold}  ✓ BLEED RESOLVED — Survived ${durationTicks} ticks in distress.${C.reset}`);
  }

  printHaterBotSpawned(botName: string, attackType: string): void {
    console.log(`\n${C.red}  🤖 HATER BOT SPAWNED — ${C.bold}${botName}${C.reset}${C.red} | Attack: ${attackType}${C.reset}`);
    console.log(`  ${C.yellow}  Counter within 5 ticks or sabotage lands.${C.reset}`);
  }

  printCounterplaySuccess(botName: string): void {
    console.log(`  ${C.green}  ✓ COUNTERPLAY SUCCESS — ${botName} neutralized.${C.reset}`);
  }

  printShieldBreached(layer: string, repairCost: number): void {
    console.log(`\n${C.red}  💥 SHIELD ${layer} BREACHED — Repair: ${fmtMoney(repairCost)}${C.reset}`);
  }

  printShieldRepaired(layer: string): void {
    console.log(`  ${C.cyan}  🛡 SHIELD ${layer} RESTORED${C.reset}`);
  }

  printMonthlySettlement(tick: number, income: number, expenses: number, net: number, xpGained: number): void {
    console.log(`\n${hr()}`);
    console.log(`  ${C.bold}${C.cyan}📊 MONTHLY SETTLEMENT — T${tick}${C.reset}`);
    console.log(`     Income:   ${fmtMoney(income)}`);
    console.log(`     Expenses: ${fmtMoney(-expenses)}`);
    console.log(`     Net:      ${fmtMoney(net)}`);
    console.log(`     XP:       ${C.yellow}+${xpGained}${C.reset}`);
    console.log(hr());
    console.log('');
  }

  printGhostDelta(delta: number, legendScore: number): void {
    const sign   = delta >= 0 ? `${C.green}+` : `${C.red}`;
    const symbol = delta >= 0 ? '▲' : '▼';
    console.log(`  ${C.cyan}  ${symbol} GHOST DELTA: ${sign}${fmtMoneyShort(Math.abs(delta))}${C.reset} | Legend: ${C.yellow}${legendScore.toFixed(0)}${C.reset}`);
  }

  printTrustUpdate(playerId: string, from: number, to: number, reason: string): void {
    const dir = to >= from ? `${C.green}↑` : `${C.red}↓`;
    console.log(`  ${C.blue}  ${dir} TRUST [${playerId}]: ${from.toFixed(0)} → ${to.toFixed(0)}${C.reset} ${C.gray}(${reason})${C.reset}`);
  }

  printDefectionWarning(triggerPlayer: string, rescueOpen: boolean): void {
    console.log(`\n${C.red}${C.bold}  ⚡ DEFECTION SEQUENCE — ${triggerPlayer}${C.reset}`);
    if (rescueOpen) {
      console.log(`  ${C.cyan}  Rescue window OPEN. Your allies are evaluating your trust score.${C.reset}`);
    } else {
      console.log(`  ${C.yellow}  No rescue window. Low trust = no lifeline.${C.reset}`);
    }
  }

  // ── Run complete panel ───────────────────────────────────────────────────────
  printRunComplete(params: {
    outcome:     RunOutcome;
    cordScore:   number;
    cordTier:    string;
    finalCash:   number;
    finalNW:     number;
    totalXP:     number;
    cardsPlayed: number;
    ticksRun:    number;
    proofHash:   string;
    grade:       string;
    mode:        GameMode;
  }): void {
    const outcomeColor = {
      FREEDOM: C.green, TIMEOUT: C.yellow, BANKRUPT: C.red, ABANDONED: C.gray,
    }[params.outcome] ?? C.white;

    const meta = MODE_META[params.mode];

    console.log('\n');
    console.log(`${C.bold}${this.accent}╔══════════════════════════════════════════════════════════╗${C.reset}`);
    console.log(`${C.bold}${this.accent}║  ${meta.icon} RUN COMPLETE — ${params.mode.padEnd(43)}║${C.reset}`);
    console.log(`${C.bold}${this.accent}╠══════════════════════════════════════════════════════════╣${C.reset}`);
    console.log(`${C.bold}${this.accent}║  ${C.white}OUTCOME:     ${outcomeColor}${C.bold}${params.outcome.padEnd(45)}${this.accent}║${C.reset}`);
    console.log(`${C.bold}${this.accent}║  ${C.white}GRADE:       ${C.yellow}${C.bold}${params.grade.padEnd(45)}${this.accent}║${C.reset}`);
    console.log(`${C.bold}${this.accent}║  ${C.white}CORD SCORE:  ${C.cyan}${params.cordScore.toFixed(1).padEnd(45)}${this.accent}║${C.reset}`);
    console.log(`${C.bold}${this.accent}║  ${C.white}CORD TIER:   ${C.cyan}${params.cordTier.padEnd(45)}${this.accent}║${C.reset}`);
    console.log(`${C.bold}${this.accent}║  ${C.white}FINAL CASH:  ${fmtMoneyShort(params.finalCash).padEnd(55)}${this.accent}║${C.reset}`);
    console.log(`${C.bold}${this.accent}║  ${C.white}NET WORTH:   ${fmtMoneyShort(params.finalNW).padEnd(55)}${this.accent}║${C.reset}`);
    console.log(`${C.bold}${this.accent}║  ${C.white}TOTAL XP:    ${C.yellow}${String(params.totalXP).padEnd(45)}${this.accent}║${C.reset}`);
    console.log(`${C.bold}${this.accent}║  ${C.white}CARDS PLAYED:${C.magenta}${String(params.cardsPlayed).padEnd(45)}${this.accent}║${C.reset}`);
    console.log(`${C.bold}${this.accent}║  ${C.white}TICKS:       ${C.gray}${String(params.ticksRun).padEnd(45)}${this.accent}║${C.reset}`);
    console.log(`${C.bold}${this.accent}╠══════════════════════════════════════════════════════════╣${C.reset}`);
    console.log(`${C.bold}${this.accent}║  ${C.white}PROOF HASH:  ${C.gray}${params.proofHash.slice(0, 46).padEnd(45)}${this.accent}║${C.reset}`);
    console.log(`${C.bold}${this.accent}╚══════════════════════════════════════════════════════════╝${C.reset}`);
    console.log('');
  }

  // ── Mode intro ───────────────────────────────────────────────────────────────
  printModeIntro(mode: GameMode): void {
    const intros: Record<GameMode, string[]> = {
      EMPIRE: [
        'You are building an empire from nothing.',
        'Your enemies are your own expenses. Bleed is the tax on stagnation.',
        'Expand your income. Protect your cash layers. Or get consumed.',
      ],
      PREDATOR: [
        'You operate in the kill zone.',
        'Haters will try to sabotage your run. Counter them or bleed.',
        'Psyche is your edge. Tilt is your death.',
      ],
      SYNDICATE: [
        'You never run alone in a Syndicate.',
        'Trust is currency. Defectors collapse the treasury.',
        'Cooperate to survive. Defect at your own risk.',
      ],
      PHANTOM: [
        'You are racing against your own history.',
        'Your ghost never tires. Your legend decays if you stall.',
        'Beat your dynasty. Claim PHANTOM SOVEREIGN.',
      ],
    };

    const lines = intros[mode];
    const meta  = MODE_META[mode];
    console.log(`\n${C.bold}${this.accent}  ${meta.icon} ${meta.label} MODE${C.reset}`);
    console.log(hr(40));
    for (const line of lines) {
      console.log(`  ${C.white}${line}${C.reset}`);
    }
    console.log('');
  }

  // ── Summary line for demo stats ──────────────────────────────────────────────
  printDemoStats(params: {
    cardsPlayed:    number;
    cardsDrawn:     number;
    beatsFired:     number;
    crisisEvents:   number;
    shieldBreaches: number;
    settlementCount: number;
  }): void {
    console.log(`\n${C.gray}── Demo Stats ──────────────────────────────────────────${C.reset}`);
    console.log(`  Cards played:     ${C.magenta}${params.cardsPlayed}${C.reset}`);
    console.log(`  Cards drawn:      ${C.magenta}${params.cardsDrawn}${C.reset}`);
    console.log(`  Tutorial beats:   ${C.cyan}${params.beatsFired}${C.reset}`);
    console.log(`  Crisis events:    ${C.red}${params.crisisEvents}${C.reset}`);
    console.log(`  Shield breaches:  ${C.red}${params.shieldBreaches}${C.reset}`);
    console.log(`  Settlements:      ${C.yellow}${params.settlementCount}${C.reset}`);
    console.log('');
  }
}