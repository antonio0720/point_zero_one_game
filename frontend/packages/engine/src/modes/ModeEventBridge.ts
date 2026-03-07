// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — MODE EVENT BRIDGE
// pzo-web/src/engines/modes/ModeEventBridge.ts
//
// Bidirectional event bridge between the OLD engine event bus (core/EventBus)
// and the NEW engine event bus (zero/EventBus, consumed by engineStore).
//
// Phase 6 completion scope:
//   ✦ Full card-event forwarding and normalization
//   ✦ Mechanics runtime event forwarding
//   ✦ Mode-specific event forwarding for Predator / Syndicate / Phantom / Empire
//   ✦ Loop-safe bridging between legacy and zero buses
//
// Density6 LLC · Point Zero One · Mode Event Bridge · Confidential
// ═══════════════════════════════════════════════════════════════════════════════

import { ShieldLayerId }       from '../shield/types';
import { ChainId }             from '../cascade/types';
import {
  toNewChainId,
  normalizeSeverity,
  LEGACY_TO_NEW_SHIELD_LAYER_ID,
  NEW_TO_LEGACY_SHIELD_LAYER_ID,
} from './LegacyTypeCompat';

// ─────────────────────────────────────────────────────────────────────────────
// TYPE SHIMS
// ─────────────────────────────────────────────────────────────────────────────

interface PZOEvent {
  eventType: string;
  tick:      number;
  payload:   Record<string, unknown>;
}

interface LegacyEventBus {
  on(eventType: string, handler: (event: PZOEvent) => void): () => void;
  emit(eventType: string, tick: number, payload: Record<string, unknown>): void;
  emitImmediate(eventType: string, tick: number, payload: Record<string, unknown>): void;
}

interface NewEventEnvelope {
  eventType: string;
  payload:   unknown;
  tickIndex: number;
}

