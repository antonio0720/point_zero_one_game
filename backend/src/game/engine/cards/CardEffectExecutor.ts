/*
 * POINT ZERO ONE — BACKEND ENGINE 15X GENERATOR
 * Generated at: 2026-03-10T01:00:08.825776+00:00
 *
 * Doctrine:
 * - backend becomes the authoritative simulation surface
 * - seven engines remain distinct
 * - mode-native rules are enforced at runtime
 * - cards are backend-validated, not UI-trusted
 * - proof / integrity / CORD remain backend-owned
 */

import type { CardInstance } from '../core/GamePrimitives';
import type { RunStateSnapshot } from '../core/RunStateSnapshot';
import { CardEffectCompiler } from './CardEffectCompiler';

export class CardEffectExecutor {
  private readonly compiler = new CardEffectCompiler();

  public apply(snapshot: RunStateSnapshot, card: CardInstance, actorId: string): RunStateSnapshot {
    let next: RunStateSnapshot = {
      ...snapshot,
      economy: { ...snapshot.economy, cash: snapshot.economy.cash - card.cost },
    };

    for (const operation of this.compiler.compile(card)) {
      switch (operation.kind) {
        case 'cash':
          next = { ...next, economy: { ...next.economy, cash: next.economy.cash + Number(operation.magnitude) } };
          break;
        case 'income':
          next = { ...next, economy: { ...next.economy, incomePerTick: next.economy.incomePerTick + Number(operation.magnitude) } };
          break;
        case 'shield':
          next = {
            ...next,
            shield: {
              ...next.shield,
              layers: next.shield.layers.map((layer) => ({ ...layer, current: Math.max(0, Math.min(layer.max, layer.current + Number(operation.magnitude))) })),
            },
          };
          break;
        case 'heat':
          next = { ...next, economy: { ...next.economy, haterHeat: Math.max(0, next.economy.haterHeat + Number(operation.magnitude)) } };
          break;
        case 'trust':
          next = {
            ...next,
            modeState: {
              ...next.modeState,
              trustScores: {
                ...next.modeState.trustScores,
                [actorId]: Math.max(0, Math.min(100, (next.modeState.trustScores[actorId] ?? 70) + Number(operation.magnitude))),
              },
            },
          };
          break;
        case 'time':
          next = { ...next, timers: { ...next.timers, extensionBudgetMs: next.timers.extensionBudgetMs + Number(operation.magnitude) } };
          break;
        case 'divergence':
          next = { ...next, sovereignty: { ...next.sovereignty, gapVsLegend: Number((next.sovereignty.gapVsLegend + Number(operation.magnitude)).toFixed(4)) } };
          break;
        case 'inject':
          next = { ...next, cards: { ...next.cards, drawHistory: [...next.cards.drawHistory, ...(operation.magnitude as string[])] } };
          break;
      }
    }

    if (card.definitionId === 'SYSTEMIC_OVERRIDE') {
      next = {
        ...next,
        battle: {
          ...next.battle,
          bots: next.battle.bots.map((bot) => ({ ...bot, heat: 0, state: 'DORMANT' })),
        },
      };
    }

    if (card.definitionId === 'CASCADE_BREAK') {
      next = {
        ...next,
        cascade: {
          ...next.cascade,
          brokenChains: next.cascade.brokenChains + next.cascade.activeChains.length,
          activeChains: [],
        },
      };
    }

    if (card.definitionId === 'BREAK_PACT' || card.definitionId === 'SILENT_EXIT' || card.definitionId === 'ASSET_SEIZURE') {
      const step = card.definitionId === 'BREAK_PACT' ? 1 : card.definitionId === 'SILENT_EXIT' ? 2 : 3;
      const currentStep = next.modeState.defectionStepByPlayer[actorId] ?? 0;
      if (step === currentStep + 1) {
        const trustScores = { ...next.modeState.trustScores, [actorId]: Math.max(0, (next.modeState.trustScores[actorId] ?? 70) - (step === 1 ? 5 : step === 2 ? 10 : 20)) };
        next = { ...next, modeState: { ...next.modeState, trustScores, defectionStepByPlayer: { ...next.modeState.defectionStepByPlayer, [actorId]: step } } };
        if (step === 3) {
          const theft = Math.floor(next.modeState.sharedTreasuryBalance * 0.4);
          next = {
            ...next,
            economy: { ...next.economy, cash: next.economy.cash + theft },
            modeState: { ...next.modeState, sharedTreasuryBalance: Math.max(0, next.modeState.sharedTreasuryBalance - theft) },
            sovereignty: { ...next.sovereignty, sovereigntyScore: Number((next.sovereignty.sovereigntyScore - 0.15).toFixed(4)) },
          };
        }
      }
    }

    return next;
  }
}
