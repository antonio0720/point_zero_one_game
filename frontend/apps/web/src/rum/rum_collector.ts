/**
 * RUM Collector for Point Zero One Digital's financial roguelike game
 */

declare module '*.json';
import { AnalyticsEvent } from './analytics_event';
import { GameState } from '../game/game_state';

interface RouteTiming {
  routeId: string;
  startTime: number;
  endTime: number;
}

interface ReplayLoadTime {
  replayId: string;
  loadStartTime: number;
  loadEndTime: number;
}

interface InputLatency {
  inputEventId: string;
  startTime: number;
  endTime: number;
}

interface ModalTrap {
  modalId: string;
  startTime: number;
  endTime: number;
}

interface ErrorDetails {
  errorMessage: string;
  stackTrace: string[];
}

class RUMCollector {
  private routeTimings: RouteTiming[] = [];
  private replayLoadTimes: ReplayLoadTime[] = [];
  private inputLatencies: InputLatency[] = [];
  private modalTraps: ModalTrap[] = [];
  private errors: ErrorDetails[] = [];

  public collectRouteTiming(routeId: string, startTime: number, endTime: number): void {
    this.routeTimings.push({ routeId, startTime, endTime });
  }

  public collectReplayLoadTime(replayId: string, loadStartTime: number, loadEndTime: number): void {
    this.replayLoadTimes.push({ replayId, loadStartTime, loadEndTime });
  }

  public collectInputLatency(inputEventId: string, startTime: number, endTime: number): void {
    this.inputLatencies.push({ inputEventId, startTime, endTime });
  }

  public collectModalTrap(modalId: string, startTime: number, endTime: number): void {
    this.modalTraps.push({ modalId, startTime, endTime });
  }

  public collectError(errorMessage: string, stackTrace: string[]): void {
    this.errors.push({ errorMessage, stackTrace });
  }

  public getAnalyticsEvents(): AnalyticsEvent[] {
    const routeTimingEvents = this.routeTimings.map((timing) => ({
      type: 'RouteTiming',
      properties: {
        routeId: timing.routeId,
        startTime: timing.startTime,
        endTime: timing.endTime,
      },
    }));

    const replayLoadTimeEvents = this.replayLoadTimes.map((timing) => ({
      type: 'ReplayLoadTime',
      properties: {
        replayId: timing.replayId,
        loadStartTime: timing.loadStartTime,
        loadEndTime: timing.loadEndTime,
      },
    }));

    const inputLatencyEvents = this.inputLatencies.map((latency) => ({
      type: 'InputLatency',
      properties: {
        inputEventId: latency.inputEventId,
        startTime: latency.startTime,
        endTime: latency.endTime,
      },
    }));

    const modalTrapEvents = this.modalTraps.map((trap) => ({
      type: 'ModalTrap',
      properties: {
        modalId: trap.modalId,
        startTime: trap.startTime,
        endTime: trap.endTime,
      },
    }));

    const errorEvents = this.errors.map((error) => ({
      type: 'Error',
      properties: {
        errorMessage: error.errorMessage,
        stackTrace: error.stackTrace,
      },
    }));

    return [...routeTimingEvents, ...replayLoadTimeEvents, ...inputLatencyEvents, ...modalTrapEvents, ...errorEvents];
  }

  public saveAnalyticsEvents(gameState: GameState): void {
    const analyticsEvents = this.getAnalyticsEvents();
    // Save the analytics events to a file or database using gameState.savePoint
  }
}

export { RUMCollector };
