// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — MODE EVENT BRIDGE
// pzo-web/src/engines/modes/ModeEventBridge.ts
//
// Bidirectional event bridge between the OLD engine event bus (core/EventBus)
// and the NEW engine event bus (zero/EventBus, consumed by engineStore).
//
// WHY THIS EXISTS:
//   EmpireEngine, PredatorEngine, SyndicateEngine, PhantomEngine emit on
//   globalEventBus (core/EventBus). The engineStore only listens on the
//   zero/EventBus (sharedEventBus). Without this bridge:
//     • The store never receives mode-engine events
//     • Old engines never hear store/new-engine events they depend on
//     • Event name mismatches cause silent failures
//
// ARCHITECTURE:
//   globalEventBus (old) ──[A→B]──► sharedEventBus (zero) ──► engineStore
//   sharedEventBus (zero) ──[B→A]──► globalEventBus (old) ──► mode engines
//
// A→B (old events translated to store-compatible names + payloads):
//   PRESSURE_SCORE_UPDATE    → PRESSURE_SCORE_UPDATED   (name + payload shape)
//   CASCADE_TRIGGERED        → CASCADE_CHAIN_STARTED    (name + chainId normalized)
//   SHIELD_DAMAGED           → SHIELD_HIT               (name + payload wrapped)
//   RUN_GRADED               → RUN_COMPLETED            (name + payload normalized)
//   SHIELD_L4_BREACH (old)   → (forwarded as-is on globalEventBus — EmpireEngine
//                               listens here; zero bus fires SHIELD_LAYER_BREACHED
//                               and B→A translates it back)
//
// B→A (new store events forwarded to old bus for legacy engine listeners):
//   BOT_ATTACK_FIRED         → BOT_ATTACK_FIRED          (same name, wraps in PZOEvent)
//   SHIELD_LAYER_BREACHED    → SHIELD_LAYER_BREACHED      (same name)
//                              + if layerId=NETWORK_CORE → also emits SHIELD_L4_BREACH
//   PRESSURE_TIER_CHANGED    → PRESSURE_TIER_CHANGED      (same name)
//
// PASS-THROUGH (mode-specific events that don't need translation — UI only):
//   SABOTAGE_FIRED, SABOTAGE_BLOCKED, GHOST_DELTA_UPDATE, GHOST_AHEAD,
//   GHOST_BEHIND, PROOF_BADGE_EARNED, PARTNER_DISTRESS, RESCUE_WINDOW_OPENED,
//   RESCUE_WINDOW_EXPIRED, AID_CONTRACT_SIGNED
//   → These stay on globalEventBus. UI components subscribe there directly.
//
// USAGE:
//   const bridge = new ModeEventBridge(globalEventBus, sharedEventBus);
//   bridge.start();   // call once after both buses are initialized
//   bridge.stop();    // call on run end / cleanup
//
// RULES:
//   ✦ Never modifies payload fields not listed in the translation map.
//   ✦ All unrecognized events pass through unmodified on their original bus.
//   ✦ Circular emission guard prevents A→B→A loops.
//   ✦ Never imports from features/, store/, or components/.
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
// TYPE SHIMS — minimal shapes we need from each bus
// ─────────────────────────────────────────────────────────────────────────────

/** Old core/EventBus PZOEvent shape. */
interface PZOEvent {
  eventType: string;
  tick:      number;
  payload:   Record<string, unknown>;
}

/** Minimal old EventBus interface we depend on. */
interface LegacyEventBus {
  on(eventType: string, handler: (event: PZOEvent) => void): () => void;
  emit(eventType: string, tick: number, payload: Record<string, unknown>): void;
  emitImmediate(eventType: string, tick: number, payload: Record<string, unknown>): void;
}

/** Minimal new EventBus interface (zero/EventBus). */
interface NewEventBus {
  on(eventType: string, handler: (event: { eventType: string; payload: unknown; tickIndex: number }) => void): () => void;
  emit(eventType: string, payload: unknown, sourceEngine?: string): void;
}

// ─────────────────────────────────────────────────────────────────────────────
// CIRCULAR EMISSION GUARD
// Prevents A→B→A infinite loops. The guard flag is set before any re-emit
// and cleared atomically after.
// ─────────────────────────────────────────────────────────────────────────────

class CircularGuard {
  private _forwarding = false;

