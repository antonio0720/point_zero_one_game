// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — PREDATOR ENGINE (ASYMMETRIC PVP)
// pzo-web/src/engines/modes/PredatorEngine.ts
// Density6 LLC · Confidential
// ═══════════════════════════════════════════════════════════════════════════
// PREDATOR: One player builds. One player is the Hater.
// The Hater fires financial sabotage cards in real time.
// The Builder gets a narrow counterplay window before each sabotage lands.
// Success trains the Builder to detect and neutralize financial attacks.
//
// Unique mechanics:
//   • Sabotage Deck — 8 sabotage card types with cooldowns
//   • Counterplay Window — 6-tick window to detect and block each sabotage
//   • Hater Combo System — consecutive unblocked sabotages escalate damage
//   • Battle Phases — Early / Mid / Endgame with different dynamics
//   • Asymmetric Win Condition — Hater wins by bankrupting Builder;
//     Builder wins by surviving 720 ticks with income > expenses

import type {
  IGameModeEngine, RunMode, RunOutcome, ModeInitConfig,
  RunStateSnapshot, GameModeState, PZOEvent, SabotageCard, SabotageType,
} from '../core/types';
import { SABOTAGE_DECK }       from '../core/types';
import { globalEventBus }      from '../core/EventBus';
import type { LiveRunState }   from '../core/RunStateSnapshot';

// ── Sabotage queue entry ──────────────────────────────────────────────────────

interface QueuedSabotage {
  id:            string;
  card:          SabotageCard;
  firedAtTick:   number;
  arrivesAtTick: number;    // firedAtTick + 6 (counterplay window)
  blocked:       boolean;
  landed:        boolean;
}

// ── Active sabotage effect ────────────────────────────────────────────────────

interface ActiveSabotageEffect {
  id:           string;
  type:         SabotageType;
  startTick:    number;
  endTick:      number;
  magnitude:    number;
  label:        string;
}

// ── Engine ────────────────────────────────────────────────────────────────────

export class PredatorEngine implements IGameModeEngine {
  public readonly mode: RunMode = 'asymmetric-pvp';
  public readonly runId: string;

  private liveStateRef:  LiveRunState | null = null;
  private config:        ModeInitConfig | null = null;
  private eventHandlers: Array<() => void> = [];

  // Asymmetric state
  private localRole:          'builder' | 'hater' = 'builder';
  private sabotageDeck:       SabotageCard[] = [];
  private sabotageQueue:      QueuedSabotage[] = [];
  private activeEffects:      ActiveSabotageEffect[] = [];
  private cardCooldowns:      Map<string, number> = new Map();  // cardId → can fire at tick
  private haterComboCount:    number = 0;   // unblocked consecutive sabotages
  private counterplayWindow:  boolean = false;
  private counterplayTicksLeft: number = 0;
  private pendingSabotage:    QueuedSabotage | null = null;

  // Builder state mirror (in real multiplayer this comes from the server)
  private builderNetWorth:  number = 0;
  private builderShieldPct: number = 1.0;

  // Battle phase
  private phase: 'early' | 'mid' | 'endgame' = 'early';

