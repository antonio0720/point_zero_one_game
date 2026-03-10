import type { BaseCardLike, EngineSnapshotLike, EventFeedItem, FrontendModeAdapter, FrontendModeState, SoloProjection } from '../contracts';
import { MODE_TO_CODE, MODE_TO_LABEL, MODE_TO_SCREEN, SOLO_HOLD_RULES } from '../shared/constants';
import { applyModeOverlays } from '../shared/cardOverlay';
import { projectCORD } from '../shared/cord';
import { determineSoloPhase, safeNumber, toPrimaryBars, toShieldBars } from '../shared/helpers';

export class EmpireModeModel implements FrontendModeAdapter {
  readonly runMode = 'solo' as const;
  readonly modeCode = MODE_TO_CODE.solo;
  readonly uiLabel = MODE_TO_LABEL.solo;
  readonly screenName = MODE_TO_SCREEN.solo;

  bootstrap(snapshot: EngineSnapshotLike, cards: BaseCardLike[] = []): FrontendModeState {
    return this.reduce(emptyState(this), snapshot, cards);
  }

  reduce(prev: FrontendModeState, snapshot: EngineSnapshotLike, cards: BaseCardLike[] = []): FrontendModeState {
    const phase = determineSoloPhase(snapshot.elapsedMs);
    const cashBelowThreshold = snapshot.cash < 2_000;
    const comebackTicks = cashBelowThreshold ? (prev.solo?.comebackTicks ?? 0) + 1 : 0;
    const comebackSurgeActive = !cashBelowThreshold && (prev.solo?.comebackTicks ?? 0) >= 15 && snapshot.cash >= 8_000;
    const momentumScore = computeMomentum(snapshot, cards);
    const isolationTaxActive = snapshot.incomePerTick <= 0 && snapshot.tick >= 3;
    const holdState = {
      baseHolds: SOLO_HOLD_RULES.freeHolds,
      bonusHolds: momentumScore > SOLO_HOLD_RULES.bonusMomentumThreshold ? 1 : 0,
      usedHolds: safeNumber((prev.solo?.holdState.usedHolds ?? 0), 0),
      holdAllowed: !isBleedMode(prev, snapshot),
      noHoldBonusEligible: (prev.solo?.holdState.usedHolds ?? 0) === 0,
    };
    const solo: SoloProjection = {
      phase,
      isolationTaxActive,
      isolationTaxRate: isolationTaxActive ? 0.002 : 0,
      bleedMode: isBleedMode(prev, snapshot),
      comebackSurgeActive,
      comebackTicks,
      pressureJournalEntry: composePressureJournal(snapshot, phase, isolationTaxActive),
      holdState,
    };
    const runtimeCards = applyModeOverlays(cards, {
      mode: 'solo',
      momentumScore,
      pressureTierMultiplier: snapshot.pressureTier === 'T4' ? 1.15 : snapshot.pressureTier === 'T3' ? 1.08 : 1,
    });
    return {
      runMode: 'solo',
      modeCode: this.modeCode,
      uiLabel: this.uiLabel,
      screenName: this.screenName,
      tick: snapshot.tick,
      elapsedMs: snapshot.elapsedMs,
      totalRunMs: snapshot.totalRunMs,
      pressureTier: snapshot.pressureTier,
      shieldBars: toShieldBars(snapshot),
      primaryBars: toPrimaryBars(snapshot),
      eventFeed: appendEvents(prev.eventFeed, buildEmpireEvents(snapshot, phase, isolationTaxActive, comebackSurgeActive)),
      cord: projectCORD('solo', snapshot, {
        clutch: safeNumber(snapshot.decisionSpeedScore, 0) > 0.82 && snapshot.pressureTier >= 'T3',
        noHoldRun: holdState.usedHolds === 0,
        sovereignSweep: runtimeCards.filter(card => card.deck_type === 'OPPORTUNITY').length >= 3 && !runtimeCards.some(card => card.deck_type === 'FUBAR'),
        bleedRun: solo.bleedMode && snapshot.netWorth >= snapshot.freedomThreshold,
      }),
      runtimeCards,
      solo,
    };
  }
}

function emptyState(model: EmpireModeModel): FrontendModeState {
  return {
    runMode: 'solo',
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
    cord: projectCORD('solo', {
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

function computeMomentum(snapshot: EngineSnapshotLike, cards: BaseCardLike[]): number {
  const opportunityCount = cards.filter(card => card.deck_type === 'OPPORTUNITY' || card.deck_type === 'IPA').length;
  const cashFactor = Math.min(1, Math.max(0, snapshot.cash / Math.max(snapshot.freedomThreshold * 0.2, 1)));
  return Math.min(1, opportunityCount * 0.12 + cashFactor * 0.5);
}

function buildEmpireEvents(
  snapshot: EngineSnapshotLike,
  phase: SoloProjection['phase'],
  isolationTaxActive: boolean,
  comebackSurgeActive: boolean,
): EventFeedItem[] {
  const events: EventFeedItem[] = [];
  if (snapshot.tick === 1) {
    events.push({ id: `empire-start-${snapshot.runId}`, tick: snapshot.tick, title: 'Foundation Open', body: 'Safe window active. Build income before the haters wake up.', severity: 'info', lane: 'system' });
  }
  if (phase === 'ESCALATION') {
    events.push({ id: `empire-phase-2-${snapshot.tick}`, tick: snapshot.tick, title: 'Escalation', body: 'Phase 2 has begun. The haters are awake.', severity: 'warn', lane: 'system' });
  }
  if (phase === 'SOVEREIGNTY' && snapshot.tick % 15 === 0) {
    events.push({ id: `empire-phase-3-${snapshot.tick}`, tick: snapshot.tick, title: 'Sovereignty Pressure', body: 'T3/T4 tempo active. Every forced choice now carries proof weight.', severity: 'danger', lane: 'system' });
  }
  if (isolationTaxActive) {
    events.push({ id: `empire-tax-${snapshot.tick}`, tick: snapshot.tick, title: 'Isolation Tax', body: 'No income asset active. Passive CORD drain has started.', severity: 'warn', lane: 'cards' });
  }
  if (comebackSurgeActive) {
    events.push({ id: `empire-surge-${snapshot.tick}`, tick: snapshot.tick, title: 'Comeback Surge', body: 'Recovery confirmed. Decision-speed bonus is temporarily amplified.', severity: 'success', lane: 'system' });
  }
  return events;
}

function appendEvents(prev: EventFeedItem[], next: EventFeedItem[]): EventFeedItem[] {
  const merged = [...prev, ...next];
  return merged.slice(-18);
}

function composePressureJournal(snapshot: EngineSnapshotLike, phase: SoloProjection['phase'], isolationTaxActive: boolean): string {
  if (phase === 'FOUNDATION') {
    return 'Foundation window active. Stack early income before escalation begins.';
  }
  if (isolationTaxActive) {
    return 'Isolation Tax is active. Add an income source immediately or bleed proof value every tick.';
  }
  if (phase === 'ESCALATION') {
    return 'Escalation is live. Hesitation now increases Manipulator leverage and shrinks safe windows.';
  }
  if (snapshot.netWorth >= snapshot.freedomThreshold * 0.85) {
    return 'You are within striking distance of freedom. Protect shields and preserve timing discipline.';
  }
  return 'Sovereignty phase active. Every surviving tick under high pressure is worth more proof.';
}

function isBleedMode(prev: FrontendModeState, snapshot: EngineSnapshotLike): boolean {
  return Boolean(prev.solo?.bleedMode) || (snapshot.totalRunMs <= 9 * 60_000 && snapshot.cash <= 10_000);
}
