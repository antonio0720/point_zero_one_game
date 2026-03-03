// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — pzo-web/src/game/core/replayBuilder.ts
// Sprint 3: Replay Event Builder — Engine-Complete
// Density6 LLC · Confidential · All Rights Reserved
// ═══════════════════════════════════════════════════════════════════════════
// Transforms raw telemetry envelopes into ReplayTimeline events.
// Now includes all 7 engine event types: shield breaches, cascade chains,
// bot attacks, decision windows, positive cascades, and sovereignty proofs.
//
// ARCHITECTURE: Pure function — no side effects, no state.
// Input: TelemetryEnvelopeV2[]  →  Output: ReplayEvent[]
// ═══════════════════════════════════════════════════════════════════════════

import type { TelemetryEnvelopeV2 } from '../types/runState';
import type { ReplayEvent }          from '../../components/ReplayTimeline';
import { fmtMoney, fmtBotName, fmtChainId } from './format';
import { snakeToTitle }               from './format';

// ── Event Kind Map — telemetry type → ReplayEvent.kind ────────────────────────
// Unmapped event types are silently dropped (filter before map).

const KIND_MAP: Record<string, ReplayEvent['kind']> = {
  // Card events
  'cards.play':                    'CARD_PLAYED',
  'cards.play.opportunity':        'CARD_PLAYED',
  'cards.play.ipa':                'CARD_PLAYED',
  'cards.play.privileged':         'MILESTONE',
  'cards.play.fubar':              'FATE',
  'cards.play.missed_opportunity': 'FATE',
  'cards.play.so':                 'FATE',
  'cards.rejected':                'FATE',

  // Fate / forced cards
  'fate.fubar_hit':                'FATE',
  'fate.missed':                   'FATE',
  'fate.privilege':                'MILESTONE',
  'fate.obstacle':                 'FATE',

  // Macro / regime
  'macro.event':                   'REGIME_CHANGE',
  'macro.regime_change':           'REGIME_CHANGE',

  // Economy
  'economy.monthly_settlement':    'CARD_PLAYED',
  'economy.freedom_threshold':     'MILESTONE',
  'economy.bankruptcy':            'FATE',

  // Shield engine
  'shield.proc':                   'CARD_PLAYED',
  'shield.breach':                 'FATE',
  'shield.l4_breach':              'FATE',
  'shield.repaired':               'CARD_PLAYED',
  'shield.fortified':              'MILESTONE',

  // Battle engine
  'battle.bot_attack':             'FATE',
  'battle.bot_neutralized':        'MILESTONE',
  'battle.sabotage_fired':         'FATE',
  'battle.sabotage_blocked':       'MILESTONE',

  // Cascade engine
  'cascade.triggered':             'FATE',
  'cascade.completed':             'CARD_PLAYED',
  'cascade.positive_activated':    'MILESTONE',
  'cascade.nemesis_broken':        'MILESTONE',

  // Time / decision
  'decision.window_opened':        'CARD_PLAYED',
  'decision.window_expired':       'FATE',
  'decision.window_resolved':      'CARD_PLAYED',
  'time.tick_tier_changed':        'REGIME_CHANGE',
  'time.season_timeout_imminent':  'FATE',

  // Sovereignty
  'sovereignty.proof_generated':   'MILESTONE',
  'sovereignty.run_graded':        'MILESTONE',

  // Empire / Phantom / Syndicate / Predator mode events
  'empire.card_play':              'CARD_PLAYED',
  'empire.recovery_during_cascade':'MILESTONE',
  'predator.bb_generated':         'CARD_PLAYED',
  'predator.privilege_extracted':  'MILESTONE',
  'syndicate.rescue_play':         'MILESTONE',
  'syndicate.defection_signal':    'FATE',
  'phantom.card_play':             'CARD_PLAYED',
  'phantom.dynasty_play':          'MILESTONE',
};

// ── Emoji Map — telemetry type → display icon ─────────────────────────────────

const EMOJI_MAP: Record<string, string> = {
  'cards.play':                    '💳',
  'cards.play.opportunity':        '◆',
  'cards.play.ipa':                '▲',
  'cards.play.privileged':         '✦',
  'cards.play.fubar':              '💀',
  'cards.play.missed_opportunity': '😬',
  'fate.fubar_hit':                '💀',
  'fate.missed':                   '😬',
  'fate.privilege':                '⭐',
  'macro.event':                   '📉',
  'macro.regime_change':           '🌐',
  'economy.monthly_settlement':    '💰',
  'economy.freedom_threshold':     '🏆',
  'economy.bankruptcy':            '🔴',
  'shield.proc':                   '🛡',
  'shield.breach':                 '⚠',
  'shield.l4_breach':              '🚨',
  'shield.repaired':               '🔧',
  'shield.fortified':              '🏰',
  'battle.bot_attack':             '⚔',
  'battle.bot_neutralized':        '✓',
  'battle.sabotage_fired':         '💣',
  'battle.sabotage_blocked':       '🛡',
  'cascade.triggered':             '🌊',
  'cascade.positive_activated':    '✨',
  'cascade.nemesis_broken':        '💀',
  'decision.window_opened':        '⏱',
  'decision.window_expired':       '⌛',
  'sovereignty.run_graded':        '🏆',
  'time.tick_tier_changed':        '⚡',
  'syndicate.rescue_play':         '🤝',
  'syndicate.defection_signal':    '🗡',
  'phantom.dynasty_play':          '👑',
};

// ── Label Builders ────────────────────────────────────────────────────────────