  constructor() {
    this.runId = `predator_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  public init(config: ModeInitConfig): void {
    this.config    = config;
    this.localRole = config.localRole ?? 'builder';

    // Initialize sabotage deck (hater gets all 8 sabotage cards)
    this.sabotageDeck   = [...SABOTAGE_DECK];
    this.sabotageQueue  = [];
    this.activeEffects  = [];
    this.haterComboCount = 0;
    this.counterplayWindow = false;
    this.counterplayTicksLeft = 0;
    this.pendingSabotage = null;

    this.eventHandlers.push(
      globalEventBus.on('SHIELD_LAYER_BREACHED', (e) => this.onShieldBreached(e)),
      globalEventBus.on('CASH_CHANGED',          (e) => this.onCashChanged(e)),
    );

    const roleLabel = this.localRole === 'builder' ? 'Builder' : 'Hater';
    globalEventBus.emitImmediate('RUN_STARTED', 0, {
      mode: 'asymmetric-pvp', label: 'PREDATOR', runId: this.runId,
      role: this.localRole,
      message: this.localRole === 'builder'
        ? 'Someone wants you to fail. They have a deck designed to destroy you. Build faster than they can sabotage.'
        : 'The Builder is growing. Your job is to collapse their income before they reach FREEDOM.',
    });
  }

  public onTick(snapshot: RunStateSnapshot): void {
    const tick = snapshot.tick;

    // ── 1. Update battle phase ──────────────────────────────────────────
    if (tick >= 480) this.phase = 'endgame';
    else if (tick >= 240) this.phase = 'mid';

    // ── 2. Tick down counterplay window ─────────────────────────────────
    if (this.counterplayWindow) {
      this.counterplayTicksLeft--;
      if (this.counterplayTicksLeft <= 0) {
        this.counterplayWindow = false;
        if (this.pendingSabotage && !this.pendingSabotage.blocked) {
          // Window expired — sabotage lands
          this.applyLandedSabotage(this.pendingSabotage, snapshot);
          this.haterComboCount++;
          globalEventBus.emit('SABOTAGE_FIRED', tick, {
            sabotageId:   this.pendingSabotage.id,
            type:         this.pendingSabotage.card.type,
            blocked:      false,
            comboCount:   this.haterComboCount,
            label:        this.pendingSabotage.card.label,
          });
          this.pendingSabotage = null;
        }
      }
    }

    // ── 3. Process incoming sabotages from queue ─────────────────────────
    const arriving = this.sabotageQueue.filter(s => s.arrivesAtTick === tick && !s.landed && !s.blocked);
    for (const sab of arriving) {
      this.openCounterplayWindow(sab, tick);
    }

    // ── 4. Tick active effects ────────────────────────────────────────────
    this.tickActiveEffects(snapshot);

    // ── 5. If local is HATER: fire sabotage AI every N ticks ─────────────
    if (this.localRole === 'hater' || this.config?.haterPlayerId === 'AI') {
      this.tickHaterAI(snapshot);
    }

    // ── 6. Sync builder state mirror ──────────────────────────────────────
    this.builderNetWorth  = snapshot.netWorth;
    this.builderShieldPct = snapshot.shields.overallIntegrityPct;

    // ── 7. Hater combo decay if builder goes unattacked for a while ───────
    if (tick % 36 === 0 && this.haterComboCount > 0) {
      this.haterComboCount = Math.max(0, this.haterComboCount - 1);
    }
  }

  public onRunEnd(outcome: RunOutcome): void {
    const builderWon = outcome === 'FREEDOM' || outcome === 'TIMEOUT';
    globalEventBus.emitImmediate('RUN_ENDED', this.liveStateRef?.tick ?? 0, {
      outcome, runId: this.runId,
      builderWon,
      haterComboCount: this.haterComboCount,
      message: builderWon
        ? 'The Builder survived the sabotage. Unbreakable.'
        : 'The Hater\'s extraction machine won. The Builder\'s defenses weren\'t enough.',
    });
    this.eventHandlers.forEach(unsub => unsub());
    this.eventHandlers = [];
  }

  public getState(): GameModeState {
    return {
      mode: 'asymmetric-pvp',
      predator: {
        localRole:             this.localRole,
        builderNetWorth:       this.builderNetWorth,
        haterSabotageAmmo:     this.getAvailableSabotageCount(this.liveStateRef?.tick ?? 0),
        counterplayWindow:     this.counterplayWindow,
        counterplayTicksLeft:  this.counterplayTicksLeft,
        haterComboCount:       this.haterComboCount,
        builderShieldPct:      this.builderShieldPct,
        phase:                 this.phase,
      },
    };
  }

  public subscribe(handler: (event: PZOEvent) => void): () => void {
    const unsub = globalEventBus.on('SABOTAGE_FIRED',    handler);
    const unsub2 = globalEventBus.on('SABOTAGE_BLOCKED', handler);
    return () => { unsub(); unsub2(); };
  }

  public setLiveStateRef(ref: LiveRunState): void {
    this.liveStateRef = ref;
  }

  // ── Public: Hater fires a sabotage card (called by UI or AI) ─────────────

  public fireSabotage(cardId: string, currentTick: number): boolean {
    if (this.localRole !== 'hater') return false;
    const card = this.sabotageDeck.find(c => c.id === cardId);
    if (!card) return false;

    const cooldownUntil = this.cardCooldowns.get(cardId) ?? 0;
    if (currentTick < cooldownUntil) return false;

    const sab: QueuedSabotage = {
      id:            `sab_${Date.now()}`,
      card,
      firedAtTick:   currentTick,
      arrivesAtTick: currentTick + 6,  // 6-tick counterplay window
      blocked:       false,
      landed:        false,
    };

    this.sabotageQueue.push(sab);
    this.cardCooldowns.set(cardId, currentTick + card.cooldownTicks);

    globalEventBus.emit('SABOTAGE_FIRED', currentTick, {
      sabotageId: sab.id, type: card.type,
      arrivesAt:  sab.arrivesAtTick,
      label:      card.label,
      message:    `${card.label} incoming. Builder has 6 ticks to respond.`,
    });

    return true;
  }

  // ── Public: Builder blocks an incoming sabotage ───────────────────────────

  public blockSabotage(sabotageId: string, currentTick: number): boolean {
    if (this.localRole !== 'builder') return false;
    if (!this.counterplayWindow) return false;

    const sab = this.sabotageQueue.find(s => s.id === sabotageId && !s.landed && !s.blocked);
    if (!sab) return false;

    sab.blocked = true;
    this.haterComboCount = 0;  // reset combo on successful block
    this.counterplayWindow = false;
    this.pendingSabotage   = null;

    globalEventBus.emit('SABOTAGE_BLOCKED', currentTick, {
      sabotageId, type: sab.card.type, label: sab.card.label,
      message: 'Defense deployed. Sabotage neutralized before impact.',
    });
    return true;
  }

  // ── Private: Open counterplay window ────────────────────────────────────

  private openCounterplayWindow(sab: QueuedSabotage, tick: number): void {
    this.counterplayWindow    = true;
    this.counterplayTicksLeft = 6;
    this.pendingSabotage      = sab;

    globalEventBus.emit('SHIELD_DAMAGED', tick, {
      label:        `INCOMING: ${sab.card.label}`,
      description:  sab.card.description,
      windowTicks:  6,
      sabotageId:   sab.id,
      message:      `${sab.card.label} will land in 6 ticks. Counter it now or absorb the hit.`,
    });
  }

  // ── Private: Apply landed sabotage to live state ─────────────────────────

  private applyLandedSabotage(sab: QueuedSabotage, snapshot: RunStateSnapshot): void {
    sab.landed = true;
    const live = this.liveStateRef;
    if (!live) return;

    // Combo multiplier — unblocked consecutive sabotages escalate
    const comboMult = 1 + (this.haterComboCount * 0.25);

    const effect: ActiveSabotageEffect = {
      id:        `eff_${sab.id}`,
      type:      sab.card.type,
      startTick: snapshot.tick,
      endTick:   snapshot.tick + sab.card.durationTicks,
      magnitude: sab.card.magnitude * comboMult,
      label:     sab.card.label,
    };

    switch (sab.card.type) {
      case 'FREEZE_INCOME':
        live.income = 0;
        this.activeEffects.push(effect);
        break;
      case 'PHANTOM_EXPENSE':
        live.expenses += effect.magnitude;
        this.activeEffects.push(effect);
        break;
      case 'CREDIT_LOCK':
        live.shields.layers.L2_CREDIT_LINE.regenActive = false;
        this.activeEffects.push(effect);
        break;
      case 'MARKET_RUMOR':
        live.income = Math.floor(live.income * effect.magnitude);
        this.activeEffects.push(effect);
        break;
      case 'AUDIT_TRIGGER':
        live.cash = Math.max(0, live.cash - effect.magnitude);
        break;
      case 'SHIELD_CORRODE':
        this.activeEffects.push(effect); // tick-based in tickActiveEffects
        break;
      case 'OPPORTUNITY_SNIPE':
        globalEventBus.emit('INCOME_CHANGED', snapshot.tick, {
          delta: -500, reason: 'Opportunity sniped — income card destroyed', magnitude: effect.magnitude,
        });
        break;
      case 'DEBT_INJECTION':
        live.expenses += effect.magnitude;
        break;
    }

    globalEventBus.emit('EXPENSE_CHANGED', snapshot.tick, {
      label: `Sabotage landed: ${sab.card.label}`, magnitude: comboMult,
    });
  }

  // ── Private: Tick active effects (resolve durations) ────────────────────

  private tickActiveEffects(snapshot: RunStateSnapshot): void {
    const live = this.liveStateRef;
    if (!live) return;

    const expired: string[] = [];
    for (const eff of this.activeEffects) {
      if (snapshot.tick > eff.endTick) {
        expired.push(eff.id);
        // Restore state when effect expires
        switch (eff.type) {
          case 'FREEZE_INCOME':
            live.income = snapshot.income + 0;  // Will be restored by income tracking
            break;
          case 'PHANTOM_EXPENSE':
            live.expenses = Math.max(0, live.expenses - eff.magnitude);
            break;
          case 'CREDIT_LOCK':
            live.shields.layers.L2_CREDIT_LINE.regenActive = true;
            break;
          case 'MARKET_RUMOR':
            live.income = Math.floor(live.income / eff.magnitude);
            break;
        }
      } else if (eff.type === 'SHIELD_CORRODE') {
        // Drain 8 pts/tick from weakest layer while active
        const weakest = this.findWeakestLayer(live);
        const layer = live.shields.layers[weakest];
        layer.current = Math.max(0, layer.current - 8);
      }
    }
    this.activeEffects = this.activeEffects.filter(e => !expired.includes(e.id));
  }

  // ── Private: Hater AI (fires sabotage on behalf of AI opponent) ───────────

  private tickHaterAI(snapshot: RunStateSnapshot): void {
    // AI hater fires every 24 ticks, escalating in endgame
    const fireInterval = this.phase === 'endgame' ? 16 : this.phase === 'mid' ? 20 : 28;
    if (snapshot.tick % fireInterval !== 0 || snapshot.tick === 0) return;

    // Pick the sabotage that would hurt most right now
    const available = this.sabotageDeck.filter(c => {
      const cooldownUntil = this.cardCooldowns.get(c.id) ?? 0;
      return snapshot.tick >= cooldownUntil;
    });
    if (available.length === 0) return;

    // Strategy: if shields are high, go for FREEZE_INCOME; if shields low, AUDIT_TRIGGER
    const shieldPct = snapshot.shields.overallIntegrityPct;
    let target: SabotageCard;
    if (shieldPct > 0.7) {
      target = available.find(c => c.type === 'FREEZE_INCOME') ?? available[0];
    } else if (shieldPct < 0.3) {
      target = available.find(c => c.type === 'AUDIT_TRIGGER') ?? available[0];
    } else {
      target = available[Math.floor(Math.random() * available.length)];
    }

    this.cardCooldowns.set(target.id, snapshot.tick + target.cooldownTicks);
    const sab: QueuedSabotage = {
      id:            `ai_sab_${snapshot.tick}`,
      card:          target,
      firedAtTick:   snapshot.tick,
      arrivesAtTick: snapshot.tick + 6,
      blocked:       false,
      landed:        false,
    };
    this.sabotageQueue.push(sab);

    globalEventBus.emit('SABOTAGE_FIRED', snapshot.tick, {
      sabotageId: sab.id, type: target.type, arrivesAt: sab.arrivesAtTick,
      label:      target.label, isAI: true,
      message:    `AI Hater fires: ${target.label}. You have 6 ticks.`,
    });
  }

  // ── Private: helpers ──────────────────────────────────────────────────────

  private getAvailableSabotageCount(tick: number): number {
    return this.sabotageDeck.filter(c => tick >= (this.cardCooldowns.get(c.id) ?? 0)).length;
  }

  private findWeakestLayer(live: LiveRunState): import('../core/types').ShieldLayerId {
    const order: import('../core/types').ShieldLayerId[] = [
      'L1_LIQUIDITY_BUFFER', 'L2_CREDIT_LINE', 'L3_ASSET_FLOOR', 'L4_NETWORK_CORE',
    ];
    let weakest = order[0];
    let weakestPct = live.shields.layers[order[0]].current / live.shields.layers[order[0]].max;
    for (const id of order.slice(1)) {
      const pct = live.shields.layers[id].current / live.shields.layers[id].max;
      if (pct < weakestPct) { weakestPct = pct; weakest = id; }
    }
    return weakest;
  }

  private onShieldBreached(event: PZOEvent): void {
    if (this.liveStateRef) {
      this.liveStateRef.haterHeat = Math.min(100, this.liveStateRef.haterHeat + 8);
    }
  }

  private onCashChanged(event: PZOEvent): void {
    const payload = event.payload as { current: number };
    this.builderNetWorth = payload.current;
  }
}
