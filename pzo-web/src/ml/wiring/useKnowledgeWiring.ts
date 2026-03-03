/**
 * useKnowledgeWiring — src/ml/wiring/useKnowledgeWiring.ts
 * Point Zero One · Density6 LLC · Confidential
 *
 * Call recordMLCardPlay() after every CARD_PLAY_RESOLVED dispatch.
 */

import { useCallback } from 'react';
import { useML } from './MLContext';
import type { PlayOutcome } from '../KnowledgeTracer';

interface CardPlayEvent {
  card: {
    educationalTag?:  string;
    educational_tag?: string;
    zone?:            string;
    type?:            string;
  };
  cashDelta:       number;
  incomeDelta:     number;
  netWorthDelta?:  number;
  responseMs?:     number;
}

interface RunStateLike {
  tick:         number;
  pressureTier: 1 | 2 | 3 | 4 | 5;
  windows:      { recentResponseMs: number[] };
}

const WINDOW_MS: Record<number, number> = { 1:12_000, 2:9_000, 3:6_000, 4:4_000, 5:2_500 };
const ZONE_TAG:  Record<string, string> = {
  BUILD:'cashflow_management', SCALE:'leverage_risk',
  FLIP:'market_timing', RESERVE:'liquidity_management', LEARN:'due_diligence',
};

export function useKnowledgeWiring(state: RunStateLike) {
  const { actions } = useML();

  const recordMLCardPlay = useCallback((event: CardPlayEvent) => {
    const tier       = state.pressureTier;
    const recentResponses = state.windows.recentResponseMs;
    const responseMs = event.responseMs ?? (recentResponses.length > 0 ? recentResponses[recentResponses.length - 1] : undefined) ?? 3_000;
    const tag        = event.card.educationalTag ?? event.card.educational_tag
                    ?? (event.card.zone ? ZONE_TAG[event.card.zone] : undefined)
                    ?? 'cashflow_management';
    const notFubar   = event.card.type !== 'FUBAR';
    const positive   = event.cashDelta > 0 || event.incomeDelta > 0 || (event.netWorthDelta ?? 0) > 0;
    const wasCorrect = tier >= 3 ? notFubar : (notFubar && positive);
    const speedScore = Math.max(0, Math.min(1, 1 - responseMs / (WINDOW_MS[tier] ?? 6_000)));

    const outcome: PlayOutcome = {
      tag, wasCorrect, pressureTier: tier, tick: state.tick, speedScore,
    };
    actions.recordCardPlay(outcome);
  }, [state, actions]);

  return { recordMLCardPlay };
}