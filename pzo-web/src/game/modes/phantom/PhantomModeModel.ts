import type { BaseCardLike, EngineSnapshotLike, EventFeedItem, FrontendModeAdapter, FrontendModeState, LegendMarker, PhantomProjection } from '../contracts';
import { MODE_TO_CODE, MODE_TO_LABEL, MODE_TO_SCREEN, PHANTOM_RULES } from '../shared/constants';
import { applyModeOverlays } from '../shared/cardOverlay';
import { projectCORD } from '../shared/cord';
import { determineGapDirection, determineLegendDecay, safeNumber, toPrimaryBars, toShieldBars } from '../shared/helpers';

export class PhantomModeModel implements FrontendModeAdapter {
  readonly runMode = 'ghost' as const;
  readonly modeCode = MODE_TO_CODE.ghost;
  readonly uiLabel = MODE_TO_LABEL.ghost;
  readonly screenName = MODE_TO_SCREEN.ghost;

  bootstrap(snapshot: EngineSnapshotLike, cards: BaseCardLike[] = []): FrontendModeState {
    return this.reduce(emptyState(this), snapshot, cards);
  }

  reduce(prev: FrontendModeState, snapshot: EngineSnapshotLike, cards: BaseCardLike[] = []): FrontendModeState {
    const legendCord = safeNumber(snapshot.ghost?.legendCord, 1);
    const currentGap = legendCord <= 0 ? 0 : (snapshot.netWorth / Math.max(snapshot.freedomThreshold, 1)) - legendCord;
    const marker = activeMarker(snapshot.ghost?.markers ?? [], snapshot.tick);
    const runtimeCards = applyModeOverlays(cards, {
      mode: 'ghost',
      nearLegendMarker: Boolean(marker),
      pressureTierMultiplier: snapshot.pressureTier === 'T4' ? 1.1 : snapshot.pressureTier === 'T3' ? 1.05 : 1,
    });
    const decay = determineLegendDecay(safeNumber(snapshot.ghost?.legendAgeHours, 0));
    const phantom: PhantomProjection = {
      gapDirection: determineGapDirection(currentGap),
      gapValue: round(currentGap),
      legendDecayTier: `${decay.label} · ${decay.attack}`,
      markerWindowOpen: Boolean(marker),
      currentMarker: marker,
      proofBadges: buildProofBadges(snapshot, currentGap, runtimeCards.length),
      historicalDifficultyRating: computeDifficultyRating(snapshot),
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
      eventFeed: appendEvents(prev.eventFeed, buildPhantomEvents(snapshot, phantom)),
      cord: projectCORD('ghost', snapshot, {
        ghostSlayer: currentGap > 0.15,
        legendGap: currentGap > 0.20,
        dynasty: safeNumber(snapshot.ghost?.challengersBeaten, 0) >= 3 && currentGap > 0.20,
        ironGhost: safeNumber(snapshot.ghost?.legendAgeHours, 0) >= 24 * 30 && currentGap > 0.05,
      }),
      runtimeCards,
      phantom,
    };
  }
}

function emptyState(model: PhantomModeModel): FrontendModeState {
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
    cord: projectCORD('ghost', {
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

function activeMarker(markers: LegendMarker[], tick: number): LegendMarker | null {
  return markers.find(marker => Math.abs(marker.tick - tick) <= PHANTOM_RULES.benchmarkWindowTicks) ?? null;
}

function buildProofBadges(snapshot: EngineSnapshotLike, gap: number, cardCount: number): string[] {
  const badges: string[] = [];
  if (gap > 0 && snapshot.cash < 3_000) badges.push('COMEBACK_LEGEND');
  if (gap > 0.15) badges.push('GHOST_SLAYER');
  if (cardCount <= 12 && gap > 0) badges.push('MINIMALIST');
  if (snapshot.blockedSabotages === 0) badges.push('CLEAN_RUN');
  return badges;
}

function computeDifficultyRating(snapshot: EngineSnapshotLike): number {
  const challengeCount = safeNumber(snapshot.ghost?.challengeCount, 0);
  const beatRate = safeNumber(snapshot.ghost?.beatRate, 0);
  const averageGap = safeNumber(snapshot.ghost?.averageClosingGap, 0.05);
  const decay = determineLegendDecay(safeNumber(snapshot.ghost?.legendAgeHours, 0));
  const raw = challengeCount * 0.35 + (1 - beatRate) * 30 + (1 - averageGap) * 20 + decay.severity * 25;
  return Math.max(1, Math.min(100, Math.round(raw)));
}

function buildPhantomEvents(snapshot: EngineSnapshotLike, projection: PhantomProjection): EventFeedItem[] {
  const items: EventFeedItem[] = [];
  if (projection.markerWindowOpen && projection.currentMarker) {
    items.push({ id: `phantom-marker-${snapshot.tick}`, tick: snapshot.tick, title: `${projection.currentMarker.type} Marker`, body: projection.currentMarker.note, severity: 'info', lane: 'ghost' });
  }
  if (projection.gapDirection === 'UP') {
    items.push({ id: `phantom-gap-up-${snapshot.tick}`, tick: snapshot.tick, title: 'Closing the Gap', body: 'Your current line is outperforming the legend projection.', severity: 'success', lane: 'ghost' });
  }
  if (projection.legendDecayTier.includes('SYSTEM_GLITCH') || projection.historicalDifficultyRating > 80) {
    items.push({ id: `phantom-fortress-${snapshot.tick}`, tick: snapshot.tick, title: 'Historical Fortress', body: 'This record has aged into a hostile fortress. Precision windows are everything.', severity: 'danger', lane: 'ghost' });
  }
  return items;
}

function appendEvents(prev: EventFeedItem[], next: EventFeedItem[]): EventFeedItem[] {
  return [...prev, ...next].slice(-18);
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
