/**
 * /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/backend/host-os/services/moment-bridge.ts
 *
 * MomentBridge
 * Maps engine-facing moment events to Host OS moment codes and emits
 * a normalized `host_moment_fired` payload for downstream consumers.
 */

import { EventEmitter } from 'node:events';

export type GameEngineEvent =
  | 'FUBAR_KILLED_ME'
  | 'OPPORTUNITY_FLIP'
  | 'MISSED_THE_BAG'
  | (string & {});

export interface HostMomentFiredEvent {
  code: string;
  tick: number;
  player: string;
  sourceEvent: GameEngineEvent;
  occurredAt: string;
}

export interface MomentBridgeOptions {
  momentMap?: Readonly<Record<string, string>>;
  emitUnknownEvents?: boolean;
  unknownCode?: string;
}

const DEFAULT_MOMENT_MAP: Readonly<Record<string, string>> = Object.freeze({
  FUBAR_KILLED_ME: 'B01',
  OPPORTUNITY_FLIP: 'A01',
  MISSED_THE_BAG: 'C01',
});

function normalizeEventName(event: string): string {
  return event.trim().toUpperCase().replace(/\s+/g, '_');
}

export class MomentBridge extends EventEmitter {
  private readonly momentMap: Readonly<Record<string, string>>;
  private readonly emitUnknownEvents: boolean;
  private readonly unknownCode: string;

  public constructor(options: MomentBridgeOptions = {}) {
    super();

    this.momentMap = Object.freeze({
      ...DEFAULT_MOMENT_MAP,
      ...(options.momentMap ?? {}),
    });

    this.emitUnknownEvents = options.emitUnknownEvents ?? false;
    this.unknownCode = options.unknownCode?.trim() || 'UNK';
  }

  public getSupportedGameEngineEvents(): GameEngineEvent[] {
    return Object.keys(this.momentMap);
  }

  public resolveMomentCode(event: GameEngineEvent): string | null {
    const normalizedEvent = normalizeEventName(String(event));
    return this.momentMap[normalizedEvent] ?? null;
  }

  /**
   * Emits `host_moment_fired` if a mapped moment code is found.
   * Returns the emitted payload, or null if the event is unmapped and
   * unknown-event emission is disabled.
   */
  public listenToGameEngineEvent(
    event: GameEngineEvent,
    tick: number,
    player: string,
  ): HostMomentFiredEvent | null {
    const normalizedEvent = normalizeEventName(String(event));
    const mappedCode = this.momentMap[normalizedEvent];

    if (!mappedCode && !this.emitUnknownEvents) {
      return null;
    }

    const payload: HostMomentFiredEvent = {
      code: mappedCode ?? this.unknownCode,
      tick: Number.isFinite(tick) ? Math.max(0, Math.trunc(tick)) : 0,
      player: player.trim(),
      sourceEvent: normalizedEvent,
      occurredAt: new Date().toISOString(),
    };

    this.emit('host_moment_fired', payload);
    return payload;
  }

  public onHostMomentFired(
    listener: (payload: HostMomentFiredEvent) => void,
  ): this {
    this.on('host_moment_fired', listener);
    return this;
  }
}

export default MomentBridge;