  /** Execute fn only if not currently forwarding. */
  wrap(fn: () => void): void {
    if (this._forwarding) return;
    this._forwarding = true;
    try { fn(); } finally { this._forwarding = false; }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MODE EVENT BRIDGE
// ─────────────────────────────────────────────────────────────────────────────

export class ModeEventBridge {
  private readonly legacy:  LegacyEventBus;
  private readonly zero:    NewEventBus;
  private readonly guard:   CircularGuard = new CircularGuard();
  private unsubs: Array<() => void> = [];
  private running = false;

  constructor(legacyBus: LegacyEventBus, zeroBus: NewEventBus) {
    this.legacy = legacyBus;
    this.zero   = zeroBus;
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  public start(): void {
    if (this.running) return;
    this.running = true;
    this.wireAtoB();
    this.wireBtoA();
  }

  public stop(): void {
    this.unsubs.forEach(u => u());
    this.unsubs  = [];
    this.running = false;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DIRECTION A → B
  // Old globalEventBus events → translated to zero/EventBus for engineStore.
  // ─────────────────────────────────────────────────────────────────────────

  private wireAtoB(): void {

    // ── PRESSURE_SCORE_UPDATE → PRESSURE_SCORE_UPDATED ──────────────────────
    // Old payload: { waveEntry?, wave?, prevWave?, message? }
    // New payload: { score, tier, tickIndex }
    // Score is unknown from the old emit — emit with sentinel 0.5 so the store
    // at least registers the tier change. Tier comes from PRESSURE_TIER_CHANGED.
    this.unsubs.push(
      this.legacy.on('PRESSURE_SCORE_UPDATE', (e) => {
        this.guard.wrap(() => {
          this.zero.emit('PRESSURE_SCORE_UPDATED', {
            score:      0.5,       // sentinel — real score comes from Engine 2
            tier:       'HIGH',    // approximated — override on PRESSURE_TIER_CHANGED
            tickIndex:  e.tick,
          });
        });
      })
    );

    // ── CASCADE_TRIGGERED → CASCADE_CHAIN_STARTED ───────────────────────────
    // Old payload: { chainId: 'CHAIN_06_TOTAL_SYSTEMIC', severity, label }
    // New payload: { chainId: ChainId, instanceId, severity, triggeredAtTick }
    this.unsubs.push(
      this.legacy.on('CASCADE_TRIGGERED', (e) => {
        this.guard.wrap(() => {
          const legacyChainId = String(e.payload.chainId ?? '');
          const newChainId    = toNewChainId(legacyChainId) ?? ChainId.CHAIN_FULL_CASCADE_BREACH;
          const severity      = normalizeSeverity(String(e.payload.severity ?? 'MEDIUM'));
          const instanceId    = `legacy_${legacyChainId}_${e.tick}`;

          this.zero.emit('CASCADE_CHAIN_STARTED', {
            chainId:         newChainId,
            instanceId,
            severity,
            triggeredAtTick: e.tick,
            // Preserve legacy fields for any consumer that reads them
            _legacyChainId:  legacyChainId,
            _label:          e.payload.label ?? '',
          });
        });
      })
    );

    // ── SHIELD_DAMAGED → SHIELD_HIT ─────────────────────────────────────────
    // Old payload (PredatorEngine): { label, description, windowTicks, sabotageId, message }
    //   OR: { label: 'Sabotage landed: ...', magnitude: comboMult }
    // New SHIELD_HIT payload: { damageResult: DamageResult }
    // DamageResult is not fully reconstructable from old payload — emit a synthetic one.
    this.unsubs.push(
      this.legacy.on('SHIELD_DAMAGED', (e) => {
        this.guard.wrap(() => {
          // Synthetic DamageResult — enough to trigger store animations
          const syntheticDamageResult = {
            attackId:          String(e.payload.sabotageId ?? `sabotage_${e.tick}`),
            targetLayerId:     ShieldLayerId.LIQUIDITY_BUFFER,  // weakest — best guess
            fallbackLayerId:   null,
            rawPower:          Number(e.payload.magnitude ?? 50),
            deflectionApplied: 0,
            effectiveDamage:   Number(e.payload.magnitude ?? 50),
            preHitIntegrity:   100,
            postHitIntegrity:  50,
            breachOccurred:    false,
            cascadeTriggered:  false,
            wasAlreadyBreached:false,
            isCriticalHit:     false,
          };

          this.zero.emit('SHIELD_HIT', {
            damageResult: syntheticDamageResult,
            tickIndex:    e.tick,
            _legacyLabel: e.payload.label ?? '',
          });
        });
      })
    );

    // ── RUN_GRADED → RUN_COMPLETED ──────────────────────────────────────────
    // Old payload: { outcome, sovereigntyScore, grade, runId, label }
    // New RUN_COMPLETED payload: { proofHash, grade, sovereigntyScore, integrityStatus, reward }
    this.unsubs.push(
      this.legacy.on('RUN_GRADED', (e) => {
        this.guard.wrap(() => {
          const grade           = String(e.payload.grade ?? 'C');
          const sovereigntyScore= Number(e.payload.sovereigntyScore ?? 0);

          this.zero.emit('RUN_COMPLETED', {
            proofHash:        '',            // minted by SovereigntyEngine in new system
            grade,
            sovereigntyScore,
            integrityStatus:  'VERIFIED',
            reward:           null,          // reward dispatched separately
            _legacyRunId:     e.payload.runId ?? '',
            _legacyOutcome:   e.payload.outcome ?? '',
          });
        });
      })
    );

    // ── HATER_HEAT_CHANGED — forward only, no translation needed ────────────
    // Not consumed by engineStore directly — battle snapshot handles hater heat.
    // Forward anyway so future store expansions can subscribe.
    this.unsubs.push(
      this.legacy.on('HATER_HEAT_CHANGED', (e) => {
        this.guard.wrap(() => {
          this.zero.emit('HATER_HEAT_CHANGED' as any, {
            prev:      e.payload.prev ?? 0,
            current:   e.payload.current ?? 0,
            tickIndex: e.tick,
          });
        });
      })
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DIRECTION B → A
  // New zero/EventBus events → forwarded to globalEventBus for legacy engines.
  // ─────────────────────────────────────────────────────────────────────────

  private wireBtoA(): void {

    // ── BOT_ATTACK_FIRED — EmpireEngine listens ──────────────────────────────
    // New payload shape: BotAttackFiredEvent from battle/types.ts
    // Old handler signature: (PZOEvent) => void — only reads payload as opaque object
    this.unsubs.push(
      this.zero.on('BOT_ATTACK_FIRED', (e) => {
        this.guard.wrap(() => {
          const p = e.payload as Record<string, unknown>;
          this.legacy.emit('BOT_ATTACK_FIRED', e.tickIndex ?? 0, {
            botId:     p.botId ?? '',
            attackId:  p.attackId ?? '',
            attackType:p.attackType ?? '',
            targetLayerId: p.targetLayerId ?? '',
          });
        });
      })
    );

    // ── SHIELD_LAYER_BREACHED — PredatorEngine + SyndicateEngine listen ──────
    // Also, if layerId === NETWORK_CORE, emit SHIELD_L4_BREACH for EmpireEngine.
    this.unsubs.push(
      this.zero.on('SHIELD_LAYER_BREACHED', (e) => {
        this.guard.wrap(() => {
          const p = e.payload as Record<string, unknown>;
          const layerId = String(p.layerId ?? p.layer ?? '');
          const legacyLayerId = NEW_TO_LEGACY_SHIELD_LAYER_ID[layerId as ShieldLayerId] ?? layerId;

          // Forward SHIELD_LAYER_BREACHED with legacy-compatible payload
          this.legacy.emit('SHIELD_LAYER_BREACHED', e.tickIndex ?? 0, {
            layerId:          legacyLayerId,
            cascadeTriggered: p.cascadeTriggered ?? false,
          });

          // EmpireEngine specifically listens for 'SHIELD_L4_BREACH' for L4 breach events
          if (layerId === ShieldLayerId.NETWORK_CORE || legacyLayerId === 'L4_NETWORK_CORE') {
            this.legacy.emit('SHIELD_L4_BREACH', e.tickIndex ?? 0, {
              layerId: 'L4_NETWORK_CORE',
              message: 'Network Core breached.',
            });
          }
        });
      })
    );

    // ── PRESSURE_TIER_CHANGED — EmpireEngine listens ────────────────────────
    // Same event name in both systems — forward with payload normalization.
    this.unsubs.push(
      this.zero.on('PRESSURE_TIER_CHANGED', (e) => {
        this.guard.wrap(() => {
          const p = e.payload as Record<string, unknown>;
          this.legacy.emit('PRESSURE_TIER_CHANGED', e.tickIndex ?? 0, {
            prev:    p.from ?? p.prev ?? '',
            current: p.to   ?? p.current ?? '',
            score:   p.score ?? 0,
          });
        });
      })
    );

    // ── PRESSURE_CRITICAL — EmpireEngine reacts to PRESSURE_TIER_CHANGED ────
    // Empire listens for `current === 'CRITICAL'` in PRESSURE_TIER_CHANGED.
    // New system emits PRESSURE_CRITICAL separately. Forward it as tier change.
    this.unsubs.push(
      this.zero.on('PRESSURE_CRITICAL', (e) => {
        this.guard.wrap(() => {
          const p = e.payload as Record<string, unknown>;
          this.legacy.emit('PRESSURE_TIER_CHANGED', e.tickIndex ?? 0, {
            prev:    'HIGH',
            current: 'CRITICAL',
            score:   p.score ?? 1.0,
          });
        });
      })
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FACTORY — creates bridge from well-known bus singletons
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create and return a configured ModeEventBridge.
 * Call bridge.start() immediately after, before any engines call init().
 *
 * @example
 *   import { createModeEventBridge } from './ModeEventBridge';
 *   const bridge = createModeEventBridge();
 *   bridge.start();
 *   // ... run engines ...
 *   bridge.stop();
 */
export function createModeEventBridge(): ModeEventBridge {
  const { globalEventBus } = require('../core/EventBus');
  const { sharedEventBus } = require('../zero/EventBus');
  return new ModeEventBridge(globalEventBus, sharedEventBus);
}