interface NewEventBus {
  on(eventType: string, handler: (event: NewEventEnvelope) => void): () => void;
  emit(eventType: string, payload: unknown, sourceEngine?: string): void;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const CARD_EVENTS_SAME_NAME = [
  'CARD_DRAWN',
  'CARD_PLAYED',
  'CARD_DISCARDED',
  'CARD_HELD',
  'CARD_UNHELD',
  'CARD_AUTO_RESOLVED',
  'FORCED_CARD_INJECTED',
  'FORCED_CARD_RESOLVED',
  'MISSED_OPPORTUNITY',
  'PHASE_BOUNDARY_CARD_AVAILABLE',
  'PHASE_BOUNDARY_WINDOW_CLOSED',
  'LEGENDARY_CARD_DRAWN',
  'BLUFF_CARD_DISPLAYED',
  'COUNTER_WINDOW_OPENED',
  'COUNTER_WINDOW_CLOSED',
  'RESCUE_WINDOW_OPENED',
  'RESCUE_WINDOW_CLOSED',
  'DEFECTION_STEP_PLAYED',
  'DEFECTION_COMPLETED',
  'AID_TERMS_ACTIVATED',
  'AID_REPAID',
  'AID_DEFAULTED',
  'GHOST_CARD_ACTIVATED',
  'PROOF_BADGE_CONDITION_MET',
  'CARD_HAND_SNAPSHOT',
] as const;

const LEGACY_MODE_PASSTHROUGH_TO_ZERO = [
  'EXTRACTION_ACTION_FIRED',
  'SABOTAGE_FIRED',
  'SABOTAGE_BLOCKED',
  'PARTNER_DISTRESS',
  'GHOST_AHEAD',
  'GHOST_BEHIND',
] as const;

const MECHANIC_EVENTS_SAME_NAME = [
  'MECHANICS_RUNTIME_INITIALIZED',
  'MECHANICS_CATALOG_REGISTERED',
  'MECHANIC_ACTIVATED',
  'MECHANIC_CONFIDENCE_UPDATED',
  'MECHANIC_SIGNAL_UPDATED',
  'MECHANIC_HEAT_DECAYED',
  'MECHANICS_RUNTIME_RESET',
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

class CircularGuard {
  private _forwarding = false;

  wrap(fn: () => void): void {
    if (this._forwarding) return;
    this._forwarding = true;
    try { fn(); } finally { this._forwarding = false; }
  }
}

function asRecord(payload: unknown): Record<string, unknown> {
  if (payload && typeof payload === 'object') return payload as Record<string, unknown>;
  return {};
}

function num(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : Number(value ?? fallback) || fallback;
}

function str(value: unknown, fallback = ''): string {
  return value === undefined || value === null ? fallback : String(value);
}

// ─────────────────────────────────────────────────────────────────────────────
// MODE EVENT BRIDGE
// ─────────────────────────────────────────────────────────────────────────────

export class ModeEventBridge {
  private readonly legacy: LegacyEventBus;
  private readonly zero:   NewEventBus;
  private readonly guard = new CircularGuard();
  private unsubs: Array<() => void> = [];
  private running = false;

  constructor(legacyBus: LegacyEventBus, zeroBus: NewEventBus) {
    this.legacy = legacyBus;
    this.zero   = zeroBus;
  }

  public start(): void {
    if (this.running) return;
    this.running = true;
    this.wireAtoB();
    this.wireBtoA();
  }

  public stop(): void {
    this.unsubs.forEach((u) => u());
    this.unsubs = [];
    this.running = false;
  }

  private onLegacy(eventType: string, handler: (event: PZOEvent) => void): void {
    this.unsubs.push(this.legacy.on(eventType, handler));
  }

  private onZero(eventType: string, handler: (event: NewEventEnvelope) => void): void {
    this.unsubs.push(this.zero.on(eventType as any, handler as any));
  }

  private emitZero(eventType: string, payload: Record<string, unknown>, source = 'MODE_EVENT_BRIDGE'): void {
    this.zero.emit(eventType as any, payload as any, source as any);
  }

  private emitLegacy(eventType: string, tick: number, payload: Record<string, unknown>): void {
    this.legacy.emit(eventType, tick, payload);
  }

  private forwardLegacySameName(eventType: string): void {
    this.onLegacy(eventType, (e) => {
      this.guard.wrap(() => {
        this.emitZero(eventType, { ...e.payload, tickIndex: e.tick });
      });
    });
  }

  private forwardZeroSameName(eventType: string): void {
    this.onZero(eventType, (e) => {
      this.guard.wrap(() => {
        this.emitLegacy(eventType, e.tickIndex ?? 0, asRecord(e.payload));
      });
    });
  }

  private forwardMechanicEventsAtoB(): void {
    for (const eventType of MECHANIC_EVENTS_SAME_NAME) {
      this.forwardLegacySameName(eventType);
    }
  }

  private forwardMechanicEventsBtoA(): void {
    for (const eventType of MECHANIC_EVENTS_SAME_NAME) {
      this.forwardZeroSameName(eventType);
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // LEGACY → ZERO
  // ───────────────────────────────────────────────────────────────────────────

  private wireAtoB(): void {
    // Core translations already required by the existing hybrid architecture.
    this.onLegacy('PRESSURE_SCORE_UPDATE', (e) => {
      this.guard.wrap(() => {
        this.emitZero('PRESSURE_SCORE_UPDATED', {
          score:     0.5,
          tier:      'HIGH',
          tickIndex: e.tick,
        });
      });
    });

    this.onLegacy('CASCADE_TRIGGERED', (e) => {
      this.guard.wrap(() => {
        const legacyChainId = str(e.payload.chainId);
        const newChainId    = toNewChainId(legacyChainId) ?? ChainId.CHAIN_FULL_CASCADE_BREACH;
        const severity      = normalizeSeverity(str(e.payload.severity, 'MEDIUM'));
        const instanceId    = `legacy_${legacyChainId}_${e.tick}`;

        this.emitZero('CASCADE_CHAIN_STARTED', {
          chainId:         newChainId,
          instanceId,
          severity,
          triggeredAtTick: e.tick,
          _legacyChainId:  legacyChainId,
          _label:          e.payload.label ?? '',
        });
      });
    });

    this.onLegacy('SHIELD_DAMAGED', (e) => {
      this.guard.wrap(() => {
        this.emitZero('SHIELD_HIT', {
          damageResult: {
            attackId:           str(e.payload.sabotageId, `legacy_attack_${e.tick}`),
            targetLayerId:      ShieldLayerId.LIQUIDITY_BUFFER,
            fallbackLayerId:    null,
            rawPower:           num(e.payload.magnitude, 50),
            deflectionApplied:  0,
            effectiveDamage:    num(e.payload.magnitude, 50),
            preHitIntegrity:    100,
            postHitIntegrity:   50,
            breachOccurred:     false,
            cascadeTriggered:   false,
            wasAlreadyBreached: false,
            isCriticalHit:      false,
          },
          tickIndex: e.tick,
          _legacyLabel: e.payload.label ?? '',
        });
      });
    });

    this.onLegacy('RUN_GRADED', (e) => {
      this.guard.wrap(() => {
        this.emitZero('RUN_COMPLETED', {
          proofHash:        '',
          grade:            str(e.payload.grade, 'C'),
          sovereigntyScore: num(e.payload.sovereigntyScore, 0),
          integrityStatus:  'VERIFIED',
          reward:           null,
          _legacyRunId:     e.payload.runId ?? '',
          _legacyOutcome:   e.payload.outcome ?? '',
        });
      });
    });

    this.onLegacy('HATER_HEAT_CHANGED', (e) => {
      this.guard.wrap(() => {
        this.emitZero('HATER_HEAT_CHANGED', {
          prev:      num(e.payload.prev, 0),
          current:   num(e.payload.current, 0),
          tickIndex: e.tick,
        });
      });
    });

    // Legacy breach-only signal → zero-layer typed breach event.
    this.onLegacy('SHIELD_L4_BREACH', (e) => {
      this.guard.wrap(() => {
        const layerId =
          LEGACY_TO_NEW_SHIELD_LAYER_ID['L4_NETWORK_CORE'] ??
          ShieldLayerId.NETWORK_CORE;

        this.emitZero('SHIELD_LAYER_BREACHED', {
          layerId,
          cascadeTriggered: Boolean(e.payload.cascadeTriggered ?? true),
          tickIndex:        e.tick,
          message:          e.payload.message ?? 'Network Core breached.',
        });
      });
    });

    // Card events emitted by old mode/UI systems that must now land on zero/EventBus.
    for (const eventType of CARD_EVENTS_SAME_NAME) {
      this.forwardLegacySameName(eventType);
    }

    // Mode events that the zero bus should now see for cards/mechanics/store sync.
    for (const eventType of LEGACY_MODE_PASSTHROUGH_TO_ZERO) {
      this.forwardLegacySameName(eventType);
    }

    // Rescue expiry needs explicit normalization to the closed-window event used by the new store.
    this.onLegacy('RESCUE_WINDOW_EXPIRED', (e) => {
      this.guard.wrap(() => {
        this.emitZero('RESCUE_WINDOW_CLOSED', {
          teammateId:             str(e.payload.teammateId),
          wasRescued:             false,
          effectivenessMultiplier:num(e.payload.effectivenessMultiplier, 0),
          tickIndex:              e.tick,
        });
      });
    });

    // Aid contracts map to the card-layer trust/economy event.
    this.onLegacy('AID_CONTRACT_SIGNED', (e) => {
      this.guard.wrap(() => {
        this.emitZero('AID_TERMS_ACTIVATED', {
          terms:     e.payload.terms ?? e.payload.contract ?? e.payload,
          tickIndex: e.tick,
        });
      });
    });

    // Legacy badge reward → new proof-badge condition event.
    this.onLegacy('PROOF_BADGE_EARNED', (e) => {
      this.guard.wrap(() => {
        this.emitZero('PROOF_BADGE_CONDITION_MET', {
          badgeId:   str(e.payload.badgeId ?? e.payload.badge ?? 'legacy_badge'),
          cardId:    str(e.payload.cardId),
          tickIndex: e.tick,
        });
      });
    });

    // Legacy divergence telemetry gets surfaced on the zero bus for card + mechanic readers.
    this.onLegacy('GHOST_DELTA_UPDATE', (e) => {
      this.guard.wrap(() => {
        this.emitZero('GHOST_CARD_ACTIVATED', {
          instanceId:       str(e.payload.instanceId, `legacy_ghost_${e.tick}`),
          cardId:           str(e.payload.cardId, 'LEGACY_GHOST'),
          markerType:       str(e.payload.markerType, 'RED'),
          divergenceDelta:  num(e.payload.divergenceDelta ?? e.payload.delta, 0),
          tickIndex:        e.tick,
        });
      });
    });

    this.forwardMechanicEventsAtoB();
  }

  // ───────────────────────────────────────────────────────────────────────────
  // ZERO → LEGACY
  // ───────────────────────────────────────────────────────────────────────────

  private wireBtoA(): void {
    this.onZero('BOT_ATTACK_FIRED', (e) => {
      this.guard.wrap(() => {
        const p = asRecord(e.payload);
        this.emitLegacy('BOT_ATTACK_FIRED', e.tickIndex ?? 0, {
          botId:         p.botId ?? '',
          attackId:      p.attackId ?? '',
          attackType:    p.attackType ?? '',
          targetLayerId: p.targetLayerId ?? '',
        });
      });
    });

    this.onZero('SHIELD_LAYER_BREACHED', (e) => {
      this.guard.wrap(() => {
        const p = asRecord(e.payload);
        const layerId       = str(p.layerId ?? p.layer);
        const legacyLayerId = NEW_TO_LEGACY_SHIELD_LAYER_ID[layerId as ShieldLayerId] ?? layerId;

        this.emitLegacy('SHIELD_LAYER_BREACHED', e.tickIndex ?? 0, {
          layerId:          legacyLayerId,
          cascadeTriggered: p.cascadeTriggered ?? false,
        });

        if (layerId === ShieldLayerId.NETWORK_CORE || legacyLayerId === 'L4_NETWORK_CORE') {
          this.emitLegacy('SHIELD_L4_BREACH', e.tickIndex ?? 0, {
            layerId: 'L4_NETWORK_CORE',
            message: 'Network Core breached.',
          });
        }
      });
    });

    this.onZero('PRESSURE_TIER_CHANGED', (e) => {
      this.guard.wrap(() => {
        const p = asRecord(e.payload);
        this.emitLegacy('PRESSURE_TIER_CHANGED', e.tickIndex ?? 0, {
          prev:    p.from ?? p.prev ?? '',
          current: p.to   ?? p.current ?? '',
          score:   p.score ?? 0,
        });
      });
    });

    this.onZero('PRESSURE_CRITICAL', (e) => {
      this.guard.wrap(() => {
        const p = asRecord(e.payload);
        this.emitLegacy('PRESSURE_TIER_CHANGED', e.tickIndex ?? 0, {
          prev:    'HIGH',
          current: 'CRITICAL',
          score:   p.score ?? 1.0,
        });
      });
    });

    // Forward every card-layer event to legacy listeners with compatibility payloads.
    for (const eventType of CARD_EVENTS_SAME_NAME) {
      this.onZero(eventType, (e) => {
        this.guard.wrap(() => {
          const p = asRecord(e.payload);

          if (eventType === 'DECISION_WINDOW_OPENED') {
            this.emitLegacy(eventType, e.tickIndex ?? 0, {
              windowId:           p.windowId ?? '',
              cardId:             p.cardId ?? p.instanceId ?? '',
              cardInstanceId:     p.cardInstanceId ?? p.instanceId ?? '',
              durationMs:         p.durationMs ?? 0,
              autoResolveChoice:  p.autoResolveChoice ?? p.autoResolveResult ?? '',
              autoResolveResult:  p.autoResolveResult ?? p.autoResolveChoice ?? '',
            });
            return;
          }

          if (eventType === 'RESCUE_WINDOW_CLOSED') {
            this.emitLegacy('RESCUE_WINDOW_CLOSED', e.tickIndex ?? 0, p);
            this.emitLegacy('RESCUE_WINDOW_EXPIRED', e.tickIndex ?? 0, {
              teammateId:              p.teammateId ?? '',
              effectivenessMultiplier: p.effectivenessMultiplier ?? 0,
              wasRescued:              p.wasRescued ?? false,
            });
            return;
          }

          if (eventType === 'AID_TERMS_ACTIVATED') {
            this.emitLegacy('AID_TERMS_ACTIVATED', e.tickIndex ?? 0, p);
            this.emitLegacy('AID_CONTRACT_SIGNED', e.tickIndex ?? 0, {
              terms: p.terms ?? p,
            });
            return;
          }

          if (eventType === 'PROOF_BADGE_CONDITION_MET') {
            this.emitLegacy('PROOF_BADGE_CONDITION_MET', e.tickIndex ?? 0, p);
            this.emitLegacy('PROOF_BADGE_EARNED', e.tickIndex ?? 0, {
              badgeId: p.badgeId ?? '',
              cardId:  p.cardId ?? '',
            });
            return;
          }

          this.emitLegacy(eventType, e.tickIndex ?? 0, p);
        });
      });
    }

    // Mode-specific zero events forwarded to legacy engines/UI.
    for (const eventType of LEGACY_MODE_PASSTHROUGH_TO_ZERO) {
      this.forwardZeroSameName(eventType);
    }

    this.forwardMechanicEventsBtoA();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FACTORY
// ─────────────────────────────────────────────────────────────────────────────

export function createModeEventBridge(): ModeEventBridge {
  const { globalEventBus } = require('../core/EventBus');
  const { sharedEventBus } = require('../zero/EventBus');
  return new ModeEventBridge(globalEventBus, sharedEventBus);
}
