// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — pzo-web/src/game/core/replayBuilder.ts
// Sprint 1: Replay Event Builder — extracted from App.tsx
// Density6 LLC · Confidential
// ═══════════════════════════════════════════════════════════════════════════

import type { TelemetryEnvelopeV2 } from '../types/runState';
import type { ReplayEvent } from '../../components/ReplayTimeline';

const KIND_MAP: Record<string, ReplayEvent['kind']> = {
  'cards.play':                   'CARD_PLAYED',
  'cards.play.fubar':             'FATE',
  'cards.play.missed_opportunity':'FATE',
  'fate.fubar_hit':               'FATE',
  'fate.missed':                  'FATE',
  'fate.privilege':               'MILESTONE',
  'macro.event':                  'REGIME_CHANGE',
  'economy.monthly_settlement':   'CARD_PLAYED',
  'shield.proc':                  'CARD_PLAYED',
};

const EMOJI_MAP: Record<string, string> = {
  'cards.play': '💳', 'fate.fubar_hit': '💀', 'fate.missed': '😬',
  'fate.privilege': '⭐', 'macro.event': '📉', 'shield.proc': '🛡️',
};

export function buildReplayEvents(telemetry: TelemetryEnvelopeV2[]): ReplayEvent[] {
  return telemetry
    .filter((ev) => KIND_MAP[ev.type])
    .map((ev) => ({
      tick:             ev.tick,
      kind:             KIND_MAP[ev.type] as ReplayEvent['kind'],
      label:            `${ev.type.replace('.', ' ').toUpperCase()} T+${ev.tick}`,
      netWorthAtTick:   Number(ev.payload.netWorth ?? 0),
      emoji:            EMOJI_MAP[ev.type] ?? '📌',
    }));
}