function buildLabel(ev: TelemetryEnvelopeV2): string {
  const p = ev.payload as Record<string, unknown>;

  switch (ev.type) {
    case 'cards.play':
    case 'cards.play.opportunity':
    case 'cards.play.ipa':
    case 'empire.card_play':
    case 'phantom.card_play':
      return `${p.cardId ?? 'Card'} played (+${fmtMoney(Number(p.cashflowMonthly ?? 0))}/mo)`;

    case 'cards.play.privileged':
    case 'fate.privilege':
    case 'predator.privilege_extracted':
    case 'phantom.dynasty_play':
      return `Privileged: +${fmtMoney(Number(p.value ?? 0))} net worth`;

    case 'fate.fubar_hit':
    case 'cards.play.fubar':
      return `FUBAR: ${fmtMoney(Number(p.cashImpact ?? p.damage ?? 0))} hit`;

    case 'fate.missed':
    case 'cards.play.missed_opportunity':
      return `Missed: ${p.turnsLost ?? 1} tick(s) lost`;

    case 'shield.breach':
      return `Shield breach: ${snakeToTitle(String(p.layer ?? 'UNKNOWN'))}`;

    case 'shield.l4_breach':
      return 'NETWORK CORE BREACHED — cascade triggered';

    case 'shield.fortified':
      return 'All shields FORTIFIED';

    case 'battle.bot_attack':
      return `${fmtBotName(String(p.botId ?? ''))} attacked via ${snakeToTitle(String(p.attackType ?? ''))}`;

    case 'battle.bot_neutralized':
      return `${fmtBotName(String(p.botId ?? ''))} NEUTRALIZED`;

    case 'battle.sabotage_fired':
      return `Sabotage: ${snakeToTitle(String(p.sabotageType ?? ''))}`;

    case 'cascade.triggered':
      return `Cascade: ${fmtChainId(String(p.chainId ?? ''))} — ${p.severity ?? 'MODERATE'}`;

    case 'cascade.positive_activated':
      return `✨ ${p.chainName ?? 'Positive cascade'} activated`;

    case 'cascade.nemesis_broken':
      return `NEMESIS BROKEN: ${fmtBotName(String(p.botId ?? ''))}`;

    case 'economy.freedom_threshold':
      return `FREEDOM achieved — ${fmtMoney(Number(p.netWorth ?? 0))}`;

    case 'economy.bankruptcy':
      return 'BANKRUPTCY EVENT';

    case 'economy.monthly_settlement':
      return `Month settled — cash: ${fmtMoney(Number(p.cashAfter ?? 0))}`;

    case 'decision.window_expired':
      return `Decision expired — card ${p.cardId ?? '?'} auto-resolved`;

    case 'time.tick_tier_changed':
      return `Tick tier: ${p.from} → ${p.to}`;

    case 'sovereignty.run_graded':
      return `Run graded: ${p.grade} — ${p.sovereigntyScore ?? 0} pts`;

    case 'syndicate.rescue_play':
      return `Rescue played — +${fmtMoney(Number(p.rescueBonus ?? 0))} bonus`;

    case 'syndicate.defection_signal':
      return `Defection signal at tick ${p.tick ?? '?'}`;

    case 'macro.regime_change':
    case 'macro.event':
      return `Market event: ${snakeToTitle(String(p.eventType ?? p.event ?? 'Unknown'))}`;

    default: {
      const label = ev.type.replace(/\./g, ' ').toUpperCase();
      return `${label} T+${ev.tick}`;
    }
  }
}

// ── Net Worth Extractor ───────────────────────────────────────────────────────

function extractNetWorth(ev: TelemetryEnvelopeV2): number {
  const p = ev.payload as Record<string, unknown>;
  return Number(
    p.netWorthAfter ??
    p.netWorth      ??
    p.finalNetWorth ??
    0
  );
}

// ── Main Builder ──────────────────────────────────────────────────────────────

/**
 * Convert raw telemetry events into ReplayTimeline-compatible events.
 * Filters out unmapped event types.
 * Sorts by tick ascending for timeline order.
 */
export function buildReplayEvents(telemetry: TelemetryEnvelopeV2[]): ReplayEvent[] {
  return telemetry
    .filter((ev) => KIND_MAP[ev.type] !== undefined)
    .map((ev) => ({
      tick:           ev.tick,
      kind:           KIND_MAP[ev.type] as ReplayEvent['kind'],
      label:          buildLabel(ev),
      netWorthAtTick: extractNetWorth(ev),
      emoji:          EMOJI_MAP[ev.type] ?? '📌',
    }))
    .sort((a, b) => a.tick - b.tick);
}

/**
 * Extract key moments (MILESTONE + FATE only) — used by ProofCard narrative.
 * Returns top N by impact (MILESTONE first, then FATE).
 */
export function extractKeyMoments(
  telemetry: TelemetryEnvelopeV2[],
  topN = 10,
): ReplayEvent[] {
  const all = buildReplayEvents(telemetry);
  const milestones = all.filter(e => e.kind === 'MILESTONE');
  const fates      = all.filter(e => e.kind === 'FATE');
  return [...milestones, ...fates].slice(0, topN);
}

/**
 * Count events by kind — used by Sovereignty engine scoring.
 */
export function countEventsByKind(telemetry: TelemetryEnvelopeV2[]): Record<ReplayEvent['kind'], number> {
  const counts: Record<string, number> = {
    CARD_PLAYED: 0, FATE: 0, MILESTONE: 0, REGIME_CHANGE: 0,
  };
  for (const ev of telemetry) {
    const kind = KIND_MAP[ev.type];
    if (kind) counts[kind] = (counts[kind] ?? 0) + 1;
  }
  return counts as Record<ReplayEvent['kind'], number>;
}
