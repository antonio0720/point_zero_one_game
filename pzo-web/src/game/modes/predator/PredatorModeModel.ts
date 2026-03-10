import type { BaseCardLike, EngineSnapshotLike, EventFeedItem, FrontendModeAdapter, FrontendModeState, PredatorProjection } from '../contracts';
import { MODE_TO_CODE, MODE_TO_LABEL, MODE_TO_SCREEN, PREDATOR_RULES } from '../shared/constants';
import { applyModeOverlays } from '../shared/cardOverlay';
import { projectCORD } from '../shared/cord';
import { classifyPsyche, safeNumber, toPrimaryBars, toShieldBars } from '../shared/helpers';

export class PredatorModeModel implements FrontendModeAdapter {
  readonly runMode = 'asymmetric-pvp' as const;
  readonly modeCode = MODE_TO_CODE['asymmetric-pvp'];
  readonly uiLabel = MODE_TO_LABEL['asymmetric-pvp'];
  readonly screenName = MODE_TO_SCREEN['asymmetric-pvp'];

  bootstrap(snapshot: EngineSnapshotLike, cards: BaseCardLike[] = []): FrontendModeState {
    return this.reduce(emptyState(this), snapshot, cards);
  }

  reduce(prev: FrontendModeState, snapshot: EngineSnapshotLike, cards: BaseCardLike[] = []): FrontendModeState {
    const battleBudget = clampBudget(snapshot, prev);
    const runtimeCards = applyModeOverlays(cards, {
      mode: 'asymmetric-pvp',
      pressureTierMultiplier: snapshot.pressureTier === 'T4' ? 1.15 : snapshot.pressureTier === 'T3' ? 1.08 : 1,
    });
    const psycheState = classifyPsyche(snapshot);
    const predator: PredatorProjection = {
      battleBudget,
      battleBudgetCap: PREDATOR_RULES.battleBudgetCap,
      psycheState,
      firstBloodAvailable: snapshot.tick <= 3 && safeNumber(snapshot.blockedSabotages, 0) === 0,
      counterWindowOpen: runtimeCards.some(card => card.deck_type === 'COUNTER' && card.runtime_timing.includes('CTR')),
      visibleThreatQueue: buildThreatQueue(runtimeCards, snapshot),
      spectatorProjection: {
        liveViewers: Math.min(50, Math.max(0, Math.round((snapshot.tick % 17) * 1.7))),
        predictionBiasPct: Math.max(5, Math.min(95, Math.round((snapshot.netWorth / Math.max(snapshot.freedomThreshold, 1)) * 100))),
        cordLead: round(snapshot.netWorth - safeNumber(snapshot.opponent?.netWorth, 0)),
      },
    };
    return {
      runMode: this.runMode,
      modeCode: this.modeCode,
      uiLabel: this.uiLabel,
      screenName: this.screenName,
      tick: snapshot.tick,
      elapsedMs: snapshot.elapsedMs,
      totalRunMs: snapshot.totalRunMs,
      pressureTier: snapshot.pressureTier,
      shieldBars: toShieldBars(snapshot),
      primaryBars: toPrimaryBars(snapshot),
      eventFeed: appendEvents(prev.eventFeed, buildPredatorEvents(snapshot, predator)),
      cord: projectCORD('asymmetric-pvp', snapshot, {
        firstBlood: predator.firstBloodAvailable && battleBudget > 25,
        perfectCounter: safeNumber(snapshot.blockedSabotages, 0) >= 3,
        economicAnnihilation: safeNumber(snapshot.opponent?.netWorth, 1) < 0 && snapshot.tick < 400,
      }),
      runtimeCards,
      predator,
    };
  }
}

function emptyState(model: PredatorModeModel): FrontendModeState {
  return {
    runMode: model.runMode,
    modeCode: model.modeCode,
    uiLabel: model.uiLabel,
    screenName: model.screenName,
    tick: 0,
    elapsedMs: 0,
    totalRunMs: 12 * 60_000,
    pressureTier: 'T1',
    shieldBars: [],
    primaryBars: [],
    eventFeed: [],
    cord: projectCORD('asymmetric-pvp', {
      runId: 'bootstrap',
      seed: 'bootstrap',
      tick: 0,
      elapsedMs: 0,
      totalRunMs: 12 * 60_000,
      cash: 0,
      netWorth: 0,
      incomePerTick: 0,
      expensePerTick: 0,
      freedomThreshold: 100_000,
      pressureTier: 'T1',
      shields: { L1: 100, L2: 100, L3: 100, L4: 100 },
    }),
    runtimeCards: [],
  };
}

function clampBudget(snapshot: EngineSnapshotLike, prev: FrontendModeState): number {
  const passiveGain = snapshot.pressureTier === 'T3' || snapshot.pressureTier === 'T4' ? 4 : 2;
  const current = snapshot.battleBudget ?? prev.predator?.battleBudget ?? 0;
  const earned = current + passiveGain;
  return Math.max(0, Math.min(PREDATOR_RULES.battleBudgetCap, earned));
}

function buildThreatQueue(cards: BaseCardLike[], snapshot: EngineSnapshotLike): string[] {
  const visible = cards
    .filter(card => ['SABOTAGE', 'BLUFF', 'COUNTER'].includes(card.deck_type))
    .slice(0, 3)
    .map(card => `${card.name} · ${card.deck_type}`);
  if (snapshot.opponent?.netWorth && snapshot.opponent.netWorth > snapshot.netWorth) {
    visible.unshift('Shared bot pool bias: opponent currently attracting more threat heat');
  }
  return visible.slice(0, 3);
}

function buildPredatorEvents(snapshot: EngineSnapshotLike, predator: PredatorProjection): EventFeedItem[] {
  const items: EventFeedItem[] = [];
  if (predator.firstBloodAvailable) {
    items.push({ id: `predator-fb-${snapshot.tick}`, tick: snapshot.tick, title: 'First Blood Window', body: 'Land the first extraction to secure early BB momentum.', severity: 'info', lane: 'combat' });
  }
  if (predator.counterWindowOpen) {
    items.push({ id: `predator-counter-${snapshot.tick}`, tick: snapshot.tick, title: 'Counter Window Armed', body: 'Hold your BB. Reactive defense is now online.', severity: 'warn', lane: 'combat' });
  }
  if (predator.psycheState === 'CRACKING' || predator.psycheState === 'BREAKING') {
    items.push({ id: `predator-psyche-${snapshot.tick}`, tick: snapshot.tick, title: `Opponent ${predator.psycheState}`, body: 'Their defensive posture is weakening. Escalate with pressure, not panic.', severity: 'danger', lane: 'combat' });
  }
  return items;
}

function appendEvents(prev: EventFeedItem[], next: EventFeedItem[]): EventFeedItem[] {
  return [...prev, ...next].slice(-18);
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
