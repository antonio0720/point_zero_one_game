import { EventBus, PZOEventChannel } from '../engines/core/EventBus';

export function registerPressureTelemetry(eventBus: EventBus): void {
  eventBus.on<{ score: number; tick: number }>(
    PZOEventChannel.PRESSURE_SCORE_UPDATED,
    (event) => {
      const timestamp = Date.now();
      eventBus.emit(PZOEventChannel.PRESSURE_SCORE_UPDATED, {
        ticketNumber: event.tick,
        score: normalizeScore(event.score),
        tier: getPressureTierFromScore(event.score),
        type: PZOEventChannel.PRESSURE_SCORE_UPDATED,
        timestamp,
      });
    }
  );

  eventBus.on<{ tier: number }>(
    PZOEventChannel.PRESSURE_TIER_CHANGED,
    (_event) => {
      const timestamp = Date.now();
      eventBus.emit(PZOEventChannel.PRESSURE_TIER_CHANGED, {
        ticketNumber: -1,
        score: normalizeScore(0),
        tier: getPressureTierFromScore(0),
        type: PZOEventChannel.PRESSURE_TIER_CHANGED,
        timestamp,
      });
    }
  );

  eventBus.on<object>(
    PZOEventChannel.PRESSURE_CRITICAL_ENTERED,
    (_event) => {
      const timestamp = Date.now();
      eventBus.emit(PZOEventChannel.PRESSURE_CRITICAL_ENTERED, {
        ticketNumber: -1,
        score: normalizeScore(0),
        tier: getPressureTierFromScore(-Infinity),
        type: PZOEventChannel.PRESSURE_CRITICAL_ENTERED,
        timestamp,
      });
    }
  );
}

function normalizeScore(score: number): number {
  return Math.min(Math.max(score, 0), Infinity);
}

function getPressureTierFromScore(score: number): string {
  const thresholds = [1000, 5000, 10000];
  if (score <= thresholds[0]) return 'Low';
  if (score <= thresholds[1]) return 'Medium';
  if (score <= thresholds[2]) return 'High';
  return 'Critical';
}
